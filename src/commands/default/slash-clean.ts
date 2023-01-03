import { ApplicationCommandOptionType } from 'discord.js';
import { SlashCommand } from '../../structures/SlashCommand';

export default new SlashCommand({
    data: {
        name: 'clean',
        description: 'Zatrzymuje i czyści kolejkę',
        options: [
            {
                type: ApplicationCommandOptionType.Boolean,
                name: 'zostaw-grającą',
                description: 'Czy zostawić piosenkę, która aktualnie gra',
            }
        ],
        dmPermission: false,
    },
    vcOnly: true,
    queueRequired: true,
    run: async ({ interaction, logger, queue }) => {
        const keepPlaying = interaction.options.getBoolean('zostaw-grającą');

        if (!keepPlaying) queue.clean();
        else {
            const [playing] = queue.songs;
            queue.songs = [playing];
        }

        queue.recalculateDuration();

        interaction.reply({ content: 'Wyczyszczono kolejkę!' }).catch(err => logger.error(err));
    },
});
