import { ApplicationCommandType, GuildMember, hyperlink } from 'discord.js';
import config from '../../config';
import { queues } from '../..';
import { MessageCommand } from '../../structures/MessageCommand';
import { Queue } from '../../structures/Queue';
import { YoutubeSong } from '../../structures/YoutubeSong';
import { createSongEmbed, getUrlsFromMessage, resolveSong } from '../../utils';
import { SoundcloudSong } from '../../structures/SoundcoludSong';
import { SpotifySong } from '../../structures/SpotifySong';

export default new MessageCommand({
    data: {
        type: ApplicationCommandType.Message,
        name: 'Dodaj do kolejki',
        dmPermission: false,
    },
    vcOnly: true,
    global: true,
    run: async ({ interaction, logger }) => {
        const channel = (interaction.member as GuildMember).voice.channel;

        const queue = queues.has(interaction.guildId) ? queues.get(interaction.guildId) : new Queue(interaction.guild, interaction.channel);

        const matched = getUrlsFromMessage(interaction.targetMessage);

        if (!matched.length) return interaction.reply({ content: 'W tej wiadomości nie ma linku do piosenki!', ephemeral: true, })
            .catch(err => logger.error(err));

        const interactionResponse = await interaction.deferReply().catch(err => { logger.error(err) });
        if (!interactionResponse) return;

        const [songUrl] = matched;

        if (!queue.connected) {
            try {
                await queue.connect(channel);
            } catch (err) {
                logger.error(err);
                return interaction.editReply({ content: 'Nie udało się połączyć z kanałem głosowym!', }).catch(err => logger.error(err));
            }
        }

        const resolved = await resolveSong(songUrl);
        if (!resolved) return interaction.editReply({ content: 'Nie można dodać tej piosenki!', }).catch(err => logger.error(err));

        if (resolved.type === 'youtubeSong') {
            if (resolved.data.upcoming)
                return interaction.editReply({ content: 'Nie można dodać nadchodzących piosenek!', }).catch(err => logger.error(err));

            const song = new YoutubeSong(resolved.data, interaction.user);
            queue.add([song], resolved);

            interaction.editReply({ embeds: createSongEmbed('Dodano', song), }).catch(err => logger.error(err));
        } else if (resolved.type === 'youtubePlaylist') {
            const songs = resolved.data.map(song => new YoutubeSong(song, interaction.user));
            queue.add(songs, resolved);
            
            interaction.editReply({
                embeds: [{
                    title: 'Dodano',
                    color: config.embedColor,
                    description: `${songs.length} piosenek z ${hyperlink(resolved.title, resolved.url)}\n(dodane przez ${interaction.user.toString()})`,
                    thumbnail: {
                        url: resolved.thumbnailUrl,
                    },
                }],
            }).catch(err => logger.error(err));
        } else if (resolved.type === 'soundcloudTrack') {
            const song = new SoundcloudSong(resolved.data, interaction.user);
            queue.add([song], resolved);

            interaction.editReply({ embeds: createSongEmbed('Dodano', song), }).catch(err => logger.error(err));
        } else if (resolved.type === 'soundcloudPlaylist') {
            const songs = resolved.data.map(song => new SoundcloudSong(song, interaction.user));
            queue.add(songs, resolved);

            interaction.editReply({
                embeds: [{
                    title: 'Dodano',
                    color: config.embedColor,
                    description: `${songs.length} piosenek z ${hyperlink(resolved.title, resolved.url)}\n(dodane przez ${interaction.user.toString()})`,
                    thumbnail: {
                        url: resolved.thumbnailUrl,
                    },
                }],
            }).catch(err => logger.error(err));
        } else if (resolved.type === 'spotifySong') {
            const song = new SpotifySong(resolved.data, interaction.user);
            queue.add([song], resolved);

            interaction.editReply({ embeds: createSongEmbed('Dodano', song), }).catch(err => logger.error(err));
        } else if (resolved.type === 'spotifyPlaylist') {
            const songs = resolved.data.map(song => new SpotifySong(song, interaction.user));
            queue.add(songs, resolved);

            interaction.editReply({
                embeds: [{
                    title: 'Dodano',
                    color: config.embedColor,
                    description: `${songs.length} piosenek z ${hyperlink(resolved.title, resolved.url)}\n(dodane przez ${interaction.user.toString()})`,
                    thumbnail: {
                        url: resolved.thumbnailUrl,
                    },
                }],
            }).catch(err => logger.error(err));
        }
    },
});