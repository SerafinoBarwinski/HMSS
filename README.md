# HMSS — Home Media Streaming Service

A Jellyfin-compatible media streaming server you can host yourself. Built from
the ground up in Node.js — no C#, no .NET, no legacy baggage.
Resource-efficient and fast — runs comfortably on minimal hardware.

**State of Development:** Beta — core features are working, but there's still
room for polish and expansion. Contributions and feedback welcome.

## Why?

Running your own media server is great, but existing solutions can be
frustrating — hard to set up, opaque when things go wrong, or slow to fix
issues that matter to self-hosters.

HMSS takes a different approach: a clean, modern Node.js codebase designed to
be easy to read, easy to modify, and easy to run. It speaks the Jellyfin API
so your favorite clients (Jellyfin Mobile, Findroid, etc.) just work — but the
server itself is different from top to bottom. Beyond compatibility, HMSS also
aims to introduce new features that extend the usual ecosystem.

## Requirements

- **Hardware Minimum:** 1 CPU core, 1 GB RAM, 1 GB storage
- **Node.js** 20 or later
- **ffmpeg** in your PATH
- **TMDB API Key** (free at [themoviedb.org](https://www.themoviedb.org/settings/api))
- **Fanart.tv API Key** (free at [fanart.tv](https://fanart.tv/get-an-api-key/))

That's it. No Docker required (but it runs fine in one).

## Optional

- **[Telerising API](https://github.com/sunsettrack4/telerising-api)** — LiveTV
  integration. Provides IPTV channel streaming through various providers.
  Place the ZIP content in `src/telerising` and configure via the web dashboard.
  Then under **Live TV → Tuner Hosts** (type: M3U, URL:
  `http://localhost:5000/api/{provider}/live/channels.m3u?ffmpeg=true`).
  Once set up, Telerising is also automatically discovered as a tuner by HMSS.

## Quick Start

```bash
git clone https://github.com/SerafinoBarwinski/HMSS.git
cd HMSS
npm install
npm start
```

The server starts on port 8000. Open `http://localhost:8000` in a browser or
connect with Jellyfin Mobile / Findroid.

On first start, the Setup Wizard guides you through creating the admin account
and configuring server settings.

## Migrating from Jellyfin

If you already run a Jellyfin server, HMSS can adopt its user database. HMSS
stores users in the same schema as Jellyfin, so existing accounts, passwords,
permissions and preferences carry over 1:1:

```bash
node server.js --migrate=/path/to/jellyfin.db
```

Imported: users (username, password hash, settings, login data), devices /
sessions (existing logins stay valid), and per-user **Permissions**,
**Preferences** and **AccessSchedules**.

Conflict handling: a user with the same ID is skipped, a user with the same
username is updated in place, otherwise a new user is created. Profile pictures
are not stored in the Jellyfin database (they are files on disk) and are not
migrated.

## Override Arguments

#### Common
- `--debug`: Enables verbose logging
- `--port`: Changes the web server port
- `--migrate=<path>`: Imports users, devices and their permissions from an
  existing Jellyfin database into HMSS. See [Migrating from Jellyfin](#migrating-from-jellyfin).

#### Development
- `--fail-integrity-check`: Forces the integrity check to fail, even if all
  conditions are met. Useful for debugging the integrity check itself.
- `--skip-integrity-check`: Skips the integrity check. **Can lead to
  unpredictable errors!**
- `--i-am-a-tea-pot`: No coffee today
- `--crash-on-startup`: Intentionally crash the Server on Startup

## Addons

HMSS features a built-in add-on system. See `src/addons` for available plugins.

- **GIF Avatar** — pick an animated GIF profile picture from Giphy on your
  profile page. Needs a free [Giphy API Key](https://developers.giphy.com)
  configured in the addon settings.

## Media Setup

Drop your files into the `media/` directory using this structure:

```
media/
  movie/$group/$movie/video.mp4
  shows/$show/$season$episode/video.mp4
  music/$artist/$album/track.m4a
```

The server scans these folders on startup. Metadata (`meta.yaml`) is written
automatically. With API keys configured, HMSS fetches cover art, descriptions,
and posters from TMDB and Fanart.tv.

## What Works

Most of the core Jellyfin experience is functional: authentication (password,
Quick Connect, sessions), full Jellyfin user management with per-user
permissions, preferences and access schedules, media browsing with most
filtering and suggestions,
direct-play streaming with seeking support, Live TV via Telerising IPTV
(channel listing, HLS proxy, EPG), metadata enrichment from TMDB, MusicBrainz,
and Fanart.tv, a plugin/addon system, threaded background media scanning,
and the full Jellyfin Web UI. Discovery (UDP, WebSocket), localization, system
info, rate limiting, and spam protection are all working too.

**What's still missing or limited:** Real physical tuner discovery,
Schedules Direct integration, and IPTV recording functionality are not yet
implemented. A few minor bugs exist here and there, but nothing that should
get in the way of everyday use.

## New Implementations in Jellyfin

- **NFC**: NFC-based automation
- **Telerising**: Automatic Telerising discovery as a tuner
- **GIF Avatar**: Animated GIF profile pictures from Giphy

## What's Next

- Remaining API endpoints and features
- Physical tuner discovery
- Schedules Direct integration *(Maybe. Is anyone actually using it?)*
- Recording support
- Automations
- HMSS-native frontend

## How You Can Help

Contributions are welcome! If you'd like to help:
- Design a logo
- Provide feedback
- Share an SDDP XML file

## API Compatibility

HMSS implements a large subset of the Jellyfin API. Most endpoints used by
Jellyfin Mobile, Findroid, and other clients are functional. Not every API
works perfectly, especially this early in development.

**HMSS is not affiliated with or endorsed by the Jellyfin project. API
compatibility is implemented to leverage the existing ecosystem of clients.**

## License

GPL v2 — see [LICENSE](LICENSE).