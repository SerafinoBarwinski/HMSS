import { getAddons, getAddonsByCapability, searchAll } from "./addon_loader.js";
import { authMiddleware, hmssAuthRoutes } from "./auth.js";
import { getSystemInfo } from "./sql.js";
import { suggestionsFromIndex } from "./jellyfin_items.js";
import os from "node:os";

export async function hmssRoutes(app, getDb, apiVersion, port) {
    app.use(authMiddleware(getDb));
    hmssAuthRoutes(app, getDb);

    app.get("/", (req, res) => {
        const ua = req.headers["user-agent"] || "";
        if (ua.includes("; wv)")) {
            return res.redirect("/web/alt_index.html");
        }
        res.redirect("/web/index.html");
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
        res.status(204).end();
    });

    app.post("/Startup/User", (req, res) => {
        const db = getDb();
        const { Name, Password } = req.body;
        if (!Name || !Password) return res.status(400).json({ error: "Name and Password required." });

        db.prepare("UPDATE system SET startup_wizard_completed = 1").run();
        res.status(204).end();
    });

    app.get("/Startup/Configuration", (req, res) => {
        res.json({
            UICulture: "en-US",
            MetadataCountryCode: "US",
            PreferredMetadataLanguage: "en",
        });
    });

    app.post("/System/Restart", (req, res) => {
        if (!req.user || req.user.perms < 2) {
            return res.status(403).json({ error: "Admin permissions required." });
        }
        res.status(200).json({ message: "Terminating..." });
        console.log(`System restart initiated by ${req.user.name}`);
        setTimeout(() => process.exit(0), 500);
    });

    app.post("/System/Shutdown", (req, res) => {
        if (!req.user || req.user.perms < 2) {
            return res.status(403).json({ error: "Admin permissions required." });
        }
        res.status(200).json({ message: "Shutting down..." });
        console.log(`System shutdown initiated by ${req.user.name}`);
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
            CanSelfRestart: true,
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
        res.json({
            Items: [
                { Name: "Movies", CollectionType: "movies", Id: "movies", IsFolder: true, Type: "CollectionFolder" },
                { Name: "Shows", CollectionType: "tvshows", Id: "shows", IsFolder: true, Type: "CollectionFolder" },
                { Name: "Music", CollectionType: "music", Id: "music", IsFolder: true, Type: "CollectionFolder" },
            ],
            TotalRecordCount: 3,
        });
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

    app.get("/Items/Suggestions", (req, res) => {
        const sys = getSystemInfo(getDb());
        const serverId = sys?.id || "hmss-local";
        const index = globalThis.__mediaIndex || { shows: [], movies: [], music: [] };
        const limit = parseInt(req.query.limit) || 6;
        const result = suggestionsFromIndex(index, req.query.userId, serverId, limit);
        res.json(result);
    });

    app.get("/Items", (req, res) => {
        const sys = getSystemInfo(getDb());
        const serverId = sys?.id || "hmss-local";
        const index = globalThis.__mediaIndex || { shows: [], movies: [], music: [] };
        const result = suggestionsFromIndex(index, req.query.userId, serverId, 100);
        res.json(result);
    });

    app.get("/Items/:itemId", (req, res) => {
        const sys = getSystemInfo(getDb());
        const serverId = sys?.id || "hmss-local";
        const index = globalThis.__mediaIndex || { shows: [], movies: [], music: [] };
        const result = suggestionsFromIndex(index, null, serverId, 100);
        const rawId = req.params.itemId.replace(/-/g, "");
        const item = result.Items.find(i => i.Id === rawId);
        if (!item) return res.status(404).json({ error: "Item not found." });
        res.json(item);
    });

    app.get("/UserItems/Resume", (req, res) => {
        res.json({ Items: [], TotalRecordCount: 0, StartIndex: 0 });
    });
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

export async function jellyfinRoutes(app) {

    // === Artist ===
    app.get('/Artists', (req, res) => { /* GetArtists */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/Artists/AlbumArtists', (req, res) => { /* GetAlbumArtists */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/Artists/:name', (req, res) => { /* GetArtistByName */ res.status(200).json({ message: 'Not implemented' }); });

    // === Audio ===
    app.get('/Audio/:itemId/stream.:container', (req, res) => { /* GetAudioStreamByContainer */ res.status(200).json({ message: 'Not implemented' }); });
    app.head('/Audio/:itemId/stream.:container', (req, res) => { /* HeadAudioStreamByContainer */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/Audio/:itemId/stream', (req, res) => { /* GetAudioStream */ res.status(200).json({ message: 'Not implemented' }); });
    app.head('/Audio/:itemId/stream', (req, res) => { /* HeadAudioStream */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/Audio/:itemId/universal', (req, res) => { /* GetUniversalAudioStream */ res.status(200).json({ message: 'Not implemented' }); });
    app.head('/Audio/:itemId/universal', (req, res) => { /* HeadUniversalAudioStream */ res.status(200).json({ message: 'Not implemented' }); });

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
    app.get('/Branding/Configuration', (req, res) => { /* GetBrandingOptions */ res.status(200).json({ message: 'Not implemented' }); });
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
    app.delete('/Devices', (req, res) => { /* DeleteDevice */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/Devices', (req, res) => { /* GetDevices */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/Devices/Info', (req, res) => { /* GetDeviceInfo */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/Devices/Options', (req, res) => { /* GetDeviceOptions */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/Devices/Options', (req, res) => { /* UpdateDeviceOptions */ res.status(200).json({ message: 'Not implemented' }); });

    // === DisplayPreference ===
    app.get('/DisplayPreferences/:displayPreferencesId', (req, res) => { /* GetDisplayPreferences */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/DisplayPreferences/:displayPreferencesId', (req, res) => { /* UpdateDisplayPreferences */ res.status(200).json({ message: 'Not implemented' }); });

    // === Environment ===
    app.get('/Environment/DefaultDirectoryBrowser', (req, res) => { /* GetDefaultDirectoryBrowser */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/Environment/DirectoryContents', (req, res) => { /* GetDirectoryContents */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/Environment/Drives', (req, res) => { /* GetDrives */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/Environment/ParentPath', (req, res) => { /* GetParentPath */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/Environment/ValidatePath', (req, res) => { /* ValidatePath */ res.status(200).json({ message: 'Not implemented' }); });

    // === Filter ===
    app.get('/Items/Filters', (req, res) => { /* GetQueryFiltersLegacy */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/Items/Filters2', (req, res) => { /* GetQueryFilters */ res.status(200).json({ message: 'Not implemented' }); });

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
    app.delete('/UserImage', (req, res) => { /* DeleteUserImage */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/UserImage', (req, res) => { /* GetUserImage */ res.status(200).json({ message: 'Not implemented' }); });
    app.head('/UserImage', (req, res) => { /* HeadUserImage */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/UserImage', (req, res) => { /* PostUserImage */ res.status(200).json({ message: 'Not implemented' }); });

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
    app.get('/Albums/:itemId/Similar', (req, res) => { /* GetSimilarAlbums */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/Artists/:itemId/Similar', (req, res) => { /* GetSimilarArtists */ res.status(200).json({ message: 'Not implemented' }); });
    app.delete('/Items', (req, res) => { /* DeleteItems */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/Items', (req, res) => { /* GetItems */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/Items/Counts', (req, res) => { /* GetItemCounts */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/Items/Latest', (req, res) => { /* GetLatestMedia */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/Items/Root', (req, res) => { /* GetRootFolder */ res.status(200).json({ message: 'Not implemented' }); });
    app.delete('/Items/:itemId', (req, res) => { /* DeleteItem */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/Items/:itemId', (req, res) => { /* GetItem */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/Items/:itemId/Ancestors', (req, res) => { /* GetAncestors */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/Items/:itemId/Collections', (req, res) => { /* GetItemCollections */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/Items/:itemId/Download', (req, res) => { /* GetDownload */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/Items/:itemId/File', (req, res) => { /* GetFile */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/Items/:itemId/Intros', (req, res) => { /* GetIntros */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/Items/:itemId/LocalTrailers', (req, res) => { /* GetLocalTrailers */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/Items/:itemId/Refresh', (req, res) => { /* RefreshItem */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/Items/:itemId/Similar', (req, res) => { /* GetSimilarItems */ res.status(200).json({ message: 'Not implemented' }); });
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
    app.get('/Movies/:itemId/Similar', (req, res) => { /* GetSimilarMovies */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/Shows/:itemId/Similar', (req, res) => { /* GetSimilarShows */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/Trailers/:itemId/Similar', (req, res) => { /* GetSimilarTrailers */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/UserItems/Resume', (req, res) => { /* GetResumeItems */ res.status(200).json({ message: 'Not implemented' }); });

    // === LibraryStructure ===
    app.delete('/Library/VirtualFolders', (req, res) => { /* RemoveVirtualFolder */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/Library/VirtualFolders', (req, res) => { /* GetVirtualFolders */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/Library/VirtualFolders', (req, res) => { /* AddVirtualFolder */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/Library/VirtualFolders/LibraryOptions', (req, res) => { /* UpdateLibraryOptions */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/Library/VirtualFolders/Name', (req, res) => { /* RenameVirtualFolder */ res.status(200).json({ message: 'Not implemented' }); });
    app.delete('/Library/VirtualFolders/Paths', (req, res) => { /* RemoveMediaPath */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/Library/VirtualFolders/Paths', (req, res) => { /* AddMediaPath */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/Library/VirtualFolders/Paths/Update', (req, res) => { /* UpdateMediaPath */ res.status(200).json({ message: 'Not implemented' }); });

    // === LiveTv ===
    app.get('/LiveTv/ChannelMappingOptions', (req, res) => { /* GetChannelMappingOptions */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/LiveTv/ChannelMappings', (req, res) => { /* SetChannelMapping */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/LiveTv/Channels', (req, res) => { /* GetLiveTvChannels */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/LiveTv/Channels/:channelId', (req, res) => { /* GetChannel */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/LiveTv/GuideInfo', (req, res) => { /* GetGuideInfo */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/LiveTv/Info', (req, res) => { /* GetLiveTvInfo */ res.status(200).json({ message: 'Not implemented' }); });
    app.delete('/LiveTv/ListingProviders', (req, res) => { /* DeleteListingProvider */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/LiveTv/ListingProviders', (req, res) => { /* AddListingProvider */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/LiveTv/ListingProviders/Default', (req, res) => { /* GetDefaultListingProvider */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/LiveTv/ListingProviders/Lineups', (req, res) => { /* GetLineups */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/LiveTv/ListingProviders/SchedulesDirect/Countries', (req, res) => { /* GetSchedulesDirectCountries */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/LiveTv/LiveRecordings/:recordingId/stream', (req, res) => { /* GetLiveRecordingFile */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/LiveTv/LiveStreamFiles/:streamId/stream.:container', (req, res) => { /* GetLiveStreamFile */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/LiveTv/Programs', (req, res) => { /* GetLiveTvPrograms */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/LiveTv/Programs', (req, res) => { /* GetPrograms */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/LiveTv/Programs/Recommended', (req, res) => { /* GetRecommendedPrograms */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/LiveTv/Programs/:programId', (req, res) => { /* GetProgram */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/LiveTv/Recordings', (req, res) => { /* GetRecordings */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/LiveTv/Recordings/Folders', (req, res) => { /* GetRecordingFolders */ res.status(200).json({ message: 'Not implemented' }); });
    app.delete('/LiveTv/Recordings/:recordingId', (req, res) => { /* DeleteRecording */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/LiveTv/Recordings/:recordingId', (req, res) => { /* GetRecording */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/LiveTv/SeriesTimers', (req, res) => { /* GetSeriesTimers */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/LiveTv/SeriesTimers', (req, res) => { /* CreateSeriesTimer */ res.status(200).json({ message: 'Not implemented' }); });
    app.delete('/LiveTv/SeriesTimers/:timerId', (req, res) => { /* CancelSeriesTimer */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/LiveTv/SeriesTimers/:timerId', (req, res) => { /* GetSeriesTimer */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/LiveTv/SeriesTimers/:timerId', (req, res) => { /* UpdateSeriesTimer */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/LiveTv/Timers', (req, res) => { /* GetTimers */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/LiveTv/Timers', (req, res) => { /* CreateTimer */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/LiveTv/Timers/Defaults', (req, res) => { /* GetDefaultTimer */ res.status(200).json({ message: 'Not implemented' }); });
    app.delete('/LiveTv/Timers/:timerId', (req, res) => { /* CancelTimer */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/LiveTv/Timers/:timerId', (req, res) => { /* GetTimer */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/LiveTv/Timers/:timerId', (req, res) => { /* UpdateTimer */ res.status(200).json({ message: 'Not implemented' }); });
    app.delete('/LiveTv/TunerHosts', (req, res) => { /* DeleteTunerHost */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/LiveTv/TunerHosts', (req, res) => { /* AddTunerHost */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/LiveTv/TunerHosts/Types', (req, res) => { /* GetTunerHostTypes */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/LiveTv/Tuners/Discover', (req, res) => { /* DiscoverTuners */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/LiveTv/Tuners/Discvover', (req, res) => { /* DiscvoverTuners */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/LiveTv/Tuners/:tunerId/Reset', (req, res) => { /* ResetTuner */ res.status(200).json({ message: 'Not implemented' }); });

    // === Localization ===
    app.get('/Localization/Countries', (req, res) => { /* GetCountries */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/Localization/Cultures', (req, res) => { /* GetCultures */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/Localization/Options', (req, res) => { /* GetLocalizationOptions */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/Localization/ParentalRatings', (req, res) => { /* GetParentalRatings */ res.status(200).json({ message: 'Not implemented' }); });

    // === Lyric ===
    app.delete('/Audio/:itemId/Lyrics', (req, res) => { /* DeleteLyrics */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/Audio/:itemId/Lyrics', (req, res) => { /* GetLyrics */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/Audio/:itemId/Lyrics', (req, res) => { /* UploadLyrics */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/Audio/:itemId/RemoteSearch/Lyrics', (req, res) => { /* SearchRemoteLyrics */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/Audio/:itemId/RemoteSearch/Lyrics/:lyricId', (req, res) => { /* DownloadRemoteLyrics */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/Providers/Lyrics/:lyricId', (req, res) => { /* GetRemoteLyrics */ res.status(200).json({ message: 'Not implemented' }); });

    // === MediaInfo ===
    app.get('/Items/:itemId/PlaybackInfo', (req, res) => { /* GetPlaybackInfo */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/Items/:itemId/PlaybackInfo', (req, res) => { /* GetPostedPlaybackInfo */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/LiveStreams/Close', (req, res) => { /* CloseLiveStream */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/LiveStreams/Open', (req, res) => { /* OpenLiveStream */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/Playback/BitrateTest', (req, res) => { /* GetBitrateTestBytes */ res.status(200).json({ message: 'Not implemented' }); });

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
    app.get('/Packages', (req, res) => { /* GetPackages */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/Packages/Installed/:name', (req, res) => { /* InstallPackage */ res.status(200).json({ message: 'Not implemented' }); });
    app.delete('/Packages/Installing/:packageId', (req, res) => { /* CancelPackageInstallation */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/Packages/:name', (req, res) => { /* GetPackageInfo */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/Plugins', (req, res) => { /* GetPlugins */ res.status(200).json({ message: 'Not implemented' }); });
    app.delete('/Plugins/:pluginId', (req, res) => { /* UninstallPlugin */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/Plugins/:pluginId/Configuration', (req, res) => { /* GetPluginConfiguration */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/Plugins/:pluginId/Configuration', (req, res) => { /* UpdatePluginConfiguration */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/Plugins/:pluginId/Manifest', (req, res) => { /* GetPluginManifest */ res.status(200).json({ message: 'Not implemented' }); });
    app.delete('/Plugins/:pluginId/:version', (req, res) => { /* UninstallPluginByVersion */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/Plugins/:pluginId/:version/Disable', (req, res) => { /* DisablePlugin */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/Plugins/:pluginId/:version/Enable', (req, res) => { /* EnablePlugin */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/Plugins/:pluginId/:version/Image', (req, res) => { /* GetPluginImage */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/Repositories', (req, res) => { /* GetRepositories */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/Repositories', (req, res) => { /* SetRepositories */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/web/ConfigurationPage', (req, res) => { /* GetDashboardConfigurationPage */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/web/ConfigurationPages', (req, res) => { /* GetConfigurationPages */ res.status(200).json({ message: 'Not implemented' }); });

    // === RemoteImage ===
    app.get('/Items/:itemId/RemoteImages', (req, res) => { /* GetRemoteImages */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/Items/:itemId/RemoteImages/Download', (req, res) => { /* DownloadRemoteImage */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/Items/:itemId/RemoteImages/Providers', (req, res) => { /* GetRemoteImageProviders */ res.status(200).json({ message: 'Not implemented' }); });

    // === ScheduledTask ===
    app.get('/ScheduledTasks', (req, res) => { /* GetTasks */ res.status(200).json({ message: 'Not implemented' }); });
    app.delete('/ScheduledTasks/Running/:taskId', (req, res) => { /* StopTask */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/ScheduledTasks/Running/:taskId', (req, res) => { /* StartTask */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/ScheduledTasks/:taskId', (req, res) => { /* GetTask */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/ScheduledTasks/:taskId/Triggers', (req, res) => { /* UpdateTask */ res.status(200).json({ message: 'Not implemented' }); });

    // === Search ===
    app.get('/Search/Hints', (req, res) => { /* GetSearchHints */ res.status(200).json({ message: 'Not implemented' }); });

    // === Session ===
    app.get('/Sessions', (req, res) => { /* GetSessions */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/Sessions/Capabilities', (req, res) => { /* PostCapabilities */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/Sessions/Capabilities/Full', (req, res) => { /* PostFullCapabilities */ res.status(200).json({ message: 'Not implemented' }); });
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
    app.get('/Shows/:seriesId/Episodes', (req, res) => { /* GetEpisodes */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/Shows/:seriesId/Seasons', (req, res) => { /* GetSeasons */ res.status(200).json({ message: 'Not implemented' }); });

    // === Startup ===
    app.post('/Startup/Complete', (req, res) => { /* CompleteWizard */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/Startup/Configuration', (req, res) => { /* GetStartupConfiguration */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/Startup/Configuration', (req, res) => { /* UpdateInitialConfiguration */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/Startup/FirstUser', (req, res) => { /* GetFirstUser_2 */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/Startup/RemoteAccess', (req, res) => { /* SetRemoteAccess */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/Startup/User', (req, res) => { /* GetFirstUser */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/Startup/User', (req, res) => { /* UpdateStartupUser */ res.status(200).json({ message: 'Not implemented' }); });

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
    app.get('/Items/Suggestions', (req, res) => { /* GetSuggestions */ res.status(200).json({ message: 'Not implemented' }); });

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
    app.get('/System/ActivityLog/Entries', (req, res) => { /* GetLogEntries */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/System/Configuration', (req, res) => { /* GetConfiguration */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/System/Configuration', (req, res) => { /* UpdateConfiguration */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/System/Configuration/Branding', (req, res) => { /* UpdateBrandingConfiguration */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/System/Configuration/MetadataOptions/Default', (req, res) => { /* GetDefaultMetadataOptions */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/System/Configuration/:key', (req, res) => { /* GetNamedConfiguration */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/System/Configuration/:key', (req, res) => { /* UpdateNamedConfiguration */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/System/Endpoint', (req, res) => { /* GetEndpointInfo */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/System/Info', (req, res) => { /* GetSystemInfo */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/System/Info/Public', (req, res) => { /* GetPublicSystemInfo */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/System/Info/Storage', (req, res) => { /* GetSystemStorage */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/System/Logs', (req, res) => { /* GetServerLogs */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/System/Logs/Log', (req, res) => { /* GetLogFile */ res.status(200).json({ message: 'Not implemented' }); });
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
    app.get('/Users/Me', (req, res) => { /* GetCurrentUser */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/Users/New', (req, res) => { /* CreateUserByName */ res.status(200).json({ message: 'Not implemented' }); });
    app.post('/Users/Password', (req, res) => { /* UpdateUserPassword */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/Users/Public', (req, res) => { /* GetPublicUsers */ res.status(200).json({ message: 'Not implemented' }); });
    app.delete('/Users/:userId', (req, res) => { /* DeleteUser */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/Users/:userId', (req, res) => { /* GetUserById */ res.status(200).json({ message: 'Not implemented' }); });
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
    app.get('/UserViews', (req, res) => { /* GetUserViews */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/UserViews/GroupingOptions', (req, res) => { /* GetGroupingOptions */ res.status(200).json({ message: 'Not implemented' }); });

    // === Video ===
    app.post('/Videos/MergeVersions', (req, res) => { /* MergeVersions */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/Videos/:itemId/AdditionalParts', (req, res) => { /* GetAdditionalPart */ res.status(200).json({ message: 'Not implemented' }); });
    app.delete('/Videos/:itemId/AlternateSources', (req, res) => { /* DeleteAlternateSources */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/Videos/:itemId/stream.:container', (req, res) => { /* GetVideoStreamByContainer */ res.status(200).json({ message: 'Not implemented' }); });
    app.head('/Videos/:itemId/stream.:container', (req, res) => { /* HeadVideoStreamByContainer */ res.status(200).json({ message: 'Not implemented' }); });
    app.get('/Videos/:itemId/stream', (req, res) => { /* GetVideoStream */ res.status(200).json({ message: 'Not implemented' }); });
    app.head('/Videos/:itemId/stream', (req, res) => { /* HeadVideoStream */ res.status(200).json({ message: 'Not implemented' }); });
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