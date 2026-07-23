import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const BASE = "https://webservice.fanart.tv/v3";

let apiKey = "";
let keyType = "personal";
let posterSize = "medium";
let backgroundSize = "large";

export async function init(config) {
    apiKey = config.api_key || "";
    keyType = config.key_type || "personal";
    posterSize = config.poster_size || "medium";
    backgroundSize = config.background_size || "large";
}

function authHeaders() {
    return keyType === "project"
        ? { "api-key": apiKey }
        : { "client-key": apiKey };
}

export async function fetchArtwork({ tmdbId, type }) {
    if (!apiKey) throw new Error("Fanart.tv API key not configured");
    if (!tmdbId) throw new Error("tmdbId required");

    const category = type === "show" || type === "series" ? "tv" : "movies";
    const url = `${BASE}/${category}/${tmdbId}`;

    const resp = await fetch(url, { headers: authHeaders() });
    if (!resp.ok) {
        if (resp.status === 404) return { posters: [], backgrounds: [] };
        throw new Error(`Fanart.tv API error: ${resp.status}`);
    }

    const data = await resp.json();

    const posters = [];
    const backgrounds = [];

    // posters
    const posterKey = type === "show" ? "tvposter" : "movieposter";
    if (data[posterKey]) {
        for (const img of data[posterKey].slice(0, 3)) {
            posters.push({ url: img.url, lang: img.lang, likes: img.likes });
        }
    }

    // backgrounds / heroes
    const bgKey = type === "show" ? "showbackground" : "moviebackground";
    if (data[bgKey]) {
        for (const img of (data[bgKey] || []).slice(0, 3)) {
            backgrounds.push({ url: img.url, likes: img.likes });
        }
    }

    // also check clearart/logos
    const clearArtKey = type === "show" ? "hdclearart" : "hdmovieclearart";
    const logos = [];
    if (data[clearArtKey]) {
        for (const img of data[clearArtKey].slice(0, 2)) {
            logos.push({ url: img.url, type: "logo" });
        }
    }

    return { posters, backgrounds, logos };
}

export async function downloadBest({ tmdbId, type, targetDir }) {
    const artwork = await fetchArtwork({ tmdbId, type, targetDir });
    const results = [];

    await mkdir(targetDir, { recursive: true });

    // download best poster
    if (artwork.posters.length > 0) {
        const poster = artwork.posters.sort((a, b) => (b.likes || 0) - (a.likes || 0))[0];
        const ext = path.extname(new URL(poster.url).pathname) || ".jpg";
        const dest = path.join(targetDir, `poster${ext}`);
        await downloadFile(poster.url, dest);
        results.push({ type: "poster", path: dest });
    }

    // download best background
    if (artwork.backgrounds.length > 0) {
        const bg = artwork.backgrounds.sort((a, b) => (b.likes || 0) - (a.likes || 0))[0];
        const ext = path.extname(new URL(bg.url).pathname) || ".jpg";
        const dest = path.join(targetDir, `hero${ext}`);
        await downloadFile(bg.url, dest);
        results.push({ type: "hero", path: dest });
    }

    // download logo if available
    if (artwork.logos.length > 0) {
        const logo = artwork.logos[0];
        const ext = path.extname(new URL(logo.url).pathname) || ".png";
        const dest = path.join(targetDir, `logo${ext}`);
        await downloadFile(logo.url, dest);
        results.push({ type: "logo", path: dest });
    }

    return results;
}

async function downloadFile(url, dest) {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Download failed: ${resp.status}`);
    const buffer = Buffer.from(await resp.arrayBuffer());
    await writeFile(dest, buffer);
}
