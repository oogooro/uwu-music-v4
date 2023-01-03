import { ApplicationCommandDataResolvable, Client, ClientEvents, ClientOptions, Collection, RestEvents } from 'discord.js';
import glob from 'glob';
import { promisify } from 'node:util';
import { BotCommand, CommandCategoryManifest, CommandManager } from '../typings/commandManager';
import { DjsClientEvent } from './DjsClientEvent';
import { logger } from '..';
import { Agent } from 'undici';
import { AutomatedInteractionType } from '../typings/automatedInteraction';
import { botSettingsDB } from '../database/botSettings';
import { DjsRestEvent } from './DjsRestEvent';

const globPromise = promisify(glob);

export class ExtendedClient extends Client {
    public commands: CommandManager = {
        payload: {
            categories: new Collection(),
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
    }

    public start() {
        logger.debug('Starting client...');
        this.init();
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

    public async registerCommandsGlobally(commands: ApplicationCommandDataResolvable[]) {
        return new Promise((resolve, reject) => {
            this.application.commands.set(commands)
                .then(res => resolve(logger.log({ level: 'info', message: `Globally registered ${res.size} commands`, color: 'gray', })))
                .catch(reject);
        });
    }

    public async registerCommands(commands: ApplicationCommandDataResolvable[], guild: string, silent = true) {
        return new Promise(async (resolve, reject) => {
            (await this.guilds.fetch(guild)).commands.set(commands)
                .then(res => resolve(logger.log({ level: 'info', message: `Registered ${res.size} commands to ${guild}`, silent, })))
                .catch(reject);
        });
    }

    private async importFile(filePath: string) {
        return (await import(filePath).catch(err => logger.error(err)))?.default;
    }

    private async init() {
        const commandCategories: string[] = await globPromise(`${__dirname}/../commands/categories/*`.replace(/\\/g, '/'));
        const defaultCommands: string[] = await globPromise(`${__dirname}/../commands/default/*{.ts,.js}`.replace(/\\/g, '/'));
        const privateCommands: string[] = await globPromise(`${__dirname}/../commands/private/*{.ts,.js}`.replace(/\\/g, '/'));

        logger.log({
            level: 'init',
            message: `Found ${defaultCommands.length} default commands`,
            color: 'blueBright',
        });

        defaultCommands.forEach(async (defualtCommandPath: string) => {
            const command: BotCommand = await this.importFile(defualtCommandPath);

            if (!command?.data || command.disabled) return;
            command.global = true;
            this.commands.commandsExecutable.set(command.data.name, command);
            this.commands.payload.global.push(command.data);
            this.commands.payload.allCommands.push(command.data);
        });

        logger.log({
            level: 'init',
            message: `Found ${privateCommands.length} private commands`,
            color: 'blueBright',
        });

        privateCommands.forEach(async (privateCommandPath: string) => {
            const command: BotCommand = await this.importFile(privateCommandPath);

            if (!command?.data || command.disabled) return;
            command.dev = true;
            this.commands.commandsExecutable.set(command.data.name, command);
            this.commands.payload.allCommands.push(command.data);
        });

        logger.log({
            level: 'init',
            message: `Found ${commandCategories.length} command categories`,
            color: 'blueBright',
        });

        commandCategories.forEach(async (commandCategoryFolderPath: string) => {
            const currentCategoryName = commandCategoryFolderPath.split('/').pop();
            const commandCategoryFolderFiles: string[] = await globPromise(`${commandCategoryFolderPath}/*{.ts,.js}`);
            const categoryManifest: CommandCategoryManifest = await this.importFile((await globPromise(`${commandCategoryFolderPath}/manifest.*`))[0]);

            const category = this.commands.payload.categories.has(currentCategoryName) ?
                this.commands.payload.categories.get(currentCategoryName) :
                {
                    manifest: categoryManifest,
                    commands: [],
                }

            commandCategoryFolderFiles.forEach(async (commandPath) => {
                const command: BotCommand = await this.importFile(commandPath);

                if (!command?.data || command.disabled) return;
                if (categoryManifest?.nsfw) command.nsfw = true;

                category.commands.push(command.data);
                this.commands.payload.categories.set(currentCategoryName, category);
                this.commands.commandsExecutable.set(command.data.name, command);
                this.commands.payload.allCommands.push(command.data);
            });
        });

        const djsClientEventFiles: string[] = await globPromise(`${__dirname}/../events/discord.js-Client/*{.ts,.js}`.replace(/\\/g, '/'));

        logger.log({
            level: 'init',
            message: `Found ${djsClientEventFiles.length} Discord.js Client event files`,
            color: 'blueBright',
        });

        djsClientEventFiles.forEach(async (eventPath: string) => {
            const event: DjsClientEvent<keyof ClientEvents> = await this.importFile(eventPath);

            if (!event?.name) return;
            if (event.runOnce) this.once(event.name, event.run);
            else this.on(event.name, event.run);
        });

        const djsRestEventFiles: string[] = await globPromise(`${__dirname}/../events/discord.js-Rest/*{.ts,.js}`.replace(/\\/g, '/'));

        logger.log({
            level: 'init',
            message: `Found ${djsRestEventFiles.length} Discord.js Rest event files`,
            color: 'blueBright',
        });

        djsRestEventFiles.forEach(async (eventPath: string) => {
            const event: DjsRestEvent<keyof RestEvents> = await this.importFile(eventPath);

            if (!event?.name) return;
            if (event.runOnce) this.rest.once(event.name, event.run);
            else this.rest.on(event.name, event.run);
        });

        const automatedInteractionFiles: string[] = await globPromise(`${__dirname}/../automated/*{.ts,.js}`.replace(/\\/g, '/'));

        logger.log({
            level: 'init',
            message: `Found ${automatedInteractionFiles.length} automated interactions files`,
            color: 'blueBright',
        });

        automatedInteractionFiles.forEach(async (automatedInteractionFilePath: string) => {
            const automatedInteraction: AutomatedInteractionType = await this.importFile(automatedInteractionFilePath);
            this.automatedInteractions.set(automatedInteraction.name, automatedInteraction);
        });
    }
}