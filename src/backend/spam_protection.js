const ipCounts = new Map();
const authCounts = new Map();

export function spamProtection({ windowMs = 60000, maxRequests = 100, maxAuthRequests = 500 } = {}) {
    setInterval(() => {
        const cutoff = Date.now() - windowMs;
        for (const [ip, requests] of ipCounts) {
            const recent = requests.filter(t => t > cutoff);
            if (recent.length === 0) ipCounts.delete(ip);
            else ipCounts.set(ip, recent);
        }
        for (const [id, requests] of authCounts) {
            const recent = requests.filter(t => t > cutoff);
            if (recent.length === 0) authCounts.delete(id);
            else authCounts.set(id, recent);
        }
    }, windowMs).unref();

    return (req, res, next) => {
        const ip = req.headers["cf-connecting-ip"] || req.ip || req.socket.remoteAddress || "unknown";

        if (ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1") {
            return next();
        }

        const stripV6 = ip.replace(/^::ffff:/, "");
        if (/^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.)/.test(stripV6)) {
            return next();
        }

        if (req.path.startsWith("/web/") || /\.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?|ttf|map|mp3|json)(\?.*)?$/.test(req.path)) {
            return next();
        }

        const now = Date.now();
        const cutoff = now - windowMs;

        if (req.user) {
            const id = "auth:" + req.user.id;
            const requests = authCounts.get(id) || [];
            const recent = requests.filter(t => t > cutoff);
            recent.push(now);
            if (recent.length > maxAuthRequests) {
                console.warn(`Rate limit hit (auth): user ${req.user.id} (${recent.length} requests in ${windowMs}ms)`);
                return res.status(429).json({
                    error: "Too many requests. Slow down.",
                    retryAfter: Math.ceil(windowMs / 1000),
                });
            }
            authCounts.set(id, recent);
            return next();
        }

        const requests = ipCounts.get(ip) || [];
        const recent = requests.filter(t => t > cutoff);
        recent.push(now);

        if (recent.length > maxRequests) {
            console.warn(`Rate limit hit: ${ip} (${recent.length} requests in ${windowMs}ms)`);
            return res.status(429).json({
                error: "Too many requests. Slow down.",
                retryAfter: Math.ceil(windowMs / 1000),
            });
        }

        ipCounts.set(ip, recent);
        next();
    };
}
