import { SlashCommand } from '../../structures/SlashCommand';

export default new SlashCommand({
    data: {
        name: 'leave',
        description: 'Wychodzi z kanału głosowego i niszczy kolejkę',
        dmPermission: false,
    },
    vcOnly: true,
    queueRequired: true,
    run: async ({ interaction, logger, queue }) => {
        queue.byebye();
        interaction.reply({ content: 'Odłączono!', }).catch(err => logger.error(err));
    },
});