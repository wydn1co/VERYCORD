var { Router } = require('express');
var db = require('../../db/database');

var router = Router();

var _client = null;
router.setClient = function(c) { _client = c; };

router.get('/verified', async (req, res) => {
    var guildId = req.query.guild;
    var userId = req.query.user;

    var guildName = 'Server';
    var guildIcon = null;
    var userName = '';
    var userAvatar = null;

    // try to get guild info from bot cache
    if (_client && guildId) {
        try {
            var guild = await _client.guilds.fetch(guildId);
            guildName = guild.name;
            guildIcon = guild.iconURL({ size: 256, format: 'png' });
        } catch(e) {}
    }

    // try to get user info from saved data
    if (userId && guildId) {
        var userData = db.getUser(userId, guildId);
        if (userData) {
            userName = userData.username;
            if (userData.avatar) {
                userAvatar = 'https://cdn.discordapp.com/avatars/' + userId + '/' + userData.avatar + '.png?size=128';
            }
        }
    }

    var iconHtml = '';
    if (guildIcon) {
        iconHtml = '<img src="' + guildIcon + '" alt="' + guildName + '" style="width:80px;height:80px;border-radius:22px;object-fit:cover;">';
    } else {
        iconHtml = guildName.charAt(0).toUpperCase();
    }

    var html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Verified ✓ — ${guildName}</title>
    <link rel="stylesheet" href="/styles.css">
</head>
<body>
    <div class="particles">
        <div class="particle"></div>
        <div class="particle"></div>
        <div class="particle"></div>
        <div class="particle"></div>
        <div class="particle"></div>
        <div class="particle"></div>
        <div class="particle"></div>
        <div class="particle"></div>
    </div>

    <div class="container">
        <div class="card">
            <div class="server-icon verified-server-icon">${iconHtml}</div>
            <h1>Verification Complete</h1>
            <p class="subtitle">You've been verified in <strong>${guildName}</strong></p>

            <span class="badge badge-success">✓ Verified</span>

            <div class="verified-details">
                <div class="info-item">
                    <div class="icon icon-shield">🛡️</div>
                    <span>Full server access granted</span>
                </div>
                <div class="info-item">
                    <div class="icon icon-check">⚡</div>
                    <span>Verified role has been assigned</span>
                </div>
            </div>

            <div class="progress-bar">
                <div class="fill"></div>
            </div>
            <p class="countdown" id="countdown">You can close this tab now</p>
        </div>

        <div class="footer">
            <p>Powered by Verification System</p>
        </div>
    </div>
</body>
</html>`;

    res.send(html);
});

module.exports = router;
