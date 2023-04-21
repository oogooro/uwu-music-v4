import { InteractionEditReplyOptions } from 'discord.js';
import { SlashCommand } from '../../structures/SlashCommand';
import { Song } from '../../structures/Song';
import { SoundcloudSong } from '../../structures/SoundcoludSong';
import { YoutubeSong } from '../../structures/YoutubeSong';
import { RepeatMode } from '../../typings/repeatMode';
import { createSongEmbed } from '../../utils';

export default new SlashCommand({ //! THIS COMMAND IS DISABLED
    data: {
        name: 'previous',
        description: 'Gra poprzednią piosenkę',
        dmPermission: false,
    },
    vcOnly: true,
    queueRequired: true,
    disabled: true, //! THIS COMMAND IS DISABLED
    run: async ({ interaction, logger, queue }) => {
        const interactionResponse = await interaction.deferReply().catch(err => { logger.error(err) });
        if (!interactionResponse) return;

        let song: Song;

        if (queue.repeatMode !== RepeatMode.Queue) {
            song = queue.previousSongs.pop();
            
            if (!song) return interaction.editReply({ content: 'Brak piosenki do zagrania!' }).catch(err => logger.error(err));
        } else {
            if (queue.songs.length < 1) return interaction.editReply({ content: 'Brak piosenki do zagrania!' }).catch(err => logger.error(err));
            song = queue.songs.pop();
        }

        queue.songs.unshift(song);

        queue.audioPlayer.play();

        if (song instanceof YoutubeSong && song.partial) await song.patch().catch(err => logger.error(err));
        else if (song instanceof SoundcloudSong && song.partial) await song.patch().catch(err => logger.error(err));

        const replyContent: InteractionEditReplyOptions = {
            embeds: createSongEmbed('Powrócono do', song),
        }

        interaction.editReply(replyContent).catch(err => logger.error(err));
    },
});