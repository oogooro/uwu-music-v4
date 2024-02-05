import { ApplicationCommandOptionChoiceData, ApplicationCommandOptionType, ButtonInteraction, ButtonStyle, ComponentType, GuildMember, hyperlink, InteractionEditReplyOptions } from 'discord.js';
import { SlashCommand } from '../../structures/SlashCommand';
import { experimentalServers, queues } from '../..';
import { Queue, RepeatMode } from '../../structures/Queue';
import config from '../../config';
import { createSongEmbed, resolveSong, searchSongs } from '../../utils';
import { YoutubeSong } from '../../structures/YoutubeSong';
import ytdl from 'ytdl-core';
import ytpl from 'ytpl';
import play from 'play-dl';
import { Song } from '../../structures/Song';
import { SoundcloudSong } from '../../structures/SoundcoludSong';
import _ from 'lodash';
import { SpotifySong } from '../../structures/SpotifySong';
import { getUserSettings } from '../../database/userSettings';
import searchYoutube, { parseSearch } from '@oogooro/search-yt';

export default new SlashCommand({
    data: {
        name: 'play',
        description: 'Dodaje lub szuka piosenek do kolejki',
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
                    { name: '🔂 Piosenka', value: 'song', },
                    { name: '🔁 Kolejka', value: 'queue', },
                    { name: '🚫 Wyłączone', value: 'disabled', },
                ],
            },
        ],
    },
    vcOnly: true,
    global: true,
    run: async ({ interaction, logger }) => {
        const channel = (interaction.member as GuildMember).voice.channel;
        const query = interaction.options.getString('piosenka');
        const next = interaction.options.getBoolean('następna');
        const skip = interaction.options.getBoolean('pominąć');
        const shuffle = interaction.options.getBoolean('przetasować');
        const loopMode = interaction.options.getString('zapętlanie') as RepeatMode;

        const additionalInfo: string[] = [];

        if (next) additionalInfo.push('➡️ Dodano jako następna piosenka');
        if (skip) additionalInfo.push('⏭️ Pominięto piosenkę');
        if (shuffle) additionalInfo.push('🔀 Przetasowano kolejkę');
        if (loopMode) {
            switch(loopMode) {
                case 'disabled': additionalInfo.push('🚫 Wyłączono zapętlanie'); break;
                case 'song': additionalInfo.push('🔂 Włączono zapętlanie piosenki'); break;
                case 'queue': additionalInfo.push('🔁 Włączono zapętlanie kolejki'); break;
            }
        }
        
        const interactionResponse = await interaction.deferReply().catch(err => { logger.error(err) });
        if (!interactionResponse) return;
        
        const queue = queues.has(interaction.guildId) ? queues.get(interaction.guildId) : new Queue(interaction.guild, interaction.channel);

        if (loopMode) queue.setRepeatMode(loopMode);

        if (!queue.connected) {
            try {
                await queue.connect(channel);
            } catch (err) {
                logger.error(err);
                return interaction.editReply({ content: 'Nie udało się połączyć z kanałem głosowym!' }).catch(err => logger.error(err));
            }
        }

        const resolved = await resolveSong(query);
        if (!resolved) {
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
                            queue.add(
                                [selectedSong],
                                {
                                    title: selectedSong.title,
                                    url: selectedSong.url,
                                },
                                {
                                    position: next ? 1 : 0,
                                    shuffle,
                                    skip,
                                },
                            );

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
        } else if (resolved.type === 'youtubeSong') {
            if (resolved.data.upcoming)
                return interaction.editReply({ content: 'Nie można dodać nadchodzących piosenek!', }).catch(err => logger.error(err));

            const song = new YoutubeSong(resolved.data, interaction.user);
            queue.add([song], resolved, {
                position: next ? 1 : 0,
                shuffle,
                skip,
            },);

            interaction.editReply({ embeds: createSongEmbed('Dodano', song, additionalInfo), }).catch(err => logger.error(err));
        } else if (resolved.type === 'youtubePlaylist') {
            const songs = resolved.data.map(song => new YoutubeSong(song, interaction.user));
            queue.add(songs, resolved, {
                position: next ? 1 : 0,
                shuffle,
                skip,
            },);

            interaction.editReply({
                embeds: [{
                    title: 'Dodano',
                    color: config.embedColor,
                    description: `${songs.length} piosenek z ${hyperlink(resolved.title, resolved.url)}\n(dodane przez ${interaction.user.toString()})` + (additionalInfo.length ? '\n\n' + additionalInfo.join('\n') : ''),
                    thumbnail: {
                        url: resolved.thumbnailUrl,
                    },
                }],
            }).catch(err => logger.error(err));
        } else if (resolved.type === 'soundcloudTrack') {
            const song = new SoundcloudSong(resolved.data, interaction.user);
            queue.add([song], resolved, {
                position: next ? 1 : 0,
                shuffle,
                skip,
            },);

            interaction.editReply({ embeds: createSongEmbed('Dodano', song, additionalInfo), }).catch(err => logger.error(err));
        } else if (resolved.type === 'soundcloudPlaylist') {
            const songs = resolved.data.map(song => new SoundcloudSong(song, interaction.user));
            queue.add(songs, resolved, {
                position: next ? 1 : 0,
                shuffle,
                skip,
            },);

            interaction.editReply({
                embeds: [{
                    title: 'Dodano',
                    color: config.embedColor,
                    description: `${songs.length} piosenek z ${hyperlink(resolved.title, resolved.url)}\n(dodane przez ${interaction.user.toString()})` + (additionalInfo.length ? '\n\n' + additionalInfo.join('\n') : ''),
                    thumbnail: {
                        url: resolved.thumbnailUrl,
                    },
                }],
            }).catch(err => logger.error(err));
        } else if (resolved.type === 'spotifySong') {
            const song = new SpotifySong(resolved.data, interaction.user);
            queue.add([song], resolved, {
                position: next ? 1 : 0,
                shuffle,
                skip,
            },);

            interaction.editReply({ embeds: createSongEmbed('Dodano', song, additionalInfo), }).catch(err => logger.error(err));
        } else if (resolved.type === 'spotifyPlaylist') {
            const songs = resolved.data.map(song => new SpotifySong(song, interaction.user));
            queue.add(songs, resolved);

            interaction.editReply({
                embeds: [{
                    title: 'Dodano',
                    color: config.embedColor,
                    description: `${songs.length} piosenek z ${hyperlink(resolved.title, resolved.url)}\n(dodane przez ${interaction.user.toString()})` + (additionalInfo.length ? '\n\n' + additionalInfo.join('\n') : ''),
                    thumbnail: {
                        url: resolved.thumbnailUrl,
                    },
                }],
            }).catch(err => logger.error(err));
        } else {
            
        }
    },
    getAutocompletes: async ({ interaction, logger }) => {
        const query = interaction.options.getFocused();
        if (!query) {
            const userSettings = getUserSettings(interaction.user.id);

            if (!userSettings.keepHistory) return interaction.respond([]).catch(err => logger.error(err));
            const songs: ApplicationCommandOptionChoiceData<string>[] = [];
            userSettings.lastAddedSongs.forEach(item => {
                songs.push({
                    name: item.title,
                    value: item.url,
                });
            });
            return interaction.respond(songs);
        }

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
            if (process.env.ENV === 'dev' && !experimentalServers.has(interaction.guildId) || !process.env.YOUTUBE_KEY) return interaction.respond([]).catch(err => logger.error(err));
            const startTime = performance.now();

            const search = await searchYoutube({ query, key: process.env.YOUTUBE_KEY }).catch(err => { logger.error(err) });
            if (!search) return interaction.respond([]).catch(err => logger.error(err));
            
            search.items = search.items.filter(item => item.id.kind === 'youtube#video' || item.id.kind === 'youtube#playlist').slice(0, 25);

            const parsedSearch = parseSearch(search);

            interaction.respond(parsedSearch.map(result => {
                return {
                    name: _.unescape(result.snippet.title.slice(0, 100)),
                    value: result.url,
                }
            }));
                
            const endTime = performance.now();
            logger.debug(`Youtube search autocomplete took ${((endTime - startTime) / 1000).toFixed(2)}s; Found ${search.items.length} results`);
        }
    },
});