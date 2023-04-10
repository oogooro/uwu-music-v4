import { User } from 'discord.js';
import { SongData } from '../typings/song';
import { formatTimeDisplay } from '../utils';

export class Song {
    public title: string;
    public addedBy: User;
    public duration: number;
    public formatedDuration: string;
    public url: string;
    public volume: number = 0.5;

    constructor(metadata: SongData, addedByUser: User) {
        this.title = metadata.title;
        this.addedBy = addedByUser;
        this.duration = metadata.duration
        this.url = metadata.url;
        this.formatedDuration = formatTimeDisplay(metadata.duration);
    }
}