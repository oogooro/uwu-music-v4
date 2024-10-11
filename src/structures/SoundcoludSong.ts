import { User } from 'discord.js';
import { SongData } from '../typings/song';
import { Song } from './Song';
import { SoundcloudTrack } from 'soundcloud.ts';
import { soundcloud } from '..';

function isSoundCloudTrack(object: SongData | SoundcloudTrack): object is SoundcloudTrack {
    return 'permalink_url' in object;
}

export class SoundcloudSong extends Song {
    public thumbnail: string;
    public id: string;
    public partial: boolean = true;
    public uploader: string;

    constructor(metadata: SongData | SoundcloudTrack, addedByUser: User) {
        let data: SongData;
        if (isSoundCloudTrack(metadata)) {
            data = {
                url: metadata.permalink_url,
                duration: metadata.duration / 1000,
                title: metadata.title,
            }
        }
        else data = metadata;

        super(data, addedByUser);

        if (isSoundCloudTrack(metadata)) this.patch(metadata);
    }

    public patch(metadata?: SoundcloudTrack): Promise<void> {
        if (metadata) {
            this.partial = false;

            this.thumbnail = metadata.artwork_url;
            this.uploader = metadata.user.username;

            return new Promise((resolve) => resolve());
        }

        return new Promise(async (resolve, reject) => {
            soundcloud.tracks.get(this.url)
                .then(info => {
                    this.patch(info)
                        .then(resolve)
                        .catch(reject);
                })
                .catch(reject);
        });
    }

}