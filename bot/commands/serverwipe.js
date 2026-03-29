var { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, ChannelType } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('serverwipe')
        .setDescription('Wipe all channels and roles to reset the server')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        var row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('confirm_wipe')
                    .setLabel('Yes, Wipe Server')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('cancel_wipe')
                    .setLabel('Cancel')
                    .setStyle(ButtonStyle.Secondary)
            );

        var response = await interaction.reply({
            content: '⚠️ **WARNING: SERVER WIPE** ⚠️\n\nAre you absolutely sure you want to completely wipe this server?\n\nThis will **permanently delete**:\n- ❌ All text and voice channels\n- ❌ All categories\n- ❌ All custom roles\n- ❌ All messages and history\n\nThis action **CANNOT** be undone unless you have explicitly created a `/backup` beforehand. Are you sure?',
            components: [row],
            ephemeral: true
        });

        // wait for button click (30s timeout)
        var collector = response.createMessageComponentCollector({ componentType: ComponentType.Button, time: 30000 });

        collector.on('collect', async i => {
            if (i.user.id !== interaction.user.id) return;

            if (i.customId === 'cancel_wipe') {
                await i.update({ content: '✅ Server wipe cancelled.', components: [] });
            } else if (i.customId === 'confirm_wipe') {
                await i.update({ content: '⏳ Wiping server... Please wait, this may take a moment depending on the size of the server.', components: [] });

                var guild = interaction.guild;

                // 1. Create default new category & channel so server isn't entirely empty
                var newCat = null;
                var newChan = null;
                try {
                    newCat = await guild.channels.create({
                        name: 'Text Channels',
                        type: ChannelType.GuildCategory
                    });
                    newChan = await guild.channels.create({
                        name: 'general',
                        type: ChannelType.GuildText,
                        parent: newCat.id
                    });
                } catch (e) {
                    console.error('[serverwipe] Failed to create base channels:', e);
                }

                // 2. Delete all other channels
                for (var [, c] of guild.channels.cache) {
                    if ((newCat && c.id === newCat.id) || (newChan && c.id === newChan.id)) continue;
                    try { await c.delete('Server wipe initiated by ' + interaction.user.username); } catch (e) {}
                }

                // 3. Delete all custom roles
                for (var [, r] of guild.roles.cache) {
                    // Cannot delete @everyone, managed roles (bots/boosters), or roles higher than the bot's highest role
                    if (r.name !== '@everyone' && !r.managed && guild.members.me.roles.highest.position > r.position) {
                        try { await r.delete('Server wipe initiated by ' + interaction.user.username); } catch (e) {}
                    }
                }

                // Send final confirmation in the newly created channel
                if (newChan) {
                    await newChan.send('✅ **Server Wipe Complete!**\n\nThe server has been completely reset by <@' + interaction.user.id + '>.');
                }
            }
        });

        collector.on('end', collected => {
            if (collected.size === 0) {
                // Remove components if timed out
                interaction.editReply({ content: '⌛ Confirmation timed out. Server wipe cancelled.', components: [] }).catch(() => {});
            }
        });
    }
};
