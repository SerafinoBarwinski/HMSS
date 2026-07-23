// TMDB Metadata Addon v1.1
// Supports API v3 key and v4 access token (Bearer auth)

const BASE = "https://api.themoviedb.org/3";

let apiKey = "";
let language = "en";

export async function init(config) {
    apiKey = config.api_key || "";
    language = config.language || "en";
}

function authHeaders() {
    return apiKey.length > 60
        ? { Authorization: `Bearer ${apiKey}` }
        : {};
}

function authParam() {
    return apiKey.length > 60 ? "" : `&api_key=${apiKey}`;
}

export async function search({ query, year, type }) {
    if (!apiKey) throw new Error("TMDB API key not configured");

    const mediaType = type === "show" || type === "series" ? "tv" : "movie";
    const params = new URLSearchParams({ query, language });
    if (year) {
        if (mediaType === "movie") params.set("year", year);
        else params.set("first_air_date_year", year);
    }

    const url = `${BASE}/search/${mediaType}?${params}${authParam()}`;
    const resp = await fetch(url, { headers: authHeaders() });
    if (!resp.ok) throw new Error(`TMDB search failed: ${resp.status}`);

    const data = await resp.json();

    return (data.results || []).slice(0, 5).map(item => ({
        id: String(item.id),
        name: item.name || item.title,
        year: item.first_air_date?.split("-")[0] || item.release_date?.split("-")[0],
        overview: item.overview,
        poster: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
        backdrop: item.backdrop_path ? `https://image.tmdb.org/t/p/w500${item.backdrop_path}` : null,
        source: "tmdb",
    }));
}

export async function identify({ filename, ffprobe, type }) {
    if (!apiKey) return null;

    let query = "";
    if (ffprobe?.tags?.title) query = ffprobe.tags.title;
    else query = sanitizeFilename(filename);

    const results = await search({ query, type });
    if (results.length === 0) return null;

    if (ffprobe?.duration && results.length > 1) {
        const match = await bestDurationMatch(results[0].id, ffprobe.duration);
        if (match) return match;
    }

    return { ...results[0], confidence: results.length === 1 ? 0.9 : 0.7 };
}

export async function getExternalIds(tmdbId, type) {
    if (!apiKey) return null;
    const mediaType = type === "show" || type === "series" ? "tv" : "movie";
    const url = `${BASE}/${mediaType}/${tmdbId}/external_ids?language=${language}${authParam()}`;
    const resp = await fetch(url, { headers: authHeaders() });
    if (!resp.ok) return null;
    const data = await resp.json();
    return {
        imdb_id: data.imdb_id,
        tvdb_id: data.tvdb_id ? String(data.tvdb_id) : null,
    };
}

async function bestDurationMatch(tmdbId, fileDuration) {
    try {
        const url = `${BASE}/movie/${tmdbId}?language=${language}${authParam()}`;
        const resp = await fetch(url, { headers: authHeaders() });
        if (!resp.ok) return null;
        const data = await resp.json();
        if (data.runtime && Math.abs(data.runtime * 60 - fileDuration) < 300) {
            return { id: String(data.id), name: data.title, year: data.release_date?.split("-")[0], overview: data.overview, source: "tmdb", confidence: 0.95 };
        }
    } catch {}
    return null;
}

function sanitizeFilename(name) {
    return name
        .replace(/\.[^.]+$/, "")
        .replace(/[._-]/g, " ")
        .replace(/S\d+E\d+|s\d+e\d+|ep\d+/gi, "")
        .replace(/\d{4}/g, "")
        .replace(/\s+/g, " ")
        .trim();
}
