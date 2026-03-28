var { SlashCommandBuilder, PermissionFlagsBits, AttachmentBuilder } = require('discord.js');
var db = require('../../db/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('export')
        .setDescription('Export all verified user data as CSV')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        var users = db.getAllVerified(interaction.guildId);
        if (users.length === 0) {
            return interaction.editReply({ content: 'No verified users to export.' });
        }

        var header = 'user_id,username,email,ip_address,vpn_detected,mfa_enabled,browser_lang,locale,verified_at';
        var rows = users.map(u => {
            return [
                u.user_id,
                '"' + (u.username || '').replace(/"/g, '""') + '"',
                '"' + (u.email || '').replace(/"/g, '""') + '"',
                u.ip_address || '',
                u.vpn_detected ? 'yes' : 'no',
                u.mfa_enabled ? 'yes' : 'no',
                u.browser_lang || '',
                u.locale || '',
                u.verified_at || ''
            ].join(',');
        });

        var csv = header + '\n' + rows.join('\n');
        var buf = Buffer.from(csv, 'utf-8');
        var attachment = new AttachmentBuilder(buf, { name: 'verified_users_' + interaction.guildId + '.csv' });

        await interaction.editReply({ content: '📄 Exported ' + users.length + ' records.', files: [attachment] });
    }
};
