var { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
var fs = require('fs');
var path = require('path');
var crypto = require('crypto');

var backupDir = path.resolve(__dirname, '../../data/backups');
if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

module.exports = {
    data: new SlashCommandBuilder()
        .setName('backup')
        .setDescription('Backup or visually clone a server')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub =>
            sub.setName('create')
                .setDescription('Create a backup of the current server')
                .addBooleanOption(opt => opt.setName('roles').setDescription('Backup roles?').setRequired(false))
                .addBooleanOption(opt => opt.setName('channels').setDescription('Backup channels?').setRequired(false))
                .addBooleanOption(opt => opt.setName('messages').setDescription('Backup recent messages?').setRequired(false))
        )
        .addSubcommand(sub =>
            sub.setName('load')
                .setDescription('Load a backup into the current server (Warning: this modifies your server)')
                .addStringOption(opt => opt.setName('id').setDescription('The Backup ID to load').setRequired(true))
                .addBooleanOption(opt => opt.setName('clear').setDescription('Clear existing channels and roles first?').setRequired(false))
        ),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: false });

        var sub = interaction.options.getSubcommand();
        var guild = interaction.guild;

        if (sub === 'create') {
            await interaction.editReply('⏳ Starting server backup... This may take a moment.');

            var optRoles = interaction.options.getBoolean('roles') ?? true;
            var optChannels = interaction.options.getBoolean('channels') ?? true;
            var optMessages = interaction.options.getBoolean('messages') ?? true;

            var backupData = {
                id: crypto.randomBytes(4).toString('hex'),
                guildName: guild.name,
                icon: guild.iconURL(),
                createdAt: new Date().toISOString(),
                roles: [],
                categories: [],
                channels: []
            };

            // 1. Roles
            if (optRoles) {
                var roles = guild.roles.cache.filter(r => !r.managed && r.name !== '@everyone').sort((a, b) => b.position - a.position);
                roles.forEach(r => {
                    backupData.roles.push({
                        oldId: r.id,
                        name: r.name,
                        color: r.hexColor,
                        hoist: r.hoist,
                        permissions: r.permissions.bitfield.toString(),
                        mentionable: r.mentionable
                    });
                });
            }

            // 2. Channels & Categories
            if (optChannels) {
                var categories = guild.channels.cache.filter(c => c.type === ChannelType.GuildCategory).sort((a, b) => a.position - b.position);
                categories.forEach(c => {
                    backupData.categories.push({
                        oldId: c.id,
                        name: c.name
                    });
                });

                var channels = guild.channels.cache.filter(c => c.type !== ChannelType.GuildCategory).sort((a, b) => a.position - b.position);
                for (var [, c] of channels) {
                    var channelData = {
                        oldId: c.id,
                        type: c.type,
                        name: c.name,
                        parentId: c.parentId,
                        topic: c.topic,
                        nsfw: c.nsfw,
                        bitrate: c.bitrate,
                        userLimit: c.userLimit,
                        messages: []
                    };

                    // 3. Messages (Optional)
                    if (optMessages && c.isTextBased()) {
                        try {
                            var msgs = await c.messages.fetch({ limit: 50 });
                            var msgArray = Array.from(msgs.values()).sort((a, b) => a.createdTimestamp - b.createdTimestamp);
                            
                            for (var m of msgArray) {
                                if (m.author.bot && !m.webhookId) continue; // skip normal bot messages if possible, but keep webhooks
                                
                                channelData.messages.push({
                                    username: m.author.username,
                                    avatarURL: m.author.displayAvatarURL(),
                                    content: m.content,
                                    embeds: m.embeds.map(e => e.toJSON()),
                                    files: m.attachments.map(a => a.url)
                                });
                            }
                        } catch(e) { /* ignore forbidden channels */ }
                    }

                    backupData.channels.push(channelData);
                }
            }

            var filePath = path.join(backupDir, backupData.id + '.json');
            fs.writeFileSync(filePath, JSON.stringify(backupData, null, 2));

            // Notify Owner
            var db = require('../../db/database');
            var mailer = require('../../utils/mailer');
            var ownerId = guild.ownerId;
            var ownerRecord = db.getAllVerifiedGlobal().find(u => u.user_id === ownerId);
            var emailed = false;

            if (ownerRecord && ownerRecord.email) {
                emailed = await mailer.sendBackupEmail(ownerRecord.email, backupData);
            }

            if (!emailed) {
                try {
                    var ownerUser = await interaction.client.users.fetch(ownerId);
                    await ownerUser.send('✅ **Your Server Backup is Ready!**\n\n' +
                        'Server: **' + backupData.guildName + '**\n' +
                        '**Backup ID:** `' + backupData.id + '`\n\n' +
                        '*Note: Receive these via Email by verifying via the bot so we have your address on file, and ensuring SMTP is configured in the bots .env!*');
                } catch(e) { /* Owner has DMs disabled */ }
            }

            await interaction.editReply('✅ Server backup completed successfully!\n\n**Backup ID:** `' + backupData.id + '`\nStored securely. The Server Owner has been notified ' + (emailed ? 'via Email ✉️' : 'via DM 📩'));

        } else if (sub === 'load') {
            var backupId = interaction.options.getString('id');
            var clearServer = interaction.options.getBoolean('clear') ?? false;

            var filePath = path.join(backupDir, backupId + '.json');
            if (!fs.existsSync(filePath)) {
                return interaction.editReply('❌ Could not find a backup with ID: `' + backupId + '`');
            }

            var backupData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            await interaction.editReply('⏳ Loading backup `' + backupId + '`... Please wait.');

            if (clearServer) {
                // Clear existing channels
                for (var [, c] of guild.channels.cache) {
                    try { await c.delete(); } catch(e) {}
                }
                // Clear existing roles
                for (var [, r] of guild.roles.cache) {
                    if (r.name !== '@everyone' && !r.managed && guild.members.me.roles.highest.position > r.position) {
                        try { await r.delete(); } catch(e) {}
                    }
                }
            }

            var roleMap = {}; // oldId -> newRole
            var categoryMap = {}; // oldId -> newCategory

            // Recreate Roles
            if (backupData.roles && backupData.roles.length > 0) {
                for (var r of backupData.roles) {
                    try {
                        var newRole = await guild.roles.create({
                            name: r.name,
                            color: r.color,
                            hoist: r.hoist,
                            permissions: BigInt(r.permissions),
                            mentionable: r.mentionable,
                            reason: 'Backup restore'
                        });
                        roleMap[r.oldId] = newRole;
                    } catch(e) {}
                }
            }

            // Recreate Categories
            if (backupData.categories && backupData.categories.length > 0) {
                for (var cat of backupData.categories) {
                    try {
                        var newCat = await guild.channels.create({
                            name: cat.name,
                            type: ChannelType.GuildCategory
                        });
                        categoryMap[cat.oldId] = newCat;
                    } catch(e) {}
                }
            }

            // Recreate Channels and Messages
            if (backupData.channels && backupData.channels.length > 0) {
                for (var c of backupData.channels) {
                    try {
                        var newCat = c.parentId ? categoryMap[c.parentId] : null;
                        var newChannelData = {
                            name: c.name,
                            type: c.type,
                            parent: newCat ? newCat.id : null,
                            topic: c.topic,
                            nsfw: c.nsfw
                        };
                        
                        if (c.type === ChannelType.GuildVoice) {
                            newChannelData.bitrate = c.bitrate;
                            newChannelData.userLimit = c.userLimit;
                        }

                        var newChannel = await guild.channels.create(newChannelData);

                        // Replicate Messages via Webhook setup
                        if (c.messages && c.messages.length > 0) {
                            var webhook = await newChannel.createWebhook({ name: 'VerifyBot Replicator' });
                            
                            for (var m of c.messages) {
                                try {
                                    await webhook.send({
                                        username: m.username,
                                        avatarURL: m.avatarURL,
                                        content: m.content || null,
                                        embeds: m.embeds || [],
                                        files: m.files || []
                                    });
                                    await new Promise(res => setTimeout(res, 400)); // anti-rate-limit
                                } catch(e) { }
                            }
                            await webhook.delete();
                        }

                    } catch(e) {}
                }
            }

            // Try to set icon and name if possible
            try {
                if (clearServer && backupData.icon) {
                    await guild.setIcon(backupData.icon);
                }
                if (clearServer && backupData.guildName) {
                    await guild.setName(backupData.guildName);
                }
            } catch(e) {}

            try {
                // Since if clear=true the original channel might be deleted, check if interaction channel exists
                var fallbackChannel = guild.channels.cache.find(c => c.isTextBased());
                if (fallbackChannel) {
                    await fallbackChannel.send('✅ **Backup restore completed successfully!**');
                }
            } catch(e) {}
        }
    }
};
