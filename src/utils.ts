import { APIEmbed, CommandInteraction, escapeMarkdown, hyperlink, Interaction, InteractionType } from 'discord.js';
import config from './config';
import { Song } from './structures/Song';
import { SoundcloudSong } from './structures/SoundcoludSong';
import { YoutubeSong } from './structures/YoutubeSong';

let customIdIncrement = 0;
export function generateCustomId(text: string, interaction: CommandInteraction): string {
    if (customIdIncrement >= 100) customIdIncrement = 0;
    customIdIncrement++;
    return `${interaction.commandName}-${text}-${interaction.user.id}-${interaction.createdTimestamp}-${customIdIncrement}`.toUpperCase();
}

export function generateInteractionTrace(interaction: Interaction): string {
    const place = interaction.guildId || 'DM';
    if (interaction.type === InteractionType.ApplicationCommand || interaction.type === InteractionType.ApplicationCommandAutocomplete) return `${place}/${interaction.user.id}/${interaction.commandName}`;
    else if (interaction.type === InteractionType.MessageComponent || interaction.type === InteractionType.ModalSubmit) return `${place}/${interaction.user.id}/${interaction.customId}`;
}

export function songToDisplayString(song: Song, short: boolean = false): string {
    let displayString = `${hyperlink(escape(trimString(song.title, 55)), song.url, song.title.length >= 55 ? escape(song.title) : null)}`;

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
            url: song instanceof YoutubeSong || song instanceof SoundcloudSong ? song.thumbnail : null,
        },
        description: songToDisplayString(song) + (additionalInfo?.length ? '\n\n' + additionalInfo.join('\n') : ''),
        color: config.embedColor,
    }]

    return embed;
}