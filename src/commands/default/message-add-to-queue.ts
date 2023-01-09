import { ApplicationCommandType, GuildMember, InteractionEditReplyOptions } from 'discord.js';
import config from '../../config';
import { video_basic_info } from 'play-dl';
import { queues } from '../..';
import { MessageCommand } from '../../structures/MessageCommand';
import { Queue } from '../../structures/Queue';
import { YoutubeSong } from '../../structures/YoutubeSong';
import { songToDisplayString } from '../../utils';

const ytLinkRe = /(?:https?:\/\/)?(?:www\.)?youtu\.?be(?:\.com)?\/[^)\s]+/g;

export default new MessageCommand({
    data: {
        type: ApplicationCommandType.Message,
        name: 'Dodaj do kolejki',
        dmPermission: false,
    },
    vcOnly: true,
    run: async ({ interaction, logger }) => {
        const channel = (interaction.member as GuildMember).voice.channel;
        const interactionResponse = await interaction.deferReply().catch(err => { logger.error(err) });
        if (!interactionResponse) return;

        const queue = queues.has(interaction.guildId) ? queues.get(interaction.guildId) : new Queue(interaction.guild, interaction.channel);

        let matched = interaction.targetMessage.content.match(ytLinkRe);
        if (!matched) matched = interaction.targetMessage.embeds[0]?.url?.match(ytLinkRe);
        if (!matched) matched = interaction.targetMessage.embeds[0]?.description?.match(ytLinkRe);

        if (!matched) return interaction.reply({ content: 'W tej wiadomości nie ma linków do YouTube', ephemeral: true, })
            .catch(err => logger.error(err));

        const [songUrl] = matched;

        if (!queue.connected) {
            try {
                await queue.connect(channel);
            } catch (err) {
                logger.error(err);
                return interaction.editReply({ content: 'Nie udało się połączyć z kanałem głosowym!' }).catch(err => logger.error(err));
            }
        }

        const videoInfo = await video_basic_info(songUrl).catch(err => {
            if (err.includes('Sign in to confirm your age')) interaction.editReply({ content: 'Nie można dodać piosenki z ograniczeniami wiekowymi!' }).catch(err => logger.error(err));
            else {
                logger.error(err);
                interaction.editReply({ content: 'Nie udało się dostać informacji o piosence!' }).catch(err => logger.error(err));
            }
        });
        if (!videoInfo) return;

        if (videoInfo.video_details.upcoming)
            return interaction.editReply({ content: 'Nie można dodać nadchodzących piosenek!', }).catch(err => logger.error(err));

        const song = new YoutubeSong(videoInfo.video_details, interaction.user);

        queue.addSong(song);

        const replyContent: InteractionEditReplyOptions = {
            embeds: [{
                title: 'Dodano',
                thumbnail: {
                    url: song.thumbnail,
                },
                description: songToDisplayString(song),
                color: config.embedColor,
            }],
        }

        interaction.editReply(replyContent).catch(err => logger.error(err));
    },
});