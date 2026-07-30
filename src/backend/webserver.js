import { getAddons, getAddonsByCapability, searchAll } from "./addon_loader.js";
import { authMiddleware, hmssAuthRoutes } from "./auth.js";
import { getSystemInfo, getUserData, setUserData, getResumableItems, getPlayedItems, getUserNFCs, getNFCByTagId, addOrUpdateNFC, removeNFC } from "./sql.js";
import { suggestionsFromIndex, filteredItemsFromIndex, findPosterPath, findImageInDir, readMetaForDir, mapToJellyfinItem, makeShowFolder, makeSeasonFolder, addDashesToUuid } from "./jellyfin_items.js";
import { probeMedia, generateItemId } from "./media_probe.js";
import { getItemMeta } from "./meta_reader.js";
import { readFile, writeFile } from "node:fs/promises";
import * as telerising from "./telerising.js";
import * as codecs from "./codecs.js";
import * as transcoder from "./transcoder.js";
import * as server from "../../server.js";

import { readFileSync, readdirSync, existsSync, statSync, statfsSync, createReadStream } from "node:fs";
import http from "node:http";
import https from "node:https";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import zlib from "node:zlib";
import { imageSize } from "image-size";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let _liveTvCache = { channels: [], ts: 0 };
function findLiveTvChannel(itemId) {
    return _liveTvCache.channels.find(c => c.Id === itemId) || null;
}
function resolveParentId(pid) {
    if (!pid) return null;
    if (pid === "movies" || pid === generateItemId("movies")) return "movies";
    if (pid === "tvshows" || pid === "shows" || pid === generateItemId("tvshows")) return "tvshows";
    if (pid === "music" || pid === generateItemId("music")) return "music";
    if (pid === "unsorted" || pid === generateItemId("unsorted")) return "unsorted";
    if (pid === "livetv" || pid === generateItemId("livetv")) return "livetv";
    return pid;
}

export async function hmssRoutes(app, getDb, apiVersion, port, mediaDirs = {}) {
    app.use(authMiddleware(getDb));
    hmssAuthRoutes(app, getDb);

    app.use((req, res, next) => {
        const NO_CACHE_ROUTES = [
            "/Socket",
            "/websocket",
            "/Sessions",
            "/Items",
            "/Videos",
            "/Audio",
            "/LiveTv",
            "/Users/Authenticate",
            "/QuickConnect",
            "/Notifications",
            "/hmss/remote-debug"
        ];

        if (NO_CACHE_ROUTES.some(route => req.path.startsWith(route))) {
            res.set("Cache-Control", "no-store, no-cache, must-revalidate");
            res.set("Pragma", "no-cache");
            res.set("Expires", "0");
        }
        next();
    });

    app.get("/eruda", (req, res) => {
        res.sendFile(path.join(__dirname, "../../node_modules/eruda/eruda.js"));
    });

    app.get("/", (req, res) => {
        res.redirect("/web/alt_index.html");
    });

    app.get(/^\/web\/banner-light.*\.png$/, (req, res) => {
        res.sendFile(path.join(__dirname, "../../web/hmss/img/logo.png"));
    });

    app.get(/^\/web\/favicon.*\.ico$/, (req, res) => {
        res.sendFile(path.join(__dirname, "../../web/hmss/img/logo.png"));
    });

    app.get(/^\/web\/favicons\/touchicon.*\.png$/, (req, res) => {
        res.sendFile(path.join(__dirname, "../../web/hmss/img/logo.png"));
    });

    app.get(/^\/web\/icon-transparent.*\.png$/, (req, res) => {
        res.sendFile(path.join(__dirname, "../../web/hmss/img/logo.png"));
    });

    // NFC tag management
    const HA_TAG_REGEX = /^https?:\/\/(www\.)?home-assistant\.io\/tag\/(.+)$/i;

    app.get("/hmss/nfc/:UserID", (req, res) => {
        if (!req.user) return res.status(401).json({ error: "Unauthorized." });
        const db = getDb();
        const nfcTags = getUserNFCs(db, req.user.id);
        res.json({
            Items: nfcTags.map(n => ({
                Id: n.id,
                UserId: String(n.user_id),
                TagId: n.tag_id,
                TagName: n.tag_name,
                TagDescription: n.description || "",
                ActionType: n.action_type,
                data: n.action_payload || "",
                isFromHA: Boolean(n.is_from_ha),
                CreatedAt: n.created_at,
            })),
            TotalRecordCount: nfcTags.length,
        });
    });

    app.post("/hmss/nfc/:UserID/:TagID", (req, res) => {
        if (!req.user) return res.status(401).json({ error: "Unauthorized." });
        const db = getDb();
        const { TagName, TagDescription, ActionType, data, isFromHA } = req.body || {};

        let finalTagId = req.params.TagID;
        let detectedHA = Boolean(isFromHA);

        const haMatch = finalTagId.match(HA_TAG_REGEX);
        if (haMatch) {
            finalTagId = haMatch[2];
            detectedHA = true;
        }

        const existing = getNFCByTagId(db, req.user.id, finalTagId);
        if (existing && existing.is_from_ha && !detectedHA) {
            return res.status(409).json({ error: "This tag was scanned via Home Assistant and its UUID cannot be changed." });
        }

        const result = addOrUpdateNFC(
            db,
            req.user.id,
            finalTagId,
            TagName || "",
            ActionType || "none",
            data || "",
            TagDescription || "",
            detectedHA
        );
        res.status(result.updated ? 200 : 201).json({
            Id: result.id,
            UserId: String(req.user.id),
            TagId: finalTagId,
            TagName: TagName || "",
            TagDescription: TagDescription || "",
            ActionType: ActionType || "none",
            data: data || "",
            isFromHA: detectedHA,
            Updated: result.updated,
        });
    });

    app.delete("/hmss/nfc/:UserID/:TagID", (req, res) => {
        if (!req.user) return res.status(401).json({ error: "Unauthorized." });
        const db = getDb();
        const removed = removeNFC(db, req.user.id, req.params.TagID);
        if (!removed) return res.status(404).json({ error: "NFC tag not found." });
        res.status(204).end();
    });

    app.post("/hmss/remote-debug", (req, res) => {
        if (!globalThis.__hmssDebugAcceptRemote) return res.status(403).json({ error: "Remote debug disabled." });
        if (!req.user) return res.status(401).json({ error: "Unauthorized." });
        const { level, message, timestamp } = req.body || {};
        if (!message) return res.status(400).json({ error: "Message required." });
        const prefix = "[Client-" + req.user.id + "]";
        const ts = timestamp ? "[" + timestamp + "]" : "";
        switch (level) {
            case "error": console.error(prefix + ts, message); break;
            case "warn": console.warn(prefix + ts, message); break;
            default: console.log(prefix + ts, message); break;
        }
        res.status(204).end();
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
            } catch { }
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
            const stats = statSync(poster.path);
            const dim = imageSize(poster.path);
            res.json([{
                ImageType: "Primary",
                ImageIndex: 0,
                ImageTag: poster.tag,
                Path: poster.path,
                Height: dim.height,
                Width: dim.width,
                Size: stats.size,
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

    app.get("/Items/:itemId/Images/Backdrop", (req, res) => {
        serveItemImage(req, res, "Backdrop");
    });

    app.get("/Items/:itemId/Images/Thumb", (req, res) => {
        serveItemImage(req, res, "Thumb");
    });

    app.get("/Users/:userId/Items/:itemId/Images/Primary", (req, res) => {
        serveItemImage(req, res, "Primary");
    });

    app.get("/Users/:userId/Items/:itemId/Images/Backdrop", (req, res) => {
        serveItemImage(req, res, "Backdrop");
    });

    app.get("/Users/:userId/Items/:itemId/Images/Thumb", (req, res) => {
        serveItemImage(req, res, "Thumb");
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

        // resolve library-level IDs to a random item from that library
        const LIB_LOOKUP = {
            [generateItemId("movies")]: "movie",
            [generateItemId("tvshows")]: "shows",
            [generateItemId("shows")]: "shows",
            [generateItemId("music")]: "music",
        };
        const libKey = LIB_LOOKUP[rawId];
        if (libKey) {
            const index = globalThis.__mediaIndex || {};
            const entries = index[libKey] || [];
            if (entries.length > 0) {
                var shuffled = [].concat(entries).sort(function () { return Math.random() - 0.5; });
                for (var i = 0; i < shuffled.length && i < 20; i++) {
                    var fp = shuffled[i].filePath || shuffled[i].showName;
                    if (!fp) continue;
                    var libDir = fp.substring(0, fp.lastIndexOf("/"));
                    var libParentDir = libDir + "/..";
                    var libImg = findImageInDir(libDir, imageType) || findImageInDir(libParentDir, imageType) || findPosterPath(fp);
                    if (libImg) {
                        try {
                            var s = statSync(libImg.path);
                            var imgExt = libImg.path.split(".").pop();
                            var mime = imgExt === "png" ? "image/png" : imgExt === "webp" ? "image/webp" : "image/jpeg";
                            res.set("Content-Type", mime);
                            res.set("Content-Length", s.size);
                            return createReadStream(libImg.path).pipe(res);
                        } catch { return res.status(404).end(); }
                    }
                }
            }
            return res.status(404).end();
        }

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

        const dir = filePath.substring(0, filePath.lastIndexOf("/"));
        const parentDir = dir + "/..";
        const image = findImageInDir(dir, imageType) || findImageInDir(parentDir, imageType)
            || findPosterPath(filePath);
        if (!image) return res.status(404).end();

        try {
            const s = statSync(image.path);
            const ext = image.path.split(".").pop();
            const mime = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
            res.set("Content-Type", mime);
            res.set("Content-Length", s.size);
            createReadStream(image.path).pipe(res);
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
        try { stored = JSON.parse(sys?.config_json || "{}"); } catch { }
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
        try { existing = JSON.parse(sys?.config_json || "{}"); } catch { }
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
                } catch (e) { console.error(`LiveTV fetchM3U error for ${host.Url}:`, e.message); }
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
        } catch { }
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
        } catch { }

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
                const id = generateItemId(key);
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
                    ItemId: id,
                    ServerId: getSystemInfo(getDb())?.id || "hmss-local",
                    Id: id,
                    Etag: id,
                    DateCreated: new Date().toISOString(),
                    DateLastMediaAdded: "0001-01-01T00:00:00.0000000Z",
                    CanDelete: false,
                    CanDownload: false,
                    SortName: key.toLowerCase(),
                    ExternalUrls: [],
                    Path: p,
                    EnableMediaSourceDisplay: true,
                    ChannelId: null,
                    Taglines: [],
                    Genres: [],
                    PlayAccess: "Full",
                    RemoteTrailers: [],
                    ProviderIds: {},
                    IsFolder: true,
                    ParentId: null,
                    Type: "CollectionFolder",
                    People: [],
                    Studios: [],
                    GenreItems: [],
                    LocalTrailerCount: 0,
                    UserData: { PlaybackPositionTicks: 0, PlayCount: 0, IsFavorite: false, Played: false, Key: addDashesToUuid(id), ItemId: id },
                    SpecialFeatureCount: 0,
                    DisplayPreferencesId: id,
                    Tags: [],
                    PrimaryImageAspectRatio: 1.7777777777777777,
                    ImageTags: {},
                    BackdropImageTags: [],
                    ImageBlurHashes: {},
                    LocationType: "FileSystem",
                    MediaType: "Unknown",
                    LockedFields: [],
                    LockData: false,
                    PrimaryImageItemId: null,
                    RefreshProgress: 0,
                    RefreshStatus: "Idle",
                });
            }
        }
        const db = getDb();
        const ltConfig = (() => { try { return JSON.parse((getSystemInfo(db)?.config_json || "{}")).livetv; } catch { return null; } })();
        if (ltConfig?.TunerHosts?.length > 0) {
            const ltId = generateItemId("livetv");
            result.push({
                Name: "Live TV",
                Locations: [],
                CollectionType: "livetv",
                LibraryOptions: { Enabled: true },
                ItemId: ltId,
                ServerId: getSystemInfo(getDb())?.id || "hmss-local",
                Id: ltId,
                Etag: ltId,
                DateCreated: new Date().toISOString(),
                DateLastMediaAdded: "0001-01-01T00:00:00.0000000Z",
                CanDelete: false,
                CanDownload: false,
                SortName: "livetv",
                ExternalUrls: [],
                Path: "",
                EnableMediaSourceDisplay: true,
                ChannelId: null,
                Taglines: [],
                Genres: [],
                PlayAccess: "Full",
                RemoteTrailers: [],
                ProviderIds: {},
                IsFolder: true,
                ParentId: null,
                Type: "CollectionFolder",
                People: [],
                Studios: [],
                GenreItems: [],
                LocalTrailerCount: 0,
                UserData: { PlaybackPositionTicks: 0, PlayCount: 0, IsFavorite: false, Played: false, Key: addDashesToUuid(ltId), ItemId: ltId },
                SpecialFeatureCount: 0,
                DisplayPreferencesId: ltId,
                Tags: [],
                PrimaryImageAspectRatio: 1.7777777777777777,
                ImageTags: {},
                BackdropImageTags: [],
                ImageBlurHashes: {},
                LocationType: "FileSystem",
                MediaType: "Unknown",
                LockedFields: [],
                LockData: false,
                PrimaryImageItemId: null,
                RefreshProgress: 0,
                RefreshStatus: "Idle",
            });
        }
        res.json(result);
    });

    app.get("/Users/:userId/Items/Resume", async (req, res) => {
        if (!req.user) return res.status(401).end();
        const db = getDb();
        const sys = getSystemInfo(db);
        const serverId = sys?.id || "hmss-local";
        const userId = req.user.id;
        const limit = parseInt(req.query.Limit || req.query.limit) || 12;
        const mediaTypes = (req.query.MediaTypes || req.query.mediaTypes || "Video").split(",").map(t => t.trim());

        var indexKeys = [];
        var typeFilters = [];
        mediaTypes.forEach(function (mt) {
            if (mt === "Video") { indexKeys.push("movies", "shows"); typeFilters.push("Movie", "Episode"); }
            else if (mt === "Audio") { indexKeys.push("music"); typeFilters.push("Audio"); }
            else if (mt === "Book") { indexKeys.push("unsorted"); typeFilters.push("Book"); }
        });
        if (indexKeys.length === 0) return res.json({ Items: [], TotalRecordCount: 0, StartIndex: 0 });

        const rows = getResumableItems(db, userId, null, limit * 3);
        const index = globalThis.__mediaIndex || { shows: [], movies: [], music: [], unsorted: [] };
        const items = [];
        for (const row of rows) {
            if (items.length >= limit) break;
            var match = null;
            var entryType = null;
            var jellyfinType = null;
            for (var ki = 0; ki < indexKeys.length; ki++) {
                var ik = indexKeys[ki];
                var entries = index[ik] || [];
                for (var ei = 0; ei < entries.length; ei++) {
                    var e = entries[ei];
                    if (generateItemId(e.id || e.filePath) === row.item_id) {
                        match = e;
                        entryType = ik === "movies" ? "movie" : ik === "shows" ? "show" : ik;
                        jellyfinType = typeFilters[ki];
                        break;
                    }
                }
                if (match) break;
            }
            if (!match || !typeFilters.includes(jellyfinType)) continue;
            var item = mapToJellyfinItem({
                id: match.id, title: match.title, showName: match.showName,
                season: match.season, episode: match.episode, year: match.year,
                filePath: match.filePath, overview: match.overview,
                duration: match.duration, genres: match.genres,
            }, entryType, serverId);
            item.UserData = {
                PlaybackPositionTicks: row.playback_position_ticks,
                PlayCount: row.play_count,
                IsFavorite: Boolean(row.is_favorite),
                Played: Boolean(row.played),
                LastPlayedDate: row.last_played_date || undefined,
                Key: item.UserData.Key,
                ItemId: item.Id,
            };
            items.push(item);
        }
        res.json({ Items: items, TotalRecordCount: items.length, StartIndex: 0 });
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
                Etag: itemId,
                DateCreated: new Date().toISOString(),
                DateLastMediaAdded: "0001-01-01T00:00:00.0000000Z",
                CanDelete: false,
                CanDownload: false,
                SortName: "livetv",
                ExternalUrls: [],
                Path: "",
                EnableMediaSourceDisplay: true,
                ChannelId: null,
                Taglines: [],
                Genres: [],
                PlayAccess: "Full",
                RemoteTrailers: [],
                ProviderIds: {},
                IsFolder: true,
                ParentId: null,
                Type: "CollectionFolder",
                CollectionType: "livetv",
                People: [],
                Studios: [],
                GenreItems: [],
                LocalTrailerCount: 0,
                ChildCount: 0,
                UserData: {
                    PlaybackPositionTicks: 0,
                    PlayCount: 0,
                    IsFavorite: false,
                    Played: false,
                    Key: itemId,
                    ItemId: itemId,
                },
                SpecialFeatureCount: 0,
                DisplayPreferencesId: itemId,
                Tags: [],
                PrimaryImageAspectRatio: 1.7777777777777777,
                ImageTags: {},
                BackdropImageTags: [],
                ImageBlurHashes: {},
                LocationType: "FileSystem",
                MediaType: "Unknown",
                LockedFields: [],
                LockData: false,
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

        const itemId = generateItemId(nameMap[collectionType] || sourceKey);
        res.json({
            Name: nameMap[collectionType] || sourceKey,
            ServerId: serverId,
            Id: itemId,
            Etag: itemId,
            DateCreated: new Date().toISOString(),
            DateLastMediaAdded: "0001-01-01T00:00:00.0000000Z",
            CanDelete: false,
            CanDownload: false,
            SortName: (nameMap[collectionType] || sourceKey).toLowerCase(),
            ExternalUrls: [],
            Path: mediaDirs[sourceKey][0] || "",
            EnableMediaSourceDisplay: true,
            ChannelId: null,
            Taglines: [],
            Genres: [],
            PlayAccess: "Full",
            RemoteTrailers: [],
            ProviderIds: {},
            IsFolder: true,
            ParentId: null,
            Type: "CollectionFolder",
            CollectionType: collectionType,
            People: [],
            Studios: [],
            GenreItems: [],
            LocalTrailerCount: 0,
            UserData: {
                PlaybackPositionTicks: 0,
                PlayCount: 0,
                IsFavorite: false,
                Played: false,
                Key: addDashesToUuid(itemId),
                ItemId: itemId,
            },
            ChildCount: childCount,
            SpecialFeatureCount: 0,
            DisplayPreferencesId: itemId,
            Tags: [],
            PrimaryImageAspectRatio: 1.7777777777777777,
            ImageTags: {},
            BackdropImageTags: [],
            ImageBlurHashes: {},
            LocationType: "FileSystem",
            MediaType: "Unknown",
            LockedFields: [],
            LockData: false,
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
        telerising.killProcess();
        setTimeout(() => process.exit(1), 500);
    });

    app.post("/System/Shutdown", (req, res) => {
        if (!req.user || req.user.perms < 2) {
            return res.status(403).json({ error: "Admin permissions required." });
        }
        res.status(200).json({ message: "Shutting down..." });
        console.log(`System shutdown initiated by ${req.user.name}`);
        telerising.killProcess();
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
        const LIB_IDS = {
            movies: generateItemId("movies"),
            tvshows: generateItemId("tvshows"),
            music: generateItemId("music"),
            livetv: generateItemId("livetv"),
        };

        const index = globalThis.__mediaIndex || { shows: [], movies: [], music: [] };

        function randomImageTag(entries, imageType) {
            if (!entries || entries.length === 0) return null;
            var shuffled = [].concat(entries).sort(function () { return Math.random() - 0.5; });
            for (var i = 0; i < shuffled.length && i < 20; i++) {
                var fp = shuffled[i].filePath || shuffled[i].showName;
                if (!fp) continue;
                var dir = fp.substring(0, fp.lastIndexOf("/"));
                var img = findImageInDir(dir, imageType) || findImageInDir(dir + "/..", imageType) || findPosterPath(fp);
                if (img) return img.tag;
            }
            return null;
        }

        function randomBackdropTag(entries) {
            if (!entries || entries.length === 0) return null;
            var shuffled = [].concat(entries).sort(function () { return Math.random() - 0.5; });
            for (var i = 0; i < shuffled.length && i < 20; i++) {
                var fp = shuffled[i].filePath || shuffled[i].showName;
                if (!fp) continue;
                var dir = fp.substring(0, fp.lastIndexOf("/"));
                var parentDir = dir + "/..";
                var img = findImageInDir(dir, "Backdrop") || findImageInDir(parentDir, "Backdrop");
                if (img) return img.tag;
            }
            return null;
        }

        var showNames = [];
        var seen = {};
        for (var s = 0; s < (index.shows || []).length; s++) {
            var sn = index.shows[s].showName;
            if (sn && !seen[sn]) { seen[sn] = true; showNames.push(index.shows[s]); }
        }

        var movieTag = randomImageTag(index.movies, "Primary");
        var movieBackdrop = randomBackdropTag(index.movies);
        var showTag = randomImageTag(showNames, "Primary");
        var showBackdrop = randomBackdropTag(showNames);
        var musicTag = randomImageTag(index.music, "Primary");

        function makeUserView(name, collectionType, id, path, imgTag, bdTag) {
            var item = {
                Name: name, CollectionType: collectionType, Id: id, IsFolder: true,
                Type: "CollectionFolder", ServerId: getSystemInfo(getDb())?.id || "hmss-local",
                SortName: collectionType, Path: path, ChannelId: null,
                DateCreated: new Date().toISOString(), CanDelete: false, CanDownload: false,
                ExternalUrls: [], EnableMediaSourceDisplay: true, PlayAccess: "Full",
                Taglines: [], Genres: [], RemoteTrailers: [], ProviderIds: {},
                People: [], Studios: [], GenreItems: [], LocalTrailerCount: 0,
                SpecialFeatureCount: 0, DisplayPreferencesId: id, Tags: [],
                PrimaryImageAspectRatio: 1.7777777777777777,
                ImageTags: imgTag ? { Primary: imgTag } : {},
                BackdropImageTags: bdTag ? [bdTag] : [],
                ImageBlurHashes: {},
                LocationType: "FileSystem", MediaType: "Unknown",
                LockedFields: [], LockData: false,
                UserData: { PlaybackPositionTicks: 0, PlayCount: 0, IsFavorite: false, Played: false, Key: addDashesToUuid(id), ItemId: id }
            };
            return item;
        }

        var items = [
            makeUserView("Movies", "movies", LIB_IDS.movies, "media/movie", movieTag, movieBackdrop),
            makeUserView("Shows", "tvshows", LIB_IDS.tvshows, "media/shows", showTag, showBackdrop),
            makeUserView("Music", "music", LIB_IDS.music, "media/music", musicTag, null),
        ];

        const db = getDb();
        const ltConfig = (() => { try { return JSON.parse((getSystemInfo(db)?.config_json || "{}")).livetv; } catch { return null; } })();
        if (ltConfig?.TunerHosts?.length > 0) {
            items.push(makeUserView("Live TV", "livetv", LIB_IDS.livetv, "", null, null));
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
        const rawParentId = req.query.parentId || req.query.ParentId;
        const parentId = resolveParentId(rawParentId);
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
        const rawParentId = req.query.parentId || req.query.ParentId;
        const parentId = resolveParentId(rawParentId);
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

        const idsParam = req.query.Ids || req.query.ids;
        if (idsParam) {
            const ids = idsParam.split(",").map(s => s.replace(/-/g, "").trim());
            const index = globalThis.__mediaIndex || { shows: [], movies: [], music: [], unsorted: [] };
            const sys = getSystemInfo(getDb());
            const serverId = sys?.id || "hmss-local";
            const items = [];
            for (const rawId of ids) {
                let item = null;
                for (const ep of index.shows || []) {
                    if (generateItemId(ep.id || ep.filePath) === rawId) {
                        item = mapToJellyfinItem({ id: ep.id, title: ep.title, showName: ep.showName, season: ep.season, episode: ep.episode, year: ep.year, filePath: ep.filePath, overview: ep.overview, duration: ep.duration, genres: ep.genres }, "show", serverId);
                        break;
                    }
                    if (generateItemId(ep.showName) === rawId) {
                        item = makeShowFolder(ep, serverId);
                        break;
                    }
                    const seasonId = generateItemId(`${ep.showName}-s${ep.season}`);
                    if (seasonId === rawId) {
                        item = makeSeasonFolder(ep, serverId);
                        break;
                    }
                }
                if (!item) for (const m of index.movies || []) {
                    if (generateItemId(m.id || m.filePath) === rawId) {
                        item = mapToJellyfinItem({ id: m.id, title: m.title, genre: m.group ? [m.group] : [], year: m.year, filePath: m.filePath, overview: m.overview, duration: m.duration, genres: m.genres }, "movie", serverId);
                        break;
                    }
                }
                if (!item) for (const m of index.music || []) {
                    if (generateItemId(m.id || m.filePath) === rawId) {
                        item = mapToJellyfinItem({ id: m.id, title: m.title, artist: m.artist, album: m.album, filePath: m.filePath }, "music", serverId);
                        break;
                    }
                }
                if (!item) for (const u of index.unsorted || []) {
                    if (generateItemId(u.id || u.filePath) === rawId) {
                        item = mapToJellyfinItem({ id: u.id, title: u.title, filePath: u.filePath }, "unsorted", serverId);
                        break;
                    }
                }
                if (item) items.push(item);
            }
            const filters = (req.query.Filters || "").split(",");
            const filtered = filters.includes("IsNotFolder") ? items.filter(i => !i.IsFolder) : items;
            return res.json({ Items: filtered, TotalRecordCount: filtered.length, StartIndex: 0 });
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
        // check if it's a LiveTV programme (EPG)
        if (!found) {
            try {
                var epgConfig = getLiveTvConfig(db);
                var epgProvider = (epgConfig.ListingProviders || [])[0];
                if (epgProvider) {
                    var epgProgrammes = await _fetchEpgProgrammes(epgConfig, epgProvider.Id);
                    for (var pi = 0; pi < epgProgrammes.length; pi++) {
                        var p = epgProgrammes[pi];
                        var pName = p.title || "Unknown";
                        var pId = generateItemId(pName + p.channel + p.start);
                        if (pId === rawId) { found = p; itemType = "Program"; break; }
                    }
                }
            } catch (_) {}
        }
        if (found && itemType === "Program") {
            var p = found;
            var tvChannels = await getLiveTvChannels(db);
            var tunerByTvgId = {}, tunerByChId = {};
            for (var ci = 0; ci < tvChannels.length; ci++) {
                if (tvChannels[ci].TvgId) tunerByTvgId[tvChannels[ci].TvgId] = tvChannels[ci];
                tunerByChId[tvChannels[ci].Id] = tvChannels[ci];
            }
            var chId = null;
            (epgConfig.ChannelMappings || []).forEach(function (m) {
                if (m.ProviderId === epgProvider.Id && m.ProviderChannelId === p.channel) chId = m.TunerChannelId;
            });
            if (!chId && tunerByTvgId[p.channel]) chId = tunerByTvgId[p.channel].Id;
            var ch = chId ? tunerByChId[chId] : null;
            var startDate = _parseXmltvDate(p.start);
            var endDate = _parseXmltvDate(p.stop);
            var pName = p.title || "Unknown";
            var progId = generateItemId(pName + p.channel + p.start);
            var userDataKey = "Program-" + pName + (p.subtitle || "");
            var item = {
                Name: pName, ServerId: serverId, Id: progId,
                Etag: progId, DateCreated: startDate,
                CanDelete: false, CanDownload: false,
                SortName: pName.toLowerCase().replace(/\s+/g, ""),
                ExternalUrls: [], EnableMediaSourceDisplay: true,
                ChannelId: chId || "", ChannelName: ch ? ch.Name : "",
                Overview: p.subtitle || "",
                Taglines: [], Genres: p.category ? [p.category] : [],
                RunTimeTicks: _xmltvTicks(p.start, p.stop),
                PlayAccess: "Full", ProductionYear: p.date ? parseInt(p.date) : null,
                ChannelNumber: ch ? ch.Number : "",
                RemoteTrailers: [], ProviderIds: {},
                ParentId: chId || "",
                Type: "Program", People: [], Studios: [],
                GenreItems: p.category ? [{ Name: p.category, Id: generateItemId(p.category) }] : [],
                LocalTrailerCount: 0,
                UserData: { PlaybackPositionTicks: 0, PlayCount: 0, IsFavorite: false, Played: false, Key: userDataKey, ItemId: progId },
                SpecialFeatureCount: 0,
                DisplayPreferencesId: "8cab5e5f60ae4830c47f6431bbe4c3cb",
                Tags: ["Series"],
                ImageTags: {}, BackdropImageTags: [], ImageBlurHashes: {},
                MediaType: "Video",
                EndDate: endDate, LockedFields: [], LockData: false,
                StartDate: startDate,
                IsSeries: true,
                EpisodeTitle: p.subtitle || "",
            };
            if (p.date) { var year = parseInt(p.date); if (!isNaN(year) && year > 1900 && year < 2100) item.ProductionYear = year; }
            if (ch && ch.LogoUrl) { item.ImageTags.Primary = ch.Id; item.PrimaryImageAspectRatio = 1.333; item.ChannelPrimaryImageTag = ch.Id; }
            return res.json(item);
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
        // check if it's a library folder ID
        const LIBRARY_MAP = {
            [generateItemId("tvshows")]: { Name: "TV Shows", Type: "CollectionFolder", CollectionType: "tvshows", Path: "media/shows" },
            [generateItemId("movies")]: { Name: "Movies", Type: "CollectionFolder", CollectionType: "movies", Path: "media/movie" },
            [generateItemId("music")]: { Name: "Music", Type: "CollectionFolder", CollectionType: "music", Path: "media/music" },
            [generateItemId("unsorted")]: { Name: "Unsorted", Type: "CollectionFolder", CollectionType: "mixed", Path: "media/unsorted" },
        };
        if (LIBRARY_MAP[rawId]) {
            const lib = LIBRARY_MAP[rawId];
            const childCount = lib.CollectionType === "tvshows"
                ? [...new Set((index.shows || []).map(s => s.showName))].length
                : lib.CollectionType === "movies" ? (index.movies || []).length
                : lib.CollectionType === "music" ? (index.music || []).length
                : 0;
            return res.json({
                Name: lib.Name,
                ServerId: serverId,
                Id: rawId,
                Etag: rawId,
                DateCreated: new Date().toISOString(),
                DateLastMediaAdded: "0001-01-01T00:00:00.0000000Z",
                CanDelete: false,
                CanDownload: false,
                SortName: lib.Name.toLowerCase(),
                ExternalUrls: [],
                Path: lib.Path,
                EnableMediaSourceDisplay: true,
                ChannelId: null,
                Taglines: [],
                Genres: [],
                PlayAccess: "Full",
                RemoteTrailers: [],
                ProviderIds: {},
                IsFolder: true,
                ParentId: null,
                Type: "CollectionFolder",
                CollectionType: lib.CollectionType,
                People: [],
                Studios: [],
                GenreItems: [],
                LocalTrailerCount: 0,
                UserData: { PlaybackPositionTicks: 0, PlayCount: 0, IsFavorite: false, Played: false, Key: addDashesToUuid(rawId), ItemId: rawId },
                ChildCount: childCount,
                SpecialFeatureCount: 0,
                DisplayPreferencesId: rawId,
                Tags: [],
                PrimaryImageAspectRatio: 1.7777777777777777,
                ImageTags: {},
                BackdropImageTags: [],
                ImageBlurHashes: {},
                LocationType: "FileSystem",
                MediaType: "Unknown",
                LockedFields: [],
                LockData: false,
            });
        }
        if (!found) return res.status(404).json({ error: "Item not found." });

        let probe = null;
        if (itemPath && (itemPath.endsWith(".mp4") || itemPath.endsWith(".mkv") || itemPath.endsWith(".m4a") || itemPath.endsWith(".mp3"))) {
            try { probe = await probeMedia(itemPath); } catch { }
        }

        const id = itemType === "Series" ? generateItemId(found.showName) : generateItemId(found.id || found.filePath);
        if (itemType === "Season") {
            const showId = generateItemId(found.showName);
            for (const ep2 of index.shows || []) {
                if (generateItemId(ep2.showName) === showId) {
                    itemType = "Series";
                    found = ep2;
                    itemPath = null;
                    break;
                }
            }
        }
        if (itemType === "Series") {
            return res.json(makeShowFolder(found, serverId));
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
            TranscodingUrl: `/Videos/${id}/hls/master.m3u8`,
            HlsUrl: `/Videos/${id}/hls/master.m3u8`,
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

        let imageTags = poster ? { Primary: poster.tag } : {};
        let backdropImageTags = [];
        let logoTag = null;

        if (itemType === "Series") {
            const showDir = `media/shows/${found.showName}`;
            const primaryImg = findImageInDir(showDir, "Primary");
            if (primaryImg) imageTags = { Primary: primaryImg.tag };
            const backdropImg = findImageInDir(showDir, "Backdrop");
            if (backdropImg) backdropImageTags = [backdropImg.tag];
            const logoImg = findImageInDir(showDir, "Logo");
            if (logoImg) { logoTag = logoImg.tag; imageTags.Logo = logoTag; }
        }

        const resp = {
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
            ImageTags: imageTags,
            BackdropImageTags: backdropImageTags,
            ImageBlurHashes: poster ? { Primary: {} } : {},
            LocationType: "FileSystem",
            MediaType: (isMovie || isEpisode || itemType === "Video") ? "Video" : "Audio",
            VideoType: (isMovie || isEpisode || itemType === "Video") ? "VideoFile" : undefined,
            PrimaryImageAspectRatio: probe?.width && probe?.height ? probe.width / probe.height : 0,
        };
        res.json(resp);
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

export async function jellyfinRoutes(app, getDb, apiVersion, mediaDirs, port = {}) {

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

        globalThis.__activeDirectPlayStreams = (globalThis.__activeDirectPlayStreams || 0) + 1;
        res.on("close", () => { globalThis.__activeDirectPlayStreams--; });

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
    app.get('/Channels', async (req, res) => {
        if (!req.user) return res.status(401).end();
        const db = getDb();
        const allChannels = await getLiveTvChannels(db);
        const sys = getSystemInfo(db);
        const serverId = sys?.id || "hmss-local";
        const items = allChannels.map(ch => ({
            Name: ch.Name,
            ServerId: serverId,
            Id: ch.Id,
            DateCreated: new Date().toISOString(),
            CanDelete: false,
            CanDownload: false,
            SortName: ch.SortName,
            ExternalUrls: [],
            Path: "",
            ChannelId: null,
            IsFolder: false,
            Type: "TvChannel",
            UserData: ch.UserData,
            ImageTags: ch.ImageTags,
            BackdropImageTags: [],
            ImageBlurHashes: {},
            LocationType: "Remote",
            MediaType: "Video",
        }));
        const limit = parseInt(req.query.Limit) || items.length;
        const start = parseInt(req.query.StartIndex) || 0;
        res.json({ Items: items.slice(start, start + limit), TotalRecordCount: items.length, StartIndex: start });
    });
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
    app.get('/Users/:itemId/Items/:itemId/Intros', (req, res) => { /* GetIntros */ res.status(200).json({ "Items": [], "TotalRecordCount": 0, "StartIndex": 0 }); });
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
    app.get('/Items/:itemId/ThemeMedia', (req, res) => {
        const ownerId = (req.params.itemId || "").replace(/-/g, "");
        res.json({
            ThemeVideosResult: { OwnerId: ownerId, Items: [], TotalRecordCount: 0, StartIndex: 0 },
            ThemeSongsResult: { OwnerId: ownerId, Items: [], TotalRecordCount: 0, StartIndex: 0 },
            SoundtrackSongsResult: { OwnerId: "00000000000000000000000000000000", Items: [], TotalRecordCount: 0, StartIndex: 0 },
        });
    });
    app.get('/Items/:itemId/ThemeSongs', (req, res) => { /* GetThemeSongs */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/Items/:itemId/ThemeVideos', (req, res) => { /* GetThemeVideos */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/Libraries/AvailableOptions', (req, res) => { /* GetLibraryOptionsInfo */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/Library/Media/Updated', (req, res) => { /* PostUpdatedMedia */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/Library/MediaFolders', (req, res) => {
        if (!req.user) return res.status(401).end();
        const isHidden = req.query.isHidden === "true";
        const items = [];
        for (const [key, paths] of Object.entries(mediaDirs)) {
            for (const p of paths) {
                const id = generateItemId(key);
                const ct = key === "movie" ? "movies" : key === "shows" ? "tvshows" : key === "music" ? "music" : "mixed";
                items.push({
                    Name: key.charAt(0).toUpperCase() + key.slice(1),
                    ServerId: getSystemInfo(getDb())?.id || "hmss-local",
                    Id: id,
                    Etag: id,
                    DateCreated: new Date().toISOString(),
                    DateLastMediaAdded: "0001-01-01T00:00:00.0000000Z",
                    CanDelete: false,
                    CanDownload: false,
                    SortName: key.toLowerCase(),
                    ExternalUrls: [],
                    Path: p,
                    EnableMediaSourceDisplay: true,
                    ChannelId: null,
                    Taglines: [],
                    Genres: [],
                    PlayAccess: "Full",
                    RemoteTrailers: [],
                    ProviderIds: {},
                    IsFolder: true,
                    ParentId: null,
                    Type: "CollectionFolder",
                    CollectionType: ct,
                    People: [],
                    Studios: [],
                    GenreItems: [],
                    LocalTrailerCount: 0,
                    UserData: { PlaybackPositionTicks: 0, PlayCount: 0, IsFavorite: false, Played: false, Key: addDashesToUuid(id), ItemId: id },
                    SpecialFeatureCount: 0,
                    DisplayPreferencesId: id,
                    Tags: [],
                    PrimaryImageAspectRatio: 1.7777777777777777,
                    ImageTags: {},
                    BackdropImageTags: [],
                    ImageBlurHashes: {},
                    LocationType: "FileSystem",
                    MediaType: "Unknown",
                    LockedFields: [],
                    LockData: false,
                });
            }
        }
        res.json({ Items: items, TotalRecordCount: items.length, StartIndex: 0 });
    });
    app.post('/Library/Movies/Added', (req, res) => { /* PostAddedMovies */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/Library/Movies/Updated', (req, res) => { /* PostUpdatedMovies */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/Library/PhysicalPaths', (req, res) => { /* GetPhysicalPaths */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/Library/Refresh', (req, res) => { /* RefreshLibrary */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/Library/Series/Added', (req, res) => { /* PostAddedSeries */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/Library/Series/Updated', (req, res) => { /* PostUpdatedSeries */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/Movies/:itemId/Similar', (req, res) => { res.json({ Items: [], TotalRecordCount: 0, StartIndex: 0 }); });
    app.get('/Shows/:itemId/Similar', (req, res) => { res.json({ Items: [], TotalRecordCount: 0, StartIndex: 0 }); });
    app.get('/Trailers/:itemId/Similar', (req, res) => { res.json({ Items: [], TotalRecordCount: 0, StartIndex: 0 }); });
    app.get('/UserItems/Resume', async (req, res) => {
        if (!req.user) return res.status(200).json({ Items: [], TotalRecordCount: 0, StartIndex: 0 });
        const db = getDb();
        const sys = getSystemInfo(db);
        const serverId = sys?.id || "hmss-local";
        const userId = req.user.id;
        const limit = parseInt(req.query.Limit || req.query.limit) || 12;
        const includeItemTypes = (req.query.IncludeItemTypes || req.query.includeItemTypes || "Episode,Movie").split(",").map(t => t.trim());
        const rows = getResumableItems(db, userId, "Video", limit * 3);
        const index = globalThis.__mediaIndex || { shows: [], movies: [], music: [], unsorted: [] };
        const items = [];
        for (const row of rows) {
            if (items.length >= limit) break;
            let match = null;
            let entryType = null;
            let jellyfinType = null;
            for (const m of index.movies || []) {
                if (generateItemId(m.id || m.filePath) === row.item_id) { match = m; entryType = "movie"; jellyfinType = "Movie"; break; }
            }
            if (!match) {
                for (const ep of index.shows || []) {
                    if (generateItemId(ep.id || ep.filePath) === row.item_id) { match = ep; entryType = "show"; jellyfinType = "Episode"; break; }
                }
            }
            if (!match || !includeItemTypes.includes(jellyfinType)) continue;
            const item = mapToJellyfinItem({
                id: match.id, title: match.title, showName: match.showName,
                season: match.season, episode: match.episode, year: match.year,
                filePath: match.filePath, overview: match.overview,
                duration: match.duration, genres: match.genres,
            }, entryType, serverId);
            item.UserData = {
                PlaybackPositionTicks: row.playback_position_ticks,
                PlayCount: row.play_count,
                IsFavorite: Boolean(row.is_favorite),
                Played: Boolean(row.played),
                LastPlayedDate: row.last_played_date || undefined,
                Key: item.UserData.Key,
                ItemId: item.Id,
            };
            items.push(item);
        }
        res.json({ Items: items, TotalRecordCount: items.length, StartIndex: 0 });
    });

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
        try { stored = JSON.parse(sys?.config_json || "{}"); } catch { }
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
            ChannelMappings: [],
        };
    }

    function setLiveTvConfig(db, config) {
        const sys = getSystemInfo(db);
        let stored = {};
        try { stored = JSON.parse(sys?.config_json || "{}"); } catch { }
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
                        TvgId: ch.tvgId || "",
                        SortName: ch.name.toLowerCase(),
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
            } catch { }
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
                res.on("end", () => {
                    if (telerising.isTelerisingUnavailable(body)) {
                        const m = url.match(/\/api\/([^/]+)\//);
                        if (m) {
                            console.log(`[Telerising] fetchM3U session expired for '${m[1]}' — refreshing...`);
                            telerising.refreshSession(m[1]);
                        }
                    }
                    resolve(body);
                });
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

    function _extractChannelsFallback(text) {
        var channels = [];
        var re = /<channel\s+id=(["'])([^"']*?)\1[\s\S]*?<\/channel\s*>/gi;
        var dnRe = /<display-name[^>]*>([^<]*)<\//gi;
        var match;
        while ((match = re.exec(text)) !== null) {
            var chId = match[2];
            var dnMatch = dnRe.exec(match[0]);
            dnRe.lastIndex = 0;
            var name = dnMatch ? dnMatch[1].trim() : chId;
            channels.push({ Name: name, Id: chId });
        }
        return channels;
    }

    async function _fetchProviderChannels(config, providerId) {
        var provider = config.ListingProviders.find(function (p) { return p.Id === providerId; });
        if (!provider || !provider.Path) return [];
        try {
            var raw = await _fetchFeed(provider.Path);
            if (!raw) return [];
            var text = raw.toString("utf-8");
            text = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\uFFFE\uFFFF]/g, "");
            var firstLt = text.indexOf("<");
            if (firstLt > 0) text = text.substring(firstLt);
            text = text.replace(/<\?xml[\s\S]*?\?>/g, "").replace(/<!DOCTYPE[\s\S]*?>/g, "").trim();
            if (text.charAt(0) !== "<") return [];
            var channels = [];
            try {
                var { SaxesParser } = await import("saxes");
                var parser = new SaxesParser({ lowercase: true });
                var currentChannel = null;
                parser.on("opentag", function (node) {
                    if (node.name === "channel") {
                        currentChannel = { Id: node.attributes.id || "", Name: "" };
                    } else if (currentChannel && node.name === "display-name" && !currentChannel.Name) {
                        currentChannel._capture = true;
                    }
                });
                parser.on("text", function (txt) {
                    if (currentChannel && currentChannel._capture) currentChannel.Name += txt;
                });
                parser.on("cdata", function (txt) {
                    if (currentChannel && currentChannel._capture) currentChannel.Name += txt;
                });
                parser.on("closetag", function (node) {
                    var n = node.name;
                    if (n === "display-name" && currentChannel) {
                        currentChannel._capture = false;
                        if (currentChannel.Name) currentChannel.Name = currentChannel.Name.trim();
                    } else if (n === "channel" && currentChannel) {
                        if (!currentChannel.Name) currentChannel.Name = currentChannel.Id;
                        channels.push(currentChannel);
                        currentChannel = null;
                    }
                });
                parser.write(text).close();
            } catch (e) {
                console.error("saxes error, falling back to regex:", e.message);
            }
            if (channels.length === 0) channels = _extractChannelsFallback(text);
            return channels;
        } catch (e) {
            console.error("XMLTV fetch error:", e);
            return [];
        }
    }

    function _buildCountryNames() {
        var names = [];
        try {
            var countries = JSON.parse(readFileSync(new URL('./countries.json', import.meta.url), 'utf-8'));
            countries.forEach(function(c) {
                if (c.DisplayName) names.push(c.DisplayName.toLowerCase());
            });
        } catch (e) {}

        //Fallback - sorry, but we cant do all the countries, so we will just add some common ones
        // German country names commonly used in channel names
        names.push('deutschland', 'österreich', 'schweiz', 'frankreich', 'italien', 'spanien', 'niederlande', 'großbritannien', 'uk', 'usa');
        return names;
    }
    var _countryNames = _buildCountryNames();

    app.get('/LiveTv/ChannelMappingOptions', async (req, res) => {
        if (!req.user) return res.status(401).end();
        const db = getDb();
        const config = getLiveTvConfig(db);
        const providerId = req.query.providerId || "";

        const tvChannels = await getLiveTvChannels(db);
        const tunerChannels = tvChannels.map(function (ch) {
            return {
                Id: ch.Id,
                Name: ch.Name,
                Number: ch.Number,
                ProviderChannelName: "",
                ProviderChannelId: "",
            };
        });

        var providerChannels = [];
        var providerName = "";
        var provider = config.ListingProviders.find(function (p) { return p.Id === providerId; });
        if (provider && provider.Path) {
            providerName = provider.Type || "xmltv";
            providerChannels = await _fetchProviderChannels(config, providerId);
        }

        var mappings = (config.ChannelMappings || []).filter(function (m) { return m.ProviderId === providerId; }).map(function (m) {
            return { Name: m.TunerChannelId, Value: m.ProviderChannelId };
        });

        if (mappings.length === 0 && providerChannels.length > 0 && tunerChannels.length > 0) {
            var pMap = {};
            var countryPrefixRe = /^([a-z]{2})\s*-\s+/;
            providerChannels.forEach(function (pc) {
                var key = pc.Name.toLowerCase().replace(/hd\b/gi, "").replace(/\s+/g, " ").trim();
                if (!pMap[key]) pMap[key] = [];
                pMap[key].push(pc);
                var tldMatch = pc.Name.match(/\.[a-z]{2,}$/i);
                if (tldMatch) {
                    var keyNoTld = key.replace(/\.[a-z]{2,}$/i, "").trim();
                    if (keyNoTld && keyNoTld !== key) {
                        if (!pMap[keyNoTld]) pMap[keyNoTld] = [];
                        pMap[keyNoTld].push(pc);
                    }
                }
                var prefixMatch = key.match(countryPrefixRe);
                if (prefixMatch) {
                    var keyNoPrefix = key.replace(countryPrefixRe, "").trim();
                    if (keyNoPrefix && keyNoPrefix !== key) {
                        if (!pMap[keyNoPrefix]) pMap[keyNoPrefix] = [];
                        pMap[keyNoPrefix].push(pc);
                    }
                }
            });

            mappings = tunerChannels.map(function (tc) {
                var key = tc.Name.toLowerCase().replace(/hd\b/gi, "").replace(/\s+/g, " ").trim();
                var matches = pMap[key] || [];
                if (matches.length >= 1) {
                    return { Name: tc.Id, Value: matches[0].Id };
                }
                for (var si = 0; si < _countryNames.length; si++) {
                    var suffix = _countryNames[si];
                    if (key.length > suffix.length && key.indexOf(suffix, key.length - suffix.length) !== -1) {
                        var keyStripped = key.substring(0, key.length - suffix.length).trim();
                        if (keyStripped) {
                            matches = pMap[keyStripped] || [];
                            if (matches.length >= 1) {
                                return { Name: tc.Id, Value: matches[0].Id };
                            }
                        }
                    }
                }
                return null;
            }).filter(Boolean);
        }

        var pLookup = {};
        providerChannels.forEach(function (pc) { pLookup[pc.Id] = pc; });
        tunerChannels.forEach(function (tc) {
            var match = mappings.find(function (m) { return m.Name === tc.Id; });
            if (match && pLookup[match.Value]) {
                tc.ProviderChannelName = pLookup[match.Value].Name;
                tc.ProviderChannelId = match.Value;
            }
        });

        res.json({
            TunerChannels: tunerChannels,
            ProviderChannels: providerChannels,
            Mappings: mappings,
            ProviderName: providerName,
        });
    });

    app.post('/LiveTv/ChannelMappings', async (req, res) => {
        if (!req.user) return res.status(401).end();
        const db = getDb();
        const config = getLiveTvConfig(db);
        const body = req.body || {};

        var pId = body.ProviderId || body.providerId;
        var tId = body.TunerChannelId || body.tunerChannelId;
        var pcId = body.ProviderChannelId || body.providerChannelId;

        if (!pId || !tId || !pcId) {
            return res.status(400).json({ error: "ProviderId, TunerChannelId and ProviderChannelId required." });
        }

        var channelMappings = config.ChannelMappings || [];
        var existingIdx = channelMappings.findIndex(function (m) {
            return m.ProviderId === pId && m.TunerChannelId === tId;
        });

        var mapping = {
            ProviderId: pId,
            TunerChannelId: tId,
            ProviderChannelId: pcId,
        };

        if (existingIdx >= 0) {
            channelMappings[existingIdx] = mapping;
        } else {
            channelMappings.push(mapping);
        }
        config.ChannelMappings = channelMappings;
        setLiveTvConfig(db, config);

        var tvChannels = await getLiveTvChannels(db);
        var ch = tvChannels.find(function (c) { return c.Id === tId; });
        var pChannels = await _fetchProviderChannels(config, pId);
        var pCh = pChannels.find(function (c) { return c.Id === pcId; });
        res.json({
            Id: tId,
            Name: ch ? ch.Name : "",
            ProviderChannelName: pCh ? pCh.Name : "",
            ProviderChannelId: pcId,
        });
    });

    app.get('/LiveTv/ListingProviders', (req, res) => {
        if (!req.user) return res.status(401).end();
        const db = getDb();
        const config = getLiveTvConfig(db);
        res.json(config.ListingProviders || []);
    });

    app.get('/LiveTv/ListingProviders/:providerId/Xml', async (req, res) => {
        // is public endpoint, no auth check
        const db = getDb();
        const config = getLiveTvConfig(db);
        const provider = config.ListingProviders.find(p => p.Id === req.params.providerId);
        if (!provider || !provider.Path) return res.status(404).json({ error: "Provider or path not found." });
        try {
            var xml = await _fetchFeed(provider.Path);
            if (!xml) return res.status(502).json({ error: "Failed to fetch XMLTV feed." });
            res.set("Content-Type", "application/xml");
            res.send(xml);
        } catch (e) {
            res.status(502).json({ error: "XMLTV fetch error: " + e.message });
        }
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
        const db = getDb();
        const config = getLiveTvConfig(db);
        const body = req.body || {};

        if (!body.Type) return res.status(400).json({ error: "Type required." });

        const provider = {
            Type: body.Type,
            Path: body.Path || "",
            MoviePrefix: body.MoviePrefix || null,
            UserAgent: body.UserAgent || null,
            MovieCategories: body.MovieCategories || [],
            KidsCategories: body.KidsCategories || [],
            NewsCategories: body.NewsCategories || [],
            SportsCategories: body.SportsCategories || [],
            EnableAllTuners: body.EnableAllTuners !== false,
            EnabledTuners: body.EnabledTuners || [],
            Id: body.Id || generateItemId(body.Path + Date.now()),
        };

        const existingIdx = config.ListingProviders.findIndex(p => p.Id === provider.Id);
        if (existingIdx >= 0) {
            config.ListingProviders[existingIdx] = provider;
        } else {
            config.ListingProviders.push(provider);
        }

        setLiveTvConfig(db, config);
        res.json(provider);
    });

    app.delete('/LiveTv/ListingProviders', (req, res) => {
        if (!req.user) return res.status(401).end();
        const db = getDb();
        const config = getLiveTvConfig(db);
        const id = req.query.id || req.body?.id;
        if (!id) return res.status(400).json({ error: "Id required." });
        config.ListingProviders = config.ListingProviders.filter(p => p.Id !== id);
        setLiveTvConfig(db, config);
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
        const id = req.query.id || req.body?.id;

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

    function m3uReachable(url) {
        return new Promise((resolve) => {
            const req = http.get(url, { timeout: 5000 }, (res) => {
                resolve(res.statusCode === 200);
                res.resume();
            });
            req.on("error", () => resolve(false));
            req.setTimeout(5000, () => { req.destroy(); resolve(false); });
        });
    }

    app.get('/LiveTv/Tuners/Discover', async (req, res) => { /* Add auto discover of Telerising */
        if (!req.user) return res.status(401).end();
        const accounts = telerising.listActiveProvider();
        const localIp = telerising.getLocalIp();
        const entries = [];
        if (accounts && typeof accounts === 'object') {
            for (const [provider] of Object.entries(accounts)) {
                const chUrl = `http://${localIp}:${telerising.telerisingPort}/api/${provider}/file/channels.m3u`;
                const recUrl = `http://${localIp}:${telerising.telerisingPort}/api/${provider}/file/recordings.m3u`;

                const [chOk, recOk] = await Promise.all([m3uReachable(chUrl), m3uReachable(recUrl)]);

                if (chOk) {
                    entries.push({
                        "Id": provider,
                        "Url": chUrl,
                        "Type": "m3u",
                        "DeviceId": "",
                        "FriendlyName": "Telerising " + provider,
                        "ImportFavoritesOnly": false,
                        "AllowHWTranscoding": false,
                        "AllowFmp4TranscodingContainer": false,
                        "AllowStreamSharing": false,
                        "FallbackMaxStreamingBitrate": 0,
                        "EnableStreamLooping": false,
                        "Source": "Telerising",
                        "TunerCount": 0,
                        "UserAgent": "",
                        "IgnoreDts": true,
                        "ReadAtNativeFramerate": true
                    });
                }
                if (recOk) {
                    entries.push({
                        "Id": provider + "_recordings",
                        "Url": recUrl,
                        "Type": "m3u",
                        "DeviceId": "",
                        "FriendlyName": "Telerising " + provider + " Recordings",
                        "ImportFavoritesOnly": false,
                        "AllowHWTranscoding": false,
                        "AllowFmp4TranscodingContainer": false,
                        "AllowStreamSharing": false,
                        "FallbackMaxStreamingBitrate": 0,
                        "EnableStreamLooping": false,
                        "Source": "Telerising",
                        "TunerCount": 0,
                        "UserAgent": "",
                        "IgnoreDts": true,
                        "ReadAtNativeFramerate": true
                    });
                }
            }
        }
        res.json(entries);
    });

    app.get('/LiveTv/Programs', async (req, res) => {
        if (!req.user) return res.status(401).end();
        const db = getDb();
        const config = getLiveTvConfig(db);
        var provider = (config.ListingProviders || [])[0];
        if (!provider) return res.json({ Items: [], TotalRecordCount: 0, StartIndex: 0 });
        var requestedIds = (req.query.ChannelIds || req.query.channelIds || "").split(",").filter(Boolean);
        var maxStart = req.query.MaxStartDate ? new Date(req.query.MaxStartDate).getTime() : Infinity;
        var minEnd = req.query.MinEndDate ? new Date(req.query.MinEndDate).getTime() : 0;
        var tvChannels = await getLiveTvChannels(db);
        var items = await _queryEpg(config, provider, requestedIds, maxStart, minEnd, tvChannels);
        var limit = parseInt(req.query.Limit || req.query.limit) || 0;
        res.json({ Items: limit > 0 ? items.slice(0, limit) : items, TotalRecordCount: items.length, StartIndex: 0 });
    });

let _epgCache = { programmes: [], ts: 0, providerId: "" };

function _nextPk(buf, start) {
    for (var i = start; i < buf.length - 4; i++) {
        if (buf[i] === 0x50 && buf[i+1] === 0x4b) {
            var tag = buf[i+2] << 8 | buf[i+3];
            if (tag === 0x0304 || tag === 0x0102 || tag === 0x0506) return i;
        }
    }
    return -1;
}

function _parseZipEntry(buf) {
    if (buf.length < 30) return null;
    var sig = buf.readUInt32LE(0);
    if (sig !== 0x04034b50) return null;
    var flags = buf.readUInt16LE(6);
    var method = buf.readUInt16LE(8);
    var hasDataDesc = !!(flags & 8);
    var compSize = buf.readUInt32LE(18);
    var uncompSize = buf.readUInt32LE(22);
    var fnameLen = buf.readUInt16LE(26);
    var extraLen = buf.readUInt16LE(28);
    var hdrSize = 30 + fnameLen + extraLen;
    var fileName = buf.slice(30, 30 + fnameLen).toString("utf-8").replace(/\\/g, "/").split("/").filter(Boolean).pop() || "";
    var dataStart = hdrSize, dataEnd;
    if (!hasDataDesc && compSize > 0) {
        dataEnd = dataStart + compSize;
    } else {
        var next = _nextPk(buf, hdrSize + 2);
        dataEnd = next > 0 ? next : buf.length;
    }
    if (dataEnd > buf.length) dataEnd = buf.length;
    if (dataEnd <= dataStart) return null;
    var raw = buf.slice(dataStart, dataEnd);
    if (method === 0) return { data: raw, name: fileName, comp: raw.length, uncomp: raw.length };
    if (method === 8) {
        try {
            var dec = zlib.inflateRawSync(raw, { maxOutputLength: 209715200 });
            return { data: dec, name: fileName, comp: raw.length, uncomp: dec.length };
        } catch (e) { return null; }
    }
    return null;
}

function _parseTarEntry(buf, offset) {
    if (offset + 512 > buf.length) return null;
    var name = buf.slice(offset, offset + 100).toString("utf-8").replace(/\0.*$/, "");
    if (!name) return null;
    var sizeStr = buf.slice(offset + 124, offset + 136).toString("utf-8").replace(/\0.*$/, "").trim();
    var size = parseInt(sizeStr, 8);
    if (isNaN(size) || size < 0 || offset + 512 + size > buf.length) return null;
    var data = buf.slice(offset + 512, offset + 512 + size);
    var padded = (size + 511) & ~511;
    return { data, name, nextOffset: offset + 512 + padded };
}

function _decompressBuffer(buf, depth) {
    if (buf.length < 4) return buf;
    if (depth > 3) return null;
    if (buf.length > 209715200) return null;
    if (buf[0] === 0x1f && buf[1] === 0x8b) {
        try {
            var dec = zlib.gunzipSync(buf, { maxOutputLength: 209715200 });
            return _decompressBuffer(dec, depth + 1);
        } catch (e) { return buf; }
    }
    if (buf[0] === 0x78 && (buf[1] === 0x01 || buf[1] === 0x9c || buf[1] === 0xda)) {
        try {
            var dec = zlib.inflateSync(buf, { maxOutputLength: 209715200 });
            return _decompressBuffer(dec, depth + 1);
        } catch (e) { return buf; }
    }
    if (buf[0] === 0x1f && buf[1] === 0x9d) {
        try {
            var dec = zlib.unzipSync(buf, { maxOutputLength: 209715200 });
            return _decompressBuffer(dec, depth + 1);
        } catch (e) { return buf; }
    }
    if (buf[0] >= 0x10 && buf[0] <= 0x1f && buf[1] >= 0x00 && buf[1] <= 0x08) return buf;
    if (buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04) {
        var off = 0;
        while (off < buf.length) {
            var entry = _parseZipEntry(buf.slice(off));
            if (!entry) break;
            var entryHdr = 30 + buf.readUInt16LE(off + 26) + buf.readUInt16LE(off + 28);
            var entryFull = entryHdr + entry.comp;
            if (!entry.name || entry.name.startsWith(".") || entry.name.startsWith("__MACOSX")) { off += entryFull; continue; }
            if (entry.comp > 0 && entry.uncomp > 0 && entry.uncomp / entry.comp > 500) return null;
            return _decompressBuffer(entry.data, depth + 1);
        }
        return buf;
    }
    return buf;
}

async function _fetchFeed(url) {
    var resp = await fetch(url);
    if (!resp.ok) return null;
    var buf = Buffer.from(await resp.arrayBuffer());
    if (!buf.length) return null;
    var decompressed = _decompressBuffer(buf, 0);
    if (!decompressed || !decompressed.length) return null;
    if (decompressed.length > 209715200) return null;
    return decompressed;
}

function _parseXmltvDate(str) {
    if (!str) return null;
    var m = str.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})\s*([+-]\d{2})(\d{2})$/);
    if (!m) return new Date(str).toISOString();
    var offsetHours = parseInt(m[7]), offsetMins = parseInt(m[8]);
    var sign = offsetHours < 0 ? "-" : "+";
    var absH = Math.abs(offsetHours);
    var tz = sign + String(absH).padStart(2, "0") + ":" + String(offsetMins).padStart(2, "0");
    return m[1] + "-" + m[2] + "-" + m[3] + "T" + m[4] + ":" + m[5] + ":" + m[6] + tz;
}

function _xmltvTicks(startStr, stopStr) {
    if (!startStr || !stopStr) return 0;
    var s = new Date(_parseXmltvDate(startStr)).getTime();
    var e = new Date(_parseXmltvDate(stopStr)).getTime();
    if (isNaN(s) || isNaN(e)) return 0;
    return (e - s) * 10000;
}

async function _fetchEpgProgrammes(config, providerId) {
    if (_epgCache.providerId === providerId && Date.now() - _epgCache.ts < 300000 && _epgCache.programmes.length > 0) {
        return _epgCache.programmes;
    }
    var provider = config.ListingProviders.find(function (p) { return p.Id === providerId; });
    if (!provider || !provider.Path) return [];
    try {
        var raw = await _fetchFeed(provider.Path);
        if (!raw) return [];
        var text = raw.toString("utf-8");
        text = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\uFFFE\uFFFF]/g, "");
        var firstLt = text.indexOf("<");
        if (firstLt > 0) text = text.substring(firstLt);
        text = text.replace(/<\?xml[\s\S]*?\?>/g, "").replace(/<!DOCTYPE[\s\S]*?>/g, "").trim();
        if (text.charAt(0) !== "<") return [];
        var { SaxesParser } = await import("saxes");
        var parser = new SaxesParser({ lowercase: true });
        var programmes = [];
        var currentProgramme = null;
        parser.on("opentag", function (node) {
            if (node.name === "programme") {
                currentProgramme = {
                    channel: node.attributes.channel || "",
                    start: node.attributes.start || "",
                    stop: node.attributes.stop || "",
                };
            } else if (currentProgramme) {
                if (node.name === "title" && !currentProgramme.title) currentProgramme._cap = "title";
                else if (node.name === "sub-title" && !currentProgramme.subtitle) currentProgramme._cap = "subtitle";
                else if (node.name === "date" && !currentProgramme.date) currentProgramme._cap = "date";
                else if (node.name === "category" && !currentProgramme.category) currentProgramme._cap = "category";
                else currentProgramme._cap = null;
            }
        });
        parser.on("text", function (txt) {
            if (currentProgramme && currentProgramme._cap) {
                if (!currentProgramme[currentProgramme._cap]) currentProgramme[currentProgramme._cap] = "";
                currentProgramme[currentProgramme._cap] += txt;
            }
        });
        parser.on("cdata", function (txt) {
            if (currentProgramme && currentProgramme._cap) {
                if (!currentProgramme[currentProgramme._cap]) currentProgramme[currentProgramme._cap] = "";
                currentProgramme[currentProgramme._cap] += txt;
            }
        });
        parser.on("closetag", function (node) {
            if (!currentProgramme) return;
            if (node.name === "programme") {
                programmes.push(currentProgramme);
                currentProgramme = null;
            } else {
                currentProgramme._cap = null;
            }
        });
        parser.write(text).close();
        _epgCache = { programmes, ts: Date.now(), providerId };
        return programmes;
    } catch (e) {
        console.error("EPG fetch error:", e);
        return [];
    }
}

async function _queryEpg(config, provider, requestedIds, maxStart, minEnd, tunerChannels) {
    if (!provider) return [];
    var xmltvToTuner = {};
    (config.ChannelMappings || []).forEach(function (m) {
        if (m.ProviderId === provider.Id && m.ProviderChannelId && m.TunerChannelId) {
            xmltvToTuner[m.ProviderChannelId] = m.TunerChannelId;
        }
    });
    var programmes = await _fetchEpgProgrammes(config, provider.Id);
    var items = [], seen = {};
    var tunerByTvgId = {};
    if (Object.keys(xmltvToTuner).length === 0 && tunerChannels) {
        for (var ci = 0; ci < tunerChannels.length; ci++) {
            if (tunerChannels[ci].TvgId) tunerByTvgId[tunerChannels[ci].TvgId] = tunerChannels[ci].Id;
        }
    }
    for (var i = 0; i < programmes.length; i++) {
        var p = programmes[i];
        var channelId = xmltvToTuner[p.channel];
        if (!channelId) channelId = tunerByTvgId[p.channel];
        if (!channelId) continue;
        if (requestedIds.length > 0 && !requestedIds.includes(channelId)) continue;
        var startDate = _parseXmltvDate(p.start);
        var endDate = _parseXmltvDate(p.stop);
        if (!startDate || !endDate) continue;
        var startMs = new Date(startDate).getTime();
        var endMs = new Date(endDate).getTime();
        if (isNaN(startMs) || isNaN(endMs)) continue;
        if (endMs < minEnd || startMs > maxStart) continue;
        var name = p.title || "Unknown";
        var id = generateItemId(name + p.channel + p.start);
        if (seen[id]) continue;
        seen[id] = true;
        var item = { Id: id, Name: name, ServerId: "hmss", ChannelId: channelId, Type: "Program", MediaType: "Unknown", StartDate: startDate, EndDate: endDate, RunTimeTicks: _xmltvTicks(p.start, p.stop), ImageBlurHashes: {} };
        if (p.subtitle) item.EpisodeTitle = p.subtitle;
        if (p.date) { var year = parseInt(p.date); if (!isNaN(year) && year > 1900 && year < 2100) item.ProductionYear = year; }
        if (p.category) { var cat = p.category.toLowerCase(); if (cat === "series" || cat === "serie" || cat.includes("series") || cat.includes("serie")) item.IsSeries = true; else if (cat === "movie" || cat.includes("movie") || cat.includes("film")) item.IsMovie = true; else if (cat === "news" || cat.includes("news")) item.IsNews = true; else if (cat === "sports" || cat.includes("sport")) item.IsSports = true; else if (cat === "kids" || cat.includes("kids") || cat.includes("children")) item.IsKids = true; }
        items.push(item);
    }
    items.sort(function (a, b) { return new Date(a.StartDate).getTime() - new Date(b.StartDate).getTime(); });
    return items;
}

    app.post('/LiveTv/Programs', async (req, res) => {
        if (!req.user) return res.status(401).end();
        const db = getDb();
        const config = getLiveTvConfig(db);
        var provider = (config.ListingProviders || [])[0];
        var body = req.body || {};
        var requestedIds = body.channelIds ? body.channelIds.split(",").filter(Boolean) : [];
        var maxStart = body.MaxStartDate ? new Date(body.MaxStartDate).getTime() : Infinity;
        var minEnd = body.MinEndDate ? new Date(body.MinEndDate).getTime() : 0;
        var tvChannels = await getLiveTvChannels(db);
        var items = await _queryEpg(config, provider, requestedIds, maxStart, minEnd, tvChannels);
        var limit = parseInt(body.Limit || body.limit) || 0;
        res.json({ Items: limit > 0 ? items.slice(0, limit) : items, TotalRecordCount: items.length, StartIndex: 0 });
    });

    app.get('/LiveTv/Programs/Recommended', (req, res) => {
        if (!req.user) return res.status(401).end();
        res.json({ Items: [], TotalRecordCount: 0, StartIndex: 0 });
    });

    app.get('/LiveTv/Programs/:programId', async (req, res) => {
        if (!req.user) return res.status(401).end();
        const db = getDb();
        const config = getLiveTvConfig(db);
        var provider = (config.ListingProviders || [])[0];
        if (!provider) return res.status(404).json({ error: "Program not found." });
        var programmes = await _fetchEpgProgrammes(config, provider.Id);
        var p = null;
        for (var i = 0; i < programmes.length; i++) {
            var cand = programmes[i];
            var name = cand.title || "Unknown";
            var candId = generateItemId(name + cand.channel + cand.start);
            if (candId === req.params.programId) { p = cand; break; }
        }
        if (!p) return res.status(404).json({ error: "Program not found." });
        var tvChannels = await getLiveTvChannels(db);
        var tunerByTvgId = {}, tunerByChId = {};
        for (var ci = 0; ci < tvChannels.length; ci++) {
            if (tvChannels[ci].TvgId) tunerByTvgId[tvChannels[ci].TvgId] = tvChannels[ci];
            tunerByChId[tvChannels[ci].Id] = tvChannels[ci];
        }
        var chId = null;
        (config.ChannelMappings || []).forEach(function (m) {
            if (m.ProviderId === provider.Id && m.ProviderChannelId === p.channel) chId = m.TunerChannelId;
        });
        if (!chId && tunerByTvgId[p.channel]) chId = tunerByTvgId[p.channel].Id;
        var ch = chId ? tunerByChId[chId] : null;
        var startDate = _parseXmltvDate(p.start);
        var endDate = _parseXmltvDate(p.stop);
        var name = p.title || "Unknown";
        var id = generateItemId(name + p.channel + p.start);
        var item = {
            Name: name, ServerId: "hmss", Id: id,
            Etag: id, DateCreated: startDate,
            CanDelete: false, CanDownload: false,
            SortName: name.toLowerCase().replace(/\s+/g, ""),
            ExternalUrls: [], EnableMediaSourceDisplay: true,
            ChannelId: chId || "", ChannelName: ch ? ch.Name : "",
            Overview: p.subtitle || "",
            Taglines: [], Genres: p.category ? [p.category] : [],
            RunTimeTicks: _xmltvTicks(p.start, p.stop),
            PlayAccess: "Full", ProductionYear: p.date ? parseInt(p.date) : null,
            ChannelNumber: ch ? ch.Number : "",
            RemoteTrailers: [], ProviderIds: {},
            ParentId: chId || "",
            Type: "Program", People: [], Studios: [],
            GenreItems: p.category ? [{ Name: p.category, Id: generateItemId(p.category) }] : [],
            LocalTrailerCount: 0,
            UserData: { PlaybackPositionTicks: 0, PlayCount: 0, IsFavorite: false, Played: false, Key: id, ItemId: id },
            SpecialFeatureCount: 0,
            DisplayPreferencesId: generateItemId("dp_" + (chId || "")),
            Tags: [],
            ImageTags: {}, BackdropImageTags: [], ImageBlurHashes: {},
            MediaType: "Video",
            EndDate: endDate, LockedFields: [], LockData: false,
            StartDate: startDate,
        };
        if (p.date) { var year = parseInt(p.date); if (!isNaN(year) && year > 1900 && year < 2100) item.ProductionYear = year; }
        if (ch && ch.LogoUrl) { item.ImageTags.Primary = ch.Id; item.PrimaryImageAspectRatio = 1.333; }
        res.json(item);
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
            try { probe = await probeMedia(itemPath); } catch { }
        }
        return { found, itemPath, itemType, probe };
    }

    function buildMediaSource(found, itemPath, id, probe, itemType, disableDirectPlay = false, audioStreamIndex) {
        if (!probe) return null;
        const isVideo = itemType === "Episode" || itemType === "Movie" || itemType === "Video";
        const transcodeUrl = `/Videos/${id}/hls/master.m3u8`;
        var defaultAudioIdx = audioStreamIndex != null ? audioStreamIndex : (probe.streams.findIndex(s => s.Type === "Audio") >= 0 ? probe.streams.findIndex(s => s.Type === "Audio") : null);
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
            SupportsDirectStream: !disableDirectPlay,
            SupportsDirectPlay: !disableDirectPlay,
            DirectPlayUrl: disableDirectPlay ? null : `/Videos/${id}/stream?static=true&api_key=`,
            DirectStreamUrl: disableDirectPlay ? null : `/Videos/${id}/stream`,
            TranscodingUrl: transcodeUrl,
            HlsUrl: transcodeUrl,
            VideoType: isVideo ? "VideoFile" : undefined,
            MediaStreams: probe.streams,
            Bitrate: probe.bitrate,
            DefaultAudioStreamIndex: defaultAudioIdx,
            HasSegments: false,
            ETag: id,
            PlaySessionId: crypto.randomUUID(),
        };
    }

    function buildLiveTvMediaSource(tvChannel, audioStreamIndex) {
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
                    DisplayTitle: "Stereo",
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
            DefaultAudioStreamIndex: audioStreamIndex != null ? audioStreamIndex : 1,
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

    function clientCanDirectPlay(deviceProfile, sourceStreams) {
        if (!deviceProfile?.DirectPlayProfiles?.length) return true;
        const videoStream = sourceStreams.find(s => s.Type === "Video");
        const audioStream = sourceStreams.find(s => s.Type === "Audio");
        const srcVideoCodec = (videoStream?.Codec || "").toLowerCase();
        const srcAudioCodec = (audioStream?.Codec || "").toLowerCase();
        const isVideo = !!videoStream;
        for (const profile of deviceProfile.DirectPlayProfiles) {
            if (isVideo && profile.Type !== "Video") continue;
            if (!isVideo && profile.Type !== "Audio") continue;
            const videoCodecs = (profile.VideoCodec || "").split(",").map(c => c.trim().toLowerCase()).filter(Boolean);
            const audioCodecs = (profile.AudioCodec || "").split(",").map(c => c.trim().toLowerCase()).filter(Boolean);
            if (isVideo) {
                if (!videoCodecs.length) continue;
                if (srcVideoCodec && !videoCodecs.some(vc => srcVideoCodec.includes(vc))) continue;
            }
            if (audioCodecs.length && srcAudioCodec && !audioCodecs.some(ac => srcAudioCodec.includes(ac))) continue;
            return true;
        }
        return false;
    }

    app.get('/Items/:itemId/PlaybackInfo', async (req, res) => {
        const item = await findItemForPlayback(req);
        if (!item) return res.status(404).json({ error: "Item not found." });
        var audioIdx = parseInt(req.query.AudioStreamIndex) || null;
        if (item.tvChannel) {
            return res.json(buildPlaybackInfoResponse(buildLiveTvMediaSource(item.tvChannel, audioIdx)));
        }
        const id = generateItemId(item.found.id || item.found.filePath);
        const mediaSource = buildMediaSource(item.found, item.itemPath, id, item.probe, item.itemType, false, audioIdx);
        res.json(buildPlaybackInfoResponse(mediaSource));
    });

    app.post('/Items/:itemId/PlaybackInfo', async (req, res) => {
        const item = await findItemForPlayback(req);
        if (!item) return res.status(404).json({ error: "Item not found." });
        var audioIdx = parseInt(req.body?.AudioStreamIndex ?? req.query.AudioStreamIndex) || null;
        if (item.tvChannel) {
            return res.json(buildPlaybackInfoResponse(buildLiveTvMediaSource(item.tvChannel, audioIdx)));
        }
        const id = generateItemId(item.found.id || item.found.filePath);
        const deviceProfile = req.body?.DeviceProfile || null;
        let disableDirectPlay = false;
        if (deviceProfile && item.probe?.streams?.length) {
            disableDirectPlay = !clientCanDirectPlay(deviceProfile, item.probe.streams);
        }
        const mediaSource = buildMediaSource(item.found, item.itemPath, id, item.probe, item.itemType, disableDirectPlay, audioIdx);
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
    globalThis.__scheduledTasks = globalThis.__scheduledTasks || [];
    function _taskState(task) {
        var running = globalThis.__scheduledTasks.find(function (t) { return t.id === task.id && t.running; });
        return running ? "Running" : "Idle";
    }
    function _toTaskJson(task) {
        var lastRun = task.lastRun || { start: new Date(0).toISOString(), end: new Date(0).toISOString(), status: "Completed" };
        return {
            Name: task.name,
            State: _taskState(task),
            Id: task.id,
            LastExecutionResult: {
                StartTimeUtc: lastRun.start,
                EndTimeUtc: lastRun.end,
                Status: lastRun.status,
                Name: task.name,
                Key: task.key,
                Id: task.id
            },
            Triggers: task.triggers || [],
            Description: task.description,
            Category: task.category,
            IsHidden: !!task.hidden,
            Key: task.key
        };
    }
    globalThis.registerScheduledTask = function (opts) {
        var id = generateItemId(opts.name);
        if (globalThis.__scheduledTasks.find(function (t) { return t.id === id; })) return id;
        var task = { id: id, name: opts.name, key: opts.key || opts.name, description: opts.description || "", category: opts.category || "General", triggers: opts.triggers || [], hidden: opts.hidden, fn: opts.execute, running: false, lastRun: null };
        globalThis.__scheduledTasks.push(task);
        if (opts.cron) {
            (async function () {
                var cron = await import("node-cron");
                cron.schedule(opts.cron, function () {
                    var t = globalThis.__scheduledTasks.find(function (x) { return x.id === id; });
                    if (!t || t.running) return;
                    t.running = true;
                    var start = new Date().toISOString();
                    (async function () { try { await t.fn(); t.lastRun = { start: start, end: new Date().toISOString(), status: "Completed" }; } catch (e) { t.lastRun = { start: start, end: new Date().toISOString(), status: "Failed" }; console.error("Task " + t.name + " failed:", e); } finally { t.running = false; } })();
                });
            })();
        }
        return id;
    };
    globalThis.triggerTask = function (id) {
        var t = globalThis.__scheduledTasks.find(function (x) { return x.id === id; });
        if (!t || t.running) return false;
        t.running = true;
        var start = new Date().toISOString();
        (async function () { try { await t.fn(); t.lastRun = { start: start, end: new Date().toISOString(), status: "Completed" }; } catch (e) { t.lastRun = { start: start, end: new Date().toISOString(), status: "Failed" }; console.error("Task " + t.name + " failed:", e); } finally { t.running = false; } })();
        return true;
    };

    app.get('/ScheduledTasks', (req, res) => {
        if (!req.user || req.user.perms < 2) return res.status(401).json({ error: "Unauthorized" });
        res.json(globalThis.__scheduledTasks.map(_toTaskJson));
    });
    app.get('/ScheduledTasks/:taskId', (req, res) => {
        if (!req.user || req.user.perms < 2) return res.status(401).json({ error: "Unauthorized" });
        var t = globalThis.__scheduledTasks.find(function (x) { return x.id === req.params.taskId; });
        if (!t) return res.status(404).json({ error: "Task not found" });
        res.json(_toTaskJson(t));
    });
    app.post('/ScheduledTasks/Running/:taskId', (req, res) => {
        if (!req.user || req.user.perms < 2) return res.status(401).json({ error: "Unauthorized" });
        var ok = globalThis.triggerTask(req.params.taskId);
        res.status(ok ? 200 : 204)
    });
    app.delete('/ScheduledTasks/Running/:taskId', (req, res) => {
        if (!req.user || req.user.perms < 2) return res.status(401).json({ error: "Unauthorized" });
        var t = globalThis.__scheduledTasks.find(function (x) { return x.id === req.params.taskId; });
        if (t) t.running = false;
        res.status(204).json({});
    });
    app.post('/ScheduledTasks/:taskId/Triggers', (req, res) => {
        if (!req.user || req.user.perms < 2) return res.status(401).json({ error: "Unauthorized" });
        var t = globalThis.__scheduledTasks.find(function (x) { return x.id === req.params.taskId; });
        if (t && req.body) t.triggers = req.body;
        res.status(204).end();
    });

    // Register built-in tasks
    if (!globalThis.__scheduledTasks.length) {
        var nextTick = process.nextTick || setImmediate;
        nextTick(function () {
            globalThis.registerScheduledTask({
                name: "Scan Media Library",
                key: "RefreshLibrary",
                description: "Scans your media library for new files and refreshes metadata.",
                category: "Library",
                cron: "0 0 * * * *",
                triggers: [{ Type: "IntervalTrigger", IntervalTicks: 36000000000 }],
                execute: function () {
                    if (typeof globalThis.__startMediaIndex === "function") return globalThis.__startMediaIndex();
                    return Promise.resolve();
                }
            });
            globalThis.registerScheduledTask({
                name: "Refresh EPG Data",
                key: "RefreshEpg",
                description: "Refreshes EPG (Electronic Program Guide) data from configured listing providers.",
                category: "Live TV",
                cron: "0 0 */24 * * *",
                triggers: [{ Type: "IntervalTrigger", IntervalTicks: 864000000000 }],
                execute: function () {
                    if (typeof globalThis.__refreshEpg === "function") return globalThis.__refreshEpg();
                    return Promise.resolve();
                }
            });
        });
    }

    // === Search ===
    app.get('/Search/Hints', (req, res) => { /* GetSearchHints */ res.status(200).json({ message: 'Not implemented' }); });

    // === Session ===
    app.post('/Sessions/Capabilities', (req, res) => { /* PostCapabilities */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/Sessions/Capabilities/Full', (req, res) => { /* PostFullCapabilities */ res.status(204) });
    app.post('/Sessions/Playing', (req, res) => {
        if (!req.user) return res.status(200).end();
        const body = req.body || {};
        const itemId = body.ItemId;
        if (itemId) {
            const db = getDb();
            const existing = getUserData(db, req.user.id, itemId);
            setUserData(db, req.user.id, itemId, {
                PlaybackPositionTicks: body.PositionTicks || existing.PlaybackPositionTicks || 0,
                LastPlayedDate: new Date().toISOString(),
            });
        }
        res.status(200).end();
    });
    app.post('/Sessions/Playing/Ping', (req, res) => { res.status(200).end(); });
    app.post('/Sessions/Playing/Progress', (req, res) => {
        if (!req.user) return res.status(200).end();
        const body = req.body || {};
        const itemId = body.ItemId;
        if (itemId) {
            const db = getDb();
            const posTicks = body.PositionTicks || 0;
            const runtimeTicks = body.RunTimeTicks || 0;
            const pct = runtimeTicks > 0 ? Math.min((posTicks / runtimeTicks) * 100, 100) : 0;
            setUserData(db, req.user.id, itemId, {
                PlaybackPositionTicks: posTicks,
                PlayedPercentage: pct,
                LastPlayedDate: new Date().toISOString(),
            });
        }
        res.status(200).end();
    });
    app.post('/Sessions/Playing/Stopped', (req, res) => {
        if (!req.user) return res.status(200).end();
        const body = req.body || {};
        const itemId = body.ItemId;
        if (itemId) {
            const db = getDb();
            const posTicks = body.PositionTicks || 0;
            const runtimeTicks = body.RunTimeTicks || 0;
            const pct = runtimeTicks > 0 ? Math.min((posTicks / runtimeTicks) * 100, 100) : 0;
            const isFinished = pct >= 95;
            const existing = getUserData(db, req.user.id, itemId);
            setUserData(db, req.user.id, itemId, {
                PlaybackPositionTicks: isFinished ? 0 : posTicks,
                Played: isFinished,
                PlayedPercentage: isFinished ? 100 : pct,
                PlayCount: isFinished ? (existing.PlayCount || 0) + 1 : existing.PlayCount || 0,
                LastPlayedDate: new Date().toISOString(),
            });
        }
        res.status(200).end();
    });
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
    app.get('/Shows/NextUp', (req, res) => { res.json({ Items: [], TotalRecordCount: 0, StartIndex: 0 }); });
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

        const showDir = `media/shows/${showName}`;
        const backdropImg = findImageInDir(showDir, "Backdrop");
        const logoImg = findImageInDir(showDir, "Logo");
        const parentBackdropTags = backdropImg ? [backdropImg.tag] : [];
        const parentLogoTag = logoImg ? logoImg.tag : null;
        const parentImageTags = {};
        const primaryImg = findImageInDir(showDir, "Primary");
        if (primaryImg) parentImageTags.Primary = primaryImg.tag;
        if (parentLogoTag) parentImageTags.Logo = parentLogoTag;

        let episodes = (index.shows || []).filter(ep => ep.showName === showName);
        if (seasonId) {
            episodes = episodes.filter(ep => generateItemId(`${ep.showName}-s${ep.season}`) === seasonId);
        }

        const items = episodes.map(ep => {
            const itemId = generateItemId(ep.id || ep.filePath);
            const poster = findPosterPath(ep.filePath);
            const runTimeTicks = ep.duration ? Math.round(ep.duration * 10000000) : 0;
            return {
                Name: ep.title || `S${String(ep.season).padStart(2, "0")}E${String(ep.episode).padStart(2, "0")}`,
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
                BackdropImageTags: parentBackdropTags,
                ParentBackdropImageTags: parentBackdropTags,
                ParentLogoImageTags: parentLogoTag ? [parentLogoTag] : [],
                ParentImageTags: parentImageTags,
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
    app.get('/Shows/:seriesId/Seasons', (req, res) => {
        if (!req.user) return res.status(401).end();
        const sys = getSystemInfo(getDb());
        const serverId = sys?.id || "hmss-local";
        const index = globalThis.__mediaIndex || { shows: [], movies: [], music: [] };
        const seriesId = req.params.seriesId.replace(/-/g, "");
        let showName = null;
        for (const ep of index.shows || []) {
            if (generateItemId(ep.showName) === seriesId) { showName = ep.showName; break; }
        }
        if (!showName) return res.json({ Items: [], TotalRecordCount: 0, StartIndex: 0 });
        const episodes = (index.shows || []).filter(ep => ep.showName === showName);
        const seasonMap = {};
        for (const ep of episodes) {
            if (!seasonMap[ep.season]) {
                const seasonId = generateItemId(`${showName}-s${ep.season}`);
                const seasonPoster = findPosterPath(ep.filePath);
                seasonMap[ep.season] = {
                    Name: ep.season === 0 ? "Specials" : `Season ${ep.season}`,
                    ServerId: serverId,
                    Id: seasonId,
                    SortName: `Season ${String(ep.season).padStart(2, "0")}`,
                    IndexNumber: ep.season,
                    SeriesName: showName,
                    SeriesId: seriesId,
                    IsFolder: true,
                    Type: "Season",
                    UserData: { PlaybackPositionTicks: 0, PlayCount: 0, IsFavorite: false, Played: false, Key: seasonId.replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, "$1-$2-$3-$4-$5"), ItemId: seasonId },
                    ImageTags: seasonPoster ? { Primary: seasonPoster.tag } : {},
                    BackdropImageTags: [],
                    ImageBlurHashes: seasonPoster ? { Primary: {} } : {},
                    LocationType: "FileSystem",
                };
            }
        }
        const seasons = Object.values(seasonMap).sort((a, b) => (a.IndexNumber || 0) - (b.IndexNumber || 0));
        const start = parseInt(req.query.StartIndex) || 0;
        const limit = parseInt(req.query.Limit) || seasons.length;
        res.json({ Items: seasons.slice(start, start + limit), TotalRecordCount: seasons.length, StartIndex: start });
    });

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

        switch (key) {
            case "livetv":
                return res.status(200).json(getLiveTvConfig(db));
            case "network":
                return res.status(200).json({
                    BaseUrl: `http://${getLocalIPv4()}:${port}`,
                    EnableHttps: false,
                    RequireHttps: false,
                    CertificatePath: "",
                    CertificatePassword: "",
                    InternalHttpPort: port,
                    InternalHttpsPort: port + 1,
                    PublicHttpPort: port,
                    PublicHttpsPort: port + 1,
                    AutoDiscovery: true,
                    EnableUPnP: true,
                    EnableIPv4: true,
                    EnableIPv6: false,
                    EnableRemoteAccess: true,
                    LocalNetworkSubnets: [],
                    LocalNetworkAddresses: ["lo", getLocalIPv4()],
                    KnownProxies: [],
                    IgnoreVirtualInterfaces: [],
                    EnablePublishedServerUriByRequest: true,
                    PublishedServerUriBySubnet: [],
                    RemoteIPFilter: [],
                    IsRemoteIPFilterBlacklist: true
                })
        }

        const sys = getSystemInfo(db);
        let stored = {};
        try { stored = JSON.parse(sys?.config_json || "{}"); } catch { }
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
        try { stored = JSON.parse(sys?.config_json || "{}"); } catch { }
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
    app.post('/Users/New', async (req, res) => {
        if (!req.user || req.user.perms < 2) return res.status(401).end();
        const db = getDb();
        const { Name, Password } = req.body || {};
        if (!Name || !Password) return res.status(400).json({ error: "Name and Password required." });

        const existingUser = db.prepare("SELECT id FROM users WHERE name = ?").get(Name);
        if (existingUser) return res.status(400).json({ error: "User already exists." });

        const argon2 = (await import("argon2")).default;
        const passwordHash = await argon2.hash(Password, { type: argon2.argon2id });
        const uuid = crypto.randomUUID();
        const id = db.prepare("INSERT INTO users (name, password_hash, perms, uuid) VALUES (?, ?, ?, ?)")
            .run(Name, passwordHash, 0, uuid).lastInsertRowid;

        res.json({
            Name,
            ServerId: getSystemInfo(db)?.id || "hmss-local",
            Id: uuid.replace(/-/g, ""),
            HasPassword: true,
            HasConfiguredPassword: true,
            HasConfiguredAutoLogin: false,
            LastActivityDate: null,
            LastLoginDate: null,
            PrimaryImageAspectRatio: null,
            Created: new Date().toISOString(),
            Policy: {
                IsAdministrator: false,
                IsHidden: false,
                IsDisabled: false,
                MaxParentalRating: 0,
                MaxParentalRatingSubItems: 0,
                AuthenticationProviderId: "Jellyfin.Server.Implementations.Security.DefaultAuthenticationProvider",
                PasswordResetProviderId: "Jellyfin.Server.Implementations.Security.DefaultPasswordResetProvider",
                EnableUserPreferenceSync: false,
                RemoteClientBitrateLimit: 0,
                AuthenticationProvider: "Default",
                PasswordResetProvider: "Default",
            },
            PrimaryImageTag: null,
        });
    });
    app.post('/Users/Password', (req, res) => { /* UpdateUserPassword */ res.status(200).json({ message: 'Not implemented' }); });
    app.delete('/Users/:userId', (req, res) => {
        if (!req.user) return res.status(401).end();
        if (req.user.perms < 2) return res.status(403).end();
        const db = getDb();
        const userId = req.params.userId;
        const withDashes = userId.replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, "$1-$2-$3-$4-$5");
        let user = db.prepare("SELECT id, name FROM users WHERE uuid = ?").get(userId);
        if (!user) user = db.prepare("SELECT id, name FROM users WHERE uuid = ?").get(withDashes);
        if (!user) user = db.prepare("SELECT id, name FROM users WHERE id = ?").get(userId);
        if (!user) return res.status(404).json({ error: "User not found." });
        if (user.name === "root") return res.status(400).json({ error: "Cannot delete root user." });
        if (user.id === req.user.id) return res.status(400).json({ error: "Cannot delete yourself." });
        db.prepare("DELETE FROM sessions WHERE user_id = ?").run(user.id);
        db.prepare("DELETE FROM users WHERE id = ?").run(user.id);
        console.log(`User '${user.name}' (${user.id}) deleted by '${req.user.name}'.`);
        res.status(204).end();
    });
    app.post('/Users/:userId/Policy', (req, res) => {
        if (!req.user) return res.status(401).end();
        if (req.user.perms < 2) return res.status(403).end();
        const db = getDb();
        const userId = req.params.userId;
        const withDashes = userId.replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, "$1-$2-$3-$4-$5");
        let user = db.prepare("SELECT id, uuid FROM users WHERE uuid = ?").get(userId);
        if (!user) user = db.prepare("SELECT id, uuid FROM users WHERE uuid = ?").get(withDashes);
        if (!user) user = db.prepare("SELECT id, uuid FROM users WHERE id = ?").get(userId);
        if (!user) return res.status(404).json({ error: "User not found." });
        const policy = req.body || {};
        db.prepare("UPDATE users SET policy_json = ? WHERE id = ?").run(JSON.stringify(policy), user.id);
        res.status(204).end();
    });

    // === UserData ===
    app.delete('/UserFavoriteItems/:itemId', (req, res) => {
        if (!req.user) return res.status(200).end();
        const db = getDb();
        const existing = getUserData(db, req.user.id, req.params.itemId);
        setUserData(db, req.user.id, req.params.itemId, { IsFavorite: false });
        res.status(200).end();
    });
    app.post('/UserFavoriteItems/:itemId', (req, res) => {
        if (!req.user) return res.status(200).end();
        const db = getDb();
        setUserData(db, req.user.id, req.params.itemId, { IsFavorite: true });
        res.status(200).end();
    });
    app.delete('/UserItems/:itemId/Rating', (req, res) => { res.status(200).end(); });
    app.post('/UserItems/:itemId/Rating', (req, res) => { res.status(200).end(); });
    app.get('/UserItems/:itemId/UserData', (req, res) => {
        if (!req.user) return res.status(200).json({ PlaybackPositionTicks: 0, PlayCount: 0, IsFavorite: false, Played: false });
        const db = getDb();
        const data = getUserData(db, req.user.id, req.params.itemId);
        res.json(data);
    });
    app.post('/UserItems/:itemId/UserData', (req, res) => {
        if (!req.user) return res.status(200).end();
        const db = getDb();
        setUserData(db, req.user.id, req.params.itemId, req.body || {});
        res.status(200).end();
    });
    app.delete('/UserPlayedItems/:itemId', (req, res) => {
        if (!req.user) return res.status(200).end();
        const db = getDb();
        setUserData(db, req.user.id, req.params.itemId, {
            Played: false,
            PlaybackPositionTicks: 0,
            PlayedPercentage: 0,
        });
        res.status(200).end();
    });
    app.post('/UserPlayedItems/:itemId', (req, res) => {
        if (!req.user) return res.status(200).end();
        const db = getDb();
        const existing = getUserData(db, req.user.id, req.params.itemId);
        setUserData(db, req.user.id, req.params.itemId, {
            Played: true,
            PlaybackPositionTicks: 0,
            PlayedPercentage: 100,
            PlayCount: (existing.PlayCount || 0) + 1,
            LastPlayedDate: new Date().toISOString(),
        });
        res.status(200).end();
    });

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

    // === HLS Transcoding ===
    const hlsSessions = new Map();

    async function startHlsTranscode(itemId) {
        const rawId = (itemId || "").replace(/-/g, "");
        const filePath = findFileByItemId(rawId);
        if (!filePath) return null;

        let probe = null;
        try { probe = await probeMedia(filePath); } catch {}

        const existingKey = `${rawId}`;
        if (hlsSessions.has(existingKey)) {
            const existing = hlsSessions.get(existingKey);
            if (existing.session && !existing.session.process.killed) {
                return { sessionId: existing.session.id };
            }
            hlsSessions.delete(existingKey);
        }

        const session = await transcoder.startTranscode(filePath, probe);
        hlsSessions.set(existingKey, { session, itemId: rawId, createdAt: Date.now() });
        return { sessionId: session.id };
    }

    app.get('/Videos/:itemId/hls/master.m3u8', async (req, res) => {
        try {
            const result = await startHlsTranscode(req.params.itemId);
            if (!result) return res.status(404).json({ error: "Item not found." });
            const baseUrl = `/Videos/${req.params.itemId}/hls`;
            const master = [
                "#EXTM3U",
                "#EXT-X-VERSION:3",
                `#EXT-X-STREAM-INF:BANDWIDTH=8000000,RESOLUTION=1920x1080,CODECS="avc1.640028,mp4a.40.2"`,
                `${baseUrl}/${result.sessionId}/playlist.m3u8`,
            ].join("\n");
            res.set("Content-Type", "application/vnd.apple.mpegurl");
            res.set("Cache-Control", "no-cache");
            res.send(master);
        } catch (err) {
            console.error("HLS master error:", err.message);
            res.status(500).json({ error: "Transcoding failed." });
        }
    });

    app.get('/Videos/:itemId/hls/:sessionId/playlist.m3u8', async (req, res) => {
        try {
            const playlist = transcoder.readPlaylist(req.params.sessionId);
            if (!playlist) return res.status(404).json({ error: "Playlist not found." });
            res.set("Content-Type", "application/vnd.apple.mpegurl");
            res.set("Cache-Control", "no-cache");
            res.send(playlist);
        } catch (err) {
            res.status(500).json({ error: "Failed to read playlist." });
        }
    });

    app.get('/Videos/:itemId/hls/:sessionId/:segment', async (req, res) => {
        try {
            const segPath = transcoder.getSegmentPath(req.params.sessionId, req.params.segment);
            if (!segPath) return res.status(404).json({ error: "Segment not found." });
            res.set("Content-Type", "video/mp2t");
            res.set("Cache-Control", "max-age=3600");
            createReadStream(segPath).pipe(res);
        } catch (err) {
            res.status(500).json({ error: "Failed to serve segment." });
        }
    });

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