export function mapToJellyfinItem(item, type, serverId) {
    const isEpisode = item.season && item.episode;
    const isMovie = type === "movie";
    const isShow = type === "show";
    const isFolder = isShow && !item.season;
    const itemId = generateItemId(item.id || item.filePath);
    const showId = item.showName ? generateItemId(item.showName) : null;
    const seasonId = item.showName && item.season ? generateItemId(`${item.showName}-s${item.season}`) : null;

    const base = {
        Name: item.title || "Unknown",
        ServerId: serverId || "hmss-local",
        Id: itemId,
        SortName: (item.title || "unknown").toLowerCase(),
        Path: item.filePath || "",
        ChannelId: null,
        IsFolder: isFolder || false,
        Type: isEpisode ? "Episode" : isMovie ? "Movie" : isShow ? "Series" : "Audio",
        UserData: {
            PlaybackPositionTicks: 0,
            PlayCount: 0,
            IsFavorite: false,
            Played: false,
            Key: addDashesToUuid(itemId),
            ItemId: itemId,
        },
        ImageTags: {},
        BackdropImageTags: [],
        ImageBlurHashes: {},
        LocationType: "FileSystem",
        MediaType: isFolder ? undefined : isMovie || isEpisode ? "Video" : "Audio",
    };

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

    return { Items: items.slice(0, limit), TotalRecordCount: items.length, StartIndex: 0 };
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
