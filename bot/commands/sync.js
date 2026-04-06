var { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sync')
        .setDescription('Syncs channel permissions to perfectly match their parent category (Admin Only)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addChannelOption(opt =>
            opt.setName('category')
                .setDescription('Select a specific category to sync (leave blank to sync ALL channels in the server)')
                .addChannelTypes(ChannelType.GuildCategory)
                .setRequired(false)
        ),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        var categoryOpt = interaction.options.getChannel('category');
        var guild = interaction.guild;

        var channelsToSync = [];

        if (categoryOpt) {
            channelsToSync = Array.from(guild.channels.cache.filter(c => c.parentId === categoryOpt.id).values());
        } else {
            channelsToSync = Array.from(guild.channels.cache.filter(c => c.parentId !== null).values());
        }

        if (channelsToSync.length === 0) {
            return interaction.editReply('❌ No channels found to sync.');
        }

        await interaction.editReply('⏳ Syncing **' + channelsToSync.length + '** channel(s)... Please wait.');

        var count = 0;
        var skipped = 0;

        for (var i = 0; i < channelsToSync.length; i++) {
            var c = channelsToSync[i];
            
            try {
                // If it's already synced, discord.js will set permissionsLocked to true.
                if (c.permissionsLocked) {
                    skipped++;
                    continue;
                }

                await c.lockPermissions();
                count++;
                await new Promise(r => setTimeout(r, 300)); // Sleep to prevent rate limit
            } catch(e) {
                // Ignore missing permissions for specific channels
            }
        }

        var msg = '✅ **Finished Syncing!**\n\n' +
                  '🔹 Synced: **' + count + '** channels\n' +
                  '🔹 Skipped: **' + skipped + '** (already perfectly synced)';

        if (categoryOpt) {
            msg += '\n📂 Target: `' + categoryOpt.name + '`';
        } else {
            msg += '\n🌍 Target: `Entire Server`';
        }

        await interaction.editReply(msg);
    }
};
