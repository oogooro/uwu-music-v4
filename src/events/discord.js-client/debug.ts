import { debugLogger } from '../..';
import { DjsClientEvent } from '../../structures/DjsClientEvent';

export default new DjsClientEvent('debug', async message => {
    debugLogger.debug(message);
});