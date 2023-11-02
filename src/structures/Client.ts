import { ApplicationCommandDataResolvable, Client, ClientOptions, Collection } from 'discord.js';
import { globSync } from 'glob';
import { Command, BotCommands } from '../typings/Commands';
import { DjsClientEvent } from './DjsClientEvent';
import { logger } from '..';
import { Agent } from 'undici';
import { AutomatedInteractionType } from '../typings/automatedInteraction';
import { botSettingsDB } from '../database/botSettings';
import { DjsRestEvent } from './DjsRestEvent';
import chalk from 'chalk';
__dirname = __dirname.replace(/\\/g, '/');

interface importedWithDefault<T> {
    default: T;
}

export class ExtendedClient extends Client {
    public commands: BotCommands = {
        payload: {
            allCommands: [],
            global: [],
        },
        commandsExecutable: new Collection(),
    }

    public automatedInteractions: Collection<string, AutomatedInteractionType> = new Collection();

    constructor(clientOptions: ClientOptions) {
        super(clientOptions);

        this.rest.setAgent(new Agent({
            connect: {
                timeout: 30000,
            },
        }));

        this.init();
    }

    private async init() {
        const defaultCommands = globSync(`${__dirname}/../commands/default/*{.js,.ts}`, { absolute: true, });
        const devCommands = globSync(`${__dirname}/../commands/dev/*{.js,.ts}`, { absolute: true, });
        const disabledCommands: Command[] = [];

        const djsClientEvents = globSync(`${__dirname}/../events/discord.js-client/*{.js,.ts}`, { absolute: true, });
        const djsRestEvents = globSync(`${__dirname}/../events/discord.js-rest/*{.js,.ts}`, { absolute: true, });

        const loadPromises: Promise<any>[] = [];

        logger.log({
            level: 'init',
            message: `Found ${chalk.bold(defaultCommands.length)} default commands`,
            color: 'blue',
        });

        logger.log({
            level: 'init',
            message: `Found ${chalk.bold(devCommands.length)} dev commands`,
            color: 'blue',
        });

        logger.log({
            level: 'init',
            message: `Found ${chalk.bold(djsClientEvents.length)} Discord.js Client events`,
            color: 'blue',
        });

        logger.log({
            level: 'init',
            message: `Found ${chalk.bold(djsRestEvents.length)} Discord.js REST events`,
            color: 'blue',
        });

        const importCommandsPromises: Promise<importedWithDefault<Command>>[] = [];

        defaultCommands.concat(devCommands).forEach(commandPath => {
            const importPromise = import(commandPath);
            importCommandsPromises.push(importPromise);
            loadPromises.push(importPromise);
        });

        Promise.allSettled(importCommandsPromises).then(resoults => {
            resoults.forEach(resoult => {
                if (resoult.status === 'fulfilled') {
                    const command = resoult.value.default;
                    const commandName = command.data.name;

                    logger.debug(`Loaded ${commandName}`);

                    if (!command.disabled) {
                        this.commands.commandsExecutable.set(commandName, command);
                        this.commands.payload.allCommands.push(command.data);
                        if (command.global) this.commands.payload.global.push(command.data);
                    } else disabledCommands.push(command);
                } else {
                    logger.error(resoult.reason);
                }
            });
        });

        const importDjsClientEventsPromises: Promise<importedWithDefault<DjsClientEvent>>[] = [];

        djsClientEvents.forEach(eventPath => {
            const importPromise = import(eventPath)
            importDjsClientEventsPromises.push(importPromise);
            loadPromises.push(importPromise);
        });

        Promise.allSettled(importDjsClientEventsPromises).then(resoults => {
            resoults.forEach(resoult => {
                if (resoult.status === 'fulfilled') {
                    const event = resoult.value.default;
                    logger.debug(`Loaded ${event.name}`);

                    if (event.runOnce) this.once(event.name, event.run);
                    else this.on(event.name, event.run);
                } else {
                    logger.error(resoult.reason);
                }
            });
        });

        const importDjsRestEventsPromises: Promise<importedWithDefault<DjsRestEvent>>[] = [];

        djsRestEvents.forEach(eventPath => {
            const importPromise = import(eventPath)
            importDjsRestEventsPromises.push(importPromise);
            loadPromises.push(importPromise);
        });

        Promise.allSettled(importDjsRestEventsPromises).then(resoults => {
            resoults.forEach(resoult => {
                if (resoult.status === 'fulfilled') {
                    const event = resoult.value.default;
                    logger.debug(`Loaded ${event.name}`);

                    if (event.runOnce) this.rest.once(event.name, event.run);
                    else this.rest.on(event.name, event.run);
                } else {
                    logger.error(resoult.reason);
                }
            });
        });

        const loadedResoults = await Promise.allSettled(loadPromises);
        let loadedSuccessfully = 0
        let failedToLoad = 0

        loadedResoults.forEach(resoult => {
            if (resoult.status === 'fulfilled') loadedSuccessfully++;
            else failedToLoad++;
        });
        
        if (failedToLoad === 0) {
            logger.log({
                level: 'init',
                message: `Successfully loaded all ${loadedSuccessfully} submodules`,
                color: 'greenBright',
            });
        } else {
            logger.log({
                level: 'init',
                message: `Failed to load ${failedToLoad} submodules`,
                color: 'bgRedBright',
            });
        }
    }

    public start() {
        logger.debug('Starting client...');
        this.login(process.env.ENV === 'prod' ? process.env.DISCORDBOT_TOKEN : process.env.DISCORDBOT_DEV_TOKEN);
        logger.debug('Client started');
    }

    public updatePresence() {
        const { status, online, } = botSettingsDB.get(process.env.ENV);
        logger.debug('Updated presence');

        this.user.setPresence({
            activities: status.visible ? status.data : [],
            status: online ? 'online' : 'idle',
        });
    }

    public async registerGlobalCommands(commands: ApplicationCommandDataResolvable[]) {
        return new Promise((resolve, reject) => {
            this.application.commands.set(commands)
                .then(res => resolve(logger.log({ level: 'info', message: `Globally registered ${res.size} commands`, color: 'gray', })))
                .catch(err => { logger.error(err) });
        });
    }

    public async registerCommands(commands: ApplicationCommandDataResolvable[], guild: string, silent = true) {
        return new Promise(async (resolve, reject) => {
            (await this.guilds.fetch(guild)).commands.set(commands)
                .then(res => resolve(logger.log({ level: 'info', message: `Registered ${res.size} commands to ${guild}`, silent, })))
                .catch(err => { logger.error(err) });
        });
    }
}