import { User } from 'discord.js';
import { SongData } from '../typings/song';
import { Song } from './Song';
import { SoundcloudTrackV2 } from 'soundcloud.ts';
import { soundcloud } from '..';

function isSoundCloudTrack(object: SongData | SoundcloudTrackV2): object is SoundcloudTrackV2 {
    return 'permalink_url' in object;
}

export class SoundcloudSong extends Song {
    public thumbnail: string;
    public id: string;
    public partial: boolean = true;

    constructor(metadata: SongData | SoundcloudTrackV2, addedByUser: User) {
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

    public patch(metadata?: SoundcloudTrackV2): Promise<void> {
        if (metadata) {
            this.partial = false;

            this.thumbnail = metadata.artwork_url;

            return new Promise((resolve) => resolve());
        }

        return new Promise(async (resolve, reject) => {
            soundcloud.tracks.getV2(this.url)
                .then(info => {
                    this.patch(info)
                        .then(resolve)
                        .catch(reject);
                })
                .catch(reject);
        });
    }

}