var { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, ChannelType } = require('discord.js');
var db = require('../../db/database');
var config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup')
        .setDescription('Interactive setup wizard to configure verification')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        var guildId = interaction.guildId;

        // grab existing config or create defaults
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
            auto_pull: 0,
            log_ip: 1,
            log_email: 1
        };

        // make sure new fields exist on old configs
        if (existing.log_ip === undefined) existing.log_ip = 1;
        if (existing.log_email === undefined) existing.log_email = 1;

        var steps = [];
        var currentStep = 0;

        // -- step helpers --
        function yesNoRow(yesId, noId) {
            return new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(yesId).setLabel('Yes').setStyle(ButtonStyle.Success).setEmoji('✅'),
                new ButtonBuilder().setCustomId(noId).setLabel('No').setStyle(ButtonStyle.Danger).setEmoji('❌')
            );
        }

        // start with an intro embed
        var introEmbed = new EmbedBuilder()
            .setTitle('⚙️ Verification Setup Wizard')
            .setDescription(
                'This wizard will walk you through configuring verification for **' + interaction.guild.name + '**.\n\n' +
                'I\'ll ask you a few questions — just click the buttons to answer.\n\n' +
                '> **Tip:** You can always change these later with `/config`'
            )
            .setColor(config.embedColor)
            .setThumbnail(interaction.guild.iconURL({ size: 256 }))
            .setFooter({ text: 'Step 1 of 6' });

        // step 1: log IP?
        var logIpRow = yesNoRow('setup_logip_yes', 'setup_logip_no');

        await interaction.reply({
            embeds: [
                introEmbed,
                new EmbedBuilder()
                    .setDescription('**📡 Do you want to log user IP addresses?**\nThis captures the IP of users when they verify.')
                    .setColor(0x5865F2)
            ],
            components: [logIpRow],
            ephemeral: true
        });

        var collector = interaction.channel.createMessageComponentCollector({
            filter: i => i.user.id === interaction.user.id && i.customId.startsWith('setup_'),
            time: 120000 // 2 min timeout
        });

        var step = 0;

        collector.on('collect', async i => {
            try {
                if (step === 0) {
                    // log IP answer
                    existing.log_ip = i.customId === 'setup_logip_yes' ? 1 : 0;
                    step++;

                    await i.update({
                        embeds: [
                            new EmbedBuilder()
                                .setTitle('⚙️ Verification Setup Wizard')
                                .setDescription('IP logging: ' + (existing.log_ip ? '✅ Enabled' : '❌ Disabled'))
                                .setColor(config.embedColor)
                                .setFooter({ text: 'Step 2 of 6' }),
                            new EmbedBuilder()
                                .setDescription('**📧 Do you want to log user emails?**\nThis captures the email from their Discord account.')
                                .setColor(0x5865F2)
                        ],
                        components: [yesNoRow('setup_logemail_yes', 'setup_logemail_no')]
                    });
                }

                else if (step === 1) {
                    // log email answer
                    existing.log_email = i.customId === 'setup_logemail_yes' ? 1 : 0;
                    step++;

                    await i.update({
                        embeds: [
                            new EmbedBuilder()
                                .setTitle('⚙️ Verification Setup Wizard')
                                .setDescription(
                                    'IP logging: ' + (existing.log_ip ? '✅ Enabled' : '❌ Disabled') + '\n' +
                                    'Email logging: ' + (existing.log_email ? '✅ Enabled' : '❌ Disabled')
                                )
                                .setColor(config.embedColor)
                                .setFooter({ text: 'Step 3 of 6' }),
                            new EmbedBuilder()
                                .setDescription('**🛡️ Do you want to block VPNs/Proxies?**\nUsers connecting through a VPN will be denied verification.')
                                .setColor(0x5865F2)
                        ],
                        components: [yesNoRow('setup_vpn_yes', 'setup_vpn_no')]
                    });
                }

                else if (step === 2) {
                    // vpn block answer
                    existing.vpn_block = i.customId === 'setup_vpn_yes' ? 1 : 0;
                    step++;

                    // now ask them to mention the verify channel
                    await i.update({
                        embeds: [
                            new EmbedBuilder()
                                .setTitle('⚙️ Verification Setup Wizard')
                                .setDescription(
                                    'IP logging: ' + (existing.log_ip ? '✅ Enabled' : '❌ Disabled') + '\n' +
                                    'Email logging: ' + (existing.log_email ? '✅ Enabled' : '❌ Disabled') + '\n' +
                                    'VPN blocking: ' + (existing.vpn_block ? '✅ Enabled' : '❌ Disabled')
                                )
                                .setColor(config.embedColor)
                                .setFooter({ text: 'Step 4 of 6' }),
                            new EmbedBuilder()
                                .setDescription('**📝 Type the channel where you want the verification panel sent.**\nMention it like `#verify` in the chat below.')
                                .setColor(0x5865F2)
                        ],
                        components: []
                    });

                    // collect a message for the channel
                    var msgCollector = interaction.channel.createMessageCollector({
                        filter: m => m.author.id === interaction.user.id,
                        max: 1,
                        time: 60000
                    });

                    msgCollector.on('collect', async msg => {
                        var ch = msg.mentions.channels.first() || interaction.guild.channels.cache.find(c => c.name === msg.content.replace('#', '').trim());
                        if (!ch) {
                            // try to find by ID
                            ch = interaction.guild.channels.cache.get(msg.content.trim());
                        }

                        // delete their message to keep things clean
                        await msg.delete().catch(() => {});

                        if (!ch) {
                            await interaction.editReply({
                                embeds: [
                                    new EmbedBuilder()
                                        .setTitle('❌ Setup Failed')
                                        .setDescription('Could not find that channel. Run `/setup` again.')
                                        .setColor(config.errorColor)
                                ],
                                components: []
                            });
                            collector.stop();
                            return;
                        }

                        existing._verifyChannel = ch.id;
                        step++;

                        // step 5: ask for log channel
                        await interaction.editReply({
                            embeds: [
                                new EmbedBuilder()
                                    .setTitle('⚙️ Verification Setup Wizard')
                                    .setDescription(
                                        'IP logging: ' + (existing.log_ip ? '✅ Enabled' : '❌ Disabled') + '\n' +
                                        'Email logging: ' + (existing.log_email ? '✅ Enabled' : '❌ Disabled') + '\n' +
                                        'VPN blocking: ' + (existing.vpn_block ? '✅ Enabled' : '❌ Disabled') + '\n' +
                                        'Verify channel: <#' + ch.id + '>'
                                    )
                                    .setColor(config.embedColor)
                                    .setFooter({ text: 'Step 5 of 6' }),
                                new EmbedBuilder()
                                    .setDescription('**📋 Do you want to set a log channel?**\nVerification events will be logged here.')
                                    .setColor(0x5865F2)
                            ],
                            components: [yesNoRow('setup_logch_yes', 'setup_logch_no')]
                        });
                    });

                    msgCollector.on('end', (collected, reason) => {
                        if (reason === 'time' && collected.size === 0) {
                            interaction.editReply({
                                embeds: [
                                    new EmbedBuilder()
                                        .setTitle('⏰ Setup Timed Out')
                                        .setDescription('You took too long. Run `/setup` again.')
                                        .setColor(config.errorColor)
                                ],
                                components: []
                            }).catch(() => {});
                            collector.stop();
                        }
                    });
                }

                else if (step === 4) {
                    // log channel yes/no
                    if (i.customId === 'setup_logch_yes') {
                        step = 5; // waiting for log channel message
                        await i.update({
                            embeds: [
                                new EmbedBuilder()
                                    .setTitle('⚙️ Verification Setup Wizard')
                                    .setDescription(
                                        'IP logging: ' + (existing.log_ip ? '✅ Enabled' : '❌ Disabled') + '\n' +
                                        'Email logging: ' + (existing.log_email ? '✅ Enabled' : '❌ Disabled') + '\n' +
                                        'VPN blocking: ' + (existing.vpn_block ? '✅ Enabled' : '❌ Disabled') + '\n' +
                                        'Verify channel: <#' + existing._verifyChannel + '>'
                                    )
                                    .setColor(config.embedColor)
                                    .setFooter({ text: 'Step 5 of 6' }),
                                new EmbedBuilder()
                                    .setDescription('**📋 Mention the log channel** (e.g. `#logs`)')
                                    .setColor(0x5865F2)
                            ],
                            components: []
                        });

                        var logMsgCollector = interaction.channel.createMessageCollector({
                            filter: m => m.author.id === interaction.user.id,
                            max: 1,
                            time: 60000
                        });

                        logMsgCollector.on('collect', async msg => {
                            var logCh = msg.mentions.channels.first() || interaction.guild.channels.cache.find(c => c.name === msg.content.replace('#', '').trim());
                            if (!logCh) logCh = interaction.guild.channels.cache.get(msg.content.trim());
                            await msg.delete().catch(() => {});

                            if (logCh) {
                                existing.log_channel = logCh.id;
                            }

                            // ask for verified role
                            step = 6;
                            await interaction.editReply({
                                embeds: [
                                    new EmbedBuilder()
                                        .setTitle('⚙️ Verification Setup Wizard')
                                        .setDescription(
                                            'IP logging: ' + (existing.log_ip ? '✅ Enabled' : '❌ Disabled') + '\n' +
                                            'Email logging: ' + (existing.log_email ? '✅ Enabled' : '❌ Disabled') + '\n' +
                                            'VPN blocking: ' + (existing.vpn_block ? '✅ Enabled' : '❌ Disabled') + '\n' +
                                            'Verify channel: <#' + existing._verifyChannel + '>\n' +
                                            'Log channel: ' + (existing.log_channel ? '<#' + existing.log_channel + '>' : 'None')
                                        )
                                        .setColor(config.embedColor)
                                        .setFooter({ text: 'Step 6 of 6' }),
                                    new EmbedBuilder()
                                        .setDescription('**🏷️ Mention the role to give verified users** (e.g. `@Verified`)')
                                        .setColor(0x5865F2)
                                ],
                                components: []
                            });

                            var roleMsgCollector = interaction.channel.createMessageCollector({
                                filter: m => m.author.id === interaction.user.id,
                                max: 1,
                                time: 60000
                            });

                            roleMsgCollector.on('collect', async rmsg => {
                                var role = rmsg.mentions.roles.first() || interaction.guild.roles.cache.find(r => r.name.toLowerCase() === rmsg.content.trim().toLowerCase());
                                if (!role) role = interaction.guild.roles.cache.get(rmsg.content.trim());
                                await rmsg.delete().catch(() => {});

                                if (role) {
                                    existing.verified_role = role.id;
                                }

                                // finalize
                                await finishSetup(interaction, existing);
                                collector.stop('done');
                            });

                            roleMsgCollector.on('end', (collected, reason) => {
                                if (reason === 'time' && collected.size === 0) {
                                    // still finish with whatever we have
                                    finishSetup(interaction, existing);
                                    collector.stop('done');
                                }
                            });
                        });
                    } else {
                        // no log channel, skip to role
                        step = 6;
                        await i.update({
                            embeds: [
                                new EmbedBuilder()
                                    .setTitle('⚙️ Verification Setup Wizard')
                                    .setDescription(
                                        'IP logging: ' + (existing.log_ip ? '✅ Enabled' : '❌ Disabled') + '\n' +
                                        'Email logging: ' + (existing.log_email ? '✅ Enabled' : '❌ Disabled') + '\n' +
                                        'VPN blocking: ' + (existing.vpn_block ? '✅ Enabled' : '❌ Disabled') + '\n' +
                                        'Verify channel: <#' + existing._verifyChannel + '>\n' +
                                        'Log channel: None'
                                    )
                                    .setColor(config.embedColor)
                                    .setFooter({ text: 'Step 6 of 6' }),
                                new EmbedBuilder()
                                    .setDescription('**🏷️ Mention the role to give verified users** (e.g. `@Verified`)')
                                    .setColor(0x5865F2)
                            ],
                            components: []
                        });

                        var roleMsgCollector2 = interaction.channel.createMessageCollector({
                            filter: m => m.author.id === interaction.user.id,
                            max: 1,
                            time: 60000
                        });

                        roleMsgCollector2.on('collect', async rmsg => {
                            var role = rmsg.mentions.roles.first() || interaction.guild.roles.cache.find(r => r.name.toLowerCase() === rmsg.content.trim().toLowerCase());
                            if (!role) role = interaction.guild.roles.cache.get(rmsg.content.trim());
                            await rmsg.delete().catch(() => {});

                            if (role) {
                                existing.verified_role = role.id;
                            }

                            await finishSetup(interaction, existing);
                            collector.stop('done');
                        });

                        roleMsgCollector2.on('end', (collected, reason) => {
                            if (reason === 'time' && collected.size === 0) {
                                finishSetup(interaction, existing);
                                collector.stop('done');
                            }
                        });
                    }
                }
            } catch(err) {
                console.error('[setup] wizard error:', err);
            }
        });

        collector.on('end', (collected, reason) => {
            if (reason === 'time') {
                interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle('⏰ Setup Timed Out')
                            .setDescription('You took too long. Run `/setup` again.')
                            .setColor(config.errorColor)
                    ],
                    components: []
                }).catch(() => {});
            }
        });
    }
};

async function finishSetup(interaction, existing) {
    var verifyChannelId = existing._verifyChannel;
    delete existing._verifyChannel;

    // save config
    db.setConfig(existing);

    // send verification panel to the chosen channel
    var channel = interaction.guild.channels.cache.get(verifyChannelId);
    if (channel) {
        var panelEmbed = new EmbedBuilder()
            .setTitle('Verification')
            .setDescription('Click the button below to verify and gain access to the server.')
            .setColor(parseInt((existing.custom_color || '#5865F2').replace('#', ''), 16) || config.embedColor)
            .setThumbnail(interaction.guild.iconURL({ size: 256 }))
            .setFooter({ text: interaction.guild.name + ' • Verification', iconURL: interaction.guild.iconURL() });

        // use a non-link button so each click generates a fresh OAuth URL
        var row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('verify_btn')
                .setLabel('Verify')
                .setStyle(ButtonStyle.Success)
                .setEmoji('✅')
        );

        await channel.send({ embeds: [panelEmbed], components: [row] });
    }

    // show final summary
    var summary = new EmbedBuilder()
        .setTitle('✅ Setup Complete!')
        .setDescription('Your verification system is now configured.')
        .setColor(config.successColor)
        .addFields(
            { name: 'IP Logging', value: existing.log_ip ? '✅ Enabled' : '❌ Disabled', inline: true },
            { name: 'Email Logging', value: existing.log_email ? '✅ Enabled' : '❌ Disabled', inline: true },
            { name: 'VPN Blocking', value: existing.vpn_block ? '✅ Enabled' : '❌ Disabled', inline: true },
            { name: 'Verify Channel', value: verifyChannelId ? '<#' + verifyChannelId + '>' : 'Not set', inline: true },
            { name: 'Log Channel', value: existing.log_channel ? '<#' + existing.log_channel + '>' : 'Not set', inline: true },
            { name: 'Verified Role', value: existing.verified_role ? '<@&' + existing.verified_role + '>' : 'Not set', inline: true }
        )
        .setFooter({ text: 'You can change settings anytime with /config' })
        .setTimestamp();

    await interaction.editReply({ embeds: [summary], components: [] });
}
