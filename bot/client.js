var { Client, GatewayIntentBits, Collection, REST, Routes } = require('discord.js');
var fs = require('fs');
var path = require('path');
var config = require('../config');

var client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

client.commands = new Collection();

// load commands
var cmdDir = path.join(__dirname, 'commands');
var cmdFiles = fs.readdirSync(cmdDir).filter(f => f.endsWith('.js'));

for (var file of cmdFiles) {
    var cmd = require(path.join(cmdDir, file));
    client.commands.set(cmd.data.name, cmd);
}

// load events
var evtDir = path.join(__dirname, 'events');
var evtFiles = fs.readdirSync(evtDir).filter(f => f.endsWith('.js'));

for (var file of evtFiles) {
    var event = require(path.join(evtDir, file));
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args, client));
    } else {
        client.on(event.name, (...args) => event.execute(...args, client));
    }
}

module.exports = client;
