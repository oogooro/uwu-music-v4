import Enmap from 'enmap';
import { Snowflake } from 'discord.js';

export interface LastAddedItem {
    title: string;
    url: string;
}

export interface UserPreferences {
    lastAddedSongs: LastAddedItem[];
    keepHistory: boolean;
    sponsorBlockEnabled: boolean;
    version: number;
}

export const userPreferencesDB: Enmap<Snowflake, UserPreferences> = new Enmap({ name: 'userPreferences', });

const defaultUserPreferences: UserPreferences = {
    lastAddedSongs: [],
    keepHistory: true,
    sponsorBlockEnabled: true,
    version: 1,
}

export const getDefaultUserPreferences = (userId: Snowflake): UserPreferences => {
    userPreferencesDB.set(userId, defaultUserPreferences);
    return defaultUserPreferences;
}

export const patchUserPreferences = (userPreferences: UserPreferences, userId: Snowflake): UserPreferences => {
    if (defaultUserPreferences.version !== userPreferences.version) {
        const preferences: UserPreferences = {
            ...defaultUserPreferences,
            ...userPreferences,
        }
        
        userPreferencesDB.set(userId, preferences);
        return preferences;
    } else return userPreferences;
}