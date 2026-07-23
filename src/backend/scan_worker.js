import { parentPort, workerData } from "node:worker_threads";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileTypeFromFile } from "file-type";

const { dir } = workerData;

async function scanDirectory(dir) {
    const videos = [];
    const audios = [];
    const errors = [];

    async function walk(currentDir) {
        let entries;
        try {
            entries = await readdir(currentDir, { withFileTypes: true });
        } catch (e) {
            errors.push({ path: currentDir, error: e.message });
            return;
        }

        for (const entry of entries) {
            const fullPath = path.join(currentDir, entry.name);

            if (entry.isDirectory()) {
                await walk(fullPath);
                continue;
            }

            try {
                const type = await fileTypeFromFile(fullPath);
                if (!type) continue;
                if (type.mime.startsWith("video/")) videos.push(fullPath);
                if (type.mime.startsWith("audio/")) audios.push(fullPath);
            } catch (e) {
                errors.push({ path: fullPath, error: e.message });
            }
        }
    }

    await walk(dir);
    parentPort.postMessage({ dir, videos, audios, errors });
}

scanDirectory(dir);
