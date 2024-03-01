import Enmap from 'enmap';
import { Snowflake } from 'discord.js';

export interface Item {
    title: string;
    url: string;
}

export interface UserSettings {
    lastAddedSongs: Item[];
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