var { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
var { buildAuthUrl } = require('../../utils/oauth');

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

                // build Discord OAuth URL directly (VaultCord style)
                var authUrl = buildAuthUrl(guildId, userId);

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
