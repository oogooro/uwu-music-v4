import { ComponentType, ModalComponentData, TextInputStyle } from 'discord.js';
import { SlashCommand } from '../../structures/SlashCommand';

export default new SlashCommand({
    data: {
        name: 'eval',
        description: '[DEV] eval'
    },
    dev: true,
    run: async ({ interaction, logger }) => {
        const modal: ModalComponentData = {
            title: 'Eval',
            customId: 'eval',
            components: [
                {
                    type: ComponentType.ActionRow,
                    components: [
                        {
                            type: ComponentType.TextInput,
                            customId: 'code',
                            label: 'Kod',
                            required: true,
                            style: TextInputStyle.Paragraph,
                            placeholder: 'console.log(\'Hello world!\');',
                        },
                    ],
                },
            ],
        }

        interaction.showModal(modal)
            .catch(err => logger.error(err));
    },
});