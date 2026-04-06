var { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
var fetch = require('node-fetch');
var db = require('../../db/database');
var config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('whitelist')
        .setDescription('Manage server whitelist (bot owner only)')
        .addSubcommand(sub =>
            sub.setName('add')
                .setDescription('Whitelist a server by guild ID')
                .addStringOption(opt =>
                    opt.setName('guild_id')
                        .setDescription('The server guild ID')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub.setName('add-invite')
                .setDescription('Whitelist a server by invite link')
                .addStringOption(opt =>
                    opt.setName('invite')
                        .setDescription('Discord invite link or code')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub.setName('remove')
                .setDescription('Remove a server from whitelist')
                .addStringOption(opt =>
                    opt.setName('guild_id')
                        .setDescription('The server guild ID')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub.setName('list')
                .setDescription('Show all whitelisted servers')
        ),

    async execute(interaction, client) {
        // owner only
        if (interaction.user.id !== config.ownerId) {
            return interaction.reply({ content: '❌ Only the bot owner can use this command.', ephemeral: true });
        }

        var sub = interaction.options.getSubcommand();

        if (sub === 'add') {
            var guildId = interaction.options.getString('guild_id').trim();
            var added = db.addWhitelist(guildId, interaction.user.id);

            if (added) {
                // try to get server name
                var guildName = guildId;
                try {
                    var guild = await client.guilds.fetch(guildId);
                    guildName = guild.name + ' (' + guildId + ')';
                } catch(e) {}

                await interaction.reply({ content: '✅ Server **' + guildName + '** has been whitelisted.', ephemeral: true });
            } else {
                await interaction.reply({ content: '⚠️ That server is already whitelisted.', ephemeral: true });
            }
        }

        else if (sub === 'add-invite') {
            await interaction.deferReply({ ephemeral: true });
            var invite = interaction.options.getString('invite').trim();

            // extract invite code from URL
            var code = invite.replace(/https?:\/\/(www\.)?discord\.(gg|com\/invite)\//i, '').split('/')[0].split('?')[0];

            try {
                var res = await fetch('https://discord.com/api/v10/invites/' + code + '?with_counts=true', {
                    headers: { 'Authorization': 'Bot ' + config.token }
                });

                if (!res.ok) {
                    return interaction.editReply({ content: '❌ Invalid or expired invite link.' });
                }

                var data = await res.json();
                var guildId = data.guild.id;
                var guildName = data.guild.name;

                var added = db.addWhitelist(guildId, interaction.user.id);
                if (added) {
                    await interaction.editReply({ content: '✅ Server **' + guildName + '** (`' + guildId + '`) has been whitelisted.' });
                } else {
                    await interaction.editReply({ content: '⚠️ **' + guildName + '** is already whitelisted.' });
                }
            } catch(err) {
                await interaction.editReply({ content: '❌ Failed to resolve invite: ' + err.message });
            }
        }

        else if (sub === 'remove') {
            var guildId = interaction.options.getString('guild_id').trim();
            var removed = db.removeWhitelist(guildId);

            if (removed) {
                await interaction.reply({ content: '✅ Server `' + guildId + '` has been removed from the whitelist.', ephemeral: true });
            } else {
                await interaction.reply({ content: '⚠️ That server was not whitelisted.', ephemeral: true });
            }
        }

        else if (sub === 'list') {
            var all = db.getWhitelistAll();

            if (all.length === 0) {
                return interaction.reply({ content: '📋 No servers are whitelisted yet. Use `/whitelist add` to add one.', ephemeral: true });
            }

            var lines = [];
            for (var i = 0; i < all.length; i++) {
                var w = all[i];
                var name = w.guild_id;
                try {
                    var guild = client.guilds.cache.get(w.guild_id);
                    if (guild) name = guild.name + ' (`' + w.guild_id + '`)';
                } catch(e) {}

                var date = new Date(w.added_at).toLocaleDateString();
                lines.push('**' + (i + 1) + '.** ' + name + ' — added ' + date);
            }

            var embed = new EmbedBuilder()
                .setTitle('📋 Whitelisted Servers')
                .setDescription(lines.join('\n'))
                .setColor(config.embedColor)
                .setFooter({ text: all.length + ' server(s) whitelisted' });

            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
    }
};
