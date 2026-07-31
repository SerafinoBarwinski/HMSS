import { createCanvas, loadImage } from "@napi-rs/canvas";
import { findImageInDir, findPosterPath } from "./jellyfin_items.js";
import { DEBUG_GENEREL } from "../../server.js";

const SPLASH_W = 2560;
const SPLASH_H = 1440;
const TILE_ASPECT = 16 / 9;

const IMG_SIZE = 800;        // tile width in px (unrotated)
const X_GAP = 1;            // horizontal gap between tiles
const Y_GAP = 1;            // vertical gap between rows
const BG_HEX = "#ffffff"

let _splashCache = { sig: "", buf: null };

function dirOf(fp) {
    return (fp || "").substring(0, fp.lastIndexOf("/"));
}

function collectCovers(index) {
    const seen = new Set();
    const covers = [];
    const add = (p) => { if (p && typeof p === "string" && !seen.has(p)) { seen.add(p); covers.push(p); } };
    const addItem = (fp) => {
        if (!fp) return;
        const dir = dirOf(fp);
        const parent = dir + "/..";
        let im = findImageInDir(dir, "Backdrop") || findImageInDir(parent, "Backdrop");
        if (!im) im = findImageInDir(dir, "Primary") || findImageInDir(parent, "Primary");
        if (!im) im = findPosterPath(fp);
        add(im?.path);
    };
    for (const m of index.movies || []) addItem(m.filePath);
    for (const s of index.shows || []) addItem(s.filePath);
    for (const u of index.unsorted || []) addItem(u.filePath);

    // one cover per folder so a show with many episodes only contributes its art once
    const byDir = new Map();
    for (const c of covers) {
        const d = c.substring(0, c.lastIndexOf("/"));
        if (!byDir.has(d)) byDir.set(d, c);
    }
    const list = [...byDir.values()];
    for (let i = list.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
}

async function loadAll(paths) {
    const imgs = [];
    const CONC = 8;
    for (let i = 0; i < paths.length; i += CONC) {
        const chunk = paths.slice(i, i + CONC);
        const results = await Promise.all(chunk.map(p => loadImage(p).catch(() => null)));
        for (const im of results) if (im) imgs.push(im);
    }
    return imgs;
}

function drawSplash(ctx, imgs) {
    const W = SPLASH_W, H = SPLASH_H;
    ctx.fillStyle = BG_HEX;
    ctx.fillRect(0, 0, W, H);
    if (imgs.length === 0) return true;

    // Build a big brick grid (every row offset by half a tile, alternating sides),
    // extending beyond the edges, then rotate the whole thing 45° to the left.
    const G = (SPLASH_W / 100) * 120;  // grid canvas edge length
    const grid = createCanvas(G, G);
    const gctx = grid.getContext("2d");
    gctx.fillStyle = BG_HEX;
    gctx.fillRect(0, 0, G, G);

    let tw = IMG_SIZE;
    if (IMG_SIZE > 1200) {
        console.warn(`IMG_SIZE ${IMG_SIZE} is too large, defaulting to 800`);
        tw = 800;
    }
    const th = tw / TILE_ASPECT;
    const cell = (tw + th) / Math.SQRT2;
    const colS = tw + X_GAP
    const rowS = th + Y_GAP;
    const cols = Math.ceil(G / colS) + 2;
    const rows = Math.ceil(G / rowS) + 2;
    const total = rows * cols;

    if (!Number.isFinite(total)) {
        console.error("Splash generation aborted: invalid tile count (non-finite)");
        return false;
    }

    if (total > 999) {
        console.error("Possible RAM Leakage is been stopt because more or exact 1K Pictures would been used to generate the Splash Screen.");
        return false;
    }
    if (total > 500) {
        console.warn("More then 500 Pictures were been used to Generate the Splash");
    }

    let idx = 0;

    for (let r = 0; r < rows; r++) {
        const xOff = (r % 2) * colS / 2;
        for (let c = 0; c < cols; c++) {
            const img = imgs[idx % imgs.length];
            idx++;
            gctx.drawImage(img, c * colS + xOff, r * rowS, tw, th);
        }
    }
    if (DEBUG_GENEREL) console.log(`[SPLASH] Used ${total} Images to Generate Splash (${imgs.length} unique covers)`);

    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.rotate(-Math.PI / 4);
    ctx.drawImage(grid, -G / 2, -G / 2);
    ctx.restore();
    return true;
}

export async function renderSplashscreen(index) {
    const covers = collectCovers(index);
    const sig = covers.length + ":" + covers.join(",");
    if (_splashCache.sig === sig && _splashCache.buf) return _splashCache.buf;

    const canvas = createCanvas(SPLASH_W, SPLASH_H);
    const ctx = canvas.getContext("2d");
    const W = SPLASH_W, H = SPLASH_H;
    const imgs = await loadAll(covers);
    const ok = drawSplash(ctx, imgs);
    if (!ok) throw new Error("Splash generation aborted (too many tiles)");

    // vignette: bottom-left stays bright, top-right fades into black
    const grad = ctx.createLinearGradient(0, H, W, 0);
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(0.6, "rgba(0,0,0,0)");
    grad.addColorStop(1, "rgba(0,0,0,1)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    const buf = canvas.toBuffer("image/jpeg", 82);
    _splashCache = { sig, buf };
    return buf;
}
