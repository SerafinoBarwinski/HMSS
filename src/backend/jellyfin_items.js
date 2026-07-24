import { existsSync } from "node:fs";
import { getItemMeta } from "./meta_reader.js";
import { readFileSync } from "node:fs";
import { parse } from "yaml";

export function findPosterPath(filePath) {
    if (!filePath) return null;
    const dirs = [filePath.substring(0, filePath.lastIndexOf("/")), filePath.substring(0, filePath.lastIndexOf("/")) + "/.."];

    for (const dir of dirs) {
        for (const ext of [".jpg", ".png", ".webp"]) {
            for (const name of ["poster", "hero", "folder"]) {
                const fp = `${dir}/${name}${ext}`;
                if (existsSync(fp)) return { path: fp, tag: generateItemId(fp) };
            }
        }
    }
    return null;
}

export function mapToJellyfinItem(item, type, serverId) {
    const meta = getItemMeta(item.filePath);
    const isEpisode = item.season && item.episode;
    const isMovie = type === "movie";
    const isShow = type === "show";
    const isUnsorted = type === "unsorted";
    const isFolder = isShow && !item.season;
    const itemId = generateItemId(item.id || item.filePath);
    const showId = item.showName ? generateItemId(item.showName) : null;
    const seasonId = item.showName && item.season ? generateItemId(`${item.showName}-s${item.season}`) : null;

    const base = {
        Name: meta?.name || item.title || "Unknown",
        ServerId: serverId || "hmss-local",
        Id: itemId,
        SortName: (meta?.name || item.title || "unknown").toLowerCase(),
        Overview: meta?.overview || undefined,
        Path: item.filePath || "",
        ChannelId: null,
        IsFolder: isFolder || false,
        Type: isEpisode ? "Episode" : isMovie ? "Movie" : isShow ? "Series" : isUnsorted ? "Video" : "Audio",
        Genres: meta?.genres || [],
        ProductionYear: meta?.year || item.year || undefined,
        UserData: {
            PlaybackPositionTicks: 0,
            PlayCount: 0,
            IsFavorite: false,
            Played: false,
            Key: addDashesToUuid(itemId),
            ItemId: itemId,
        },
        LocationType: "FileSystem",
        MediaType: isFolder ? undefined : isMovie || isEpisode ? "Video" : "Audio",
    };

    const poster = findPosterPath(item.filePath);
    base.ImageTags = poster ? { Primary: poster.tag } : {};
    base.BackdropImageTags = [];
    base.ImageBlurHashes = poster ? { Primary: {} } : {};

    if (isEpisode) {
        base.SeriesName = item.showName;
        base.SeasonId = seasonId;
        base.SeriesId = showId;
        base.IndexNumber = item.episode;
        base.ParentIndexNumber = item.season;
        base.VideoType = "VideoFile";
    }

    if (isMovie) {
        base.VideoType = "VideoFile";
    }

    if (isFolder) {
        base.MediaType = undefined;
    }

    return base;
}

export function suggestionsFromIndex(index, userId, serverId, limit = 6) {
    const items = [];

    for (const ep of index.shows.slice(0, limit)) {
        items.push(mapToJellyfinItem({
            id: ep.id,
            title: ep.title,
            showName: ep.showName,
            season: ep.season,
            episode: ep.episode,
            year: ep.year,
            filePath: ep.filePath,
        }, "show", serverId));
    }

    for (const m of index.movies.slice(0, limit)) {
        items.push(mapToJellyfinItem({
            id: m.id,
            title: m.title,
            genre: m.group ? [m.group] : [],
            year: m.year,
            filePath: m.filePath,
        }, "movie", serverId));
    }

    for (const m of index.music.slice(0, limit)) {
        items.push(mapToJellyfinItem({
            id: m.id,
            title: m.title,
            artist: m.artist,
            album: m.album,
            filePath: m.filePath,
        }, "music", serverId));
    }

    for (const u of index.unsorted?.slice(0, limit) || []) {
        items.push({
            Name: u.title || "Unknown",
            ServerId: serverId || "hmss-local",
            Id: generateItemId(u.id || u.filePath),
            SortName: (u.title || "unknown").toLowerCase(),
            Path: u.filePath || "",
            ChannelId: null,
            IsFolder: false,
            Type: "Video",
            MediaType: "Video",
            UserData: { PlaybackPositionTicks: 0, PlayCount: 0, IsFavorite: false, Played: false, Key: addDashesToUuid(generateItemId(u.id || u.filePath)), ItemId: generateItemId(u.id || u.filePath) },
            LocationType: "FileSystem",
            ImageTags: {},
            BackdropImageTags: [],
        });
    }

    return { Items: items.slice(0, limit), TotalRecordCount: items.length, StartIndex: 0 };
}

export function filteredItemsFromIndex(index, serverId, { parentId, includeItemTypes, limit, startIndex } = {}) {
    const maxLimit = Math.min(parseInt(limit) || 100, 1000);
    const skip = parseInt(startIndex) || 0;
    const types = includeItemTypes ? (Array.isArray(includeItemTypes) ? includeItemTypes : [includeItemTypes]) : null;
    const items = [];

    const addIf = (item, entryType, jellyfinType) => {
        if (types && !types.includes(jellyfinType)) return;
        items.push(mapToJellyfinItem(item, entryType, serverId));
    };

    // shows
    if (parentId === "shows" || parentId === "tvshows") {
        if (!types || types.includes("Series")) {
            const seenShows = new Set();
            for (const ep of index.shows || []) {
                const key = ep.showName;
                if (!seenShows.has(key)) {
                    seenShows.add(key);
                    items.push(makeShowFolder(ep, serverId));
                }
            }
        }
        if (!types || types.includes("Episode")) {
            for (const ep of index.shows || []) {
                addIf({ id: ep.id, title: ep.title, showName: ep.showName, season: ep.season, episode: ep.episode, year: ep.year, filePath: ep.filePath }, "show", "Episode");
            }
        }
    }

    // specific show — parentId is a show name hash
    if (parentId && parentId.length >= 32 && /^[0-9a-f]+$/.test(parentId) && parentId !== "movies" && parentId !== "shows" && parentId !== "tvshows" && parentId !== "music") {
        // check if this is a show or season
        let showEpisodes = [];
        let isSeason = false;
        for (const ep of index.shows || []) {
            const seasonId = generateItemId(`${ep.showName}-s${ep.season}`);
            if (seasonId === parentId) {
                isSeason = true;
                if (ep.showName === ep.showName && ep.season === ep.season) {
                    showEpisodes.push(ep);
                }
            }
        }
        if (isSeason) {
            // return only episodes from this specific season
            const filtered = (index.shows || []).filter(ep =>
                generateItemId(`${ep.showName}-s${ep.season}`) === parentId
            );
            for (const ep of filtered) {
                const key = ep.showName + "-s" + ep.season;
                addIf({ id: ep.id, title: ep.title, showName: ep.showName, season: ep.season, episode: ep.episode, year: ep.year, filePath: ep.filePath }, "show", "Episode");
            }
        } else {
            // return season folders + episodes for a show
            const showFilter = (index.shows || []).filter(ep => generateItemId(ep.showName) === parentId);
            if (showFilter.length > 0) {
                const seenSeasons = new Set();
                for (const ep of showFilter) {
                    const key = ep.showName + "-s" + ep.season;
                    if (!seenSeasons.has(key)) {
                        seenSeasons.add(key);
                        items.push(makeSeasonFolder(ep, serverId));
                    }
                }
                for (const ep of showFilter) {
                    addIf({ id: ep.id, title: ep.title, showName: ep.showName, season: ep.season, episode: ep.episode, year: ep.year, filePath: ep.filePath }, "show", "Episode");
                }
            }
        }
    }

    // movies
    if (parentId === "movies") {
        for (const m of index.movies || []) {
            addIf({ id: m.id, title: m.title, genre: m.group ? [m.group] : [], year: m.year, filePath: m.filePath }, "movie", "Movie");
        }
    }

    // music
    if (parentId === "music") {
        for (const m of index.music || []) {
            addIf({ id: m.id, title: m.title, artist: m.artist, album: m.album, filePath: m.filePath }, "music", "Audio");
        }
    }

    // unsorted
    if (parentId === "unsorted") {
        for (const u of index.unsorted || []) {
            items.push({
                Name: u.title || "Unknown",
                ServerId: serverId,
                Id: generateItemId(u.id || u.filePath),
                SortName: (u.title || "unknown").toLowerCase(),
                Path: u.filePath || "",
                ChannelId: null,
                IsFolder: false,
                Type: "Video",
                MediaType: "Video",
                UserData: { PlaybackPositionTicks: 0, PlayCount: 0, IsFavorite: false, Played: false, Key: addDashesToUuid(generateItemId(u.id || u.filePath)), ItemId: generateItemId(u.id || u.filePath) },
                LocationType: "FileSystem",
                ImageTags: {},
                BackdropImageTags: [],
            });
        }
    }

    // no parentId — return all
    if (!parentId) {
        for (const ep of index.shows || []) {
            addIf({ id: ep.id, title: ep.title, showName: ep.showName, season: ep.season, episode: ep.episode, year: ep.year, filePath: ep.filePath }, "show", "Episode");
        }
        for (const m of index.movies || []) {
            addIf({ id: m.id, title: m.title, genre: m.group ? [m.group] : [], year: m.year, filePath: m.filePath }, "movie", "Movie");
        }
        for (const m of index.music || []) {
            addIf({ id: m.id, title: m.title, artist: m.artist, album: m.album, filePath: m.filePath }, "music", "Audio");
        }
        for (const u of index.unsorted || []) {
            items.push({
                Name: u.title || "Unknown",
                ServerId: serverId,
                Id: generateItemId(u.id || u.filePath),
                SortName: (u.title || "unknown").toLowerCase(),
                Path: u.filePath || "",
                ChannelId: null,
                IsFolder: false,
                Type: "Video",
                MediaType: "Video",
                UserData: { PlaybackPositionTicks: 0, PlayCount: 0, IsFavorite: false, Played: false, Key: addDashesToUuid(generateItemId(u.id || u.filePath)), ItemId: generateItemId(u.id || u.filePath) },
                LocationType: "FileSystem",
                ImageTags: {},
                BackdropImageTags: [],
            });
        }
    }

    const total = items.length;
    return { Items: items.slice(skip, skip + maxLimit), TotalRecordCount: total, StartIndex: skip };
}

function makeShowFolder(ep, serverId) {
    const sid = generateItemId(ep.showName);
    const poster = findPosterInDir(`media/shows/${ep.showName}`);
    const meta = readMetaForDir(`media/shows/${ep.showName}`);
    return {
        Name: meta?.enriched_name || meta?.name || ep.showName,
        ServerId: serverId,
        Id: sid,
        SortName: (meta?.enriched_name || meta?.name || ep.showName).toLowerCase(),
        Path: `media/shows/${ep.showName}`,
        Overview: meta?.overview || undefined,
        ProductionYear: meta?.year || undefined,
        Genres: meta?.genre || [],
        ChannelId: null,
        IsFolder: true,
        Type: "Series",
        CollectionType: "tvshows",
        UserData: { PlaybackPositionTicks: 0, PlayCount: 0, IsFavorite: false, Played: false, Key: addDashesToUuid(sid), ItemId: sid },
        ImageTags: poster ? { Primary: poster.tag } : {},
        BackdropImageTags: [],
        ImageBlurHashes: poster ? { Primary: {} } : {},
        LocationType: "FileSystem",
    };
}

function makeSeasonFolder(ep, serverId) {
    const sid = generateItemId(`${ep.showName}-s${ep.season}`);
    const poster = findPosterInDir(`media/shows/${ep.showName}`);
    return {
        Name: ep.season === 0 ? "Specials" : `Season ${ep.season}`,
        ServerId: serverId,
        Id: sid,
        SortName: `Season ${String(ep.season).padStart(2, "0")}`,
        Path: `media/shows/${ep.showName}`,
        ChannelId: null,
        IsFolder: true,
        Type: "Season",
        IndexNumber: ep.season,
        SeriesName: ep.showName,
        SeriesId: generateItemId(ep.showName),
        UserData: { PlaybackPositionTicks: 0, PlayCount: 0, IsFavorite: false, Played: false, Key: addDashesToUuid(sid), ItemId: sid },
        ImageTags: poster ? { Primary: poster.tag } : {},
        BackdropImageTags: [],
        ImageBlurHashes: poster ? { Primary: {} } : {},
        LocationType: "FileSystem",
    };
}

function findPosterInDir(dir) {
    try {
        for (const ext of [".jpg", ".png", ".webp"]) {
            for (const name of ["poster", "hero", "folder"]) {
                const fp = `${dir}/${name}${ext}`;
                if (existsSync(fp)) return { path: fp, tag: generateItemId(fp) };
            }
        }
    } catch {}
    return null;
}

export function readMetaForDir(dir) {
    try {
        for (const f of ["meta.yaml", "meta.yml"]) {
            const fp = `${dir}/${f}`;
            if (existsSync(fp)) return parse(readFileSync(fp, "utf-8"));
        }
    } catch {}
    return null;
}

function generateItemId(input) {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
        const ch = input.charCodeAt(i);
        hash = ((hash << 5) - hash) + ch;
        hash |= 0;
    }
    return Math.abs(hash).toString(16).padStart(32, "0").slice(0, 32);
}

function addDashesToUuid(hex) {
    return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20,32)}`;
}
