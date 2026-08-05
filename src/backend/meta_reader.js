import { readFileSync, existsSync } from "node:fs";
import { parse } from "yaml";

export function readMeta(dir) {
    const files = ["meta.yaml", "meta.yml"];
    for (const f of files) {
        const fp = `${dir}/${f}`;
        if (existsSync(fp)) {
            try {
                const data = parse(readFileSync(fp, "utf-8"));
                if (data) {
                    if (data.year != null && data.year !== "") data.year = Number(data.year);
                    if (data.community_rating != null && data.community_rating !== "") data.community_rating = Number(data.community_rating);
                }
                return data;
            } catch {}
        }
    }
    return null;
}

export function getItemMeta(filePath) {
    if (!filePath) return null;
    const dir = filePath.substring(0, filePath.lastIndexOf("/"));
    const parentDir = dir + "/..";
    const episodeMeta = readMeta(dir);
    const showMeta = readMeta(parentDir);
    return {
        name: episodeMeta?.enriched_name || episodeMeta?.name || showMeta?.name || showMeta?.enriched_name || null,
        overview: episodeMeta?.overview || showMeta?.overview || "",
        year: episodeMeta?.year || showMeta?.year || null,
        genres: showMeta?.genre || [],
        tmdbId: episodeMeta?.tmdb_id || showMeta?.tmdb_id || null,
    };
}
