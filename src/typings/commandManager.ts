import { ApplicationCommandDataResolvable, Collection } from 'discord.js';
import { MessageCommandType } from './messageCommand';
import { SlashCommandType } from './slashCommand';
import { UserCommandType } from './userCommand';

export interface CommandCategory {
    manifest: CommandCategoryManifest;
    commands: ApplicationCommandDataResolvable[];
}

export interface CommandCategoryManifest {
    displayName: string;
    description: string;
    emoji: string;
    hidden?: boolean;
    nsfw?: boolean;
}

export type BotCommand = SlashCommandType | UserCommandType | MessageCommandType;

export interface CommandManager {
    payload: {
        categories: Collection<string, CommandCategory>;
        allCommands: ApplicationCommandDataResolvable[];
        global: ApplicationCommandDataResolvable[];
    };
    commandsExecutable: Collection<string, BotCommand>;
}