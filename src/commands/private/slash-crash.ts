import { SlashCommand } from '../../structures/SlashCommand';

export default new SlashCommand({
    data: {
        name: 'crash',
        description: 'uh oh stinky',
    },
    run: async ({ interaction, logger }) => {
        throw new Error('kontrolowany crash');
    },
});