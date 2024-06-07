import { GuildMember } from 'discord.js';
import { SlashCommand } from '../../structures/SlashCommand';
import { queues } from '../..';
import { Queue } from '../../structures/Queue';
import { createSongEmbed, formatedTimeToSeconds } from '../../utils';
import { YoutubeSong } from '../../structures/YoutubeSong';

export default new SlashCommand({
    data: {
        name: 'makumba',
        description: 'Zagraj makumbę',
        dmPermission: false,
    },
    vcOnly: true,
    run: async ({ interaction, logger }) => {
        const channel = (interaction.member as GuildMember).voice.channel;
        const queue = queues.has(interaction.guildId) ? queues.get(interaction.guildId) : new Queue(interaction.guild, interaction.channel);

        if (!queue.connected) {
            try {
                await queue.connect(channel);
            } catch (err) {
                logger.error(err);
                return interaction.reply({ content: 'Nie udało się połączyć z kanałem głosowym!', ephemeral: true, }).catch(err => logger.error(err));
            }
        }

        const song = new YoutubeSong({ title: 'Big Cyc - Makumba', url: 'https://www.youtube.com/watch?v=EAexp0w3H3c', duration: formatedTimeToSeconds('3:21')}, interaction.user);
        queue.add([song], { title: 'Big Cyc - Makumba', url: 'https://www.youtube.com/watch?v=EAexp0w3H3c', }, {
            position: 1,
            skip: true,
        });

        interaction.reply({ embeds: createSongEmbed('Dodano', song), }).catch(err => logger.error(err));
    },
});