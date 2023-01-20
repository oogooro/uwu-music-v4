import { ApplicationCommandOptionType } from 'discord.js';
import { SlashCommand } from '../../structures/SlashCommand';
import config from '../../config';
import { songToDisplayString } from '../../utils';
import { YoutubeSong } from '../../structures/YoutubeSong';

export default new SlashCommand({
    data: {
        name: 'remove',
        description: 'Usuwa piosenkę z kolejki',
        options: [
            {
                type: ApplicationCommandOptionType.Integer,
                name: 'numer',
                description: 'Numer piosenki z kolejki',
                required: true,
            },
        ],
        dmPermission: false,
    },
    vcOnly: true,
    queueRequired: true,
    run: async ({ interaction, logger, queue }) => {
        const num = interaction.options.getInteger('numer');

        if (num < 1) return interaction.reply({ content: 'Piosenka z takim numerem nie może istnieć', ephemeral: true, }).catch(err => logger.error(err));
        if (num > queue.songs.length) return interaction.reply({ content: 'Nie ma piosenki z takim numerem na kolejce', ephemeral: true, }).catch(err => logger.error(err));

        const [song] = queue.songs.splice(num, 1);

        if (!song) return interaction.reply({ content: 'Nie udało się znaleźć piosenki z takim numerem', ephemeral: true, }).catch(err => logger.error(err));

        queue.recalculateDuration();

        if (song instanceof YoutubeSong && song.partial) await song.patch().catch(err => logger.error(err));

        const interactionResponse = await interaction.deferReply().catch(err => { logger.error(err) });
        if (!interactionResponse) return;

        interaction.editReply({
            embeds: [{
                title: 'Usunięto',
                thumbnail: {
                    url: song instanceof YoutubeSong ? song.thumbnail : null,
                },
                description: songToDisplayString(song),
                color: config.embedColor,
            }]
        }).catch(err => logger.error(err));
    },
});
