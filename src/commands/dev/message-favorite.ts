import { ApplicationCommandType } from 'discord.js';
import { MessageCommand } from '../../structures/MessageCommand';
import { createPlaylistEmbed, createSongEmbed, getUrlsFromMessage, resolveSong } from '../../utils';
import { getUserSettings, userSettingsDB } from '../../database/userSettings';
import { YoutubeSong } from '../../structures/YoutubeSong';
import { SoundcloudSong } from '../../structures/SoundcoludSong';
import { SpotifySong } from '../../structures/SpotifySong';

export default new MessageCommand({
    data: {
        type: ApplicationCommandType.Message,
        name: '⭐ Dodaj do ulubionych',
        dmPermission: false,
    },
    dev: true,
    run: async ({ interaction, logger }) => {
        const matched = getUrlsFromMessage(interaction.targetMessage);

        if (!matched.length) return interaction.reply({ content: 'W tej wiadomości nie ma linku do piosenki!', ephemeral: true, })
            .catch(err => logger.error(err));

        const interactionResponse = await interaction.deferReply({ ephemeral: true, }).catch(err => { logger.error(err); });
        if (!interactionResponse) return;

        const [songUrl] = matched;
        const settings = getUserSettings(interaction.user.id);

        if (settings.favorites.find(favSong => favSong.url === songUrl)) {
            return interaction.editReply({ content: 'Ta piosenka już jest w ulubionych!', }).catch(err => logger.error(err));
        }

        const resolved = await resolveSong(songUrl).catch(err => { logger.error(err); });
        if (!resolved) return interaction.editReply({ content: 'Nie można dodać tej piosenki!', }).catch(err => logger.error(err));

        settings.favorites.push({ title: resolved.title, url: resolved.url, });
        userSettingsDB.set(interaction.user.id, settings);

        if (resolved.type === 'youtubeSong') {
            const song = new YoutubeSong(resolved.data, interaction.user);
            interaction.editReply({ embeds: createSongEmbed('Dodano do ulubionych', song, null, true) }).catch(err => logger.error(err));
        } else if (resolved.type === 'youtubePlaylist') {
            interaction.editReply({ embeds: createPlaylistEmbed('Dodano do ulubionych', resolved) }).catch(err => logger.error(err));
        } else if (resolved.type === 'soundcloudTrack') {
            const song = new SoundcloudSong(resolved.data, interaction.user);
            interaction.editReply({ embeds: createSongEmbed('Dodano do ulubionych', song, null, true) }).catch(err => logger.error(err));
        } else if (resolved.type === 'soundcloudPlaylist') {
            interaction.editReply({ embeds: createPlaylistEmbed('Dodano do ulubionych', resolved) }).catch(err => logger.error(err));
        } else if (resolved.type === 'spotifySong') {
            const song = new SpotifySong(resolved.data, interaction.user);
            interaction.editReply({ embeds: createSongEmbed('Dodano do ulubionych', song, null, true) }).catch(err => logger.error(err));
        } else if (resolved.type === 'spotifyPlaylist') {
            interaction.editReply({ embeds: createPlaylistEmbed('Dodano do ulubionych', resolved) }).catch(err => logger.error(err));
        }
    },
});