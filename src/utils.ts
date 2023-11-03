import { APIEmbed, escapeMarkdown, hyperlink, Interaction, InteractionType, User } from 'discord.js';
import ytsr, { Video } from 'ytsr';
import { soundcloud } from '.';
import config from './config';
import { Song } from './structures/Song';
import { SoundcloudSong } from './structures/SoundcoludSong';
import { YoutubeSong } from './structures/YoutubeSong';
import { SpotifySong } from './structures/SpotifySong';

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
        color: config.embedColor,
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