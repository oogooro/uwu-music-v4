import { ApplicationCommandDataResolvable, Client, ClientEvents, ClientOptions, Collection, RestEvents } from 'discord.js';
import { glob } from 'glob';
import { Command, BotCommands } from '../typings/commandManager';
import { DjsClientEvent } from './DjsClientEvent';
import { logger } from '..';
import { Agent } from 'undici';
import { AutomatedInteractionType } from '../typings/automatedInteraction';
import { botSettingsDB } from '../database/botSettings';
import { DjsRestEvent } from './DjsRestEvent';

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
        const defaultCommands: string[] = await glob(`${__dirname}/../commands/default/*{.ts,.js}`.replace(/\\/g, '/'));
        const privateCommands: string[] = await glob(`${__dirname}/../commands/private/*{.ts,.js}`.replace(/\\/g, '/'));

        logger.log({
            level: 'init',
            message: `Found ${defaultCommands.length} default commands`,
            color: 'blueBright',
        });

        defaultCommands.forEach(async (defaultCommandPath: string) => {
            const command: Command = await this.importFile(defaultCommandPath);

            if (!command?.data || command.disabled) return;
            if (command.dev && process.env.ENV !== 'dev') return;
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
            const command: Command = await this.importFile(privateCommandPath);

            if (!command?.data || command.disabled) return;
            if (command.dev && process.env.ENV !== 'dev') return;
            command.private = true;
            this.commands.commandsExecutable.set(command.data.name, command);
            this.commands.payload.allCommands.push(command.data);
        });

        const djsClientEventFiles: string[] = await glob(`${__dirname}/../events/discord.js-Client/*{.ts,.js}`.replace(/\\/g, '/'));

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

        const djsRestEventFiles: string[] = await glob(`${__dirname}/../events/discord.js-Rest/*{.ts,.js}`.replace(/\\/g, '/'));

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

        const automatedInteractionFiles: string[] = await glob(`${__dirname}/../automated/*{.ts,.js}`.replace(/\\/g, '/'));

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