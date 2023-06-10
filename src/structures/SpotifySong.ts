import { User } from 'discord.js';
import { Song } from './Song';
import { SpotifyTrack } from 'play-dl';
import { YoutubeSong } from './YoutubeSong';
import ytsr from 'ytsr';
import { formatedTimeToSeconds } from '../utils';

export class SpotifySong extends Song {
    youtubeEquivalent?: YoutubeSong;
    thumbnail: string;
    artist: string;

    constructor(metadata: SpotifyTrack, addedByUser: User) {
        super({
           title: metadata.name,
           url: metadata.url,
           duration: metadata.durationInSec,
        }, addedByUser);

        this.thumbnail = metadata.thumbnail?.url;
        this.artist = metadata.artists[0].name;
    }

    async getYoutubeEquivalent(): Promise<YoutubeSong> {
        if (this.youtubeEquivalent) return this.youtubeEquivalent;

        const filters = await ytsr.getFilters(`${this.title} ${this.artist}`);
        const filterVideos = filters.get('Type').get('Video');

        const ytSearch = await ytsr(filterVideos.url, { limit: 5, });

        const videos = (ytSearch.items.filter(i => i.type === 'video') as ytsr.Video[]).reverse();

        const closest = videos.reduce((prev, curr) => Math.abs((formatedTimeToSeconds(curr.duration) - 1) - this.duration) < Math.abs((formatedTimeToSeconds(prev.duration) - this.duration) - 1) ? curr : prev);

        const song = new YoutubeSong({
            title: closest.title,
            duration: formatedTimeToSeconds(closest.duration),
            url: closest.url,
        }, this.addedBy);

        this.duration = song.duration;
        this.youtubeEquivalent = song;
        return song;
    }
}