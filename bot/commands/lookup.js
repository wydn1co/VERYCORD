var { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
var db = require('../../db/database');
var config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('lookup')
        .setDescription('Reverse lookup verified users by IP or email')
        .addSubcommand(sub =>
            sub.setName('ip')
                .setDescription('Find users with a specific IP')
                .addStringOption(opt =>
                    opt.setName('address')
                        .setDescription('IP address to search')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub.setName('email')
                .setDescription('Find users with a specific email')
                .addStringOption(opt =>
                    opt.setName('address')
                        .setDescription('Email to search')
                        .setRequired(true)
                )
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        var sub = interaction.options.getSubcommand();

        if (sub === 'ip') {
            var ip = interaction.options.getString('address');
            var results = db.getUsersByIp(ip);

            if (results.length === 0) {
                return interaction.reply({ content: '❌ No users found with IP `' + ip + '`', ephemeral: true });
            }

            var lines = results.map(r => {
                return '• <@' + r.user_id + '> (`' + r.username + '`) — Guild: `' + r.guild_id + '`';
            });

            var embed = new EmbedBuilder()
                .setTitle('IP Lookup — ' + ip)
                .setColor(config.warnColor)
                .setDescription(lines.join('\n'))
                .setFooter({ text: results.length + ' result(s)' })
                .setTimestamp();

            await interaction.reply({ embeds: [embed], ephemeral: true });
        }

        if (sub === 'email') {
            var email = interaction.options.getString('address');
            var results = db.getUsersByEmail(email);

            if (results.length === 0) {
                return interaction.reply({ content: '❌ No users found with email `' + email + '`', ephemeral: true });
            }

            var lines = results.map(r => {
                return '• <@' + r.user_id + '> (`' + r.username + '`) — Guild: `' + r.guild_id + '`';
            });

            var embed = new EmbedBuilder()
                .setTitle('Email Lookup')
                .setColor(config.warnColor)
                .setDescription(lines.join('\n'))
                .setFooter({ text: results.length + ' result(s)' })
                .setTimestamp();

            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
    }
};
