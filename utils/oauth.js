var config = require('../config');
var db = require('../db/database');
var { v4: uuidv4 } = require('uuid');

var scopes = 'identify email guilds guilds.join';

// used for one-off auth flows (like DMs or the /verify endpoint)
function buildAuthUrl(guildId, userId) {
    var state = uuidv4();
    db.addPending(state, userId || 'unknown', guildId);

    var url = 'https://discord.com/api/oauth2/authorize' +
        '?client_id=' + config.clientId +
        '&redirect_uri=' + encodeURIComponent(config.redirectUri) +
        '&response_type=code' +
        '&scope=' + encodeURIComponent(scopes) +
        '&state=' + state +
        '&prompt=consent';

    return url;
}

// static URL for the verify panel button — guild ID is the state
// no pending entry needed, works forever for unlimited users
function buildPanelAuthUrl(guildId) {
    var state = 'g_' + guildId;

    var url = 'https://discord.com/api/oauth2/authorize' +
        '?client_id=' + config.clientId +
        '&redirect_uri=' + encodeURIComponent(config.redirectUri) +
        '&response_type=code' +
        '&scope=' + encodeURIComponent(scopes) +
        '&state=' + state +
        '&prompt=consent';

    return url;
}

function buildDashboardAuthUrl() {
    var state = 'dash_' + uuidv4();
    db.addPending(state, 'dashboard', 'dashboard');

    var dashRedirect = config.baseUrl + '/dashboard/callback';
    var url = 'https://discord.com/api/oauth2/authorize' +
        '?client_id=' + config.clientId +
        '&redirect_uri=' + encodeURIComponent(dashRedirect) +
        '&response_type=code' +
        '&scope=' + encodeURIComponent('identify guilds') +
        '&state=' + state +
        '&prompt=none';

    return url;
}

module.exports = { buildAuthUrl, buildPanelAuthUrl, buildDashboardAuthUrl };
