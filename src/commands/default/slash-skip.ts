import { ApplicationCommandOptionType } from 'discord.js';
import { SlashCommand } from '../../structures/SlashCommand';

export default new SlashCommand({
    data: {
        name: 'skip',
        description: 'Pomija piosenki',
        options: [
            {
                type: ApplicationCommandOptionType.Integer,
                name: 'do',
                description: 'Numer do jakiej piosenki pominąć',
                minValue: 1,
            },
        ],
        dmPermission: false,
    },
    vcOnly: true,
    queueRequired: true,
    run: async ({ interaction, logger, queue, }) => {
        const num = interaction.options.getInteger('do');

        if (!queue.songs.length) 
            return interaction.reply({ content: 'Na kolejce nie ma piosenek!', ephemeral: true, }).catch(err => logger.error(err));

        if (num && !queue.songs[num])
            return interaction.reply({ content: 'Nie udało się pominąć, bo podany numer piosenki nie istnieje', ephemeral: true, }).catch(err => logger.error(err));

        queue.skip(num);

        let content = num ? 'Pominięto piosenki!' : 'Pominięto piosenkę!';

        if (!queue.songs.length) content += '\n\nTo była już ostania piosenka\nKolejka jest teraz pusta!';

        interaction.reply({ content, }).catch(err => logger.error(err));
    },
});