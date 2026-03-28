var { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
var db = require('../../db/database');
var config = require('../../config');
var { formatDate, parseUserAgent } = require('../../utils/helpers');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('whois')
        .setDescription('Quick summary of a user')
        .addUserOption(opt =>
            opt.setName('user')
                .setDescription('User to look up')
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction) {
        var target = interaction.options.getUser('user');
        var member = await interaction.guild.members.fetch(target.id).catch(() => null);
        var record = db.getUser(target.id, interaction.guildId);

        var embed = new EmbedBuilder()
            .setTitle(target.username)
            .setColor(config.embedColor)
            .setThumbnail(target.displayAvatarURL({ size: 256 }))
            .addFields(
                { name: 'ID', value: '`' + target.id + '`', inline: true },
                { name: 'Created', value: '<t:' + Math.floor(target.createdTimestamp / 1000) + ':R>', inline: true },
                { name: 'Bot', value: target.bot ? 'Yes' : 'No', inline: true }
            );

        if (member) {
            embed.addFields(
                { name: 'Joined', value: '<t:' + Math.floor(member.joinedTimestamp / 1000) + ':R>', inline: true },
                { name: 'Roles', value: '`' + (member.roles.cache.size - 1) + '`', inline: true },
                { name: 'Nickname', value: member.nickname || 'None', inline: true }
            );
        }

        if (record) {
            var ua = parseUserAgent(record.user_agent);
            embed.addFields(
                { name: '── Verification Data ──', value: '\u200b', inline: false },
                { name: 'Verified', value: record.verified_at ? '✅ ' + formatDate(record.verified_at) : '❌ No', inline: true },
                { name: 'Email', value: record.email ? '||' + record.email + '||' : 'N/A', inline: true },
                { name: 'IP', value: record.ip_address ? '||' + record.ip_address + '||' : 'N/A', inline: true },
                { name: 'VPN', value: record.vpn_detected ? '⚠️ Yes' : '✅ Clean', inline: true },
                { name: 'Device', value: ua.browser + ' / ' + ua.os, inline: true }
            );

            // alt check
            if (record.ip_address) {
                var alts = db.getUsersByIp(record.ip_address).filter(u => u.user_id !== target.id);
                embed.addFields({ name: 'Alt Accounts', value: alts.length > 0 ? '⚠️ ' + alts.length + ' found' : 'None', inline: true });
            }
        } else {
            embed.addFields({ name: 'Verification', value: '❌ Not verified', inline: false });
        }

        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
};
