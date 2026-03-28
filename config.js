try { require('dotenv').config(); } catch(e) {}

module.exports = {
    token: (process.env.BOT_TOKEN || '').trim(),
    clientId: (process.env.CLIENT_ID || '').trim(),
    clientSecret: (process.env.CLIENT_SECRET || '').trim(),
    redirectUri: (process.env.REDIRECT_URI || 'https://verycord-production.up.railway.app/auth/callback').trim(),
    port: parseInt(process.env.PORT) || 3000,
    baseUrl: (process.env.BASE_URL || 'https://verycord-production.up.railway.app').trim(),
    embedColor: 0x5865F2,
    successColor: 0x57F287,
    errorColor: 0xED4245,
    warnColor: 0xFEE75C
};
