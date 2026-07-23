const ipCounts = new Map();

export function spamProtection({ windowMs = 60000, maxRequests = 100 } = {}) {
    setInterval(() => {
        const cutoff = Date.now() - windowMs;
        for (const [ip, requests] of ipCounts) {
            const recent = requests.filter(t => t > cutoff);
            if (recent.length === 0) ipCounts.delete(ip);
            else ipCounts.set(ip, recent);
        }
    }, windowMs).unref();

    return (req, res, next) => {
        const ip = req.ip || req.socket.remoteAddress || "unknown";

        if (ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1") {
            return next();
        }

        const now = Date.now();
        const cutoff = now - windowMs;

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
