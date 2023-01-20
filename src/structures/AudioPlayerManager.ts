import { AudioPlayer, AudioPlayerStatus, AudioResource, createAudioPlayer, createAudioResource, demuxProbe, getVoiceConnection, StreamType } from '@discordjs/voice';
import { stream } from 'play-dl';
import { logger, queues } from '..';
import { RepeatMode } from '../typings/repeatMode';
import { songToDisplayString } from '../utils';
import { YoutubeSong } from './YoutubeSong';
import { FFmpeg } from 'prism-media'; 
import { pipeline } from 'node:stream';
import axios from 'axios';
import { SponsorBlock } from 'sponsorblock-api';

const sponsorBlock = new SponsorBlock(process.env.SPONSORBLOCK_USER_ID);

export class AudioPlayerManager {
    guildId: string;
    player: AudioPlayer;
    private seekOffest = 0;
    private currentResource: AudioResource;

    constructor(guildId: string) {
        this.guildId = guildId;

        const player = createAudioPlayer(); 
        this.player = player;

        player.on('stateChange', (oldState, newState) => {
            logger.debug(`[PLAYER] ${guildId} ${oldState.status} => ${newState.status}`);
            if (oldState.status === AudioPlayerStatus.Playing && newState.status === AudioPlayerStatus.Idle) {
                const queue = queues.get(this.guildId);
                
                if (queue.repeatMode === RepeatMode.Disabled) queue.previousSongs.push(queue.songs.shift());
                else if (queue.repeatMode === RepeatMode.Queue) queue.songs.push(queue.songs.shift());

                if (queue.songs.length) this.play();
                else queue.playing = false;
            }
        });

        player.on('error', (err) => {
            logger.error(err);
            queues.get(this.guildId).playing = false;
        });
    }

    getCurrentDuration(): number {
        if (this.player.state.status === AudioPlayerStatus.Idle) return -1;
        return (this.currentResource.playbackDuration / 1000) + this.seekOffest;
    }

    async play(seekTime?: number) {
        const connection = getVoiceConnection(this.guildId);
        const queue = queues.get(this.guildId);

        if (!connection) return void logger.error(new Error('No connection'));
        if (!queue) return void logger.error(new Error('No queue'));
        if (!queue.songs.length) return void logger.error(new Error('No songs'));
        
        queue.playing = true;
        
        const [song, nextSong] = queue.songs;

        try {
            if (song instanceof YoutubeSong && song.partial) await song.patch();
            
            if (nextSong && (nextSong instanceof YoutubeSong) && nextSong.partial) nextSong.patch().catch(() => {/* it will throw the next time */});
        } catch (err) {
            if (err instanceof Error) {
                if (song instanceof YoutubeSong && err.message.includes('Sign in')) {
                    queue.textChannel.send({
                        embeds: [{
                            title: 'Wystąpił błąd!',
                            description: `Nie można zagrać piosenki:\n${songToDisplayString(song, true)}\nYoutube nie pozwala odtwarzać piosenek z ograniczeniami wiekowymi bez zalogowania się!\n\nPiosenka zostaje pominięta!`,
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
                            description: `Nie można dostać informacji o:\n${songToDisplayString(song, true)}\n\nPiosenka zostaje pominięta!`,
                            color: 0xff0000,
                        }],
                    }).catch(err => logger.error(err));
                }
                
                queue.skip(null, true);
                return;
            }
        }

        
        if (song instanceof YoutubeSong) {
            if (!seekTime) {
                try {
                    const segments = await sponsorBlock.getSegments(song.id, ['music_offtopic']);
                    seekTime = segments.find(s => s.startTime === 0).endTime ?? 0;
                } catch (err) {}
            }
            
            this.seekOffest = seekTime ?? 0;
            stream(song.url, { seek: this.seekOffest, quality: 2 })
                .then(ytStream => {
                    const resource = createAudioResource(ytStream.stream, { inputType: ytStream.type });
                    this.currentResource = resource;
            
                    this.player.play(resource);
            
                    connection.subscribe(this.player);
                })
                .catch(err => logger.error(err));
        } else {
            try {
                const transcoder = new FFmpeg({
                    args: [
                        '-analyzeduration', '0',
                        '-loglevel', '0',
                        '-ar', '48000',
                        '-ac', '2',
                        '-f', 's16le',
                        '-ss', this.seekOffest.toString(),
                    ],
                });

                const { data: stream } = await axios({
                    method: 'GET',
                    url: song.url,
                    responseType: 'stream',
                });

                const resource = createAudioResource(pipeline(stream, transcoder, () => void 0), { inputType: StreamType.Raw, });
                this.currentResource = resource;

                this.player.play(resource);

                connection.subscribe(this.player);
            } catch (err) {
                queue.textChannel.send({
                    embeds: [{
                        title: 'Wystąpił błąd!',
                        description: `Nie udało się zagrać:\n${songToDisplayString(song, true)}\n\nPiosenka zostaje pominięta!`,
                        color: 0xff0000,
                    }],
                }).catch(err => logger.error(err));

                queue.skip(null, true);
                return;
            }
        }
    }
}