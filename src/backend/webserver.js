import { getAddons, getAddonsByCapability, searchAll } from "./addon_loader.js";
import { authMiddleware, hmssAuthRoutes } from "./auth.js";
import { getSystemInfo } from "./sql.js";
import { suggestionsFromIndex, filteredItemsFromIndex, findPosterPath, readMetaForDir } from "./jellyfin_items.js";
import { probeMedia, generateItemId } from "./media_probe.js";
import { getItemMeta } from "./meta_reader.js";
import { readFile, writeFile } from "node:fs/promises";
import { killTelerisingProcess } from "./telerising.js";
import { readFileSync, readdirSync, existsSync, statSync, statfsSync, createReadStream } from "node:fs";
import http from "node:http";
import https from "node:https";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";

let _liveTvCache = { channels: [], ts: 0 };
function findLiveTvChannel(itemId) {
    return _liveTvCache.channels.find(c => c.Id === itemId) || null;
}

export async function hmssRoutes(app, getDb, apiVersion, port, mediaDirs = {}) {
    app.use(authMiddleware(getDb));
    hmssAuthRoutes(app, getDb);

    app.use((req, res, next) => {
        if (req.path.startsWith("/System")) {
            res.set("Cache-Control", "no-store, no-cache, must-revalidate");
            res.set("Pragma", "no-cache");
        }
        next();
    });

    app.get("/", (req, res) => {
        res.redirect("/web/alt_index.html");
    });

    app.post("/Startup/RemoteAccess", (req, res) => {
        res.status(204).end();
    });

    app.post("/Startup/Complete", (req, res) => {
        const db = getDb();
        db.prepare("UPDATE system SET startup_wizard_completed = 1").run();
        res.status(204).end();
    });

    app.get("/Items/:itemId/RemoteImages", async (req, res) => {
        const imageType = req.query.type || "Primary";
        const rawId = (req.params.itemId || "").replace(/-/g, "");
        const index = globalThis.__mediaIndex || { shows: [], movies: [], music: [] };
        const meta = findItemMetaById(rawId, index);
        if (!meta?.tmdbId) return res.json({ Images: [], TotalRecordCount: 0, Providers: ["TheMovieDb", "Fanart"] });

        const images = [];
        const providers = getAddonsByCapability("artwork");
        if (providers.length > 0) {
            try {
                const art = providers[0].module;
                if (art.fetchArtwork) {
                    const artwork = await art.fetchArtwork({ tmdbId: meta.tmdbId, type: meta.isShow ? "show" : "movie" });

                    const typeMap = {
                        Primary: "posters",
                        Backdrop: "backgrounds",
                        Art: "art",
                        Logo: "logos",
                        Banner: "banners",
                        Disc: "discs",
                        Thumb: "thumbs",
                        Box: "boxes",
                    };

                    if (typeMap[imageType] === "posters" && artwork.posters) {
                        for (const p of artwork.posters.slice(0, 30)) {
                            images.push(makeImageEntry("Fanart", p.url, "Primary", p.likes, p.lang));
                        }
                    }
                    if (typeMap[imageType] === "backgrounds" && artwork.backgrounds) {
                        for (const bg of artwork.backgrounds.slice(0, 30)) {
                            images.push(makeImageEntry("Fanart", bg.url, "Backdrop", bg.likes, "en"));
                        }
                    }
                    if (typeMap[imageType] === "logos" && artwork.logos) {
                        for (const l of artwork.logos.slice(0, 30)) {
                            images.push(makeImageEntry("Fanart", l.url, "Logo", 0, "en"));
                        }
                    }
                    if (typeMap[imageType] === "banners" && artwork.banners) {
                        for (const b of artwork.banners.slice(0, 30)) {
                            images.push(makeImageEntry("Fanart", b.url, "Banner", b.likes, b.lang));
                        }
                    }
                    if (typeMap[imageType] === "discs" && artwork.discs) {
                        for (const d of artwork.discs.slice(0, 30)) {
                            images.push(makeImageEntry("Fanart", d.url, "Disc", d.likes, "en"));
                        }
                    }
                    if (typeMap[imageType] === "thumbs" && artwork.thumbs) {
                        for (const t of artwork.thumbs.slice(0, 30)) {
                            images.push(makeImageEntry("Fanart", t.url, "Thumb", t.likes, t.lang));
                        }
                    }
                    // Art = clearart/logos
                    if (typeMap[imageType] === "art" && artwork.logos) {
                        for (const l of artwork.logos.slice(0, 30)) {
                            images.push(makeImageEntry("Fanart", l.url, "Art", 0, "en"));
                        }
                    }
                }
            } catch {}
        }

        const filtered = images.filter(i => i.Type === imageType);
        res.json({ Images: filtered, TotalRecordCount: filtered.length, Providers: ["TheMovieDb", "Fanart"] });
    });

    function makeImageEntry(provider, url, type, likes, lang) {
        return {
            ProviderName: provider,
            Url: url,
            ThumbnailUrl: url,
            Height: 0, Width: 0,
            CommunityRating: likes || 0,
            VoteCount: likes || 0,
            Language: lang || "en",
            Type: type,
            RatingType: "Likes",
        };
    }

    function findItemMetaById(rawId, index) {
        for (const ep of index.shows || []) {
            if (generateItemId(ep.id || ep.filePath) === rawId) {
                const meta = readMetaForDir(`media/shows/${ep.showName}`);
                return { tmdbId: meta?.tmdb_id, isShow: true };
            }
            if (generateItemId(ep.showName) === rawId) {
                const meta = readMetaForDir(`media/shows/${ep.showName}`);
                return { tmdbId: meta?.tmdb_id, isShow: true };
            }
        }
        for (const m of index.movies || []) {
            if (generateItemId(m.id || m.filePath) === rawId) {
                const dir = m.filePath.substring(0, m.filePath.lastIndexOf("/"));
                const meta = readMetaForDir(dir);
                return { tmdbId: meta?.tmdb_id, isShow: false };
            }
        }
        return null;
    }

    app.get("/Items/:itemId/Images", (req, res) => {
        const rawId = (req.params.itemId || "").replace(/-/g, "");
        const index = globalThis.__mediaIndex || { shows: [], movies: [], music: [] };
        let filePath = null;
        for (const ep of index.shows || []) {
            if (generateItemId(ep.id || ep.filePath) === rawId) { filePath = ep.filePath; break; }
            if (generateItemId(ep.showName) === rawId) { filePath = `media/shows/${ep.showName}`; break; }
        }
        if (!filePath) for (const m of index.movies || []) {
            if (generateItemId(m.id || m.filePath) === rawId) { filePath = m.filePath; break; }
        }
        if (!filePath) for (const m of index.music || []) {
            if (generateItemId(m.id || m.filePath) === rawId) { filePath = m.filePath; break; }
        }
        if (!filePath) for (const u of index.unsorted || []) {
            if (generateItemId(u.id || u.filePath) === rawId) { filePath = u.filePath; break; }
        }
        if (!filePath) return res.json([]);

        const poster = findPosterPath(filePath);
        if (!poster) return res.json([]);

        try {
            const s = statSync(poster.path);
            res.json([{
                ImageType: "Primary",
                ImageIndex: 0,
                ImageTag: poster.tag,
                Path: poster.path,
                Height: 0,
                Width: 0,
                Size: s.size,
            }]);
        } catch {
            res.json([]);
        }
    });

    app.get("/Items/:itemId/RemoteImages/Providers", (req, res) => {
        res.json([
            { Name: "TheMovieDb", SupportedImages: ["Primary", "Backdrop", "Logo", "Banner", "Thumb"] },
            { Name: "Fanart", SupportedImages: ["Primary", "Backdrop", "Logo", "Banner", "Thumb"] },
        ]);
    });

    app.get("/Items/:itemId/Images/Primary", (req, res) => {
        serveItemImage(req, res, "Primary");
    });

    app.get("/Users/:userId/Items/:itemId/Images/Primary", (req, res) => {
        serveItemImage(req, res, "Primary");
    });

    app.get("/web/ConfigurationPages", (req, res) => {
        const addons = getAddons();
        res.json(addons.map(a => ({
            Name: a.name,
            DisplayName: a.name,
            Description: a.description || "",
            EnableInMainMenu: true,
            MenuSection: "plugins",
            MenuIcon: "web_asset",
            PluginId: a.id,
        })));
    });

    app.get("/web/ConfigurationPage", (req, res) => {
        const name = req.query.name;
        if (!name) return res.status(400).end();

        const addons = getAddons();
        const addon = addons.find(a => a.id === name || a.name === name);
        if (!addon) return res.status(404).end();

        const fields = Object.entries(addon.configSchema || {}).map(([k, v]) => `
            <div class="inputContainer">
                <input is="emby-input" type="text" id="${k}" label="${v.label || k}" />
                <div class="fieldDescription">${v.description || ""}</div>
            </div>
        `).join("");

        const configKeys = Object.keys(addon.configSchema || {});
        const configObj = {};
        for (const k of configKeys) configObj[k] = addon.config[k] || "";

        res.set("Content-Type", "text/html").send(`<!DOCTYPE html>
<html><head><title>${addon.name}</title></head>
<body>
<div class="page type-interior pluginConfigurationPage configPage" data-role="page"
     data-require="emby-input,emby-button">
  <div data-role="content">
    <div class="content-primary">
      <h1>${addon.name} v${addon.version}</h1>
      <p>${addon.description}</p>
      <form class="configForm">
        ${fields}
        <br/>
        <div>
          <button is="emby-button" type="submit" class="raised button-submit block"><span>Save</span></button>
        </div>
      </form>
    </div>
  </div>

  <script>
    var PluginConfig = { pluginId: "${addon.id}" };

    document.querySelector('.configPage')
      .addEventListener('pageshow', function () {
        Dashboard.showLoadingMsg();
        ApiClient.getPluginConfiguration(PluginConfig.pluginId).then(function (config) {
          ${configKeys.map(k => `
            var el_${k} = document.querySelector('#${k}');
            if (el_${k}) { el_${k}.value = config.${k} || ''; el_${k}.dispatchEvent(new Event('change',{bubbles:true,cancelable:false})); }
          `).join("\n")}
          Dashboard.hideLoadingMsg();
        });
      });

    document.querySelector('.configForm')
      .addEventListener('submit', function (e) {
        e.preventDefault();
        Dashboard.showLoadingMsg();
        ApiClient.getPluginConfiguration(PluginConfig.pluginId).then(function (config) {
          ${configKeys.map(k => `config.${k} = (document.querySelector('#${k}') || {}).value || '';`).join("\n")}
          ApiClient.updatePluginConfiguration(PluginConfig.pluginId, config).then(Dashboard.processPluginConfigurationUpdateResult);
        });
        return false;
      });
  </script>
</div>
</body></html>`);
    });

    app.get("/Plugins/:pluginId/Configuration", (req, res) => {
        const addons = getAddons();
        const addon = addons.find(a => a.id === req.params.pluginId || a.name === req.params.pluginId);
        if (!addon) return res.status(404).json({ error: "Plugin not found" });
        res.json(addon.config);
    });

    app.post("/Plugins/:pluginId/Configuration", async (req, res) => {
        if (!req.user || req.user.perms < 2) return res.status(401).json({ error: "Unauthorized" });
        const addons = getAddons();
        const addon = addons.find(a => a.id === req.params.pluginId || a.name === req.params.pluginId);
        if (!addon) return res.status(404).json({ error: "Plugin not found" });

        const addonDir = `src/addons/${req.params.pluginId}`;
        try {
            const existing = JSON.parse(await readFile(`${addonDir}/override.json`, "utf-8").catch(() => "{}"));
            Object.assign(existing, req.body);
            await writeFile(`${addonDir}/override.json`, JSON.stringify(existing, null, 2));
            res.json({ Configuration: { ...existing } });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    function serveItemImage(req, res, imageType) {
        const rawId = (req.params.itemId || "").replace(/-/g, "");

        // LiveTV channel logo proxy
        const tvChannel = findLiveTvChannel(rawId);
        if (tvChannel && tvChannel.LogoUrl) {
            const logoUrl = tvChannel.LogoUrl;
            const client = logoUrl.startsWith("https") ? https : http;
            return client.get(logoUrl, { timeout: 8000 }, (upstream) => {
                if (upstream.statusCode >= 300 && upstream.statusCode < 400 && upstream.headers.location) {
                    const redir = upstream.headers.location;
                    const rp = redir.startsWith("https") ? https : http;
                    return rp.get(redir, { timeout: 8000 }, (r2) => {
                        res.set("Content-Type", r2.headers["content-type"] || "image/png");
                        r2.pipe(res);
                    }).on("error", () => res.status(404).end());
                }
                res.set("Content-Type", upstream.headers["content-type"] || "image/png");
                upstream.pipe(res);
            }).on("error", () => res.status(404).end());
        }

        const index = globalThis.__mediaIndex || { shows: [], movies: [], music: [] };
        let filePath = null;
        for (const ep of index.shows || []) {
            if (generateItemId(ep.id || ep.filePath) === rawId) { filePath = ep.filePath; break; }
            if (generateItemId(ep.showName) === rawId) { filePath = ep.filePath; break; }
            const seasonId = generateItemId(`${ep.showName}-s${ep.season}`);
            if (seasonId === rawId) { filePath = ep.filePath; break; }
        }
        if (!filePath) for (const m of index.movies || []) {
            if (generateItemId(m.id || m.filePath) === rawId) { filePath = m.filePath; break; }
        }
        if (!filePath) for (const m of index.music || []) {
            if (generateItemId(m.id || m.filePath) === rawId) { filePath = m.filePath; break; }
        }
        if (!filePath) for (const u of index.unsorted || []) {
            if (generateItemId(u.id || u.filePath) === rawId) { filePath = u.filePath; break; }
        }
        if (!filePath) return res.status(404).end();

        const poster = findPosterPath(filePath);
        if (!poster) return res.status(404).end();

        try {
            const s = statSync(poster.path);
            const ext = poster.path.split(".").pop();
            const mime = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
            res.set("Content-Type", mime);
            res.set("Content-Length", s.size);
            createReadStream(poster.path).pipe(res);
        } catch {
            res.status(404).end();
        }
    }

    app.get("/Localization/Options", async (req, res) => {
        const data = await readFile(new URL("./localization.json", import.meta.url), "utf-8");
        res.json(JSON.parse(data));
    });

    app.get("/Localization/Cultures", async (req, res) => {
        const data = await readFile(new URL("./cultures.json", import.meta.url), "utf-8");
        res.json(JSON.parse(data));
    });

    app.get("/Localization/Countries", async (req, res) => {
        const data = await readFile(new URL("./countries.json", import.meta.url), "utf-8");
        res.json(JSON.parse(data));
    });

    app.get("/System/Configuration", (req, res) => {
        if (!req.user || req.user.perms < 2) return res.status(401).end();
        const db = getDb();
        const sys = getSystemInfo(db);
        let stored = {};
        try { stored = JSON.parse(sys?.config_json || "{}"); } catch {}
        res.json({
            LogFileRetentionDays: 7,
            IsStartupWizardCompleted: sys ? Boolean(sys.startup_wizard_completed) : false,
            ServerName: sys?.server_name || os.hostname(),
            UICulture: "en-US",
            PreferredMetadataLanguage: "en",
            MetadataCountryCode: "US",
            QuickConnectAvailable: true,
            EnableCaseSensitiveItemIds: false,
            MinResumePct: 5,
            MaxResumePct: 95,
            MinResumeDurationSeconds: 300,
            ImageSavingConvention: "Legacy",
            EnableFolderView: false,
            EnableGroupingMoviesIntoCollections: false,
            EnableGroupingShowsIntoCollections: false,
            EnableLegacyAuthorization: false,
            ActivityLogRetentionDays: 30,
            ...stored,
        });
    });

    app.post("/System/Configuration", (req, res) => {
        if (!req.user || req.user.perms < 2) return res.status(401).end();
        const db = getDb();
        const body = req.body || {};
        if (body.ServerName) {
            db.prepare("UPDATE system SET server_name = ?").run(body.ServerName);
        }
        const sys = getSystemInfo(db);
        let existing = {};
        try { existing = JSON.parse(sys?.config_json || "{}"); } catch {}
        Object.assign(existing, body);
        db.prepare("UPDATE system SET config_json = ?").run(JSON.stringify(existing));
        res.status(204).end();
    });

    app.get("/System/Info/Storage", (req, res) => {
        if (!req.user || req.user.perms < 2) return res.status(401).end();

        const getFolder = (p) => {
            try {
                const s = statSync(p);
                let free = 0, used = s.size || 0;
                try {
                    const fs = statfsSync(p);
                    free = fs.bsize * fs.bfree;
                    used = fs.bsize * (fs.blocks - fs.bfree);
                } catch {}
                return { Path: path.resolve(p), FreeSpace: free, UsedSpace: used, StorageType: "FileSystem", DeviceId: "local" };
            } catch { return { Path: p, FreeSpace: 0, UsedSpace: 0, StorageType: "FileSystem", DeviceId: "local" }; }
        };

        const libraries = [];
        for (const [key, paths] of Object.entries(mediaDirs)) {
            for (const p of paths) {
                libraries.push({
                    Id: generateItemId(p),
                    Name: key.charAt(0).toUpperCase() + key.slice(1),
                    Folders: [getFolder(p)]
                });
            }
        }

        res.json({
            ProgramDataFolder: getFolder("."),
            WebFolder: getFolder("web"),
            ImageCacheFolder: getFolder("src/backend/profilepictures"),
            CacheFolder: getFolder("."),
            LogFolder: getFolder("src/backend/logs"),
            InternalMetadataFolder: getFolder("media"),
            TranscodingTempFolder: getFolder("."),
            Libraries: libraries,
        });
    });

    app.get("/Plugins", (req, res) => {
        if (!req.user || req.user.perms < 2) return res.status(401).end();
        const addons = getAddons();
        res.json(addons.map(a => ({
            Name: a.name,
            Version: a.version,
            Description: a.description || "",
            Id: crypto.randomUUID(),
            CanUninstall: false,
            HasImage: false,
            Status: "Active",
        })));
    });

    app.get("/Packages", (req, res) => {
        if (!req.user || req.user.perms < 2) return res.status(401).end();
        const addons = getAddons();
        res.json(addons.map(a => ({
            name: a.name,
            description: a.description || "",
            overview: a.description || "",
            owner: "HMSS",
            category: a.capabilities.join(", "),
            guid: crypto.randomUUID(),
            versions: [{
                version: a.version,
                VersionNumber: a.version,
                changelog: "",
                targetAbi: "10.11.11",
                sourceUrl: "",
                checksum: "",
                timestamp: new Date().toISOString(),
                repositoryName: "HMSS",
                repositoryUrl: "",
            }],
            imageUrl: "",
        })));
    });

    app.get("/System/Endpoint", (req, res) => {
        const ip = req.ip || req.socket.remoteAddress || "";
        const isLocal = ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1" || ip === "localhost";
        const localIP = getLocalIPv4();
        let isInNetwork = isLocal;
        if (!isInNetwork && localIP && ip) {
            const clientParts = ip.replace("::ffff:", "").split(".");
            const serverParts = localIP.split(".");
            if (clientParts.length === 4 && serverParts.length === 4) {
                isInNetwork = clientParts[0] === serverParts[0] && clientParts[1] === serverParts[1] && clientParts[2] === serverParts[2];
            }
        }
        res.json({ IsLocal: isLocal, IsInNetwork: isInNetwork });
    });

    app.get("/System/Logs/Log", (req, res) => {
        if (!req.user || req.user.perms < 2) return res.status(401).end();
        const name = req.query.name || "server.log";
        const fp = path.join("src/backend/logs", path.basename(name));
        if (!existsSync(fp)) return res.status(404).end();
        res.set("Content-Type", "text/plain; charset=utf-8");
        res.sendFile(path.resolve(fp));
    });

    app.get("/System/Logs", (req, res) => {
        if (!req.user || req.user.perms < 2) return res.status(401).end();
        const logDir = "src/backend/logs";
        const list = [];
        try {
            const files = readdirSync(logDir).filter(f => f.endsWith(".log"));
            for (const file of files) {
                const fp = path.join(logDir, file);
                const s = statSync(fp);
                list.push({
                    Name: file,
                    Size: s.size,
                    DateCreated: s.birthtime.toISOString(),
                    DateModified: s.mtime.toISOString(),
                });
            }
        } catch {}
        res.json(list);
    });

    app.get("/System/ActivityLog/Entries", (req, res) => {
        if (!req.user || req.user.perms < 2) return res.status(401).end();
        const startIndex = parseInt(req.query.startIndex) || 0;
        const limit = Math.min(parseInt(req.query.limit) || 7, 50);
        const minDate = req.query.minDate ? new Date(req.query.minDate) : null;

        const entries = [];
        const logDir = "src/backend/logs";
        try {
            const logFiles = readdirSync(logDir).filter(f => f.endsWith(".log"));
            for (const file of logFiles) {
                const content = readFileSync(path.join(logDir, file), "utf-8");
                const lines = content.split("\n").filter(Boolean);
                for (const line of lines) {
                    const match = line.match(/^\[([^\]]+)\] \[([A-Z]+)\] (.+)$/);
                    if (!match) continue;
                    const date = new Date(match[1]);
                    if (minDate && date < minDate) continue;
                    entries.push({
                        Id: entries.length,
                        Name: match[3].substring(0, 80),
                        Overview: match[3],
                        ShortOverview: match[3].substring(0, 40),
                        Type: match[2],
                        ItemId: null,
                        Date: date.toISOString(),
                        UserId: null,
                        Severity: match[2] === "ERROR" ? "Error" : match[2] === "WARN" ? "Warning" : "Information",
                    });
                }
            }
        } catch {}

        const total = entries.length;
        const sliced = entries.slice(startIndex, startIndex + limit);
        res.json({ Items: sliced, TotalRecordCount: total, StartIndex: startIndex });
    });

    app.get("/Library/VirtualFolders", (req, res) => {
        const typeMap = { movie: "movies", shows: "tvshows", music: "music", unsorted: "mixed" };
        const result = [];
        for (const [key, paths] of Object.entries(mediaDirs)) {
            const ct = typeMap[key] || null;
            for (const p of paths) {
                result.push({
                    Name: key.charAt(0).toUpperCase() + key.slice(1),
                    Locations: [p],
                    CollectionType: ct,
                    LibraryOptions: {
                        Enabled: true,
                        SaveLocalMetadata: false,
                        PreferredMetadataLanguage: "en",
                        MetadataCountryCode: "US",
                        AllowEmbeddedSubtitles: "AllowAll",
                        PathInfos: [{ Path: p }],
                    },
                    ItemId: crypto.randomUUID(),
                    PrimaryImageItemId: null,
                    RefreshProgress: 0,
                    RefreshStatus: "Idle",
                });
            }
        }
        const db = getDb();
        const ltConfig = (() => { try { return JSON.parse((getSystemInfo(db)?.config_json || "{}")).livetv; } catch { return null; } })();
        if (ltConfig?.TunerHosts?.length > 0) {
            result.push({
                Name: "Live TV",
                Locations: [],
                CollectionType: "livetv",
                LibraryOptions: { Enabled: true },
                ItemId: "livetv",
                PrimaryImageItemId: null,
                RefreshProgress: 0,
                RefreshStatus: "Idle",
            });
        }
        res.json(result);
    });

    app.get("/Users/:userId/Items/Resume", (req, res) => {
        res.json({ Items: [], TotalRecordCount: 0, StartIndex: 0 });
    });

    app.get("/Users/:userId/Items/Latest", (req, res) => {
        const sys = getSystemInfo(getDb());
        const serverId = sys?.id || "hmss-local";
        const index = globalThis.__mediaIndex || { shows: [], movies: [], music: [] };
        const result = filteredItemsFromIndex(index, serverId, {
            parentId: req.query.parentId || req.query.ParentId,
            includeItemTypes: req.query.includeItemTypes || req.query.IncludeItemTypes,
            limit: req.query.limit || req.query.Limit || 16,
            startIndex: req.query.startIndex || req.query.StartIndex,
        });
        res.json(result);
    });

    app.get("/Users/:userId/Items/:collectionType", async (req, res) => {
        const { collectionType } = req.params;
        // if it looks like an item ID (32-char hex or UUID), serve item detail
        if (collectionType.length >= 32 && /^[0-9a-f-]+$/.test(collectionType)) {
            req.params.itemId = collectionType;
            return serveItemDetail(req, res, getDb());
        }

        if (collectionType === "livetv") {
            const db = getDb();
            const ltConfig = (() => { try { return JSON.parse((getSystemInfo(db)?.config_json || "{}")).livetv; } catch { return null; } })();
            if (!ltConfig?.TunerHosts?.length) return res.status(404).json({ error: "Collection not found." });
            const sys = getSystemInfo(db);
            const serverId = sys?.id || "hmss-local";
            const itemId = "livetv";
            return res.json({
                Name: "Live TV",
                ServerId: serverId,
                Id: itemId,
                DateCreated: new Date().toISOString(),
                CanDelete: false,
                CanDownload: false,
                SortName: "livetv",
                ExternalUrls: [],
                Path: "",
                ChannelId: null,
                IsFolder: true,
                Type: "CollectionFolder",
                CollectionType: "livetv",
                ChildCount: 0,
                UserData: {
                    PlaybackPositionTicks: 0,
                    PlayCount: 0,
                    IsFavorite: false,
                    Played: false,
                    Key: itemId,
                    ItemId: itemId,
                },
                ImageTags: {},
                BackdropImageTags: [],
                ImageBlurHashes: {},
                LocationType: "FileSystem",
                MediaType: "Unknown",
            });
        }

        const sys = getSystemInfo(getDb());
        const serverId = sys?.id || "hmss-local";
        const index = globalThis.__mediaIndex || { shows: [], movies: [], music: [] };

        const typeMap = { movies: "movie", tvshows: "shows", shows: "shows", music: "music", mixed: "unsorted" };
        const sourceKey = typeMap[collectionType];
        if (!sourceKey || !mediaDirs[sourceKey]) return res.status(404).json({ error: "Collection not found." });
        const nameMap = { movies: "Movies", tvshows: "Shows", shows: "Shows", music: "Music", mixed: "Unsorted" };

        let childCount = 0;
        if (sourceKey === "movie") childCount = index.movies?.length || 0;
        else if (sourceKey === "shows") childCount = [...new Set(index.shows?.map(s => s.showName) || [])].length;
        else if (sourceKey === "music") childCount = index.music?.length || 0;

        const itemId = crypto.randomUUID();
        res.json({
            Name: nameMap[collectionType] || sourceKey,
            ServerId: serverId,
            Id: itemId.replace(/-/g, ""),
            DateCreated: new Date().toISOString(),
            CanDelete: false,
            CanDownload: false,
            SortName: (nameMap[collectionType] || sourceKey).toLowerCase(),
            ExternalUrls: [],
            Path: mediaDirs[sourceKey][0] || "",
            ChannelId: null,
            IsFolder: true,
            Type: "CollectionFolder",
            CollectionType: collectionType,
            ChildCount: childCount,
            UserData: {
                PlaybackPositionTicks: 0,
                PlayCount: 0,
                IsFavorite: false,
                Played: false,
                Key: itemId,
                ItemId: itemId.replace(/-/g, ""),
            },
            ImageTags: {},
            BackdropImageTags: [],
            ImageBlurHashes: {},
            LocationType: "FileSystem",
            MediaType: "Unknown",
        });
    });

    app.get("/Environment/Drives", (req, res) => {
        // const drives = [];
        // for (const paths of Object.values(mediaDirs)) {
        //     for (const p of paths) {
        //         drives.push({ Name: p, Path: p, Type: "File" });
        //     }
        // }
        // if (drives.length === 0) drives.push({ Name: "/", Path: "/", Type: "File" });
        res.json([{ Name: "Adding custom libraries is not yet supported", Path: "/", Type: "File" }]);
    });

    app.get("/Branding/Configuration", (req, res) => {
        res.json({ SplashscreenEnabled: false });
    });

    app.head("/System/Info/Public", (req, res) => {
        res.status(405).set("Allow", "GET").end();
    });

    app.get("/System/Info/Public", (req, res) => {
        const sys = getSystemInfo(getDb());
        const localIP = getLocalIPv4();
        res.json({
            LocalAddress: `http://${localIP}:${port}`,
            ServerName: sys ? sys.server_name : os.hostname(),
            Version: apiVersion,
            ProductName: "Jellyfin Server",
            OperatingSystem: "",
            Id: sys ? sys.id : "hmss-local",
            StartupWizardCompleted: sys ? Boolean(sys.startup_wizard_completed) : false,
        });
    });

    app.get("/Startup/User", (req, res) => {
        const db = getDb();
        const sys = getSystemInfo(db);
        if (sys && sys.startup_wizard_completed) {
            return res.status(204).end();
        }
        // wizard not complete — check if first user exists
        const userCount = db.prepare("SELECT COUNT(*) as count FROM users").get().count;
        if (userCount > 0) return res.status(204).end();
        // no users — let wizard create first user
        res.status(200).json({});
    });

    app.post("/Startup/User", async (req, res) => {
        const db = getDb();
        const sys = getSystemInfo(db);
        if (sys && sys.startup_wizard_completed) {
            return res.status(400).json({ error: "Setup already completed." });
        }

        const { Name, Password } = req.body || {};
        if (!Name || !Password) return res.status(400).json({ error: "Name and Password required." });

        const existingUser = db.prepare("SELECT id FROM users WHERE name = ?").get(Name);
        if (existingUser) return res.status(400).json({ error: "User already exists." });

        const argon2 = (await import("argon2")).default;
        const passwordHash = await argon2.hash(Password, { type: argon2.argon2id });
        const uuid = crypto.randomUUID();

        db.prepare("INSERT INTO users (name, password_hash, perms, uuid) VALUES (?, ?, ?, ?)")
            .run(Name, passwordHash, 3, uuid);

        console.log(`First user '${Name}' created via startup wizard.`);
        res.status(204).end();
    });

    app.get("/Startup/Configuration", (req, res) => {
        res.json({
            UICulture: "en-US",
            MetadataCountryCode: "US",
            PreferredMetadataLanguage: "en",
        });
    });

    app.post("/Startup/Configuration", (req, res) => {
        const db = getDb();
        const { ServerName } = req.body || {};
        if (ServerName) {
            db.prepare("UPDATE system SET server_name = ?").run(ServerName);
        }
        res.status(204).end();
    });

    app.post("/System/Restart", (req, res) => {
        if (!req.user || req.user.perms < 2) {
            return res.status(403).json({ error: "Admin permissions required." });
        }
        res.status(200).json({ message: "Terminating..." });
        console.log(`System restart initiated by ${req.user.name}`);
        killTelerisingProcess();
        setTimeout(() => process.exit(1), 500);
    });

    app.post("/System/Shutdown", (req, res) => {
        if (!req.user || req.user.perms < 2) {
            return res.status(403).json({ error: "Admin permissions required." });
        }
        res.status(200).json({ message: "Shutting down..." });
        console.log(`System shutdown initiated by ${req.user.name}`);
        killTelerisingProcess();
        setTimeout(() => process.exit(0), 500);
    });

    app.get("/System/Info", (req, res) => {
        if (!req.user) return res.status(401).json({ error: "Unauthorized." });
        const sys = getSystemInfo(getDb());
        res.json({
            LocalAddress: `http://${getLocalIPv4()}:${port}`,
            ServerName: sys ? sys.server_name : os.hostname(),
            Version: apiVersion,
            ProductName: sys ? sys.product_name : "Jellyfin Server",
            Id: sys ? sys.id : "hmss-local",
            StartupWizardCompleted: sys ? Boolean(sys.startup_wizard_completed) : false,
            OperatingSystem: "",
            HasPendingRestart: false,
            IsShuttingDown: false,
            SupportsLibraryMonitor: false,
            WebSocketPortNumber: 0,
            CompletedInstallations: [],
            CanSelfRestart: false,
            CanLaunchWebBrowser: false,
            ProgramDataPath: "",
            ItemsByNamePath: "",
            CachePath: "",
            LogPath: "",
            InternalMetadataPath: "",
            TranscodingTempPath: "",
            HttpServerPortNumber: port,
            EnableHTTPS: false,
            HasUpdateAvailable: false,
            SupportsAutoRunAtStartup: false,
            HardwareAccelerationRequiresPremiere: false,
            EnableFolderView: false,
        });
    });

    app.get("/Users/Me", (req, res) => {
        if (!req.user) return res.status(401).json({ error: "Unauthorized." });
        const db = getDb();
        const u = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id);
        if (!u) return res.status(404).json({ error: "User not found." });
        const p = u.perms;
        const isAdmin = p >= 2;
        const isRoot = p >= 3;
        res.json({
            Name: u.name,
            ServerId: "hmss-local",
            ServerName: "HMSS",
            Id: String(u.id),
            PrimaryImageTag: u.logo_path || null,
            EnableAutoLogin: false,
            LastLoginDate: new Date().toISOString(),
            LastActivityDate: new Date().toISOString(),
            HasPassword: true,
            HasConfiguredPassword: true,
            HasConfiguredEasyPassword: false,
            Configuration: {
                AudioLanguagePreference: "",
                PlayDefaultAudioTrack: true,
                SubtitleLanguagePreference: "",
                DisplayMissingEpisodes: false,
                GroupedFolders: [],
                SubtitleMode: "Default",
                DisplayCollectionsView: false,
                EnableLocalPassword: true,
                OrderedViews: [],
                LatestItemsExcludes: [],
                MyMediaExcludes: [],
                HidePlayedInLatest: true,
                RememberAudioSelections: true,
                RememberSubtitleSelections: true,
                EnableNextEpisodeAutoPlay: true,
                CastReceiverId: null,
            },
            Policy: {
                IsAdministrator: isAdmin,
                IsHidden: isRoot,
                EnableCollectionManagement: isAdmin,
                EnableSubtitleManagement: isAdmin,
                EnableLyricManagement: isAdmin,
                IsDisabled: false,
                MaxParentalRating: null,
                BlockedTags: [],
                EnableUserPreferenceAccess: true,
                AccessSchedules: [],
                BlockUnratedItems: [],
                EnableRemoteControlOfOtherUsers: p >= 2,
                EnableSharedDeviceControl: true,
                EnableRemoteAccess: p >= 1,
                EnableLiveTvManagement: isAdmin,
                EnableLiveTvAccess: p >= 1,
                EnableMediaPlayback: true,
                EnableAudioPlaybackTranscoding: true,
                EnableVideoPlaybackTranscoding: true,
                EnablePlaybackRemuxing: true,
                ForceRemoteSourceTranscoding: false,
                EnableContentDeletion: p >= 2,
                EnableContentDeletionFromFolders: [],
                EnableContentDownloading: true,
                EnableSyncTranscoding: true,
                EnableMediaConversion: isAdmin,
                EnabledDevices: [],
                EnableAllDevices: true,
                EnabledChannels: [],
                EnableAllChannels: true,
                EnabledFolders: [],
                EnableAllFolders: true,
                InvalidLoginAttemptCount: 0,
                LoginAttemptsBeforeLockout: 0,
                MaxActiveSessions: 0,
                EnablePublicSharing: true,
                BlockedMediaFolders: [],
                BlockedChannels: [],
                RemoteClientBitrateLimit: 0,
                AuthenticationProviderId: "Emby.Server.Implementations.Library.DefaultAuthenticationProvider",
                PasswordResetProviderId: "Emby.Server.Implementations.Library.DefaultPasswordResetProvider",
                SyncPlayAccess: "CreateAndJoinGroups",
            },
            PrimaryImageAspectRatio: 0,
        });
    });

    app.get("/UserViews", (req, res) => {
        if (!req.user) return res.status(401).json({ error: "Unauthorized." });
        const items = [
            { Name: "Movies", CollectionType: "movies", Id: "movies", IsFolder: true, Type: "CollectionFolder" },
            { Name: "Shows", CollectionType: "tvshows", Id: "shows", IsFolder: true, Type: "CollectionFolder" },
            { Name: "Music", CollectionType: "music", Id: "music", IsFolder: true, Type: "CollectionFolder" },
        ];
        const db = getDb();
        const ltConfig = (() => { try { return JSON.parse((getSystemInfo(db)?.config_json || "{}")).livetv; } catch { return null; } })();
        if (ltConfig?.TunerHosts?.length > 0) {
            items.push({ Name: "Live TV", CollectionType: "livetv", Id: "livetv", IsFolder: true, Type: "CollectionFolder" });
        }
        res.json({ Items: items, TotalRecordCount: items.length });
    });

    app.get("/DisplayPreferences/:id", (req, res) => {
        res.json({
            Id: req.params.id,
            ViewType: "Poster",
            SortBy: "SortName",
            SortOrder: "Ascending",
            CustomPrefs: {},
        });
    });

    app.get("/Items/Counts", (req, res) => {
        if (!req.user) return res.status(401).end();
        const index = globalThis.__mediaIndex || { shows: [], movies: [], music: [] };
        res.json({
            MovieCount: index.movies?.length || 0,
            SeriesCount: [...new Set(index.shows?.map(s => s.showName) || [])].length,
            EpisodeCount: index.shows?.length || 0,
            SongCount: index.music?.length || 0,
            ArtistCount: [...new Set(index.music?.map(m => m.artist) || [])].length,
            AlbumCount: [...new Set(index.music?.map(m => m.album) || [])].length,
            ProgramCount: 0,
            TrailerCount: 0,
            MusicVideoCount: 0,
            BoxSetCount: 0,
            BookCount: 0,
            ItemCount: (index.shows?.length || 0) + (index.movies?.length || 0) + (index.music?.length || 0),
        });
    });

    app.get("/Sessions", (req, res) => {
        if (!req.user) return res.status(401).end();
        const db = getDb();
        const sessions = db.prepare(`
            SELECT sessions.token, sessions.created_at, users.id, users.uuid, users.name
            FROM sessions JOIN users ON users.id = sessions.user_id
            ORDER BY sessions.created_at DESC
        `).all();

        const sys = getSystemInfo(db);
        const serverId = sys?.id || "hmss-local";

        res.json(sessions.map(s => ({
            Id: s.token,
            UserId: s.uuid || String(s.id),
            UserName: s.name,
            Client: "HMSS",
            DeviceName: "Web Browser",
            DeviceId: "web",
            ApplicationVersion: apiVersion,
            LastActivityDate: new Date().toISOString(),
            LastPlaybackCheckIn: "0001-01-01T00:00:00.0000000Z",
            IsActive: true,
            SupportsMediaControl: false,
            SupportsRemoteControl: false,
            NowPlayingQueue: [],
            NowPlayingQueueFullItems: [],
            HasCustomDeviceName: false,
            PlayableMediaTypes: ["Audio", "Video"],
            ServerId: serverId,
            PlayState: { CanSeek: false, IsPaused: false, IsMuted: false, RepeatMode: "RepeatNone", PlaybackOrder: "Default" },
            AdditionalUsers: [],
            Capabilities: { PlayableMediaTypes: ["Audio", "Video"], SupportedCommands: [], SupportsMediaControl: true, SupportsPersistentIdentifier: false },
            SupportedCommands: [],
        })));
    });

    app.get("/Items/Suggestions", (req, res) => {
        const sys = getSystemInfo(getDb());
        const serverId = sys?.id || "hmss-local";
        const index = globalThis.__mediaIndex || { shows: [], movies: [], music: [] };
        const limit = parseInt(req.query.limit) || 6;
        const result = suggestionsFromIndex(index, req.query.userId, serverId, limit);
        res.json(result);
    });

    app.get("/Items", async (req, res) => {
        const parentId = req.query.parentId || req.query.ParentId;
        if (parentId === "livetv") {
            const db = getDb();
            const allChannels = await getLiveTvChannels(db);
            const limit = parseInt(req.query.Limit) || allChannels.length;
            const start = parseInt(req.query.StartIndex) || 0;
            return res.json({
                Items: allChannels.slice(start, start + limit),
                TotalRecordCount: allChannels.length,
                StartIndex: start,
            });
        }
        const sys = getSystemInfo(getDb());
        const serverId = sys?.id || "hmss-local";
        const index = globalThis.__mediaIndex || { shows: [], movies: [], music: [] };
        const result = filteredItemsFromIndex(index, serverId, {
            parentId,
            includeItemTypes: req.query.includeItemTypes || req.query.IncludeItemTypes,
            limit: req.query.limit || req.query.Limit,
            startIndex: req.query.startIndex || req.query.StartIndex,
        });
        res.json(result);
    });

    app.get("/Users/:userId/Items", async (req, res) => {
        const parentId = req.query.parentId || req.query.ParentId;
        if (parentId === "livetv") {
            const db = getDb();
            const allChannels = await getLiveTvChannels(db);
            const limit = parseInt(req.query.Limit) || allChannels.length;
            const start = parseInt(req.query.StartIndex) || 0;
            return res.json({
                Items: allChannels.slice(start, start + limit),
                TotalRecordCount: allChannels.length,
                StartIndex: start,
            });
        }
        const sys = getSystemInfo(getDb());
        const serverId = sys?.id || "hmss-local";
        const index = globalThis.__mediaIndex || { shows: [], movies: [], music: [] };
        const result = filteredItemsFromIndex(index, serverId, {
            parentId,
            includeItemTypes: req.query.includeItemTypes || req.query.IncludeItemTypes,
            limit: req.query.limit || req.query.Limit,
            startIndex: req.query.startIndex || req.query.StartIndex,
        });
        res.json(result);
    });

    app.get("/Items/:itemId", async (req, res) => {
        return serveItemDetail(req, res, getDb());
    });

    app.get("/Users/:userId/Items/:itemId", async (req, res) => {
        return serveItemDetail(req, res, getDb());
    });

    async function serveItemDetail(req, res, db) {
        const sys = getSystemInfo(db);
        const serverId = sys?.id || "hmss-local";
        const index = globalThis.__mediaIndex || { shows: [], movies: [], music: [] };
        const rawId = req.params.itemId.replace(/-/g, "");
        let found = null;
        let itemPath = null;
        let itemType = null;
        for (const ep of index.shows || []) {
            if (generateItemId(ep.id || ep.filePath) === rawId) { found = ep; itemPath = ep.filePath; itemType = "Episode"; break; }
            if (generateItemId(ep.showName) === rawId) { found = ep; itemType = "Series"; break; }
        }
        if (!found) for (const m of index.movies || []) {
            if (generateItemId(m.id || m.filePath) === rawId) { found = m; itemPath = m.filePath; itemType = "Movie"; break; }
        }
        if (!found) for (const m of index.music || []) {
            if (generateItemId(m.id || m.filePath) === rawId) { found = m; itemPath = m.filePath; itemType = "Audio"; break; }
        }
        if (!found) for (const u of index.unsorted || []) {
            if (generateItemId(u.id || u.filePath) === rawId) { found = u; itemPath = u.filePath; itemType = "Video"; break; }
        }
        // check if it's a LiveTV channel
        if (!found) {
            const tvChannel = findLiveTvChannel(rawId);
            if (tvChannel) {
                return res.json({
                    Name: tvChannel.Name,
                    ServerId: tvChannel.ServerId,
                    Id: tvChannel.Id,
                    SortName: tvChannel.SortName,
                    Number: tvChannel.Number,
                    ChannelNumber: tvChannel.ChannelNumber,
                    ChannelType: "TV",
                    IsFolder: false,
                    Type: "TvChannel",
                    LocationType: "Remote",
                    MediaType: "Video",
                    DateCreated: new Date().toISOString(),
                    CanDelete: false,
                    CanDownload: false,
                    ExternalUrls: [],
                    MediaSources: tvChannel.MediaSources,
                    ImageTags: tvChannel.ImageTags,
                    Overview: "",
                    ParentId: "",
                    GenreItems: [],
                    Genres: tvChannel.Genres,
                    Tags: [],
                    UserData: tvChannel.UserData,
                    ImageBlurHashes: {},
                    BackdropImageTags: [],
                });
            }
        }
        // check if it's a season folder
        if (!found && index.shows?.length > 0) {
            for (const ep of index.shows) {
                const seasonId = generateItemId(`${ep.showName}-s${ep.season}`);
                if (seasonId === rawId) {
                    found = ep;
                    itemType = "Season";
                    break;
                }
            }
        }
        if (!found) return res.status(404).json({ error: "Item not found." });

        let probe = null;
        if (itemPath && (itemPath.endsWith(".mp4") || itemPath.endsWith(".mkv") || itemPath.endsWith(".m4a") || itemPath.endsWith(".mp3"))) {
            try { probe = await probeMedia(itemPath); } catch {}
        }

        const id = generateItemId(found.id || found.filePath);
        if (itemType === "Season") {
            const seasonId = generateItemId(`${found.showName}-s${found.season}`);
            const seasonPoster = findPosterPath(found.filePath);
            return res.json({
                Name: found.season === 0 ? "Specials" : `Season ${found.season}`,
                ServerId: serverId,
                Id: seasonId,
                SortName: `Season ${String(found.season).padStart(2, "0")}`,
                IndexNumber: found.season,
                SeriesName: found.showName,
                SeriesId: generateItemId(found.showName),
                IsFolder: true,
                Type: "Season",
                UserData: { PlaybackPositionTicks: 0, PlayCount: 0, IsFavorite: false, Played: false, Key: seasonId.replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, "$1-$2-$3-$4-$5"), ItemId: seasonId },
                ImageTags: seasonPoster ? { Primary: seasonPoster.tag } : {},
                BackdropImageTags: [],
                ImageBlurHashes: seasonPoster ? { Primary: {} } : {},
                LocationType: "FileSystem",
            });
        }
        const parentId = itemType === "Movie" ? generateItemId("movies") : itemType === "Episode" ? generateItemId(found.showName) : itemType === "Video" ? generateItemId("unsorted") : generateItemId("music");
        const isMovie = itemType === "Movie";
        const isEpisode = itemType === "Episode";

        const isVideoItem = isMovie || isEpisode || itemType === "Video";
        const mediaSource = probe ? {
            Protocol: "File",
            Id: id,
            Path: itemPath,
            Type: "Default",
            Container: probe.container,
            Size: probe.size,
            Name: found.title || "Unknown",
            SortName: (found.title || "unknown").toLowerCase(),
            IsRemote: false,
            RunTimeTicks: Math.round(probe.duration * 10000000),
            SupportsTranscoding: true,
            SupportsDirectStream: true,
            SupportsDirectPlay: true,
            DirectPlayUrl: `/Videos/${id}/stream?static=true&api_key=`,
            DirectStreamUrl: `/Videos/${id}/stream`,
            VideoType: isVideoItem ? "VideoFile" : undefined,
            MediaStreams: probe.streams,
            Bitrate: probe.bitrate,
            DefaultAudioStreamIndex: probe.streams.findIndex(s => s.Type === "Audio") >= 0 ? probe.streams.findIndex(s => s.Type === "Audio") : null,
            HasSegments: false,
            ETag: id,
            PlaySessionId: crypto.randomUUID(),
        } : null;

        const poster = findPosterPath(itemPath);
        const meta = getItemMeta(itemPath);

        res.json({
            Name: meta?.name || found.title || "Unknown",
            Overview: meta?.overview || undefined,
            Genres: meta?.genres || [],
            ProductionYear: meta?.year || found.year || undefined,
            ServerId: serverId,
            Id: id,
            SortName: (found.title || "").toLowerCase(),
            Path: itemPath || "",
            ChannelId: null,
            IsFolder: itemType === "Series",
            Type: itemType || "Unknown",
            ParentId: parentId,
            Container: probe?.container,
            RunTimeTicks: probe ? Math.round(probe.duration * 10000000) : 0,
            Width: probe?.width || 0,
            Height: probe?.height || 0,
            IsHD: (probe?.height || 0) >= 720,
            MediaSources: mediaSource ? [mediaSource] : [],
            MediaStreams: probe?.streams || [],
            UserData: {
                PlaybackPositionTicks: 0,
                PlayCount: 0,
                IsFavorite: false,
                Played: false,
                Key: id.replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, "$1-$2-$3-$4-$5"),
                ItemId: id,
            },
            ImageTags: poster ? { Primary: poster.tag } : {},
            BackdropImageTags: [],
            ImageBlurHashes: poster ? { Primary: {} } : {},
            LocationType: "FileSystem",
            MediaType: (isMovie || isEpisode || itemType === "Video") ? "Video" : "Audio",
            VideoType: (isMovie || isEpisode || itemType === "Video") ? "VideoFile" : undefined,
            PrimaryImageAspectRatio: probe?.width && probe?.height ? probe.width / probe.height : 0,
        });
    }

}

export async function addonRoutes(app) {
    app.get("/api/addons", (req, res) => {
        res.json(getAddons().map(a => ({
            id: a.id,
            name: a.name,
            version: a.version,
            description: a.description,
            capabilities: a.capabilities,
            dependency: a.dependency,
            configSchema: a.configSchema,
            configured: Object.values(a.config).some(v => v),
        })));
    });

    app.get("/api/addons/search", async (req, res) => {
        const { query, type, year } = req.query;
        if (!query) return res.status(400).json({ error: "query required" });
        const results = await searchAll({ query, year, type });
        res.json(results);
    });
}

export async function jellyfinRoutes(app, getDb, apiVersion) {

    // === Artist ===
    app.get('/Artists', (req, res) => { /* GetArtists */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/Artists/AlbumArtists', (req, res) => { /* GetAlbumArtists */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/Artists/:name', (req, res) => { /* GetArtistByName */ res.status(200).json({ message: 'Not implemented' }); });

    // === Audio ===
    const MIME_TYPES = {
        mp3: "audio/mpeg", m4a: "audio/mp4", flac: "audio/flac",
        ogg: "audio/ogg", wav: "audio/wav", aac: "audio/aac",
        mkv: "video/x-matroska", mp4: "video/mp4", avi: "video/x-msvideo",
        mov: "video/quicktime", ts: "video/mp2t", webm: "video/webm",
        mpegts: "video/mp2t",
    };

    function findFileByItemId(itemId) {
        const index = globalThis.__mediaIndex || { shows: [], movies: [], music: [], unsorted: [] };
        const rawId = (itemId || "").replace(/-/g, "");
        for (const ep of index.shows || []) {
            if (generateItemId(ep.id || ep.filePath) === rawId) return ep.filePath;
        }
        for (const m of index.movies || []) {
            if (generateItemId(m.id || m.filePath) === rawId) return m.filePath;
        }
        for (const m of index.music || []) {
            if (generateItemId(m.id || m.filePath) === rawId) return m.filePath;
        }
        for (const u of index.unsorted || []) {
            if (generateItemId(u.id || u.filePath) === rawId) return u.filePath;
        }
        return null;
    }

    function streamFile(req, res, itemId) {
        const rawId = (itemId || "").replace(/-/g, "");
        const tvChannel = findLiveTvChannel(rawId);
        if (tvChannel) {
            const streamUrl = tvChannel.MediaSources[0]?.Path;
            if (!streamUrl) return res.status(404).json({ error: "No stream URL." });
            const proto = streamUrl.startsWith("https") ? https : http;
            return proto.get(streamUrl, { timeout: 15000 }, (upstream) => {
                if (upstream.statusCode >= 300 && upstream.statusCode < 400 && upstream.headers.location) {
                    const redir = upstream.headers.location;
                    const rp = redir.startsWith("https") ? https : http;
                    return rp.get(redir, { timeout: 15000 }, (r2) => {
                        res.writeHead(r2.statusCode, { "Content-Type": r2.headers["content-type"] || "application/x-mpegURL" });
                        r2.pipe(res);
                    }).on("error", () => res.status(502).end());
                }
                res.writeHead(upstream.statusCode, { "Content-Type": upstream.headers["content-type"] || "application/x-mpegURL" });
                upstream.pipe(res);
            }).on("error", () => res.status(502).end());
        }

        const filePath = findFileByItemId(itemId);
        if (!filePath) return res.status(404).json({ error: "Item not found." });

        let stat;
        try { stat = statSync(filePath); } catch { return res.status(404).json({ error: "File not found." }); }

        const ext = filePath.split(".").pop().toLowerCase();
        const contentType = MIME_TYPES[ext] || "application/octet-stream";
        const totalSize = stat.size;

        if (req.method === "HEAD") {
            res.writeHead(200, { "Content-Length": totalSize, "Content-Type": contentType, "Accept-Ranges": "bytes" });
            return res.end();
        }

        const range = req.headers.range;
        if (range) {
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : Math.min(start + 10000000 - 1, totalSize - 1);
            const chunkSize = end - start + 1;

            res.writeHead(206, {
                "Content-Range": `bytes ${start}-${end}/${totalSize}`,
                "Accept-Ranges": "bytes",
                "Content-Length": chunkSize,
                "Content-Type": contentType,
            });
            createReadStream(filePath, { start, end }).pipe(res);
        } else {
            res.writeHead(200, {
                "Content-Length": totalSize,
                "Content-Type": contentType,
                "Accept-Ranges": "bytes",
            });
            createReadStream(filePath).pipe(res);
        }
    }

    app.get('/Audio/:itemId/stream.:container', (req, res) => streamFile(req, res, req.params.itemId));
    app.head('/Audio/:itemId/stream.:container', (req, res) => streamFile(req, res, req.params.itemId));
    app.get('/Audio/:itemId/stream', (req, res) => streamFile(req, res, req.params.itemId));
    app.head('/Audio/:itemId/stream', (req, res) => streamFile(req, res, req.params.itemId));
    app.get('/Audio/:itemId/universal', (req, res) => streamFile(req, res, req.params.itemId));
    app.head('/Audio/:itemId/universal', (req, res) => streamFile(req, res, req.params.itemId));

    // === Authentication ===
    app.get('/Auth/Keys', (req, res) => { /* GetKeys */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/Auth/Keys', (req, res) => { /* CreateKey */ res.status(200).json({ message: 'Not implemented' }); });
    app.delete('/Auth/Keys/:key', (req, res) => { /* RevokeKey */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/Auth/PasswordResetProviders', (req, res) => { /* GetPasswordResetProviders */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/Auth/Providers', (req, res) => { /* GetAuthProviders */ res.status(200).json({ message: 'Not implemented' }); });

    // === Backup ===
    app.get('/Backup', (req, res) => { /* ListBackups */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/Backup/Create', (req, res) => { /* CreateBackup */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/Backup/Manifest', (req, res) => { /* GetBackup */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/Backup/Restore', (req, res) => { /* StartRestoreBackup */ res.status(200).json({ message: 'Not implemented' }); });

    // === Branding ===
    app.get('/Branding/Css.css', (req, res) => { /* GetBrandingCss_2 */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/Branding/Css', (req, res) => { /* GetBrandingCss */ res.status(200).json({ message: 'Not implemented' }); });

    // === Channel ===
    app.get('/Channels', (req, res) => { /* GetChannels */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/Channels/Features', (req, res) => { /* GetAllChannelFeatures */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/Channels/Items/Latest', (req, res) => { /* GetLatestChannelItems */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/Channels/:channelId/Features', (req, res) => { /* GetChannelFeatures */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/Channels/:channelId/Items', (req, res) => { /* GetChannelItems */ res.status(200).json({ message: 'Not implemented' }); });

    // === Collection ===
    app.post('/Collections', (req, res) => { /* CreateCollection */ res.status(200).json({ message: 'Not implemented' }); });
    app.delete('/Collections/:collectionId/Items', (req, res) => { /* RemoveFromCollection */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/Collections/:collectionId/Items', (req, res) => { /* AddToCollection */ res.status(200).json({ message: 'Not implemented' }); });

    // === Device ===
    app.get('/Devices', (req, res) => {
        if (!req.user) return res.status(401).end();
        const db = getDb();
        const sessions = db.prepare(`
            SELECT sessions.token, sessions.created_at, users.id as user_id, users.uuid, users.name as user_name
            FROM sessions JOIN users ON users.id = sessions.user_id
        `).all();

        const devices = sessions.map(s => ({
            Name: "Web Browser",
            CustomName: null,
            AccessToken: s.token,
            Id: s.token,
            LastUserName: s.user_name,
            AppName: "HMSS",
            AppVersion: apiVersion,
            LastUserId: s.uuid || String(s.user_id),
            DateLastActivity: s.created_at,
            Capabilities: { PlayableMediaTypes: ["Audio", "Video"], SupportedCommands: [], SupportsMediaControl: true, SupportsPersistentIdentifier: false },
            IconUrl: null,
        }));

        res.json({ Items: devices, TotalRecordCount: devices.length, StartIndex: 0 });
    });

    app.delete('/Devices', (req, res) => {
        if (!req.user) return res.status(401).end();
        const id = req.query.Id;
        if (id) {
            const db = getDb();
            db.prepare("DELETE FROM sessions WHERE token = ?").run(id);
        }
        res.status(204).end();
    });

    app.get('/Devices/Info', (req, res) => {
        if (!req.user) return res.status(401).end();
        res.json({
            Name: req.headers["x-emby-devicename"] || "Web Browser",
            Id: req.headers["x-emby-deviceid"] || "web",
        });
    });

    app.get('/Devices/Options', (req, res) => {
        if (!req.user) return res.status(401).end();
        res.json({ Items: [], TotalRecordCount: 0, StartIndex: 0 });
    });

    app.post('/Devices/Options', (req, res) => {
        if (!req.user) return res.status(401).end();
        res.status(204).end();
    });

    // === DisplayPreference ===
    app.get('/DisplayPreferences/:displayPreferencesId', (req, res) => { /* GetDisplayPreferences */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/DisplayPreferences/:displayPreferencesId', (req, res) => { /* UpdateDisplayPreferences */ res.status(200).json({ message: 'Not implemented' }); });

    // === Environment ===
    app.get('/Environment/DefaultDirectoryBrowser', (req, res) => { /* GetDefaultDirectoryBrowser */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/Environment/DirectoryContents', (req, res) => { /* GetDirectoryContents */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/Environment/ParentPath', (req, res) => { /* GetParentPath */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/Environment/ValidatePath', (req, res) => { /* ValidatePath */ res.status(200).json({ message: 'Not implemented' }); });

    // === Filter ===

    // === Genre ===
    app.get('/Genres', (req, res) => { /* GetGenres */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/Genres/:genreName', (req, res) => { /* GetGenre */ res.status(200).json({ message: 'Not implemented' }); });

    // === Image ===
    app.get('/Artists/:name/Images/:imageType/:imageIndex', (req, res) => { /* GetArtistImage */ res.status(200).json({ message: 'Not implemented' }); });
    app.head('/Artists/:name/Images/:imageType/:imageIndex', (req, res) => { /* HeadArtistImage */ res.status(200).json({ message: 'Not implemented' }); });
    app.delete('/Branding/Splashscreen', (req, res) => { /* DeleteCustomSplashscreen */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/Branding/Splashscreen', (req, res) => { /* GetSplashscreen */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/Branding/Splashscreen', (req, res) => { /* UploadCustomSplashscreen */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/Genres/:name/Images/:imageType', (req, res) => { /* GetGenreImage */ res.status(200).json({ message: 'Not implemented' }); });
    app.head('/Genres/:name/Images/:imageType', (req, res) => { /* HeadGenreImage */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/Genres/:name/Images/:imageType/:imageIndex', (req, res) => { /* GetGenreImageByIndex */ res.status(200).json({ message: 'Not implemented' }); });
    app.head('/Genres/:name/Images/:imageType/:imageIndex', (req, res) => { /* HeadGenreImageByIndex */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/Items/:itemId/Images', (req, res) => { /* GetItemImageInfos */ res.status(200).json({ message: 'Not implemented' }); });
    app.delete('/Items/:itemId/Images/:imageType', (req, res) => { /* DeleteItemImage */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/Items/:itemId/Images/:imageType', (req, res) => { /* GetItemImage */ res.status(200).json({ message: 'Not implemented' }); });
    app.head('/Items/:itemId/Images/:imageType', (req, res) => { /* HeadItemImage */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/Items/:itemId/Images/:imageType', (req, res) => { /* SetItemImage */ res.status(200).json({ message: 'Not implemented' }); });
    app.delete('/Items/:itemId/Images/:imageType/:imageIndex', (req, res) => { /* DeleteItemImageByIndex */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/Items/:itemId/Images/:imageType/:imageIndex', (req, res) => { /* GetItemImageByIndex */ res.status(200).json({ message: 'Not implemented' }); });
    app.head('/Items/:itemId/Images/:imageType/:imageIndex', (req, res) => { /* HeadItemImageByIndex */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/Items/:itemId/Images/:imageType/:imageIndex', (req, res) => { /* SetItemImageByIndex */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/Items/:itemId/Images/:imageType/:imageIndex/Index', (req, res) => { /* UpdateItemImageIndex */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/Items/:itemId/Images/:imageType/:imageIndex/:tag/:format/:maxWidth/:maxHeight/:percentPlayed/:unplayedCount', (req, res) => { /* GetItemImage2 */ res.status(200).json({ message: 'Not implemented' }); });
    app.head('/Items/:itemId/Images/:imageType/:imageIndex/:tag/:format/:maxWidth/:maxHeight/:percentPlayed/:unplayedCount', (req, res) => { /* HeadItemImage2 */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/MusicGenres/:name/Images/:imageType', (req, res) => { /* GetMusicGenreImage */ res.status(200).json({ message: 'Not implemented' }); });
    app.head('/MusicGenres/:name/Images/:imageType', (req, res) => { /* HeadMusicGenreImage */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/MusicGenres/:name/Images/:imageType/:imageIndex', (req, res) => { /* GetMusicGenreImageByIndex */ res.status(200).json({ message: 'Not implemented' }); });
    app.head('/MusicGenres/:name/Images/:imageType/:imageIndex', (req, res) => { /* HeadMusicGenreImageByIndex */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/Persons/:name/Images/:imageType', (req, res) => { /* GetPersonImage */ res.status(200).json({ message: 'Not implemented' }); });
    app.head('/Persons/:name/Images/:imageType', (req, res) => { /* HeadPersonImage */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/Persons/:name/Images/:imageType/:imageIndex', (req, res) => { /* GetPersonImageByIndex */ res.status(200).json({ message: 'Not implemented' }); });
    app.head('/Persons/:name/Images/:imageType/:imageIndex', (req, res) => { /* HeadPersonImageByIndex */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/Studios/:name/Images/:imageType', (req, res) => { /* GetStudioImage */ res.status(200).json({ message: 'Not implemented' }); });
    app.head('/Studios/:name/Images/:imageType', (req, res) => { /* HeadStudioImage */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/Studios/:name/Images/:imageType/:imageIndex', (req, res) => { /* GetStudioImageByIndex */ res.status(200).json({ message: 'Not implemented' }); });
    app.head('/Studios/:name/Images/:imageType/:imageIndex', (req, res) => { /* HeadStudioImageByIndex */ res.status(200).json({ message: 'Not implemented' }); });

    // === InstantMix ===
    app.get('/Albums/:itemId/InstantMix', (req, res) => { /* GetInstantMixFromAlbum */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/Artists/:itemId/InstantMix', (req, res) => { /* GetInstantMixFromArtists */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/Items/:itemId/InstantMix', (req, res) => { /* GetInstantMixFromItem */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/MusicGenres/InstantMix', (req, res) => { /* GetInstantMixFromMusicGenreById */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/MusicGenres/:name/InstantMix', (req, res) => { /* GetInstantMixFromMusicGenreByName */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/Playlists/:itemId/InstantMix', (req, res) => { /* GetInstantMixFromPlaylist */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/Songs/:itemId/InstantMix', (req, res) => { /* GetInstantMixFromSong */ res.status(200).json({ message: 'Not implemented' }); });

    // === ItemLookup ===
    app.post('/Items/RemoteSearch/Apply/:itemId', (req, res) => { /* ApplySearchCriteria */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/Items/RemoteSearch/Book', (req, res) => { /* GetBookRemoteSearchResults */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/Items/RemoteSearch/BoxSet', (req, res) => { /* GetBoxSetRemoteSearchResults */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/Items/RemoteSearch/Movie', (req, res) => { /* GetMovieRemoteSearchResults */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/Items/RemoteSearch/MusicAlbum', (req, res) => { /* GetMusicAlbumRemoteSearchResults */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/Items/RemoteSearch/MusicArtist', (req, res) => { /* GetMusicArtistRemoteSearchResults */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/Items/RemoteSearch/MusicVideo', (req, res) => { /* GetMusicVideoRemoteSearchResults */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/Items/RemoteSearch/Person', (req, res) => { /* GetPersonRemoteSearchResults */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/Items/RemoteSearch/Series', (req, res) => { /* GetSeriesRemoteSearchResults */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/Items/RemoteSearch/Trailer', (req, res) => { /* GetTrailerRemoteSearchResults */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/Items/:itemId/ExternalIdInfos', (req, res) => { /* GetExternalIdInfos */ res.status(200).json({ message: 'Not implemented' }); });

    // === ItemUpdate ===
    app.post('/Items/:itemId', (req, res) => { /* UpdateItem */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/Items/:itemId/ContentType', (req, res) => { /* UpdateItemContentType */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/Items/:itemId/MetadataEditor', (req, res) => { /* GetMetadataEditorInfo */ res.status(200).json({ message: 'Not implemented' }); });

    // === Library ===
    app.get('/Albums/:itemId/Similar', (req, res) => { res.json({ Items: [], TotalRecordCount: 0, StartIndex: 0 }); });
    app.get('/Artists/:itemId/Similar', (req, res) => { res.json({ Items: [], TotalRecordCount: 0, StartIndex: 0 }); });
    app.delete('/Items', (req, res) => { /* DeleteItems */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/Items/Latest', (req, res) => { /* GetLatestMedia */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/Items/Root', (req, res) => { /* GetRootFolder */ res.status(200).json({ message: 'Not implemented' }); });
    app.delete('/Items/:itemId', (req, res) => { /* DeleteItem */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/Items/:itemId/Ancestors', (req, res) => { /* GetAncestors */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/Items/:itemId/Collections', (req, res) => { /* GetItemCollections */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/Items/:itemId/Download', (req, res) => { /* GetDownload */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/Items/:itemId/File', (req, res) => { /* GetFile */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/Users/:itemId/Items/:itemId/Intros', (req, res) => { /* GetIntros */ res.status(200).json({"Items":[],"TotalRecordCount":0,"StartIndex":0}); });
    app.get('/Items/:itemId/LocalTrailers', (req, res) => { /* GetLocalTrailers */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/Items/:itemId/Refresh', (req, res) => { /* RefreshItem */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/Items/:itemId/Similar', (req, res) => {
        const sys = getSystemInfo(getDb());
        const serverId = sys?.id || "hmss-local";
        const index = globalThis.__mediaIndex || { shows: [], movies: [], music: [] };
        const rawId = (req.params.itemId || "").replace(/-/g, "");
        const limit = parseInt(req.query.limit) || 12;

        let itemType = null;
        for (const ep of index.shows || []) {
            if (generateItemId(ep.id || ep.filePath) === rawId) { itemType = "Episode"; break; }
            if (generateItemId(ep.showName) === rawId) { itemType = "Series"; break; }
        }
        if (!itemType) for (const m of index.movies || []) {
            if (generateItemId(m.id || m.filePath) === rawId) { itemType = "Movie"; break; }
        }
        if (!itemType) for (const m of index.music || []) {
            if (generateItemId(m.id || m.filePath) === rawId) { itemType = "Audio"; break; }
        }
        if (!itemType) for (const u of index.unsorted || []) {
            if (generateItemId(u.id || u.filePath) === rawId) { itemType = "Video"; break; }
        }

        const candidates = [];
        if (itemType === "Episode" || itemType === "Series") {
            for (const ep of index.shows || []) {
                const id = generateItemId(ep.id || ep.filePath);
                if (id !== rawId) candidates.push(ep);
            }
        } else if (itemType === "Movie") {
            for (const m of index.movies || []) {
                const id = generateItemId(m.id || m.filePath);
                if (id !== rawId) candidates.push(m);
            }
        } else if (itemType === "Audio") {
            for (const m of index.music || []) {
                const id = generateItemId(m.id || m.filePath);
                if (id !== rawId) candidates.push(m);
            }
        } else if (itemType === "Video") {
            for (const u of index.unsorted || []) {
                const id = generateItemId(u.id || u.filePath);
                if (id !== rawId) candidates.push(u);
            }
        }

        const shuffled = candidates.sort(() => Math.random() - 0.5).slice(0, limit);
        const items = shuffled.map(item => {
            const id = generateItemId(item.id || item.filePath);
            const poster = findPosterPath(item.filePath);
            return {
                Name: item.title || "Unknown",
                ServerId: serverId,
                Id: id,
                SortName: (item.title || "").toLowerCase(),
                Path: item.filePath || "",
                Type: itemType === "Audio" ? "Audio" : "Video",
                UserData: { PlaybackPositionTicks: 0, PlayCount: 0, IsFavorite: false, Played: false, Key: id.replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, "$1-$2-$3-$4-$5"), ItemId: id },
                ImageTags: poster ? { Primary: poster.tag } : {},
                BackdropImageTags: [],
            };
        });

        res.json({ Items: items, TotalRecordCount: items.length, StartIndex: 0 });
    });
    app.get('/Items/:itemId/SpecialFeatures', (req, res) => { /* GetSpecialFeatures */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/Items/:itemId/ThemeMedia', (req, res) => { /* GetThemeMedia */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/Items/:itemId/ThemeSongs', (req, res) => { /* GetThemeSongs */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/Items/:itemId/ThemeVideos', (req, res) => { /* GetThemeVideos */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/Libraries/AvailableOptions', (req, res) => { /* GetLibraryOptionsInfo */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/Library/Media/Updated', (req, res) => { /* PostUpdatedMedia */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/Library/MediaFolders', (req, res) => { /* GetMediaFolders */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/Library/Movies/Added', (req, res) => { /* PostAddedMovies */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/Library/Movies/Updated', (req, res) => { /* PostUpdatedMovies */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/Library/PhysicalPaths', (req, res) => { /* GetPhysicalPaths */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/Library/Refresh', (req, res) => { /* RefreshLibrary */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/Library/Series/Added', (req, res) => { /* PostAddedSeries */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/Library/Series/Updated', (req, res) => { /* PostUpdatedSeries */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/Movies/:itemId/Similar', (req, res) => { res.json({ Items: [], TotalRecordCount: 0, StartIndex: 0 }); });
    app.get('/Shows/:itemId/Similar', (req, res) => { res.json({ Items: [], TotalRecordCount: 0, StartIndex: 0 }); });
    app.get('/Trailers/:itemId/Similar', (req, res) => { res.json({ Items: [], TotalRecordCount: 0, StartIndex: 0 }); });
    app.get('/UserItems/Resume', (req, res) => { /* GetResumeItems */ res.status(200).json({ message: 'Not implemented' }); });

    // === LibraryStructure ===
    app.delete('/Library/VirtualFolders', (req, res) => { /* RemoveVirtualFolder */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/Library/VirtualFolders', (req, res) => { /* AddVirtualFolder */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/Library/VirtualFolders/LibraryOptions', (req, res) => { /* UpdateLibraryOptions */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/Library/VirtualFolders/Name', (req, res) => { /* RenameVirtualFolder */ res.status(200).json({ message: 'Not implemented' }); });
    app.delete('/Library/VirtualFolders/Paths', (req, res) => { /* RemoveMediaPath */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/Library/VirtualFolders/Paths', (req, res) => { /* AddMediaPath */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/Library/VirtualFolders/Paths/Update', (req, res) => { /* UpdateMediaPath */ res.status(200).json({ message: 'Not implemented' }); });

    // === LiveTv ===
    function getLiveTvConfig(db) {
        const sys = getSystemInfo(db);
        let stored = {};
        try { stored = JSON.parse(sys?.config_json || "{}"); } catch {}
        return stored.livetv || {
            EnableRecordingSubfolders: false,
            EnableOriginalAudioWithEncodedRecordings: false,
            TunerHosts: [],
            ListingProviders: [],
            PrePaddingSeconds: 0,
            PostPaddingSeconds: 0,
            MediaLocationsCreated: [],
            RecordingPostProcessorArguments: "",
            SaveRecordingNFO: true,
            SaveRecordingImages: true,
        };
    }

    function setLiveTvConfig(db, config) {
        const sys = getSystemInfo(db);
        let stored = {};
        try { stored = JSON.parse(sys?.config_json || "{}"); } catch {}
        stored.livetv = config;
        db.prepare("UPDATE system SET config_json = ?").run(JSON.stringify(stored));
    }

    // --- LiveTV channel cache ---
    async function getLiveTvChannels(db) {
        if (Date.now() - _liveTvCache.ts < 30000 && _liveTvCache.channels.length > 0) return _liveTvCache.channels;
        const config = getLiveTvConfig(db);
        if (!config.TunerHosts || config.TunerHosts.length === 0) { _liveTvCache = { channels: [], ts: Date.now() }; return []; }
        const serverId = getSystemInfo(db)?.id || "hmss-local";
        const all = [];
        for (const host of config.TunerHosts) {
            if (!host.Url) continue;
            try {
                const m3u = await fetchM3U(host.Url);
                const parsed = parseM3U(m3u);
                for (const ch of parsed) {
                    all.push({
                        Name: ch.name,
                        ServerId: serverId,
                        Id: ch.id,
                        SortName: ch.name.toLowerCase(),
                        Number: String(ch.chno || 0),
                        ChannelNumber: String(ch.chno || 0),
                        ChannelType: "TV",
                        IsFolder: false,
                        Type: "TvChannel",
                        LocationType: "Remote",
                        MediaType: "Video",
                        MediaSources: [{
                            Protocol: "Stream",
                            Id: ch.id,
                            Name: ch.name,
                            Path: ch.url,
                            Type: "Default",
                            Container: "hls",
                            IsRemote: true,
                            SupportsDirectPlay: true,
                            SupportsDirectStream: true,
                            SupportsTranscoding: false,
                        }],
                        ImageTags: ch.logo ? { Primary: ch.id } : {},
                        LogoUrl: ch.logo || "",
                        Overview: "",
                        ParentId: "",
                        GenreItems: [],
                        Genres: [ch.group],
                        Tags: [],
                        UserData: { PlaybackPositionTicks: 0, PlayCount: 0, IsFavorite: false, Played: false },
                    });
                }
            } catch {}
        }
        _liveTvCache = { channels: all, ts: Date.now() };
        return all;
    }

    function fetchM3U(url) {
        return new Promise((resolve, reject) => {
            http.get(url, { timeout: 10000 }, (res) => {
                if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    return fetchM3U(res.headers.location).then(resolve, reject);
                }
                let body = "";
                res.on("data", (c) => body += c);
                res.on("end", () => resolve(body));
            }).on("error", reject);
        });
    }

    function parseM3U(content) {
        const lines = content.split("\n").map(l => l.trim()).filter(Boolean);
        const channels = [];
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].startsWith("#EXTINF:")) {
                const inf = lines[i];
                const url = lines[i + 1];
                if (!url || url.startsWith("#")) continue;

                const nameMatch = inf.match(/,\s*(.+)$/);
                const name = nameMatch ? nameMatch[1].trim() : "Unknown";
                const logoMatch = inf.match(/tvg-logo="([^"]+)"/);
                const logo = logoMatch ? logoMatch[1] : "";
                const groupMatch = inf.match(/group-title="([^"]+)"/);
                const group = groupMatch ? groupMatch[1] : "General";
                const idMatch = inf.match(/tvg-id="([^"]+)"/);
                const tvgId = idMatch ? idMatch[1] : "";
                const chnoMatch = inf.match(/tvg-chno="([^"]+)"/);
                const chno = chnoMatch ? parseInt(chnoMatch[1]) : 0;

                const id = generateItemId(name + url);
                channels.push({ id, name, logo, group, tvgId, chno, url });
            }
        }
        return channels;
    }

    app.get('/LiveTv/Info', (req, res) => {
        if (!req.user) return res.status(401).end();
        const db = getDb();
        const config = getLiveTvConfig(db);
        const hasTuners = config.TunerHosts && config.TunerHosts.length > 0;
        res.json({
            Status: hasTuners ? "Available" : "Unavailable",
            Tuners: [],
        });
    });

    app.get('/LiveTv/Channels', async (req, res) => {
        if (!req.user) return res.status(401).end();
        const db = getDb();
        const allChannels = await getLiveTvChannels(db);
        const limit = parseInt(req.query.Limit) || 100;
        const start = parseInt(req.query.StartIndex) || 0;
        res.json({
            Items: allChannels.slice(start, start + limit),
            TotalRecordCount: allChannels.length,
            StartIndex: start,
        });
    });

    app.get('/LiveTv/Channels/:channelId', (req, res) => {
        if (!req.user) return res.status(401).end();
        res.status(404).json({ error: "Channel not found." });
    });

    app.get('/LiveTv/GuideInfo', (req, res) => {
        if (!req.user) return res.status(401).end();
        const now = new Date();
        const end = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        res.json({
            StartDate: now.toISOString(),
            EndDate: end.toISOString(),
        });
    });

    app.get('/LiveTv/ChannelMappingOptions', (req, res) => {
        if (!req.user) return res.status(401).end();
        res.json({ MappingOptions: [], Mappings: [], ProviderName: "" });
    });

    app.post('/LiveTv/ChannelMappings', (req, res) => {
        if (!req.user) return res.status(401).end();
        res.json({ StatusCode: 200 });
    });

    app.get('/LiveTv/ListingProviders/Default', (req, res) => {
        if (!req.user) return res.status(401).end();
        res.json({ Type: "Disabled" });
    });

    app.get('/LiveTv/ListingProviders/Lineups', (req, res) => {
        if (!req.user) return res.status(401).end();
        res.json([]);
    });

    app.get('/LiveTv/ListingProviders/SchedulesDirect/Countries', (req, res) => {
        if (!req.user) return res.status(401).end();
        res.json([]);
    });

    app.post('/LiveTv/ListingProviders', (req, res) => {
        if (!req.user) return res.status(401).end();
        res.json({ StatusCode: 200 });
    });

    app.delete('/LiveTv/ListingProviders', (req, res) => {
        if (!req.user) return res.status(401).end();
        res.json({ StatusCode: 200 });
    });

    app.post('/LiveTv/TunerHosts', (req, res) => {
        if (!req.user) return res.status(401).end();
        const db = getDb();
        const config = getLiveTvConfig(db);
        const body = req.body || {};

        if (!body.Type || !body.Url) {
            return res.status(400).json({ error: "Type and Url required." });
        }

        const host = {
            Type: body.Type,
            Url: body.Url,
            FriendlyName: body.FriendlyName || "",
            DeviceId: body.DeviceId || "",
            ImportFavoritesOnly: body.ImportFavoritesOnly ?? false,
            AllowHWTranscoding: body.AllowHWTranscoding ?? false,
            AllowFmp4TranscodingContainer: body.AllowFmp4TranscodingContainer ?? true,
            AllowStreamSharing: body.AllowStreamSharing ?? false,
            FallbackMaxStreamingBitrate: body.FallbackMaxStreamingBitrate ?? 30000000,
            EnableStreamLooping: body.EnableStreamLooping ?? false,
            TunerCount: body.TunerCount ?? 0,
            IgnoreDts: body.IgnoreDts ?? true,
            ReadAtNativeFramerate: body.ReadAtNativeFramerate ?? true,
            Id: body.Id || generateItemId(body.Url + Date.now()),
        };

        const existingIdx = config.TunerHosts.findIndex(h => h.Id === host.Id);
        if (existingIdx >= 0) {
            config.TunerHosts[existingIdx] = host;
        } else {
            config.TunerHosts.push(host);
        }

        setLiveTvConfig(db, config);
        res.json(host);
    });

    app.delete('/LiveTv/TunerHosts', (req, res) => {
        if (!req.user) return res.status(401).end();
        const db = getDb();
        const config = getLiveTvConfig(db);
        const id = req.query.Id || req.body?.Id;

        if (!id) return res.status(400).json({ error: "Id required." });

        config.TunerHosts = config.TunerHosts.filter(h => h.Id !== id);
        setLiveTvConfig(db, config);
        res.json({ StatusCode: 200 });
    });

    app.get('/LiveTv/TunerHosts/Types', (req, res) => {
        if (!req.user) return res.status(401).end();
        res.json([
            { Name: "HD Homerun", Id: "hdhomerun" },
            { Name: "M3U Tuner", Id: "m3u" },
        ]);
    });

    app.get('/LiveTv/Tuners/Discover', (req, res) => {
        if (!req.user) return res.status(401).end();
        res.json([]);
    });

    app.get('/LiveTv/Tuners/Discvover', (req, res) => {
        if (!req.user) return res.status(401).end();
        res.json([]);
    });

    app.get('/LiveTv/Programs', (req, res) => {
        if (!req.user) return res.status(401).end();
        res.json({ Items: [], TotalRecordCount: 0, StartIndex: 0 });
    });

    app.post('/LiveTv/Programs', (req, res) => {
        if (!req.user) return res.status(401).end();
        res.json({ Items: [], TotalRecordCount: 0, StartIndex: 0 });
    });

    app.get('/LiveTv/Programs/Recommended', (req, res) => {
        if (!req.user) return res.status(401).end();
        res.json({ Items: [], TotalRecordCount: 0, StartIndex: 0 });
    });

    app.get('/LiveTv/Programs/:programId', (req, res) => {
        if (!req.user) return res.status(401).end();
        res.status(404).json({ error: "Program not found." });
    });

    app.get('/LiveTv/Recordings', (req, res) => {
        if (!req.user) return res.status(401).end();
        res.json({ Items: [], TotalRecordCount: 0, StartIndex: 0 });
    });

    app.get('/LiveTv/Recordings/Folders', (req, res) => {
        if (!req.user) return res.status(401).end();
        res.json([]);
    });

    app.get('/LiveTv/SeriesTimers', (req, res) => {
        if (!req.user) return res.status(401).end();
        res.json({ Items: [], TotalRecordCount: 0, StartIndex: 0 });
    });

    app.post('/LiveTv/SeriesTimers', (req, res) => {
        if (!req.user) return res.status(401).end();
        res.json({ StatusCode: 200 });
    });

    app.get('/LiveTv/Timers', (req, res) => {
        if (!req.user) return res.status(401).end();
        res.json({ Items: [], TotalRecordCount: 0, StartIndex: 0 });
    });

    app.post('/LiveTv/Timers', (req, res) => {
        if (!req.user) return res.status(401).end();
        res.json({ StatusCode: 200 });
    });

    app.get('/LiveTv/Timers/Defaults', (req, res) => {
        if (!req.user) return res.status(401).end();
        res.json({});
    });

    app.get('/LiveTv/LiveRecordings/:recordingId/stream', (req, res) => {
        if (!req.user) return res.status(401).end();
        res.status(404).end();
    });

    app.get('/LiveTv/LiveStreamFiles/:streamId/stream.:container', (req, res) => {
        if (!req.user) return res.status(401).end();
        res.status(404).end();
    });

    app.post('/LiveTv/Tuners/:tunerId/Reset', (req, res) => {
        if (!req.user) return res.status(401).end();
        res.json({ StatusCode: 200 });
    });

    // === Localization ===
    app.get('/Localization/ParentalRatings', (req, res) => { /* GetParentalRatings */ res.status(200).json({ message: 'Not implemented' }); });

    // === Lyric ===
    app.delete('/Audio/:itemId/Lyrics', (req, res) => { /* DeleteLyrics */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/Audio/:itemId/Lyrics', (req, res) => { /* GetLyrics */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/Audio/:itemId/Lyrics', (req, res) => { /* UploadLyrics */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/Audio/:itemId/RemoteSearch/Lyrics', (req, res) => { /* SearchRemoteLyrics */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/Audio/:itemId/RemoteSearch/Lyrics/:lyricId', (req, res) => { /* DownloadRemoteLyrics */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/Providers/Lyrics/:lyricId', (req, res) => { /* GetRemoteLyrics */ res.status(200).json({ message: 'Not implemented' }); });

    // === MediaInfo ===
    async function findItemForPlayback(req) {
        const index = globalThis.__mediaIndex || { shows: [], movies: [], music: [], unsorted: [] };
        const rawId = (req.params.itemId || "").replace(/-/g, "");
        let found = null, itemPath = null, itemType = null;
        for (const ep of index.shows || []) {
            if (generateItemId(ep.id || ep.filePath) === rawId) { found = ep; itemPath = ep.filePath; itemType = "Episode"; break; }
            if (generateItemId(ep.showName) === rawId) { found = ep; itemType = "Series"; break; }
        }
        if (!found) for (const m of index.movies || []) {
            if (generateItemId(m.id || m.filePath) === rawId) { found = m; itemPath = m.filePath; itemType = "Movie"; break; }
        }
        if (!found) for (const m of index.music || []) {
            if (generateItemId(m.id || m.filePath) === rawId) { found = m; itemPath = m.filePath; itemType = "Audio"; break; }
        }
        if (!found) for (const u of index.unsorted || []) {
            if (generateItemId(u.id || u.filePath) === rawId) { found = u; itemPath = u.filePath; itemType = "Video"; break; }
        }
        if (!found && index.shows?.length > 0) {
            for (const ep of index.shows) {
                const seasonId = generateItemId(`${ep.showName}-s${ep.season}`);
                if (seasonId === rawId) { found = ep; itemType = "Season"; break; }
            }
        }
        if (!found) {
            const tvChannel = findLiveTvChannel(rawId);
            if (tvChannel) {
                return {
                    found: { title: tvChannel.Name, id: tvChannel.Id },
                    itemPath: null,
                    itemType: "TvChannel",
                    probe: null,
                    tvChannel,
                };
            }
        }
        if (!found) return null;

        let probe = null;
        if (itemPath && /\.(mp4|mkv|m4a|mp3|avi|mov|ts|flac|ogg)$/i.test(itemPath)) {
            try { probe = await probeMedia(itemPath); } catch {}
        }
        return { found, itemPath, itemType, probe };
    }

    function buildMediaSource(found, itemPath, id, probe, itemType) {
        if (!probe) return null;
        const isVideo = itemType === "Episode" || itemType === "Movie" || itemType === "Video";
        return {
            Protocol: "File",
            Id: id,
            Path: itemPath,
            Type: "Default",
            Container: probe.container,
            Size: probe.size,
            Name: found.title || "Unknown",
            SortName: (found.title || "unknown").toLowerCase(),
            IsRemote: false,
            RunTimeTicks: Math.round(probe.duration * 10000000),
            SupportsTranscoding: true,
            SupportsDirectStream: true,
            SupportsDirectPlay: true,
            DirectPlayUrl: `/Videos/${id}/stream?static=true&api_key=`,
            DirectStreamUrl: `/Videos/${id}/stream`,
            VideoType: isVideo ? "VideoFile" : undefined,
            MediaStreams: probe.streams,
            Bitrate: probe.bitrate,
            DefaultAudioStreamIndex: probe.streams.findIndex(s => s.Type === "Audio") >= 0 ? probe.streams.findIndex(s => s.Type === "Audio") : null,
            HasSegments: false,
            ETag: id,
            PlaySessionId: crypto.randomUUID(),
        };
    }

    function buildLiveTvMediaSource(tvChannel) {
        const ch = tvChannel.MediaSources[0];
        const liveStreamId = crypto.createHash("md5").update(ch.Id + Date.now()).digest("hex");
        return {
            Protocol: "Http",
            Id: ch.Id,
            Path: ch.Path,
            Type: "Default",
            Container: "hls",
            Size: 0,
            IsRemote: false,
            ReadAtNativeFramerate: true,
            IgnoreDts: true,
            IgnoreIndex: false,
            GenPtsInput: false,
            SupportsTranscoding: true,
            SupportsDirectStream: true,
            SupportsDirectPlay: true,
            IsInfiniteStream: true,
            UseMostCompatibleTranscodingProfile: false,
            RequiresOpening: true,
            RequiresClosing: true,
            LiveStreamId: liveStreamId,
            RequiresLooping: false,
            SupportsProbing: true,
            MediaStreams: [
                {
                    Codec: "h264",
                    CodecTag: "avc1",
                    TimeBase: "1/1000",
                    VideoRange: "SDR",
                    VideoRangeType: "SDR",
                    AudioSpatialFormat: "None",
                    DisplayTitle: "H264 SDR",
                    NalLengthSize: "4",
                    IsInterlaced: false,
                    BitRate: 0,
                    BitDepth: 8,
                    RefFrames: 1,
                    IsDefault: true,
                    IsForced: false,
                    IsHearingImpaired: false,
                    Height: 0,
                    Width: 0,
                    AverageFrameRate: 0,
                    RealFrameRate: 0,
                    ReferenceFrameRate: 0,
                    Profile: "Main",
                    Type: "Video",
                    AspectRatio: "16:9",
                    Index: -1,
                    IsExternal: false,
                    IsTextSubtitleStream: false,
                    SupportsExternalStream: false,
                    PixelFormat: "yuv420p",
                    Level: 32,
                    IsAnamorphic: false,
                },
                {
                    Codec: "aac",
                    CodecTag: "mp4a",
                    Comment: "default",
                    TimeBase: "1/48000",
                    VideoRange: "Unknown",
                    VideoRangeType: "Unknown",
                    AudioSpatialFormat: "None",
                    LocalizedDefault: "Default",
                    LocalizedExternal: "External",
                    DisplayTitle: "AAC - Stereo - Default",
                    IsInterlaced: false,
                    IsAVC: false,
                    ChannelLayout: "stereo",
                    BitRate: 128000,
                    Channels: 2,
                    SampleRate: 48000,
                    IsDefault: true,
                    IsForced: false,
                    IsHearingImpaired: false,
                    Profile: "LC",
                    Type: "Audio",
                    Index: -1,
                    IsExternal: false,
                    IsTextSubtitleStream: false,
                    SupportsExternalStream: false,
                    Level: 0,
                },
            ],
            MediaAttachments: [],
            Formats: [],
            Bitrate: 0,
            FallbackMaxStreamingBitrate: 30000000,
            RequiredHttpHeaders: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            },
            TranscodingSubProtocol: "http",
            AnalyzeDurationMs: 3000,
            DefaultAudioStreamIndex: 1,
            HasSegments: false,
        };
    }

    function buildPlaybackInfoResponse(mediaSource) {
        return {
            MediaSources: mediaSource ? [mediaSource] : [],
            PlaySessionId: crypto.randomUUID(),
            ErrorCode: null,
        };
    }

    app.get('/Items/:itemId/PlaybackInfo', async (req, res) => {
        const item = await findItemForPlayback(req);
        if (!item) return res.status(404).json({ error: "Item not found." });
        if (item.tvChannel) {
            return res.json(buildPlaybackInfoResponse(buildLiveTvMediaSource(item.tvChannel)));
        }
        const id = generateItemId(item.found.id || item.found.filePath);
        const mediaSource = buildMediaSource(item.found, item.itemPath, id, item.probe, item.itemType);
        res.json(buildPlaybackInfoResponse(mediaSource));
    });

    app.post('/Items/:itemId/PlaybackInfo', async (req, res) => {
        const item = await findItemForPlayback(req);
        if (!item) return res.status(404).json({ error: "Item not found." });
        if (item.tvChannel) {
            return res.json(buildPlaybackInfoResponse(buildLiveTvMediaSource(item.tvChannel)));
        }
        const id = generateItemId(item.found.id || item.found.filePath);
        const mediaSource = buildMediaSource(item.found, item.itemPath, id, item.probe, item.itemType);
        res.json(buildPlaybackInfoResponse(mediaSource));
    });
    app.post('/LiveStreams/Close', (req, res) => { /* CloseLiveStream */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/LiveStreams/Open', (req, res) => { /* OpenLiveStream */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/Playback/BitrateTest', (req, res) => {
        const size = Math.min(parseInt(req.query.Size) || 500000, 10000000);
        const buf = crypto.randomBytes(size);
        res.set("Content-Type", "application/octet-stream");
        res.set("Content-Length", size);
        res.send(buf);
    });

    // === MediaSegment ===
    app.get('/MediaSegments/:itemId', (req, res) => { /* GetItemSegments */ res.status(200).json({ message: 'Not implemented' }); });

    // === Movie ===
    app.get('/Movies/Recommendations', (req, res) => { /* GetMovieRecommendations */ res.status(200).json({ message: 'Not implemented' }); });

    // === MusicGenre ===
    app.get('/MusicGenres/:genreName', (req, res) => { /* GetMusicGenre */ res.status(200).json({ message: 'Not implemented' }); });

    // === Person ===
    app.get('/Persons', (req, res) => { /* GetPersons */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/Persons/:name', (req, res) => { /* GetPerson */ res.status(200).json({ message: 'Not implemented' }); });

    // === Playlist ===
    app.post('/Playlists', (req, res) => { /* CreatePlaylist */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/Playlists/:playlistId', (req, res) => { /* GetPlaylist */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/Playlists/:playlistId', (req, res) => { /* UpdatePlaylist */ res.status(200).json({ message: 'Not implemented' }); });
    app.delete('/Playlists/:playlistId/Items', (req, res) => { /* RemoveItemFromPlaylist */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/Playlists/:playlistId/Items', (req, res) => { /* GetPlaylistItems */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/Playlists/:playlistId/Items', (req, res) => { /* AddItemToPlaylist */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/Playlists/:playlistId/Items/:itemId/Move/:newIndex', (req, res) => { /* MoveItem */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/Playlists/:playlistId/Users', (req, res) => { /* GetPlaylistUsers */ res.status(200).json({ message: 'Not implemented' }); });
    app.delete('/Playlists/:playlistId/Users/:userId', (req, res) => { /* RemoveUserFromPlaylist */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/Playlists/:playlistId/Users/:userId', (req, res) => { /* GetPlaylistUser */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/Playlists/:playlistId/Users/:userId', (req, res) => { /* UpdatePlaylistUser */ res.status(200).json({ message: 'Not implemented' }); });

    // === Plugin ===
    app.post('/Packages/Installed/:name', (req, res) => { /* InstallPackage */ res.status(200).json({ message: 'Not implemented' }); });
    app.delete('/Packages/Installing/:packageId', (req, res) => { /* CancelPackageInstallation */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/Packages/:name', (req, res) => { /* GetPackageInfo */ res.status(200).json({ message: 'Not implemented' }); });
    app.delete('/Plugins/:pluginId', (req, res) => { /* UninstallPlugin */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/Plugins/:pluginId/Manifest', (req, res) => { /* GetPluginManifest */ res.status(200).json({ message: 'Not implemented' }); });
    app.delete('/Plugins/:pluginId/:version', (req, res) => { /* UninstallPluginByVersion */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/Plugins/:pluginId/:version/Disable', (req, res) => { /* DisablePlugin */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/Plugins/:pluginId/:version/Enable', (req, res) => { /* EnablePlugin */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/Plugins/:pluginId/:version/Image', (req, res) => { /* GetPluginImage */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/Repositories', (req, res) => { /* GetRepositories */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/Repositories', (req, res) => { /* SetRepositories */ res.status(200).json({ message: 'Not implemented' }); });

    // === RemoteImage ===
    app.post('/Items/:itemId/RemoteImages/Download', (req, res) => { /* DownloadRemoteImage */ res.status(200).json({ message: 'Not implemented' }); });

    // === ScheduledTask ===
    app.get('/ScheduledTasks', (req, res) => {
        if (!req.user || req.user.perms < 2) return res.status(401).json({ error: "Unauthorized" });
        res.json([]);
    });
    app.delete('/ScheduledTasks/Running/:taskId', (req, res) => { /* StopTask */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/ScheduledTasks/Running/:taskId', (req, res) => { /* StartTask */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/ScheduledTasks/:taskId', (req, res) => { /* GetTask */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/ScheduledTasks/:taskId/Triggers', (req, res) => { /* UpdateTask */ res.status(200).json({ message: 'Not implemented' }); });

    // === Search ===
    app.get('/Search/Hints', (req, res) => { /* GetSearchHints */ res.status(200).json({ message: 'Not implemented' }); });

    // === Session ===
    app.post('/Sessions/Capabilities', (req, res) => { /* PostCapabilities */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/Sessions/Capabilities/Full', (req, res) => { /* PostFullCapabilities */ res.status(204) });
    app.post('/Sessions/Playing', (req, res) => { /* ReportPlaybackStart */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/Sessions/Playing/Ping', (req, res) => { /* PingPlaybackSession */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/Sessions/Playing/Progress', (req, res) => { /* ReportPlaybackProgress */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/Sessions/Playing/Stopped', (req, res) => { /* ReportPlaybackStopped */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/Sessions/Viewing', (req, res) => { /* ReportViewing */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/Sessions/:sessionId/Command', (req, res) => { /* SendFullGeneralCommand */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/Sessions/:sessionId/Command/:command', (req, res) => { /* SendGeneralCommand */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/Sessions/:sessionId/Message', (req, res) => { /* SendMessageCommand */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/Sessions/:sessionId/Playing', (req, res) => { /* Play */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/Sessions/:sessionId/Playing/:command', (req, res) => { /* SendPlaystateCommand */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/Sessions/:sessionId/System/:command', (req, res) => { /* SendSystemCommand */ res.status(200).json({ message: 'Not implemented' }); });
    app.delete('/Sessions/:sessionId/User/:userId', (req, res) => { /* RemoveUserFromSession */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/Sessions/:sessionId/User/:userId', (req, res) => { /* AddUserToSession */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/Sessions/:sessionId/Viewing', (req, res) => { /* DisplayContent */ res.status(200).json({ message: 'Not implemented' }); });

    // === Show ===
    app.get('/Shows/NextUp', (req, res) => { /* GetNextUp */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/Shows/Upcoming', (req, res) => { /* GetUpcomingEpisodes */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/Shows/:seriesId/Episodes', (req, res) => {
        if (!req.user) return res.status(401).end();
        const sys = getSystemInfo(getDb());
        const serverId = sys?.id || "hmss-local";
        const index = globalThis.__mediaIndex || { shows: [], movies: [], music: [] };
        const seriesId = req.params.seriesId.replace(/-/g, "");
        const seasonId = (req.query.seasonId || req.query.SeasonId || "").replace(/-/g, "");
        const limit = parseInt(req.query.Limit) || 500;
        const start = parseInt(req.query.StartIndex) || 0;

        let showName = null;
        for (const ep of index.shows || []) {
            if (generateItemId(ep.showName) === seriesId) { showName = ep.showName; break; }
        }
        if (!showName) return res.json({ Items: [], TotalRecordCount: 0, StartIndex: 0 });

        let episodes = (index.shows || []).filter(ep => ep.showName === showName);
        if (seasonId) {
            episodes = episodes.filter(ep => generateItemId(`${ep.showName}-s${ep.season}`) === seasonId);
        }

        const items = episodes.map(ep => {
            const itemId = generateItemId(ep.id || ep.filePath);
            const poster = findPosterPath(ep.filePath);
            const runTimeTicks = ep.duration ? Math.round(ep.duration * 10000000) : 0;
            return {
                Name: ep.title || `S${String(ep.season).padStart(2,"0")}E${String(ep.episode).padStart(2,"0")}`,
                OriginalTitle: ep.title || "",
                ServerId: serverId,
                Id: itemId,
                DateCreated: new Date().toISOString(),
                CanDelete: false,
                CanDownload: false,
                HasLyrics: false,
                HasSubtitles: false,
                SortName: (ep.title || `s${ep.season}e${ep.episode}`).toLowerCase(),
                PremiereDate: undefined,
                ExternalUrls: [],
                MediaSources: [],
                Path: ep.filePath || "",
                Overview: ep.overview || "",
                Taglines: [],
                Genres: ep.genres || [],
                CommunityRating: null,
                RunTimeTicks: runTimeTicks,
                PlayAccess: "Full",
                ProductionYear: ep.year || undefined,
                IsFolder: false,
                Type: "Episode",
                ParentId: generateItemId(showName),
                SeriesName: showName,
                SeriesId: generateItemId(showName),
                SeasonId: seasonId || generateItemId(`${showName}-s${ep.season}`),
                IndexNumber: ep.episode,
                ParentIndexNumber: ep.season,
                Number: String(ep.episode || ""),
                VideoType: "VideoFile",
                UserData: {
                    PlaybackPositionTicks: 0,
                    PlayCount: 0,
                    IsFavorite: false,
                    Played: false,
                    Key: itemId.replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, "$1-$2-$3-$4-$5"),
                    ItemId: itemId,
                },
                ImageTags: poster ? { Primary: poster.tag } : {},
                BackdropImageTags: [],
                ImageBlurHashes: poster ? { Primary: {} } : {},
                LocationType: "FileSystem",
                MediaType: "Video",
                PrimaryImageAspectRatio: 0,
            };
        });

        res.json({
            Items: items.slice(start, start + limit),
            TotalRecordCount: items.length,
            StartIndex: start,
        });
    });
    app.get('/Shows/:seriesId/Seasons', (req, res) => { /* GetSeasons */ res.status(200).json({ message: 'Not implemented' }); });

    // === Startup ===
    app.get('/Startup/FirstUser', (req, res) => { /* GetFirstUser_2 */ res.status(200).json({ message: 'Not implemented' }); });

    // === Studio ===
    app.get('/Studios', (req, res) => { /* GetStudios */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/Studios/:name', (req, res) => { /* GetStudio */ res.status(200).json({ message: 'Not implemented' }); });

    // === Subtitle ===
    app.get('/FallbackFont/Fonts', (req, res) => { /* GetFallbackFontList */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/FallbackFont/Fonts/:name', (req, res) => { /* GetFallbackFont */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/Items/:itemId/RemoteSearch/Subtitles/:language', (req, res) => { /* SearchRemoteSubtitles */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/Items/:itemId/RemoteSearch/Subtitles/:subtitleId', (req, res) => { /* DownloadRemoteSubtitles */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/Providers/Subtitles/Subtitles/:subtitleId', (req, res) => { /* GetRemoteSubtitles */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/Videos/:itemId/Subtitles', (req, res) => { /* UploadSubtitle */ res.status(200).json({ message: 'Not implemented' }); });
    app.delete('/Videos/:itemId/Subtitles/:index', (req, res) => { /* DeleteSubtitle */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/Videos/:itemId/:mediaSourceId/Subtitles/:index/subtitles.m3u8', (req, res) => { /* GetSubtitlePlaylist */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/Videos/:routeItemId/:routeMediaSourceId/Subtitles/:routeIndex/Stream.:routeFormat', (req, res) => { /* GetSubtitle */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/Videos/:routeItemId/:routeMediaSourceId/Subtitles/:routeIndex/:routeStartPositionTicks/Stream.:routeFormat', (req, res) => { /* GetSubtitleWithTicks */ res.status(200).json({ message: 'Not implemented' }); });

    // === Suggestion ===

    // === SyncPlay ===
    app.post('/SyncPlay/Buffering', (req, res) => { /* SyncPlayBuffering */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/SyncPlay/Join', (req, res) => { /* SyncPlayJoinGroup */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/SyncPlay/Leave', (req, res) => { /* SyncPlayLeaveGroup */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/SyncPlay/List', (req, res) => { /* SyncPlayGetGroups */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/SyncPlay/MovePlaylistItem', (req, res) => { /* SyncPlayMovePlaylistItem */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/SyncPlay/New', (req, res) => { /* SyncPlayCreateGroup */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/SyncPlay/NextItem', (req, res) => { /* SyncPlayNextItem */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/SyncPlay/Pause', (req, res) => { /* SyncPlayPause */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/SyncPlay/Ping', (req, res) => { /* SyncPlayPing */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/SyncPlay/PreviousItem', (req, res) => { /* SyncPlayPreviousItem */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/SyncPlay/Queue', (req, res) => { /* SyncPlayQueue */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/SyncPlay/Ready', (req, res) => { /* SyncPlayReady */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/SyncPlay/RemoveFromPlaylist', (req, res) => { /* SyncPlayRemoveFromPlaylist */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/SyncPlay/Seek', (req, res) => { /* SyncPlaySeek */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/SyncPlay/SetIgnoreWait', (req, res) => { /* SyncPlaySetIgnoreWait */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/SyncPlay/SetNewQueue', (req, res) => { /* SyncPlaySetNewQueue */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/SyncPlay/SetPlaylistItem', (req, res) => { /* SyncPlaySetPlaylistItem */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/SyncPlay/SetRepeatMode', (req, res) => { /* SyncPlaySetRepeatMode */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/SyncPlay/SetShuffleMode', (req, res) => { /* SyncPlaySetShuffleMode */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/SyncPlay/Stop', (req, res) => { /* SyncPlayStop */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/SyncPlay/Unpause', (req, res) => { /* SyncPlayUnpause */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/SyncPlay/:id', (req, res) => { /* SyncPlayGetGroup */ res.status(200).json({ message: 'Not implemented' }); });

    // === System ===
    app.post('/ClientLog/Document', (req, res) => { /* LogFile */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/GetUtcTime', (req, res) => { /* GetUtcTime */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/System/Configuration/Branding', (req, res) => { /* UpdateBrandingConfiguration */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/System/Configuration/MetadataOptions/Default', (req, res) => { /* GetDefaultMetadataOptions */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/System/Configuration/:key', (req, res) => {
        if (!req.user || req.user.perms < 2) return res.status(401).end();
        const db = getDb();
        const key = req.params.key;

        if (key === "livetv") {
            return res.json(getLiveTvConfig(db));
        }

        const sys = getSystemInfo(db);
        let stored = {};
        try { stored = JSON.parse(sys?.config_json || "{}"); } catch {}
        if (stored[key] !== undefined) return res.json(stored[key]);
        res.json({});
    });
    app.post('/System/Configuration/:key', (req, res) => {
        if (!req.user || req.user.perms < 2) return res.status(401).end();
        const db = getDb();
        const key = req.params.key;
        const body = req.body || {};

        if (key === "livetv") {
            setLiveTvConfig(db, body);
            return res.json({ StatusCode: 200 });
        }

        const sys = getSystemInfo(db);
        let stored = {};
        try { stored = JSON.parse(sys?.config_json || "{}"); } catch {}
        stored[key] = body;
        db.prepare("UPDATE system SET config_json = ?").run(JSON.stringify(stored));
        res.json({ StatusCode: 200 });
    });
    app.get('/System/Ping', (req, res) => { res.status(200).end(); });
    app.post('/System/Ping', (req, res) => { res.status(200).end(); });

    // === Trailer ===
    app.get('/Trailers', (req, res) => { /* GetTrailers */ res.status(200).json({ message: 'Not implemented' }); });

    // === TrickPlay ===
    app.get('/Videos/:itemId/Trickplay/:width/tiles.m3u8', (req, res) => { /* GetTrickplayHlsPlaylist */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/Videos/:itemId/Trickplay/:width/:index.jpg', (req, res) => { /* GetTrickplayTileImage */ res.status(200).json({ message: 'Not implemented' }); });

    // === User ===
    app.post('/Users', (req, res) => { /* UpdateUser */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/Users/Configuration', (req, res) => { /* UpdateUserConfiguration */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/Users/New', (req, res) => { /* CreateUserByName */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/Users/Password', (req, res) => { /* UpdateUserPassword */ res.status(200).json({ message: 'Not implemented' }); });
    app.delete('/Users/:userId', (req, res) => { /* DeleteUser */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/Users/:userId/Policy', (req, res) => { /* UpdateUserPolicy */ res.status(200).json({ message: 'Not implemented' }); });

    // === UserData ===
    app.delete('/UserFavoriteItems/:itemId', (req, res) => { /* UnmarkFavoriteItem */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/UserFavoriteItems/:itemId', (req, res) => { /* MarkFavoriteItem */ res.status(200).json({ message: 'Not implemented' }); });
    app.delete('/UserItems/:itemId/Rating', (req, res) => { /* DeleteUserItemRating */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/UserItems/:itemId/Rating', (req, res) => { /* UpdateUserItemRating */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/UserItems/:itemId/UserData', (req, res) => { /* GetItemUserData */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/UserItems/:itemId/UserData', (req, res) => { /* UpdateItemUserData */ res.status(200).json({ message: 'Not implemented' }); });
    app.delete('/UserPlayedItems/:itemId', (req, res) => { /* MarkUnplayedItem */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/UserPlayedItems/:itemId', (req, res) => { /* MarkPlayedItem */ res.status(200).json({ message: 'Not implemented' }); });

    // === UserView ===
    app.get('/UserViews/GroupingOptions', (req, res) => { /* GetGroupingOptions */ res.status(200).json({ message: 'Not implemented' }); });

    // === Video ===
    app.post('/Videos/MergeVersions', (req, res) => { /* MergeVersions */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/Videos/:itemId/AdditionalParts', (req, res) => { /* GetAdditionalPart */ res.status(200).json({ message: 'Not implemented' }); });
    app.delete('/Videos/:itemId/AlternateSources', (req, res) => { /* DeleteAlternateSources */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/Videos/:itemId/stream.:container', (req, res) => streamFile(req, res, req.params.itemId));
    app.head('/Videos/:itemId/stream.:container', (req, res) => streamFile(req, res, req.params.itemId));
    app.get('/Videos/:itemId/stream', (req, res) => streamFile(req, res, req.params.itemId));
    app.head('/Videos/:itemId/stream', (req, res) => streamFile(req, res, req.params.itemId));
    app.get('/Videos/:videoId/:mediaSourceId/Attachments/:index', (req, res) => { /* GetAttachment */ res.status(200).json({ message: 'Not implemented' }); });

    // === Year ===
    app.get('/Years', (req, res) => { /* GetYears */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/Years/:year', (req, res) => { /* GetYear */ res.status(200).json({ message: 'Not implemented' }); });

}

function getLocalIPv4() {
    const interfaces = os.networkInterfaces();
    for (const [, addrs] of Object.entries(interfaces)) {
        for (const addr of addrs) {
            if (addr.family === "IPv4" && !addr.internal) {
                return addr.address;
            }
        }
    }
    return "127.0.0.1";
}