import Database from "better-sqlite3"
import { exit } from "node:process"
import argon2 from "argon2"
import figlet from "figlet"
import express from "express"
import { expectFailure } from "node:test"
import { fileTypeFromFile } from "file-type"

import { enableConsoleFileLogger } from "./src/backend/logger.js"
import * as sql from "./src/backend/sql.js"
import * as integrity from "./src/backend/integrity.js"
import * as webserver from "./src/backend/webserver.js"
import * as scanner from "./src/backend/media_scanner.js"
import * as meta from "./src/backend/media_meta.js"
import * as addonLoader from "./src/backend/addon_loader.js"
import { buildIndex } from "./src/backend/media_indexer.js"
import { organizeShows, organizeMovies, organizeMusic } from "./src/backend/media_organizer.js"
import { startDiscovery } from "./src/backend/discovery.js"
import { spamProtection } from "./src/backend/spam_protection.js"

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
var ffmpeg_bin = "/bin/ffmpeg"
var JPI_Version = "10.11.11" //Jellyfin API Version


const DEBUG_LOG_EVERY_REQUEST = true
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
console.log(figlet.textSync("HMSS", {
    font: "RubiFont",
    horizontalLayout: "default",
    verticalLayout: "default",
    width: 80,
    whitespaceBreak: true,
}));

async function StartMediaIndex() {
    console.log("The indexer has started. This may take a while...")
    const index = await buildIndex(mediaDirs);
    console.log(`Indexed: ${index.shows.length} show episodes, ${index.movies.length} movies, ${index.music.length} tracks, ${index.unsorted.length} unsorted`);
    if (index.errors.length > 0) console.warn(`Index errors: ${index.errors.length}`);
    if (index.unsorted.length > 0) console.log(`Unsorted files (needs organize): ${index.unsorted.length}`);

    // write meta.yaml + download posters for already-organized content
    let orgResult;
    if (index.shows.length > 0) orgResult = await organizeShows(index.shows, { enrich: false, artwork: false });
    if (index.movies.length > 0) orgResult = await organizeMovies(index.movies, { enrich: false, artwork: false });
    if (index.music.length > 0) orgResult = await organizeMusic(index.music);

    if (orgResult) console.log(`Organized: ${orgResult.length} metadata writes`);
    console.log("Indexer done")
    return index;
}

const mediaIndex = await StartMediaIndex();
globalThis.__mediaIndex = mediaIndex;

const addonConfig = {};
const addons = await addonLoader.loadAddons(addonConfig);

const app = express()
app.disable("x-powered-by");
app.use(express.json());
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

// Host jellyfin-web for Jellyfin Mobile
app.use("/web", express.static("web"));

await webserver.jellyfinRoutes(app)
await webserver.addonRoutes(app)

import { WebSocketServer } from "ws";

const server = app.listen(port, "0.0.0.0", () => {
    console.log(`HMSS listening on port ${port}`);
});

const wss = new WebSocketServer({ server, path: "/socket" });

wss.on("connection", (ws, req) => {
    // Extract token from URL query or header
    const url = new URL(req.url, `http://${req.headers.host}`);
    const token = url.searchParams.get("api_key") || url.searchParams.get("accessToken");
    const authHeader = req.headers["authorization"] || "";
    const tokenMatch = authHeader.match(/Token="([^"]+)"/);
    const finalToken = tokenMatch ? tokenMatch[1] : token;

    if (finalToken) {
        const user = sql.validateToken(finalToken, db);
        if (!user) {
            ws.send(JSON.stringify({ MessageType: "ForceKeepAlive", Data: 0 }));
            ws.close();
            return;
        }
    }

    let periodicInterval = null;

    ws.on("message", (data) => {
        try {
            const msg = JSON.parse(data.toString());

            switch (msg.MessageType) {
                case "KeepAlive":
                    ws.send(JSON.stringify({
                        MessageType: "KeepAlive",
                        MessageId: crypto.randomUUID(),
                    }));
                    break;

                case "SessionsStart":
                    parsePeriodic(msg, period => {
                        periodicInterval = setInterval(() => {
                            ws.send(JSON.stringify({
                                MessageType: "Sessions",
                                Data: [],
                                MessageId: crypto.randomUUID(),
                            }));
                        }, period);
                    });
                    break;

                case "SessionsStop":
                case "ActivityLogEntryStop":
                case "ScheduledTasksInfoStop":
                    if (periodicInterval) clearInterval(periodicInterval);
                    periodicInterval = null;
                    break;

                case "ScheduledTasksInfoStart":
                    parsePeriodic(msg, period => {
                        periodicInterval = setInterval(() => {
                            ws.send(JSON.stringify({
                                MessageType: "ScheduledTasksInfo",
                                Data: [],
                                MessageId: crypto.randomUUID(),
                            }));
                        }, period);
                    });
                    break;

                case "ActivityLogEntryStart":
                    parsePeriodic(msg, period => {
                        periodicInterval = setInterval(() => {
                            ws.send(JSON.stringify({
                                MessageType: "ActivityLogEntry",
                                Data: [],
                                MessageId: crypto.randomUUID(),
                            }));
                        }, period);
                    });
                    break;

                default:
                    // unknown message type, ignore
                    break;
            }
        } catch { }
    });

    ws.on("close", () => {
        if (periodicInterval) clearInterval(periodicInterval);
    });

    ws.on("error", () => { });
});

function parsePeriodic(msg, callback) {
    if (typeof msg.Data === "string") {
        const parts = msg.Data.split(",");
        const interval = parseInt(parts[1]) || 5000;
        if (interval > 0) callback(Math.min(interval, 60000));
    } else if (typeof msg.Data === "number" && msg.Data > 0) {
        callback(Math.min(msg.Data, 60000));
    }
}

import crypto from "node:crypto";

startDiscovery(7359, port);