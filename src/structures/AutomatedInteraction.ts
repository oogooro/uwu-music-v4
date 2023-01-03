import { AutomatedInteractionType } from '../typings/automatedInteraction';

export class AutomatedInteraction {
    constructor(options: AutomatedInteractionType) {
        Object.assign(this, options);
    }
}