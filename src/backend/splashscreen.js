import { createCanvas, loadImage } from "@napi-rs/canvas";
import { findImageInDir, findPosterPath, findAllBackdropsInDir } from "./jellyfin_items.js";
import { DEBUG_GENEREL } from "../../server.js";

const SPLASH_W = 2560;
const SPLASH_H = 1440;
const TILE_ASPECT = 16 / 9;

const IMG_SIZE = 800;        // tile width in px (unrotated)
const X_GAP = 1;            // horizontal gap between tiles
const Y_GAP = 1;            // vertical gap between rows
const BG_HEX = "#ffffff"

function shuffle(arr, rand) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

// deterministic PRNG so the same seed produces the same splash
function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
        a |= 0;
        a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

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

        // collect ALL backdrops of the item (and its parent folder), not just the first one
        let backdrops = findAllBackdropsInDir(dir);
        if (backdrops.length === 0) backdrops = findAllBackdropsInDir(parent);
        if (backdrops.length > 0) {
            for (const b of backdrops) add(b.path);
            return;
        }

        // no backdrops at all → fall back to poster art
        let im = findImageInDir(dir, "Primary") || findImageInDir(parent, "Primary");
        if (!im) im = findPosterPath(fp);
        add(im?.path);
    };
    for (const m of index.movies || []) addItem(m.filePath);
    for (const s of index.shows || []) addItem(s.filePath);
    for (const u of index.unsorted || []) addItem(u.filePath);
    return covers;
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

function drawSplash(ctx, imgs, rand) {
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

    // Shuffle the pool with the seed so the same seed reproduces the same splash.
    // If there are more backdrops than tiles, the extra ones are dropped.
    const pool = shuffle(imgs.slice(), rand);
    if (pool.length > total) pool.length = total;

    let idx = 0;

    for (let r = 0; r < rows; r++) {
        const xOff = (r % 2) * colS / 2;
        for (let c = 0; c < cols; c++) {
            const img = pool[idx % pool.length];
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

export async function renderSplashscreen(index, seed = null) {
    const covers = collectCovers(index);

    const canvas = createCanvas(SPLASH_W, SPLASH_H);
    const ctx = canvas.getContext("2d");
    const W = SPLASH_W, H = SPLASH_H;
    const imgs = await loadAll(covers);
    const rand = seed == null ? Math.random : mulberry32(seed);
    const ok = drawSplash(ctx, imgs, rand);
    if (!ok) throw new Error("Splash generation aborted (too many tiles)");

    // vignette: bottom-left stays bright, top-right fades into black
    const grad = ctx.createLinearGradient(0, H, W, 0);
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(0.6, "rgba(0,0,0,0)");
    grad.addColorStop(1, "rgba(0,0,0,1)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    const buf = canvas.toBuffer("image/jpeg", 82);
    return buf;
}
