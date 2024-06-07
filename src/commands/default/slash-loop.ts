import { ApplicationCommandOptionType } from 'discord.js';
import { SlashCommand } from '../../structures/SlashCommand';
import { RepeatMode } from '../../structures/Queue';

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
                    { name: '🔂 Piosenka', value: 'song', },
                    { name: '🔁 Kolejka', value: 'queue', },
                    { name: '🚫 Wyłączone', value: 'disabled', },
                ],
                required: true,
            },
        ],
        dmPermission: false,
    },
    vcOnly: true,
    queueRequired: true,
    global: true,
    run: async ({ interaction, logger, queue, }) => {
        const mode = interaction.options.getString('sposób') as RepeatMode;

        queue.setRepeatMode(mode);

        const strings = {
            'disabled': '🚫 Wyłączono zapętlanie!',
            'song': '🔂 Włączono zapętlanie piosenki!',
            'queue': '🔁 Włączono zapętlanie kolejki',
        }

        interaction.reply({ content: strings[mode], })
            .catch(err => logger.error(err));
    },
});
