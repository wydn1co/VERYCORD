var { REST, Routes } = require('discord.js');
var config = require('../../config');

module.exports = {
    name: 'ready',
    once: true,
    async execute(_, client) {
        console.log('[bot] online as ' + client.user.tag);

        // register slash commands
        var rest = new REST({ version: '10' }).setToken(config.token);
        var commands = client.commands.map(cmd => cmd.data.toJSON());

        try {
            await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
            console.log('[bot] registered ' + commands.length + ' commands');
        } catch(err) {
            console.error('[bot] failed to register commands:', err);
        }
    }
};
