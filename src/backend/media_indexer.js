import { scanMedia } from "./media_scanner.js";
import { parseFilename } from "./filename_parser.js";

export async function buildIndex(mediaDirs) {
    const raw = await scanMedia(mediaDirs);
    const shows = [];
    const movies = [];
    const music = [];
    const unsorted = [];
    const errors = [...raw.errors];

    const allFiles = [...raw.videos, ...raw.audios];

    for (const filePath of allFiles) {
        const parsed = parseFilename(filePath);

        if (!parsed.type || parsed.type === "unsorted") {
            unsorted.push({ filePath, parsed });
            continue;
        }

        const entry = {
            id: sanitizeId(filePath),
            title: parsed.title,
            filePath,
        };

        if (parsed.type === "show") {
            shows.push({
                ...entry,
                showName: parsed.showName || parsed.title,
                season: parsed.season,
                episode: parsed.episode,
                year: parsed.year,
                quality: parsed.quality,
            });
        } else if (parsed.type === "movie") {
            movies.push({
                ...entry,
                group: parsed.group,
                year: parsed.year,
                quality: parsed.quality,
            });
        } else if (parsed.type === "music") {
            music.push({
                ...entry,
                artist: parsed.artist,
                album: parsed.album,
                year: parsed.year,
            });
        }
    }

    return { shows, movies, music, unsorted, errors };
}

function sanitizeId(filePath) {
    return filePath
        .replace(/^\.\//, "")
        .replace(/[^a-zA-Z0-9/_.-]/g, "_");
}
