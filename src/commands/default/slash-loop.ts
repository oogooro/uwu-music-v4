import { ApplicationCommandOptionType } from 'discord.js';
import { SlashCommand } from '../../structures/SlashCommand';

export default new SlashCommand({
    data: {
        name: 'loop',
        description: 'Zapętla piosenkę lub kolejkę',
        options: [
            {
                type: ApplicationCommandOptionType.String,
                name: 'sposób',
                description: 'Sposób zapętlania',
                choices: [
                    { name: '🔂 Piosenka', value: '1', },
                    { name: '🔁 Kolejka', value: '2', },
                    { name: '🚫 Wyłączone', value: '0', },
                ],
                required: true,
            },
        ],
        dmPermission: false,
    },
    vcOnly: true,
    queueRequired: true,
    run: async ({ interaction, logger, queue, }) => {
        const mode = interaction.options.getString('sposób');

        queue.setRepeatMode(parseInt(mode));

        const strings = [
            '🚫 Wyłączono zapętlanie!',
            '🔂 Włączono zapętlanie piosenki!',
            '🔁 Włączono zapętlanie kolejki',
        ]

        interaction.reply({ content: strings[mode], })
            .catch(err => logger.error(err));
    },
});
