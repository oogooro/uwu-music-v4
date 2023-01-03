import { ApplicationCommandType, MessageApplicationCommandData } from 'discord.js';
import { MessageCommandType } from '../typings/messageCommand';

export class MessageCommand {
    constructor(commandOptions: MessageCommandType) {
        (commandOptions.data as MessageApplicationCommandData).type = ApplicationCommandType.Message;
        Object.assign(this, commandOptions);
    }
}