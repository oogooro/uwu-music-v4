import { ClientOptions, IntentsBitField, Partials } from 'discord.js';
import { LoggerOptions } from 'log4uwu';
import moment from 'moment';
import { botSettingsDB } from './database/botSettings';

const intentFlags = IntentsBitField.Flags;

const botSettings = botSettingsDB.get(process.env.ENV);

export const clientOptions: ClientOptions = {
        intents: [intentFlags.Guilds, intentFlags.GuildVoiceStates, intentFlags.GuildMessages],
        partials: [Partials.Message],
        presence: {
            activities: botSettings.status.visible ? botSettings.status.data : [],
            status: botSettings.online ? 'online' : 'idle',
        },
        rest: { timeout: 30_000, },
    }

export const loggerOptions: LoggerOptions = {
        transports: [
            `${__dirname}/../logs/${moment(new Date()).format('D-M-YY-HH-mm-ss')}-${process.env.ENV}.log`,
            `${__dirname}/../logs/latest-${process.env.ENV}.log`,
        ],
        debugMode: process.env.DEBUG_MODE === '1',
    }

export const debugLoggerOptions: LoggerOptions = {
        transports: [
            `${__dirname}/../logs/debug/${moment(new Date()).format('D-M-YY-HH-mm-ss')}-debug-${process.env.ENV}.log`,
            `${__dirname}/../logs/debug/latest-debug-${process.env.ENV}.log`,
        ],
    }

export const embedColor = process.env.ENV === 'prod' ? 0x8b05aa : 0x000095;