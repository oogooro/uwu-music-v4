import { entersState, joinVoiceChannel, VoiceConnectionStatus } from '@discordjs/voice';
import { ApplicationCommandOptionType, ChannelType, GuildMember, VoiceChannel } from 'discord.js';
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

        const connection = joinVoiceChannel({
            channelId: channel.id,
            guildId: channel.guild.id,
            adapterCreator: channel.guild.voiceAdapterCreator,
        });

        entersState(connection, VoiceConnectionStatus.Ready, 10_000)
            .then(() => interaction.editReply({ content: 'Połączono z chatem głosowym' }).catch(err => logger.error(err)))
            .catch(() => interaction.editReply({ content: 'Nie udało się połączyć z chatem głosowym' }).catch(err => logger.error(err)))
    },
});