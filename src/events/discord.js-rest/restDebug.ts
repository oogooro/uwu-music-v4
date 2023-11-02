import { debugLogger } from '../..';
import { DjsRestEvent } from '../../structures/DjsRestEvent';

export default new DjsRestEvent('restDebug', async message => {
    debugLogger.debug(message);
});