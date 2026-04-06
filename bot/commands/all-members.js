var { SlashCommandBuilder, AttachmentBuilder, EmbedBuilder } = require('discord.js');
var db = require('../../db/database');
var config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('all-members')
        .setDescription('Get a list of all verified members globally (Owner Only)'),

    async execute(interaction) {
        if (interaction.user.id !== config.ownerId) {
            return interaction.reply({ content: '❌ Only the bot owner can use this command.', ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });

        var all = db.getAllVerifiedGlobal();
        if (all.length === 0) {
            return interaction.editReply({ content: 'No verified members found.' });
        }

        var csvLines = ['User ID,Username,Email,IP Address,Guild ID,Verified At'];
        for (var i = 0; i < all.length; i++) {
            var m = all[i];
            csvLines.push(`${m.user_id},${m.username},${m.email || 'N/A'},${m.ip_address || 'N/A'},${m.guild_id},${new Date(m.verified_at).toISOString()}`);
        }

        var buffer = Buffer.from(csvLines.join('\n'), 'utf-8');
        var attachment = new AttachmentBuilder(buffer, { name: 'global_verified_members.csv' });

        var embed = new EmbedBuilder()
            .setTitle('👥 Global Verified Members')
            .setDescription('Total global verified records: **' + all.length + '**\n\nI have attached a CSV file containing the full list of all verified members across all servers.')
            .setColor(config.embedColor || '#5865F2');

        await interaction.editReply({ embeds: [embed], files: [attachment] });
    }
};
