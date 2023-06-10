import { ApplicationCommandOptionType, ButtonInteraction, ButtonStyle, ComponentType, GuildMember, hyperlink, InteractionEditReplyOptions } from 'discord.js';
import { SlashCommand } from '../../structures/SlashCommand';
import { experimentalServers, queues, soundcloud } from '../..';
import { Queue } from '../../structures/Queue';
import config from '../../config';
import { createSongEmbed, searchSongs, songToDisplayString } from '../../utils';
import { YoutubeSong } from '../../structures/YoutubeSong';
import ytdl from 'ytdl-core';
import ytpl from 'ytpl';
import play, { SpotifyAlbum, SpotifyPlaylist, SpotifyTrack, video_basic_info } from 'play-dl';
import axios from 'axios';
import { parseStream } from 'music-metadata';
import { Song } from '../../structures/Song';
import { SoundcloudSong } from '../../structures/SoundcoludSong';
import youtubeSearch from "youtube-search";
import _ from 'lodash';
import { SpotifySong } from '../../structures/SpotifySong';

export default new SlashCommand({
    data: {
        name: 'play',
        description: 'Dodaje lub szuka piosenek do playlisty',
        dmPermission: false,
        options: [
            {
                type: ApplicationCommandOptionType.String,
                name: 'piosenka',
                description: 'Nazwa/link/playlista z youtube',
                required: true,
                autocomplete: true,
            },
            {
                type: ApplicationCommandOptionType.Boolean,
                name: 'następna',
                description: 'Czy dodać tę piosenkę jako następną w kolejce',
            },
            {
                type: ApplicationCommandOptionType.Boolean,
                name: 'pominąć',
                description: 'Czy pominąć aktualną piosenkę',
            },
            {
                type: ApplicationCommandOptionType.Boolean,
                name: 'przetasować',
                description: 'Czy przetasować piosenki po dodaniu',
            },
            {
                type: ApplicationCommandOptionType.String,
                name: 'zapętlanie',
                description: 'W jaki sposób zapętlać',
                choices: [
                    { name: '🔂 Piosenka', value: '1', },
                    { name: '🔁 Kolejka', value: '2', },
                    { name: '🚫 Wyłączone', value: '0', },
                ],
            },
        ],
    },
    vcOnly: true,
    run: async ({ interaction, logger }) => {
        const channel = (interaction.member as GuildMember).voice.channel;
        const query = interaction.options.getString('piosenka');
        const next = interaction.options.getBoolean('następna');
        const skip = interaction.options.getBoolean('pominąć');
        const shuffle = interaction.options.getBoolean('przetasować');
        const loopMode = interaction.options.getString('zapętlanie');

        const additionalInfo: string[] = [];

        if (next) additionalInfo.push('➡️ Dodano jako następna piosenka');
        if (skip) additionalInfo.push('⏭️ Pominięto piosenkę');
        if (shuffle) additionalInfo.push('🔀 Przetasowano kolejkę');
        if (loopMode) {
            switch(loopMode) {
                case '0': additionalInfo.push('🚫 Wyłączono zapętlanie'); break;
                case '1': additionalInfo.push('🔂 Włączono zapętlanie piosenki'); break;
                case '2': additionalInfo.push('🔁 Włączono zapętlanie kolejki'); break;
            }
        }
        
        const interactionResponse = await interaction.deferReply().catch(err => { logger.error(err) });
        if (!interactionResponse) return;
        
        const queue = queues.has(interaction.guildId) ? queues.get(interaction.guildId) : new Queue(interaction.guild, interaction.channel);

        if (loopMode) queue.setRepeatMode(parseInt(loopMode));

        if (!queue.connected) {
            try {
                await queue.connect(channel);
            } catch (err) {
                logger.error(err);
                return interaction.editReply({ content: 'Nie udało się połączyć z kanałem głosowym!' }).catch(err => logger.error(err));
            }
        }

        if (ytdl.validateURL(query)) {
            const videoInfo = await video_basic_info(query).catch(err => {
                if (err instanceof Error && err.message.includes('Sign in')) interaction.editReply({ content: 'Nie można dodać piosenki z ograniczeniami wiekowymi!' }).catch(err => logger.error(err));
                else {
                    logger.error(err);
                    interaction.editReply({ content: 'Nie udało się dostać informacji o piosence!' }).catch(err => logger.error(err));
                }
            });
            if (!videoInfo) return;

            if (videoInfo.video_details.upcoming)
                return interaction.editReply({ content: 'Nie można dodać nadchodzących piosenek!', }).catch(err => logger.error(err));

            const song = new YoutubeSong(videoInfo.video_details, interaction.user);

            queue.addSong(song, next ? 1 : 0, shuffle, skip);

            const replyContent: InteractionEditReplyOptions = {
                embeds: createSongEmbed('Dodano', song, additionalInfo),
            }

            interaction.editReply(replyContent).catch(err => logger.error(err));
        } else if (ytpl.validateID(query)) {
            const playlistInfo = await ytpl(query, { limit: Infinity, }).catch(err => { logger.error(err) });
            if (!playlistInfo) return interaction.editReply({ content: 'Nie udało się znaleźć playlisty!' }).catch(err => logger.error(err));
            if (!playlistInfo.items.length) return interaction.editReply({ content: 'Ta playlista jest pusta!' }).catch(err => logger.error(err));

            const songs: YoutubeSong[] = playlistInfo.items.map(item => new YoutubeSong({ title: item.title, duration: item.durationSec, url: item.url, }, interaction.user));

            queue.addList(songs, next ? 1 : 0, shuffle, skip);

            const replyContent: InteractionEditReplyOptions = {
                embeds: [{
                    title: 'Dodano',
                    color: config.embedColor,
                    description: `${playlistInfo.items.length} piosenek z ${hyperlink(playlistInfo.title, playlistInfo.url)}\n(dodane przez ${interaction.user.toString()})` + (additionalInfo.length ? '\n\n' + additionalInfo.join('\n') : ''),
                    thumbnail: {
                        url: playlistInfo.bestThumbnail.url,
                    },
                }],
            }

            interaction.editReply(replyContent).catch(err => logger.error(err));
        } else if (query.startsWith('https://soundcloud.com/')) {
            if (query.startsWith('https://soundcloud.com/playlist') || query.match(/https:\/\/soundcloud\.com\/\S*sets\/\S*/g)) { // dalej kurwa nienawidzę regexów
                const playlistInfo = await soundcloud.playlists.getV2(query).catch(err => { logger.error(err) });
                if (!playlistInfo) return interaction.editReply({ content: 'Nie udało się znaleźć playlisty!' }).catch(err => logger.error(err));

                if (!playlistInfo.tracks.length) return interaction.editReply({ content: 'Ta playlista jest pusta!' }).catch(err => logger.error(err));

                const songs: SoundcloudSong[] = playlistInfo.tracks.map(track => new SoundcloudSong(track, interaction.user));

                queue.addList(songs, next ? 1 : 0, shuffle, skip);

                const replyContent: InteractionEditReplyOptions = {
                    embeds: [{
                        title: 'Dodano',
                        color: config.embedColor,
                        description: `${playlistInfo.tracks.length} piosenek z ${hyperlink(playlistInfo.title, playlistInfo.permalink_url)}\n(dodane przez ${interaction.user.toString()})` + (additionalInfo.length ? '\n\n' + additionalInfo.join('\n') : ''),
                        thumbnail: {
                            url: playlistInfo.artwork_url ?? playlistInfo.tracks.find(track => track.artwork_url).artwork_url,
                        },
                    }],
                }

                interaction.editReply(replyContent).catch(err => logger.error(err));
            } else {
                const songInfo = await soundcloud.tracks.getV2(query).catch(err => { logger.error(err) });
                if (!songInfo) return interaction.editReply({ content: 'Nie udało się znaleźć piosenki!' }).catch(err => logger.error(err));
                const song = new SoundcloudSong(songInfo, interaction.user);
    
                queue.addSong(song, next ? 1 : 0, shuffle, skip);
    
                const replyContent: InteractionEditReplyOptions = {
                    embeds: createSongEmbed('Dodano', song, additionalInfo),
                }
    
                interaction.editReply(replyContent).catch(err => logger.error(err));
            }
        } else if (query.startsWith('https://open.spotify.com/')) {
            if (!experimentalServers.has(interaction.guildId)) return interaction.editReply({ content: 'Piosenki ze Spotify jeszcze nie są dostępne!' }).catch(err => logger.error(err));
            if (play.is_expired()) await play.refreshToken();

            const spotData = await play.spotify(query).catch(err => { logger.error(err) });
            if (!spotData) return interaction.editReply({ content: 'Nie można znaleźć piosenki!', }).catch(err => logger.error(err));

            if (spotData.type === 'track') {
                const song = new SpotifySong(spotData as SpotifyTrack, interaction.user)

                queue.addSong(song, next ? 1 : 0, shuffle, skip);

                const replyContent: InteractionEditReplyOptions = {
                    embeds: createSongEmbed('Dodano', song, additionalInfo),
                }

                interaction.editReply(replyContent).catch(err => logger.error(err));
            } else {
                const spotAlbumOrPlaylist = (spotData as SpotifyAlbum | SpotifyPlaylist);
                const tracks = await spotAlbumOrPlaylist.all_tracks();

                const songs = tracks.map(track => new SpotifySong(track, interaction.user));

                queue.addList(songs, next ? 1 : 0, shuffle, skip);

                const replyContent: InteractionEditReplyOptions = {
                    embeds: [{
                        title: 'Dodano',
                        color: config.embedColor,
                        description: `${tracks.length} piosenek z ${hyperlink(spotAlbumOrPlaylist.name, spotAlbumOrPlaylist.url)}\n(dodane przez ${interaction.user.toString()})` + (additionalInfo.length ? '\n\n' + additionalInfo.join('\n') : ''),
                        thumbnail: {
                            url: spotAlbumOrPlaylist.thumbnail.url,
                        },
                    }],
                }

                interaction.editReply(replyContent).catch(err => logger.error(err));
            }
        } else if (query.startsWith('https://') || query.startsWith('http://')) {
            if (!experimentalServers.has(interaction.guildId)) return interaction.editReply({ content: 'Można grać tylko z youtube lub spotify' }).catch(err => logger.error(err));
            if (!query.endsWith('.mp3')) return interaction.editReply({ content: 'Można dodwawać tylko pliki .mp3!' }).catch(err => logger.error(err));

            try {
                const readStream = await axios({
                    method: 'GET',
                    url: query,
                    responseType: 'stream',
                });

                const { format: data } = await parseStream(readStream.data);

                if (!data.duration) return interaction.editReply({ content: 'Nie można zagrać tej piosenki!' }).catch(err => logger.error(err));

                const title = query.split('/').at(-1);

                const song = new Song({
                    duration: Math.floor(data.duration),
                    url: query,
                    title,
                }, interaction.user);

                queue.addSong(song, next ? 1 : 0, shuffle, skip);

                const replyContent: InteractionEditReplyOptions = {
                    embeds: [{
                        title: 'Dodano',
                        description: songToDisplayString(song) + (additionalInfo.length ? '\n\n' + additionalInfo.join('\n') : ''),
                        color: config.embedColor,
                    }],
                }

                interaction.editReply(replyContent).catch(err => logger.error(err));
            } catch (err) {
                interaction.editReply({ content: 'Nie można zagrać tej piosenki!' }).catch(err => logger.error(err));
            }
        } else {
            let searchPlatform: 'yt' | 'sc' = 'yt';
            let songs: Song[] = [];

            const searchResults = await searchSongs(query, interaction.user).catch(err => { logger.error(err) });
            if (!searchResults)
                return interaction.editReply({ content: 'Nie udało się znaleźć piosenek!' }).catch(err => logger.error(err));

            const update = (btnInteraction?: ButtonInteraction) => {
                const int = btnInteraction || interaction;
                let description: string;

                if (searchPlatform === 'yt') {
                    songs = searchResults.songsYT;
                    description = searchResults.embedYT;
                } else {
                    songs = searchResults.songsSC;
                    description = searchResults.embedSC; 
                }

                const replyContent: InteractionEditReplyOptions = {
                    embeds: [{
                        title: `Wyniki wyszukiwania dla: ${query} z ${searchPlatform === 'yt' ? 'YouTube' : 'SoundCloud'}`,
                        color: config.embedColor,
                        description,
                    }],
                    components: [
                        {
                            type: ComponentType.ActionRow,
                            components: [
                                {
                                    type: ComponentType.Button,
                                    label: '1',
                                    customId: '0',
                                    style: ButtonStyle.Secondary,
                                    disabled: 1 > songs.length,
                                },
                                {
                                    type: ComponentType.Button,
                                    label: '2',
                                    customId: '1',
                                    style: ButtonStyle.Secondary,
                                    disabled: 2 > songs.length,
                                },
                                {
                                    type: ComponentType.Button,
                                    label: '3',
                                    customId: '2',
                                    style: ButtonStyle.Secondary,
                                    disabled: 3 > songs.length,
                                },
                                {
                                    type: ComponentType.Button,
                                    label: '4',
                                    customId: '3',
                                    style: ButtonStyle.Secondary,
                                    disabled: 4 > songs.length,
                                },
                                {
                                    type: ComponentType.Button,
                                    label: '5',
                                    customId: '4',
                                    style: ButtonStyle.Secondary,
                                    disabled: 5 > songs.length,
                                },
                            ],
                        },
                        {
                            type: ComponentType.ActionRow,
                            components: [
                                {
                                    type: ComponentType.Button,
                                    label: '6',
                                    customId: '5',
                                    style: ButtonStyle.Secondary,
                                    disabled: 6 > songs.length,
                                },
                                {
                                    type: ComponentType.Button,
                                    label: '7',
                                    customId: '6',
                                    style: ButtonStyle.Secondary,
                                    disabled: 7 > songs.length,
                                },
                                {
                                    type: ComponentType.Button,
                                    label: '8',
                                    customId: '7',
                                    style: ButtonStyle.Secondary,
                                    disabled: 8 > songs.length,
                                },
                                {
                                    type: ComponentType.Button,
                                    label: '9',
                                    customId: '8',
                                    style: ButtonStyle.Secondary,
                                    disabled: 9 > songs.length,
                                },
                                {
                                    type: ComponentType.Button,
                                    label: '10',
                                    customId: '9',
                                    style: ButtonStyle.Secondary,
                                    disabled: 10 > songs.length,
                                },
                            ],
                        },
                        {
                            type: ComponentType.ActionRow,
                            components: [
                                {
                                    type: ComponentType.Button,
                                    label: 'Anuluj',
                                    customId: 'CANCEL',
                                    style: ButtonStyle.Danger,
                                },
                                {
                                    type: ComponentType.Button,
                                    label: searchPlatform === 'yt' ? 'SoundCloud' : 'YouTube',
                                    customId: 'PLATFORM',
                                    style: ButtonStyle.Secondary,
                                },
                            ],
                        },
                    ],
                }

                int.editReply(replyContent).catch(err => logger.error(err));
            }

            const filter = (i: ButtonInteraction): boolean => {
                if (i.user.id === interaction.user.id) return true;
                else {
                    i.reply({ content: 'Ten przycisk nie jest dla Ciebie!', ephemeral: true });
                    return false;
                }
            }

            const collector = interactionResponse.createMessageComponentCollector({ componentType: ComponentType.Button, filter, idle: 180000 /* 3min */ });

            collector.on('collect', async btnInteraction => {
                if (btnInteraction.customId === 'CANCEL')
                    interaction.deleteReply().catch(err => logger.error(err));
                else {
                    await btnInteraction.deferUpdate()
                        .catch(err => logger.error(err));

                    if (btnInteraction.customId === 'PLATFORM') {
                        if (searchPlatform === 'yt') searchPlatform = 'sc';
                        else searchPlatform = 'yt';
                        update(btnInteraction);
                    } else {
                        collector.stop();

                        const selectedSong = songs[parseInt(btnInteraction.customId)];

                        if ((selectedSong instanceof YoutubeSong || selectedSong instanceof SoundcloudSong) && selectedSong.partial) {
                            await selectedSong.patch().catch(err => logger.error(err));
                        }

                        if ((selectedSong instanceof YoutubeSong || selectedSong instanceof SoundcloudSong) && selectedSong.partial)
                            btnInteraction.editReply({ content: 'Nie udało się dostać informacji o piosence!' }).catch(err => logger.error(err));
                        else {
                            queue.addSong(selectedSong, next ? 1 : 0, shuffle, skip);

                            const replyContent: InteractionEditReplyOptions = {
                                embeds: createSongEmbed('Dodano', selectedSong, additionalInfo),
                                components: [],
                            }

                            interaction.editReply(replyContent).catch(err => logger.error(err));
                        }
                    }
                }
            });

            collector.on('end', (_collected, reason) => {
                if (reason === 'idle') interaction.editReply({ content: 'Piosenka nie została wybrana na czas!', embeds: [], components: [], }).catch(err => logger.error(err));
                else if (reason !== 'user' && reason !== 'messageDelete') {
                    logger.error(new Error(reason));
                    interaction.editReply({ content: 'Nie udało się dodać piosenki', embeds: [], components: [], }).catch(err => logger.error(err));
                }
            });

            update();
            return;
        }
    },
    getAutocompletes: async ({ interaction, logger }) => {
        if (process.env.ENV === 'dev') return interaction.respond([]).catch(err => logger.error(err));

        const query = interaction.options.getFocused();
        if (!query) return interaction.respond([]).catch(err => logger.error(err));

        if (ytdl.validateURL(query)) {
            const info: ytdl.videoInfo | void = await ytdl.getBasicInfo(query).catch(err => { logger.error(err) });
            if (!info) return interaction.respond([]).catch(err => logger.error(err));

            return interaction.respond([{ name: info.videoDetails.title.slice(0, 100), value: info.videoDetails.video_url, }]).catch(err => { logger.error(err) });
        } else if (ytpl.validateID(query)) {
            const info: ytpl.Result | void = await ytpl(query).catch(err => { logger.error(err) });
            if (!info) return interaction.respond([]).catch(err => logger.error(err));

            return interaction.respond([{ name: info.title.slice(0, 100), value: info.url, }]).catch(err => { logger.error(err) });
        } else if (query.startsWith('https://open.spotify.com/')) {
            if (!experimentalServers.has(interaction.guildId)) return interaction.respond([]);
            if (play.is_expired()) await play.refreshToken();

            const spotData = await play.spotify(query).catch(err => { logger.error(err) });
            if (!spotData) return interaction.respond([]);

            return interaction.respond([{ name: spotData.name.slice(0, 100), value: spotData.url, }]).catch(err => { logger.error(err) });
        } else {
            const startTime = performance.now();
    
            const search = await youtubeSearch(query, { key: process.env.YOUTUBE_KEY, }).catch(err => { logger.error(err) });
            if (!search) return interaction.respond([]).catch(err => logger.error(err));
            
            search.results = search.results.filter(({ kind }) => kind === 'youtube#video' || kind === 'youtube#playlist').slice(0, 25);
            interaction.respond(search.results.map(result => { return { name: _.unescape(result.title.slice(0, 100)), value: result.link, }; } )).catch(err => logger.error(err));
            
            const endTime = performance.now();
            logger.debug(`Youtube search autocomplete took ${((endTime - startTime) / 1000).toFixed(2)}s; Found ${search.results.length} results`);
        }
    },
});