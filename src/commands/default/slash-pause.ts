import { SlashCommand } from '../../structures/SlashCommand';

export default new SlashCommand({
    data: {
        name: 'pause',
        description: 'Pauzuje i odpauzowuje odtwarzanie',
        dmPermission: false,
    },
    vcOnly: true,
    queueRequired: true,
    global: true,
    run: async ({ interaction, logger, queue }) => {
        if (queue.paused) {
            queue.resume();

            interaction.reply('▶️ Wznowiono odtwarzanie').catch(err => logger.error(err));
        }
        else {
            queue.pause();

            interaction.reply('⏸️ Zapauzowano odtwarzanie').catch(err => logger.error(err));
        }
    },
});