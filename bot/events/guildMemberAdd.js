var { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
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

        // DM new member with verify prompt
        var embed = new EmbedBuilder()
            .setTitle('Verification Required')
            .setDescription('You need to verify to access **' + member.guild.name + '**.\nClick the button below to start.')
            .setColor(config.embedColor)
            .setThumbnail(member.guild.iconURL({ size: 128 }))
            .setFooter({ text: member.guild.name });

        var verifyUrl = config.baseUrl + '/auth/discord?guild=' + member.guild.id;

        var row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel('Verify')
                .setStyle(ButtonStyle.Link)
                .setURL(verifyUrl)
                .setEmoji('✅')
        );

        await member.send({ embeds: [embed], components: [row] }).catch(() => {
            // user has DMs disabled, nothing we can do
        });
    }
};
