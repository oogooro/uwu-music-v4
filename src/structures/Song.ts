import { User } from 'discord.js';
import { SongData } from '../typings/song';

export class Song {
    public title: string;
    public addedBy: User;
    public duration: number;
    public url: string;

    constructor(metadata: SongData, addedByUser: User) {
        this.title = metadata.title;
        this.addedBy = addedByUser;
        this.duration = metadata.duration
        this.url = metadata.url;
    }
}