import { execFile } from "node:child_process";
import path from "node:path";
import { readFileSync } from "node:fs";

var _langMap = null;
function getLangMap() {
    if (_langMap) return _langMap;
    _langMap = {};
    var locByCode = {};
    try {
        var localization = JSON.parse(readFileSync(new URL("./localization.json", import.meta.url), "utf-8"));
        for (var i = 0; i < localization.length; i++) {
            var loc = localization[i];
            if (loc.Value) {
                var v = loc.Value.toLowerCase();
                locByCode[v] = loc.Name;
                locByCode[v.split("-")[0]] = loc.Name;
            }
        }
    } catch (_) {}
    try {
        var cultures = JSON.parse(readFileSync(new URL("./cultures.json", import.meta.url), "utf-8"));
        for (var i = 0; i < cultures.length; i++) {
            var c = cultures[i];
            var two = c.TwoLetterISOLanguageName ? c.TwoLetterISOLanguageName.toLowerCase() : null;
            var names = c.ThreeLetterISOLanguageNames || [c.ThreeLetterISOLanguageName];
            for (var j = 0; j < names.length; j++) {
                var key = names[j].toLowerCase();
                if (locByCode[two || key]) _langMap[key] = locByCode[two || key];
                else if (!(key in _langMap)) _langMap[key] = c.DisplayName;
            }
            if (two) {
                if (!(two in _langMap)) _langMap[two] = locByCode[two] || c.DisplayName;
            }
        }
    } catch (_) {}
    return _langMap;
}

export function probeMedia(filePath) {
    return new Promise((resolve, reject) => {
        execFile("ffprobe", [
            "-v", "quiet", "-print_format", "json", "-show_format", "-show_streams", filePath
        ], (err, stdout) => {
            if (err) return reject(err);
            const data = JSON.parse(stdout);
            const streams = (data.streams || []).map(s => ({
                Codec: s.codec_name,
                CodecTag: s.codec_tag_string,
                Language: s.tags?.language || "und",
                TimeBase: s.time_base,
                VideoRange: "SDR",
                VideoRangeType: "SDR",
                AudioSpatialFormat: "None",
                LocalizedDefault: "Default",
                LocalizedExternal: "External",
                DisplayTitle: buildDisplayTitle(s),
                IsInterlaced: false,
                IsAVC: s.codec_name === "h264",
                BitRate: parseInt(s.bit_rate) || 0,
                BitDepth: parseInt(s.bits_per_raw_sample) || 8,
                Channels: s.channels || 0,
                SampleRate: parseInt(s.sample_rate) || 0,
                IsDefault: s.disposition?.default === 1,
                IsForced: s.disposition?.forced === 1,
                IsHearingImpaired: false,
                IsOriginal: false,
                Height: s.height || 0,
                Width: s.width || 0,
                AverageFrameRate: evalFrameRate(s.avg_frame_rate),
                RealFrameRate: evalFrameRate(s.r_frame_rate),
                ReferenceFrameRate: evalFrameRate(s.avg_frame_rate),
                Profile: s.profile || "",
                Type: s.codec_type === "video" ? "Video" : s.codec_type === "audio" ? "Audio" : s.codec_type === "subtitle" ? "Subtitle" : "Unknown",
                Index: s.index,
                IsExternal: false,
                IsTextSubtitleStream: s.codec_type === "subtitle",
                SupportsExternalStream: false,
                PixelFormat: s.pix_fmt || "",
                Level: parseInt(s.level) || 0,
                IsAnamorphic: false,
                RefFrames: parseInt(s.refs) || 1,
                NalLengthSize: s.nal_length_size ? String(s.nal_length_size) : "0",
                ChannelLayout: s.channel_layout || "stereo",
                ColorSpace: s.color_space || "bt709",
                ColorTransfer: s.color_transfer || "bt709",
                ColorPrimaries: s.color_primaries || "bt709",
                AspectRatio: s.display_aspect_ratio || "",
            }));

            const videoStream = streams.find(s => s.Type === "Video");
            const audioStream = streams.find(s => s.Type === "Audio");

            const ext = path.extname(filePath).replace(".", "").toLowerCase();
            let container = data.format?.format_name?.split(",")[0] || "mp4";
            if (ext === "mp4" || ext === "m4v") container = "mp4";
            else if (ext === "mkv") container = "mkv";
            else if (ext === "ts") container = "ts";
            else if (ext === "avi") container = "avi";
            else if (ext === "mov") container = "mov";
            else if (ext === "flv") container = "flv";
            else if (ext === "webm") container = "webm";
            else if (ext === "wmv") container = "wmv";
            else if (ext === "mp3") container = "mp3";
            else if (ext === "flac") container = "flac";
            else if (ext === "ogg") container = "ogg";
            else if (ext === "wav") container = "wav";
            else if (ext === "m4a") container = "m4a";

            resolve({
                streams,
                videoStream,
                audioStream,
                container,
                size: parseInt(data.format?.size) || 0,
                duration: parseFloat(data.format?.duration) || 0,
                bitrate: parseInt(data.format?.bit_rate) || 0,
                width: videoStream?.Width || 0,
                height: videoStream?.Height || 0,
            });
        });
    });
}

function buildDisplayTitle(s) {
    if (s.codec_type === "audio") {
        var chLabel = s.channels === 1 ? "Mono" : s.channels === 2 ? "Stereo" : s.channels === 6 ? "5.1" : s.channels === 8 ? "7.1" : s.channels === 3 ? "2.1" : s.channels === 4 ? "4.0" : s.channels + "ch";
        var langCode = (s.tags?.language || s.language || "").toLowerCase();
        var langName = getLangMap()[langCode] || langCode;
        return langName ? langName + " - " + chLabel : chLabel;
    }
    if (s.codec_type === "video") {
        const h = s.height || 0;
        const qual = h >= 2160 ? "4K" : h >= 1080 ? "1080p" : h >= 720 ? "720p" : h >= 480 ? "SD" : "";
        return [qual, s.codec_name?.toUpperCase(), "SDR"].filter(Boolean).join(" ");
    }
    return s.codec_name?.toUpperCase() || "Unknown";
}

function evalFrameRate(rate) {
    if (!rate || rate === "0/0") return 0;
    const [a, b] = rate.split("/").map(Number);
    return b > 0 ? Math.round(a / b) : 0;
}

export function generateItemId(input) {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
        const ch = input.charCodeAt(i);
        hash = ((hash << 5) - hash) + ch;
        hash |= 0;
    }
    return Math.abs(hash).toString(16).padStart(32, "0").slice(0, 32);
}
