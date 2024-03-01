import { AudioPlayer, AudioPlayerStatus, AudioResource, createAudioPlayer, createAudioResource, getVoiceConnection, StreamType } from '@discordjs/voice';
import { stream } from 'play-dl';
import { experimentalServers, logger, queues, soundcloud } from '..';
import { songToDisplayString } from '../utils';
import { YoutubeSong } from './YoutubeSong';
import { FFmpeg } from 'prism-media'; 
import { pipeline } from 'node:stream';
import axios from 'axios';
import { SponsorBlock } from 'sponsorblock-api';
import { SoundcloudSong } from './SoundcoludSong';
import { PlayerEvent } from '../typings/playerEvents';
import { SpotifySong } from './SpotifySong';
import { getUserSettings } from '../database/userSettings';

const sponsorBlock = new SponsorBlock(process.env.SPONSORBLOCK_USER_ID);

export class AudioPlayerManager {
    private seekOffset = 0;
    private timestampPoolingInterval: NodeJS.Timeout;
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
                            if (event.skipTo !== -1 ) queue.seek(event.skipTo);
                            else queue.skip();
                        }
                    } else {
                        clearInterval(this.timestampPoolingInterval);
                        this.timestampPoolingInterval = null;
                    }
                }, 1000);
            }

            if (oldState.status === AudioPlayerStatus.Playing && newState.status === AudioPlayerStatus.Idle) {
                if (queue.songs.length) {
                    if (queue.repeatMode === 'disabled') queue.previousSongs.push(queue.songs.shift());
                    else if (queue.repeatMode === 'queue') queue.songs.push(queue.songs.shift());
    
                    if (queue.songs.length) this.play();
                } else queue.playing = false;
            }
        });

        player.on('error', (err) => {
            logger.error(err);
            queues.get(this.guildId).playing = false;
        });
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

        queue.playing = true;

        const [song, nextSong] = queue.songs;

        try {
            if (song instanceof YoutubeSong || song instanceof SpotifySong) {
                const ytSong = song instanceof YoutubeSong ? song : await song.getYoutubeEquivalent();
                if (ytSong.partial) await ytSong.patch();
                
                if (nextSong && (nextSong instanceof YoutubeSong) && nextSong.partial) nextSong.patch().catch(() => {/* it will throw the next time */});
            }
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

        if (song instanceof YoutubeSong || song instanceof SpotifySong) {
            const ytSong = song instanceof YoutubeSong ? song : await song.getYoutubeEquivalent();
            if (!seekTime && getUserSettings(song.addedBy.id).sponsorBlockEnabled) {
                this.playerEvents = [];
                try {
                    const segments = await sponsorBlock.getSegments(ytSong.id, ['music_offtopic', 'sponsor']);
                    segments.forEach(segment => {
                        if (segment.startTime === 0) seekTime = segment.endTime
                        else if (experimentalServers.has(queue.guild.id)) {
                            if (segment.endTime >= ytSong.duration) this.addEvent(segment.startTime, -1);
                            else this.addEvent(segment.startTime, segment.endTime);
                        }
                    });
                } catch (err) {}
            }
            
            seekTime = Math.floor(seekTime);
            stream(ytSong.url, { seek: seekTime, quality: 2 })
                .then(ytStream => {
                    const resource = createAudioResource(ytStream.stream, { inputType: ytStream.type, inlineVolume: true, });
                    resource.volume.setVolume(ytSong.volume ?? 0.5);
                    this.currentResource = resource;
                    this.seekOffset = seekTime;
            
                    this.player.play(resource);
            
                    connection.subscribe(this.player);
                })
                .catch(err => {
                    logger.error(err);
                    queue.textChannel.send({
                        embeds: [{
                            title: 'Wystąpił błąd!',
                            description: `Nie można zagrać piosenki:\n\n${songToDisplayString(ytSong, true)}\n\nPiosenka zostaje pominięta!`,
                            color: 0xff0000,
                            thumbnail: {
                                url: ytSong.thumbnail,
                            },
                        }],
                    }).catch(err => logger.error(err));
                    queue.skip(null, true);
                });
        } else if (song instanceof SoundcloudSong) {
            seekTime = Math.floor(seekTime);

            try {
                const transcoder = new FFmpeg({
                    args: [
                        '-analyzeduration', '0',
                        '-loglevel', '0',
                        '-ar', '48000',
                        '-ac', '2',
                        '-f', 's16le',
                        '-ss', seekTime.toString(),
                    ],
                });

                soundcloud.util.streamTrack(song.url).then(stream => {
                    const resource = createAudioResource(pipeline(stream, transcoder, () => void 0), { inputType: StreamType.Raw, inlineVolume: true, });
                    resource.volume.setVolume(song.volume);
                    this.currentResource = resource;
                    this.seekOffset = seekTime;

                    this.player.play(resource);

                    connection.subscribe(this.player);
                }).catch(err => {
                    logger.error(err);
                    queue.textChannel.send({
                        embeds: [{
                            title: 'Wystąpił błąd!',
                            description: `Nie można zagrać piosenki:\n\n${songToDisplayString(song, true)}\n\nPiosenka zostaje pominięta!`,
                            color: 0xff0000,
                            thumbnail: {
                                url: song.thumbnail,
                            },
                        }],
                    }).catch(err => logger.error(err));
                    queue.skip(null, true);
                });
            } catch (err) {
                queue.textChannel.send({
                    embeds: [{
                        title: 'Wystąpił błąd!',
                        description: `Nie udało się zagrać:\n\n${songToDisplayString(song, true)}\n\nPiosenka zostaje pominięta!`,
                        color: 0xff0000,
                    }],
                }).catch(err => logger.error(err));

                logger.error(err);

                queue.skip(null, true);
                return;
            }
        }
        else {
            try {
                seekTime = Math.floor(seekTime);
                const transcoder = new FFmpeg({
                    args: [
                        '-analyzeduration', '0',
                        '-loglevel', '0',
                        '-ar', '48000',
                        '-ac', '2',
                        '-f', 's16le',
                        '-ss', seekTime.toString(),
                    ],
                });

                const { data: stream } = await axios({
                    method: 'GET',
                    url: song.url,
                    responseType: 'stream',
                });

                const resource = createAudioResource(pipeline(stream, transcoder, () => void 0), { inputType: StreamType.Raw, inlineVolume: true, });
                resource.volume.setVolume(song.volume);
                this.currentResource = resource;
                this.seekOffset = seekTime;

                this.player.play(resource);

                connection.subscribe(this.player);
            } catch (err) {
                queue.textChannel.send({
                    embeds: [{
                        title: 'Wystąpił błąd!',
                        description: `Nie udało się zagrać:\n\n${songToDisplayString(song, true)}\n\nPiosenka zostaje pominięta!`,
                        color: 0xff0000,
                    }],
                }).catch(err => logger.error(err));

                logger.error(err);

                queue.skip(null, true);
                return;
            }
        }
    }
}