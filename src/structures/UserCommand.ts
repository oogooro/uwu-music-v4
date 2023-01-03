import { ApplicationCommandType } from 'discord.js';
import { UserCommandType } from '../typings/userCommand';

export class UserCommand {
    constructor(commandOptions: UserCommandType) {
        commandOptions.data.type = ApplicationCommandType.User;
        Object.assign(this, commandOptions);
    }
}