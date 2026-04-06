var { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
var db = require('../../db/database');
var config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ip-lookup')
        .setDescription('Lookup an IP address to find all matching verified users (Owner Only)')
        .addStringOption(opt =>
            opt.setName('ip')
                .setDescription('The IP address to lookup')
                .setRequired(true)
        ),

    async execute(interaction) {
        if (interaction.user.id !== config.ownerId) {
            return interaction.reply({ content: '❌ Only the bot owner can use this command.', ephemeral: true });
        }

        var ip = interaction.options.getString('ip').trim();
        var matches = db.getUsersByIp(ip);

        if (matches.length === 0) {
            return interaction.reply({ content: '🔍 No verified users found for IP: `' + ip + '`', ephemeral: true });
        }

        var lines = [];
        for (var i = 0; i < matches.length && i < 15; i++) {
            var m = matches[i];
            var date = new Date(m.verified_at).toLocaleDateString();
            lines.push('**' + m.username + '** (`' + m.user_id + '`)');
            lines.push('Server: `' + m.guild_id + '` | Date: ' + date);
            lines.push('');
        }

        var embed = new EmbedBuilder()
            .setTitle('🔍 IP Lookup Results')
            .setDescription('Found **' + matches.length + '** match(es) for `' + ip + '`\n\n' + lines.join('\n'))
            .setColor(config.embedColor || '#5865F2');

        if (matches.length > 15) {
            embed.setFooter({ text: 'Showing first 15 results. View full list on the dashboard.' });
        }

        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
};
