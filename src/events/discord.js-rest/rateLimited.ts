import { debugLogger } from '../..';
import { DjsRestEvent } from '../../structures/DjsRestEvent';

export default new DjsRestEvent('rateLimited', async info => {
    debugLogger.log({
        level: 'warn',
        message: `Got rate-limited on ${info.route} until ${info.timeToReset}ms have passed!`,
        silent: true,
    });
});