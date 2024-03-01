import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, ComponentType, InteractionReplyOptions, InteractionUpdateOptions, StringSelectMenuBuilder } from 'discord.js';
import { client, queues } from '../..';
import { SlashCommand } from '../../structures/SlashCommand';
import config from '../../config';
import { songToDisplayString } from '../../utils';

export default new SlashCommand({
    data: {
        name: 'queue',
        description: 'Wyświetla kolejkę serwera',
        dmPermission: false,
    },
    queueRequired: true,
    global: true,
    run: async ({ interaction, logger, queue, }) => {
        if (!queue.songs.length)
            return interaction.reply({ content: 'Kolejka jest pusta!', ephemeral: true, }).catch(err => logger.error(err));

        const interactionResponse = await interaction.deferReply();
        
        let page = 0;

        const update = (btnInteraction?: ButtonInteraction) => {
            const queue = queues.get(interaction.guildId);
            if (!queue) {
                if (btnInteraction)
                    return btnInteraction.update({ content: 'Kolejka już nie istnieje!', components: [], embeds: [], }).catch(err => logger.error(err));
                else return;
            }
            
            const SONGS_PER_PAGE = 8;
            const songs = Array.from(queue.songs);
            
            const pages = Math.ceil((songs.length - 1) / SONGS_PER_PAGE);

            if (page === -1) page = pages - 1;
            else if (page > pages) page = 0;

            const queueEmpty = !songs[0];

            const currentSong = queueEmpty ? 'Kolejka jest pusta' : `Teraz gra:\n${songToDisplayString(songs.shift())}\n\n`;
            const songsSliced = songs.slice((page * SONGS_PER_PAGE), (page * SONGS_PER_PAGE) + SONGS_PER_PAGE);

            const songsStringArr = songsSliced.map((song, index) => `${(index + (page * SONGS_PER_PAGE) + 1)}. ${songToDisplayString(song)}`);

            let pauseEmoji: string = queue.paused ? ' :pause_button:' : '';

            let loopEmoji = '';
            switch (queue.repeatMode) {
                case 'disabled':
                    loopEmoji = '';
                    break;
                case 'queue':
                    loopEmoji = ' 🔁';
                    break;
                case 'song':
                    loopEmoji = ' 🔂';
                    break;
            }

            const songsLeft = songs.length + 1;
            let piosenek: string, znajduje: string;
            if (songsLeft === 1) {
                piosenek = 'piosenka';
                znajduje = 'znajduje';
            }
            else if (1 < songsLeft && songsLeft < 5) {
                piosenek = 'piosenki';
                znajduje = 'znajdują';
            }
            else {
                piosenek = 'piosenek';
                znajduje = 'znajduje';
            }

            const content: InteractionReplyOptions | InteractionUpdateOptions = {
                embeds: [
                    {
                        title: `Kolejka${loopEmoji}${pauseEmoji}`,
                        description: `${page === 0 ? currentSong : ''}${songsStringArr.join('\n\n')}`,
                        color: config.embedColor,
                        footer: {
                            text: queueEmpty ? null : `Na kolejce ${znajduje} się ${songsLeft} ${piosenek}`,
                        },
                    },
                ],
                components: [
                    {
                        type: ComponentType.ActionRow,
                        components: [
                            {
                                type: ComponentType.Button,
                                customId: 'FIRST',
                                emoji: ':firstarrow:1047248854707347486',
                                style: ButtonStyle.Secondary,
                                disabled: page <= 0,
                            },
                            {
                                type: ComponentType.Button,
                                customId: 'PREVIOUS',
                                emoji: ':leftarrow:1047248861095268402',
                                style: ButtonStyle.Secondary,
                                disabled: page <= 0,
                            },
                            {
                                type: ComponentType.Button,
                                customId: `noid`,
                                label: `${page + 1}/${songsStringArr.length ? pages : '1'}`,
                                style: ButtonStyle.Secondary,
                                disabled: true,
                            },
                            {
                                type: ComponentType.Button,
                                customId: 'NEXT',
                                emoji: ':rightarrow:1047248866627555378',
                                style: ButtonStyle.Secondary,
                                disabled: page >= pages - 1,
                            },
                            {
                                type: ComponentType.Button,
                                customId: 'LAST',
                                emoji: ':lastarrow:1047248856913551370',
                                style: ButtonStyle.Secondary,
                                disabled: page >= pages - 1,
                            },
                        ],
                    },
                    {
                        type: ComponentType.ActionRow,
                        components: [
                            {
                                type: ComponentType.Button,
                                customId: 'EXIT',
				                label: 'Wyjście',
                                style: ButtonStyle.Danger
                            },
                            {
                                type: ComponentType.Button,
                                customId: 'REFRESH',
                                label: 'Odśwież',
                                emoji: ':refresharrow:1047248864429756438',
                                style: ButtonStyle.Secondary
                            },
                        ],
                    },
                ],
            }

            if (!btnInteraction) interaction.editReply(content as InteractionReplyOptions)
                .catch(err => logger.error(err));
            else btnInteraction.update(content as InteractionUpdateOptions)
                .catch(err => logger.error(err));
        }
        update();

        const collector = interactionResponse.createMessageComponentCollector({ componentType: ComponentType.Button, idle: 300_000 /*5 min*/ });

        collector.on('collect', btnInteraction => {
            if (btnInteraction.customId === 'EXIT') {
                if (btnInteraction.user.id !== interaction.user.id)
                    btnInteraction.reply({ content: 'Ten przycisk nie jest dla ciebie!', ephemeral: true }).catch(err => logger.error(err));
                else
                    interaction.deleteReply().catch(err => logger.error(err));
            }
            else {
                if (btnInteraction.customId === 'NEXT') page ++;
                else if (btnInteraction.customId === 'PREVIOUS') page --;
                else if (btnInteraction.customId === 'FIRST') page = 0;
                else if (btnInteraction.customId === 'LAST') page = -1;

                update(btnInteraction);
            }
        });

        collector.once('end', async (_collected, reason) => {
            if (reason === 'messageDelete') return;

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
        });

    },
});
