import { ApplicationCommandOptionType, ButtonInteraction, ButtonStyle, ComponentType, escapeMarkdown, GuildMember, hyperlink, InteractionEditReplyOptions } from 'discord.js';
import { SlashCommand } from '../../structures/SlashCommand';
import { betaServers, queues } from '../..';
import { Queue } from '../../structures/Queue';
import config from '../../config';
import { formatedTimeToSeconds, songToDisplayString, trimString } from '../../utils';
import { YoutubeSong } from '../../structures/YoutubeSong';
import ytdl from 'ytdl-core';
import ytpl from 'ytpl';
import { video_basic_info } from 'play-dl';
import ytsr, { Result, Video } from 'ytsr';
import axios from 'axios';
import { parseStream } from 'music-metadata';
import { Song } from '../../structures/Song';

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
                embeds: [{
                    title: 'Dodano',
                    thumbnail: {
                        url: song.thumbnail,
                    },
                    description: songToDisplayString(song) + (additionalInfo.length ? '\n\n' + additionalInfo.join('\n') : ''),
                    color: config.embedColor,
                }],
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
        } else if (query.startsWith('https://') || query.startsWith('http://')) {
            if (!betaServers.has(interaction.guildId)) return interaction.editReply({ content: 'Granie z zewnętrznych liknów jeszcze nie okodowane!' }).catch(err => logger.error(err));
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
            const SEARCH_EMBED_ENTRIES_LENGTH = 10;

            let searchVideoResults: Result;

            try {
                const filters = await ytsr.getFilters(query);
                const filterVideos = filters.get('Type').get('Video');

                searchVideoResults = await ytsr(filterVideos.url, { limit: Math.floor(SEARCH_EMBED_ENTRIES_LENGTH * 1.5), });
            } catch (err) {
                logger.error(err);
                return interaction.editReply({ content: 'Coś poszło nie tak i nie udało się wyszukać piosenek!', })
                    .catch(err => logger.error(err));
            }

            if (!searchVideoResults.results)
                return interaction.editReply({ content: 'Nie znaleziono żadnych piosenek!', }).catch(err => logger.error(err));

            const videos = searchVideoResults.items.filter(i => i.type === 'video').splice(0, SEARCH_EMBED_ENTRIES_LENGTH) as Video[];

            let description = ``;
            videos.forEach((item: Video, index) => {
                description += `${index + 1} ${songToDisplayString(new YoutubeSong({ duration: parseInt(item.duration), title: item.title, url: item.url }, interaction.user), true)} - \`${item.isUpcoming ? 'UPCOMING' : (item.duration ? item.duration : 'LIVE')}\`\n- ${escapeMarkdown(item.author.name)}\n\n`
                // description += `${index + 1} ${hyperlink(escapeMarkdown(trimString(item.title, 55)), item.url, item.title.length >= 55 ? escapeMarkdown(item.title) : null)} - \`${item.isLive ? 'LIVE' : item.isUpcoming ? 'UPCOMING' : item.duration}\`\n- ${escapeMarkdown(item.author.name)}\n\n`;
            });

            const replyContent: InteractionEditReplyOptions = {
                embeds: [{
                    title: `Wyniki wyszukiwania dla: ${searchVideoResults.correctedQuery}`,
                    description,
                    color: config.embedColor,
                }],
                components: [
                    {
                        type: ComponentType.ActionRow,
                        components: [
                            {
                                type: ComponentType.Button,
                                label: '1',
                                customId: '0',
                                style: ButtonStyle.Secondary
                            },
                            {
                                type: ComponentType.Button,
                                label: '2',
                                customId: '1',
                                style: ButtonStyle.Secondary
                            },
                            {
                                type: ComponentType.Button,
                                label: '3',
                                customId: '2',
                                style: ButtonStyle.Secondary
                            },
                            {
                                type: ComponentType.Button,
                                label: '4',
                                customId: '3',
                                style: ButtonStyle.Secondary
                            },
                            {
                                type: ComponentType.Button,
                                label: '5',
                                customId: '4',
                                style: ButtonStyle.Secondary
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
                                style: ButtonStyle.Secondary
                            },
                            {
                                type: ComponentType.Button,
                                label: '7',
                                customId: '6',
                                style: ButtonStyle.Secondary
                            },
                            {
                                type: ComponentType.Button,
                                label: '8',
                                customId: '7',
                                style: ButtonStyle.Secondary
                            },
                            {
                                type: ComponentType.Button,
                                label: '9',
                                customId: '8',
                                style: ButtonStyle.Secondary
                            },
                            {
                                type: ComponentType.Button,
                                label: '10',
                                customId: '9',
                                style: ButtonStyle.Secondary
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
                            }
                        ],
                    },
                ],
            }

            interaction.editReply(replyContent).catch(err => logger.error(err));

            const awaitFilter = (i: ButtonInteraction): boolean => {
                if (i.user.id === interaction.user.id) return true;
                else {
                    i.reply({ content: 'Nie możesz użyć tego przycisku!', ephemeral: true });
                    return false;
                }
            }

            interactionResponse.awaitMessageComponent({ componentType: ComponentType.Button, filter: awaitFilter, time: 180000 /* 3min */ })
                .then(async btnInteraction => {
                    if (btnInteraction.customId === 'CANCEL')
                        return interaction.deleteReply().catch(err => logger.error(err));

                    const selectedSong = videos[parseInt(btnInteraction.customId)];
                    await btnInteraction.deferUpdate()
                        .catch(err => logger.error(err));

                    if (selectedSong.isUpcoming)
                        return interaction.editReply({ content: 'Nie można dodać nadchodzących piosenek!', embeds: [], components: [], }).catch(err => logger.error(err));

                    const song = new YoutubeSong({ url: selectedSong.url, title: selectedSong.title, duration: formatedTimeToSeconds(selectedSong.duration) }, interaction.user);

                    await song.patch();

                    queue.addSong(song, next ? 1 : 0, shuffle, skip);

                    const replyContent: InteractionEditReplyOptions = {
                        embeds: [{
                            title: 'Dodano',
                            description: songToDisplayString(song) + (additionalInfo.length ? '\n\n' + additionalInfo.join('\n') : ''),
                            color: config.embedColor,
                            thumbnail: {
                                url: selectedSong.bestThumbnail.url,
                            },
                        }],
                        components: [],
                    }

                    interaction.editReply(replyContent).catch(err => logger.error(err));
                })
                .catch((reason) => {
                    if (reason === 'idle')
                        return interaction.editReply({ content: 'Piosenka nie została wybrana na czas!', embeds: [], components: [], }).catch(err => logger.error(err));
                    else if (reason instanceof Error) {
                        if (reason.message.includes('Sign in')) return interaction.editReply({ content: 'Nie można dodać piosenki z ograniczeniami wiekowymi!', embeds: [], components: [], }).catch(err => logger.error(err));
                        else {
                            logger.error(reason);
                            return interaction.editReply({ content: 'Nie udało się dodać piosenki', embeds: [], components: [], }).catch(err => logger.error(err));
                        }
                    }
                });
            return;

        }
    },
});