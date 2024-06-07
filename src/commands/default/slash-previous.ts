import { SlashCommand } from '../../structures/SlashCommand';
import { SoundcloudSong } from '../../structures/SoundcoludSong';
import { YoutubeSong } from '../../structures/YoutubeSong';
import { createSongEmbed } from '../../utils';

export default new SlashCommand({
    data: {
        name: 'previous',
        description: 'Gra poprzednią piosenkę',
        dmPermission: false,
    },
    vcOnly: true,
    queueRequired: true,
    global: true,
    run: async ({ interaction, logger, queue }) => {
        let song = (queue.repeatMode !== 'queue' || !queue.songs.length) ? queue.previousSongs.pop() : queue.songs.pop();

        if (!song) return interaction.reply({ content: 'Nie można cofnąć!', ephemeral: true, }).catch(err => logger.error(err));

        queue.songs.unshift(song);

        queue.audioPlayer.play();

        const interactionResponse = await interaction.deferReply().catch(err => { logger.error(err) });
        if (!interactionResponse) return;

        if (song instanceof YoutubeSong && song.partial) await song.patch().catch(err => logger.error(err));
        else if (song instanceof SoundcloudSong && song.partial) await song.patch().catch(err => logger.error(err));

        interaction.editReply({ embeds: createSongEmbed('Cofnięto do', song), }).catch(err => logger.error(err));
    },
});