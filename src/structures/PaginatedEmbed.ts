import { APIEmbed, ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, ComponentType, InteractionReplyOptions, InteractionResponse, InteractionUpdateOptions } from 'discord.js';
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
    data: dataType[] | (() => dataType[]),
    customRow?: ActionRowBuilder<ButtonBuilder>,
    /** Default: true */
    exitButton?: boolean;
    /** Default: true */
    refreshButton?: boolean;
}

export default class PaginatedEmbed<dataType = any> {
    private data: dataType[] | (() => dataType[]) = [];
    private exitButton: boolean;
    private refreshButton: boolean;
    private interactionResponse: InteractionResponse;
    public pages: number;
    public page: number;
    public itemsPerPage: number;
    public baseEmbed: Omit<APIEmbed, 'provider' | 'video'>;
    public embedBuildGenerator: (itemsSliced: dataType[], allItems: dataType[], page: number, numberOfPages: number) => Omit<APIEmbed, 'provider' | 'video'>;
    public customRow?: ActionRowBuilder<ButtonBuilder>;

    constructor({ itemsPerPage, idleTimeout, baseEmbed, embedBuildGenerator, interactionResponse, data, exitButton, refreshButton, customRow}: PaginatedEmbedOptions<dataType>) {
        this.itemsPerPage = itemsPerPage ?? 10;
        this.baseEmbed = baseEmbed;
        this.embedBuildGenerator = embedBuildGenerator;
        this.data = data;
        this.exitButton = exitButton ?? true;
        this.refreshButton = refreshButton ?? true;
        this.customRow = customRow;
        this.interactionResponse = interactionResponse;
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
                else if (btnInteraction.customId === 'REFRESH') {/* pass */}
                else return; // ta interakcja pewnie pochodzi z customowego actionrowa

                this.updateEmbed(btnInteraction);
            }
        });

        collector.once('end', async (_, reason) => {
            if (reason !== 'idle') return;

            disableComponents(interactionResponse).catch(err => logger.error(err));
        });
    }

    private getEmbed(): APIEmbed {
        let data: dataType[];
        if (typeof this.data === 'function') {
            data = this.data();
        } else data = this.data;

        const dataSliced = data.slice((this.page * this.itemsPerPage), (this.page * this.itemsPerPage) + this.itemsPerPage);

        return {
            ...this.baseEmbed,
            ...this.embedBuildGenerator(dataSliced, data, this.page, this.pages),
        };
    }

    private updateEmbed(interaction?: InteractionResponse | ButtonInteraction): void {
        interaction ??= this.interactionResponse;

        const pages = Math.ceil((this.data.length - 1) / this.itemsPerPage);
        this.pages = pages;

        if (this.page === -1) this.page = pages - 1;
        else if (this.page > pages) this.page = 0;

        const pageButtonsRow = new ActionRowBuilder<ButtonBuilder>();
        const controlRow = new ActionRowBuilder<ButtonBuilder>();

        pageButtonsRow.addComponents([
            new ButtonBuilder()
                .setEmoji(':firstarrow:1047248854707347486')
                .setCustomId('FIRST')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(this.page <= 0),
            new ButtonBuilder()
                .setEmoji(':leftarrow:1047248861095268402')
                .setCustomId('PREVIOUS')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(this.page <= 0),
            new ButtonBuilder()
                .setLabel(`${this.page + 1}/${this.data.length ? pages : '1'}`)
                .setCustomId('noid')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true),
            new ButtonBuilder()
                .setEmoji(':rightarrow:1047248866627555378')
                .setCustomId('NEXT')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(this.page >= pages - 1),
            new ButtonBuilder()
                .setEmoji(':lastarrow:1047248856913551370')
                .setCustomId('LAST')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(this.page >= pages - 1),
        ]);

        if (this.exitButton) {
            controlRow.addComponents(
                new ButtonBuilder({
                    type: ComponentType.Button,
                    customId: 'EXIT',
                    label: 'Wyjście',
                    style: ButtonStyle.Danger,
                }),
            );
        }

        if (this.refreshButton) {
            controlRow.addComponents(
                new ButtonBuilder({
                    type: ComponentType.Button,
                    customId: 'REFRESH',
                    label: 'Odśwież',
                    emoji: ':refresharrow:1047248864429756438',
                    style: ButtonStyle.Secondary,
                }),
            );
        }

        const content: InteractionReplyOptions | InteractionUpdateOptions = {
            embeds: [this.getEmbed()],
            components: [pageButtonsRow],
        }

        if (this.customRow) content.components.push(this.customRow);
        if (controlRow.components.length) content.components.push(controlRow);

        if (interaction instanceof InteractionResponse) interaction.edit(content)
            .catch(err => logger.error(err));
        else interaction.update(content as InteractionUpdateOptions)
            .catch(err => logger.error(err));
    }

    public refresh(): void {
        this.updateEmbed();
    }
}