var { Router } = require('express');
var config = require('../../config');
var db = require('../../db/database');
var { v4: uuidv4 } = require('uuid');

var router = Router();

router.get('/discord', (req, res) => {
    var guildId = req.query.guild;
    var userId = req.query.user;

    if (!guildId) {
        return res.status(400).send('Missing guild parameter');
    }

    // create a state token so we know who comes back
    var state = uuidv4();
    if (userId) {
        db.addPending(state, userId, guildId);
    } else {
        db.addPending(state, 'unknown', guildId);
    }

    var scopes = 'identify email guilds guilds.join';
    var url = 'https://discord.com/api/oauth2/authorize' +
        '?client_id=' + config.clientId +
        '&redirect_uri=' + encodeURIComponent(config.redirectUri) +
        '&response_type=code' +
        '&scope=' + encodeURIComponent(scopes) +
        '&state=' + state +
        '&prompt=consent';

    res.redirect(url);
});

module.exports = router;
