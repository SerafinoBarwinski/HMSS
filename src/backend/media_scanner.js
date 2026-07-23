import { Worker } from "node:worker_threads";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function scanMedia(mediaDirs) {
    const dirs = [];
    for (const [, values] of Object.entries(mediaDirs)) {
        for (const dir of values) {
            dirs.push(dir);
        }
    }

    const workers = dirs.map(dir =>
        new Promise((resolve, reject) => {
            const worker = new Worker(
                path.join(__dirname, "scan_worker.js"),
                { workerData: { dir } }
            );
            worker.on("message", resolve);
            worker.on("error", reject);
        })
    );

    const results = await Promise.all(workers);

    const videos = [];
    const audios = [];
    const errors = [];

    for (const result of results) {
        videos.push(...result.videos);
        audios.push(...result.audios);
        errors.push(...result.errors);
    }

    return { videos, audios, errors };
}
