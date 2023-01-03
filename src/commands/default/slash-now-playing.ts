import { SlashCommand } from '../../structures/SlashCommand';
import config from '../../config';
import { formatTimeDisplay, songToDisplayString } from '../../utils';
import { YoutubeSong } from '../../structures/YoutubeSong';

export default new SlashCommand({
    data: {
        name: 'now-playing',
        description: 'Pokazuje co aktualnie gra na serwerze',
        dmPermission: false,
    },
    queueRequired: true,
    run: async ({ interaction, logger, queue, }) => {
        const [song] = queue.songs;
        
        if (!song) return interaction.reply({ content: 'Aktualnie nic nie gra!' }).catch(err => logger.error(err));

        const PROGRESS_LENGHT: number = 40;
        const progress = Math.round(queue.audioPlayer.getCurrentDuration() / song.duration * PROGRESS_LENGHT);

        let progressString = '[';

        if (song instanceof YoutubeSong && song.live) {
            const text = 'LIVESTREAM';

            for (let i = 0; i <= (PROGRESS_LENGHT - text.length) / 2; i++) {
                progressString += ' ';
            }
            progressString += text;
            for (let i = 0; i <= (PROGRESS_LENGHT - text.length) / 2; i++) {
                progressString += ' ';
            }
        } else {
            for (let i = 0; i <= PROGRESS_LENGHT; i++ ) {
                if (i < progress) progressString += '―';
                else if (i === progress) progressString += '๏';
                else progressString += ' ';
            }
        }

        progressString += ']';

        const songsLeft = queue.songs.length - 1;

        let pozostalo: string, piosenek: string;
        if (songsLeft === 1) {
            pozostalo = 'Pozostała';
            piosenek = 'inna piosenka';
        }
        else if (1 < songsLeft && songsLeft < 5) {
            pozostalo = 'Pozostały'
            piosenek = 'piosenki';
        }
        else {
            pozostalo = 'Pozostało'
            piosenek = 'piosenek';
        }

        interaction.reply({
            embeds: [{
                title: 'Teraz gra',
                description: `${songToDisplayString(song)}\n\n\`${formatTimeDisplay(queue.audioPlayer.getCurrentDuration())} / ${formatTimeDisplay(song.duration)} ${progressString}\``,
                color: config.embedColor,
                footer: {
                    text: songsLeft === 0 ? `To jest ostatnia piosenka na kolejce` : `${pozostalo} jeszcze ${songsLeft} ${piosenek} na kolejce`,
                },
                thumbnail: {
                    url: (song instanceof YoutubeSong && !song.partial ? song.thumbnail : null),
                },
            }],
        }).catch(err => logger.error(err));
    },
});