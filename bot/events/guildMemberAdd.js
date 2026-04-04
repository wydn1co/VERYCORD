var { EmbedBuilder } = require('discord.js');
var db = require('../../db/database');
var config = require('../../config');

module.exports = {
    name: 'guildMemberAdd',
    async execute(member, client) {
        var guildConfig = db.getConfig(member.guild.id);
        if (!guildConfig) return;

        // assign unverified role if configured
        if (guildConfig.unverified_role) {
            var unverifiedRole = member.guild.roles.cache.get(guildConfig.unverified_role);
            if (unverifiedRole) {
                await member.roles.add(unverifiedRole).catch(() => {});
            }
        }

        // DM new member telling them to verify from the server
        var embed = new EmbedBuilder()
            .setTitle('Verification Required')
            .setDescription(
                'You need to verify to access **' + member.guild.name + '**.\n\n' +
                '> Head to the verification channel in the server and click the **Verify** button to get started.'
            )
            .setColor(config.embedColor)
            .setThumbnail(member.guild.iconURL({ size: 128 }))
            .setFooter({ text: member.guild.name + ' • Start from Discord' });

        await member.send({ embeds: [embed] }).catch(() => {
            // user has DMs disabled
        });
    }
};
