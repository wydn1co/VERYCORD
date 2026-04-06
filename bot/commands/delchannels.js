var { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('delchannels')
        .setDescription('Deletes all channels that start with a specific word or prefix (Admin Only)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(opt =>
            opt.setName('prefix')
                .setDescription('The prefix to match (e.g., "ticket-" will delete all channels starting with ticket-)')
                .setRequired(true)
        ),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        var prefix = interaction.options.getString('prefix').toLowerCase();
        var guild = interaction.guild;

        var channelsToDelete = guild.channels.cache.filter(c => c.name.toLowerCase().startsWith(prefix));

        if (channelsToDelete.size === 0) {
            return interaction.editReply('❌ No channels found starting with `' + prefix + '`.');
        }

        var count = 0;
        await interaction.editReply('⏳ Deleting ' + channelsToDelete.size + ' channels starting with `' + prefix + '`...');

        for (var [, c] of channelsToDelete) {
            try {
                await c.delete('Deleted via /delchannels by ' + interaction.user.tag);
                count++;
                await new Promise(r => setTimeout(r, 250)); // rate limit protection
            } catch(e) {
                // Ignore errors if the bot lacks permissions for a specific channel
            }
        }

        await interaction.editReply('✅ Finished! Successfully deleted **' + count + ' / ' + channelsToDelete.size + '** channels starting with `' + prefix + '`.');
    }
};
