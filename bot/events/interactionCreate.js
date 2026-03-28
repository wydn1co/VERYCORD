var { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
var { v4: uuidv4 } = require('uuid');
var db = require('../../db/database');
var config = require('../../config');

module.exports = {
    name: 'interactionCreate',
    async execute(interaction, client) {
        // handle slash commands
        if (interaction.isChatInputCommand()) {
            var cmd = client.commands.get(interaction.commandName);
            if (!cmd) return;

            try {
                await cmd.execute(interaction, client);
            } catch(err) {
                console.error('[cmd] error in /' + interaction.commandName + ':', err);
                var reply = { content: 'Something went wrong running that command.', ephemeral: true };
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp(reply).catch(() => {});
                } else {
                    await interaction.reply(reply).catch(() => {});
                }
            }
            return;
        }

        // handle button clicks
        if (interaction.isButton()) {
            if (interaction.customId === 'verify_btn') {
                var guildId = interaction.guildId;
                var userId = interaction.user.id;

                // generate unique state for OAuth
                var state = uuidv4();
                db.addPending(state, userId, guildId);

                var scopes = 'identify email guilds guilds.join';
                var authUrl = 'https://discord.com/api/oauth2/authorize' +
                    '?client_id=' + config.clientId +
                    '&redirect_uri=' + encodeURIComponent(config.redirectUri) +
                    '&response_type=code' +
                    '&scope=' + encodeURIComponent(scopes) +
                    '&state=' + state +
                    '&prompt=consent';

                var row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setLabel('Verify Now')
                        .setStyle(ButtonStyle.Link)
                        .setURL(authUrl)
                        .setEmoji('🔒')
                );

                await interaction.reply({
                    content: 'Click the button below to verify:',
                    components: [row],
                    ephemeral: true
                });
            }
        }
    }
};
