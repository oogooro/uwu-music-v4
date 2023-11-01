import { TextBasedChannel } from 'discord.js';
import { client } from '../..';
import { SlashCommand } from '../../structures/SlashCommand';

export default new SlashCommand({
    data: {
        name: 'ping',
        description: 'Pokazuje ping bota',
    },
    global: true,
    run: async ({ interaction, logger }) => {
        interaction.reply({ content: `:ping_pong: **Ping!**\nWebsocket: ${client.ws.ping}ms\nInterakcje: ...`, fetchReply: true, }).then(async msg => {
            const channel = await client.channels.fetch(interaction.channelId) as TextBasedChannel;

            const time = (await channel.messages.fetch(msg.id)).createdTimestamp - interaction.createdTimestamp;

            interaction.editReply({ content: `:ping_pong: **Ping!**\nWebsocket: ${client.ws.ping}ms\nInterakcje: ${time}ms`, })
                .catch(err => logger.error(err));
        }).catch(err => logger.error(err));
    },
});