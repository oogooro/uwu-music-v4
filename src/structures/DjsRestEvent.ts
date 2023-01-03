import { RestEvents } from 'discord.js';

export class DjsRestEvent<Key extends keyof RestEvents> {
    constructor(
        public name: Key,
        public run: (...args: RestEvents[Key]) => Promise<any>,
        public runOnce?: boolean,
    ) { }
}