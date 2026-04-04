var { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
var fetch = require('node-fetch');
var db = require('../../db/database');
var config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('customise')
        .setDescription('Change the bot appearance in this server')
        .addSubcommand(sub =>
            sub.setName('name')
                .setDescription('Change the bot nickname in this server')
                .addStringOption(opt =>
                    opt.setName('nickname')
                        .setDescription('New nickname (leave empty to reset)')
                        .setRequired(false)
                )
        )
        .addSubcommand(sub =>
            sub.setName('avatar')
                .setDescription('Change the bot avatar for this server')
                .addAttachmentOption(opt =>
                    opt.setName('image')
                        .setDescription('Upload an image (leave empty to reset)')
                        .setRequired(false)
                )
                .addStringOption(opt =>
                    opt.setName('url')
                        .setDescription('Or paste an image URL')
                        .setRequired(false)
                )
        )
        .addSubcommand(sub =>
            sub.setName('bio')
                .setDescription('Set a custom bot description for this server')
                .addStringOption(opt =>
                    opt.setName('text')
                        .setDescription('Bot description (leave empty to clear)')
                        .setRequired(false)
                )
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction, client) {
        var sub = interaction.options.getSubcommand();
        var guildId = interaction.guildId;

        if (sub === 'name') {
            var nickname = interaction.options.getString('nickname') || null;

            try {
                var me = await interaction.guild.members.fetchMe();
                await me.setNickname(nickname);

                if (nickname) {
                    await interaction.reply({ content: '✅ Bot nickname changed to **' + nickname + '** in this server', ephemeral: true });
                } else {
                    await interaction.reply({ content: '✅ Bot nickname reset to default in this server', ephemeral: true });
                }
            } catch(err) {
                await interaction.reply({ content: '❌ Failed to change nickname: ' + err.message, ephemeral: true });
            }
        }

        else if (sub === 'avatar') {
            await interaction.deferReply({ ephemeral: true });

            var attachment = interaction.options.getAttachment('image');
            var url = interaction.options.getString('url');
            var imageUrl = attachment ? attachment.url : url;

            try {
                var me = await interaction.guild.members.fetchMe();

                if (!imageUrl) {
                    var resApi = await fetch('https://discord.com/api/v10/guilds/' + interaction.guildId + '/members/@me', {
                        method: 'PATCH',
                        headers: {
                            'Authorization': 'Bot ' + config.token,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ avatar: null })
                    });
                    
                    if (!resApi.ok) throw new Error('API error reset avatar');
                    
                    await interaction.editReply({ content: '✅ Bot avatar reset to default in this server' });
                    return;
                }

                var res = await fetch(imageUrl);
                if (!res.ok) {
                    await interaction.editReply({ content: '❌ Could not download that image' });
                    return;
                }

                var buf = await res.buffer();
                var dataUri = 'data:image/png;base64,' + buf.toString('base64');
                
                var resApi2 = await fetch('https://discord.com/api/v10/guilds/' + interaction.guildId + '/members/@me', {
                    method: 'PATCH',
                    headers: {
                        'Authorization': 'Bot ' + config.token,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ avatar: dataUri })
                });

                if (!resApi2.ok) {
                    var body = await resApi2.json().catch(()=>({}));
                    throw new Error(body.message || 'Unknown API error');
                }

                await interaction.editReply({ content: '✅ Bot avatar updated for this server!' });
            } catch(err) {
                var msg = err.message || '';
                if (msg.includes('boost') || msg.includes('GUILD_PREMIUM') || err.code === 50083 || err.code === 10057) {
                    await interaction.editReply({ content: '❌ Per-server avatars require this server to have **Boost Level 2** or higher' });
                } else {
                    await interaction.editReply({ content: '❌ Failed to set avatar: ' + msg });
                }
            }
        }

        else if (sub === 'bio') {
            var text = interaction.options.getString('text') || null;

            var existing = db.getConfig(guildId) || { guild_id: guildId };
            existing.custom_bio = text;
            db.setConfig(existing);

            if (text) {
                await interaction.reply({ content: '✅ Bot description for this server set to:\n> ' + text, ephemeral: true });
            } else {
                await interaction.reply({ content: '✅ Bot description cleared for this server', ephemeral: true });
            }
        }
    }
};
