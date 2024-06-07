import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, ComponentType, EmbedBuilder, InteractionEditReplyOptions, StringSelectMenuBuilder } from 'discord.js';
import { SlashCommand } from '../../structures/SlashCommand';
import { getUserSettings, userSettingsDB } from '../../database/userSettings';
import { embedColor } from '../../config';
import { disableComponents } from '../../utils';

export default new SlashCommand({
    data: {
        name: 'preferences',
        description: 'Zmienia preferencje użytkownika',
    },
    global: true,
    run: async ({ interaction, logger, queue }) => {
        const settings = getUserSettings(interaction.user.id);

        const update = (btnInteraction?: ButtonInteraction) => {
            const int = btnInteraction || interaction;

            const payload: InteractionEditReplyOptions = {
                embeds: [
                    new EmbedBuilder()
                        .setTitle('Preferencje')
                        .setColor(embedColor)
                        .setDescription(`Historia piosenek ${settings.keepHistory ? '✅' : '❌'}\nPomijanie segmentów ${settings.sponsorBlockEnabled ? '✅' : '❌'}\n\nKliknij przyciski na dole, aby zmienić`),
                ],
                components: [
                    new ActionRowBuilder<ButtonBuilder>()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId('historyToggle')
                                .setLabel('Historia piosenek')
                                .setStyle(settings.keepHistory ? ButtonStyle.Success : ButtonStyle.Danger),
                            new ButtonBuilder()
                                .setCustomId('sponsorBlockToggle')
                                .setLabel('Pomijanie segmentów')
                                .setStyle(settings.sponsorBlockEnabled ? ButtonStyle.Success : ButtonStyle.Danger),
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
                settings.keepHistory = !settings.keepHistory;
                userSettingsDB.set(btnInteraction.user.id, settings);
            } else if (btnInteraction.customId === 'sponsorBlockToggle') {
                settings.sponsorBlockEnabled = !settings.sponsorBlockEnabled;
                userSettingsDB.set(btnInteraction.user.id, settings);
            } else if (btnInteraction.customId === 'cleanHistory') {
                settings.lastAddedSongs = [];
                userSettingsDB.set(btnInteraction.user.id, settings);
            }
            update(btnInteraction);
        });
        
        collector.on('end', async (_collected, reason) => {
            if (reason == 'idle') {
                const message = await interaction.fetchReply().catch(err => logger.error(err));
                if (typeof message === 'string') return;

                disableComponents(interactionResponse);
            }
        });
    },
});