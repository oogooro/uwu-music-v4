import { ExtendedClient } from './structures/Client';
import { Collection } from 'discord.js';
import config from './config';
import dotenv from 'dotenv';
dotenv.config();
import Logger from 'log4uwu';
import './server/server';
import { Queue } from './structures/Queue';
import Soundcloud from 'soundcloud.ts';

Error.stackTraceLimit = 20;

export const logger = new Logger(config.loggerOptions);
export const client = new ExtendedClient(config.clientOptions);
export const debugLogger = new Logger(config.debugLoggerOptions);
export const soundcloud = new Soundcloud();

export const queues: Collection<string, Queue> = new Collection();
export const experimentalServers: Set<string> = new Set();

if (!process.env.ENV) {
    logger.log({
        level: 'error',
        message: 'ENVVAR ENV is not set! Aborting.',
    });
    process.exit(1);
}

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

client.start();