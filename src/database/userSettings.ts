import Enmap from 'enmap';
import { Snowflake } from 'discord.js';

export interface LastAddedItem {
    title: string;
    url: string;
}

export interface UserSettings {
    lastAddedSongs: LastAddedItem[];
    keepHistory: boolean;
    sponsorBlockEnabled: boolean;
    version: number;
}

export const userSettingsDB: Enmap<Snowflake, UserSettings> = new Enmap({ name: 'usersettings', });

const defaultUserSettings: UserSettings = {
    lastAddedSongs: [],
    keepHistory: true,
    sponsorBlockEnabled: true,
    version: 1,
}

export const getDefaultUserSettings = (userId: Snowflake): UserSettings => {
    userSettingsDB.set(userId, defaultUserSettings);
    return defaultUserSettings;
}

export const patchUserSettings = (userSettings: UserSettings, userId: Snowflake): UserSettings => {
    if (defaultUserSettings.version !== userSettings.version) {
        const settings: UserSettings = {
            ...defaultUserSettings,
            ...userSettings,
        }
        
        userSettingsDB.set(userId, settings);
        return settings;
    } else return userSettings;
}