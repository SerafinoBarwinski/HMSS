import Database from "better-sqlite3";
import { writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, "crunchyroll.db");

const IMG_BASE = "https://imgsrv.crunchyroll.com/cdn-cgi/image/fit=contain,format=auto,quality=100,width=1920,blur=0/keyart";

const IMAGE_TYPES = [
    "backdrop_wide",
    "poster_tall",
    "poster_wide",
    "keyart",
    "thumbnail",
    "thumbnail_wide",
    "logo",
];

let db = null;

export async function init(config) {
    try {
        db = new Database(DB_PATH, { readonly: true });
        if (config?.verbose) console.log(`Crunchyroll addon: loaded ${db.prepare("SELECT COUNT(*) as n FROM series").get().n} series`);
    } catch (e) {
        console.warn(`Crunchyroll addon: failed to open DB — ${e.message}`);
    }
}

function normalize(str) {
    return (str || "")
        .replace(/^watch\s+/i, "")
        .replace(/[:\-_''".,!?()[\]]/g, " ")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();
}

export function findSeries(query) {
    if (!db || !query) return [];
    const q = query.trim();
    if (!q) return [];

    const isId = /^[A-Za-z0-9]{7,10}$/.test(q);
    if (isId) {
        const exact = db.prepare("SELECT id, title FROM series WHERE id = ?").all(q);
        if (exact.length > 0) return exact;
    }

    const normalized = normalize(q);
    const rows = db.prepare("SELECT id, title FROM series").all();

    const scored = [];
    for (const row of rows) {
        const normTitle = normalize(row.title);
        if (normTitle === normalized) { scored.push({ ...row, score: 1.0 }); continue; }
        if (normTitle.includes(normalized) || normalized.includes(normTitle)) { scored.push({ ...row, score: 0.8 }); continue; }
        const words = normalized.split(" ");
        const matched = words.filter(w => w.length > 2 && normTitle.includes(w));
        if (matched.length >= 2) { scored.push({ ...row, score: 0.5 + matched.length / words.length * 0.3 }); }
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 5);
}

export function getImageUrl(id, type) {
    if (!id || !/^[A-Za-z0-9]{7,10}$/.test(id)) return null;
    if (!IMAGE_TYPES.includes(type)) return null;
    return `${IMG_BASE}/${id}-${type}`;
}

export function allImageUrls(id) {
    if (!id || !/^[A-Za-z0-9]{7,10}$/.test(id)) return {};
    const r = {};
    for (const type of IMAGE_TYPES) r[type] = `${IMG_BASE}/${id}-${type}`;
    return r;
}

export async function fetchArtwork({ showName }) {
    if (!showName) return { poster: null, backdrop: null, logo: null };

    const results = findSeries(showName);
    if (results.length === 0) return { poster: null, backdrop: null, logo: null };

    const best = results[0];
    const urls = allImageUrls(best.id);

    return {
        poster: urls.poster_tall || urls.keyart || null,
        backdrop: urls.backdrop_wide || null,
        logo: urls.logo || null,
        crunchyrollId: best.id,
        crunchyrollTitle: best.title,
        confidence: best.score,
    };
}

export async function downloadBest({ showName, targetDir }) {
    if (!db || !showName) return [];

    const results = findSeries(showName);
    if (results.length === 0) return [];

    const best = results[0];
    const urls = allImageUrls(best.id);
    const downloads = [];

    await mkdir(targetDir, { recursive: true });

    const files = [
        { url: urls.poster_tall, name: "crunchyroll_poster.jpg", type: "poster" },
        { url: urls.backdrop_wide, name: "crunchyroll_backdrop.jpg", type: "hero" },
        { url: urls.logo, name: "crunchyroll_logo.png", type: "logo" },
    ];

    for (const f of files) {
        if (!f.url) continue;
        const dest = path.join(targetDir, f.name);
        if (existsSync(dest)) continue;
        try {
            await downloadFile(f.url, dest);
            downloads.push({ type: f.type, path: dest });
        } catch (e) { console.warn(`Crunchyroll: ${f.type} download failed — ${e.message}`); }
    }

    return downloads;
}

async function downloadFile(url, dest) {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const buffer = Buffer.from(await resp.arrayBuffer());
    await writeFile(dest, buffer);
}
