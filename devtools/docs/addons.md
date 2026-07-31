# Addon System Documentation

HMSS has a unified addon system. Addons can:

- provide **metadata**, **search** and **artwork** providers (server-side capabilities)
- register **backend HTTP routes** (e.g. a REST API for the addon's own feature)
- register **UI routes / pages** rendered inside the Jellyfin web client
- register **persistent scripts** that run globally on every page load (not page-specific)
- register **HMSS sidebar menu items**

An addon is a directory under `src/addons/` that is discovered and loaded automatically at server startup.

---

## Directory Structure

```
src/addons/
└── <addon-id>/
    ├── addon.yaml          # manifest (REQUIRED)
    ├── addon.js            # backend module (REQUIRED, ES module)
    ├── config.json         # declarative config schema (optional)
    └── ...                 # any other files used by the addon (pages, scripts, assets)
```

> Legacy: on first run after this change, existing `override.json` files are migrated into the database and are then no longer read or written.

### Files

| File | Purpose |
|---|---|
| `addon.yaml` | Manifest: name, version, capabilities, `web` registration. |
| `addon.js` | ES module implementing the addon API. Imported with dynamic `import()`. |
| `config.json` | Declarative config schema shown in the Jellyfin plugin config page. |

> **Note:** If `addon.yaml` or `addon.js` is missing/invalid, the addon is skipped with a warning.

### Runtime State (Database)

Addon state lives in the `addons` SQLite table, not in files. Each addon has its own row:

| Column | Purpose |
|---|---|
| `id` | Addon id (directory name). Primary key. |
| `config_json` | The addon's runtime configuration, stored as JSON. |
| `enabled` | Whether the addon is active (`1`/`0`). |
| `installed_at` / `updated_at` | Timestamps. |

This keeps addon configuration decoupled from the filesystem, so configuration changes
persist in the database and secrets (API keys) never end up in the repository.

---

## Manifest (`addon.yaml`)

```yaml
name: My Addon
version: "1.0"
description: "What this addon does"
capabilities:
  - metadata          # see table below
mediaTypes:
  - movie
  - show
dependency:
  - other-addon-id    # optional: only load if this addon is also present
web:                  # optional: UI/route registration (see "Web / UI")
  routes:
    - path: mypage
      title: My Page
      icon: favorite
      html: pages/my-page.html
      menu: true
  scripts:
    - scripts/global.js
```

### Manifest Fields

| Field | Type | Description |
|---|---|---|
| `name` | string | Display name. |
| `version` | string | Version string. |
| `description` | string | Short description. |
| `capabilities` | string[] | Server-side capabilities the addon implements. |
| `mediaTypes` | string[] | Optional media types (e.g. `movie`, `show`, `music`) the addon applies to. |
| `dependency` | string[] | Addon IDs that must be present, otherwise the addon is skipped. |
| `web` | object | Web/UI registration (routes, scripts). See below. |

### Capabilities

| Capability | Required export | Used for |
|---|---|---|
| `metadata` | `identify(input)` | Enrich media with metadata from a filename. |
| `search` | `search(query)` | Search an external catalog. |
| `artwork` | `fetchArtwork(opts)`, `downloadBest(opts)` | Provide/download cover art. |
| `anime-artwork` | `findSeries(showName)`, `downloadBest(opts)` | Anime artwork + anime detection. |
| `anime-meta` | `identify(input)` | Anime metadata. |
| `ui` | `web` in manifest | Registers pages/scripts/menu items in the web client. |

---

## Configuration (`config.json`)

Each key is a config option rendered as a text input in the Jellyfin plugin config page
(`/web/ConfigurationPage?name=<id>`, reachable via Dashboard → Plugins).

```json
{
  "apiKey": {
    "type": "string",
    "label": "API Key",
    "description": "Your API key",
    "required": true
  },
  "language": {
    "type": "string",
    "label": "Language",
    "default": "en-US"
  }
}
```

### Option Fields

| Field | Type | Description |
|---|---|---|
| `type` | string | Config value type (`string`, ...). |
| `label` | string | Human-readable label shown in the UI. |
| `description` | string | Help text shown under the input. |
| `default` | any | Default value when nothing is configured. |
| `required` | boolean | Mark as required. |

### Value Resolution Precedence

1. `userConfig[id]` (passed to `loadAddons`)
2. `addons.config_json` in the database (saved via the config page)
3. schema `default`

---

## Backend Module (`addon.js`)

An ES module. Everything is optional except a valid import.

### Lifecycle

```js
export async function init(config) {
    // called once at startup after the addon was loaded;
    // `config` contains the resolved config values
}
```

### Capability Functions

| Export | Signature | Called by |
|---|---|---|
| `search` | `search({ query, year, type })` | `searchAll()`, `GET /api/addons/search` |
| `identify` | `identify({ filename, ffprobe, type })` | media organizer (`enrichWithMetadata`) |
| `getDetails` | `getDetails(id, type)` | media organizer |
| `getExternalIds` | `getExternalIds(id, type)` | media organizer |
| `fetchArtwork` | `fetchArtwork({ tmdbId, type })` | `GET /Items/:id/RemoteImages` |
| `downloadBest` | `downloadBest({ tmdbId, type, targetDir })` | media organizer (`downloadArtwork`) |
| `findSeries` | `findSeries(showName)` | anime detection (`isAnime`) |
| `getImageUrl` / `allImageUrls` | helper exports | addon-specific |
| `registerRoutes` | `registerRoutes(app, { getDb })` | backend route registration (see below) |

---

## Backend Routes

An addon can register its own HTTP endpoints by exporting `registerRoutes`.

```js
export function registerRoutes(app, { getDb }) {
    app.get("/my-addon/things", (req, res) => {
        // req.user is available: the global auth middleware runs before
        // addon routes are mounted (null if not authenticated)
        if (!req.user) return res.status(401).json({ error: "Unauthorized." });
        const db = getDb();
        res.json({ things: [] });
    });
}
```

The loader calls `registerRoutes` once at startup for every addon that exports it.
Routes are mounted after the global `authMiddleware`, so `req.user` is populated when a valid
token is sent (`X-Emby-Authorization` / `Authorization: Bearer` / `?api_key=`).

---

## Web / UI Registration

Addons can provide pages and scripts to the Jellyfin web client. Everything is declared in
the `web` section of the manifest — this is the "controlled path".

### Manifest Section

```yaml
web:
  routes:
    - path: nfc          # hash route → #/nfc
      title: NFC         # menu title / page title
      icon: nfc          # material icon name
      html: pages/nfc.html   # file inside the addon dir (served via /addons/<id>/...)
      menu: true         # also add a "HMSS" sidebar menu entry
  scripts:
    - scripts/nfc.js     # persistent script, injected on every page load
```

### How it works

- **Routes** are fetched by the client from `GET /api/addons/ui` (returns `routes`, `scripts`, `menuItems`).
- Each route becomes a Jellyfin hash route (`#/<path>`). When navigated, Jellyfin renders its
  `#fallbackPage` container and `web/hmss/jellyfin-injection.js` loads the route's `html` into it,
  re-executing inline `<script>` tags.
- **Scripts** are "persistent" — they are injected as `<script>` tags on every Jellyfin page load,
  independent of any route/page. They can use the `window.HMSS` API (see below).
- Routes with `menu: true` appear in the **HMSS sidebar menu**.

### Served Assets

Addon files referenced by `routes[].html` and `scripts[]` are served from
`GET /addons/<addon-id>/<path>`. **Only declared files are served** — anything else (e.g.
`override.json` with secrets, `config.json`) returns 404. Path traversal is blocked.

### Client API (`window.HMSS`)

Persistent scripts and pages can use the global HMSS API provided by
`web/hmss/jellyfin-injection.js`:

| Method | Description |
|---|---|
| `HMSS.showToast(text, isError)` | Show a toast notification. |
| `HMSS.getAuthHeaders()` | Return headers with the current Jellyfin access token. |
| `HMSS.getUserId()` | Return the current user's id (or `""`). |
| `HMSS.addFeatureButton({ label, icon, action })` | Add an entry to the "HMSS Features" popup. |

```js
window.HMSS.addFeatureButton({
    label: "Start Scanner",
    icon: "nfc",
    action: startScanner
});
```

---

## Example: Hello World Addon

A complete addon with a page, a persistent script and a backend route.

### `src/addons/hello_world/addon.yaml`

```yaml
name: Hello World
version: "1.0"
description: "A minimal example addon that registers a page, a script and an API route"
capabilities:
  - ui
web:
  routes:
    - path: hello
      title: Hello World
      icon: waving_hand
      html: pages/hello.html
      menu: true
  scripts:
    - scripts/hello.js
```

### `src/addons/hello_world/addon.js`

```js
export async function init(config) {
    console.log("[HelloWorld] Addon loaded");
}

export function registerRoutes(app, { getDb }) {
    app.get("/hello-world/ping", (req, res) => {
        res.json({ message: "pong", user: req.user ? req.user.name : "anonymous" });
    });
}
```

### `src/addons/hello_world/pages/hello.html`

```html
<button onClick="run()" id="ActivateScriptButton">Click me to activate the page</button>
<div id="main" style="display: none; padding: 24px; max-width: 600px;">
    <h1>Hello World</h1>
    <p>This page is provided by the Hello World addon and rendered inside the
       Jellyfin <code>#fallbackPage</code> container.</p>
    <button is="emby-button" class="raised button-submit" id="btnPing">Ping the API</button>
    <pre id="result"></pre>
</div>

<script>
    // Inline scripts must run inside a function triggered by user input —
    // this "ActivateScriptButton" pattern is also used by the NFC addon page.
    async function run() {
        document.getElementById('main').style.display = 'block';
        document.getElementById('ActivateScriptButton').style.display = 'none';
        document.getElementById('btnPing').addEventListener('click', async function () {
            const res = await fetch('/hello-world/ping', { headers: window.HMSS.getAuthHeaders() });
            document.getElementById('result').textContent = JSON.stringify(await res.json(), null, 2);
        });
    }
</script>
```

### `src/addons/hello_world/scripts/hello.js`

```js
(function () {
    // Persistent script — runs on every page load.
    console.log("[HelloWorld] persistent script active");

    window.HMSS.addFeatureButton({
        label: "Say Hello",
        icon: "waving_hand",
        action: function () {
            window.HMSS.showToast("Hello from the Hello World addon!");
        }
    });
})();
```

After a server restart, the HMSS sidebar contains a **Hello World** menu item,
`#/hello` loads the page, the Features popup has a **Say Hello** entry, and
`GET /hello-world/ping` is available.

---

## Reference Example: NFC Addon

The NFC feature is implemented as a full addon at `src/addons/nfc/` and shows all four
registration types:

```yaml
# src/addons/nfc/addon.yaml
name: NFC
version: "1.0"
description: "NFC tag management and scanning for Jellyfin"
capabilities:
  - ui
web:
  routes:
    - path: nfc
      title: NFC
      icon: nfc
      html: pages/nfc.html
      menu: true
  scripts:
    - scripts/nfc.js
```

- `pages/nfc.html` — the tag-management page (`#/nfc`).
- `scripts/nfc.js` — persistent Web NFC scanner, registers a "NFC" entry in the Features popup via `window.HMSS.addFeatureButton`.
- `addon.js` — registers the `/hmss/nfc/:UserID` API routes via `registerRoutes`.

---

## Notes

- Addons are loaded once at server startup from `src/addons/`. Adding/removing an addon requires a restart.
- Enabling/disabling an addon (`PATCH /api/addons/:addonId`, body `{ "enabled": bool }`) persists the flag in the database and takes effect on the next restart.
- If an addon's `dependency` references a missing addon, the addon is skipped.
- Errors inside a single addon's `init`/`registerRoutes`/capability calls never crash the server — they are caught and logged as warnings.
- The web client fetches the UI registry from `GET /api/addons/ui`; the registry is also a good place to debug addon registration.
