import Enmap from 'enmap';
import { Snowflake } from 'discord.js';

export interface Item {
    title: string;
    url: string;
}

export interface UserSettings {
    version: number;
    lastAddedSongs: Item[];
    keepHistory: boolean;
    sponsorBlockEnabled: boolean;
    favorites: Item[];
}

export const userSettingsDB: Enmap<Snowflake, UserSettings> = new Enmap({ name: 'usersettings', });

const defaultUserSettings: UserSettings = {
    version: 2,
    lastAddedSongs: [],
    keepHistory: true,
    sponsorBlockEnabled: true,
    favorites: [],
}

export const getDefaultUserSettings = (userId: Snowflake): UserSettings => {
    userSettingsDB.set(userId, defaultUserSettings);
    return defaultUserSettings;
}

export const getUserSettings = (userId: Snowflake): UserSettings => {
    const userSettings = userSettingsDB.get(userId) ?? getDefaultUserSettings(userId);

    if (defaultUserSettings.version !== userSettings.version) {
        const settings: UserSettings = {
            ...defaultUserSettings,
            ...userSettings,
        }

        userSettingsDB.set(userId, settings);
        return settings;
    } else return userSettings;
}