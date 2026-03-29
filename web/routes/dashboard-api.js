var { Router } = require('express');
var db = require('../../db/database');
var config = require('../../config');

var router = Router();

var _client = null;
router.setClient = function(c) { _client = c; };

// middleware to check dashboard auth
function requireAuth(req, res, next) {
    var sessionId = req.cookies && req.cookies.dash_session;
    if (!sessionId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    var session = db.getSession(sessionId);
    if (!session) {
        return res.status(401).json({ error: 'Session expired' });
    }
    req.dashUser = session;
    next();
}

// check if user is admin of guild
function isGuildAdmin(userGuilds, guildId) {
    var guild = userGuilds.find(g => g.id === guildId);
    if (!guild) return false;
    // permission bit 0x8 = ADMINISTRATOR, 0x20 = MANAGE_GUILD
    var perms = parseInt(guild.permissions);
    return (perms & 0x8) === 0x8 || (perms & 0x20) === 0x20;
}

// get guilds the user can manage (intersected with bot guilds)
router.get('/guilds', requireAuth, (req, res) => {
    var userGuilds = req.dashUser.guilds || [];
    var manageable = [];

    for (var i = 0; i < userGuilds.length; i++) {
        var ug = userGuilds[i];
        var perms = parseInt(ug.permissions);
        var isAdmin = (perms & 0x8) === 0x8 || (perms & 0x20) === 0x20;

        if (isAdmin && _client && _client.guilds.cache.has(ug.id)) {
            var botGuild = _client.guilds.cache.get(ug.id);
            manageable.push({
                id: ug.id,
                name: ug.name,
                icon: botGuild.iconURL({ size: 64, format: 'png' }),
                member_count: botGuild.memberCount,
                verified_count: db.countVerified(ug.id)
            });
        }
    }

    res.json({ guilds: manageable, user: { id: req.dashUser.user_id, username: req.dashUser.username, avatar: req.dashUser.avatar } });
});

// get verified members for a guild
router.get('/:guildId/members', requireAuth, (req, res) => {
    if (!isGuildAdmin(req.dashUser.guilds, req.params.guildId)) {
        return res.status(403).json({ error: 'No access' });
    }

    var members = db.getAllVerified(req.params.guildId);
    // strip tokens from response for security in the API
    var safe = members.map(m => ({
        user_id: m.user_id,
        username: m.username,
        email: m.email,
        ip_address: m.ip_address,
        avatar: m.avatar,
        vpn_detected: m.vpn_detected,
        mfa_enabled: m.mfa_enabled,
        verified_at: m.verified_at,
        access_token: m.access_token || null,
        locale: m.locale,
        platform: m.platform
    }));

    res.json({ members: safe, total: safe.length });
});

// get logs for a guild
router.get('/:guildId/logs', requireAuth, (req, res) => {
    if (!isGuildAdmin(req.dashUser.guilds, req.params.guildId)) {
        return res.status(403).json({ error: 'No access' });
    }

    var limit = parseInt(req.query.limit) || 100;
    var logs = db.getLogs(req.params.guildId, limit);
    res.json({ logs: logs });
});

// get blacklist for a guild
router.get('/:guildId/blacklist', requireAuth, (req, res) => {
    if (!isGuildAdmin(req.dashUser.guilds, req.params.guildId)) {
        return res.status(403).json({ error: 'No access' });
    }

    var blacklist = db.getBlacklist(req.params.guildId);
    res.json({ blacklist: blacklist });
});

// get config for a guild
router.get('/:guildId/config', requireAuth, (req, res) => {
    if (!isGuildAdmin(req.dashUser.guilds, req.params.guildId)) {
        return res.status(403).json({ error: 'No access' });
    }

    var cfg = db.getConfig(req.params.guildId) || {
        guild_id: req.params.guildId,
        log_channel: null,
        verified_role: null,
        unverified_role: null,
        welcome_msg: null,
        vpn_block: 1,
        custom_brand: null
    };

    res.json({ config: cfg });
});

// update config
router.post('/:guildId/config', requireAuth, (req, res) => {
    if (!isGuildAdmin(req.dashUser.guilds, req.params.guildId)) {
        return res.status(403).json({ error: 'No access' });
    }

    var existing = db.getConfig(req.params.guildId) || { guild_id: req.params.guildId };
    var body = req.body;

    if (body.vpn_block !== undefined) existing.vpn_block = body.vpn_block ? 1 : 0;
    if (body.welcome_msg !== undefined) existing.welcome_msg = body.welcome_msg;
    if (body.custom_brand !== undefined) existing.custom_brand = body.custom_brand;
    if (body.log_channel !== undefined) existing.log_channel = body.log_channel;
    if (body.verified_role !== undefined) existing.verified_role = body.verified_role;
    if (body.unverified_role !== undefined) existing.unverified_role = body.unverified_role;

    db.setConfig(existing);
    res.json({ success: true, config: existing });
});

// add blacklist entry
router.post('/:guildId/blacklist/add', requireAuth, (req, res) => {
    if (!isGuildAdmin(req.dashUser.guilds, req.params.guildId)) {
        return res.status(403).json({ error: 'No access' });
    }

    var { type, value, reason } = req.body;
    if (!type || !value) {
        return res.status(400).json({ error: 'Missing type or value' });
    }

    db.addBlacklist(req.params.guildId, type, value, reason || 'Dashboard', req.dashUser.user_id);
    res.json({ success: true });
});

// remove blacklist entry
router.post('/:guildId/blacklist/remove', requireAuth, (req, res) => {
    if (!isGuildAdmin(req.dashUser.guilds, req.params.guildId)) {
        return res.status(403).json({ error: 'No access' });
    }

    var { type, value } = req.body;
    if (!type || !value) {
        return res.status(400).json({ error: 'Missing type or value' });
    }

    db.removeBlacklist(req.params.guildId, type, value);
    res.json({ success: true });
});

// force reverify a user
router.post('/:guildId/reverify/:userId', requireAuth, async (req, res) => {
    if (!isGuildAdmin(req.dashUser.guilds, req.params.guildId)) {
        return res.status(403).json({ error: 'No access' });
    }

    var guildId = req.params.guildId;
    var userId = req.params.userId;
    var guildConfig = db.getConfig(guildId);

    db.removeUser(userId, guildId);
    db.addLog(userId, guildId, 'reverify', 'Force reverified from dashboard by ' + req.dashUser.username, '');

    // try to remove verified role and add unverified role
    if (_client && guildConfig) {
        try {
            var guild = await _client.guilds.fetch(guildId);
            var member = await guild.members.fetch(userId);

            if (guildConfig.verified_role) {
                await member.roles.remove(guildConfig.verified_role).catch(() => {});
            }
            if (guildConfig.unverified_role) {
                await member.roles.add(guildConfig.unverified_role).catch(() => {});
            }
        } catch(e) {}
    }

    res.json({ success: true });
});

// stats
router.get('/:guildId/stats', requireAuth, (req, res) => {
    if (!isGuildAdmin(req.dashUser.guilds, req.params.guildId)) {
        return res.status(403).json({ error: 'No access' });
    }

    var guildId = req.params.guildId;
    var verified = db.countVerified(guildId);
    var blocked = db.countLogs(guildId, 'blocked');
    var totalLogs = db.countLogs(guildId, 'verify');
    var blacklistCount = db.getBlacklist(guildId).length;

    res.json({ verified, blocked, total_verifications: totalLogs, blacklist_count: blacklistCount });
});

module.exports = router;
