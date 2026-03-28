var { EmbedBuilder } = require('discord.js');
var config = require('../config');

async function sendVerificationLog(client, channelId, userData) {
    var channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel) return;

    var guilds = [];
    try {
        guilds = JSON.parse(userData.guilds_json || '[]');
    } catch(e) {}

    var mutualGuilds = guilds.filter(g => client.guilds.cache.has(g.id));
    var guildList = mutualGuilds.slice(0, 10).map(g => g.name).join(', ');

    var embed = new EmbedBuilder()
        .setTitle('New Verification')
        .setColor(config.successColor)
        .setThumbnail(userData.avatar ? `https://cdn.discordapp.com/avatars/${userData.user_id}/${userData.avatar}.png?size=256` : null)
        .addFields(
            { name: 'User', value: `<@${userData.user_id}> (\`${userData.username}\`)`, inline: true },
            { name: 'User ID', value: '`' + userData.user_id + '`', inline: true },
            { name: '\u200b', value: '\u200b', inline: true },
            { name: 'Email', value: userData.email ? '`' + userData.email + '`' : 'Not provided', inline: true },
            { name: 'IP Address', value: '`' + (userData.ip_address || 'Unknown') + '`', inline: true },
            { name: '\u200b', value: '\u200b', inline: true },
            { name: 'VPN/Proxy', value: userData.vpn_detected ? '⚠️ **Detected** (' + (userData.vpn_provider || 'unknown') + ')' : '✅ Clean', inline: true },
            { name: 'MFA Enabled', value: userData.mfa_enabled ? '✅ Yes' : '❌ No', inline: true },
            { name: '\u200b', value: '\u200b', inline: true },
            { name: 'Browser', value: '`' + (userData.user_agent || 'Unknown').substring(0, 100) + '`', inline: false },
            { name: 'Language', value: '`' + (userData.browser_lang || 'Unknown') + '`', inline: true },
            { name: 'Locale', value: '`' + (userData.locale || 'Unknown') + '`', inline: true }
        )
        .setFooter({ text: 'Verified' })
        .setTimestamp();

    if (guildList.length > 0) {
        embed.addFields({ name: 'Mutual Servers (' + mutualGuilds.length + ')', value: guildList, inline: false });
    }

    if (guilds.length > 0) {
        embed.addFields({ name: 'Total Servers', value: '`' + guilds.length + '`', inline: true });
    }

    await channel.send({ embeds: [embed] }).catch(() => {});
}

async function sendBlockLog(client, channelId, reason, userData) {
    var channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel) return;

    var embed = new EmbedBuilder()
        .setTitle('Verification Blocked')
        .setColor(config.errorColor)
        .setThumbnail(userData.avatar ? `https://cdn.discordapp.com/avatars/${userData.user_id}/${userData.avatar}.png?size=256` : null)
        .addFields(
            { name: 'User', value: `<@${userData.user_id}> (\`${userData.username}\`)`, inline: true },
            { name: 'Reason', value: reason, inline: true },
            { name: 'IP Address', value: '`' + (userData.ip_address || 'Unknown') + '`', inline: true }
        )
        .setTimestamp();

    await channel.send({ embeds: [embed] }).catch(() => {});
}

module.exports = { sendVerificationLog, sendBlockLog };
