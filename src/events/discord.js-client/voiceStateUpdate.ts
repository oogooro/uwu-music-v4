import { logger, queues } from '../..';
import { DjsClientEvent } from '../../structures/DjsClientEvent';

const INACTIVITY_PERIOD = 5 * 1000 * 60; /* 5 min */

const activeTimeouts: Map<string, NodeJS.Timeout> = new Map();

export default new DjsClientEvent('voiceStateUpdate', async (oldState, newState) => {
    if (!queues.has(oldState.guild.id)) return;
    const queue = queues.get(oldState.guild.id);
    const channel = queue.voiceChannel;
    if (!channel) return;

    const guildId = queue.guild.id;

    if ((channel.id === oldState.channelId) && oldState.channelId !== newState.channelId) {
        if (channel.members.size === 1) {
            logger.debug(`[INACTIVITY] ${guildId} Only bot's left, starting timer`);

            if (activeTimeouts.has(guildId)) clearTimeout(activeTimeouts.get(guildId));
            activeTimeouts.set(guildId, setTimeout(() => {
                logger.debug(`[INACTIVITY] ${guildId} Left due to inactivity`);
                queue.byebye();
                activeTimeouts.delete(guildId);
            }, INACTIVITY_PERIOD));
        }
    } else if (activeTimeouts.has(guildId) && (channel.id === newState.channelId) && (oldState.channelId !== newState.channelId)) {
        logger.debug(`[INACTIVITY] ${guildId} Someone joined, clearing timer`);
        clearTimeout(activeTimeouts.get(guildId));
        activeTimeouts.delete(guildId);
    }
});