var fetch = require('node-fetch');

async function checkVpn(ip) {
    if (!ip || ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
        return { isVpn: false, provider: null };
    }

    try {
        var resp = await fetch('http://ip-api.com/json/' + ip + '?fields=status,proxy,hosting,isp,org', {
            timeout: 5000
        });
        var data = await resp.json();

        if (data.status === 'success') {
            var detected = data.proxy || data.hosting;
            return {
                isVpn: detected,
                provider: detected ? (data.isp || data.org || 'Unknown provider') : null
            };
        }
    } catch(e) {
        console.error('[vpncheck] error:', e.message);
    }

    return { isVpn: false, provider: null };
}

module.exports = { checkVpn };
