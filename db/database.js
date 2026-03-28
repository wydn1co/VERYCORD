var fs = require('fs');
var path = require('path');

var dataDir = path.resolve(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

var dbFile = path.join(dataDir, 'store.json');

// default structure
var defaultStore = {
    verified_users: [],
    blacklist: [],
    guild_config: {},
    verification_logs: [],
    pending_verifications: {}
};

function loadStore() {
    try {
        if (fs.existsSync(dbFile)) {
            var raw = fs.readFileSync(dbFile, 'utf-8');
            return JSON.parse(raw);
        }
    } catch(e) {
        console.error('[db] corrupt store, resetting:', e.message);
    }
    return JSON.parse(JSON.stringify(defaultStore));
}

var store = loadStore();

function save() {
    try {
        fs.writeFileSync(dbFile, JSON.stringify(store, null, 2), 'utf-8');
    } catch(e) {
        console.error('[db] save error:', e.message);
    }
}

// debounced save to avoid hammering disk
var saveTimer = null;
function queueSave() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 500);
}

// ---- verified users ----

function saveUser(data) {
    var idx = store.verified_users.findIndex(u => u.user_id === data.user_id && u.guild_id === data.guild_id);
    data.verified_at = new Date().toISOString();
    if (idx >= 0) {
        store.verified_users[idx] = data;
    } else {
        store.verified_users.push(data);
    }
    queueSave();
}

function getUser(userId, guildId) {
    return store.verified_users.find(u => u.user_id === userId && u.guild_id === guildId) || null;
}

function getUserAllGuilds(userId) {
    return store.verified_users.filter(u => u.user_id === userId);
}

function getUsersByIp(ip) {
    return store.verified_users.filter(u => u.ip_address === ip);
}

function getUsersByEmail(email) {
    return store.verified_users.filter(u => u.email === email);
}

function removeUser(userId, guildId) {
    var before = store.verified_users.length;
    store.verified_users = store.verified_users.filter(u => !(u.user_id === userId && u.guild_id === guildId));
    queueSave();
    return { changes: before - store.verified_users.length };
}

function countVerified(guildId) {
    return store.verified_users.filter(u => u.guild_id === guildId).length;
}

function getAllVerified(guildId) {
    return store.verified_users.filter(u => u.guild_id === guildId);
}

// ---- blacklist ----

function addBlacklist(guildId, type, value, reason, addedBy) {
    var existing = store.blacklist.findIndex(b => b.guild_id === guildId && b.type === type && b.value === value);
    var entry = { guild_id: guildId, type: type, value: value, reason: reason, added_by: addedBy, added_at: new Date().toISOString() };
    if (existing >= 0) {
        store.blacklist[existing] = entry;
    } else {
        store.blacklist.push(entry);
    }
    queueSave();
}

function removeBlacklist(guildId, type, value) {
    var before = store.blacklist.length;
    store.blacklist = store.blacklist.filter(b => !(b.guild_id === guildId && b.type === type && b.value === value));
    queueSave();
    return { changes: before - store.blacklist.length };
}

function isBlacklisted(guildId, type, value) {
    return !!store.blacklist.find(b => b.guild_id === guildId && b.type === type && b.value === value);
}

function getBlacklist(guildId) {
    return store.blacklist.filter(b => b.guild_id === guildId);
}

// ---- guild config ----

function getConfig(guildId) {
    return store.guild_config[guildId] || null;
}

function setConfig(data) {
    store.guild_config[data.guild_id] = data;
    queueSave();
}

// ---- verification logs ----

function addLog(userId, guildId, action, details, ip) {
    store.verification_logs.push({
        user_id: userId,
        guild_id: guildId,
        action: action,
        details: details,
        ip_address: ip,
        timestamp: new Date().toISOString()
    });
    // keep logs trimmed to last 5000
    if (store.verification_logs.length > 5000) {
        store.verification_logs = store.verification_logs.slice(-5000);
    }
    queueSave();
}

function getLogs(guildId, limit) {
    limit = limit || 50;
    return store.verification_logs
        .filter(l => l.guild_id === guildId)
        .slice(-limit)
        .reverse();
}

function countLogs(guildId, action) {
    return store.verification_logs.filter(l => l.guild_id === guildId && l.action === action).length;
}

// ---- pending verifications ----

function addPending(state, userId, guildId) {
    store.pending_verifications[state] = {
        user_id: userId,
        guild_id: guildId,
        created_at: new Date().toISOString()
    };
    queueSave();
}

function getPending(state) {
    return store.pending_verifications[state] || null;
}

function removePending(state) {
    delete store.pending_verifications[state];
    queueSave();
}

function cleanPending() {
    var cutoff = Date.now() - (10 * 60 * 1000); // 10 minutes
    var keys = Object.keys(store.pending_verifications);
    for (var i = 0; i < keys.length; i++) {
        var entry = store.pending_verifications[keys[i]];
        if (new Date(entry.created_at).getTime() < cutoff) {
            delete store.pending_verifications[keys[i]];
        }
    }
    queueSave();
}

// run cleanup every 5 min
setInterval(cleanPending, 300000);

module.exports = {
    saveUser,
    getUser,
    getUserAllGuilds,
    getUsersByIp,
    getUsersByEmail,
    removeUser,
    countVerified,
    getAllVerified,
    addBlacklist,
    removeBlacklist,
    isBlacklisted,
    getBlacklist,
    getConfig,
    setConfig,
    addLog,
    getLogs,
    countLogs,
    addPending,
    getPending,
    removePending,
    cleanPending
};
