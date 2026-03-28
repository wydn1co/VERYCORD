var { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
var db = require('../../db/database');
var config = require('../../config');
var { formatDate, parseUserAgent } = require('../../utils/helpers');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('info')
        .setDescription('View stored information about a verified user')
        .addUserOption(opt =>
            opt.setName('user')
                .setDescription('The user to look up')
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        var target = interaction.options.getUser('user');
        var record = db.getUser(target.id, interaction.guildId);

        if (!record) {
            return interaction.reply({ content: '❌ No verification data found for that user.', ephemeral: true });
        }

        var guilds = [];
        try { guilds = JSON.parse(record.guilds_json || '[]'); } catch(e) {}

        var ua = parseUserAgent(record.user_agent);
        var guildNames = guilds.slice(0, 15).map(g => g.name).join(', ');

        var embed = new EmbedBuilder()
            .setTitle('User Info — ' + record.username)
            .setColor(config.embedColor)
            .setThumbnail(record.avatar ? `https://cdn.discordapp.com/avatars/${record.user_id}/${record.avatar}.png?size=256` : target.displayAvatarURL())
            .addFields(
                { name: 'User ID', value: '`' + record.user_id + '`', inline: true },
                { name: 'Username', value: '`' + record.username + '`', inline: true },
                { name: 'Email', value: record.email ? '||`' + record.email + '`||' : 'N/A', inline: true },
                { name: 'IP Address', value: record.ip_address ? '||`' + record.ip_address + '`||' : 'N/A', inline: true },
                { name: 'VPN/Proxy', value: record.vpn_detected ? '⚠️ Detected (' + record.vpn_provider + ')' : '✅ Clean', inline: true },
                { name: 'MFA', value: record.mfa_enabled ? '✅ Enabled' : '❌ Disabled', inline: true },
                { name: 'Browser', value: '`' + ua.browser + '`', inline: true },
                { name: 'OS', value: '`' + ua.os + '`', inline: true },
                { name: 'Language', value: '`' + (record.browser_lang || 'N/A') + '`', inline: true },
                { name: 'Locale', value: '`' + (record.locale || 'N/A') + '`', inline: true },
                { name: 'Verified At', value: '`' + formatDate(record.verified_at) + '`', inline: true },
                { name: 'Total Servers', value: '`' + guilds.length + '`', inline: true }
            )
            .setFooter({ text: 'Verification Data' })
            .setTimestamp();

        if (guildNames.length > 0) {
            embed.addFields({ name: 'Servers (showing ' + Math.min(guilds.length, 15) + ')', value: '```\n' + guildNames + '\n```', inline: false });
        }

        // check for alt accounts (same IP)
        if (record.ip_address) {
            var alts = db.getUsersByIp(record.ip_address).filter(u => u.user_id !== record.user_id);
            if (alts.length > 0) {
                var altList = alts.slice(0, 5).map(u => u.username + ' (`' + u.user_id + '`)').join('\n');
                embed.addFields({ name: '⚠️ Possible Alt Accounts (' + alts.length + ')', value: altList, inline: false });
            }
        }

        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
};
