import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, ComponentType, EmbedBuilder, InteractionEditReplyOptions, StringSelectMenuBuilder } from 'discord.js';
import { SlashCommand } from '../../structures/SlashCommand';
import { getDefaultUserPreferences, patchUserPreferences, userPreferencesDB } from '../../database/userPreferences';
import config from '../../config';

export default new SlashCommand({
    data: {
        name: 'preferences',
        description: 'Zmienia preferencje użytkownika',
    },
    dev: true,
    run: async ({ interaction, logger, queue }) => {
        let preferences = userPreferencesDB.get(interaction.user.id);
        preferences ??= getDefaultUserPreferences(interaction.user.id);
        patchUserPreferences(preferences, interaction.user.id);

        const update = (btnInteraction?: ButtonInteraction) => {
            const int = btnInteraction || interaction;

            const payload: InteractionEditReplyOptions = {
                embeds: [
                    new EmbedBuilder()
                        .setTitle('Preferencje')
                        .setColor(config.embedColor)
                        .setDescription(`Historia piosenek ${preferences.keepHistory ? '✅' : '❌'}\nPomijanie segmentów ${preferences.sponsorBlockEnabled ? '✅' : '❌'}\n\nKliknij przyciski na dole, aby zmienić`),
                ],
                components: [
                    new ActionRowBuilder<ButtonBuilder>()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId('historyToggle')
                                .setLabel('Historia piosenek')
                                .setStyle(preferences.keepHistory ? ButtonStyle.Success : ButtonStyle.Danger),
                            new ButtonBuilder()
                                .setCustomId('sponsorBlockToggle')
                                .setLabel('Pomijanie segmentów')
                                .setStyle(preferences.sponsorBlockEnabled ? ButtonStyle.Success : ButtonStyle.Danger),
                            new ButtonBuilder()
                                .setCustomId('cleanHistory')
                                .setLabel('Wyczyść historię')
                                .setStyle(ButtonStyle.Secondary),
                        ),
                ],
            }

            if (int.isButton()) int.update(payload).catch(err => logger.error(err));
            else int.editReply(payload).catch(err => logger.error(err));
        }

        const interactionResponse = await interaction.deferReply({ ephemeral: true, });
        if (!interactionResponse) return;

        update();
        
        const collector = interactionResponse.createMessageComponentCollector({ componentType: ComponentType.Button, idle: 300_000 /* 5 min */, });
        
        collector.on('collect', (btnInteraction) => {
            if (btnInteraction.customId === 'historyToggle') {
                preferences.keepHistory = !preferences.keepHistory;
                userPreferencesDB.set(btnInteraction.user.id, preferences);
            } else if (btnInteraction.customId === 'sponsorBlockToggle') {
                preferences.sponsorBlockEnabled = !preferences.sponsorBlockEnabled;
                userPreferencesDB.set(btnInteraction.user.id, preferences);
            } else if (btnInteraction.customId === 'cleanHistory') {
                preferences.lastAddedSongs = [];
                userPreferencesDB.set(btnInteraction.user.id, preferences);
            }
            update(btnInteraction);
        });
        
        collector.on('end', async (_collected, reason) => {
            if (reason == 'idle') {
                const message = await interaction.fetchReply().catch(err => logger.error(err));
                if (typeof message === 'string') return;

                const disabledRows = message.components.reduce((a: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[], row) => {
                    const components = row.toJSON().components.reduce((a: (ButtonBuilder | StringSelectMenuBuilder)[], component) => {
                        let builder: (ButtonBuilder | StringSelectMenuBuilder) = (component.type === ComponentType.Button) ? ButtonBuilder.from(component) : StringSelectMenuBuilder.from(component);
                        builder.setDisabled(true);
                        a.push(builder);
                        return a;
                    }, []);
                    const disabledRow = (components[0].data.type === ComponentType.Button) ?
                        new ActionRowBuilder<ButtonBuilder>().addComponents(components as ButtonBuilder[]) :
                        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(components as StringSelectMenuBuilder[]);
                    a.push(disabledRow);
                    return a;
                }, []);

                interaction.editReply({ components: disabledRows, })
                    .catch(err => logger.error(err));
            }
        });
    },
});