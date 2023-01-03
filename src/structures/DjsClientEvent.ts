import { ClientEvents } from 'discord.js';

export class DjsClientEvent<Key extends keyof ClientEvents> {
    constructor(
        public name: Key,
        public run: (...args: ClientEvents[Key]) => Promise<any>,
        public runOnce?: boolean,
    ) { }
}