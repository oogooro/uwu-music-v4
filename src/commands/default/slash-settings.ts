import { PermissionFlagsBits } from 'discord.js';
import { SlashCommand } from '../../structures/SlashCommand';

export default new SlashCommand({
    data: {
        name: 'settings',
        description: 'Zmienia ustawienia serwera',
        defaultMemberPermissions: 'ManageGuild',
        dmPermission: false,
    },
    dev: true,
    disabled: true,
    global: true,
    run: async ({ interaction, logger, queue }) => {
        
    },
});