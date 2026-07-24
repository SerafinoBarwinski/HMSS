import { execFile } from "node:child_process";
import path from "node:path";

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
                BitDepth: s.bits_per_raw_sample || 8,
                Channels: s.channels || 0,
                SampleRate: parseInt(s.sample_rate) || 0,
                IsDefault: s.disposition?.default === 1,
                IsForced: s.disposition?.forced === 1,
                IsHearingImpaired: false,
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
                Level: s.level || 0,
                IsAnamorphic: false,
                RefFrames: s.refs || 1,
                NalLengthSize: s.nal_length_size ? String(s.nal_length_size) : "0",
                ChannelLayout: s.channel_layout || "stereo",
                ColorSpace: s.color_space || "bt709",
                ColorTransfer: s.color_transfer || "bt709",
                ColorPrimaries: s.color_primaries || "bt709",
                AspectRatio: s.display_aspect_ratio || "",
            }));

            const videoStream = streams.find(s => s.Type === "Video");
            const audioStream = streams.find(s => s.Type === "Audio");

            resolve({
                streams,
                videoStream,
                audioStream,
                container: data.format?.format_name?.split(",")[0] || "mp4",
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
        const ch = s.channels === 2 ? "Stereo" : s.channels === 1 ? "Mono" : s.channels + "ch";
        return `${s.codec_name?.toUpperCase()} - ${ch} - Default`;
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
