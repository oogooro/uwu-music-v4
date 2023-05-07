import { AudioPlayer, AudioPlayerStatus, AudioResource, createAudioPlayer, createAudioResource, getVoiceConnection, StreamType } from '@discordjs/voice';
import { logger, queues } from '..';
import { RepeatMode } from '../typings/repeatMode';
import { songToDisplayString } from '../utils';
import { YoutubeSong } from './YoutubeSong';
import { pipeline } from 'node:stream';
import { SponsorBlock } from 'sponsorblock-api';
import { PlayerEvent } from '../typings/playerEvents';
import { spawn, ChildProcess } from 'node:child_process';
import config from '../config';
import ffmpegPath from 'ffmpeg-static';

const sponsorBlock = new SponsorBlock(process.env.SPONSORBLOCK_USER_ID);

interface Processes {
    ytdlp: ChildProcess;
    ffmpeg: ChildProcess;
}

export class AudioPlayerManager {
    private seekOffset = 0;
    private timestampPoolingInterval: NodeJS.Timer;
    private procesess: Processes = {
        ytdlp: null,
        ffmpeg: null,
    };
    private streamPipe?: any;
    currentResource: AudioResource;
    guildId: string;
    player: AudioPlayer;
    playerEvents: PlayerEvent[] = [];

    constructor(guildId: string) {
        this.guildId = guildId;

        const player = createAudioPlayer();
        this.player = player;

        player.on('stateChange', (oldState, newState) => {
            logger.debug(`[PLAYER] ${guildId} ${oldState.status} => ${newState.status}`);
            const queue = queues.get(this.guildId);

            if (!this.timestampPoolingInterval) {
                this.timestampPoolingInterval = setInterval(() => {
                    if (!queue.paused && queue.playing) {
                        // console.log(`Current time: ${formatTimeDisplay(this.getCurrentDuration())}/${queue.songs[0].formatedDuration}`);
                        if (this.playerEvents.length && (this.playerEvents[0].timestamp <= this.getCurrentDuration()) && (this.playerEvents[0].skipTo > this.getCurrentDuration())) {
                            const event = this.playerEvents.shift();
                            console.log(event);
                            if (event.skipTo !== -1) queue.seek(event.skipTo);
                            else queue.skip();
                        }
                    } else {
                        clearInterval(this.timestampPoolingInterval);
                        this.timestampPoolingInterval = null;
                    }
                }, 1000);
            }

            if (oldState.status === AudioPlayerStatus.Playing && newState.status === AudioPlayerStatus.Idle) {
                if (queue.repeatMode === RepeatMode.Disabled) queue.previousSongs.push(queue.songs.shift());
                else if (queue.repeatMode === RepeatMode.Queue) queue.songs.push(queue.songs.shift());

                this.cleanStreamsAndProcesses();

                if (queue.songs.length) this.play();
                else queue.playing = false;
            }
        });

        player.on('error', (err) => {
            logger.error(err);
            queues.get(this.guildId).playing = false;
        });
    }

    private cleanStreamsAndProcesses(): void {
        this.procesess.ffmpeg?.kill();
        this.procesess.ytdlp?.kill();

        this.procesess.ytdlp?.stdout.destroy();
        this.procesess.ffmpeg?.stdin.destroy();
        this.procesess.ffmpeg?.stdout.destroy();
        this.streamPipe?.destroy();
    }

    getCurrentDuration(): number {
        if (this.player.state.status === AudioPlayerStatus.Idle) return -1;
        return (this.currentResource.playbackDuration / 1000) + this.seekOffset;
    }

    addEvent(timestamp: number, skipTo: number): PlayerEvent {
        const event: PlayerEvent = { timestamp, skipTo };
        this.playerEvents.push(event);
        this.playerEvents.sort((a, b) => a.timestamp - b.timestamp);

        return event;
    }

    async play(seekTime = 0) {
        const connection = getVoiceConnection(this.guildId);
        const queue = queues.get(this.guildId);

        if (!connection) return void logger.error(new Error('No connection'));
        if (!queue) return void logger.error(new Error('No queue'));
        if (!queue.songs.length) return void logger.error(new Error('No songs'));

        this.cleanStreamsAndProcesses();

        queue.playing = true;

        const [song, nextSong] = queue.songs;

        try {
            if (song instanceof YoutubeSong && song.partial) await song.patch();

            if (nextSong && (nextSong instanceof YoutubeSong) && nextSong.partial) nextSong.patch().catch(() => { /* it will throw the next time */ });
        } catch (err) {
            if (err instanceof Error) {
                if (song instanceof YoutubeSong && err.message.includes('Sign in')) {
                    queue.textChannel.send({
                        embeds: [{
                            title: 'Wystąpił błąd!',
                            description: `Nie można zagrać piosenki:\n\n${songToDisplayString(song, true)}\nYoutube nie pozwala odtwarzać piosenek z ograniczeniami wiekowymi bez zalogowania się!\n\nPiosenka zostaje pominięta!`,
                            color: 0xff0000,
                            thumbnail: {
                                url: song.thumbnail,
                            },
                        }],
                    }).catch(err => logger.error(err));
                } else {
                    logger.error(err);

                    queue.textChannel.send({
                        embeds: [{
                            title: 'Wystąpił błąd!',
                            description: `Nie można dostać informacji o:\n\n${songToDisplayString(song, true)}\n\nPiosenka zostaje pominięta!`,
                            color: 0xff0000,
                        }],
                    }).catch(err => logger.error(err));
                }

                queue.skip(null, true);
                return;
            }
        }

        console.log(song.url);

        const ytdlpProcess = spawn(config.ytdlpPath, [
            '-q',
            '-f', 'ba',
            song.url,
            '-o', '-',
        ], {
            stdio: [
                'pipe', 'pipe', 'inherit',
            ],
        });

        const ffmpegProcess = spawn(ffmpegPath, [
            '-analyzeduration', '0',
            '-loglevel', '0',
            '-i', '-',
            '-ar', '48000',
            '-ac', '2',
            '-f', 's16le',
            '-ss', seekTime.toString(),
            'pipe:1',
        ], {
            stdio: [
                'pipe', 'pipe', 'inherit',
            ],
        });

        const pipe = pipeline(ytdlpProcess.stdout, ffmpegProcess.stdin, () => void 0);
        
        this.procesess = {
            ffmpeg: ffmpegProcess,
            ytdlp: ytdlpProcess,
        }

        this.streamPipe = pipe;

        ytdlpProcess.on('error', err => logger.error(err));
        ffmpegProcess.on('error', err => logger.error(err));
        pipe.on('error', err => logger.error(err));

        const resource = createAudioResource(ffmpegProcess.stdout, { inputType: StreamType.Raw });
        // resource.volume.setVolume(song.volume);
        this.currentResource = resource;
        this.seekOffset = seekTime;

        this.player.play(resource);

        connection.subscribe(this.player);
    }
}