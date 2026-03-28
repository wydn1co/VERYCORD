try { require('dotenv').config(); } catch(e) {}

module.exports = {
    token: process.env.BOT_TOKEN || '',
    clientId: process.env.CLIENT_ID || '',
    clientSecret: process.env.CLIENT_SECRET || '',
    redirectUri: process.env.REDIRECT_URI || 'http://localhost:3000/auth/callback',
    port: parseInt(process.env.PORT) || 3000,
    baseUrl: process.env.BASE_URL || 'http://localhost:3000',
    embedColor: 0x5865F2,
    successColor: 0x57F287,
    errorColor: 0xED4245,
    warnColor: 0xFEE75C
};
