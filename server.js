import Database from "better-sqlite3"
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


// Todo: Add Args instead of Vars!
const DEBUG_LOG_EVERY_REQUEST = false
const DEBUG_LOG_EVERY_WEBSCKT = false;
const DEBUG_fail_integrity_check = false;

// -----
const db = new Database("sql.db");
const init = await sql.init("root", db, argon2)
if (!init.succes) {
    console.log(init.reason + " === " + init.reason || undefined)
    exit(1)
}

const integrityCheck = await integrity.check(DEBUG_fail_integrity_check, db, port, ffmpeg_bin, mediaDirs);
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
const addons = await addonLoader.loadAddons(addonConfig);

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
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Headers", "*");
    res.set("Access-Control-Allow-Methods", "*");
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

await webserver.hmssRoutes(app, getDb, JPI_Version, port, mediaDirs)
await webserver.jellyfinRoutes(app, getDb, JPI_Version, mediaDirs, port)
await webserver.addonRoutes(app)
telerisingRoutes(app, getDb, port)
app.use("/web", express.static("web"));

const server = app.listen(port, "0.0.0.0", async () => {
    console.log(`HMSS listening on port ${port}`);

    try {
        const mediaIndex = await StartMediaIndex();
        globalThis.__mediaIndex = mediaIndex;
    } catch (err) {
        console.error("Media-Index could not been created:", err);
    }

    startTelerisingIfAutostart(db);
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

startDiscovery(7359, port);

