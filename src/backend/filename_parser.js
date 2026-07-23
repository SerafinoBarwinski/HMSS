import path from "node:path";

const SHOW_PATTERNS = [
    /[Ss](\d+)[Ee](\d+)/,
    /(\d+)x(\d+)/,
    /[Ss]eason\s*(\d+)\s*[Ee]pisode\s*(\d+)/i,
    /[Ee]p\s*(\d+)\s*[Ss]\s*(\d+)/i,
    /[Ss](\d+)\s*[Ee](\d+)/,
];

const YEAR_PATTERN = /(?:^|\D)(19\d{2}|20\d{2})(?:\D|$)/;

const QUALITY_TAGS = /\b(4[kK]|2160p|1080p|720p|480p|360p|HD|UHD|HDR|DV|WEBRip|BluRay|BRRip|HDRip|WEB-DL|WEBDL)\b/;

export function parseFilename(filePath) {
    const ext = path.extname(filePath);
    const baseName = path.basename(filePath, ext);
    const dirPath = path.dirname(filePath);
    const dirParts = dirPath.split(path.sep);

    const relativePath = filePath.replace(/^\.\//, "");
    const segments = relativePath.split(path.sep);

    let type = null;
    let showName = null;
    let season = null;
    let episode = null;
    let title = null;
    let group = null;
    let year = null;
    let quality = [];
    let artist = null;
    let album = null;

    // determine type from directory context (handles media/shows/... and shows/... prefixes)
    const typeIdx = segments.indexOf("shows") !== -1 ? "shows" :
                    segments.indexOf("movie") !== -1 ? "movie" :
                    segments.indexOf("music") !== -1 ? "music" : null;

    if (typeIdx === "shows") {
        type = "show";
        const idx = segments.indexOf("shows") + 1;
        showName = segments.length > idx ? segments[idx] : null;
    } else if (typeIdx === "movie") {
        type = "movie";
        const idx = segments.indexOf("movie") + 1;
        group = segments.length > idx + 1 ? segments[idx] : null;
    } else if (typeIdx === "music") {
        type = "music";
        const idx = segments.indexOf("music") + 1;
        artist = segments.length > idx ? segments[idx] : null;
        album = segments.length > idx + 1 ? segments[idx + 1] : null;
    } else if (segments.includes("unsorted")) {
        type = detectTypeFromName(baseName, dirParts);
    }

    // parse season/episode from parent dir or filename
    if (type === "show") {
        for (const seg of [...segments, baseName]) {
            for (const pattern of SHOW_PATTERNS) {
                const match = seg.match(pattern);
                if (match) {
                    season = parseInt(match[1], 10);
                    episode = parseInt(match[2], 10);
                    break;
                }
            }
            if (season) break;
        }
    }

    // parse year
    const yearMatch = baseName.match(YEAR_PATTERN);
    if (yearMatch) year = parseInt(yearMatch[1], 10);

    // parse quality
    const qMatch = baseName.match(new RegExp(QUALITY_TAGS, "gi"));
    if (qMatch) quality = qMatch.map(q => q.toUpperCase());

    // clean title
    let clean = baseName
        .replace(/\.[^.]+$/, "")
        .replace(/[._-]/g, " ")
        .replace(/\b(S\d+E\d+|s\d+e\d+|Season\s*\d+\s*Episode\s*\d+|Ep\s*\d+\s*S\s*\d+|Episode\s*\d+)\b/gi, "")
        .replace(QUALITY_TAGS, "")
        .replace(/\(?(19|20)\d{2}\)?/g, "")
        .replace(/\b(x264|x265|HEVC|AVC|AAC|AC3|DTS)\b/gi, "")
        .replace(/\s+/g, " ")
        .trim();

    if (clean && clean !== baseName.replace(/\.[^.]+$/, "")) {
        title = clean || showName;
    }

    if (!title && type === "movie") {
        title = segments[segments.length - 1] || clean;
    }
    if (!title) title = clean || segments[segments.length - 1];

    return { type, showName, season, episode, title, group, year, quality, artist, album, filePath };
}

function detectTypeFromName(baseName, dirParts) {
    for (const pattern of SHOW_PATTERNS) {
        if (pattern.test(baseName)) return "show";
    }
    const ext = path.extname(baseName).toLowerCase();
    if ([".mp3", ".flac", ".m4a", ".ogg", ".wav", ".opus"].includes(ext)) {
        return "music";
    }
    return "movie";
}
