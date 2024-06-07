import { SlashCommand } from '../../structures/SlashCommand';

export default new SlashCommand({
    data: {
        name: 'shuffle',
        description: 'Przetasowuje piosenki na kolejce',
        dmPermission: false,
    },
    vcOnly: true,
    queueRequired: true,
    global: true,
    run: async ({ interaction, logger, queue }) => {
        queue.shuffle();
        interaction.reply({ content: '🔀 Przetasowano piosenki!', }).catch(err => logger.error(err));
    },
});