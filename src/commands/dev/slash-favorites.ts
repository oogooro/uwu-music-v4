import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, ModalBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, TextInputBuilder, TextInputStyle, hyperlink } from 'discord.js';
import config from '../../config';
import { getUserSettings, userSettingsDB } from '../../database/userSettings';
import { SlashCommand } from '../../structures/SlashCommand';
import { createPlaylistEmbed, createSongEmbed, escape, resolveSong, trimString } from '../../utils';
import PaginatedEmbed from '../../structures/PaginatedEmbed';
import { YoutubeSong } from '../../structures/YoutubeSong';
import { SoundcloudSong } from '../../structures/SoundcoludSong';
import { SpotifySong } from '../../structures/SpotifySong';

export default new SlashCommand({
    data: {
        name: 'favorites',
        description: 'Zarządzaj ulubionymi piosenkami',
    },
    global: true,
    dev: true,
    run: async ({ interaction, logger, queue }) => {
        const settingsFactory = () => {
            return getUserSettings(interaction.user.id).favorites;
        }

        const interactionResponse = await interaction.deferReply({ ephemeral: true, }).catch(err => { logger.error(err); });
        if (!interactionResponse) return;

        const paginated = new PaginatedEmbed({
            data: settingsFactory,
            baseEmbed: {
                title: '⭐ Ulubione piosenki',
                color: config.embedColor,
            },
            exitButton: false,
            customRow: new ActionRowBuilder<ButtonBuilder>()
                .addComponents(
                    new ButtonBuilder()
                        .setLabel('Dodaj piosenkę')
                        .setStyle(ButtonStyle.Success)
                        .setCustomId('ADD_FAV_SONG'),
                    new ButtonBuilder()
                        .setLabel('Usuń piosenkę')
                        .setStyle(ButtonStyle.Danger)
                        .setCustomId('REMOVE_FAV_SONG')
                ),
            embedBuildGenerator: (items, allItems, page, numberOfPages) => {
                return {
                    description: items.length ?
                        items.map((item, index) => `${(index + 1) * (page + 1)}. ${hyperlink(escape(item.title), item.url)}`).join('\n\n') :
                        'Nie ma jescze ulubionych piosenek! :(',
                }
            },
            interactionResponse,
        });

        const addSongModal = new ModalBuilder()
            .setTitle('Dodaj do ulubionych')
            .setCustomId('ADD_FAV_SONG_MODAL')
            .addComponents(
                new ActionRowBuilder<TextInputBuilder>()
                    .addComponents(
                        new TextInputBuilder()
                            .setCustomId('FAV_SONG_URL')
                            .setLabel('Link do piosenki')
                            .setRequired(true)
                            .setStyle(TextInputStyle.Short)
                    )
            )

        const collector = interactionResponse.createMessageComponentCollector({ componentType: ComponentType.Button, });
        
        let awaitingModal = false;
                        
        collector.on('collect', async btnInteraction => {
            if (btnInteraction.customId === 'ADD_FAV_SONG') {
                await btnInteraction.showModal(addSongModal).catch(err => { logger.error(err); });
                awaitingModal = true;
                btnInteraction.awaitModalSubmit({ time: 300_000 /* 5 min */, })
                    .then(async modalInteraction => {
                        if (!awaitingModal) return;
                        awaitingModal = false;
                        const url = modalInteraction.fields.getTextInputValue('FAV_SONG_URL');

                        const resolved = await resolveSong(url);
                        if (!resolved) modalInteraction.reply({ content: 'Nie udało się dodać piosenki!', ephemeral: true, }).catch(err => logger.error(err));

                        const settings = getUserSettings(interaction.user.id);

                        if (settings.favorites.find(favSong => favSong.url === url)) {
                            return modalInteraction.reply({ content: 'Ta piosenka już jest w ulubionych!', ephemeral: true, }).catch(err => logger.error(err));
                        }

                        settings.favorites.push({ title: resolved.title, url: resolved.url, });
                        userSettingsDB.set(interaction.user.id, settings);

                        if (resolved.type === 'youtubeSong') {
                            const song = new YoutubeSong(resolved.data, interaction.user);
                            modalInteraction.reply({ embeds: createSongEmbed('Dodano do ulubionych', song, null, true), ephemeral: true, }).catch(err => logger.error(err));
                        } else if (resolved.type === 'youtubePlaylist') {
                            modalInteraction.reply({ embeds: createPlaylistEmbed('Dodano do ulubionych', resolved), ephemeral: true, }).catch(err => logger.error(err));
                        } else if (resolved.type === 'soundcloudTrack') {
                            const song = new SoundcloudSong(resolved.data, interaction.user);
                            modalInteraction.reply({ embeds: createSongEmbed('Dodano do ulubionych', song, null, true), ephemeral: true, }).catch(err => logger.error(err));
                        } else if (resolved.type === 'soundcloudPlaylist') {
                            modalInteraction.reply({ embeds: createPlaylistEmbed('Dodano do ulubionych', resolved), ephemeral: true, }).catch(err => logger.error(err));
                        } else if (resolved.type === 'spotifySong') {
                            const song = new SpotifySong(resolved.data, interaction.user);
                            modalInteraction.reply({ embeds: createSongEmbed('Dodano do ulubionych', song, null, true), ephemeral: true, }).catch(err => logger.error(err));
                        } else if (resolved.type === 'spotifyPlaylist') {
                            modalInteraction.reply({ embeds: createPlaylistEmbed('Dodano do ulubionych', resolved), ephemeral: true, }).catch(err => logger.error(err));
                        }

                        paginated.refresh();
                    })
                    .catch(() => {
                        awaitingModal = false;
                    });
            } else if (btnInteraction.customId === 'REMOVE_FAV_SONG') {
                const settings = getUserSettings(interaction.user.id);

                const btnInteractionResponse = await btnInteraction.reply({ components: [
                    new ActionRowBuilder<StringSelectMenuBuilder>()
                        .addComponents(
                            new StringSelectMenuBuilder()
                                .setCustomId('REMOVE_SONG_SELECT')
                                .setMinValues(1)
                                .setMaxValues(settings.favorites.length)
                                .setPlaceholder('Piosenki do usunięcia')
                                .setOptions(
                                    settings.favorites.map(favSong => new StringSelectMenuOptionBuilder()
                                        .setLabel(favSong.title)
                                        .setValue(favSong.url)
                                    ),
                                ),
                        ),
                    ],
                    ephemeral: true,
                }).catch(err => { logger.error(err); });
                
                if (!btnInteractionResponse) return;

                (await btnInteractionResponse.fetch()).awaitMessageComponent({ componentType: ComponentType.StringSelect, time: 300_000 /* 5 min */, })
                    .then(selectMenuInteraction => {
                        let removed = 0;

                        settings.favorites.filter((value, index, arr) => {
                            if (selectMenuInteraction.values.includes(value.url)) {
                                arr.splice(index, 1);
                                removed++;
                                return true;
                            }
                            return false;
                        });

                        userSettingsDB.set(interaction.user.id, settings);

                        selectMenuInteraction.update({ 
                            content: `Usunięto **${removed}** piosenek z ulubionych!`,
                            components: [],
                        }).catch(err => logger.error(err));

                        paginated.refresh();
                    })
                    .catch(reason => {
                        if (reason !== 'time') return;
                        else btnInteraction.editReply({ content: 'Piosenki nie zostały wybrane na czas!', components: [], }).catch(err => logger.error(err));
                    });
            }
        });
    },
});