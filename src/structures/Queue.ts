import { entersState, getVoiceConnection, joinVoiceChannel, VoiceConnectionStatus } from '@discordjs/voice';
import { Guild, TextBasedChannel, VoiceBasedChannel } from 'discord.js';
import { shuffle } from 'lodash';
import { logger, queues } from '..';
import { RepeatMode } from '../typings/repeatMode';
import { AudioPlayerManager } from './AudioPlayerManager';
import { Song } from './Song';

export class Queue {
    public audioPlayer: AudioPlayerManager
    public guild: Guild;
    public connected = false;
    public duration: number = 0;
    public songs: Song[] = [];
    public repeatMode: RepeatMode = RepeatMode.Disabled;
    public previousSongs: Song[] = [];
    public paused = false;
    public playing = false;
    public textChannel: TextBasedChannel;

    constructor(guild: Guild, channel: TextBasedChannel) {
        this.audioPlayer = new AudioPlayerManager(guild.id);
        this.guild = guild;
        this.textChannel = channel;

        logger.debug(`[QUEUE] Created new queue for ${guild.id}`);

        queues.set(guild.id, this);
    }

    public recalculateDuration(): void {
        let duration = 0;
        this.songs.forEach(song => duration += song.duration);
        this.duration = duration;
    }

    public connect(channel: VoiceBasedChannel): Promise<void> {
        return new Promise(async (resolve, reject) => {
            let connection = getVoiceConnection(this.guild.id);
            if (!connection || connection.state.status === VoiceConnectionStatus.Destroyed) {
                connection = joinVoiceChannel({
                    channelId: channel.id,
                    guildId: channel.guild.id,
                    adapterCreator: channel.guild.voiceAdapterCreator,
                });

                try {
                    await entersState(connection, VoiceConnectionStatus.Ready, 10_000);
                    logger.debug(`[CONNECTION] Successfully connected to ${channel.guildId}`);
                    this.connected = true;
                    resolve();
                } catch (err) {
                    logger.debug(`[CONNECTION] Failed to connect to ${channel.guildId}`);
                    reject(err);
                }
            }

            connection.on('stateChange', (oldState, newState) => {
                logger.debug(`[CONNECTION] ${this.guild.id} ${oldState.status} => ${newState.status}`);
            });

            connection.on(VoiceConnectionStatus.Destroyed, () => {
                logger.debug(`[CONNECTION] Connection destroyed for ${this.guild.id}`);
                queues.delete(this.guild.id);
            });

            connection.on(VoiceConnectionStatus.Disconnected, async () => {
                try {
                    await Promise.race([
                        entersState(connection, VoiceConnectionStatus.Signalling, 2_500),
                        entersState(connection, VoiceConnectionStatus.Connecting, 2_500),
                    ]);
                } catch (error) {
                    logger.debug(`[CONNECTION] Lost connection for ${this.guild.id}`);
                    if (connection.state.status !== VoiceConnectionStatus.Destroyed) connection.destroy();
                    queues.delete(this.guild.id);
                }
            });
        });
    }

    public addSong(song: Song, position?: number, shuffle?: boolean, skip?: boolean): void {
        let wasEmpty = false;
        if (!this.songs.length) wasEmpty = true;

        this.duration += song.duration;
        if (!position) this.songs.push(song);
        else this.songs.splice(position, 0, song);

        if (skip && !wasEmpty) this.skip();
        if (shuffle && !wasEmpty) this.shuffle(wasEmpty);

        if (wasEmpty) this.audioPlayer.play();
    }

    public addList(songs: Song[], position?: number, shuffle?: boolean, skip?: boolean): void {
        let wasEmpty = false;
        if (!this.songs.length) wasEmpty = true;

        songs.forEach(song => this.duration += song.duration);
        if (!position) this.songs.push(...songs);
        else this.songs.splice(position, 0, ...songs);
        
        if (skip && !wasEmpty) this.skip();
        if (shuffle) this.shuffle(wasEmpty);

        if (wasEmpty) this.audioPlayer.play();
    }

    public setRepeatMode(mode: RepeatMode) {
        this.repeatMode = mode;
    }

    public seek(seekTime: number): void {
        this.paused = false;
        this.audioPlayer.play(seekTime);
    }

    public skip(to?: number, force: boolean = false): Song {
        let skipped: Song = null;

        if (!this.songs.length) return void logger.error(new Error('Queue is empty'));

        if (!to) {
            skipped = this.songs.shift();
            if (!force && (this.repeatMode === RepeatMode.Queue)) this.songs.push(skipped);
        } else {
            const skippedSongs = this.songs.splice(0, to);
            if (!force && (this.repeatMode === RepeatMode.Queue)) this.songs.push(...skippedSongs);
            [skipped] = this.songs;
        }

        this.recalculateDuration();
        
        if (this.songs[0]) this.audioPlayer.play();
        else this.stop();

        this.paused = false;

        this.previousSongs.push(skipped);
        
        return skipped;
    }

    public shuffle(includeFirst?: boolean): void {
        if (includeFirst) this.songs = shuffle(this.songs);
        else {
            const [firstSong] = this.songs;
            this.songs = shuffle(this.songs.slice(1));
            this.songs.unshift(firstSong);
        }
    }

    public pause(): void {
        this.paused = true;
        this.audioPlayer.player.pause();
    }

    public resume(): void {
        this.paused = false;
        this.audioPlayer.player.unpause();
    }

    public clean(): void {
        this.songs = [];
        this.stop();
    }

    public stop(): void {
        this.audioPlayer.player.stop();
        this.playing = false;
        this.paused = false;
    }

    public byebye(): void {
        const connection = getVoiceConnection(this.guild.id);

        connection?.destroy();
        this.audioPlayer.player.removeAllListeners();
        queues.delete(this.guild.id);
        logger.debug(`[QUEUE] Said byebye to ${this.guild.id}`);
    }

    public get voiceChannel(): VoiceBasedChannel {
        return this.guild.members.me.voice.channel;
    }
}