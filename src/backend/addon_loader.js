import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "yaml";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ADDONS_DIR = path.join(__dirname, "..", "addons");

let addons = [];
let initialized = false;

export async function loadAddons(userConfig = {}) {
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

        let override = {};
        try {
            override = JSON.parse(await readFile(overridePath, "utf-8"));
        } catch {}

        let module;
        try {
            module = await import(addonJSPath);
        } catch (e) {
            console.warn(`Addon '${entry.name}': failed to load addon.js — ${e.message}`);
            continue;
        }

        const config = resolveConfig(entry.name, configSchema, override, userConfig);

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
            module,
            config,
            configSchema,
        });
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

export function getAddonsByCapability(capability) {
    return addons.filter(a => a.capabilities.includes(capability));
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
