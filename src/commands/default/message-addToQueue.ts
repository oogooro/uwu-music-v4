import { ApplicationCommandType, GuildMember, hyperlink, InteractionEditReplyOptions } from 'discord.js';
import config from '../../config';
import { video_basic_info } from 'play-dl';
import { queues, soundcloud } from '../..';
import { MessageCommand } from '../../structures/MessageCommand';
import { Queue } from '../../structures/Queue';
import { YoutubeSong } from '../../structures/YoutubeSong';
import { createSongEmbed } from '../../utils';
import { validateURL } from 'ytdl-core';
import ytpl, { validateID } from 'ytpl';
import { SoundcloudSong } from '../../structures/SoundcoludSong';

const linkRe = /(?:https?:\/\/)?(?:www\.)?youtu\.?be(?:\.com)?\/[^)\s]+|https:\/\/soundcloud\.com\/\S*[^)\s]/g;

export default new MessageCommand({
    data: {
        type: ApplicationCommandType.Message,
        name: 'Dodaj do kolejki',
        dmPermission: false,
    },
    vcOnly: true,
    global: true,
    run: async ({ interaction, logger }) => {
        const channel = (interaction.member as GuildMember).voice.channel;
        
        const queue = queues.has(interaction.guildId) ? queues.get(interaction.guildId) : new Queue(interaction.guild, interaction.channel);
        
        let matched = interaction.targetMessage.content.match(linkRe);
        if (!matched) matched = interaction.targetMessage.embeds[0]?.url?.match(linkRe);
        if (!matched) matched = interaction.targetMessage.embeds[0]?.description?.match(linkRe);
        
        if (!matched) return interaction.reply({ content: 'W tej wiadomości nie ma linku do piosenki!', ephemeral: true, })
            .catch(err => logger.error(err));
        
        const interactionResponse = await interaction.deferReply().catch(err => { logger.error(err) });
        if (!interactionResponse) return;

        const [songUrl] = matched;

        if (!queue.connected) {
            try {
                await queue.connect(channel);
            } catch (err) {
                logger.error(err);
                return interaction.editReply({ content: 'Nie udało się połączyć z kanałem głosowym!', }).catch(err => logger.error(err));
            }
        }
        
        if (validateURL(songUrl)) {
            const videoInfo = await video_basic_info(songUrl).catch(err => {
                if (err instanceof Error && err.message.includes('Sign in')) interaction.editReply({ content: 'Nie można dodać piosenki z ograniczeniami wiekowymi!' }).catch(err => logger.error(err));
                else {
                    logger.error(err);
                    interaction.editReply({ content: 'Nie udało się dostać informacji o piosence!', }).catch(err => logger.error(err));
                }
            });
            if (!videoInfo) return;
            
            if (videoInfo.video_details.upcoming)
                return interaction.editReply({ content: 'Nie można dodać nadchodzących piosenek!', }).catch(err => logger.error(err));
            
            const song = new YoutubeSong(videoInfo.video_details, interaction.user);
            queue.add([song], { title: song.title, url: song.url, });

            const replyContent: InteractionEditReplyOptions = {
                embeds: createSongEmbed('Dodano', song),
            }
    
            interaction.editReply(replyContent).catch(err => logger.error(err));
        }
        else if (validateID(songUrl)) {
            const playlistInfo = await ytpl(songUrl, { limit: Infinity, }).catch(err => { logger.error(err) });
            if (!playlistInfo) return interaction.editReply({ content: 'Nie udało się znaleźć playlisty!', }).catch(err => logger.error(err));
            if (!playlistInfo.items.length) return interaction.editReply({ content: 'Ta playlista jest pusta!', }).catch(err => logger.error(err));

            const songs: YoutubeSong[] = playlistInfo.items.map(item => new YoutubeSong({ title: item.title, duration: item.durationSec, url: item.url, }, interaction.user));

            queue.add(songs, { title: playlistInfo.title, url: playlistInfo.url, });

            const replyContent: InteractionEditReplyOptions = {
                embeds: [{
                    title: 'Dodano',
                    color: config.embedColor,
                    description: `${playlistInfo.items.length} piosenek z ${hyperlink(playlistInfo.title, playlistInfo.url)}\n(dodane przez ${interaction.user.toString()})`,
                    thumbnail: {
                        url: playlistInfo.bestThumbnail.url,
                    },
                }],
            }

            interaction.editReply(replyContent).catch(err => logger.error(err));
        } else if (songUrl.startsWith('https://soundcloud.com/')) {
            if (songUrl.startsWith('https://soundcloud.com/playlist') || songUrl.match(/https:\/\/soundcloud\.com\/\S*sets\/\S*/g)) { // dalej kurwa nienawidzę regexów
                const playlistInfo = await soundcloud.playlists.getV2(songUrl).catch(err => { logger.error(err) });
                if (!playlistInfo) return interaction.editReply({ content: 'Nie udało się znaleźć playlisty!' }).catch(err => logger.error(err));

                if (!playlistInfo.tracks.length) return interaction.editReply({ content: 'Ta playlista jest pusta!' }).catch(err => logger.error(err));

                const songs: SoundcloudSong[] = playlistInfo.tracks.map(track => new SoundcloudSong(track, interaction.user));

                queue.add(songs, { title: playlistInfo.title, url: playlistInfo.permalink_url, });

                const replyContent: InteractionEditReplyOptions = {
                    embeds: [{
                        title: 'Dodano',
                        color: config.embedColor,
                        description: `${playlistInfo.tracks.length} piosenek z ${hyperlink(playlistInfo.title, playlistInfo.permalink_url)}\n(dodane przez ${interaction.user.toString()})`,
                        thumbnail: {
                            url: playlistInfo.artwork_url ?? playlistInfo.tracks.find(track => track.artwork_url).artwork_url,
                        },
                    }],
                }

                interaction.editReply(replyContent).catch(err => logger.error(err));
            } else {
                const songInfo = await soundcloud.tracks.getV2(songUrl).catch(err => { logger.error(err) });
                if (!songInfo) return interaction.editReply({ content: 'Nie udało się znaleźć piosenki!' }).catch(err => logger.error(err));
                const song = new SoundcloudSong(songInfo, interaction.user);

                queue.add([song], { title: song.title, url: song.url, });

                const replyContent: InteractionEditReplyOptions = {
                    embeds: createSongEmbed('Dodano', song),
                }

                interaction.editReply(replyContent).catch(err => logger.error(err));
            }
        }
    },
});