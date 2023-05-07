import { ExtendedClient } from './structures/Client';
import { Collection } from 'discord.js';
import config from './config';
import dotenv from 'dotenv';
dotenv.config();
import Logger from 'log4uwu';
import './server/server';
import { Queue } from './structures/Queue';
import Soundcloud from 'soundcloud.ts';
import YtDlp from 'yt-dlp-wrap';
import * as fs from 'node:fs';

Error.stackTraceLimit = 20;

export const logger = new Logger(config.loggerOptions);
export const client = new ExtendedClient(config.clientOptions);
export const debugLogger = new Logger(config.debugLoggerOptions);
export const soundcloud = new Soundcloud();

export const queues: Collection<string, Queue> = new Collection();
export const experimentalServers: Set<string> = new Set();

export const ytDlpWrap = new YtDlp(config.ytdlpPath);

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

(async () => {
    if (!fs.existsSync(config.ytdlpPath)) {
        try {
            await YtDlp.downloadFromGithub(config.ytdlpPath);
            
            logger.debug(`Downloaded yt-dlp to ${config.ytdlpPath}`);

            await new Promise(resolve => setTimeout(resolve, 1000)); // waiting for file to stabilize
        } catch (error) {
            logger.error(error);
        }
    }

    logger.debug(`Using Yt-dlp version ${(await ytDlpWrap.getVersion()).trim()}`);
})();