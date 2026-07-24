import * as sql from "./sql.js";
import * as fs from "node:fs/promises";
import { constants, existsSync} from "node:fs";
import * as path from "node:path";
import * as net from "node:net";
import { spawn } from "node:child_process";

// Hey user – I don't recommend changing the line below, as it could have unintended side effects.
const MAX_LOG_LINES = 10000;

export async function check(DEBUG_fail_integrity_check = false, db, port, ffmpeg_bin, mediaDirs) {
    const failedModules = [];
    if (DEBUG_fail_integrity_check) failedModules.push("DEBUG_fail_integrity_check is true")
    await filesystemPermissionsTest(failedModules, mediaDirs);
    await logLengthTest(failedModules);
    await portAvailabilityTest(failedModules, port);
    await ffmpegAvailableTest(failedModules, ffmpeg_bin);

    const success = failedModules.length === 0;
    return { success, reasons: failedModules };
}

export async function filesystemPermissionsTest(failedModules, mediaDirs) {
    const dirs = ["src/backend/logs"];
    if (mediaDirs) {
        for (const values of Object.values(mediaDirs)) {
            if (Array.isArray(values)) dirs.push(...values);
        }
    }

    for (const dir of dirs) {
        await ensureDir(dir, failedModules);
        if (failedModules.length > 0 && failedModules[failedModules.length - 1].startsWith("Cannot")) {
            continue;
        }

        try {
            await fs.access(dir, constants.R_OK | constants.W_OK);
        } catch {
            failedModules.push(`No read/write access to directory: ${dir}`);
            continue;
        }

        await checkDirRecursive(dir, failedModules);
    }
}

export async function ensureDir(dir, failedModules) {
    if (existsSync(dir)) return;
    try {
        console.log(`Media folder ${dir} is being created.`)
        await fs.mkdir(dir, { recursive: true });
    } catch {
        failedModules.push(`Cannot create directory: ${dir}`);
    }
}

export async function checkDirRecursive(dir, failedModules, baseDir = dir) {
    let entries;
    try {
        entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
        failedModules.push(`Cannot read directory: ${dir}`);
        return;
    }

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        try {
            await fs.access(fullPath, constants.R_OK | constants.W_OK);
        } catch {
            failedModules.push(`No read/write access: ${fullPath}`);
        }

        if (entry.isDirectory()) {
            await checkDirRecursive(fullPath, failedModules, baseDir);
        }
    }
}

async function logLengthTest(failedModules) {
    const logDir = "src/backend/logs";
    let logFiles;
    try {
        logFiles = (await fs.readdir(logDir)).filter(f => f.endsWith(".log"));
    } catch {
        return;
    }

    for (const file of logFiles) {
        const filePath = path.join(logDir, file);
        let content;
        try {
            content = await fs.readFile(filePath, "utf-8");
        } catch {
            failedModules.push(`Cannot read log file: ${filePath}`);
            continue;
        }

        const lines = content.split("\n");
        if (lines.length <= MAX_LOG_LINES) continue;

        console.log(`Log file '${file}' has ${lines.length} lines (> ${MAX_LOG_LINES}), truncating...`);
        const trimmed = lines.slice(-MAX_LOG_LINES).join("\n");

        try {
            await fs.writeFile(filePath, trimmed, "utf-8");
            console.log(`Log file '${file}' truncated to ${MAX_LOG_LINES} lines.`);
        } catch {
            failedModules.push(`Cannot truncate log file: ${filePath}`);
        }
    }
}

async function portAvailabilityTest(failedModules, port) {
    return new Promise((resolve) => {
        const server = net.createServer();
        server.unref();

        server.once("error", (err) => {
            if (err.code === "EACCES") {
                failedModules.push(`No permission to bind to port ${port} (EACCES). Try a port >= 1024 or run with elevated privileges.`);
            } else if (err.code === "EADDRINUSE") {
                failedModules.push(`Port ${port} is already in use.`);
            } else {
                failedModules.push(`Cannot bind to port ${port}: ${err.message}`);
            }
            resolve();
        });

        server.once("listening", () => {
            server.close(() => resolve());
        });

        server.listen(port);
    });
}

async function ffmpegAvailableTest(failedModules, ffmpeg_bin) {
    return new Promise((resolve) => {
        const proc = spawn(`${ffmpeg_bin}`, ["-version"], { stdio: "ignore" });

        proc.on("error", (err) => {
            if (err.code === "ENOENT") {
                failedModules.push("ffmpeg not found in PATH.");
            } else {
                failedModules.push(`ffmpeg check failed: ${err.message}`);
            }
            resolve();
        });

        proc.on("close", (code) => {
            if (code !== 0) {
                failedModules.push(`ffmpeg exited with code ${code}.`);
            }
            resolve();
        });
    });
}