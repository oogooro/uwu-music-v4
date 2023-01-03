import { client, logger } from '../..';
import { DjsClientEvent } from '../../structures/DjsClientEvent';
import { botSettingsDB } from '../../database/botSettings';
import { io } from '../../server/server';

export default new DjsClientEvent('ready', async () => {
    const { online, } = botSettingsDB.get(process.env.ENV);

    if (!process.env.BOT_GUILD_ID) logger.log({ level: 'warn', message: 'ENVVAR BOT_GUILD_ID is not set.', color: 'yellowBright', });

    logger.log({
        level: 'init',
        message: `Running in ${online ? 'Online' : 'Dev-only'} mode`,
        color: online ? 'green' : 'magentaBright',
    });

    logger.log({
        level: 'init',
        message: `Bot is ready, logged as ${client.user.tag}`,
        color: 'cyanBright',
    });

    io.emit('botReady');
}, true);