declare global {
    namespace NodeJS {
        interface ProcessEnv {
            DISCORDBOT_TOKEN: string;
            DISCORDBOT_DEV_TOKEN: string;
            DISCORDAPP_TOKEN: string;
            BOT_GUILD_ID: string;
            ENV: 'dev' | 'prod' | 'debug';
            DEBUG_MODE?: '1' | '0';
            PORT: string;
            SPONSORBLOCK_USER_ID: string;
        }
    }
}

export { };