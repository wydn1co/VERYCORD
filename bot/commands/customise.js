var { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
var db = require('../../db/database');
var config = require('../../config');
var fetch = require('node-fetch');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('customise')
        .setDescription('Customise the bot appearance for this server')
        .addSubcommand(sub =>
            sub.setName('name')
                .setDescription('Set the bot nickname in this server')
                .addStringOption(opt =>
                    opt.setName('nickname')
                        .setDescription('The nickname to display (leave empty to reset)')
                        .setRequired(false)
                )
        )
        .addSubcommand(sub =>
            sub.setName('avatar')
                .setDescription('Set the bot per-server avatar')
                .addAttachmentOption(opt =>
                    opt.setName('image')
                        .setDescription('Image to use as avatar (leave empty to reset)')
                        .setRequired(false)
                )
                .addStringOption(opt =>
                    opt.setName('url')
                        .setDescription('Image URL to use as avatar')
                        .setRequired(false)
                )
        )
        .addSubcommand(sub =>
            sub.setName('bio')
                .setDescription('Set a custom description shown on the verification panel')
                .addStringOption(opt =>
                    opt.setName('text')
                        .setDescription('Custom panel description (leave empty to reset)')
                        .setRequired(false)
                )
        )
        .addSubcommand(sub =>
            sub.setName('color')
                .setDescription('Set the embed color for the verification panel')
                .addStringOption(opt =>
                    opt.setName('hex')
                        .setDescription('Hex color code like #5865F2 (leave empty to reset)')
                        .setRequired(false)
                )
        )
        .addSubcommand(sub =>
            sub.setName('view')
                .setDescription('View current customisation settings')
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction, client) {
        var sub = interaction.options.getSubcommand();
        var guildId = interaction.guildId;

        var existing = db.getConfig(guildId) || {
            guild_id: guildId,
            log_channel: null,
            verified_role: null,
            unverified_role: null,
            welcome_msg: null,
            vpn_block: 1,
            custom_redirect: null,
            custom_brand: null,
            custom_color: '#5865F2',
            custom_bio: null,
            auto_pull: 0,
            log_ip: 1,
            log_email: 1
        };

        if (!existing.custom_bio) existing.custom_bio = null;

        if (sub === 'name') {
            var nickname = interaction.options.getString('nickname') || null;

            try {
                var me = await interaction.guild.members.fetchMe();
                await me.setNickname(nickname);
                if (nickname) {
                    await interaction.reply({ content: '✅ Bot nickname set to **' + nickname + '**', ephemeral: true });
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
                var me = await interaction.guild.members.fetchMe();

                if (!imageUrl) {
                    // reset per-guild avatar
                    await me.setAvatar(null);
                    await interaction.editReply({ content: '✅ Bot server avatar reset to default' });
                    return;
                }

                // fetch the image and convert to buffer
                var res = await fetch(imageUrl);
                if (!res.ok) {
                    await interaction.editReply({ content: '❌ Could not download that image' });
                    return;
                }

                var buf = await res.buffer();
                await me.setAvatar(buf);
                await interaction.editReply({ content: '✅ Bot server avatar updated!' });
            } catch(err) {
                var msg = err.message || '';
                if (msg.includes('boosts') || msg.includes('MEMBER_AVATAR') || err.code === 50083) {
                    await interaction.editReply({ content: '❌ Per-server avatars require the server to have boost level 2+' });
                } else {
                    await interaction.editReply({ content: '❌ Failed to set avatar: ' + msg });
                }
            }
        }

        else if (sub === 'bio') {
            var text = interaction.options.getString('text') || null;
            existing.custom_bio = text;
            db.setConfig(existing);

            if (text) {
                await interaction.reply({ content: '✅ Verification panel description set to:\n> ' + text, ephemeral: true });
            } else {
                await interaction.reply({ content: '✅ Verification panel description reset to default', ephemeral: true });
            }
        }

        else if (sub === 'color') {
            var hex = interaction.options.getString('hex');

            if (!hex) {
                existing.custom_color = '#5865F2';
                db.setConfig(existing);
                await interaction.reply({ content: '✅ Embed color reset to default', ephemeral: true });
                return;
            }

            // validate hex
            hex = hex.trim();
            if (!hex.startsWith('#')) hex = '#' + hex;
            if (!/^#[0-9a-fA-F]{6}$/.test(hex)) {
                await interaction.reply({ content: '❌ Invalid hex color. Use format like `#5865F2`', ephemeral: true });
                return;
            }

            existing.custom_color = hex;
            db.setConfig(existing);

            var colorInt = parseInt(hex.replace('#', ''), 16);
            var preview = new EmbedBuilder()
                .setDescription('✅ Embed color set to **' + hex + '**')
                .setColor(colorInt);

            await interaction.reply({ embeds: [preview], ephemeral: true });
        }

        else if (sub === 'view') {
            var me = await interaction.guild.members.fetchMe();
            var nickname = me.nickname || client.user.username;

            var embed = new EmbedBuilder()
                .setTitle('🎨 Customisation Settings')
                .setColor(parseInt((existing.custom_color || '#5865F2').replace('#', ''), 16) || config.embedColor)
                .addFields(
                    { name: 'Bot Nickname', value: me.nickname || '*Default*', inline: true },
                    { name: 'Embed Color', value: existing.custom_color || '#5865F2', inline: true },
                    { name: 'Brand Name', value: existing.custom_brand || interaction.guild.name, inline: true },
                    { name: 'Panel Description', value: existing.custom_bio || '*Default — Click the button below to verify and gain access to the server.*', inline: false }
                )
                .setThumbnail(me.displayAvatarURL({ size: 256 }))
                .setFooter({ text: 'Use /customise <option> to change these' })
                .setTimestamp();

            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
    }
};
