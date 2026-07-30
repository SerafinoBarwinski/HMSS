# Jellyfin PlaybackInfo Flow

## Overview

The playback flow handles how Jellyfin negotiates media playback between server and client.
It determines whether a media file can be direct-played, direct-streamed, or must be transcoded.

## API Endpoints

### GET `/Items/{itemId}/PlaybackInfo`

Returns **all** MediaSources for the item **without** device-specific data.

- No `DeviceProfile` is used
- No `TranscodingUrl` decision
- No `SupportsDirectPlay/Stream` decisions
- Returns raw MediaSources with all audio/subtitle streams
- `DefaultAudioStreamIndex` is set per user preferences (saved audio selection)
- `DefaultAudioIndexSource` carries a bitfield: `None`, `User`, `Default`, `Language`

### POST `/Items/{itemId}/PlaybackInfo`

Returns MediaSources **with** device-specific data applied.

- Takes `DeviceProfile`, `AudioStreamIndex`, `StartTimeTicks`, etc. from body
- For **each** MediaSource, calls `SetDeviceSpecificData` which:
  1. Runs `StreamBuilder.GetOptimalVideoStream()` (or `GetOptimalAudioStream`)
  2. Determines `DirectPlay` vs `DirectStream` vs `Transcode`
  3. Sets `SupportsDirectPlay`, `SupportsDirectStream`, `SupportsTranscoding`
  4. Sets `TranscodingUrl` if not direct play
  5. Sets `DefaultAudioStreamIndex` = streamInfo.AudioStreamIndex
- Calls `SortMediaSources` to order by preference

## MediaSource Model

### Single MediaSource per file (NOT per audio track)

THIS IS THE KEY INSIGHT: **Jellyfin returns ONE MediaSource per file, not per audio track.**
All audio tracks are bundled into the single MediaSource's `MediaStreams[]` array.

Multiple MediaSources only occur when:
- Item has multiple **versions** (extended cut, theatrical cut) — each is a separate DB item with its own GUID
- Live TV sources
- Placeholder vs Default type

### Audio tracks within MediaSource

```json
{
  "Id": "guid",
  "MediaStreams": [
    { "Type": "Video", "Index": 0, "Codec": "h264", ... },
    { "Type": "Audio", "Index": 1, "Codec": "aac", "Language": "eng", "IsDefault": true, ... },
    { "Type": "Audio", "Index": 2, "Codec": "aac", "Language": "deu", "IsDefault": false, ... }
  ],
  "DefaultAudioStreamIndex": 1,
  "DefaultAudioIndexSource": "User|Default|Language"
}
```

## Audio Stream Selection

### SetDefaultAudioAndSubtitleStreamIndices (`MediaSourceManager.cs`)

For **Video** items, decides `DefaultAudioStreamIndex`:

1. If user has `RememberAudioSelections` and saved `AudioStreamIndex` → use it (`AudioIndexSource.User`)
2. If `AudioLanguagePreference == "OriginalLanguage"` → find original language stream
3. Otherwise → `MediaStreamSelector.GetDefaultAudioStreamIndex()` with:
   - `preferredLanguages`: user's `AudioLanguagePreference`
   - `preferDefaultTrack`: user's `PlayDefaultAudioTrack`
4. Sort: default flag > external/embedded > language match > forced flag

### SetDeviceSpecificData (`MediaInfoHelper.cs`)

`SetDeviceSpecificData` runs the StreamBuilder which selects the audio stream:

1. Gets the **default** audio stream via `item.GetDefaultAudioStream(options.AudioStreamIndex ?? item.DefaultAudioStreamIndex)`
2. Collects **candidateAudioStreams** based on `DefaultAudioIndexSource`:
   - `None`: all audio streams (restricted to defaults if current is default)
   - `Language`: streams in same language (optionally restricted to defaults)
   - `Default`: only default streams
   - `User`: no reselection (use the explicitly requested index)
3. `GetVideoDirectPlayProfile` iterates `DirectPlayProfiles` and tries to find a candidate audio stream that matches the device's codec support
4. If no direct play profile matches → fallback to DirectStream or Transcode
5. The final `streamInfo.AudioStreamIndex` becomes `mediaSource.DefaultAudioStreamIndex`

## DirectPlay/DirectStream/Transcode Decision

### `StreamBuilder.BuildVideoItem` (`StreamBuilder.cs:646`)

1. ForceDirectPlay → DirectPlay
2. ForceDirectStream → DirectStream
3. Check bitrate limit → if exceeded, disable direct play
4. BD/DVD → force transcode
5. `GetVideoDirectPlayProfile`:
   - For each `DirectPlayProfile`:
     - Check container support
     - Check video codec support
     - Check audio codec support via candidate streams
     - Check profile conditions (codec profiles)
     - Rate: DirectPlay > DirectStream (with `DirectStreamReasons`)
   - Returns first match or failure reasons
6. If no direct play/stream match → `GetVideoTranscodeProfile`:
   - For each `TranscodingProfile`:
     - Rank: video copy + audio copy > video copy + audio transcode > video transcode + audio transcode
   - Returns best profile
7. `BuildStreamVideoItem` sets codecs, bitrates, conditions

## TranscodingUrl Construction (`StreamInfo.ToUrl`)

URL format:
```
/videos/{ItemId}/master.m3u8?  (HLS)
/videos/{ItemId}/stream.{container}?  (DirectStream/Transcode)
```

Parameters appended:
- `DeviceProfileId`, `DeviceId`
- `MediaSourceId`
- `Static=true` (for direct stream)
- `VideoCodec`, `AudioCodec`
- `AudioStreamIndex`
- `SubtitleStreamIndex`
- `VideoBitrate`, `AudioBitrate`
- `AudioSampleRate`
- Various encoder options

## Sort Order for MediaSources

### `SortMediaSources` (`MediaInfoHelper.cs:365`)

1. The queried item's source first (its `Id` matches the item's `Id`)
2. DirectPlay + File protocol
3. DirectPlay or DirectStream
4. File protocol
5. Bitrate within limit
6. Original list index

## Audio Track Switching at Client Side

**Jellyfin Web handles audio track switching LOCALLY within the video element:**
- For direct play (HTTP progressive download), the browser can access all audio tracks in the MP4/MKV container
- The client reads `MediaStreams[]` to build the audio track selector UI
- When user picks a different track, the client switches the video element's audio track
- This requires the **raw file** to contain ALL audio streams (no ffmpeg remux stripping)

If the selected audio track can't be played by the device (codec not supported by browser), the client falls back to:
1. Calling POST PlaybackInfo with the new `AudioStreamIndex`
2. Receiving updated MediaSources with `TranscodingUrl` for the incompatible audio

## HMSS Current Issues vs Jellyfin

| Aspect | Jellyfin | HMSS Current |
|--------|----------|--------------|
| MediaSources per file | 1 (all audio tracks) | 2 (default + alternate) |
| DefaultAudioStreamIndex | Set per user/session | Set per source |
| Audio switching | Client-side via browser `<video>` | HLS transcoding |
| streamFile | Serves raw file (all tracks) | ffmpeg remux to single track |
| TranscodingUrl | Only when client can't direct play | Always for alternate audio |
| Audio codec check | Based on device profile | Not implemented |
| Version sources | Multiple GUIDs for multiple files | N/A |

## What HMSS Should Implement

### Short-term fix (to make multi-audio work):
1. Return **one** MediaSource per file
2. Serve raw file (all audio tracks) through `streamFile`
3. Set `DefaultAudioStreamIndex` from user selection + session cache
4. Remove ffmpeg remux from direct play endpoint
5. Only use HLS when client's device profile requires transcoding
6. HLS for alternate audio: use ffmpeg `-map` to select the right audio track

### Long-term:
1. Implement proper `clientCanDirectPlay` based on device profile codec support
2. Generate `TranscodingUrl` with `AudioStreamIndex` param only when codec mismatch
3. Implement subtitle support per Jellyfin model
4. Support multiple versions (alternate cuts, 3D, etc.)
