import { logger } from '../..';
import { DjsClientEvent } from '../../structures/DjsClientEvent';

export default new DjsClientEvent('error', async error => {
    logger.error(error);
});