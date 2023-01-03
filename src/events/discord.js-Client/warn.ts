import { logger } from '../..';
import { DjsClientEvent } from '../../structures/DjsClientEvent';

export default new DjsClientEvent('warn', async message => {
    logger.log({
        level: 'warn',
        message
    });
});