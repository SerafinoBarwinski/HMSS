import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { spawn } from "node:child_process";
import crypto from "node:crypto";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateToken } from "./sql.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BIN_PATH = path.resolve(__dirname, "../telerising/api");
const SETTINGS_PATH = path.resolve(__dirname, "../telerising/settings.json");
const CONFIG_FILES_DIR = path.resolve(__dirname, "../telerising/app/static/config_files");

let telerisingProcess = null;
let telerisingPort = 5000;

function getLocalIp() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === "IPv4" && !iface.internal) return iface.address;
        }
    }
    return "localhost";
}

export function killTelerisingProcess() {
    if (telerisingProcess && !telerisingProcess.killed) {
        telerisingProcess.kill("SIGTERM");
    }

} 

process.on("SIGTERM", () => {
    if (telerisingProcess && !telerisingProcess.killed) {
        telerisingProcess.kill("SIGTERM");
    }
});

process.on("SIGINT", () => {
    if (telerisingProcess && !telerisingProcess.killed) {
        telerisingProcess.kill("SIGTERM");
    }
    process.exit(0);
});

function readSettings() {
    try {
        return JSON.parse(readFileSync(SETTINGS_PATH, "utf-8"));
    } catch {
        return null;
    }
}

function writeSettings(data) {
    writeFileSync(SETTINGS_PATH, JSON.stringify(data, null, 4), "utf-8");
}

function getDbUser(getDb, req) {
    const db = getDb();
    const header = req.headers["x-emby-authorization"] || req.headers["authorization"] || "";
    let token = null;
    const embyMatch = header.match(/Token="([^"]+)"/);
    if (embyMatch) token = embyMatch[1];
    const bearerMatch = header.match(/^Bearer\s+(.+)$/i);
    if (bearerMatch) token = bearerMatch[1];
    const queryToken = req.query.accessToken || req.query.api_key;
    if (queryToken) token = queryToken;
    if (!token) return null;
    return validateToken(token, db);
}

export function telerisingRoutes(app, getDb, serverPort) {

    app.get("/telerising/autostart", (req, res) => {
        const user = getDbUser(getDb, req);
        if (!user || user.perms < 3) return res.status(403).json({ error: "Admin access required." });
        const row = getDb().prepare("SELECT telerising_autostart FROM system LIMIT 1").get();
        res.json({ autostart: !!row?.telerising_autostart });
    });

    app.post("/telerising/autostart", (req, res) => {
        const user = getDbUser(getDb, req);
        if (!user || user.perms < 3) return res.status(403).json({ error: "Admin access required." });
        const val = req.body?.autostart === true || req.body?.autostart === "true" || req.body === true;
        getDb().prepare("UPDATE system SET telerising_autostart = ?").run(val ? 1 : 0);
        res.json({ success: true, autostart: val });
    });

    app.get("/telerising/status", (req, res) => {
        const user = getDbUser(getDb, req);
        if (!user || user.perms < 3) return res.status(403).json({ error: "Admin access required." });

        const binExists = existsSync(BIN_PATH) && !!(statSync(BIN_PATH).mode & 0o111);
        const settings = readSettings();
        const configExists = settings !== null;
        const active = telerisingProcess !== null && !telerisingProcess.killed;

        const m3uUrl = active ? `/telerising/live/${settings?.accounts ? Object.keys(settings.accounts)[0] : ""}/channels.m3u` : null;
        res.json({
            binFound: binExists,
            binPath: BIN_PATH,
            configExists,
            active,
            port: active ? telerisingPort : null,
            autostart: !!getDb().prepare("SELECT telerising_autostart FROM system LIMIT 1").get()?.telerising_autostart,
            accountsCount: settings?.accounts ? Object.keys(settings.accounts).length : 0,
            hasPassword: !!(settings?.basic?.password),
            channelsM3U: m3uUrl,
        });
    });

    app.post("/telerising/signup", (req, res) => {
        const user = getDbUser(getDb, req);
        if (!user || user.perms < 3) return res.status(403).json({ error: "Admin access required." });

        const { password } = req.body;
        if (!password || password.length < 8) {
            return res.status(400).json({ error: "Password must be at least 8 characters." });
        }

        let settings = readSettings();
        if (!settings) {
            settings = { accounts: {}, basic: { uuid: crypto.randomUUID(), password } };
        } else {
            if (!settings.basic) settings.basic = {};
            settings.basic.password = password;
        }

        writeSettings(settings);
        res.json({ success: true, message: "Password set." });
    });

    app.post("/telerising/account", (req, res) => {
        const user = getDbUser(getDb, req);
        if (!user || user.perms < 3) return res.status(403).json({ error: "Admin access required." });

        const settings = readSettings();
        if (!settings) return res.status(400).json({ error: "No settings.json. Run signup first." });

        const { id, login, pw, no_auth, manifest_type, bw, audio1, audio2, chnum_start, server } = req.body;
        if (!id || !login || !pw) {
            return res.status(400).json({ error: "Required fields: id, login, pw" });
        }

        if (!settings.accounts) settings.accounts = {};
        settings.accounts[id] = {
            login,
            pw,
            refresh_token: "",
            no_auth: no_auth ?? false,
            manifest_type: manifest_type ?? "dash",
            bw: bw ?? "8000",
            audio1: audio1 ?? "dd1",
            audio2: audio2 ?? "aac1",
            chnum_start: chnum_start ?? "1",
            server: server ?? "auto",
            api_code: "",
            yp_code: "",
        };

        writeSettings(settings);
        res.json({ success: true, accounts: Object.keys(settings.accounts) });
    });

    app.delete("/telerising/account", (req, res) => {
        const user = getDbUser(getDb, req);
        if (!user || user.perms < 3) return res.status(403).json({ error: "Admin access required." });

        const { id } = req.body;
        if (!id) return res.status(400).json({ error: "Required field: id" });

        const settings = readSettings();
        if (!settings?.accounts?.[id]) {
            return res.status(404).json({ error: `Account '${id}' not found.` });
        }

        delete settings.accounts[id];
        writeSettings(settings);
        res.json({ success: true, accounts: Object.keys(settings.accounts) });
    });

    app.get("/telerising/list-provider", (req, res) => {
        const user = getDbUser(getDb, req);
        if (!user || user.perms < 3) return res.status(403).json({ error: "Admin access required." });

        if (!existsSync(CONFIG_FILES_DIR)) {
            return res.json({ providers: [] });
        }

        const files = readdirSync(CONFIG_FILES_DIR).filter(f => f.endsWith(".json"));
        const providers = files.map(f => {
            try {
                const data = JSON.parse(readFileSync(path.join(CONFIG_FILES_DIR, f), "utf-8"));
                return { file: f, name: f.replace("_channels.json", ""), channels: data };
            } catch {
                return { file: f, name: f.replace("_channels.json", ""), channels: null, error: "Failed to parse" };
            }
        });

        res.json({ providers });
    });

    app.post("/telerising/poweron", (req, res) => {
        const user = getDbUser(getDb, req);
        if (!user || user.perms < 3) return res.status(403).json({ error: "Admin access required." });

        if (telerisingProcess && !telerisingProcess.killed) {
            return res.json({ success: true, message: "Already running.", port: telerisingPort });
        }

        if (!existsSync(BIN_PATH)) {
            return res.status(404).json({ error: "Telerising BIN not found at " + BIN_PATH });
        }

        if (!existsSync(SETTINGS_PATH)) {
            return res.status(400).json({ error: "No settings.json. Run signup first." });
        }

        telerisingPort = 5000;

        telerisingProcess = spawn(BIN_PATH, [], {
            cwd: path.resolve(__dirname, "../telerising"),
            stdio: ["ignore", "pipe", "pipe"],
        });

        let started = false;
        telerisingProcess.stdout.on("data", (data) => {
            const line = data.toString();
            if (!started && (line.includes("Running on") || line.includes("Listening") || line.includes(" *"))) {
                started = true;
            }
        });

        telerisingProcess.stderr.on("data", (data) => {
            const line = data.toString();
            if (!started && (line.includes("Running on") || line.includes("Listening"))) {
                started = true;
            }
        });

        telerisingProcess.on("error", (err) => {
            console.error("Telerising process error:", err.message);
            telerisingProcess = null;
        });

        telerisingProcess.on("exit", (code) => {
            console.log(`Telerising process exited with code ${code}`);
            telerisingProcess = null;
        });

        const settings = readSettings();
        const firstProvider = settings?.accounts ? Object.keys(settings.accounts)[0] : null;
        console.log("Telerising started by " + user.name + " on port " + telerisingPort);
        res.json({ success: true, message: "Telerising started.", port: telerisingPort, pid: telerisingProcess.pid, channelsM3U: firstProvider ? `/telerising/live/${firstProvider}/channels.m3u` : null });
    });

    app.post("/telerising/poweroff", (req, res) => {
        const user = getDbUser(getDb, req);
        if (!user || user.perms < 3) return res.status(403).json({ error: "Admin access required." });

        if (!telerisingProcess || telerisingProcess.killed) {
            return res.json({ success: true, message: "Not running." });
        }

        telerisingProcess.kill("SIGTERM");
        telerisingProcess = null;

        console.log("Telerising stopped by " + user.name)
        res.json({ success: true, message: "Telerising stopped." });
    });

    app.get("/telerising/live/:provider/channels.m3u", (req, res) => {
        const { provider } = req.params;
        const settings = readSettings();
        if (!settings?.accounts?.[provider]) {
            return res.status(404).json({ error: `Provider '${provider}' not found in settings.` });
        }

        const upstreamUrl = `http://localhost:${telerisingPort}/api/${provider}/file/channels.m3u`;

        http.get(upstreamUrl, (upstream) => {
            let body = "";
            upstream.on("data", (chunk) => body += chunk);
            upstream.on("end", () => {
                const host = `${getLocalIp()}:${serverPort}`;
                const proto = req.protocol || "http";
                const baseUrl = `${proto}://${host}`;

                const rewritten = body.replace(
                    /http:\/\/[^\/]+\/api\/([^\/]+)\/live\/([^\/\s]+)/g,
                    (match, prov, channel) => `${baseUrl}/telerising/live/${prov}/${channel}`
                );

                res.set("Content-Type", "application/vnd.apple.mpegurl");
                res.set("Cache-Control", "no-cache");
                res.send(rewritten);
            });
        }).on("error", (err) => {
            res.status(502).json({ error: "Failed to reach Telerising.", detail: err.message });
        });
    });

    app.get("/telerising/live/:provider/:channel", (req, res) => {
        const { provider, channel } = req.params;
        const settings = readSettings();
        if (!settings?.accounts?.[provider]) {
            return res.status(404).json({ error: `Provider '${provider}' not found in settings.` });
        }

        const upstreamUrl = `http://localhost:${telerisingPort}/api/${provider}/live/${channel}`;

        http.get(upstreamUrl, (upstream) => {
            const contentType = upstream.headers["content-type"] || "application/octet-stream";

            if (contentType.includes("mpegurl") || contentType.includes("m3u8")) {
                let body = "";
                upstream.on("data", (chunk) => body += chunk);
                upstream.on("end", () => {
                    const host = `${getLocalIp()}:${serverPort}`;
                    const proto = req.protocol || "http";
                    const baseUrl = `${proto}://${host}`;

                    const rewritten = body.replace(
                        /http:\/\/[^\/]+\/api\/([^\/]+)\/live\/([^\/\s]+)/g,
                        (match, prov, ch) => `${baseUrl}/telerising/live/${prov}/${ch}`
                    );

                    res.set("Content-Type", "application/vnd.apple.mpegurl");
                    res.set("Cache-Control", "no-cache");
                    res.send(rewritten);
                });
            } else {
                res.set("Content-Type", contentType);
                if (upstream.headers["cache-control"]) res.set("Cache-Control", upstream.headers["cache-control"]);
                upstream.pipe(res);
            }
        }).on("error", (err) => {
            res.status(502).json({ error: "Failed to reach Telerising stream.", detail: err.message });
        });
    });
}

export function startTelerisingIfAutostart(db) {
    const row = db.prepare("SELECT telerising_autostart FROM system LIMIT 1").get();
    if (!row?.telerising_autostart) return;
    if (!existsSync(BIN_PATH) || !existsSync(SETTINGS_PATH)) return;

    const settings = readSettings();
    const firstProvider = settings?.accounts ? Object.keys(settings.accounts)[0] : null;

    telerisingProcess = spawn(BIN_PATH, [], {
        cwd: path.resolve(__dirname, "../telerising"),
        stdio: ["ignore", "pipe", "pipe"],
    });

    telerisingPort = 5000;

    telerisingProcess.stdout.on("data", (data) => {
        const line = data.toString();
        if (line.includes("Running on") || line.includes("Listening") || line.includes(" *")) {
        }
    });
    console.log("Telerising started (autostart) on port " + telerisingPort);
    if (firstProvider) console.log("Channels M3U: /telerising/live/" + firstProvider + "/channels.m3u");

    telerisingProcess.on("error", (err) => {
        console.error("Telerising autostart error:", err.message);
        telerisingProcess = null;
    });

    telerisingProcess.on("exit", (code) => {
        console.log("Telerising process exited with code " + code);
        telerisingProcess = null;
    });
}
