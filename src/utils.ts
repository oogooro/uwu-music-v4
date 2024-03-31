import { ActionRowBuilder, APIEmbed, ButtonBuilder, ComponentType, escapeMarkdown, hyperlink, Interaction, InteractionResponse, InteractionType, Message, StringSelectMenuBuilder, User } from 'discord.js';
import ytsr, { Video } from 'ytsr';
import { logger, soundcloud } from '.';
import { embedColor } from './config';
import { Song } from './structures/Song';
import { SoundcloudSong } from './structures/SoundcoludSong';
import { YoutubeSong } from './structures/YoutubeSong';
import { SpotifySong } from './structures/SpotifySong';
import ytdl from 'ytdl-core';
import ytpl from 'ytpl';
import play, { SpotifyAlbum, SpotifyPlaylist, SpotifyTrack, video_basic_info, YouTubeVideo } from 'play-dl';
import { SoundcloudTrackV2 } from 'soundcloud.ts';
import { SongData } from './typings/song';

export function generateInteractionTrace(interaction: Interaction): string {
    const place = interaction.guildId || 'DM';
    if (interaction.type === InteractionType.ApplicationCommand || interaction.type === InteractionType.ApplicationCommandAutocomplete) return `${place}/${interaction.user.id}/${interaction.commandName}`;
    else if (interaction.type === InteractionType.MessageComponent || interaction.type === InteractionType.ModalSubmit) return `${place}/${interaction.user.id}/${interaction.customId}`;
}

export function songToDisplayString(song: Song, short: boolean = false): string {
    song.title = song.title.replace(/([\uE000-\uF8FF]|\uD83C[\uDF00-\uDFFF]|\uD83D[\uDC00-\uDDFF])/g, ''); // strip emojis because they fuck things up
    let displayString = `${hyperlink(escape(trimString(song.title, 53)), song.url, song.title.length >= 53 ? escape(song.title) : null)}`;

    if (short) return displayString;
    else return `${displayString} - \`${song.formatedDuration}\`\n(dodane przez <@${song.addedBy.id}>)`;
}

export function formatTimeDisplay(totalSeconds: number): string {
    if (totalSeconds === -1) return '00:00';

    const hours = Math.floor(totalSeconds / 60 / 60);
    const minutes = Math.floor(totalSeconds / 60) % 60;
    const seconds = Math.floor(totalSeconds - minutes * 60 - hours * 3600);

    function padTo2Digits(num: number): string {
        return num.toString().padStart(2, '0');
    }

    return `${hours ? `${hours}:` : ''}${padTo2Digits(minutes)}:${padTo2Digits(seconds)}`;
}

export function trimString(s: string, length: number): string {
    return s.length > length ? s.substring(0, length - 3).trim() + '...' : s;
}

export function formatedTimeToSeconds(time: string): number {
    if (!time) return -1;
    const [sec, min, hour] = time.split(':').reverse();

    const secs = ((parseInt(hour) * 3600) || 0) + ((parseInt(min) * 60) || 0) + (parseInt(sec));

    if (isNaN(secs) || secs < 0) return -1;
    return secs;
}

export function escape(s: string): string {
    return escapeMarkdown(s)
        .replaceAll('[', '［')
        .replaceAll(']', '］');
}

export function createSongEmbed(title: string, song: Song, additionalInfo?: string[]): APIEmbed[] {
    const embed: APIEmbed[] = [{
        title: title,
        thumbnail: {
            url: song instanceof YoutubeSong || song instanceof SoundcloudSong || song instanceof SpotifySong ? song.thumbnail : null,
        },
        description: songToDisplayString(song) + (additionalInfo?.length ? '\n\n' + additionalInfo.join('\n') : ''),
        color: embedColor,
    }]

    return embed;
}

interface searchResult {
    songsYT: Song[];
    songsSC: Song[];
    embedYT: string;
    embedSC: string;
}

/**
 * fucking dumbster fire,
 * use at your own risk
 */
export async function searchSongs(query: string, user: User): Promise<searchResult> {
    const SEARCH_ENTRIES_LIMIT = 10;

    const searchResults: searchResult = {
        songsYT: [],
        songsSC: [],
        embedYT: '',
        embedSC: '',
    };
    
    try {
        const filters = await ytsr.getFilters(query);
        const filterVideos = filters.get('Type').get('Video');

        const ytSearchPromise = ytsr(filterVideos.url, { limit: Math.floor(SEARCH_ENTRIES_LIMIT * 1.5), });
        const scSearchPromise = soundcloud.tracks.searchV2({ q: query, limit: SEARCH_ENTRIES_LIMIT, });

        return Promise.all([ ytSearchPromise, scSearchPromise ]).then(([ ytSearch, scSearch ]) => {
            if (!ytSearch.results) throw new Error('No videos found');
            
            const videos = ytSearch.items.filter(i => i.type === 'video').splice(0, SEARCH_ENTRIES_LIMIT) as Video[];
            
            videos.forEach((item: Video, index) => {
                const song = new YoutubeSong({ duration: formatedTimeToSeconds(item.duration), title: item.title, url: item.url }, user);
                searchResults.songsYT.push(song);
                searchResults.embedYT += `${index + 1}. ${songToDisplayString(song, true)} - \`${item.isUpcoming ? 'UPCOMING' : (item.duration ? item.duration : 'LIVE')}\`\n${escape(item.author.name)}\n\n`;
            });
    
            if (!scSearch && !scSearch.total_results) throw new Error('No tracks found');
    
            scSearch.collection.forEach((track, index) => {
                const song = new SoundcloudSong(track, user);
                searchResults.songsSC.push(song);
                searchResults.embedSC += `${index + 1}. ${songToDisplayString(song, true)} - \`${song.formatedDuration}\`\n${escape(song.uploader)}\n\n`;
            });
            return searchResults;
        });
    } catch (err) {
        throw err;
    }
}

export const getUrlsFromMessage = (message: Message): string[] => {
    const urlRe = /(\b(https?):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;

    const urlsFound: string[] = [
        ...(message.content.match(urlRe) ?? []),
        ...(message.embeds[0]?.url?.match(urlRe) ?? []),
        ...(message.embeds[0]?.description?.match(urlRe) ?? []),
    ]

    return [...new Set(urlsFound)]; // dedupe
}

interface PlayableItemYoutubeSong {
    type: 'youtubeSong';
    title: string;
    url: string;
    data: YouTubeVideo;
    source: 'YouTube';
}

interface PlayableItemYoutubePlaylist {
    type: 'youtubePlaylist';
    title: string;
    url: string;
    data: SongData[];
    thumbnailUrl: string;
    source: 'YouTube';
}

interface PlayableItemSoundcloudTrack {
    type: 'soundcloudTrack';
    title: string;
    url: string;
    data: SoundcloudTrackV2;
    source: 'SoundCloud';
}

interface PlayableItemSoundcloudPlaylist {
    type: 'soundcloudPlaylist';
    title: string;
    url: string;
    data: SoundcloudTrackV2[];
    thumbnailUrl: string;
    source: 'SoundCloud';
}

interface PlayableItemSpotifySong {
    type: 'spotifySong';
    title: string;
    url: string;
    data: SpotifyTrack;
    source: 'Spotify';
}

interface PlayableItemSpotifyPlaylist {
    type: 'spotifyPlaylist';
    title: string;
    url: string;
    data: SpotifyTrack[];
    thumbnailUrl: string;
    source: 'Spotify';
}

type PlayableItem = PlayableItemYoutubeSong |
                    PlayableItemYoutubePlaylist |
                    PlayableItemSoundcloudTrack |
                    PlayableItemSoundcloudPlaylist |
                    PlayableItemSpotifySong | 
                    PlayableItemSpotifyPlaylist;

export const resolveSong = async (url: string): Promise<PlayableItem | null> => {
    if (ytdl.validateURL(url)) { // YouTube video
        const info = await video_basic_info(url).catch(err => { logger.error(err); });
        if (!info) return null;

        return {
            type: 'youtubeSong',
            title: info.video_details.title,
            data: info.video_details,
            source: 'YouTube',
            url,
        }
    } else if (ytpl.validateID(url)) { // YouTube playlist
        const playlistInfo = await ytpl(url, { limit: Infinity, }).catch(err => { logger.error(err) });
        if (!playlistInfo) return null;
        if (!playlistInfo.items.length) return null;

        return {
            type: 'youtubePlaylist',
            title: playlistInfo.title,
            data: playlistInfo.items.map(item => { return { url: item.url, title: item.title, duration: item.durationSec, } }),
            thumbnailUrl: playlistInfo.bestThumbnail.url,
            source: 'YouTube',
            url,
        }
    } else if (url.startsWith('https://soundcloud.com/')) { // SoundCloud
        if (url.startsWith('https://soundcloud.com/playlist') || url.match(/https:\/\/soundcloud\.com\/\S*sets\/\S*/g)) { // SoundCloud playlist or set
            const playlistInfo = await soundcloud.playlists.getV2(url).catch(err => { logger.error(err) });
            if (!playlistInfo) return null;
            if (!playlistInfo.tracks.length) return null;

            return {
                type: 'soundcloudPlaylist',
                title: playlistInfo.title,
                data: playlistInfo.tracks,
                thumbnailUrl: playlistInfo.artwork_url,
                source: 'SoundCloud',
                url,
            }
        } else { // SoundCloud track
            const songInfo = await soundcloud.tracks.getV2(url).catch(err => { logger.error(err) });
            if (!songInfo) return null;

            return {
                type: 'soundcloudTrack',
                title: songInfo.title,
                data: songInfo,
                source: 'SoundCloud',
                url,
            }
        }
    } else if (url.startsWith('https://open.spotify.com/')) {
        if (play.is_expired()) await play.refreshToken();

        const spotData = await play.spotify(url).catch(err => { logger.error(err) });
        if (!spotData) return null;

        if (spotData.type === 'track') {
            return {
                type: 'spotifySong',
                title: spotData.name,
                data: spotData as SpotifyTrack,
                source: 'Spotify',
                url,
            }
        } else {
            const spotAlbumOrPlaylist = (spotData as SpotifyAlbum | SpotifyPlaylist);
            const tracks = await spotAlbumOrPlaylist.all_tracks();

            return {
                type: 'spotifyPlaylist',
                title: spotAlbumOrPlaylist.name,
                data: tracks,
                thumbnailUrl: spotAlbumOrPlaylist.thumbnail.url,
                source: 'Spotify',
                url,
            }
        }

    } else {
        return null;
    }

}

export const disableComponents = async (interactionResponse: InteractionResponse): Promise<void> => {
    const message = await interactionResponse.fetch().catch(err => { logger.error(err); });
    if (!message) return;

    const disabledRows = message.components.reduce((a: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[], row) => {
        const components = row.toJSON().components.reduce((a: (ButtonBuilder | StringSelectMenuBuilder)[], component) => {
            let builder: (ButtonBuilder | StringSelectMenuBuilder) = (component.type === ComponentType.Button) ? ButtonBuilder.from(component) : StringSelectMenuBuilder.from(component);
            builder.setDisabled(true);
            a.push(builder);
            return a;
        }, []);
        const disabledRow = (components[0].data.type === ComponentType.Button) ?
            new ActionRowBuilder<ButtonBuilder>().addComponents(components as ButtonBuilder[]) :
            new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(components as StringSelectMenuBuilder[]);
        a.push(disabledRow);
        return a;
    }, []);

    interactionResponse.edit({ components: disabledRows, }).catch(err => logger.error(err));
}