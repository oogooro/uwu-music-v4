import { MessageApplicationCommandData, MessageContextMenuCommandInteraction } from 'discord.js';
import { LoggerThread } from 'log4uwu';
import { Queue } from '../structures/Queue';

interface RunOptions {
    interaction: MessageContextMenuCommandInteraction;
    logger: LoggerThread;
    queue: Queue;
}

type RunFunction = (options: RunOptions) => Promise<any>;

export type MessageCommandType = {
    data: MessageApplicationCommandData;
    disabled?: boolean;
    global?: boolean;
    dev?: boolean;
    private?: boolean;
    nsfw?: boolean;
    vcOnly?: boolean;
    queueRequired?: boolean;
    run: RunFunction;
};