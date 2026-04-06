var { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
var fetch = require('node-fetch');
var config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('servercopy')
        .setDescription('Clone a server using an invite link (Requires SCRAPER_TOKEN) - Owner Only')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(opt =>
            opt.setName('invite')
                .setDescription('The discord.gg invite link to the server you want to copy')
                .setRequired(true)
        )
        .addBooleanOption(opt => 
            opt.setName('clear_server')
                .setDescription('Clear all existing roles and channels before creating new ones?')
                .setRequired(false)
        ),

    async execute(interaction) {
        if (interaction.user.id !== config.ownerId) {
            return interaction.reply({ content: '❌ Only the bot owner can run this.', ephemeral: true });
        }

        if (!config.scraperToken) {
            return interaction.reply({ content: '❌ **Missing SCRAPER_TOKEN!** You must configure a burner account user token in your .env file to use this command.', ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: false });

        var inviteUrl = interaction.options.getString('invite');
        var code = inviteUrl.replace(/https?:\/\/(www\.)?discord\.(gg|com\/invite)\//i, '').split('/')[0].split('?')[0];
        if (!code) {
            return interaction.editReply('❌ Invalid invite link format.');
        }

        var clearServer = interaction.options.getBoolean('clear_server') ?? false;

        // --- SCRAPING PHASE ---
        await interaction.editReply('⏳ `[1/4]` Making scraper account join the server secretly via invite...');

        var defaultHeaders = {
            'Authorization': config.scraperToken,
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36'
        };

        // 1. Join
        var joinRes = await fetch('https://discord.com/api/v10/invites/' + code, {
            method: 'POST',
            headers: defaultHeaders,
            body: JSON.stringify({})
        });

        if (!joinRes.ok) {
            var body = await joinRes.json().catch(() => ({}));
            var errMsg = body.message || 'Unknown Error';
            if (joinRes.status === 400 && body.captcha_key) errMsg = 'Captcha Required! The scraper account is temporarily flagged by Discord anti-spam.';
            if (joinRes.status === 401) errMsg = 'Invalid SCRAPER_TOKEN provided.';
            if (joinRes.status === 403) errMsg = 'Scraper account is banned from that server or phone verification is required.';
            return interaction.editReply('❌ Failed to join via scraper account:\n`' + errMsg + '`');
        }

        var joinData = await joinRes.json();
        var targetGuildId = joinData.guild.id;
        var targetGuildName = joinData.guild.name;

        await interaction.editReply('⏳ `[2/4]` Joined **' + targetGuildName + '**. Scraping roles and channels...');

        // 2. Fetch Roles
        var rolesRes = await fetch('https://discord.com/api/v10/guilds/' + targetGuildId + '/roles', { headers: defaultHeaders });
        var remoteRoles = [];
        if (rolesRes.ok) remoteRoles = await rolesRes.json();

        // 3. Fetch Channels
        var channelsRes = await fetch('https://discord.com/api/v10/guilds/' + targetGuildId + '/channels', { headers: defaultHeaders });
        var remoteChannels = [];
        if (channelsRes.ok) remoteChannels = await channelsRes.json();

        // 4. Leave Server
        await fetch('https://discord.com/api/v10/users/@me/guilds/' + targetGuildId, { method: 'DELETE', headers: defaultHeaders });

        if (!rolesRes.ok || !channelsRes.ok) {
            return interaction.editReply('❌ Failed to fetch server blueprints. (The account may be rate limited).');
        }

        // --- BUILDING PHASE ---
        await interaction.editReply('⏳ `[3/4]` Blueprint captured! Building channels and roles in ' + interaction.guild.name + '...');

        var guild = interaction.guild;

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

        var oldIdToNewRole = {};
        var oldIdToNewCategory = {};

        // CREATE ROLES
        // sort by position ascending
        var rolesToCreate = remoteRoles.filter(r => r.name !== '@everyone' && !r.managed).sort((a,b) => a.position - b.position);
        
        for (var r of rolesToCreate) {
            try {
                var newRole = await guild.roles.create({
                    name: r.name,
                    color: r.color,
                    hoist: r.hoist,
                    permissions: BigInt(r.permissions),
                    mentionable: r.mentionable,
                    reason: 'Server Copy'
                });
                oldIdToNewRole[r.id] = newRole;
            } catch(e) {}
        }

        // CREATE CATEGORIES (Type 4)
        var categoriesToCreate = remoteChannels.filter(c => c.type === 4).sort((a,b) => a.position - b.position);
        
        for (var c of categoriesToCreate) {
            try {
                var newCat = await guild.channels.create({
                    name: c.name,
                    type: ChannelType.GuildCategory
                });
                oldIdToNewCategory[c.id] = newCat;
            } catch(e) {}
        }

        // CREATE CHANNELS
        var channelsToCreate = remoteChannels.filter(c => c.type !== 4).sort((a,b) => a.position - b.position);
        
        for (var c of channelsToCreate) {
            try {
                if (c.type !== 0 && c.type !== 2 && c.type !== 5 && c.type !== 13) continue; // skip complex types

                var parentCat = c.parent_id ? oldIdToNewCategory[c.parent_id] : null;
                var chOptions = {
                    name: c.name,
                    type: c.type === 2 ? ChannelType.GuildVoice : (c.type === 13 ? ChannelType.GuildStageVoice : ChannelType.GuildText),
                    parent: parentCat ? parentCat.id : null,
                    topic: c.topic,
                    nsfw: c.nsfw
                };

                if (c.type === 2 || c.type === 13) {
                    chOptions.bitrate = c.bitrate || 64000;
                    chOptions.userLimit = c.user_limit || 0;
                }

                await guild.channels.create(chOptions);
            } catch(e) { }
        }

        await interaction.editReply('✅ `[4/4]` **Successfully Copied Server!**\n\nCloned **' + rolesToCreate.length + '** roles and **' + remoteChannels.length + '** channels/categories from **' + targetGuildName + '**.');
    }
};
