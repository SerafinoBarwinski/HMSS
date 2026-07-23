import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { stringify } from "yaml";
import { getAddonsByCapability } from "./addon_loader.js";

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
    const providers = getAddonsByCapability("metadata");
    if (providers.length === 0) return;

    const query = {
        filename: path.basename(item.filePath),
        type: item.showName ? "show" : "movie",
    };

    for (const provider of providers) {
        try {
            if (!provider.module.identify) continue;
            const result = await provider.module.identify({
                filename: path.basename(item.filePath),
                type: item.showName ? "show" : "movie",
            });
            if (!result) continue;

            const metaPath = path.join(targetDir, "meta.yaml");
            const { parse: yamlParse } = await import("yaml");
            const { readFile } = await import("node:fs/promises");

            try {
                const existing = await readFile(metaPath, "utf-8");
                const parsed = yamlParse(existing);
                parsed.enriched_name = result.name;
                parsed.overview = result.overview;
                parsed.tmdb_id = result.id;
                parsed.year = result.year || parsed.year;

                // fetch external IDs for artwork providers
                const type = item.showName ? "show" : "movie";
                try {
                    if (provider.module.getExternalIds) {
                        const external = await provider.module.getExternalIds(result.id, type);
                        if (external) {
                            parsed.tvdb_id = external.tvdb_id;
                            parsed.imdb_id = external.imdb_id;
                        }
                    }
                } catch {}

                await writeFile(metaPath, stringify(parsed));
                results.push({ type: "enrich", path: targetDir, source: provider.id, name: result.name });
            } catch {}
        } catch (e) {
            console.warn(`Enrich failed for ${item.filePath}: ${e.message}`);
        }
    }
}

async function downloadArtwork(item, targetDir, results) {
    const providers = getAddonsByCapability("artwork");
    if (providers.length === 0) return;

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

            if (!tmdbId) continue;

            const fanartId = (item.showName && tvdbId) ? tvdbId : tmdbId;

            const downloads = await provider.module.downloadBest({
                tmdbId: fanartId,
                type: item.showName ? "show" : "movie",
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

function capitalizeName(name) {
    if (!name) return "";
    return name
        .replace(/[-_]/g, " ")
        .split(" ")
        .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(" ");
}
