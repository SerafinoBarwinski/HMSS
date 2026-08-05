import { statSync } from "node:fs";
import { loadImage, createCanvas } from "@napi-rs/canvas";
import { encode } from "blurhash";

const cache = new Map();

export async function getBlurHash(filePath) {
    if (!filePath) return null;
    let key;
    try {
        const st = statSync(filePath);
        key = `${filePath}:${st.size}:${Math.floor(st.mtimeMs)}`;
    } catch {
        return null;
    }
    if (cache.has(key)) return cache.get(key);
    try {
        const img = await loadImage(filePath);
        const maxDim = 32;
        const scale = Math.min(1, maxDim / Math.max(img.width || 1, img.height || 1));
        const w = Math.max(1, Math.round((img.width || 1) * scale));
        const h = Math.max(1, Math.round((img.height || 1) * scale));
        const canvas = createCanvas(w, h);
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        const { data } = ctx.getImageData(0, 0, w, h);
        const hash = encode(data, w, h, 4, 3);
        cache.set(key, hash);
        return hash;
    } catch {
        cache.set(key, null);
        return null;
    }
}
