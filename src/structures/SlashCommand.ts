import { SlashCommandType } from '../typings/slashCommand';

export class SlashCommand {
    constructor(commandOptions: SlashCommandType) {
        Object.assign(this, commandOptions);
    }
}