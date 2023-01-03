import { ActivitiesOptions, ActivityType } from 'discord.js';
import Enmap from 'enmap';

export interface BotSettings {
    online: boolean;
    status: {
        visible: boolean;
        data: ActivitiesOptions[];
    };
    devs: string[];
}

export const botSettingsDB: Enmap<string, BotSettings> = new Enmap({ name: 'botSettings', });

if (!botSettingsDB.get(process.env.ENV)) {
    botSettingsDB.set(process.env.ENV, {
        online: true,
        status: {
            visible: false,
            data: [{
                name: '',
                type: ActivityType.Watching,
            }],
        },
        devs: ['299533808359833600'],
    });
}