import { ApplicationCommandDataResolvable, Collection } from 'discord.js';
import { MessageCommandType } from './messageCommand';
import { SlashCommandType } from './slashCommand';
import { UserCommandType } from './userCommand';

export type Command = SlashCommandType | UserCommandType | MessageCommandType;

export interface BotCommands {
    payload: {
        allCommands: ApplicationCommandDataResolvable[];
        global: ApplicationCommandDataResolvable[];
    };
    commandsExecutable: Collection<string, Command>;
}