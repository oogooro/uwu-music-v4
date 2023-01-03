import { ApplicationCommandOptionType } from 'discord.js';
import { SlashCommand } from '../../structures/SlashCommand';
import config from '../../config';
import { songToDisplayString } from '../../utils';

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
                type: ApplicationCommandOptionType.Integer,
                name: 'piosenka',
                description: 'Numer piosenki do przemieszczenia',
                required: true,
                minValue: 1,
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
    run: async ({ interaction, logger, queue }) => {
        const songIndex = interaction.options.getInteger('piosenka');
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
});