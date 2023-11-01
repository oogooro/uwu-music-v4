import { ApplicationCommandOptionType } from 'discord.js';
import { SlashCommand } from '../../structures/SlashCommand';
import { queues } from '../..';
import config from '../../config';
import { songToDisplayString, trimString } from '../../utils';

function arrayMove(arr: any[], fromIndex: number, toIndex: number): void {  // thanks https://stackoverflow.com/a/6470794
    const element = arr[fromIndex];
    arr.splice(fromIndex, 1);
    arr.splice(toIndex, 0, element);
}

export default new SlashCommand({
    data: {
        name: 'move',
        description: 'Zmienia miejsce piosenki z kolejki',
        options: [
            {
                type: ApplicationCommandOptionType.String,
                name: 'piosenka',
                description: 'Piosenka do przemieszczenia',
                required: true,
                autocomplete: true,
            },
            {
                type: ApplicationCommandOptionType.Integer,
                name: 'miejsce',
                description: 'Numer miejsca docelowego',
                required: true,
                minValue: 1,
            },
        ],
        dmPermission: false,
    },
    vcOnly: true,
    queueRequired: true,
    global: true,
    run: async ({ interaction, logger, queue }) => {
        const songIndex = queue.songs.findIndex(s => s.title === interaction.options.getString('piosenka'));

        if (songIndex === 0) return interaction.reply({ content: 'Nie można przestawić piosenkę, która aktualnie gra!', ephemeral: true, }).catch(err => logger.error(err));
        if (songIndex === -1) return interaction.reply({ content: 'Nie udało się znaleźć piosenki!', ephemeral: true, }).catch(err => logger.error(err));

        let placeIndex = interaction.options.getInteger('miejsce');

        if (songIndex > queue.songs.length) return interaction.reply({ content: 'Piosenka o podanym numerze nie istnieje', ephemeral: true, }).catch(err => logger.error(err));
        if (placeIndex > queue.songs.length) placeIndex = queue.songs.length - 1;

        const song = queue.songs[songIndex];

        arrayMove(queue.songs, songIndex, placeIndex);

        interaction.reply({
            embeds: [{
                title: 'Przesunięto piosenkę',
                description: `Przesunięto piosenkę ${songToDisplayString(song, true)} na pozycję nr **${placeIndex}**!${songIndex === placeIndex ? ' (nawet jeśli nie ma to sensu)' : ''}`,
                color: config.embedColor,
            }],
        })
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