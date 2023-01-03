import { client } from "../..";
import { SlashCommand } from "../../structures/SlashCommand";

export default new SlashCommand({
    data: {
        name: 'status',
        description: '[DEV] Status bota',
    },
    dev: true,
    run: async ({ interaction, logger }) => {
        const commandArray: string[] = [];
        const publicCommandsArray: string[] = [];
        const privateCommandsArray: string[] = [];
        const globalCommandsArray: string[] = [];
        const categoryArray: string[] = [];

        client.commands.commandsExecutable.forEach((value, key) => {
            if (value.dev) privateCommandsArray.push(`\`${key}\``);
            if (!value.dev) publicCommandsArray.push(`\`${key}\``);
            if (value.global) globalCommandsArray.push(`\`${key}\``);
            commandArray.push(`\`${key}\``);
        });

        client.commands.payload.categories.forEach((value, key) => categoryArray.push(`\`${value.manifest.displayName}\``));

        const content: string = 
`**Komendy**
> Wszystkie komendy: ${commandArray.join(', ')}
> Publiczne komendy: ${publicCommandsArray.join(', ')}
> Prywatne komendy: ${privateCommandsArray.join(', ')}
> Globalne komendy: ${globalCommandsArray.join(', ')}
> Kategorie: ${categoryArray.join(', ')}

**Podsumowanie**
> Ping ws: \`${client.ws.ping}ms\`
> Uptime: \`${(client.uptime/3600000).toFixed(2)}h\`
> Serwery: \`${client.guilds.cache.size}\`
`;

        interaction.reply({ content, ephemeral: true, })
            .catch(err => logger.error(err));
    },
});