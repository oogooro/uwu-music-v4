import { APIEmbed, ButtonInteraction, ButtonStyle, ComponentType, InteractionReplyOptions, InteractionResponse, InteractionUpdateOptions } from 'discord.js';
import { logger } from '..';
import { disableComponents } from '../utils';

interface PaginatedEmbedOptions<dataType = any> {
    /** Default: 10 */
    itemsPerPage?: number;
    /** Default: 300_000 (5 minutes) */
    idleTimeout?: number;
    baseEmbed: Omit<APIEmbed, 'provider' | 'video'>;
    embedBuildGenerator: (items: dataType[], allItems: dataType[], page: number, numberOfPages: number) => Omit<APIEmbed, 'provider' | 'video'>;
    interactionResponse: InteractionResponse;
    data: dataType[],
}

export default class PaginatedEmbed<dataType = any> {
    private data: dataType[] = [];
    public pages: number;
    public page: number;
    public itemsPerPage: number;
    public baseEmbed: Omit<APIEmbed, 'provider' | 'video'>;
    public embedBuildGenerator: (itemsSliced: dataType[], allItems: dataType[], page: number, numberOfPages: number) => Omit<APIEmbed, 'provider' | 'video'>;

    constructor({ itemsPerPage, idleTimeout, baseEmbed, embedBuildGenerator, interactionResponse, data}: PaginatedEmbedOptions<dataType>) {
        this.itemsPerPage = itemsPerPage ?? 10;
        this.baseEmbed = baseEmbed;
        this.embedBuildGenerator = embedBuildGenerator;
        this.data = data;
        this.page = 0;

        this.updateEmbed(interactionResponse);

        const collector = interactionResponse.createMessageComponentCollector({ componentType: ComponentType.Button, idle: idleTimeout ?? 300_000 /* 5 min */, });

        collector.on('collect', btnInteraction => {
            if (btnInteraction.customId === 'EXIT') {
                if (btnInteraction.user.id !== interactionResponse.interaction.user.id)
                    btnInteraction.reply({ content: 'Ten przycisk nie jest dla ciebie!', ephemeral: true }).catch(err => logger.error(err));
                else
                    interactionResponse.delete().catch(err => logger.error(err));
            }
            else {
                if (btnInteraction.customId === 'NEXT') this.page++;
                else if (btnInteraction.customId === 'PREVIOUS') this.page--;
                else if (btnInteraction.customId === 'FIRST') this.page = 0;
                else if (btnInteraction.customId === 'LAST') this.page = -1;

                this.updateEmbed(btnInteraction);
            }
        });

        collector.once('end', async (_, reason) => {
            if (reason === 'messageDelete') return;

            disableComponents(interactionResponse).catch(err => logger.error(err));
        });
    }

    private getEmbed(): APIEmbed {
        const pages = Math.ceil((this.data.length - 1) / this.itemsPerPage);
        this.pages = pages;
        
        if (this.page === -1) this.page = pages - 1;
        else if (this.page > pages) this.page = 0;
        
        const dataSliced = this.data.slice((this.page * this.itemsPerPage), (this.page * this.itemsPerPage) + this.itemsPerPage);

        return {
            ...this.baseEmbed,
            ...this.embedBuildGenerator(dataSliced, this.data, this.page, this.pages),
        };
    }

    private updateEmbed(interaction?: InteractionResponse | ButtonInteraction): void {
        const content: InteractionReplyOptions | InteractionUpdateOptions = {
            embeds: [this.getEmbed()],
            components: [
                {
                    type: ComponentType.ActionRow,
                    components: [
                        {
                            type: ComponentType.Button,
                            customId: 'FIRST',
                            emoji: ':firstarrow:1047248854707347486',
                            style: ButtonStyle.Secondary,
                            disabled: this.page <= 0,
                        },
                        {
                            type: ComponentType.Button,
                            customId: 'PREVIOUS',
                            emoji: ':leftarrow:1047248861095268402',
                            style: ButtonStyle.Secondary,
                            disabled: this.page <= 0,
                        },
                        {
                            type: ComponentType.Button,
                            customId: 'noid',
                            label: `${this.page + 1}/${this.data.length ? this.pages : '1'}`,
                            style: ButtonStyle.Secondary,
                            disabled: true,
                        },
                        {
                            type: ComponentType.Button,
                            customId: 'NEXT',
                            emoji: ':rightarrow:1047248866627555378',
                            style: ButtonStyle.Secondary,
                            disabled: this.page >= this.pages - 1,
                        },
                        {
                            type: ComponentType.Button,
                            customId: 'LAST',
                            emoji: ':lastarrow:1047248856913551370',
                            style: ButtonStyle.Secondary,
                            disabled: this.page >= this.pages - 1,
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

        if (interaction instanceof InteractionResponse) interaction.edit(content)
            .catch(err => logger.error(err));
        else interaction.update(content as InteractionUpdateOptions)
            .catch(err => logger.error(err));
    }
}