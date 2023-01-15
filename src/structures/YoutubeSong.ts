import { User } from 'discord.js';
import { video_basic_info, YouTubeVideo } from 'play-dl';
import { SongData } from '../typings/song';
import { SongChapterMetadata } from '../typings/songChatperMetadata';
import { SongUploaderMetadata } from '../typings/songUploaderMetadata';
import { Song } from './Song';

function isYouTubeVideo(object: any): object is YouTubeVideo {
    return 'durationRaw' in object;
}

export class YoutubeSong extends Song {
    public thumbnail: string;
    public uploader: SongUploaderMetadata;
    public live: boolean;
    public upcoming: boolean;
    public ageRestricted: boolean;
    public chapters: SongChapterMetadata[];
    public partial = true;
    public id: string;

    constructor(metadata: SongData | YouTubeVideo, addedByUser: User) {
        let data: SongData;
        if (isYouTubeVideo(metadata)) {
            data = {
                title: metadata.title,
                url: metadata.url,
                duration: metadata.durationInSec - 2,
            }
        } else data = metadata;

        super(data, addedByUser);

        if (isYouTubeVideo(metadata)) this.patch(metadata);
    }

    public patch(metadata?: YouTubeVideo): Promise<void> {
        if (metadata) {
            this.partial = false;

            this.thumbnail = metadata.thumbnails.at(-1).url;
            this.uploader = {
                channel: metadata.channel.name,
                url: metadata.channel.url,
            }
            this.live = metadata.live;
            this.chapters = metadata.chapters?.map(ch => { return { startTime: ch.seconds, title: ch.title } }) ?? null;
            this.ageRestricted = metadata.discretionAdvised;
            this.upcoming = !!metadata.upcoming;
            this.id = metadata.id;

            if (metadata.live) this.formatedDuration = 'LIVE';
            else if (metadata.upcoming) this.formatedDuration = 'UPCOMING';
            return new Promise((resolve) => resolve());
        }

        return new Promise(async (resolve, reject) => {
            video_basic_info(this.url)
                .then(info => {
                    this.patch(info.video_details)
                        .then(resolve)
                        .catch(reject);
                })
                .catch(reject);
        });
    }
}