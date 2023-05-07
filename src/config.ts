import { ClientOptions, IntentsBitField, Partials } from 'discord.js';
import { LoggerOptions } from 'log4uwu';
import moment from 'moment';
import { botSettingsDB } from './database/botSettings';
import { join } from 'node:path';

type Config = {
    clientOptions: ClientOptions;
    loggerOptions: LoggerOptions;
    debugLoggerOptions: LoggerOptions;
    embedColor: number;
    ytdlpPath: string;
}

const intentFlags = IntentsBitField.Flags;

const botSettings = botSettingsDB.get(process.env.ENV);

const config: Config = {
    clientOptions: {
        intents: [intentFlags.Guilds, intentFlags.GuildVoiceStates, intentFlags.GuildMessages],
        partials: [Partials.Message],
        presence: {
            activities: botSettings.status.visible ? botSettings.status.data : [],
            status: botSettings.online ? 'online' : 'idle',
        }
    },
    loggerOptions: {
        transports: [
            `${__dirname}/../logs/${moment(new Date()).format('D-M-YY-HH-mm-ss')}-${process.env.ENV}.log`,
            `${__dirname}/../logs/latest-${process.env.ENV}.log`,
        ],
        debugMode: process.env.DEBUG_MODE === '1',
    },
    debugLoggerOptions: {
        transports: [
            `${__dirname}/../logs/debug/${moment(new Date()).format('D-M-YY-HH-mm-ss')}-debug-${process.env.ENV}.log`,
            `${__dirname}/../logs/debug/latest-debug-${process.env.ENV}.log`,
        ],
    },
    embedColor: 0x8b05aa,
    ytdlpPath: join(__dirname, '../bin/yt-dlp'),
}

export default config; 