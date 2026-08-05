import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const BASE = "https://webservice.fanart.tv/v3.2";

let apiKey = "";
let keyType = "personal";
let posterSize = "medium";
let backgroundSize = "large";
let getAddonById = null;

export async function init(config, helpers) {
    apiKey = config.api_key || "";
    keyType = config.key_type || "personal";
    posterSize = config.poster_size || "medium";
    backgroundSize = config.background_size || "large";
    if (helpers && typeof helpers.getAddonById === "function") getAddonById = helpers.getAddonById;
}

function authHeaders() {
    return keyType === "project"
        ? { "api-key": apiKey }
        : { "client-key": apiKey };
}

// fanart.tv keys TV artwork by TVDB id, not TMDB id. Resolve the TVDB id via
// the tmdb addon (external_ids) so shows actually return artwork.
async function resolveFanartId(tmdbId, type) {
    if (type !== "show" && type !== "series") return tmdbId;
    const tmdb = getAddonById ? getAddonById("tmdb") : null;
    if (tmdb && tmdb.module && typeof tmdb.module.getExternalIds === "function") {
        try {
            const ext = await tmdb.module.getExternalIds(tmdbId, type);
            if (ext && ext.tvdb_id) return ext.tvdb_id;
        } catch (e) { }
    }
    return tmdbId;
}

export async function fetchArtwork({ tmdbId, type }) {
    if (!apiKey) throw new Error("Fanart.tv API key not configured");
    if (!tmdbId) throw new Error("tmdbId required");

    const category = type === "show" || type === "series" ? "tv" : "movies";
    const id = await resolveFanartId(tmdbId, type);
    const url = `${BASE}/${category}/${id}`;

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
        for (const img of data[posterKey]) {
            posters.push({ url: img.url, lang: img.lang, likes: img.likes });
        }
    }

    // backgrounds / heroes
    const bgKey = type === "show" ? "showbackground" : "moviebackground";
    if (data[bgKey]) {
        for (const img of (data[bgKey] || [])) {
            backgrounds.push({ url: img.url, likes: img.likes });
        }
    }

    // clearart / logos
    const clearArtKey = type === "show" ? "hdclearart" : "hdmovieclearart";
    const logos = [];
    if (data[clearArtKey]) {
        for (const img of data[clearArtKey]) {
            logos.push({ url: img.url, type: "logo" });
        }
    }

    // clearart (distinct from the generic "logos" bucket above)
    const clearart = [];
    if (data[clearArtKey]) {
        for (const img of data[clearArtKey]) {
            clearart.push({ url: img.url, likes: img.likes, lang: img.lang, type: "Clearart" });
        }
    }

    // clearlogo
    const clearLogoKey = type === "show" ? "clearlogo" : "movielogo";
    const clearlogos = [];
    if (data[clearLogoKey]) {
        for (const img of data[clearLogoKey]) {
            clearlogos.push({ url: img.url, likes: img.likes, lang: img.lang, type: "ClearLogo" });
        }
    }

    // logo (hdtvlogo / movielogo)
    const tvLogoKey = type === "show" ? "hdtvlogo" : "movielogo";
    const tvlogos = [];
    if (data[tvLogoKey]) {
        for (const img of data[tvLogoKey]) {
            tvlogos.push({ url: img.url, likes: img.likes, lang: img.lang, type: "Logo" });
        }
    }

    // characters (TV only)
    const characters = [];
    if (type === "show" && Array.isArray(data.characterart)) {
        for (const img of data.characterart) {
            characters.push({ url: img.url, likes: img.likes, lang: img.lang, type: "Character" });
        }
    }

    // banners
    const bannerKey = type === "show" ? "tvbanner" : "moviebanner";
    const banners = [];
    if (data[bannerKey]) {
        for (const img of data[bannerKey]) {
            banners.push({ url: img.url, likes: img.likes, lang: img.lang });
        }
    }

    // discs
    const discKey = "moviedisc";
    const discs = [];
    if (data[discKey]) {
        for (const img of data[discKey]) {
            discs.push({ url: img.url, likes: img.likes, disc: img.disc_number, discType: img.disc_type });
        }
    }

    // thumbs
    const thumbKey = type === "show" ? "tvthumb" : "moviethumb";
    const thumbs = [];
    if (data[thumbKey]) {
        for (const img of data[thumbKey]) {
            thumbs.push({ url: img.url, likes: img.likes, lang: img.lang });
        }
    }

    return { posters, backgrounds, logos, clearart, clearlogos, tvlogos, characters, banners, discs, thumbs };
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
