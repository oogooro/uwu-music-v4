import { ApplicationCommandOptionType } from 'discord.js';
import { SlashCommand } from '../../structures/SlashCommand';

export default new SlashCommand({
    data: {
        name: 'volume',
        description: 'Zmienia głosność piosenki',
        options: [
            {
                type: ApplicationCommandOptionType.Integer,
                name: 'procent',
                description: 'Procent glosności [10-200] (domyślnie 50%)',
                required: true,
                minValue: 10,
                maxValue: 200,
            },
        ],
        dmPermission: false,
    },
    vcOnly: true,
    queueRequired: true,
    run: async ({ interaction, logger, queue }) => {
        const value = interaction.options.getInteger('procent');
        const [song] = queue.songs;
        const volume = value / 100
        song.volume = volume;
        queue.audioPlayer.currentResource.volume.setVolume(volume);
        interaction.reply({ content: `Ustawiono głosność piosenki na ${value}%`, }).catch(err => logger.error(err));
    },
});