// MusicBrainz Metadata Addon


// Rate limit: ~1 req/s. No API key needed.
// Uses iconic iPhone 1 User-Agent to troll their stats ;)
const UA = "Mozilla/5.0 (iPhone; U; CPU iPhone OS 1_0 like Mac OS X; en) AppleWebKit/420+ (KHTML, like Gecko) Version/3.0 Mobile/1A543a Safari/419.3";

const BASE = "https://musicbrainz.org/ws/2";

let rateLimitMs = 1200;
let lastRequest = 0;

export async function init(config) {
    rateLimitMs = config.rate_limit_ms || 1200;
}

async function rateLimitedFetch(url) {
    const now = Date.now();
    const wait = lastRequest + rateLimitMs - now;
    if (wait > 0) await new Promise(r => setTimeout(r, wait));
    lastRequest = Date.now();
    return fetch(url, { headers: { "User-Agent": UA } });
}

export async function search({ query, type }) {
    const entityMap = {
        artist: "artist",
        album: "release",
        track: "recording",
    };
    const entity = entityMap[type] || "recording";
    const url = `${BASE}/${entity}/?query=${encodeURIComponent(query)}&fmt=json&limit=5`;

    const resp = await rateLimitedFetch(url);
    if (!resp.ok) throw new Error(`MusicBrainz search failed: ${resp.status}`);

    const data = await resp.json();

    const results = (data[entity + "s"] || data.recordings || []).slice(0, 5).map(item => ({
        id: item.id,
        name: item.title || item.name,
        artist: item["artist-credit"]?.[0]?.name || item.artist?.name || null,
        year: item.date?.split("-")[0] || item["first-release-date"]?.split("-")[0] || null,
        source: "musicbrainz",
    }));

    // for releases, try to get cover art
    if (type === "album") {
        for (const r of results) {
            r.cover = `https://coverartarchive.org/release/${r.id}/front-250.jpg`;
        }
    }

    return results;
}

export async function identify({ filename, ffprobe, type }) {
    const query = ffprobe?.tags?.title || sanitizeFilename(filename);
    const artistTag = ffprobe?.tags?.artist;

    // try artist + title search first
    let searchQuery = query;
    if (artistTag) searchQuery = `${artistTag} ${query}`;

    const results = await search({ query: searchQuery, type: type || "track" });
    if (results.length === 0) return null;

    return { ...results[0], confidence: results.length === 1 ? 0.8 : 0.6 };
}

export async function getCoverArt(mbid) {
    const url = `https://coverartarchive.org/release/${mbid}/front-500.jpg`;
    return url;
}

function sanitizeFilename(name) {
    return name
        .replace(/\.[^.]+$/, "")
        .replace(/[._-]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}
