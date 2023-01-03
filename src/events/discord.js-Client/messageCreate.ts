import { betaServers, client, logger } from '../..';
import { botSettingsDB } from '../../database/botSettings';
import { DjsClientEvent } from '../../structures/DjsClientEvent';

export default new DjsClientEvent('messageCreate', async message => {
    if (message.author.bot) return;
    const { devs } = botSettingsDB.get(process.env.ENV);

    if (devs.includes(message.author.id) && message.mentions.has(client.user)) {
        if (message.inGuild()) {
            if (message.content.includes('?beta enable')) {
                betaServers.add(message.guildId);
                message.react('✅').catch(err => logger.error(err));
            }
            else if (message.content.includes('?beta disable')) {
                betaServers.delete(message.guildId);
                message.react('✅').catch(err => logger.error(err));
            }
        }
    }
});