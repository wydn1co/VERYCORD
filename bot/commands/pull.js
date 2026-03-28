var { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
var fetch = require('node-fetch');
var db = require('../../db/database');
var config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('pull')
        .setDescription('Pull a verified user into this server using their OAuth2 token')
        .addUserOption(opt =>
            opt.setName('user')
                .setDescription('User to pull')
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        var target = interaction.options.getUser('user');

        // grab their stored token from any guild
        var records = db.getUserAllGuilds(target.id);
        var tokenRecord = records.find(r => r.access_token);

        if (!tokenRecord) {
            return interaction.editReply({ content: '❌ No stored OAuth2 token found for that user. They need to verify first.' });
        }

        // try joining them to this guild
        try {
            var res = await fetch('https://discord.com/api/v10/guilds/' + interaction.guildId + '/members/' + target.id, {
                method: 'PUT',
                headers: {
                    'Authorization': 'Bot ' + config.token,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    access_token: tokenRecord.access_token
                })
            });

            if (res.status === 201) {
                await interaction.editReply({ content: '✅ Successfully pulled **' + target.username + '** into the server.' });
                db.addLog(target.id, interaction.guildId, 'pull', 'Pulled by ' + interaction.user.username, null);
            } else if (res.status === 204) {
                await interaction.editReply({ content: '⚠️ **' + target.username + '** is already in this server.' });
            } else {
                var body = await res.json().catch(() => ({}));
                await interaction.editReply({ content: '❌ Failed to pull user. Discord returned ' + res.status + ': ' + (body.message || 'Unknown error') });
            }
        } catch(err) {
            await interaction.editReply({ content: '❌ Error pulling user: ' + err.message });
        }
    }
};
