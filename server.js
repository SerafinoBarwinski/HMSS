import Database from "better-sqlite3"
import { exit } from "node:process"
import argon2 from "argon2"
import figlet from "figlet"
import express from "express"
import { expectFailure } from "node:test"
import { fileTypeFromFile } from "file-type";

import { enableConsoleFileLogger } from "./src/backend/logger.js"
import * as sql from "./src/backend/sql.js"
import * as integrity from "./src/backend/integrity.js"
import * as webserver from "./src/backend/webserver.js"
import * as scanner from "./src/backend/media_scanner.js"
import * as meta from "./src/backend/media_meta.js"
import * as addonLoader from "./src/backend/addon_loader.js"

enableConsoleFileLogger("./logs/server.log")
console.log("=".repeat(50))
console.log("The server is starting up...");

// --- Vars

var port = 8000
var mediaDirs = {
    movie: ["./media/movie"],
    music: ["./media/music"],
    shows: ["./media/shows"],
    usort: ["./media/unsorted"],
}
var ffmpeg_bin = "/bin/ffmpeg"


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

const media = await scanner.scanMedia(mediaDirs)

const addonConfig = {}; // TODO: load from config file
const addons = await addonLoader.loadAddons(addonConfig);

const app = express()

await webserver.hmssRoutes(app)
await webserver.jellyfinRoutes(app) 
await webserver.addonRoutes(app)

app.listen(port, () => {
  console.log(`HMSS listening on port ${port}`);
});