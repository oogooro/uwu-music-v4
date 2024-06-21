import { AudioPlayer, AudioPlayerStatus, AudioResource, createAudioPlayer, createAudioResource, entersState, getVoiceConnection, joinVoiceChannel, StreamType, VoiceConnectionStatus } from '@discordjs/voice';
import { APIEmbedThumbnail, Guild, TextBasedChannel, VoiceBasedChannel } from 'discord.js';
import { shuffle } from 'lodash';
import { logger, queues } from '..';
import { Song } from './Song';
import { getUserSettings, Item, userSettingsDB } from '../database/userSettings';
import { SponsorBlock } from 'sponsorblock-api';
import { YoutubeSong } from './YoutubeSong';
import { SpotifySong } from './SpotifySong';
import { songToDisplayString } from '../utils';
import { SoundcloudSong } from './SoundcoludSong';
import { FFmpeg } from 'prism-media';
import { pipeline, Readable } from 'node:stream';
import { stream } from 'play-dl';
import { soundcloud } from '..';

const sponsorBlock = new SponsorBlock(process.env.SPONSORBLOCK_USER_ID);

export type RepeatMode = 'disabled' | 'song' | 'queue';
export type AddOptions = {
    position?: number,
    skip?: boolean,
    shuffle?: boolean,
}

export class Queue {
    private seekOffset = 0;
    public player: AudioPlayer;
    public currentResource: AudioResource;
    public guild: Guild;
    public connected = false;
    public duration: number = 0;
    public songs: Song[] = [];
    public repeatMode: RepeatMode = 'disabled';
    public previousSongs: Song[] = [];
    public paused = false;
    public playing = false;
    public textChannel: TextBasedChannel;

    constructor(guild: Guild, channel: TextBasedChannel) {
        this.guild = guild;
        this.textChannel = channel;

        logger.debug(`[QUEUE] Created new queue for ${guild.id}`);

        queues.set(guild.id, this);

        const player = createAudioPlayer();
        this.player = player;

        player.on('stateChange', (oldState, newState) => {
            logger.debug(`[PLAYER] ${this.guild.id} ${oldState.status} => ${newState.status}`);

            if (oldState.status === AudioPlayerStatus.Playing && newState.status === AudioPlayerStatus.Idle) {
                if (this.songs.length) {
                    if (this.repeatMode === 'disabled') this.previousSongs.push(this.songs.shift());
                    else if (this.repeatMode === 'queue') this.songs.push(this.songs.shift());

                    if (this.songs.length) this.playAudioResource();
                } else this.playing = false;
            }
        });

        player.on('error', (err) => {
            logger.error(err);
            this.playing = false;
        });
    }

    private handlePlayAudioResourceFail(song: Song): void {
        let thumbnail: APIEmbedThumbnail;

        if (song instanceof YoutubeSong && !song.partial) thumbnail = { url: song.thumbnail, };
        else if (song instanceof SoundcloudSong || song instanceof SpotifySong) thumbnail = { url: song.thumbnail, };

        this.textChannel.send({
            embeds: [{
                title: 'Wystąpił błąd!',
                description: `Nie można zagrać piosenki:\n\n${songToDisplayString(song, true)}`,
                color: 0xff0000,
                thumbnail,
            }],
        }).catch(err => logger.error(err));
    }

    public async playAudioResource(seekTime: number = 0): Promise<any> {
        const connection = getVoiceConnection(this.guild.id);

        if (!connection) return logger.error(new Error('[QUEUE] Not connected'));
        if (!this.songs.length) return logger.error(new Error('[QUEUE] No songs to play'));

        const [song] = this.songs;
        let ytSong: YoutubeSong;

        if (song instanceof YoutubeSong) ytSong = song;
        else if (song instanceof SpotifySong) {
            const ytEquivelent = await song.getYoutubeEquivalent().catch(err => { logger.error(err); });
            if (!ytEquivelent) return this.handlePlayAudioResourceFail(song);

            ytSong = ytEquivelent;
        }

        seekTime = Math.floor(seekTime);
        this.seekOffset = seekTime;

        const transcoder = new FFmpeg({
            args: [
                '-analyzeduration', '0',
                '-loglevel', '0',
                '-f', 's16le',
                '-ar', '48000',
                '-ac', '2',
                '-ss', seekTime.toString(),
            ],
        });

        const songurl = ytSong?.url ?? song.url;

        try {
            if (ytSong) {
                const ytStream = await stream(songurl, { seek: seekTime, quality: 2 })
                const resource = createAudioResource(ytStream.stream, { inputType: ytStream.type, inlineVolume: true, });
                resource.volume.setVolume(ytSong.volume ?? 0.5);
                this.currentResource = resource;
                this.seekOffset = seekTime;

                this.player.play(resource);

                connection.subscribe(this.player);
            } else if (song instanceof SoundcloudSong) {
                seekTime = Math.floor(seekTime);

                const stream = await soundcloud.util.streamTrack(songurl);
                //@ts-ignore fuck you
                const resource = createAudioResource(pipeline(stream, transcoder, () => void 0), { inputType: StreamType.Raw, inlineVolume: true, });
                resource.volume.setVolume(song.volume);
                this.currentResource = resource;
                this.seekOffset = seekTime;

                this.player.play(resource);

                connection.subscribe(this.player);
            } else { // normal song
                this.handlePlayAudioResourceFail(song);
            }
        } catch (error) {
            logger.error(error);
            this.handlePlayAudioResourceFail(song);
        }
    }

   public getCurrentDuration(): number {
        if (this.player.state.status === AudioPlayerStatus.Idle) return -1;
        return (this.currentResource.playbackDuration / 1000) + this.seekOffset;
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

    public add(songs: Song[], origin: Item, options: AddOptions = {}) {
        const previouslyEmpty = !this.songs.length;

        const { position, shuffle, skip, } = options;

        songs.forEach(song => this.duration += song.duration);
        if (!position) this.songs.push(...songs);
        else this.songs.splice(position, 0, ...songs);

        if (skip && !previouslyEmpty) this.skip();
        if (shuffle) this.shuffle(previouslyEmpty);

        const userId = songs[0].addedBy.id;

        const userSettings = getUserSettings(userId);

        if (userSettings.keepHistory) {
            userSettings.lastAddedSongs.unshift({ title: origin.title, url: origin.url });

            if (userSettings.lastAddedSongs.length > 15) userSettings.lastAddedSongs.pop();

            userSettings.lastAddedSongs = userSettings.lastAddedSongs.filter((value, index, self) => // dedupe array thanks https://stackoverflow.com/a/36744732
                index === self.findIndex((t) => (
                    t.title === value.title && t.url === value.url
                ))
            );

            userSettingsDB.set(userId, userSettings);
        }

        if (previouslyEmpty) this.playAudioResource();
    }

    public setRepeatMode(mode: RepeatMode) {
        this.repeatMode = mode;
    }

    public seek(seekTime: number): void {
        this.paused = false;
        this.playAudioResource(seekTime);
    }

    public skip(to?: number, force: boolean = false): Song {
        let skipped: Song = null;

        if (!this.songs.length) return void logger.error(new Error('Queue is empty'));

        if (!to) {
            skipped = this.songs.shift();
            if (!force && (this.repeatMode === 'queue')) this.songs.push(skipped);
        } else {
            [skipped] = this.songs;
            const skippedSongs = this.songs.splice(0, to);
            if (!force && (this.repeatMode === 'queue')) this.songs.push(...skippedSongs);
        }

        this.recalculateDuration();
        
        if (this.songs[0]) this.playAudioResource();
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
        this.player.pause();
    }

    public resume(): void {
        this.paused = false;
        this.player.unpause();
    }

    public clean(): void {
        this.previousSongs.push(this.songs[0]);
        this.songs = [];
        this.stop();
    }

    public stop(): void {
        this.player.stop();
        this.playing = false;
        this.paused = false;
    }

    public byebye(): void {
        const connection = getVoiceConnection(this.guild.id);

        connection?.destroy();
        //@ts-ignore
        this.player.removeAllListeners();
        queues.delete(this.guild.id);
        logger.debug(`[QUEUE] Said byebye to ${this.guild.id}`);
    }

    public get voiceChannel(): VoiceBasedChannel {
        return this.guild.members.me.voice.channel;
    }
}