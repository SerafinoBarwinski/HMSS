# Remote Client Debugging

The client can forward `console.log`, `console.warn` and `console.error` calls to the HMSS server in real time. Toggle the feature via the **HMSS Features → Remote Debugging** button in the Jellyfin web UI. Enable it by setting `DEBUG_ACCEPT_CLIENT_REMOTE_DEBUG = true` in `server.js`, then restart the server.

+ No build step required, works entirely client-side via console hooking; useful for debugging Jellyfin web UI issues without opening browser dev tools
- Only works while the client tab is open; must be re-enabled after page reload; disabled by default for security
