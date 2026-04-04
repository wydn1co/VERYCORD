var { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
var db = require('../../db/database');
var config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('config')
        .setDescription('Configure bot settings for this server')
        .addSubcommand(sub =>
            sub.setName('logchannel')
                .setDescription('Set the channel for verification logs')
                .addChannelOption(opt =>
                    opt.setName('channel')
                        .setDescription('The log channel')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub.setName('verifiedrole')
                .setDescription('Set the role given to verified members')
                .addRoleOption(opt =>
                    opt.setName('role')
                        .setDescription('The verified role')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub.setName('unverifiedrole')
                .setDescription('Set the role for unverified members')
                .addRoleOption(opt =>
                    opt.setName('role')
                        .setDescription('The unverified role')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub.setName('vpnblock')
                .setDescription('Toggle VPN/proxy blocking')
                .addBooleanOption(opt =>
                    opt.setName('enabled')
                        .setDescription('Block VPN users from verifying')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub.setName('welcome')
                .setDescription('Set a custom welcome message after verification')
                .addStringOption(opt =>
                    opt.setName('message')
                        .setDescription('Welcome message (use {user} for mention)')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub.setName('brand')
                .setDescription('Set custom branding for the verification page')
                .addStringOption(opt =>
                    opt.setName('name')
                        .setDescription('Custom server name on the verification page')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub.setName('logip')
                .setDescription('Toggle IP address logging')
                .addBooleanOption(opt =>
                    opt.setName('enabled')
                        .setDescription('Log user IP addresses during verification')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub.setName('altblock')
                .setDescription('Toggle automatic Alt Account blocking')
                .addBooleanOption(opt =>
                    opt.setName('enabled')
                        .setDescription('Block verifying duplicate accounts originating from the same IP address')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub.setName('logemail')
                .setDescription('Toggle email logging')
                .addBooleanOption(opt =>
                    opt.setName('enabled')
                        .setDescription('Log user emails during verification')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub.setName('view')
                .setDescription('View all current configuration')
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        var sub = interaction.options.getSubcommand();
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

        // ensure new fields exist on old configs
        if (existing.log_ip === undefined) existing.log_ip = 1;
        if (existing.log_email === undefined) existing.log_email = 1;

        if (sub === 'logchannel') {
            var ch = interaction.options.getChannel('channel');
            existing.log_channel = ch.id;
            db.setConfig(existing);
            await interaction.reply({ content: '✅ Log channel set to <#' + ch.id + '>', ephemeral: true });
        }

        else if (sub === 'verifiedrole') {
            var role = interaction.options.getRole('role');
            existing.verified_role = role.id;
            db.setConfig(existing);
            await interaction.reply({ content: '✅ Verified role set to <@&' + role.id + '>', ephemeral: true });
        }

        else if (sub === 'unverifiedrole') {
            var role = interaction.options.getRole('role');
            existing.unverified_role = role.id;
            db.setConfig(existing);
            await interaction.reply({ content: '✅ Unverified role set to <@&' + role.id + '>', ephemeral: true });
        }

        else if (sub === 'vpnblock') {
            var enabled = interaction.options.getBoolean('enabled');
            existing.vpn_block = enabled ? 1 : 0;
            db.setConfig(existing);
            await interaction.reply({ content: '✅ VPN blocking ' + (enabled ? 'enabled' : 'disabled'), ephemeral: true });
        }

        else if (sub === 'welcome') {
            var msg = interaction.options.getString('message');
            existing.welcome_msg = msg;
            db.setConfig(existing);
            await interaction.reply({ content: '✅ Welcome message updated.', ephemeral: true });
        }

        else if (sub === 'brand') {
            var name = interaction.options.getString('name');
            existing.custom_brand = name;
            db.setConfig(existing);
            await interaction.reply({ content: '✅ Brand name set to **' + name + '**', ephemeral: true });
        }

        else if (sub === 'logip') {
            var enabled = interaction.options.getBoolean('enabled');
            existing.log_ip = enabled ? 1 : 0;
            db.setConfig(existing);
            await interaction.reply({ content: '✅ IP logging ' + (enabled ? 'enabled' : 'disabled'), ephemeral: true });
        }

        else if (sub === 'logemail') {
            var enabled = interaction.options.getBoolean('enabled');
            existing.log_email = enabled ? 1 : 0;
            db.setConfig(existing);
            await interaction.reply({ content: '✅ Email logging ' + (enabled ? 'enabled' : 'disabled'), ephemeral: true });
        }
        
        else if (sub === 'altblock') {
            var enabled = interaction.options.getBoolean('enabled');
            existing.alt_block = enabled ? 1 : 0;
            db.setConfig(existing);
            await interaction.reply({ content: '✅ Alt account blocking ' + (enabled ? 'enabled' : 'disabled'), ephemeral: true });
        }

        else if (sub === 'view') {
            var cfg = db.getConfig(guildId);
            if (!cfg) {
                return interaction.reply({ content: 'No config set yet. Use the other subcommands to configure.', ephemeral: true });
            }

            var embed = new EmbedBuilder()
                .setTitle('Server Configuration')
                .setColor(config.embedColor)
                .addFields(
                    { name: 'Log Channel', value: cfg.log_channel ? '<#' + cfg.log_channel + '>' : 'Not set', inline: true },
                    { name: 'Verified Role', value: cfg.verified_role ? '<@&' + cfg.verified_role + '>' : 'Not set', inline: true },
                    { name: 'Unverified Role', value: cfg.unverified_role ? '<@&' + cfg.unverified_role + '>' : 'Not set', inline: true },
                    { name: 'VPN Block', value: cfg.vpn_block ? '✅ Enabled' : '❌ Disabled', inline: true },
                    { name: 'Alt Block', value: cfg.alt_block ? '✅ Enabled' : '❌ Disabled', inline: true },
                    { name: 'Log IP', value: (cfg.log_ip === undefined || cfg.log_ip) ? '✅ Enabled' : '❌ Disabled', inline: true },
                    { name: 'Log Email', value: (cfg.log_email === undefined || cfg.log_email) ? '✅ Enabled' : '❌ Disabled', inline: true },
                    { name: 'Brand Name', value: cfg.custom_brand || interaction.guild.name, inline: true },
                    { name: 'Welcome Message', value: cfg.welcome_msg || 'Default', inline: true }
                )
                .setTimestamp();

            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
    }
};
