import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import { join } from 'path';
import { client, logger } from '..';
import { botSettingsDB } from '../database/botSettings';
import { ActivityType } from 'discord.js';

export const app = express();
export const server = http.createServer(app);
export const io = new Server(server);

const PORT = process.env.ENV === 'dev' ? parseInt(process.env.PORT) + 3000 : process.env.PORT;

const serverPagesPath = join(__dirname, '../../', 'serverPages');

app.use('/', express.static(join(serverPagesPath, 'public')));

app.get('/', (req, res) => {
    res.sendFile(join(serverPagesPath, 'index.html'));
});

app.get('/api/:endpoint/:options?', (req, res) => {
    const { endpoint, options } = req.params;

    switch (endpoint) {
        case 'botInfo':
            if (options) {
                switch (options) {
                    case 'commands':
                        res.send(client.commands.payload);
                        break;
                    case 'guilds':
                        res.send(client.guilds.cache);
                        break;
                    case 'users':
                        res.send(client.users.cache);
                        break;
                    case 'user':
                        res.send(client.user);
                        break;
                    case 'settings':
                        res.send(botSettingsDB.get(process.env.ENV));
                        break;

                    default:
                        res.status(404).send({ message: 'endpoint option not found' });
                        break;
                }
            }
            else {
                res.send({
                    user: client.user,
                    ping: client.ws.ping,
                    uptime: client.uptime,
                    commands: client.commands.payload,
                    guilds: client.guilds.cache,
                    users: client.users.cache,
                    ENV: process.env.ENV,
                    ready: client.isReady(),
                });
            }
            break;

        default:
            res.status(404).send({ message: 'endpoint not found' });
            break;
    }
});

interface Settings {
    online: boolean;
    status: {
        visible: boolean;
        data: [
            {
                name: string;
                type: ActivityType.Playing | ActivityType.Listening | ActivityType.Watching | ActivityType.Custom;
            }
        ];
    };
}

io.on('connection', (socket) => {
    socket.on('manageChangeSettings', (settings: Settings) => {
        const config = botSettingsDB.get(process.env.ENV);

        botSettingsDB.set(process.env.ENV, { ...config, ...settings });
        client.updatePresence();
    });

    socket.on('buttonClick', (button) => {
        if (button === 'global') client.registerGlobalCommands(client.commands.payload.global).catch(err => logger.error(err));
        else if (button === 'guild') client.registerCommands(client.commands.payload.allCommands, process.env.BOT_GUILD_ID, false).catch(err => logger.error(err));
        else if (button === 'unrglobal') client.registerGlobalCommands([]).catch(err => logger.error(err));
        else if (button === 'unrguild') client.registerCommands([], process.env.BOT_GUILD_ID, false).catch(err => logger.error(err));
        else logger.error(new Error('Unknown button'));
    });
});

server.listen(PORT, () => {
    logger.log({
        level: 'init',
        message: `Started server at port *:${PORT}`,
        color: 'cyan'
    });
});