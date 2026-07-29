import Database from "better-sqlite3"
import { exec } from "node:child_process"
import { exit } from "node:process"
import argon2 from "argon2"
import figlet from "figlet"
import express from "express"
import { fileTypeFromFile } from "file-type"
import crypto from "node:crypto";

import { enableConsoleFileLogger } from "./src/backend/logger.js"
import * as sql from "./src/backend/sql.js"
import * as integrity from "./src/backend/integrity.js"
import * as webserver from "./src/backend/webserver.js"
import * as scanner from "./src/backend/media_scanner.js"
import * as meta from "./src/backend/media_meta.js"
import * as addonLoader from "./src/backend/addon_loader.js"
import { buildIndex } from "./src/backend/media_indexer.js"
import { organizeShows, organizeMovies, organizeMusic } from "./src/backend/media_organizer.js"
import { spamProtection } from "./src/backend/spam_protection.js"
import { telerisingRoutes, startTelerisingIfAutostart } from "./src/backend/telerising.js"
import { startDiscovery } from "./src/backend/discovery.js"
import { WebSocketServer } from "ws";

enableConsoleFileLogger("./logs/server.log")
console.log("=".repeat(50))
console.log("The server is starting up...");

// --- Vars
var port = 8000
var mediaDirs = {
    movie: ["./media/movie"],
    music: ["./media/music"],
    shows: ["./media/shows"],
    unsorted: ["./media/unsorted"],
}
var ffmpeg_bin = "/bin/ffmpeg" //Fallback FFMPEG Path Arg
var JPI_Version = "10.11.11" //Jellyfin API Version

var DEBUG_LOG_EVERY_REQUEST = false
var DEBUG_LOG_EVERY_WEBSCKT = false;
var DEBUG_fail_integrity_check = false;
var DEBUG_skip_integrity_check = false;
var DEBUG_TEA_POT = false;
var DEBUG_ACCEPT_CLIENT_REMOTE_DEBUG = true;

var is_server_ready = false;
var ServerUptime = 0;

export {
    DEBUG_LOG_EVERY_REQUEST,
    DEBUG_LOG_EVERY_WEBSCKT,
    DEBUG_ACCEPT_CLIENT_REMOTE_DEBUG,
    is_server_ready, ServerUptime
}

const args = process.argv.slice(2);

for (const arg of args) {
    switch (arg) {
        case "--port":
            port = parseInt(process.argv[3]) || port;
            break;
        case "--ffmpeg-bin":
            ffmpeg_bin = process.argv[3] || ffmpeg_bin;
            if (!process.argv[3].includes("/") && !process.argv[3].includes("\\")) {
                console.error("Invalid FFMPEG binary path. Defaulting to /bin/ffmpeg");
                ffmpeg_bin = "/bin/ffmpeg";
            }
            if (!fs.existsSync(ffmpeg_bin)) {
                console.error("FFMPEG binary not found at specified path:", ffmpeg_bin, ". Defaulting to /bin/ffmpeg");
                ffmpeg_bin = "/bin/ffmpeg";
            }
            break;
        case "--debug":
            console.log("Debug-Mode active");
            DEBUG_LOG_EVERY_REQUEST = true;
            DEBUG_LOG_EVERY_WEBSCKT = true;
            break;
        case "--fail-integrity-check":
            DEBUG_fail_integrity_check = true;
            break;
        case "--skip-integrity-check":
            DEBUG_skip_integrity_check = true;
            break;
        case "--i-am-a-tea-pot":
            console.error("☕️ I'm a teapot! (418)");
            DEBUG_TEA_POT = true;
            break;
        default:
            console.log(`Unknown argument(s): ${arg}`);
    }
}

// -----
const db = new Database("sql.db");
const init = await sql.init("root", db, argon2)
if (!init.succes) {
    console.log(init.reason + " === " + init.reason || undefined)
    exit(1)
}

// Check integrity of the database and media files, except if the user has explicitly requested to skip the check.
const integrityCheck = DEBUG_skip_integrity_check ? { success: true } : await integrity.check(DEBUG_fail_integrity_check, db, port, ffmpeg_bin, mediaDirs);
if (!integrityCheck.success) {
    console.warn("Integrity check failed:");
    integrityCheck.reasons.forEach(element => {
        console.error("\t" + element)
    });
    exit(1)
}
console.log("Integrity check passed.");
console.log(figlet.textSync("\nHMSS", {
    font: "RubiFont",
    horizontalLayout: "default",
    verticalLayout: "default",
    width: 80,
    whitespaceBreak: true,
}));


const addonConfig = {};
export const addons = await addonLoader.loadAddons(addonConfig);

export async function StartMediaIndex() {
    console.log("The indexer has started. This may take a while...")
    const index = await buildIndex(mediaDirs);
    console.log(`Indexed: ${index.shows.length} show episodes, ${index.movies.length} movies, ${index.music.length} tracks, ${index.unsorted.length} unsorted`);
    if (index.errors.length > 0) console.warn(`Index errors: ${index.errors.length}`);
    if (index.unsorted.length > 0) console.log(`Unsorted files (needs organize): ${index.unsorted.length}`);

    // write meta.yaml + download posters for already-organized content
    let orgResult;
    if (index.shows.length > 0) orgResult = await organizeShows(index.shows, { enrich: true, artwork: true });
    if (index.movies.length > 0) orgResult = await organizeMovies(index.movies, { enrich: true, artwork: true });
    if (index.music.length > 0) orgResult = await organizeMusic(index.music);

    if (orgResult) console.log(`Organized: ${orgResult.length} metadata writes`);
    console.log("Indexer done")
    return index;
}

const app = express()
app.disable("x-powered-by");
app.use(express.json());
app.set('trust proxy', true);
app.use(spamProtection({ windowMs: 60000, maxRequests: 100 }));
app.use((req, res, next) => {
    res.set("Server", "Kestrel");
    next();
});
app.use((req, res, next) => {

    // Very important!
    if (DEBUG_TEA_POT) {
        switch (req.get("Content-Type")) {
            case "application/json":
                res.status(418).json({ error: "☕️ I'm a teapot" });
                return;
            case "text/html":
                res.status(418).send("<h1>☕️ I'm a teapot</h1>");
                return;
            default:
                res.status(418).send("☕️ I'm a teapot");
                return;
        }
    }

    if (!is_server_ready) {
        res.status(425).send("Server is starting up, please wait a moment...\nGo watch some Anime or something while you wait. :)");
        return;
    }

    // Enforce HTTP/1.1 or higher
    const major = req.httpVersionMajor;
    if (major < 1 || (major === 1 && req.httpVersionMinor < 1)) {
        return res.status(505).send("HTTP Version Not Supported");
    }

    // CORS headers
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Headers", "*");
    res.set("Access-Control-Allow-Methods", "*");

    // Handle preflight requests
    if (req.method === "OPTIONS") return res.status(204).end();

    next();
});

if (DEBUG_LOG_EVERY_REQUEST) {
    app.use((req, res, next) => {
        const start = Date.now();
        if (!req.originalUrl.includes("/web")) {
            res.on("finish", () => {
                console.log(`${req.method} ${req.originalUrl} → ${res.statusCode} (${Date.now() - start}ms)`);
                // to debug for specific clients:
                if (req.originalUrl === "/" || req.originalUrl === "/web/index.html") {
                    console.log("  User-Agent:", req.headers["user-agent"]?.substring(0, 80));
                    console.log("  Accept:", req.headers["accept"]?.substring(0, 80));
                }
            });
        }
        next();
    });
}

const getDb = () => db;
globalThis.__db = db;
globalThis.__hmssDebugAcceptRemote = DEBUG_ACCEPT_CLIENT_REMOTE_DEBUG;

await webserver.hmssRoutes(app, getDb, JPI_Version, port, mediaDirs)
await webserver.jellyfinRoutes(app, getDb, JPI_Version, mediaDirs, port)
await webserver.addonRoutes(app)
telerisingRoutes(app, getDb, port)

// HMSS injection: patch index.html at serve time so Jellyfin web files stay vanilla
import { readFileSync as _readFileSync } from "node:fs";
const _hmssInjectionScript = '<script src="/web/hmss/jellyfin-injection.js"></script>';
const _hmssInjectionCSS = '<link href="/web/hmss/themeoption.css" rel="stylesheet">';
app.use("/web", (req, res, next) => {
    // Only patch Jellyfin's vanilla index.html - alt_index.html is ours
    if (req.path !== "/index.html") return next();
    try {
        const html = _readFileSync("web/index.html", "utf-8")
            .replace("</head>", `${_hmssInjectionCSS}\n</head>`)
            .replace("</body>", `${_hmssInjectionScript}\n</body>`);
        res.set("Content-Type", "text/html; charset=utf-8");
        res.send(html);
    } catch {
        next();
    }
});

app.use("/web", express.static("web"));

const server = app.listen(port, "0.0.0.0", async () => {
    console.log(`HMSS listening on port ${port}`);

    startTelerisingIfAutostart(db);

    try {
        const mediaIndex = await StartMediaIndex();
        globalThis.__mediaIndex = mediaIndex;
    } catch (err) {
        console.error("Media-Index could not been created:", err);
    }

    is_server_ready = true;
});

const wss = new WebSocketServer({ server, path: "/socket" });

const wsClients = new Set();

function sendToAllClients(messageType, data = null) {
    const msg = { messageType, messageId: crypto.randomUUID() };
    if (data !== null) msg.data = data;
    const payload = JSON.stringify(msg);
    wsClients.forEach(client => {
        if (client.readyState === 1) client.send(payload);
    });
}

function sendToUser(userId, messageType, data = null) {
    const msg = { messageType, messageId: crypto.randomUUID() };
    if (data !== null) msg.data = data;
    const payload = JSON.stringify(msg);
    wsClients.forEach(client => {
        if (client.readyState === 1 && client._userId === userId) client.send(payload);
    });
}

wss.on("connection", (ws, req) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const token = url.searchParams.get("api_key") || url.searchParams.get("accessToken");
    const authHeader = req.headers["authorization"] || "";
    const tokenMatch = authHeader.match(/Token="([^"]+)"/);
    const finalToken = tokenMatch ? tokenMatch[1] : token;

    let user = null;
    if (finalToken) {
        user = sql.validateToken(finalToken, db);
        if (!user) {
            ws.send(JSON.stringify({ messageType: "ForceKeepAlive", messageId: crypto.randomUUID(), data: 0 }));
            ws.close();
            return;
        }
        ws._userId = user.id;
        ws._token = finalToken;
        wsClients.add(ws);
    } else {
        ws.send(JSON.stringify({ messageType: "ForceKeepAlive", messageId: crypto.randomUUID(), data: 0 }));
        ws.close();
        return;
    }

    const intervals = new Set();
    let heartbeatInterval = null;

    ws.send(JSON.stringify({
        messageType: "Sessions",
        data: [{
            id: crypto.randomUUID(),
            userId: user.id,
            userName: user.username,
            deviceId: "hmss-server",
            deviceName: "HMSS",
            isActive: true,
            playState: { positionTicks: 0, isPaused: false }
        }],
        messageId: crypto.randomUUID()
    }));

    ws.on("message", (data) => {
        try {
            const msg = JSON.parse(data.toString());
            if (DEBUG_LOG_EVERY_WEBSCKT) console.log("[WS-FR]:", msg.messageType);

            switch (msg.messageType) {
                case "KeepAlive":
                    ws.send(JSON.stringify({
                        messageType: "ForceKeepAlive",
                        messageId: crypto.randomUUID(),
                        data: 30
                    }));
                    break;

                case "SessionsStart":
                    parsePeriodic(msg, period => {
                        const id = setInterval(() => {
                            if (ws.readyState !== 1) return;
                            ws.send(JSON.stringify({
                                messageType: "Sessions",
                                data: [{
                                    id: crypto.randomUUID(),
                                    userId: user.id,
                                    userName: user.username,
                                    deviceId: "hmss-server",
                                    deviceName: "HMSS",
                                    isActive: true,
                                    playState: { positionTicks: 0, isPaused: false }
                                }],
                                messageId: crypto.randomUUID()
                            }));
                        }, period);
                        intervals.add(id);
                    });
                    break;

                case "SessionsStop":
                    intervals.forEach(id => clearInterval(id));
                    intervals.clear();
                    break;

                case "ScheduledTasksInfoStart":
                    parsePeriodic(msg, period => {
                        const id = setInterval(() => {
                            if (ws.readyState !== 1) return;
                            ws.send(JSON.stringify({
                                messageType: "ScheduledTasksInfo",
                                data: [],
                                messageId: crypto.randomUUID()
                            }));
                        }, period);
                        intervals.add(id);
                    });
                    break;

                case "ScheduledTasksInfoStop":
                    intervals.forEach(id => clearInterval(id));
                    intervals.clear();
                    break;

                case "ActivityLogEntryStart":
                    parsePeriodic(msg, period => {
                        const id = setInterval(() => {
                            if (ws.readyState !== 1) return;
                            ws.send(JSON.stringify({
                                messageType: "ActivityLogEntry",
                                data: [],
                                messageId: crypto.randomUUID()
                            }));
                        }, period);
                        intervals.add(id);
                    });
                    break;

                case "ActivityLogEntryStop":
                    intervals.forEach(id => clearInterval(id));
                    intervals.clear();
                    break;

                default:
                    break;
            }
        } catch { }
    });

    ws.on("close", () => {
        wsClients.delete(ws);
        intervals.forEach(id => clearInterval(id));
        intervals.clear();
        if (heartbeatInterval) clearInterval(heartbeatInterval);
    });

    ws.on("error", () => {
        wsClients.delete(ws);
    });
});

function parsePeriodic(msg, callback) {
    if (typeof msg.data === "string") {
        const parts = msg.data.split(",");
        const interval = parseInt(parts[1]) || 5000;
        if (interval > 0) callback(Math.min(interval, 60000));
    } else if (typeof msg.data === "number" && msg.data > 0) {
        callback(Math.min(msg.data, 60000));
    }
}

globalThis.__wsSendToAll = sendToAllClients;
globalThis.__wsSendToUser = sendToUser;

globalThis.__startMediaIndex = StartMediaIndex;
globalThis.__refreshEpg = function () { return Promise.resolve(); };

startDiscovery(7359, port);

import cron from "node-cron";
import * as transcoder from "./src/backend/transcoder.js";
cron.schedule("0 0 */3 * * *", () => {
    console.log("[Auto-Update] Checking for updates via git pull...");
    exec("LANG=en_US.UTF-8 git pull", { cwd: process.cwd() }, (err, stdout, stderr) => {
        if (err) {
            console.error("[Auto-Update] git pull failed:", stderr);
            return;
        }
        const output = stdout.trim();
        console.log("[Auto-Update]", output);
        if (!output.includes("Updating")) return;

        const transcodeCount = transcoder.getActiveSessions().size;
        const directPlayCount = globalThis.__activeDirectPlayStreams || 0;
        if (transcodeCount > 0 || directPlayCount > 0) {
            console.log(`[Auto-Update] Update available but ${transcodeCount} transcode(s) and ${directPlayCount} direct play(s) active — will restart later.`);
            return;
        }
        console.log("[Auto-Update] No active streams — restarting...");
        setTimeout(() => process.exit(0), 1000);
    });
});