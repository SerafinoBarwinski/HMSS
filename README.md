# HMSS — Home Media Streaming Service

A Jellyfin-compatible media streaming server you can host yourself. Built from the
ground up in Node.js — no C#, no .NET, no legacy baggage.

**Status: Experimental.** This is a work in progress. Things will break. It is
not yet ready for daily use. Contributions and feedback welcome.

## Why?

Running your own media server is awesome. But existing solutions can be
frustrating — they're often hard to set up, opaque when things go wrong, or
slow to fix issues that matter to self-hosters.

HMSS takes a different approach: a fresh codebase in Node.js, designed to be
easy to read, easy to modify, and easy to run. It speaks the Jellyfin API so
your favourite clients (Findroid, Jellyfin Mobile, Swiftfin) just work — but
the server itself is ours from top to bottom.

## Requirements

- **Node.js** 20 or later
- **ffmpeg** in your PATH
- **TMDB API Key** (free at [themoviedb.org](https://www.themoviedb.org/settings/api))
- **Fanart.tv API Key** (free at [fanart.tv](https://fanart.tv/get-an-api-key/))

That's it. No Docker required (but it runs fine in one).

## Quick Start

```bash
git clone https://github.com/SerafinoBarwinski/HMSS.git
cd HMSS
npm install
npm run server
```

The server starts on port 8000. Open `http://localhost:8000` in a browser or
connect with Findroid / Jellyfin Mobile.

Default login: `root` / `root`

## Addon Configuration

API keys for metadata and artwork are configured through addon override files.
Each addon in `src/addons/` has a `config.json` (schema + defaults) and an
`override.json.example` (copy to `override.json` and fill in your keys).

**TMDB** (metadata for movies and shows):
```
src/addons/tmdb/override.json
```
```json
{ "api_key": "your-tmdb-api-key" }
```

**Fanart.tv** (posters, backgrounds, logos):
```
src/addons/fanart_tv/override.json
```
```json
{ "api_key": "your-fanart-tv-key" }
```

**MusicBrainz** works out of the box — no API key needed.

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

## What Works (So Far)

- User authentication (password + Quick Connect)
- Media scanning and indexing
- Metadata enrichment (TMDB, MusicBrainz)
- Artwork download (Fanart.tv)
- Jellyfin-compatible REST API (partial)
- jellyfin-web hosting (Jellyfin Mobile app works)
- mDNS / UDP discovery on port 7359
- WebSocket endpoint for real-time updates
- Addon system with dependency resolution

## What's Next

- Full media streaming and transcoding
- Web-based admin dashboard
- HMSS-native frontend
- Subtitle management
- Live TV support

## API Compatibility

HMSS implements a subset of the Jellyfin API. Not every endpoint is functional
yet — stubs return HTTP 501. See `docs/jellyfin_compat.md` for details on
client compatibility requirements (UUID formats, field ordering, header quirks).

HMSS is not affiliated with or endorsed by the Jellyfin project. We implement
API compatibility to leverage the existing ecosystem of clients.

## License

GPL v2 — see [LICENSE](LICENSE).
