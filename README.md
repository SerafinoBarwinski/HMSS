# HMSS — Home Media Streaming Service

A Jellyfin-compatible media streaming server you can host yourself. Built from the
ground up in Node.js — no C#, no .NET, no legacy baggage.
Can also be faster since Express is well optimized.

**Status: Alpha.** Core functionality works — authentication, media browsing,
metadata enrichment, artwork, and streaming all operational. More features
coming steadily. Contributions and feedback welcome.

## Why?

Running your own media server is awesome. But existing solutions can be
frustrating — they're often hard to set up, opaque when things go wrong, or
slow to fix issues that matter to self-hosters.

HMSS takes a different approach: a fresh codebase in Node.js, designed to be
easy to read, easy to modify, and easy to run. It speaks the Jellyfin API so
your favourite clients (Jellyfin Mobile, Findroid, etc) just work — but
the server itself is diffrent from top to bottom.

## Requirements

- **Node.js** 20 or later
- **ffmpeg** in your PATH
- **TMDB API Key** (free at [themoviedb.org](https://www.themoviedb.org/settings/api))
- **Fanart.tv API Key** (free at [fanart.tv](https://fanart.tv/get-an-api-key/))

That's it. No Docker required (but it runs fine in one).

## Optional

- **[Telerising API](https://github.com/sunsettrack4/telerising-api)** — LiveTV
  integration. Provides IPTV channel streaming through various providers.
  Place the ZIP Content at `src/telerising` and configure via the web dashboard.
  Then under **Live TV → Tuner Hosts** (type: M3U, URL:
  `http://localhost:5000/api/{provider}/live/channels.m3u?ffmpeg=true`).

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

## Override Arguments

#### Common
- --debug: *Ensure there is more logging.*
- --port: *Changes the Web Server Port*

#### Made for Devs:
- --fail-integrity-check: *Causes the integrity check to fail, even if all conditions are met. May be useful for debugging the integrity check.*
- --skip-integrity-check: *Ensures the integrity check succeeds, even if not all conditions are met. **This can lead to unpredictable errors!***
- --i-am-a-tea-pot: *No Coffee for you*

## Addons
I am implementing my own add-on system.
Four modules are included out of the box:
- TMDB: Metadata
  *Needs Config*
- Musicbrainz: Music Metadata
  *Needs Config*
- fanart.tv: Artwork
- Crunchyroll: Artwork

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

- **Authentication**: Password login, Quick Connect, Setup Wizard, sessions
- **Media Browsing**: Full Jellyfin-compatible item listing, filtering, suggestions
- **Media Playback**: Direct play streaming with Range support (seeking works)
- **Live TV**: Telerising IPTV integration — channel listing, HLS proxy streaming, channel logos
- **Metadata Enrichment**: TMDB (movies/shows), MusicBrainz (music), Fanart.tv (artwork)
- **Addons**: Plugin system with config UI in Jellyfin Web Dashboard
- **Media Scanning**: Threaded background scanning with metadata extraction (ffprobe)
- **jellyfin-web**: Full web UI hosted, works with Jellyfin Mobile app
- **Discovery**: UDP on port 7359, WebSocket for real-time updates
- **Localization**: Languages, cultures, countries served from API
- **System Info**: Server info, ping, logging, activity log, disk stats
- **Rate Limiting**: Per-IP request throttling, localhost exempt
- **Spam Protection**: Configurable IP-based request limiting

## What's Next

- Adding remaning APIs
- Adding remaning API features
- Physical Tuner discovery
- NFC and Automations
- HMSS-native frontend
- XMLTV / EPG guide data

## How *you* could help me
I would be happy if you contributed to the project.
Can you design a logo or give me some feedback?
An XML file from an SDDP would also be helpful!

## API Compatibility

HMSS implements a large subset of the Jellyfin API. Most endpoints used by
Jellyfin Mobile, and other clients are functional. Not Every API works 100% especially so early.


**HMSS is not affiliated with or endorsed by the Jellyfin project. We implement
API compatibility to leverage the existing ecosystem of clients.**

## License

GPL v2 — see [LICENSE](LICENSE).

## Medias
*Looks like regular Jellyfin* but is faster

I removed them because i changed a lost since these Screenshots were taken.