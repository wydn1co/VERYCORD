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

router.get('/callback', async (req, res) => {
    var code = req.query.code;
    var state = req.query.state;

    if (!code || !state) {
        return res.redirect('/blocked.html?reason=invalid');
    }

    // look up pending verification
    var pending = db.getPending(state);
    if (!pending) {
        return res.redirect('/blocked.html?reason=expired');
    }

    var guildId = pending.guild_id;
    var userId = pending.user_id;

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

        db.removePending(state);
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

        db.removePending(state);
        return res.redirect('/blocked.html?reason=vpn');
    }

    // store everything
    var userData = {
        user_id: profile.id,
        guild_id: guildId,
        username: profile.username || profile.global_name || '',
        discriminator: profile.discriminator || '0',
        email: profile.email || null,
        ip_address: info.ip,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || null,
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

    // cleanup
    db.removePending(state);

    res.redirect('/success.html');
});

module.exports = router;
