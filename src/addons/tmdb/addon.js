// TMDB Metadata Addon v2.0
// Full details: credits, external_ids, content_ratings, videos

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
        const match = await bestDurationMatch(results[0].id, ffprobe.duration, type);
        if (match) return match;
    }

    return { ...results[0], confidence: results.length === 1 ? 0.9 : 0.7 };
}

export async function getDetails(tmdbId, type) {
    if (!apiKey || !tmdbId) return null;
    const mediaType = type === "show" || type === "series" ? "tv" : "movie";
    const url = `${BASE}/${mediaType}/${tmdbId}?append_to_response=credits,external_ids,content_ratings,videos,keywords&language=${language}${authParam()}`;
    const resp = await fetch(url, { headers: authHeaders() });
    if (!resp.ok) return null;
    const d = await resp.json();

    const details = {
        original_title: d.original_name || d.original_title || null,
        official_rating: null,
        community_rating: d.vote_average || null,
        status: d.status || null,
        taglines: d.taglines || [],
        backdrop: d.backdrop_path ? `https://image.tmdb.org/t/p/w1280${d.backdrop_path}` : null,
        poster: d.poster_path ? `https://image.tmdb.org/t/p/w500${d.poster_path}` : null,
    };

    // content rating (US first, fallback to first available)
    if (d.content_ratings?.results) {
        const us = d.content_ratings.results.find(r => r.iso_3166_1 === "US");
        details.official_rating = us?.rating || d.content_ratings.results[0]?.rating || null;
    }
    if (d.release_dates?.results) {
        const us = d.release_dates.results.find(r => r.iso_3166_1 === "US");
        const rl = us?.release_dates?.[0] || d.release_dates.results[0]?.release_dates?.[0];
        if (rl?.certification) details.official_rating = rl.certification;
    }

    // providers / external IDs
    details.provider_ids = {};
    if (d.external_ids) {
        if (d.external_ids.imdb_id) details.provider_ids.imdb = d.external_ids.imdb_id;
        if (d.external_ids.tvdb_id) details.provider_ids.tvdb = String(d.external_ids.tvdb_id);
    }
    details.provider_ids.tmdb = String(d.id);

    // external URLs
    details.external_urls = [];
    if (d.external_ids?.imdb_id) {
        details.external_urls.push({ Name: "IMDb", Url: `https://www.imdb.com/title/${d.external_ids.imdb_id}` });
    }
    details.external_urls.push({ Name: "TMDB", Url: `https://www.themoviedb.org/${mediaType}/${d.id}` });
    if (d.external_ids?.tvdb_id) {
        details.external_urls.push({ Name: "TVDB", Url: `https://thetvdb.com/dseries/${d.external_ids.tvdb_id}` });
    }

    // premiere date
    details.premiere_date = d.first_air_date || d.release_date || null;
    details.end_date = d.last_air_date || null;

    // genres (already strings from search, but full details has objects)
    if (d.genres) {
        details.genres = d.genres.map(g => g.name);
    }

    // people (cast + crew)
    details.people = [];
    if (d.credits?.cast) {
        for (const c of d.credits.cast.slice(0, 20)) {
            details.people.push({
                name: c.name,
                role: c.character || "",
                type: "Actor",
                tmdb_id: String(c.id),
            });
        }
    }
    if (d.credits?.crew) {
        for (const c of d.credits.crew.filter(c => ["Director", "Producer", "Executive Producer"].includes(c.job)).slice(0, 10)) {
            details.people.push({
                name: c.name,
                role: c.job,
                type: c.job,
                tmdb_id: String(c.id),
            });
        }
    }

    // studios
    details.studios = [];
    if (d.production_companies) {
        for (const s of d.production_companies.slice(0, 10)) {
            details.studios.push({ name: s.name, tmdb_id: String(s.id) });
        }
    }

    // trailers
    details.trailers = [];
    if (d.videos?.results) {
        for (const v of d.videos.results.filter(v => v.site === "YouTube" && v.type === "Trailer").slice(0, 3)) {
            details.trailers.push({ Url: `https://www.youtube.com/watch?v=${v.key}` });
        }
    }

    // keywords / tags
    details.tags = [];
    if (d.keywords?.keywords) {
        details.tags = d.keywords.keywords.map(k => k.name);
    } else if (d.keywords?.results) {
        details.tags = d.keywords.results.map(k => k.name);
    }

    // number of episodes / seasons for ChildCount
    details.child_count = d.number_of_seasons || 0;
    details.episode_count = d.number_of_episodes || 0;
    details.seasons = [];
    if (d.seasons) {
        for (const s of d.seasons) {
            details.seasons.push({
                season_number: s.season_number,
                name: s.name,
                episode_count: s.episode_count,
                overview: s.overview,
                premiere_date: s.air_date || null,
            });
        }
    }

    return details;
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

async function bestDurationMatch(tmdbId, fileDuration, type) {
    try {
        const mediaType = type === "show" || type === "series" ? "tv" : "movie";
        const url = `${BASE}/${mediaType}/${tmdbId}?language=${language}${authParam()}`;
        const resp = await fetch(url, { headers: authHeaders() });
        if (!resp.ok) return null;
        const data = await resp.json();
        const runtime = data.runtime || (data.episode_run_time?.[0]);
        if (runtime && Math.abs(runtime * 60 - fileDuration) < 300) {
            return { id: String(data.id), name: data.name || data.title, year: data.first_air_date?.split("-")[0] || data.release_date?.split("-")[0], overview: data.overview, source: "tmdb", confidence: 0.95 };
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
