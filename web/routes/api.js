var { Router } = require('express');
var db = require('../../db/database');

var router = Router();

router.get('/stats/:guildId', (req, res) => {
    var guildId = req.params.guildId;
    var total = db.countVerified(guildId);
    var blocked = db.countLogs(guildId, 'blocked');

    res.json({ verified: total, blocked: blocked });
});

module.exports = router;
