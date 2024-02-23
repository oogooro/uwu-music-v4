import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import PaginatedEmbed from '../../structures/PaginatedEmbed';
import { SlashCommand } from '../../structures/SlashCommand';

export default new SlashCommand({
    data: {
        name: 'paginated',
        description: '[DEV] Test embedów ze stronami',
        dmPermission: false,
    },
    dev: true,
    disabled: true,
    run: async ({interaction, logger,}) => {
        const data = [
            'Hello everynyan',
            'drugi',
            'trzeci',
            'cztery, cztery',
            'ty jebany betoniarzu',
            'gas gas gas',
            'boom boom boom bomm',
            'aaaaaaaaaaaaa',
            'bbbbbbbbbbbbb',
            'ccccccccccccc',
            'ddddddddddddd',
            'elp im under the water',
            'kot wpierdala sałate',
            'wtf roof is burning',
            'twoja stara to kopara',
            'a twój stary ją odpala',
        ];

        const interactionResponse = await interaction.deferReply({ ephemeral: true, }).catch(err => { logger.error(err); });
        if (!interactionResponse) return;


        new PaginatedEmbed<string>({
            itemsPerPage: 10,
            data,
            interactionResponse,
            idleTimeout: 10_000,
            baseEmbed: {
                title: 'Test stronek',
                thumbnail: { url: 'https://media.discordapp.net/attachments/708264769085374484/1200167675142352906/ezgif.com-resize.gif?ex=65ce6cbf&is=65bbf7bf&hm=2d12fa92851b74f4bfce4709069b39b1cb1a96b7f23320af2d45ca7c27ce61c1&='},
                color: 0xff00df,
            },
            exitButton: false,
            refreshButton: false,
            customRow: new ActionRowBuilder<ButtonBuilder>().setComponents(new ButtonBuilder().setCustomId('EXIT').setStyle(ButtonStyle.Danger).setLabel('wyciep')),
            embedBuildGenerator: (items, allItems, page, pages) => {
                const str = items.map((item, index) => `${(index + (page * 10) + 1)}. ${item}`).join('\n');
                return {
                    description: str,
                    footer: { text: `strona ${page + 1}/${pages} (${allItems.length} rzeczy)` },
                };
            },
        });
    },
});