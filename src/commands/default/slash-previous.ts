import { InteractionEditReplyOptions, InteractionReplyOptions } from 'discord.js';
import config from '../../config';
import { SlashCommand } from '../../structures/SlashCommand';
import { Song } from '../../structures/Song';
import { YoutubeSong } from '../../structures/YoutubeSong';
import { RepeatMode } from '../../typings/repeatMode';
import { songToDisplayString } from '../../utils';

export default new SlashCommand({
    data: {
        name: 'previous',
        description: 'Gra poprzednią piosenkę',
        dmPermission: false,
    },
    vcOnly: true,
    queueRequired: true,
    run: async ({ interaction, logger, queue }) => {
        const interactionResponse = await interaction.deferReply().catch(err => { logger.error(err) });
        if (!interactionResponse) return;

        let song: Song;

        if (queue.repeatMode !== RepeatMode.Queue) {
            song = queue.previousSongs.pop();
            
            if (!song) return interaction.reply({ content: 'Brak piosenki do zagrania!' }).catch(err => logger.error(err));
        } else {
            if (queue.songs.length < 1) return interaction.reply({ content: 'Brak piosenki do zagrania!' }).catch(err => logger.error(err));
            song = queue.songs.pop();
        }

        queue.songs.unshift(song);

        queue.audioPlayer.play();

        if (song instanceof YoutubeSong && song.partial) await song.patch().catch(err => logger.error(err));

        const replyContent: InteractionEditReplyOptions = {
            embeds: [{
                title: 'Powrócono do',
                thumbnail: {
                    url: song instanceof YoutubeSong ? song.thumbnail : null,
                },
                description: songToDisplayString(song),
                color: config.embedColor,
            }],
        }

        interaction.editReply(replyContent).catch(err => logger.error(err));
    },
});