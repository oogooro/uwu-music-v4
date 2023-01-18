import { ApplicationCommandOptionType, ChannelType, GuildMember, VoiceChannel } from 'discord.js';
import { queues } from '../..';
import { Queue } from '../../structures/Queue';
import { SlashCommand } from '../../structures/SlashCommand';

export default new SlashCommand({
    data: {
        name: 'join',
        description: 'Dołącza na kanał głosowy',
        dmPermission: false,
        options: [
            {
                type: ApplicationCommandOptionType.Channel,
                name: 'kanał',
                description: 'Kanał głosowy na jaki dołączyć',
                channelTypes: [ ChannelType.GuildVoice ],
            }
        ],
    },
    run: async ({ interaction, logger }) => {
        const channel = interaction.options.getChannel('kanał') as VoiceChannel ?? (interaction.member as GuildMember).voice.channel;

        if (!channel)
            return interaction.reply({ content: 'Nie jesteś na kanale głosowym, ani żaden kanał nie został podany!', ephemeral: true }).catch(err => logger.error(err));

        if (!channel.joinable || !channel.viewable)
            return interaction.reply({ content: 'Nie mogę dołączyć na podany kanał głosowy!', ephemeral: true }).catch(err => logger.error(err));

        await interaction.deferReply({ ephemeral: true }).catch(err => logger.error(err));

        const queue = queues.has(interaction.guildId) ? queues.get(interaction.guildId) : new Queue(interaction.guild, interaction.channel);

        if (!queue.connected) {
            try {
                await queue.connect(channel);
            } catch (err) {
                logger.error(err);
                return interaction.editReply({ content: 'Nie udało się połączyć z kanałem głosowym!' }).catch(err => logger.error(err));
            }
        }
        
        interaction.editReply({ content: `Połączono z ${channel}`, }).catch(err => logger.error(err));
    },
});