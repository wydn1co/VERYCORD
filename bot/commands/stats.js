var { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
var db = require('../../db/database');
var config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stats')
        .setDescription('View verification statistics for this server')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        var guildId = interaction.guildId;
        var totalVerified = db.countVerified(guildId);
        var totalVerifications = db.countLogs(guildId, 'verify');
        var totalBlocked = db.countLogs(guildId, 'blocked');
        var totalPulls = db.countLogs(guildId, 'pull');
        var blacklistCount = db.getBlacklist(guildId).length;

        // get recent verifications
        var recentLogs = db.getLogs(guildId, 5);
        var recentLines = recentLogs.map(log => {
            var ts = Math.floor(new Date(log.timestamp).getTime() / 1000);
            return '`' + log.action + '` — <@' + log.user_id + '> <t:' + ts + ':R>';
        }).join('\n') || 'No activity yet';

        // count vpn detections
        var allUsers = db.getAllVerified(guildId);
        var vpnCount = allUsers.filter(u => u.vpn_detected).length;

        // unique IPs
        var uniqueIps = new Set(allUsers.map(u => u.ip_address).filter(Boolean)).size;

        var embed = new EmbedBuilder()
            .setTitle('📊 Verification Stats')
            .setColor(config.embedColor)
            .addFields(
                { name: 'Total Verified', value: '`' + totalVerified + '`', inline: true },
                { name: 'Total Verifications', value: '`' + totalVerifications + '`', inline: true },
                { name: 'Blocked Attempts', value: '`' + totalBlocked + '`', inline: true },
                { name: 'VPN Detections', value: '`' + vpnCount + '`', inline: true },
                { name: 'Unique IPs', value: '`' + uniqueIps + '`', inline: true },
                { name: 'Pulls', value: '`' + totalPulls + '`', inline: true },
                { name: 'Blacklisted', value: '`' + blacklistCount + '`', inline: true },
                { name: 'Server Members', value: '`' + interaction.guild.memberCount + '`', inline: true },
                { name: '\u200b', value: '\u200b', inline: true },
                { name: 'Recent Activity', value: recentLines, inline: false }
            )
            .setFooter({ text: interaction.guild.name })
            .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
};
