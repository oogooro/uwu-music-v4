import { ApplicationCommandOptionType } from 'discord.js';
import { queues } from '../..';
import { SlashCommand } from '../../structures/SlashCommand';
import { trimString } from '../../utils';

export default new SlashCommand({
    data: {
        name: 'skip',
        description: 'Pomija piosenki',
        options: [
            {
                type: ApplicationCommandOptionType.String,
                name: 'piosenka',
                description: 'Piosenka do jakiej pominąć',
                autocomplete: true,
            },
        ],
        dmPermission: false,
    },
    vcOnly: true,
    queueRequired: true,
    run: async ({ interaction, logger, queue, }) => {
        const num = interaction.options.getString('piosenka') ? queue.songs.findIndex(s => s.title === interaction.options.getString('piosenka')) : 1;

        if (num === 0) return interaction.reply({ content: 'Nie można pominąć do piosenki, która aktualnie gra!', ephemeral: true, }).catch(err => logger.error(err));
        if (num === -1) return interaction.reply({ content: 'Nie udało się znaleźć piosenki!', ephemeral: true, }).catch(err => logger.error(err));

        queue.skip(num);

        let piosenek: string;
        if (num === 1) piosenek = 'piosenkę';
        else if (1 < num && num < 5) piosenek = 'piosenki';
        else piosenek = 'piosenek';

        let content = num ? `Pominięto **${num}** ${piosenek}!` : 'Pominięto piosenkę!';

        if (!queue.songs.length) content += '\n\nTo była już ostania piosenka\nKolejka jest teraz pusta!';

        interaction.reply({ content, }).catch(err => logger.error(err));
    },
    getAutocompletes: async ({ interaction, logger }) => {
        const queue = queues.get(interaction.guildId);
        if (!queue || !queue.songs[0]) return interaction.respond([]);

        const focused = interaction.options.getFocused().trim();

        if (!focused) return interaction.respond(queue.songs.slice(1).slice(0, 25).map(song => { return { name: `${trimString(song.title, 80)}`, value: song.title } }));

        const filtered = queue.songs.slice(1).filter(song => song.title.toLowerCase().includes(focused.toLocaleLowerCase()));
        interaction.respond(filtered.slice(0, 25).map(song => { return { name: `${trimString(song.title, 80)}`, value: song.title } }));
    },
});