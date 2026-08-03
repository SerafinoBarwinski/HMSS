import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { getAddonLibraries } from "./addon_loader.js";
import { findImageInDir, addDashesToUuid } from "./jellyfin_items.js";

export const ADDON_COLLECTION_TYPE = "addon";
export const ADDON_FILE_TYPE = "Game";

// --- reversible item ids ------------------------------------------------
// Ids are hex-encoded JSON so a hashed id can be resolved back to
// (addon, library, relative path) without a lookup table.
//   collection: { t: "c", a: <addonId>, l: <libName> }
//   item:       { t: "i", a: <addonId>, l: <libName>, p: <relPath> }

export function encodeLibId(meta) {
    return Buffer.from(JSON.stringify(meta)).toString("hex");
}

export function decodeLibId(id) {
    if (typeof id !== "string" || !id || !/^[0-9a-f]+$/i.test(id)) return null;
    try {
        const meta = JSON.parse(Buffer.from(id, "hex").toString("utf8"));
        if (meta && meta.t && meta.a && meta.l) return meta;
        return null;
    } catch {
        return null;
    }
}

export function isAddonLibraryId(id) {
    return Boolean(decodeLibId(id));
}

export function collectionIdFor(lib) {
    return encodeLibId({ t: "c", a: lib.addon, l: lib.name });
}

export function itemIdFor(lib, relPath) {
    return encodeLibId({ t: "i", a: lib.addon, l: lib.name, p: relPath });
}

export function findCollection(addonId, libName) {
    return getAddonLibraries().find(l => l.addon === addonId && l.name === libName) || null;
}

export function getAddonCollections() {
    return getAddonLibraries();
}

function absPath(lib, relPath) {
    const parts = relPath ? relPath.split("/").filter(Boolean) : [];
    return parts.length ? path.join(lib.path, ...parts) : lib.path;
}

function parentRelPath(relPath) {
    const i = relPath ? relPath.lastIndexOf("/") : -1;
    return i === -1 ? null : relPath.slice(0, i);
}

function userData(id) {
    return {
        PlaybackPositionTicks: 0,
        PlayCount: 0,
        IsFavorite: false,
        Played: false,
        Key: addDashesToUuid(id),
        ItemId: id,
    };
}

function baseFields(id, serverId) {
    return {
        ServerId: serverId,
        Id: id,
        ChannelId: null,
        LocationType: "FileSystem",
        MediaType: "Unknown",
        CanDelete: false,
        CanDownload: false,
        ExternalUrls: [],
        Taglines: [],
        Genres: [],
        PlayAccess: "Full",
        RemoteTrailers: [],
        ProviderIds: {},
        People: [],
        Studios: [],
        GenreItems: [],
        LocalTrailerCount: 0,
        SpecialFeatureCount: 0,
        DisplayPreferencesId: id,
        Tags: [],
        ImageBlurHashes: {},
        LockedFields: [],
        LockData: false,
        UserData: userData(id),
    };
}

export function makeCollectionItem(lib, serverId) {
    const id = collectionIdFor(lib);
    const img = findImageInDir(lib.path, "Primary");
    return {
        ...baseFields(id, serverId),
        Name: lib.name.charAt(0).toUpperCase() + lib.name.slice(1),
        SortName: lib.name.toLowerCase(),
        CollectionType: ADDON_COLLECTION_TYPE,
        Locations: [lib.path],
        LibraryOptions: {
            Enabled: true,
            SaveLocalMetadata: false,
            PreferredMetadataLanguage: "en",
            MetadataCountryCode: "US",
            AllowEmbeddedSubtitles: "AllowAll",
            PathInfos: [{ Path: lib.path }],
        },
        ItemId: id,
        Etag: id,
        DateCreated: new Date().toISOString(),
        DateLastMediaAdded: "0001-01-01T00:00:00.0000000Z",
        Path: lib.path,
        EnableMediaSourceDisplay: true,
        Type: "CollectionFolder",
        ParentId: null,
        PrimaryImageAspectRatio: 1.7777777777777777,
        ImageTags: img ? { Primary: img.tag } : {},
        BackdropImageTags: [],
        PrimaryImageItemId: null,
        RefreshProgress: 0,
        RefreshStatus: "Idle",
        AddonLibrary: { addon: lib.addon, library: lib.name, isFolder: true },
    };
}

function makeFolderItem(lib, relPath, name, childCount, serverId) {
    const id = itemIdFor(lib, relPath);
    const parent = parentRelPath(relPath);
    const img = findImageInDir(absPath(lib, relPath), "Primary");
    return {
        ...baseFields(id, serverId),
        Name: name,
        SortName: name.toLowerCase(),
        Path: absPath(lib, relPath),
        Type: "Folder",
        IsFolder: true,
        ChildCount: childCount,
        ParentId: parent === null ? collectionIdFor(lib) : itemIdFor(lib, parent),
        PrimaryImageAspectRatio: 1,
        ImageTags: img ? { Primary: img.tag } : {},
        BackdropImageTags: [],
        AddonLibrary: { addon: lib.addon, library: lib.name, relPath, isFolder: true },
    };
}

function makeFileItem(lib, relPath, name, size, serverId) {
    const id = itemIdFor(lib, relPath);
    const abs = absPath(lib, relPath);
    const dir = abs.slice(0, abs.lastIndexOf(path.sep));
    const parent = parentRelPath(relPath);
    const img = findImageInDir(dir, "Primary");
    return {
        ...baseFields(id, serverId),
        Name: name.replace(/\.[^.]+$/, ""),
        SortName: name.toLowerCase(),
        Path: abs,
        Type: ADDON_FILE_TYPE,
        MediaType: ADDON_FILE_TYPE,
        IsFolder: false,
        Size: size,
        ParentId: parent === null ? collectionIdFor(lib) : itemIdFor(lib, parent),
        PrimaryImageAspectRatio: 1,
        ImageTags: img ? { Primary: img.tag } : {},
        BackdropImageTags: [],
        AddonLibrary: { addon: lib.addon, library: lib.name, relPath, isFolder: false },
    };
}

export async function browseAddonLibrary(serverId, parentId) {
    const meta = decodeLibId(parentId);
    if (!meta) return null;
    const lib = findCollection(meta.a, meta.l);
    if (!lib) return null;

    let dirRel = "";
    if (meta.t === "i") {
        dirRel = meta.p || "";
        try {
            const st = await stat(absPath(lib, dirRel));
            if (!st.isDirectory()) return null;
        } catch {
            return null;
        }
    }

    let entries;
    try {
        entries = await readdir(absPath(lib, dirRel), { withFileTypes: true });
    } catch {
        return null;
    }

    const items = [];
    for (const e of entries) {
        if (e.name.startsWith(".")) continue;
        const rel = dirRel ? dirRel + "/" + e.name : e.name;
        const abs = absPath(lib, rel);
        let st;
        try { st = await stat(abs); } catch { continue; }
        if (st.isDirectory()) {
            let childCount = 0;
            try { childCount = (await readdir(abs)).length; } catch { }
            items.push(makeFolderItem(lib, rel, e.name, childCount, serverId));
        } else if (st.isFile()) {
            items.push(makeFileItem(lib, rel, e.name, st.size, serverId));
        }
    }
    items.sort((a, b) => a.IsFolder !== b.IsFolder ? (a.IsFolder ? -1 : 1) : a.SortName.localeCompare(b.SortName));
    return { Items: items, TotalRecordCount: items.length, StartIndex: 0 };
}

export async function getAddonLibraryItem(serverId, rawId) {
    const meta = decodeLibId(rawId);
    if (!meta) return null;
    const lib = findCollection(meta.a, meta.l);
    if (!lib) return null;
    if (meta.t === "c") return makeCollectionItem(lib, serverId);

    const rel = meta.p || "";
    const abs = absPath(lib, rel);
    let st;
    try { st = await stat(abs); } catch { return null; }
    if (st.isDirectory()) {
        let childCount = 0;
        try { childCount = (await readdir(abs)).length; } catch { }
        return makeFolderItem(lib, rel, rel.split("/").pop() || lib.name, childCount, serverId);
    }
    if (st.isFile()) {
        return makeFileItem(lib, rel, rel.split("/").pop(), st.size, serverId);
    }
    return null;
}

export async function resolveLibraryImage(rawId, imageType) {
    const meta = decodeLibId(rawId);
    if (!meta) return null;
    const lib = findCollection(meta.a, meta.l);
    if (!lib) return null;

    if (meta.t === "c") {
        const root = findImageInDir(lib.path, imageType);
        if (root) return root;
        let entries = [];
        try { entries = await readdir(lib.path, { withFileTypes: true }); } catch { return null; }
        const dirs = entries.filter(e => e.isDirectory() && !e.name.startsWith("."));
        const shuffled = [].concat(dirs).sort(() => Math.random() - 0.5);
        for (const d of shuffled.slice(0, 20)) {
            const img = findImageInDir(path.join(lib.path, d.name), imageType);
            if (img) return img;
        }
        return null;
    }

    const abs = absPath(lib, meta.p || "");
    let st;
    try { st = await stat(abs); } catch { return null; }
    const dir = st.isDirectory() ? abs : abs.slice(0, abs.lastIndexOf(path.sep));
    return findImageInDir(dir, imageType);
}
