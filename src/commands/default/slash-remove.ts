import { ApplicationCommandOptionType } from 'discord.js';
import { SlashCommand } from '../../structures/SlashCommand';
import { createSongEmbed, trimString } from '../../utils';
import { YoutubeSong } from '../../structures/YoutubeSong';
import { queues } from '../..';
import { SoundcloudSong } from '../../structures/SoundcoludSong';

export default new SlashCommand({
    data: {
        name: 'remove',
        description: 'Usuwa piosenkę z kolejki',
        options: [
            {
                type: ApplicationCommandOptionType.String,
                name: 'piosenka',
                description: 'Piosenka na kolejce',
                required: true,
                autocomplete: true,
            },
        ],
        dmPermission: false,
    },
    vcOnly: true,
    queueRequired: true,
    run: async ({ interaction, logger, queue }) => {
        const num = queue.songs.findIndex(s => s.title === interaction.options.getString('piosenka'));

        if (num === 0) return interaction.reply({ content: 'Nie można usunąć grającej piosenki!', ephemeral: true, }).catch(err => logger.error(err));
        if (num === -1) return interaction.reply({ content: 'Nie udało się znaleźć piosenki!', ephemeral: true, }).catch(err => logger.error(err));

        const [song] = queue.songs.splice(num, 1);

        queue.recalculateDuration();

        if (song instanceof YoutubeSong && song.partial) await song.patch().catch(err => logger.error(err));
        else if (song instanceof SoundcloudSong && song.partial) await song.patch().catch(err => logger.error(err));

        const interactionResponse = await interaction.deferReply().catch(err => { logger.error(err) });
        if (!interactionResponse) return;

        interaction.editReply({
            embeds: createSongEmbed('Usunięto', song),
        }).catch(err => logger.error(err));
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
