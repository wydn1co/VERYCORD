var { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
var fetch = require('node-fetch');
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
                .setDescription('Change the bot avatar')
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
                .setDescription('Change the bot about me / bio')
                .addStringOption(opt =>
                    opt.setName('text')
                        .setDescription('New bio text (leave empty to clear)')
                        .setRequired(false)
                )
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction, client) {
        var sub = interaction.options.getSubcommand();

        if (sub === 'name') {
            var nickname = interaction.options.getString('nickname') || null;

            try {
                var me = await interaction.guild.members.fetchMe();
                await me.setNickname(nickname);

                if (nickname) {
                    await interaction.reply({ content: '✅ Bot nickname changed to **' + nickname + '**', ephemeral: true });
                } else {
                    await interaction.reply({ content: '✅ Bot nickname reset to default', ephemeral: true });
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
                if (!imageUrl) {
                    // reset avatar to default
                    await client.user.setAvatar(null);
                    await interaction.editReply({ content: '✅ Bot avatar reset to default' });
                    return;
                }

                // download the image
                var res = await fetch(imageUrl);
                if (!res.ok) {
                    await interaction.editReply({ content: '❌ Could not download that image' });
                    return;
                }

                var buf = await res.buffer();
                await client.user.setAvatar(buf);
                await interaction.editReply({ content: '✅ Bot avatar updated!' });
            } catch(err) {
                await interaction.editReply({ content: '❌ Failed to set avatar: ' + err.message });
            }
        }

        else if (sub === 'bio') {
            await interaction.deferReply({ ephemeral: true });

            var text = interaction.options.getString('text') || '';

            try {
                // discord.js doesn't have a direct method for bio, use REST API
                var res = await fetch('https://discord.com/api/v10/users/@me', {
                    method: 'PATCH',
                    headers: {
                        'Authorization': 'Bot ' + config.token,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ bio: text })
                });

                if (res.ok) {
                    if (text) {
                        await interaction.editReply({ content: '✅ Bot bio updated to:\n> ' + text });
                    } else {
                        await interaction.editReply({ content: '✅ Bot bio cleared' });
                    }
                } else {
                    var body = await res.json().catch(() => ({}));
                    await interaction.editReply({ content: '❌ Failed to update bio: ' + (body.message || 'Unknown error') });
                }
            } catch(err) {
                await interaction.editReply({ content: '❌ Failed to update bio: ' + err.message });
            }
        }
    }
};
