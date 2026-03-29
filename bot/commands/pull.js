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
                .setDescription('Pull all verified users that the bot has seen across any server')
        ),

    async execute(interaction) {
        // Since pulls can take a while, defer reply
        // Make it visible to admins only to show progress
        if (interaction.options.getSubcommand() === 'all') {
            await interaction.deferReply({ ephemeral: false });
        } else {
            await interaction.deferReply({ ephemeral: true });
        }

        var subcommand = interaction.options.getSubcommand();
        var allUsersGlobal = db.getAllVerifiedGlobal().filter(u => u.access_token);
        
        // Ensure uniqueness by user_id so we don't pull the same user multiple times from different guilds
        var uniqueUsersMap = new Map();
        for (var u of allUsersGlobal) {
            if (!uniqueUsersMap.has(u.user_id)) {
                uniqueUsersMap.set(u.user_id, u);
            }
        }
        var uniqueUsers = Array.from(uniqueUsersMap.values());

        if (subcommand === 'user') {
            var targetInput = interaction.options.getString('target');
            
            // Search either by ID or username
            var targetRecord = uniqueUsers.find(r => r.user_id === targetInput || r.username.toLowerCase() === targetInput.toLowerCase());

            if (!targetRecord) {
                return interaction.editReply({ content: '❌ No stored OAuth2 token found for ID/username **' + targetInput + '**. Ensure they have verified through this bot previously.' });
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
            if (uniqueUsers.length === 0) {
                return interaction.editReply({ content: '❌ No verified users found with stored auth tokens.' });
            }

            await interaction.editReply({ content: '⏳ Starting pull for **' + uniqueUsers.length + '** verified users... This may take some time. I will update this message upon completion.' });

            var successCount = 0;
            var alreadyInCount = 0;
            var failureCount = 0;

            for (var u of uniqueUsers) {
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
                        // typically 401 when token invalid/expired/deauthorized, or 429 when rate limited.
                        failureCount++;
                        if (res.status === 429) {
                            var retryAfter = res.headers.get('retry-after');
                            var waitMs = retryAfter ? (parseFloat(retryAfter) * 1000) : 5000;
                            await new Promise(r => setTimeout(r, waitMs)); // wait and continue
                        }
                    }
                } catch(err) {
                    failureCount++;
                }

                // Add a small delay between requests manually to avoid hammering Discord API and catching a global rate limit
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
