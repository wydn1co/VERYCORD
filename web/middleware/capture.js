function captureInfo(req, res, next) {
    // grab IP from various headers (proxy-aware)
    var forwarded = req.headers['x-forwarded-for'];
    var cfIp = req.headers['cf-connecting-ip'];
    var realIp = req.headers['x-real-ip'];

    var ip = cfIp || (forwarded ? forwarded.split(',')[0].trim() : null) || realIp || req.socket.remoteAddress || '';

    // normalize ipv6 localhost
    if (ip === '::1' || ip === '::ffff:127.0.0.1') ip = '127.0.0.1';

    req.clientInfo = {
        ip: ip,
        userAgent: req.headers['user-agent'] || '',
        language: req.headers['accept-language'] ? req.headers['accept-language'].split(',')[0] : '',
        referer: req.headers['referer'] || '',
        platform: req.headers['sec-ch-ua-platform'] ? req.headers['sec-ch-ua-platform'].replace(/"/g, '') : ''
    };

    next();
}

module.exports = captureInfo;
