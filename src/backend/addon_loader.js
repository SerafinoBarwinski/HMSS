import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "yaml";
import { fileURLToPath } from "node:url";
import { setAddonConfig } from "./sql.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ADDONS_DIR = path.join(__dirname, "..", "addons");

let addons = [];
let disabledAddons = [];
let initialized = false;

export async function loadAddons(userConfig = {}, db = null) {
    if (initialized) return addons;

    let entries;
    try {
        entries = await readdir(ADDONS_DIR, { withFileTypes: true });
    } catch {
        console.warn("Addon directory not found:", ADDONS_DIR);
        return addons;
    }

    for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        const addonDir = path.join(ADDONS_DIR, entry.name);
        const manifestPath = path.join(addonDir, "addon.yaml");
        const configPath = path.join(addonDir, "config.json");
        const overridePath = path.join(addonDir, "override.json");
        const addonJSPath = path.join(addonDir, "addon.js");

        let manifest;
        try {
            manifest = parse(await readFile(manifestPath, "utf-8"));
        } catch {
            console.warn(`Addon '${entry.name}': missing or invalid addon.yaml`);
            continue;
        }

        let configSchema = {};
        try {
            configSchema = JSON.parse(await readFile(configPath, "utf-8"));
        } catch {}

        // read state from the database (config + enabled flag)
        let dbConfig = {};
        let enabled = true;
        if (db) {
            const row = db.prepare("SELECT config_json, enabled FROM addons WHERE id = ?").get(entry.name);
            if (row) {
                enabled = Boolean(row.enabled);
                try { dbConfig = JSON.parse(row.config_json || "{}"); } catch {}
            }
        }

        if (!enabled) {
            disabledAddons.push({
                id: entry.name,
                name: manifest.name || entry.name,
                version: manifest.version || "0.0.0",
                description: manifest.description || "",
                capabilities: manifest.capabilities || [],
                dependency: manifest.dependency || [],
                configSchema,
                enabled: false,
            });
            console.log(`Addon '${entry.name}': disabled — skipped`);
            continue;
        }

        // legacy migration: import override.json into the database once
        if (db && !db.prepare("SELECT id FROM addons WHERE id = ?").get(entry.name)) {
            let legacy = {};
            try { legacy = JSON.parse(await readFile(overridePath, "utf-8")); } catch {}
            setAddonConfig(db, entry.name, legacy);
            dbConfig = legacy;
            if (Object.keys(legacy).length > 0) {
                console.log(`Addon '${entry.name}': migrated config from override.json to database`);
            }
        }

        let module;
        try {
            module = await import(addonJSPath);
        } catch (e) {
            console.warn(`Addon '${entry.name}': failed to load addon.js — ${e.message}`);
            continue;
        }

        const config = resolveConfig(entry.name, configSchema, dbConfig, userConfig);

        try {
            if (module.init) await module.init(config);
        } catch (e) {
            console.warn(`Addon '${entry.name}': init failed — ${e.message}`);
        }

        addons.push({
            id: entry.name,
            name: manifest.name || entry.name,
            version: manifest.version || "0.0.0",
            description: manifest.description || "",
            capabilities: manifest.capabilities || [],
            mediaTypes: manifest.mediaTypes || [],
            dependency: manifest.dependency || [],
            web: normalizeWeb(entry.name, manifest.web),
            enabled: true,
            module,
            config,
            configSchema,
        });
    }

    // check dependencies — remove addons with missing deps
    const addonIds = new Set(addons.map(a => a.id));
    for (let i = addons.length - 1; i >= 0; i--) {
        for (const dep of addons[i].dependency) {
            if (!addonIds.has(dep)) {
                console.warn(`Addon '${addons[i].id}': missing dependency '${dep}' — skipped`);
                addons.splice(i, 1);
                break;
            }
        }
    }

    initialized = true;
    if (addons.length > 0) console.log(`Loaded ${addons.length} addons`);
    return addons;
}

function resolveConfig(id, schema, override, userConfig) {
    const resolved = {};
    const providerConfig = userConfig[id] || {};
    for (const [key, def] of Object.entries(schema)) {
        if (providerConfig[key] !== undefined) {
            resolved[key] = providerConfig[key];
        } else if (override[key] !== undefined) {
            resolved[key] = override[key];
        } else {
            resolved[key] = def.default;
        }
    }
    return resolved;
}

export function getAddons() {
    return addons;
}

export function getAllAddons() {
    return [...addons, ...disabledAddons];
}

export function getAddonsByCapability(capability) {
    return addons.filter(a => a.capabilities.includes(capability));
}

export function getAddonsByCapabilityAndType(capability, mediaType) {
    return addons.filter(a => {
        if (!a.capabilities.includes(capability)) return false;
        if (a.mediaTypes.length > 0 && !a.mediaTypes.includes(mediaType)) return false;
        return true;
    });
}

// --- Web/UI registration (routes, pages, persistent scripts, HMSS menu) ---

function normalizeWebPath(raw) {
    if (typeof raw !== "string") return null;
    const parts = raw.replace(/\\/g, "/").replace(/^\/+/, "").split("/");
    if (parts.length === 0 || parts.some(p => !p || p === "." || p === "..")) return null;
    return parts.join("/");
}

function normalizeWeb(id, manifestWeb) {
    const web = { routes: [], scripts: [] };
    const webManifest = manifestWeb || {};

    for (const raw of Array.isArray(webManifest.routes) ? webManifest.routes : []) {
        if (!raw || !raw.path || !raw.title) continue;
        const htmlFile = normalizeWebPath(raw.html);
        if (raw.html && !htmlFile) continue;
        web.routes.push({
            addon: id,
            path: String(raw.path).replace(/^#\//, "").replace(/^\//, ""),
            title: String(raw.title),
            icon: raw.icon || "",
            htmlFile,
            menu: Boolean(raw.menu),
        });
    }

    for (const raw of Array.isArray(webManifest.scripts) ? webManifest.scripts : []) {
        const file = normalizeWebPath(raw);
        if (file) web.scripts.push({ addon: id, file });
    }

    return web;
}

export function getWebRegistry() {
    const routes = [];
    const scripts = [];
    for (const a of addons) {
        routes.push(...(a.web?.routes || []));
        scripts.push(...(a.web?.scripts || []));
    }
    const mapRoute = r => ({
        addon: r.addon,
        path: r.path,
        title: r.title,
        icon: r.icon,
        link: "#/" + r.path,
        html: r.htmlFile ? `/addons/${r.addon}/${r.htmlFile}` : null,
        menu: r.menu,
    });
    return {
        routes: routes.map(mapRoute),
        scripts: scripts.map(s => `/addons/${s.addon}/${s.file}`),
        menuItems: routes.filter(r => r.menu).map(mapRoute),
    };
}

export function getAddonWebFiles(addonId) {
    const addon = addons.find(a => a.id === addonId);
    if (!addon) return new Set();
    const files = new Set();
    for (const r of addon.web?.routes || []) if (r.htmlFile) files.add(r.htmlFile);
    for (const s of addon.web?.scripts || []) files.add(s.file);
    return files;
}

export function getAddonDir(addonId) {
    const addon = addons.find(a => a.id === addonId);
    if (!addon) return null;
    return path.join(ADDONS_DIR, addonId);
}

export function registerAddonBackendRoutes(app, getDb) {
    for (const addon of addons) {
        if (typeof addon.module.registerRoutes !== "function") continue;
        try {
            addon.module.registerRoutes(app, { getDb });
            console.log(`Addon '${addon.id}': backend routes registered`);
        } catch (e) {
            console.warn(`Addon '${addon.id}': registerRoutes failed — ${e.message}`);
        }
    }
}

export async function getMetadata(input) {
    const providers = getAddonsByCapability("metadata");
    for (const provider of providers) {
        try {
            const result = await provider.module.identify(input);
            if (result) return { ...result, addon: provider.id };
        } catch (e) {
            console.warn(`Metadata addon '${provider.id}' failed: ${e.message}`);
        }
    }
    return null;
}

export async function searchAll(query) {
    const providers = getAddonsByCapability("search");
    const results = [];
    for (const provider of providers) {
        try {
            const r = await provider.module.search(query);
            results.push({ addon: provider.id, results: r });
        } catch (e) {
            console.warn(`Search addon '${provider.id}' failed: ${e.message}`);
        }
    }
    return results;
}

export function isAnime(showName) {
    if (!showName) return false;
    const animeProviders = getAddonsByCapability("anime-artwork");
    for (const provider of animeProviders) {
        try {
            if (provider.module.findSeries) {
                const matches = provider.module.findSeries(showName);
                if (matches.length > 0 && matches[0].score >= 0.5) return true;
            }
        } catch {}
    }
    return false;
}

export function countFields(obj) {
    if (!obj) return 0;
    let n = 0;
    for (const [, v] of Object.entries(obj)) {
        if (v !== null && v !== undefined && v !== "" && !(Array.isArray(v) && v.length === 0)) n++;
    }
    return n;
}
