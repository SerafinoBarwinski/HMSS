import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { stringify } from "yaml";
import { getAddonsByCapability, getAddonsByCapabilityAndType, isAnime, countFields } from "./addon_loader.js";

export async function organizeShows(shows, options = {}) {
    const results = [];
    const seenShows = new Set();

    for (const ep of shows) {
        const epDir = path.dirname(ep.filePath);
        const showDir = path.resolve(epDir, "..");

        const episodeMeta = {
            name: ep.title,
            season: ep.season,
            episode: ep.episode,
        };

        await mkdir(epDir, { recursive: true });
        await writeFile(path.join(epDir, "meta.yaml"), stringify(episodeMeta));
        results.push({ type: "episode", path: epDir, meta: episodeMeta });

        // skip per-episode artwork — episodes have no unique banners
        const isNewShow = !seenShows.has(showDir);
        if (!isNewShow) continue;
        seenShows.add(showDir);

        // only write show-level meta if it doesn't exist
        const showMetaPath = path.join(showDir, "meta.yaml");

        try {
            const existing = await import("node:fs/promises").then(fs => fs.stat(showMetaPath));
        } catch {
            const showMeta = {
                name: capitalizeName(ep.showName),
                description: "",
                poster: "poster.jpg",
            };
            await writeFile(showMetaPath, stringify(showMeta));
            results.push({ type: "show", path: showDir, meta: showMeta });
        }

        // try to enrich with metadata addons
        if (options.enrich) {
            await enrichWithMetadata(ep, showDir, results);
        }

        // try to download artwork
        if (options.artwork) {
            await downloadArtwork(ep, showDir, results);
        }
    }

    return results;
}

export async function organizeMovies(movies, options = {}) {
    const results = [];

    for (const movie of movies) {
        const movieDir = path.dirname(movie.filePath);
        const groupDir = path.resolve(movieDir, "..");

        const meta = {
            name: capitalizeName(path.parse(movie.filePath).name),
            description: "",
            year: movie.year,
            genre: movie.group ? [capitalizeName(movie.group)] : [],
            poster: "poster.jpg",
        };

        await mkdir(movieDir, { recursive: true });
        await writeFile(path.join(movieDir, "meta.yaml"), stringify(meta));
        results.push({ type: "movie", path: movieDir, meta });

        // group-level meta
        const groupMetaPath = path.join(groupDir, "meta.yaml");
        try {
            await (await import("node:fs/promises")).stat(groupMetaPath);
        } catch {
            await writeFile(groupMetaPath, stringify({
                name: capitalizeName(movie.group || "Movies"),
                description: "",
            }));
        }

        if (options.enrich) await enrichWithMetadata(movie, movieDir, results);
        if (options.artwork) await downloadArtwork(movie, movieDir, results);
    }

    return results;
}

export async function organizeMusic(tracks, options = {}) {
    const results = [];

    for (const track of tracks) {
        const trackDir = path.dirname(track.filePath);
        const albumDir = path.resolve(trackDir, "..");
        const artistDir = path.resolve(albumDir, "..");

        const meta = {
            name: track.title,
            artist: track.artist,
            album: track.album,
        };

        await mkdir(trackDir, { recursive: true });
        await writeFile(path.join(trackDir, "meta.yaml"), stringify(meta));
        results.push({ type: "track", path: trackDir, meta });
    }

    return results;
}

async function enrichWithMetadata(item, targetDir, results) {
    const isShow = !!item.showName;
    const searchName = isShow ? item.showName : path.basename(item.filePath);
    const anime = isShow && isAnime(item.showName);

    const metaPath = path.join(targetDir, "meta.yaml");
    const { parse: yamlParse } = await import("yaml");
    const { readFile } = await import("node:fs/promises");

    let existingParsed = {};
    try {
        existingParsed = yamlParse(await readFile(metaPath, "utf-8")) || {};
    } catch {}

    // collect results from all matching providers
    const candidates = [];
    const mediaType = isShow ? "show" : "movie";
    const capList = anime ? ["anime-meta", "metadata"] : ["metadata"];
    const seenCaps = new Set();

    for (const cap of capList) {
        if (seenCaps.has(cap)) continue;
        seenCaps.add(cap);
        const providers = getAddonsByCapabilityAndType(cap, mediaType);
        for (const provider of providers) {
            try {
                if (!provider.module.identify) continue;
                const result = await provider.module.identify({
                    filename: searchName,
                    type: mediaType,
                });
                if (!result) continue;

                let external = null;
                try {
                    if (provider.module.getExternalIds) {
                        external = await provider.module.getExternalIds(result.id, mediaType);
                    }
                } catch {}

                candidates.push({ result, external, source: provider.id });
            } catch (e) {
                console.warn(`Enrich '${provider.id}' failed for ${item.filePath}: ${e.message}`);
            }
        }
    }

    if (candidates.length === 0) return;

    // pick candidate with most filled fields
    let best = candidates[0];
    let bestScore = countFields(best.result);
    for (let i = 1; i < candidates.length; i++) {
        const score = countFields(candidates[i].result);
        if (score > bestScore) {
            best = candidates[i];
            bestScore = score;
        }
    }

    // merge into meta.yaml — never overwrite existing `name`
    existingParsed.overview = best.result.overview || existingParsed.overview;
    existingParsed.tmdb_id = best.result.id;
    existingParsed.year = best.result.year || existingParsed.year;
    if (best.result.genres && best.result.genres.length > 0) existingParsed.genre = best.result.genres;
    existingParsed.metadata_provider = best.source;
    if (best.external) {
        existingParsed.tvdb_id = best.external.tvdb_id || existingParsed.tvdb_id;
        existingParsed.imdb_id = best.external.imdb_id || existingParsed.imdb_id;
    }
    if (anime) existingParsed.anime = true;

    // fetch full details from TMDB
    let details = null;
    const tmdbList = getAddonsByCapability("metadata").filter(p => p.id === "tmdb");
    const tmdbProvider = tmdbList[0];
    if (tmdbProvider?.module?.getDetails && best.result.id) {
        try {
            details = await tmdbProvider.module.getDetails(best.result.id, mediaType);
        } catch (e) {
            console.warn(`TMDB getDetails failed for ${searchName}: ${e.message}`);
        }
    }

    if (details) {
        existingParsed.original_title = details.original_title || existingParsed.original_title;
        existingParsed.official_rating = details.official_rating || existingParsed.official_rating;
        existingParsed.community_rating = details.community_rating || existingParsed.community_rating;
        existingParsed.status = details.status || existingParsed.status;
        existingParsed.premiere_date = details.premiere_date || existingParsed.premiere_date;
        existingParsed.end_date = details.end_date || existingParsed.end_date;
        existingParsed.taglines = details.taglines?.length ? details.taglines : existingParsed.taglines;
        existingParsed.tags = details.tags?.length ? details.tags : existingParsed.tags;
        existingParsed.trailers = details.trailers?.length ? details.trailers : existingParsed.trailers;
        existingParsed.people = details.people?.length ? details.people : existingParsed.people;
        existingParsed.studios = details.studios?.length ? details.studios : existingParsed.studios;
        existingParsed.external_urls = details.external_urls?.length ? details.external_urls : existingParsed.external_urls;
        existingParsed.provider_ids = details.provider_ids || existingParsed.provider_ids;
        existingParsed.child_count = details.child_count || existingParsed.child_count;
        existingParsed.episode_count = details.episode_count || existingParsed.episode_count;
        if (details.genres?.length) existingParsed.genre = details.genres;
        if (details.original_title) existingParsed.original_title = details.original_title;
    }

    await writeFile(metaPath, stringify(existingParsed));
    results.push({ type: "enrich", path: targetDir, source: best.source, name: best.result.name });
}

async function downloadArtwork(item, targetDir, results) {
    const isShow = !!item.showName;
    const anime = isShow && isAnime(item.showName);
    const mediaType = isShow ? "show" : "movie";

    const capList = anime ? ["anime-artwork", "artwork"] : ["artwork"];
    const seenCaps = new Set();

    for (const cap of capList) {
        if (seenCaps.has(cap)) continue;
        seenCaps.add(cap);
        const providers = getAddonsByCapabilityAndType(cap, mediaType);
        for (const provider of providers) {
            try {
                if (!provider.module.downloadBest) continue;

                const metaPath = path.join(targetDir, "meta.yaml");
                let tmdbId = null;
                let tvdbId = null;
                try {
                    const { parse: yamlParse } = await import("yaml");
                    const { readFile } = await import("node:fs/promises");
                    const parsed = yamlParse(await readFile(metaPath, "utf-8"));
                    tmdbId = parsed.tmdb_id;
                    tvdbId = parsed.tvdb_id;
                } catch {}

                if (cap === "artwork" && !tmdbId) continue;

                const downloads = await provider.module.downloadBest({
                    tmdbId,
                    showName: item.showName || item.title || "",
                    type: mediaType,
                    targetDir,
                });
                for (const d of downloads) {
                    results.push({ type: "artwork", path: d.path, artworkType: d.type });
                }
            } catch (e) {
                console.warn(`Artwork download failed for ${item.filePath}: ${e.message}`);
            }
        }
    }
}

function capitalizeName(name) {
    if (!name) return "";
    return name
        .replace(/[-_]/g, " ")
        .split(" ")
        .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(" ");
}
