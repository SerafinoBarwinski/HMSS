import { existsSync, statSync } from "node:fs";
import { getItemMeta } from "./meta_reader.js";
import { readFileSync } from "node:fs";
import { parse } from "yaml";

const IMAGE_SEARCH = {
    Primary: [["poster", "crunchyroll_poster"], ["folder"]],
    Backdrop: [["hero", "crunchyroll_backdrop", "backdrop", "fanart"]],
    Logo: [["logo", "crunchyroll_logo"]],
    Thumb: [["thumb", "landscape", "thumbnail"]],
    Banner: [["banner"]],
    Disc: [["disc"]],
    Art: [["clearart", "art"]],
};

export function findImageInDir(dir, imageType) {
    if (!dir) return null;
    const candidates = IMAGE_SEARCH[imageType] || IMAGE_SEARCH.Primary;
    for (const names of candidates) {
        for (const name of names) {
            for (const ext of [".jpg", ".png", ".webp"]) {
                const fp = `${dir}/${name}${ext}`;
                if (existsSync(fp)) {
                    let sig = "";
                    try {
                        const st = statSync(fp);
                        sig = `:${st.size}:${Math.floor(st.mtimeMs)}`;
                    } catch {}
                    return { path: fp, tag: generateItemId(fp + sig) };
                }
            }
        }
    }
    return null;
}

export function findBackdropInDir(dir, index) {
    if (!dir || index == null || index < 0) return null;
    if (index === 0) return findImageInDir(dir, "Backdrop");
    const base = `hero${index + 1}`;
    for (const ext of [".jpg", ".png", ".webp"]) {
        const fp = `${dir}/${base}${ext}`;
        if (existsSync(fp)) {
            let sig = "";
            try {
                const st = statSync(fp);
                sig = `:${st.size}:${Math.floor(st.mtimeMs)}`;
            } catch {}
            return { path: fp, tag: generateItemId(fp + sig) };
        }
    }
    return null;
}

export function findAllBackdropsInDir(dir) {
    const out = [];
    if (!dir) return out;
    const seen = new Set();
    let idx = 0;
    while (true) {
        const found = findBackdropInDir(dir, idx);
        if (!found) break;
        if (!seen.has(found.path)) {
            seen.add(found.path);
            out.push({ path: found.path, tag: found.tag, index: idx });
        }
        idx++;
    }
    return out;
}

export function findPosterPath(filePath) {
    if (!filePath) return null;
    const dir = filePath.substring(0, filePath.lastIndexOf("/"));
    const parentDir = dir + "/..";
    return findImageInDir(dir, "Primary") || findImageInDir(parentDir, "Primary");
}

export function findAllImagesInDir(dir) {
    const result = [];
    if (!dir) return result;
    const seen = new Set();
    for (const type of ["Primary", "Backdrop", "Logo", "Thumb", "Banner", "Disc", "Art"]) {
        if (type === "Backdrop") {
            for (const found of findAllBackdropsInDir(dir)) {
                if (seen.has(found.path)) continue;
                seen.add(found.path);
                result.push({ type, path: found.path, tag: found.tag, index: found.index });
            }
            continue;
        }
        const found = findImageInDir(dir, type);
        if (!found || seen.has(found.path)) continue;
        seen.add(found.path);
        result.push({ type, path: found.path, tag: found.tag });
    }
    return result;
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
    const dir = item.filePath ? item.filePath.substring(0, item.filePath.lastIndexOf("/")) : null;
    const parentDir = dir ? dir + "/.." : null;

    const backdropTags = [
        ...(dir ? findAllBackdropsInDir(dir) : []),
        ...(parentDir ? findAllBackdropsInDir(parentDir) : []),
    ].filter((b, i, a) => a.findIndex(x => x.path === b.path) === i);
    const backdrop = backdropTags[0] || null;
    const logo = (dir && findImageInDir(dir, "Logo")) || (parentDir && findImageInDir(parentDir, "Logo"));

    base.ImageTags = poster ? { Primary: poster.tag } : {};
    if (logo) base.ImageTags.Logo = logo.tag;
    base.BackdropImageTags = backdropTags.map(b => b.tag);
    base.ImageBlurHashes = {};
    if (poster) base.ImageBlurHashes.Primary = {};
    if (backdropTags.length) {
        base.ImageBlurHashes.Backdrop = {};
        for (const b of backdropTags) base.ImageBlurHashes.Backdrop[b.tag] = "";
    }
    if (logo) base.ImageBlurHashes.Logo = {};

    if (isEpisode) {
        const showDir = `media/shows/${item.showName}`;
        const showBackdrops = findAllBackdropsInDir(showDir);
        const showBackdrop = showBackdrops[0] || null;
        const showLogo = findImageInDir(showDir, "Logo");
        const showPoster = findImageInDir(showDir, "Primary");

        base.SeriesName = item.showName;
        base.SeasonId = seasonId;
        base.SeriesId = showId;
        base.IndexNumber = item.episode;
        base.ParentIndexNumber = item.season;
        base.SeasonName = `Season ${item.season}`;
        base.VideoType = "VideoFile";
        base.ParentBackdropItemId = showId;
        base.ParentBackdropImageTags = showBackdrops.map(b => b.tag);
        base.ParentLogoItemId = showId;
        base.ParentLogoImageTag = showLogo ? showLogo.tag : null;
        base.ParentThumbItemId = showId;
        base.ParentThumbImageTag = showPoster ? showPoster.tag : null;
        base.SeriesPrimaryImageTag = showPoster ? showPoster.tag : null;

        base.ImageBlurHashes = {};
        if (poster) base.ImageBlurHashes.Primary = {};
        if (showBackdrop) {
            base.ImageBlurHashes.Backdrop = {};
            for (const b of showBackdrops) base.ImageBlurHashes.Backdrop[b.tag] = "";
        }
        if (showLogo) {
            base.ImageBlurHashes.Logo = {};
            base.ImageBlurHashes.Logo[showLogo.tag] = "";
        }
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

export function makeShowFolder(ep, serverId) {
    const sid = generateItemId(ep.showName);
    const dir = `media/shows/${ep.showName}`;
    const poster = findImageInDir(dir, "Primary");
    const backdrop = findImageInDir(dir, "Backdrop");
    const logo = findImageInDir(dir, "Logo");
    const thumb = findImageInDir(dir, "Thumb") || poster;
    const meta = readMetaForDir(dir);
    const imgTags = poster ? { Primary: poster.tag } : {};
    if (logo) imgTags.Logo = logo.tag;
    if (thumb && thumb !== poster) imgTags.Thumb = thumb.tag;

    const genres = meta?.genre || [];
    const genreItems = genres.map(g => ({ Name: g, Id: generateItemId(g) }));

    const people = (meta?.people || []).map(p => ({
        Name: p.name,
        Id: generateItemId(p.name),
        Role: p.role || "",
        Type: p.type || "Actor",
    }));

    const studios = (meta?.studios || []).map(s => ({
        Name: s.name,
        Id: generateItemId(s.name),
    }));

    return {
        Name: meta?.name || ep.showName,
        OriginalTitle: meta?.original_title || undefined,
        ServerId: serverId,
        Id: sid,
        SortName: (meta?.name || ep.showName).toLowerCase(),
        Overview: meta?.overview || undefined,
        PremiereDate: normalizeIsoDate(meta?.premiere_date),
        EndDate: normalizeIsoDate(meta?.end_date),
        OfficialRating: meta?.official_rating || undefined,
        CommunityRating: meta?.community_rating || null,
        ProductionYear: meta?.year || undefined,
        Status: meta?.status || undefined,
        Genres: genres,
        GenreItems: genreItems,
        Taglines: meta?.taglines || [],
        Tags: meta?.tags || [],
        ExternalUrls: meta?.external_urls || [],
        ProviderIds: meta?.provider_ids || {},
        RemoteTrailers: meta?.trailers || [],
        People: people,
        Studios: studios,
        ChildCount: meta?.child_count || 0,
        RecursiveItemCount: meta?.episode_count || 0,
        ChannelId: null,
        EnableMediaSourceDisplay: true,
        IsFolder: true,
        Type: "Series",
        CollectionType: "tvshows",
        PlayAccess: "Full",
        UserData: { PlaybackPositionTicks: 0, PlayCount: 0, IsFavorite: false, Played: false, Key: addDashesToUuid(sid), ItemId: sid },
        ImageTags: imgTags,
        BackdropImageTags: backdrop ? [backdrop.tag] : [],
        ImageBlurHashes: {},
        LocationType: "FileSystem",
        MediaType: "Unknown",
    };
}

export function makeSeasonFolder(ep, serverId) {
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

export function normalizeIsoDate(d) {
    if (!d || typeof d !== "string") return d || undefined;
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d + "T00:00:00.0000000Z";
    if (/^\d{4}-\d{2}-\d{2}T/.test(d) && !d.endsWith("Z") && d.length < 25) return d + ".0000000Z";
    return d;
}

export function addDashesToUuid(hex) {
    return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20,32)}`;
}
