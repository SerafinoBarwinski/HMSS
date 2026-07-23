import argon2 from "argon2";
import crypto from "node:crypto";
import * as sql from "./sql.js";

const quickConnectCodes = new Map();
const QC_TIMEOUT_MS = 30 * 1000;

export function authMiddleware(getDb) {
    return (req, res, next) => {
        const db = getDb();
        const header = req.headers["x-emby-authorization"] || req.headers["authorization"] || "";

        let token = null;
        const embyMatch = header.match(/Token="([^"]+)"/);
        if (embyMatch) token = embyMatch[1];

        const bearerMatch = header.match(/^Bearer\s+(.+)$/i);
        if (bearerMatch) token = bearerMatch[1];

        const queryToken = req.query.accessToken || req.query.api_key;
        if (queryToken) token = queryToken;

        if (!token) {
            req.user = null;
            return next();
        }

        const user = sql.validateToken(token, db);
        req.user = user;
        next();
    };
}

export function requireAuth(req, res, next) {
    if (!req.user) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    next();
}

export function hmssAuthRoutes(app, getDb) {
    app.post("/Users/AuthenticateByName", async (req, res) => {
        const db = getDb();
        const { Username, Pw, Password } = req.body;
        const name = Username || req.body.username;
        const password = Pw || Password || req.body.password;

        if (!name || !password) {
            return res.status(400).json({ error: "Username and password required." });
        }

        const result = await sql.loginUser(name, password, db, argon2);
        if (!result.success) {
            return res.status(401).json({ error: result.reason });
        }

        const sys = sql.getSystemInfo(db);
        const serverId = sys?.id || "hmss-local";

        const u = db.prepare("SELECT * FROM users WHERE name = ?").get(name);
        const commands = ["MoveUp","MoveDown","MoveLeft","MoveRight","PageUp","PageDown",
            "PreviousLetter","NextLetter","ToggleOsd","ToggleContextMenu","Select","Back",
            "SendKey","SendString","GoHome","GoToSettings","VolumeUp","VolumeDown",
            "Mute","Unmute","ToggleMute","SetVolume","SetAudioStreamIndex",
            "SetSubtitleStreamIndex","DisplayContent","GoToSearch","DisplayMessage",
            "SetRepeatMode","SetShuffleQueue","ChannelUp","ChannelDown",
            "PlayMediaSource","PlayTrailers"];

        res.json({
            User: formatUser(u, serverId),
            SessionInfo: {
                PlayState: { CanSeek: false, IsPaused: false, IsMuted: false, RepeatMode: "RepeatNone", PlaybackOrder: "Default" },
                AdditionalUsers: [],
                Capabilities: { PlayableMediaTypes: ["Audio","Video"], SupportedCommands: commands, SupportsMediaControl: true, SupportsPersistentIdentifier: false },
                PlayableMediaTypes: ["Audio","Video"],
                Id: result.accessToken,
                UserId: u.uuid || u.id,
                UserName: u.name,
                Client: "HMSS",
                LastActivityDate: new Date().toISOString(),
                LastPlaybackCheckIn: "0001-01-01T00:00:00.0000000Z",
                DeviceName: "HMSS",
                DeviceId: "hmss-server",
                ApplicationVersion: "10.11.11",
                IsActive: true,
                SupportsMediaControl: false,
                SupportsRemoteControl: false,
                NowPlayingQueue: [],
                NowPlayingQueueFullItems: [],
                HasCustomDeviceName: false,
                ServerId: serverId,
                SupportedCommands: commands,
            },
            AccessToken: result.accessToken,
            ServerId: serverId,
        });
    });

    app.post("/QuickConnect/Initiate", (req, res) => {
        const code = crypto.randomInt(100000, 999999).toString();
        const secret = crypto.randomInt(100000, 999999).toString();

        quickConnectCodes.set(code, {
            secret,
            userId: null,
            createdAt: Date.now(),
            authorized: false,
            deviceId: req.body?.DeviceId || "unknown",
            deviceName: req.body?.DeviceName || "Unknown Device",
            appName: req.body?.AppName || "HMSS",
            appVersion: req.body?.AppVersion || "1.0.0",
        });

        console.log(`Quick Connect code generated: ${code}`);

        res.json({
            Authenticated: false,
            Secret: secret,
            Code: code,
            DeviceId: req.body?.DeviceId || "unknown",
            DeviceName: req.body?.DeviceName || "Unknown Device",
            AppName: req.body?.AppName || "HMSS",
            AppVersion: req.body?.AppVersion || "1.0.0",
            DateAdded: new Date().toISOString(),
        });
    });

    app.get("/QuickConnect/Connect", (req, res) => {
        const { secret } = req.query;
        if (!secret) return res.status(400).json({ error: "Secret required." });

        const entry = [...quickConnectCodes.values()].find(e => e.secret === secret);
        if (!entry) return res.status(404).json({ error: "Unknown secret." });

        if (Date.now() - entry.createdAt > QC_TIMEOUT_MS) {
            quickConnectCodes.delete(entry.code);
            return res.status(404).json({ error: "Code expired." });
        }

        if (entry.authorized && entry.userId) {
            quickConnectCodes.delete(entry.code);
            const db = getDb();
            const token = crypto.randomUUID();
            const user = db.prepare("SELECT * FROM users WHERE id = ?").get(entry.userId);
            if (!user) return res.status(404).json({ error: "User not found." });

            db.prepare("INSERT INTO sessions (token, user_id) VALUES (?, ?)").run(token, user.id);

            res.json({
                Authenticated: true,
                Secret: secret,
                Code: entry.code,
                DeviceId: entry.deviceId || "unknown",
                DeviceName: entry.deviceName || "Unknown Device",
                AppName: entry.appName || "HMSS",
                AppVersion: entry.appVersion || "1.0.0",
                DateAdded: new Date(entry.createdAt).toISOString(),
            });
        } else {
            res.json({
                Authenticated: false,
                Secret: secret,
                Code: entry.code,
                DeviceId: entry.deviceId || "unknown",
                DeviceName: entry.deviceName || "Unknown Device",
                AppName: entry.appName || "HMSS",
                AppVersion: entry.appVersion || "1.0.0",
                DateAdded: new Date(entry.createdAt).toISOString(),
            });
        }
    });

    app.post("/QuickConnect/Authorize", (req, res) => {
        if (!req.user) return res.status(401).json({ error: "Must be logged in to authorize Quick Connect." });

        const { code } = req.body;
        if (!code) return res.status(400).json({ error: "Code required." });

        const entry = quickConnectCodes.get(code);
        if (!entry) return res.status(404).json({ error: "Invalid code." });

        if (Date.now() - entry.createdAt > QC_TIMEOUT_MS) {
            quickConnectCodes.delete(code);
            return res.status(404).json({ error: "Code expired." });
        }

        entry.authorized = true;
        entry.userId = parseInt(req.user.id);

        console.log(`Quick Connect code ${code} authorized by user ${req.user.name}`);

        res.json({ Granted: true });
    });

    app.get("/QuickConnect/Enabled", (req, res) => {
        res.json(true);
    });

    app.post("/Users/AuthenticateWithQuickConnect", (req, res) => {
        const db = getDb();
        const { Secret } = req.body;
        if (!Secret) return res.status(400).json({ error: "Secret required." });

        const entry = [...quickConnectCodes.values()].find(e => e.secret === Secret);
        if (!entry || !entry.authorized || !entry.userId) {
            return res.status(401).json({ error: "Quick Connect not authorized." });
        }

        const user = db.prepare("SELECT * FROM users WHERE id = ?").get(entry.userId);
        if (!user) return res.status(404).json({ error: "User not found." });

        const token = crypto.randomUUID();
        db.prepare("INSERT INTO sessions (token, user_id) VALUES (?, ?)").run(token, user.id);
        quickConnectCodes.delete(entry.code);

        const sys = sql.getSystemInfo(db);
        const serverId = sys?.id || "hmss-local";

        res.json({
            User: formatUser(user, serverId),
            SessionInfo: {
                PlayState: { CanSeek: false, IsPaused: false, IsMuted: false, RepeatMode: "RepeatNone", PlaybackOrder: "Default" },
                AdditionalUsers: [],
                Capabilities: { PlayableMediaTypes: ["Audio","Video"], SupportedCommands: [], SupportsMediaControl: true, SupportsPersistentIdentifier: false },
                PlayableMediaTypes: ["Audio","Video"],
                Id: token,
                UserId: user.uuid || user.id,
                UserName: user.name,
                Client: "HMSS Quick Connect",
                LastActivityDate: new Date().toISOString(),
                LastPlaybackCheckIn: "0001-01-01T00:00:00.0000000Z",
                DeviceName: entry.deviceName || "Unknown",
                DeviceId: entry.deviceId || "unknown",
                ApplicationVersion: entry.appVersion || "1.0.0",
                IsActive: true,
                SupportsMediaControl: false,
                SupportsRemoteControl: false,
                NowPlayingQueue: [],
                NowPlayingQueueFullItems: [],
                HasCustomDeviceName: false,
                ServerId: serverId,
                SupportedCommands: [],
            },
            AccessToken: token,
            ServerId: serverId,
        });
    });

    app.post("/Users/ForgotPassword", (req, res) => {
        res.status(501).json({ error: "Not implemented." });
    });

    app.post("/Users/ForgotPassword/Pin", (req, res) => {
        res.status(501).json({ error: "Not implemented." });
    });

    app.post("/Sessions/Logout", (req, res) => {
        const db = getDb();
        const token = req.user?.token || req.body.AccessToken;
        if (token) sql.logoutToken(token, db);
        res.json({});
    });

    function formatUser(u, serverId) {
        const p = u.perms;
        const isAdmin = p >= 2;
        const isRoot = p >= 3;
        return {
            Name: u.name,
            ServerId: serverId || "hmss-local",
            Id: u.uuid || u.id || "",
            HasPassword: true,
            HasConfiguredPassword: true,
            HasConfiguredEasyPassword: false,
            EnableAutoLogin: false,
            LastActivityDate: new Date().toISOString(),
            Configuration: {
                PlayDefaultAudioTrack: true,
                SubtitleLanguagePreference: "",
                DisplayMissingEpisodes: false,
                GroupedFolders: [],
                SubtitleMode: "Default",
                DisplayCollectionsView: false,
                EnableLocalPassword: false,
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
                EnableCollectionManagement: false,
                EnableSubtitleManagement: false,
                EnableLyricManagement: false,
                IsDisabled: false,
                BlockedTags: [],
                AllowedTags: [],
                EnableUserPreferenceAccess: true,
                AccessSchedules: [],
                BlockUnratedItems: [],
                EnableRemoteControlOfOtherUsers: p >= 2,
                EnableSharedDeviceControl: true,
                EnableRemoteAccess: p >= 1,
                EnableLiveTvManagement: false,
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
                LoginAttemptsBeforeLockout: -1,
                MaxActiveSessions: 0,
                EnablePublicSharing: true,
                BlockedMediaFolders: [],
                BlockedChannels: [],
                RemoteClientBitrateLimit: 0,
                AuthenticationProviderId: "Jellyfin.Server.Implementations.Users.DefaultAuthenticationProvider",
                PasswordResetProviderId: "Jellyfin.Server.Implementations.Users.DefaultPasswordResetProvider",
                SyncPlayAccess: "CreateAndJoinGroups",
            },
        };
    }

    app.get("/Users/Public", (req, res) => {
        const db = getDb();
        const sys = sql.getSystemInfo(db);
        const users = db.prepare("SELECT * FROM users WHERE name != 'root' ORDER BY id").all();
        res.json(users.map(u => formatUser(u, sys?.id)));
    });

    app.get("/Users", (req, res) => {
        if (!req.user) return res.status(401).json({ error: "Unauthorized." });
        const db = getDb();
        const sys = sql.getSystemInfo(db);
        const users = db.prepare("SELECT * FROM users WHERE name != 'root' ORDER BY id").all();
        res.json(users.map(u => formatUser(u, sys?.id)));
    });
}
