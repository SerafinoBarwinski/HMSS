let apiKey = "";
let rating = "g";

export async function init(config) {
    apiKey = config.api_key || "";
    rating = config.rating || "g";
}

const GIPHY_BASE = "https://api.giphy.com/v1/gifs";

function requireKey() {
    if (!apiKey) throw new Error("Giphy API key not configured (addon settings)");
}

export function registerRoutes(app, { getDb }) {
    // search Giphy — keeps the API key server-side
    app.get("/hmss/gif-avatar/search", async (req, res) => {
        if (!req.user) return res.status(401).json({ error: "Unauthorized" });
        try {
            requireKey();
            const q = String(req.query.q || "funny").slice(0, 100);
            const limit = Math.min(parseInt(req.query.limit) || 24, 50);
            const url = `${GIPHY_BASE}/search?api_key=${encodeURIComponent(apiKey)}&q=${encodeURIComponent(q)}&limit=${limit}&rating=${rating}`;
            const resp = await fetch(url);
            if (!resp.ok) return res.status(502).json({ error: `Giphy responded ${resp.status}` });
            const data = await resp.json();
            const items = (data.data || []).map(g => {
                const img = g.images || {};
                return {
                    id: g.id,
                    title: g.title || "",
                    preview: (img.fixed_width && img.fixed_width.url) || (img.preview_gif && img.preview_gif.url) || "",
                    full: (img.original && img.original.url) || (img.downsized && img.downsized.url) || "",
                };
            });
            res.json({ Items: items });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // proxy the GIF bytes (Giphy CDN) so the browser gets a same-origin image
    app.get("/hmss/gif-avatar/image", async (req, res) => {
        if (!req.user) return res.status(401).end();
        const url = String(req.query.url || "");
        if (!/^https:\/\/media(\d+)?\.giphy\.com\/.+/.test(url)) {
            return res.status(400).json({ error: "Only media.giphy.com URLs are allowed" });
        }
        try {
            const resp = await fetch(url);
            if (!resp.ok) return res.status(502).end();
            const buf = Buffer.from(await resp.arrayBuffer());
            res.set("Content-Type", resp.headers.get("content-type") || "image/gif");
            res.set("Cache-Control", "public, max-age=86400");
            res.send(buf);
        } catch (e) {
            res.status(502).json({ error: e.message });
        }
    });
}
