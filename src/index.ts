import { ExtendedClient } from './structures/Client';
import { Collection } from 'discord.js';
import config from './config';
import dotenv from 'dotenv';
dotenv.config();
import Logger from 'log4uwu';
import './server/server';
import { Queue } from './structures/Queue';
import { VoiceConnection } from '@discordjs/voice';

export const logger = new Logger(config.loggerOptions);
export const client = new ExtendedClient(config.clientOptions);
export const debugLogger = new Logger(config.debugLoggerOptions);
export const queues: Collection<string, Queue> = new Collection();
export const connections: Collection<string, VoiceConnection> = new Collection();

export const betaServers: Set<string> = new Set();

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

client.start();