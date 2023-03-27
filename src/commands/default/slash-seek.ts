import { SlashCommand } from '../../structures/SlashCommand';
import { queues } from '../..';
import { ApplicationCommandOptionType } from 'discord.js';
import { formatTimeDisplay, trimString } from '../../utils';
import { YoutubeSong } from '../../structures/YoutubeSong';

export default new SlashCommand({
    data: {
        name: 'seek',
        description: 'Przewija do podanego miejsca w piosence',
        options: [
            {
                type: ApplicationCommandOptionType.Subcommand,
                name: 'time',
                description: 'Przewijaj do podanego czasu',
                options: [
                    {
                        type: ApplicationCommandOptionType.String,
                        name: 'timestamp',
                        nameLocalizations: {
                            pl: 'czas',
                        },
                        description: 'Czas do jakiego przewinąć (w formacie HH:MM:SS lub MM:SS lub SS)',
                        max_length: 8,
                        required: true,
                    },
                ],
            },
            {
                type: ApplicationCommandOptionType.Subcommand,
                name: 'chapter',
                description: 'Przewijaj do wybranego chapteru',
                options: [
                    {
                        type: ApplicationCommandOptionType.String,
                        name: 'chapter',
                        description: 'Chapter do jakiego przewinąć',
                        required: true,
                        autocomplete: true,
                    },
                ],
            },
        ],
        dmPermission: false,
    },
    vcOnly: true,
    queueRequired: true,
    run: async ({ interaction, logger, queue, }) => {
        if (!queue.songs.length)
            return interaction.reply({ content: 'Kolejka jest pusta!', ephemeral: true, }).catch(err => logger.error(err));

        if (queue.songs[0] instanceof YoutubeSong && queue.songs[0].live) return interaction.reply({ content: 'Nie można przewijać live!', ephemeral: true, }).catch(err => logger.error(err));

        let seekTime = -1;

        if (interaction.options.getSubcommand() === 'time') {
            const time = interaction.options.getString('timestamp');
    
            const [ sec, min, hour ] = time.split(':').reverse();
    
            const timeSecs = ( (parseInt(hour) * 3600) || 0 ) + ( (parseInt(min) * 60) || 0 ) + (parseInt(sec));
            if (isNaN(timeSecs) || timeSecs < 0)
                return interaction.reply({ content: 'Nie potrafię rozczytać podani mi czas! Użyj formatu HH:MM:SS czyli np jak chcesz przewinąć do 8 minuty i 20 sekundy piosenki wpisz 8:20', ephemeral: true, }).catch(err => logger.error(err));

            if (timeSecs > queue.songs[0].duration - 1)
                return interaction.reply({ content: `Nie można przewinąć tak daleko!`, ephemeral: true, }).catch(err => logger.error(err));
    
            seekTime = timeSecs;
        } else {
            const time = parseInt(interaction.options.getString('chapter'));

            if (isNaN(time) || time < 0) 
                return interaction.reply({ content: 'Nie można przewinąć do podanego chapteru', ephemeral: true, }).catch(err => logger.error(err));
            seekTime = time;
        }

        queue.seek(seekTime);

        interaction.reply({ content: `Przewinięto do \`${formatTimeDisplay(seekTime)}\`!` })
            .catch(err => logger.error(err));
    },
    getAutocompletes: async ({ interaction, logger }) => {
        const queue = queues.get(interaction.guildId);
        if (!queue || !queue.songs[0]) return interaction.respond([]);

        const song = queue.songs[0];

        if (!(song instanceof YoutubeSong)) return interaction.respond([]);

        if (!song.chapters) return interaction.respond([]);
        const focused = interaction.options.getFocused().trim();

        if (!focused) return interaction.respond(song.chapters.slice(0, 25).map(ch => { return { name: `${trimString(ch.title, 80)} - ${formatTimeDisplay(ch.startTime)}`, value: ch.startTime.toString() } } ));

        const filtered = song.chapters.filter(ch => ch.title.toLowerCase().includes(focused.toLocaleLowerCase()) );
        interaction.respond(filtered.slice(0, 25).map(ch => { return { name: `${trimString(ch.title, 80)} - ${formatTimeDisplay(ch.startTime)}`, value: ch.startTime.toString() } }));
    },
}); 