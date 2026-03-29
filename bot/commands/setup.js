var { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
var db = require('../../db/database');
var config = require('../../config');
var { buildAuthUrl } = require('../../utils/oauth');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup')
        .setDescription('Send the verification panel to a channel')
        .addChannelOption(opt =>
            opt.setName('channel')
                .setDescription('Channel to send the panel in')
                .setRequired(true)
        )
        .addStringOption(opt =>
            opt.setName('title')
                .setDescription('Custom title for the embed')
                .setRequired(false)
        )
        .addStringOption(opt =>
            opt.setName('description')
                .setDescription('Custom description')
                .setRequired(false)
        )
        .addStringOption(opt =>
            opt.setName('color')
                .setDescription('Hex color code (e.g. #5865F2)')
                .setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        var channel = interaction.options.getChannel('channel');
        var title = interaction.options.getString('title') || 'Verification';
        var desc = interaction.options.getString('description') || 'Click the button below to verify and gain access to the server.';
        var color = interaction.options.getString('color') || '#5865F2';

        var colorInt = parseInt(color.replace('#', ''), 16) || config.embedColor;

        var embed = new EmbedBuilder()
            .setTitle(title)
            .setDescription(desc)
            .setColor(colorInt)
            .setThumbnail(interaction.guild.iconURL({ size: 256 }))
            .setFooter({ text: interaction.guild.name + ' • Verification', iconURL: interaction.guild.iconURL() });

        // link goes directly to Discord OAuth (VaultCord style)
        var verifyUrl = buildAuthUrl(interaction.guildId, null);

        var row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel('Verify')
                .setStyle(ButtonStyle.Link)
                .setURL(verifyUrl)
                .setEmoji('✅')
        );

        await channel.send({ embeds: [embed], components: [row] });
        await interaction.reply({ content: '✅ Verification panel sent to <#' + channel.id + '>', ephemeral: true });
    }
};
