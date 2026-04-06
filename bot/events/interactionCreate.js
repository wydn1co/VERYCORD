var { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
var { buildPanelAuthUrl } = require('../../utils/oauth');
var db = require('../../db/database');
var config = require('../../config');

module.exports = {
    name: 'interactionCreate',
    async execute(interaction, client) {
        // handle modal submissions (embed builder)
        if (interaction.isModalSubmit()) {
            if (interaction.customId === 'embed_create_modal') {
                var title = interaction.fields.getTextInputValue('embed_title');
                var description = interaction.fields.getTextInputValue('embed_description') || '';
                var color = interaction.fields.getTextInputValue('embed_color') || '#5865F2';
                var footer = interaction.fields.getTextInputValue('embed_footer') || '';
                var image = interaction.fields.getTextInputValue('embed_image') || '';

                var cleanColor = color.replace('#', '').trim();
                if (!/^[0-9a-fA-F]{6}$/.test(cleanColor)) cleanColor = '5865F2';

                var embed = new EmbedBuilder()
                    .setTitle(title)
                    .setColor(parseInt(cleanColor, 16));

                if (description) embed.setDescription(description);
                if (footer) embed.setFooter({ text: footer });
                if (image) embed.setImage(image);

                try {
                    await interaction.channel.send({ embeds: [embed] });
                    await interaction.reply({ content: '✅ Embed sent!', ephemeral: true });
                } catch(err) {
                    await interaction.reply({ content: '❌ Failed to send embed: ' + err.message, ephemeral: true });
                }
            }
            return;
        }

        // handle slash commands
        if (interaction.isChatInputCommand()) {
            var cmd = client.commands.get(interaction.commandName);
            if (!cmd) return;

            // whitelist check — skip for /whitelist itself and DMs
            if (interaction.guildId && interaction.commandName !== 'whitelist') {
                var whitelist = db.getWhitelistAll();
                // only enforce if at least one server has been whitelisted
                if (whitelist.length > 0 && !db.isWhitelisted(interaction.guildId)) {
                    return interaction.reply({ content: '❌ This server is not whitelisted. Contact the bot owner.', ephemeral: true });
                }
            }

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

                // build Discord OAuth URL directly
                var authUrl = buildPanelAuthUrl(guildId);

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
