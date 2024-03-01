import { ButtonStyle, ComponentType, OAuth2Scopes, PermissionsBitField } from 'discord.js';
import { experimentalServers, client, logger } from '../..';
import { botSettingsDB } from '../../database/botSettings';
import { DjsClientEvent } from '../../structures/DjsClientEvent';

export default new DjsClientEvent('messageCreate', async message => {
    if (message.author.bot) return;
    const { devs } = botSettingsDB.get(process.env.ENV);

    if (message.content.replace('!', '') === `<@${client.user.id}>`) {
        const invite = client.generateInvite({ scopes: [OAuth2Scopes.Bot], permissions: [PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.Speak, PermissionsBitField.Flags.ViewChannel], });

        return message.reply({
            content: `Witaj!\nJestem botem muzycznym!\nWszystkie moje komendy znajdziesz wpisująć **/**`,
            components: [{
                type: ComponentType.ActionRow,
                components: [
                    {
                        type: ComponentType.Button,
                        style: ButtonStyle.Link,
                        url: invite,
                        label: 'Zaproś na serwer',
                    },
                ],
            }],
            allowedMentions: {
                parse: [ 'users', ],
            },
        }).catch(err => logger.error(err));
    }

    if (devs.includes(message.author.id) && message.mentions.has(client.user)) {
        if (message.inGuild()) {
            if (message.content.includes('?experimental enable')) {
                experimentalServers.add(message.guildId);
                message.react('✅').catch(err => logger.error(err));
            }
            else if (message.content.includes('?experimental disable')) {
                experimentalServers.delete(message.guildId);
                message.react('✅').catch(err => logger.error(err));
            }
        }
    }
});