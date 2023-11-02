import { UserApplicationCommandData, UserContextMenuCommandInteraction } from 'discord.js';
import { LoggerThread } from 'log4uwu';
import { Queue } from '../structures/Queue';

interface RunOptions {
    interaction: UserContextMenuCommandInteraction;
    logger: LoggerThread;
    queue: Queue;
}

type RunFunction = (options: RunOptions) => Promise<any>;

export type UserCommandType = {
    data: UserApplicationCommandData;
    disabled?: boolean;
    global?: boolean;
    dev?: boolean;
    nsfw?: boolean;
    vcOnly?: boolean;
    queueRequired?: boolean;
    experimental?: boolean;
    run: RunFunction;
};