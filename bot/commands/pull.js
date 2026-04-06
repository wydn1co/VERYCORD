var { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
var fetch = require('node-fetch');
var db = require('../../db/database');
var config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('pull')
        .setDescription('Pull verified users into this server')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub => 
            sub.setName('user')
                .setDescription('Pull a specific user by their Discord ID or exact username')
                .addStringOption(opt => 
                    opt.setName('target')
                        .setDescription('User ID or exact Discord username')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub.setName('all')
                .setDescription('Pull all users verified in this server')
        ),

    async execute(interaction) {
        if (interaction.options.getSubcommand() === 'all') {
            await interaction.deferReply({ ephemeral: false });
        } else {
            await interaction.deferReply({ ephemeral: true });
        }

        var subcommand = interaction.options.getSubcommand();

        // only get users verified in THIS server
        var serverUsers = db.getAllVerified(interaction.guildId).filter(u => u.access_token);

        if (subcommand === 'user') {
            var targetInput = interaction.options.getString('target');
            
            var targetRecord = serverUsers.find(r => r.user_id === targetInput || r.username.toLowerCase() === targetInput.toLowerCase());

            if (!targetRecord) {
                return interaction.editReply({ content: '❌ No stored OAuth2 token found for ID/username **' + targetInput + '** in this server. They must have verified here first.' });
            }

            try {
                var res = await fetch('https://discord.com/api/v10/guilds/' + interaction.guildId + '/members/' + targetRecord.user_id, {
                    method: 'PUT',
                    headers: {
                        'Authorization': 'Bot ' + config.token,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        access_token: targetRecord.access_token
                    })
                });

                if (res.status === 201) {
                    await interaction.editReply({ content: '✅ Successfully pulled **' + targetRecord.username + '** into the server.' });
                    db.addLog(targetRecord.user_id, interaction.guildId, 'pull', 'Pulled by ' + interaction.user.username, null);
                } else if (res.status === 204) {
                    await interaction.editReply({ content: '⚠️ **' + targetRecord.username + '** is already in this server.' });
                } else {
                    var body = await res.json().catch(() => ({}));
                    await interaction.editReply({ content: '❌ Failed to pull user. Discord returned ' + res.status + ': ' + (body.message || 'Unknown error. Token might be expired/invalidated.') });
                }
            } catch(err) {
                await interaction.editReply({ content: '❌ Error pulling user: ' + err.message });
            }
            
        } else if (subcommand === 'all') {
            if (serverUsers.length === 0) {
                return interaction.editReply({ content: '❌ No verified users found in this server with stored auth tokens.' });
            }

            await interaction.editReply({ content: '⏳ Starting pull for **' + serverUsers.length + '** verified users from this server... This may take some time.' });

            var successCount = 0;
            var alreadyInCount = 0;
            var failureCount = 0;

            for (var u of serverUsers) {
                try {
                    var res = await fetch('https://discord.com/api/v10/guilds/' + interaction.guildId + '/members/' + u.user_id, {
                        method: 'PUT',
                        headers: {
                            'Authorization': 'Bot ' + config.token,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            access_token: u.access_token
                        })
                    });

                    if (res.status === 201) {
                        successCount++;
                    } else if (res.status === 204) {
                        alreadyInCount++;
                    } else {
                        failureCount++;
                        if (res.status === 429) {
                            var retryAfter = res.headers.get('retry-after');
                            var waitMs = retryAfter ? (parseFloat(retryAfter) * 1000) : 5000;
                            await new Promise(r => setTimeout(r, waitMs));
                        }
                    }
                } catch(err) {
                    failureCount++;
                }

                await new Promise(r => setTimeout(r, 600));
            }

            await interaction.editReply({ content: '✅ **Pull All Complete!**\n\n' +
                '🎯 Successfully pulled: **' + successCount + '** users\n' +
                '🤷 Already in server: **' + alreadyInCount + '** users\n' +
                '❌ Failed (Tokens expired/invalid): **' + failureCount + '** users'
            });
            
            db.addLog(interaction.user.id, interaction.guildId, 'pull_all', 'Pulled ' + successCount + ' users total', null);
        }
    }
};
