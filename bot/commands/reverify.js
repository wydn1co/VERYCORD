var { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
var db = require('../../db/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('reverify')
        .setDescription('Force a user to re-verify')
        .addUserOption(opt =>
            opt.setName('user')
                .setDescription('User to reverify')
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        var target = interaction.options.getUser('user');
        var guildId = interaction.guildId;
        var guildConfig = db.getConfig(guildId);

        var member = await interaction.guild.members.fetch(target.id).catch(() => null);
        if (!member) {
            return interaction.reply({ content: '❌ That user is not in this server.', ephemeral: true });
        }

        // remove verified role
        if (guildConfig && guildConfig.verified_role) {
            await member.roles.remove(guildConfig.verified_role).catch(() => {});
        }

        // add unverified role
        if (guildConfig && guildConfig.unverified_role) {
            await member.roles.add(guildConfig.unverified_role).catch(() => {});
        }

        // wipe their record
        db.removeUser(target.id, guildId);
        db.addLog(target.id, guildId, 'reverify', 'Forced by ' + interaction.user.username, null);

        await interaction.reply({
            content: '✅ **' + target.username + '** has been unverified and will need to re-verify.',
            ephemeral: true
        });
    }
};
