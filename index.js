var config = require('./config');
var bot = require('./bot/client');
var server = require('./web/server');

// wire discord client to web server so callbacks can assign roles
server.attachClient(bot);

// boot web server
server.listen(config.port, () => {
    console.log('[web] running on port ' + config.port);
});

// boot discord client
bot.login(config.token).catch(err => {
    console.error('[bot] failed to login:', err.message);
    process.exit(1);
});
