import dotenv from 'dotenv';
dotenv.config();

if (!process.env.ENV) {
    console.error('ENVVAR ENV is not set! Aborting.');
    process.exit(1);
}

import { ExtendedClient } from './structures/Client';
import { Collection } from 'discord.js';
import { clientOptions, loggerOptions, debugLoggerOptions } from './config';
import Logger from 'log4uwu';
import './server/server';
import { Queue } from './structures/Queue';
import Soundcloud from 'soundcloud.ts';

Error.stackTraceLimit = 20;

export const logger = new Logger(loggerOptions);
export const debugLogger = new Logger(debugLoggerOptions);
export const queues: Collection<string, Queue> = new Collection();
export const experimentalServers: Set<string> = new Set();

logger.log({
    level: 'init',
    message: `Running on ${process.env.ENV}`,
    color: 'greenBright',
});

if (!process.env.BOT_GUILD_ID) {
    logger.log({
        level: 'warn',
        message: 'BOT_GUILD_ID is not set!'
    });
} else if (process.env.ENV === 'dev') {
    experimentalServers.add(process.env.BOT_GUILD_ID);
}
export const client = new ExtendedClient(clientOptions);
export const soundcloud = new Soundcloud();

client.start();