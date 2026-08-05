import crypto from "node:crypto";
import { createReadStream } from "node:fs";
import { writeFile, mkdir, unlink, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as sql from "./sql.js";

const quickConnectCodes = new Map();
const QC_TIMEOUT_MS = 30 * 1000;

const __authDirname = path.dirname(fileURLToPath(import.meta.url));
const profileDir = path.join(__authDirname, "profilepictures");
await mkdir(profileDir, { recursive: true });

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

export function hashLogoPath(logoPath) {
    let hash = 0;
    for (let i = 0; i < logoPath.length; i++) {
        const ch = logoPath.charCodeAt(i);
        hash = ((hash << 5) - hash) + ch;
        hash |= 0;
    }
    return Math.abs(hash).toString(16).padStart(32, "0");
}

export function resolveUser(db, userId) {
    if (!userId) return null;
    const withDashes = String(userId).replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, "$1-$2-$3-$4-$5");
    const upper = String(userId).toUpperCase();
    return (
        sql.getUserById(db, userId) ||
        sql.getUserById(db, withDashes) ||
        sql.getUserById(db, upper) ||
        sql.getUserById(db, upper.replace(/-/g, ""))
    );
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

        const deviceInfo = {
            AppName: req.body.AppName || "HMSS",
            AppVersion: req.body.AppVersion || "1.0.0",
            DeviceName: req.body.DeviceName || "HMSS",
            DeviceId: req.body.DeviceId || "hmss-server",
        };

        const result = await sql.loginUser(name, password, db, deviceInfo);
        if (!result.success) {
            return res.status(401).json({ error: result.reason });
        }

        const sys = sql.getSystemInfo(db);
        const serverId = sys?.id || "hmss-local";

        const u = sql.getUserById(db, result.user.id);
        const commands = ["MoveUp","MoveDown","MoveLeft","MoveRight","PageUp","PageDown",
            "PreviousLetter","NextLetter","ToggleOsd","ToggleContextMenu","Select","Back",
            "SendKey","SendString","GoHome","GoToSettings","VolumeUp","VolumeDown",
            "Mute","Unmute","ToggleMute","SetVolume","SetAudioStreamIndex",
            "SetSubtitleStreamIndex","DisplayContent","GoToSearch","DisplayMessage",
            "SetRepeatMode","SetShuffleQueue","ChannelUp","ChannelDown",
            "PlayMediaSource","PlayTrailers"];

        res.json({
            User: formatUser(u, serverId, db),
            SessionInfo: {
                PlayState: { CanSeek: false, IsPaused: false, IsMuted: false, RepeatMode: "RepeatNone", PlaybackOrder: "Default" },
                AdditionalUsers: [],
                Capabilities: { PlayableMediaTypes: ["Audio","Video"], SupportedCommands: commands, SupportsMediaControl: true, SupportsPersistentIdentifier: false },
                PlayableMediaTypes: ["Audio","Video"],
                Id: result.accessToken,
                UserId: result.user.id,
                UserName: result.user.name,
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
        const secret = req.query.Secret || req.query.secret || (req.params || {}).Secret;
        res.set("Cache-Control", "no-store");
        if (!secret) return res.json({ Authenticated: false, Error: "Secret required." });

        const entry = [...quickConnectCodes.values()].find(e => e.secret === secret);
        if (!entry || Date.now() - entry.createdAt > QC_TIMEOUT_MS) {
            if (entry) quickConnectCodes.delete(entry.code);
            return res.json({ Authenticated: false });
        }

        if (entry.authorized && entry.userId) {
            quickConnectCodes.delete(entry.code);
            const db = getDb();
            const user = sql.getUserById(db, entry.userId);
            if (!user) return res.json({ Authenticated: false });

            const session = sql.createSession(db, entry.userId, {
                DeviceId: entry.deviceId,
                DeviceName: entry.deviceName,
                AppName: entry.appName,
                AppVersion: entry.appVersion,
            });
            const token = session.accessToken;

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

        const code = req.query?.code || req.body?.code;
        if (!code) return res.status(400).json({ error: "Code required." });

        const entry = quickConnectCodes.get(code);
        if (!entry) return res.status(404).json({ error: "Invalid code." });

        if (Date.now() - entry.createdAt > QC_TIMEOUT_MS) {
            quickConnectCodes.delete(code);
            return res.status(404).json({ error: "Code expired." });
        }

        entry.authorized = true;
        entry.userId = req.user.id;

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

        const user = sql.getUserById(db, entry.userId);
        if (!user) return res.status(404).json({ error: "User not found." });

        const session = sql.createSession(db, entry.userId, {
            DeviceId: entry.deviceId,
            DeviceName: entry.deviceName,
            AppName: entry.appName,
            AppVersion: entry.appVersion,
        });
        const token = session.accessToken;
        quickConnectCodes.delete(entry.code);

        const sys = sql.getSystemInfo(db);
        const serverId = sys?.id || "hmss-local";

        res.json({
            User: formatUser(user, serverId, db),
            SessionInfo: {
                PlayState: { CanSeek: false, IsPaused: false, IsMuted: false, RepeatMode: "RepeatNone", PlaybackOrder: "Default" },
                AdditionalUsers: [],
                Capabilities: { PlayableMediaTypes: ["Audio","Video"], SupportedCommands: [], SupportsMediaControl: true, SupportsPersistentIdentifier: false },
                PlayableMediaTypes: ["Audio","Video"],
                Id: token,
                UserId: user.Id,
                UserName: user.Username,
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
        // extract token from auth header or query
        let token = req.body?.AccessToken;
        if (!token) {
            const authHeader = req.headers["x-emby-authorization"] || req.headers["authorization"] || "";
            const m = authHeader.match(/Token="([^"]+)"/);
            if (m) token = m[1];
        }
        if (!token) token = req.query.api_key || req.query.accessToken;

        if (token) sql.logoutToken(token, db);
        res.status(204).end();
    });

    function formatUser(u, serverId, db) {
        const policy = sql.getUserPolicy(db, u.Id);
        const config = sql.getUserConfiguration(db, u.Id);
        const logoPath = sql.getUserImage(db, u.Id)?.logo_path || null;
        return {
            Name: u.Username,
            ServerId: serverId || "hmss-local",
            Id: u.Id,
            HasPassword: Boolean(u.Password),
            HasConfiguredPassword: Boolean(u.Password),
            HasConfiguredEasyPassword: false,
            EnableAutoLogin: Boolean(u.EnableAutoLogin),
            LastActivityDate: u.LastActivityDate || new Date().toISOString(),
            PrimaryImageTag: logoPath ? hashLogoPath(logoPath) : null,
            Configuration: config,
            Policy: policy,
        };
    }

    app.get("/Users/Public", (req, res) => {
        const db = getDb();
        const sys = sql.getSystemInfo(db);
        const users = sql.getAllUsers(db).filter(u => u.Username !== "root");
        res.json(users.map(u => formatUser(u, sys?.id, db)));
    });

    app.get("/Users", (req, res) => {
        if (!req.user) return res.status(401).json({ error: "Unauthorized." });
        const db = getDb();
        const sys = sql.getSystemInfo(db);
        const users = sql.getAllUsers(db).filter(u => u.Username !== "root");
        res.json(users.map(u => formatUser(u, sys?.id, db)));
    });

    app.get("/Users/:userId", (req, res) => {
        if (!req.user) return res.status(401).json({ error: "Unauthorized." });
        const db = getDb();
        const sys = sql.getSystemInfo(db);
        const user = resolveUser(db, req.params.userId);
        if (!user) return res.status(404).json({ error: "User not found." });

        if (user.Username === "root" && req.user.perms < 3) {
            return res.status(404).json({ error: "User not found." });
        }

        res.json(formatUser(user, sys?.id, db));
    });

    // ---- Profile Pictures ----

    app.post("/UserImage", (req, res) => {
        if (!req.user) return res.status(401).end();
        handleUpload(req, res, req.user.id);
    });

    app.post("/Users/:userId/Images/Primary", (req, res) => {
        if (!req.user) return res.status(401).end();
        const db = getDb();
        const target = resolveUser(db, req.params.userId);
        if (!target) return res.status(404).end();
        const isSelf = target.Id === req.user.id;
        if (!isSelf && req.user.perms < 2) {
            return res.status(403).end();
        }
        handleUpload(req, res, target.Id);
    });

    function handleUpload(req, res, userId) {
        const chunks = [];
        req.on("data", chunk => chunks.push(chunk));
        req.on("end", async () => {
            let buffer = Buffer.concat(chunks);
            if (buffer.length === 0) return res.status(400).end();

            // Jellyfin sends images as base64-encoded text — decode if needed
            const head = buffer.slice(0, Math.min(100, buffer.length)).toString("utf-8", 0, Math.min(100, buffer.length));
            if (head.startsWith("/9j/") || head.startsWith("iVBOR") || head.startsWith("UklGR") || head.startsWith("R0lGOD") || head.includes("base64,")) {
                const b64 = head.includes("base64,") ? head.split("base64,")[1] : buffer.toString("utf-8");
                buffer = Buffer.from(b64.replace(/\s/g, ""), "base64");
            }

            if (buffer.length < 100) { console.warn("Upload too small:", buffer.length, "bytes"); return res.status(400).end(); }

            const ext = detectImageExtFromBuffer(buffer) || ".jpg";
            const filename = `user-${userId}${ext}`;
            const filePath = path.join(profileDir, filename);

            try {
                const db = getDb();
                const realId = resolveUser(db, userId)?.Id;
                if (!realId) return res.status(404).end();

                // delete old profile picture if one exists
                const oldPath = sql.getUserImage(db, realId)?.logo_path;
                if (oldPath) {
                    unlink(path.join(__authDirname, oldPath)).catch(() => {});
                }

                await writeFile(filePath, buffer);
                const relativePath = `profilepictures/${filename}`;
                sql.setUserImage(db, realId, relativePath);
                console.log(`Profile picture saved: ${filePath} (${buffer.length} bytes)`);
                res.status(204).end();
            } catch (e) {
                res.status(500).json({ error: e.message });
            }
        });
    }

    function detectImageExtFromBuffer(buffer) {
        if (buffer[0] === 0xFF && buffer[1] === 0xD8) return ".jpg";
        if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) return ".png";
        if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) return ".webp";
        if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) return ".gif";
        return null;
    }

    function detectImageExt(contentType) {
        if (!contentType) return null;
        if (contentType.includes("png")) return ".png";
        if (contentType.includes("jpeg") || contentType.includes("jpg")) return ".jpg";
        if (contentType.includes("webp")) return ".webp";
        if (contentType.includes("gif")) return ".gif";
        return null;
    }

    app.get("/Users/:userId/Images/Primary", (req, res) => {
        serveUserImage(req, res, getDb());
    });

    app.head("/Users/:userId/Images/Primary", (req, res) => {
        serveUserImage(req, res, getDb(), true);
    });

    app.get("/UserImage", (req, res) => {
        serveUserImage(req, res, getDb());
    });

    app.get("/Users/:userId/Images/Primary", (req, res) => {
        serveUserImage({ params: { userId: req.params.userId }, ...req }, res, getDb());
    });

    app.head("/UserImage", (req, res) => {
        serveUserImage(req, res, getDb(), true);
    });

    app.head("/Users/:userId/Images/Primary", (req, res) => {
        serveUserImage({ params: { userId: req.params.userId }, ...req }, res, getDb(), true);
    });

    function serveUserImage(req, res, db, headOnly = false) {
        const userId = req.params.userId || req.query.userId || req.user?.id;
        if (!userId) return res.status(401).end();

        const user = resolveUser(db, userId);
        if (!user) return res.status(404).end();
        const logoPath = sql.getUserImage(db, user.Id)?.logo_path;
        if (!logoPath) return res.status(404).end();

        const filePath = path.join(__authDirname, logoPath);
        stat(filePath).then(s => {
            const ext = path.extname(filePath);
            const mimeMap = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif" };
            const mime = mimeMap[ext] || "application/octet-stream";
            if (headOnly) { res.set("Content-Type", mime).set("Content-Length", s.size).end(); return; }
            res.set("Content-Type", mime).set("Content-Length", s.size);
            createReadStream(filePath).pipe(res);
        }).catch(() => res.status(404).end());
    }

    app.delete("/UserImage", (req, res) => {
        if (!req.user) return res.status(401).end();
        const db = getDb();
        const logoPath = sql.getUserImage(db, req.user.id)?.logo_path;
        if (!logoPath) return res.status(204).end();

        const filePath = path.join(__authDirname, logoPath);
        unlink(filePath).catch(() => {});
        sql.clearUserImage(db, req.user.id);
        res.status(204).end();
    });
}
