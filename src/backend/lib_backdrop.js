import { createCanvas, GlobalFonts, loadImage } from "@napi-rs/canvas";
import { existsSync } from "node:fs";
import { generateItemId } from "./media_probe.js";
import { findImageInDir } from "./jellyfin_items.js";

const W = 1920;
const H = 1080;
const cache = new Map();

// DejaVu Sans is the most common used by Jellyfin. Thats why. Should feel more native then some offbrand font i would rather use.
// If you have a better idea, please let me know. I am open for suggestions.

const UNIX_FONT_CANDIDATES = [
    // Linux
    { family: "DejaVu Sans", path: "/usr/share/fonts/dejavu-sans-fonts/DejaVuSans-Bold.ttf" },
    { family: "DejaVu Sans", path: "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf" },
    { family: "DejaVu Sans", path: "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" },
    { family: "Liberation Sans", path: "/usr/share/fonts/liberation-sans/LiberationSans-Bold.ttf" },
    { family: "Liberation Sans", path: "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf" },
    { family: "Noto Sans", path: "/usr/share/fonts/noto/NotoSans-Bold.ttf" },
    { family: "Noto Sans", path: "/usr/share/fonts/noto-sans/NotoSans-Bold.ttf" },
    { family: "FreeSans", path: "/usr/share/fonts/freefont/FreeSansBold.ttf" },
    { family: "Ubuntu", path: "/usr/share/fonts/truetype/ubuntu/Ubuntu-B.ttf" },
    { family: "Cantarell", path: "/usr/share/fonts/cantarell/Cantarell-Bold.otf" },
    // macOS
    { family: "Helvetica", path: "/System/Library/Fonts/Supplemental/Helvetica Bold.ttf" },
    { family: "Arial", path: "/System/Library/Fonts/Supplemental/Arial Bold.ttf" },
    { family: "Arial", path: "/Library/Fonts/Arial Bold.ttf" },
    { family: "Verdana", path: "/System/Library/Fonts/Supplemental/Verdana Bold.ttf" },
    { family: "Tahoma", path: "/System/Library/Fonts/Supplemental/Tahoma Bold.ttf" },
];

const WINDOWS_FONT_CANDIDATES = [
    { family: "Segoe UI", path: "C:\\Windows\\Fonts\\segoeuib.ttf" },
    { family: "Segoe UI", path: "C:\\Windows\\Fonts\\seguisb.ttf" },
    { family: "Arial", path: "C:\\Windows\\Fonts\\arialbd.ttf" },
    { family: "Calibri", path: "C:\\Windows\\Fonts\\calibrib.ttf" },
    { family: "Verdana", path: "C:\\Windows\\Fonts\\verdanab.ttf" },
    { family: "Tahoma", path: "C:\\Windows\\Fonts\\tahomabd.ttf" },
    { family: "Georgia", path: "C:\\Windows\\Fonts\\georgiab.ttf" },
    { family: "Trebuchet MS", path: "C:\\Windows\\Fonts\\trebucbd.ttf" },
    { family: "Times New Roman", path: "C:\\Windows\\Fonts\\timesbd.ttf" },
    { family: "DejaVu Sans", path: "C:\\Windows\\Fonts\\DejaVuSans-Bold.ttf" },
];

const FONT_CANDIDATES = process.platform === "win32"
    ? [...WINDOWS_FONT_CANDIDATES, ...UNIX_FONT_CANDIDATES]
    : [...UNIX_FONT_CANDIDATES, ...WINDOWS_FONT_CANDIDATES];

let fontFamily = null;
function initFont() {
    if (fontFamily) return fontFamily;
    for (const c of FONT_CANDIDATES) {
        try {
            if (existsSync(c.path)) {
                GlobalFonts.registerFromPath(c.path, c.family);
                fontFamily = c.family;
                return fontFamily;
            }
        } catch {}
    }
    fontFamily = "sans-serif";
    return fontFamily;
}

function hashStr(input) {
    let h = 0;
    for (let i = 0; i < input.length; i++) {
        h = ((h << 5) - h + input.charCodeAt(i)) | 0;
    }
    return Math.abs(h);
}

function poolFor(libKey) {
    const index = globalThis.__mediaIndex || {};
    if (libKey === "tvshows") {
        const seen = new Set();
        const pool = [];
        for (const ep of index.shows || []) {
            if (!ep.showName || seen.has(ep.showName)) continue;
            seen.add(ep.showName);
            pool.push(ep);
        }
        return pool;
    }
    return index[libKey] || [];
}

export function pickBackdropPath(libKey, name) {
    const pool = poolFor(libKey);
    if (!pool.length) return null;
    const seed = hashStr((name || "") + "|" + libKey);
    for (let i = 0; i < pool.length; i++) {
        const entry = pool[(seed + i) % pool.length];
        const fp = entry.filePath || entry.showName;
        if (!fp) continue;
        const dir = fp.substring(0, fp.lastIndexOf("/"));
        // prefer actual backdrops (landscape) over posters
        const img = findImageInDir(dir, "Backdrop") || findImageInDir(dir + "/..", "Backdrop")
            || findImageInDir(dir, "Primary") || findImageInDir(dir + "/..", "Primary");
        if (img) return img.path;
    }
    return null;
}

export function backdropTagForLib(name, srcPath) {
    return generateItemId("lib-backdrop:" + name + ":" + (srcPath || ""));
}

function drawCover(ctx, img) {
    const scale = Math.max(W / img.width, H / img.height);
    const dw = img.width * scale;
    const dh = img.height * scale;
    ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
}

export async function generateLibBackdrop(name, libKey) {
    const srcPath = pickBackdropPath(libKey, name);
    if (!srcPath) return null;
    const tag = backdropTagForLib(name, srcPath);
    if (cache.has(tag)) return cache.get(tag);

    const family = initFont();
    let img;
    try {
        img = await loadImage(srcPath);
    } catch {
        return null;
    }

    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext("2d");

    drawCover(ctx, img);

    ctx.globalAlpha = 0.5;
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1.0;

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#ffffff";
    const maxWidth = W * 0.9;
    let size = 190;
    ctx.font = `bold ${size}px ${family}`;
    while (size > 40 && ctx.measureText(name).width > maxWidth) {
        size -= 4;
        ctx.font = `bold ${size}px ${family}`;
    }
    ctx.fillText(name, W / 2, H / 2);

    const buf = Buffer.from(canvas.toBuffer("image/png"));
    cache.set(tag, buf);
    return buf;
}

export function clearLibBackdropCache() {
    cache.clear();
}

export async function renderLibBackdropForQuery(buf, req) {
    const fw = parseInt(req.query.fillWidth, 10);
    const fh = parseInt(req.query.fillHeight, 10);
    const mw = parseInt(req.query.maxWidth, 10);
    const mh = parseInt(req.query.maxHeight, 10);
    if (!((fw && fh) || mw || mh)) return buf;

    let img;
    try {
        img = await loadImage(buf);
    } catch {
        return buf;
    }

    if (fw && fh) {
        const scale = Math.max(fw / img.width, fh / img.height);
        const dw = Math.round(img.width * scale);
        const dh = Math.round(img.height * scale);
        const canvas = createCanvas(fw, fh);
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, Math.round((fw - dw) / 2), Math.round((fh - dh) / 2), dw, dh);
        return Buffer.from(canvas.toBuffer("image/png"));
    }

    const scale = Math.min(mw ? mw / img.width : 1, mh ? mh / img.height : 1);
    if (scale < 1) {
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = createCanvas(w, h);
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        return Buffer.from(canvas.toBuffer("image/png"));
    }
    return buf;
}
