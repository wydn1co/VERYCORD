var { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
var db = require('../../db/database');
var config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('blacklist')
        .setDescription('Manage the server blacklist')
        .addSubcommand(sub =>
            sub.setName('add')
                .setDescription('Add an entry to the blacklist')
                .addStringOption(opt =>
                    opt.setName('type')
                        .setDescription('Type of blacklist entry')
                        .setRequired(true)
                        .addChoices(
                            { name: 'User ID', value: 'user' },
                            { name: 'IP Address', value: 'ip' }
                        )
                )
                .addStringOption(opt =>
                    opt.setName('value')
                        .setDescription('The user ID or IP to blacklist')
                        .setRequired(true)
                )
                .addStringOption(opt =>
                    opt.setName('reason')
                        .setDescription('Reason for blacklisting')
                        .setRequired(false)
                )
        )
        .addSubcommand(sub =>
            sub.setName('remove')
                .setDescription('Remove an entry from the blacklist')
                .addStringOption(opt =>
                    opt.setName('type')
                        .setDescription('Type of entry')
                        .setRequired(true)
                        .addChoices(
                            { name: 'User ID', value: 'user' },
                            { name: 'IP Address', value: 'ip' }
                        )
                )
                .addStringOption(opt =>
                    opt.setName('value')
                        .setDescription('The user ID or IP to remove')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub.setName('list')
                .setDescription('View all blacklisted entries')
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        var sub = interaction.options.getSubcommand();
        var guildId = interaction.guildId;

        if (sub === 'add') {
            var type = interaction.options.getString('type');
            var value = interaction.options.getString('value');
            var reason = interaction.options.getString('reason') || 'No reason given';

            db.addBlacklist(guildId, type, value, reason, interaction.user.id);
            await interaction.reply({
                content: '✅ Added `' + value + '` to the ' + type + ' blacklist.\nReason: ' + reason,
                ephemeral: true
            });
        }

        if (sub === 'remove') {
            var type = interaction.options.getString('type');
            var value = interaction.options.getString('value');

            var result = db.removeBlacklist(guildId, type, value);
            if (result.changes > 0) {
                await interaction.reply({ content: '✅ Removed `' + value + '` from the blacklist.', ephemeral: true });
            } else {
                await interaction.reply({ content: '❌ That entry was not found in the blacklist.', ephemeral: true });
            }
        }

        if (sub === 'list') {
            var entries = db.getBlacklist(guildId);
            if (entries.length === 0) {
                return interaction.reply({ content: 'The blacklist is empty.', ephemeral: true });
            }

            var lines = entries.map((e, i) => {
                return '`' + (i + 1) + '.` **' + e.type.toUpperCase() + '** — `' + e.value + '`\n   Reason: ' + (e.reason || 'N/A') + ' | Added: <t:' + Math.floor(new Date(e.added_at).getTime() / 1000) + ':R>';
            });

            var embed = new EmbedBuilder()
                .setTitle('Blacklist — ' + entries.length + ' entries')
                .setColor(config.errorColor)
                .setDescription(lines.join('\n\n'))
                .setTimestamp();

            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
    }
};
