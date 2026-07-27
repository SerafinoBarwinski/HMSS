import { exec } from "node:child_process";

function parseCodecs(output) {
    return output
        .split("\n")
        .map(line => line.trim())
        .filter(line => /^([VAS])\S+\s+\S+/.test(line))
        .map(line => {
            const match = line.match(/^([VAS])\S+\s+(\S+)/);
            return match ? { name: match[2], type: match[1] === "V" ? "video" : match[1] === "A" ? "audio" : "subtitle" } : null;
        })
        .filter(Boolean)
        .filter(c => c.name !== "=" && !c.name.includes("="));
}

function isImportantCodec(codec) {
    const normalized = codec.toLowerCase();
    const importantPatterns = [
        "h264", "h265", "hevc", "av1", "vp8", "vp9",
        "mpeg4", "mpeg2", "mjpeg", "prores", "jpeg2000",
        "theora", "rawvideo", "h263", "vc1", "gif", "png", "webp",
        "libx264", "libx265", "libaom-av1", "librav1e", "libsvtav1",
        "libvpx", "libvpx-vp9", "libvvenc", "libjxl", "libwebp", "libopenh264",
        "aac", "libfdk_aac", "libvo_aacenc", "ac3", "eac3", "libopus",
        "libvorbis", "mp3", "libmp3lame", "flac", "alac", "pcm_",
        "dts", "truehd", "dra", "wma",
    ];
    return importantPatterns.some(pattern => normalized.includes(pattern));
}

function filterImportantCodecs(codecs) {
    return codecs.filter(c => isImportantCodec(c.name));
}

function getSupportedEncoders(importantOnly = false) {
    return new Promise((resolve, reject) => {
        exec("ffmpeg -hide_banner -encoders 2>&1", (error, stdout, stderr) => {
            if (error) {
                reject(new Error(stderr.trim() || error.message));
                return;
            }
            try {
                const codecs = parseCodecs(stdout);
                const result = importantOnly ? filterImportantCodecs(codecs) : codecs;
                resolve(result.map(c => c.name));
            } catch (parseError) {
                reject(parseError);
            }
        });
    });
}

function getSupportedDecoders(importantOnly = false) {
    return new Promise((resolve, reject) => {
        exec("ffmpeg -hide_banner -decoders 2>&1", (error, stdout, stderr) => {
            if (error) {
                reject(new Error(stderr.trim() || error.message));
                return;
            }
            try {
                const codecs = parseCodecs(stdout);
                const result = importantOnly ? filterImportantCodecs(codecs) : codecs;
                resolve(result.map(c => c.name));
            } catch (parseError) {
                reject(parseError);
            }
        });
    });
}

let _encoderCache = null;
let _decoderCache = null;

async function getEncoderList() {
    if (!_encoderCache) _encoderCache = await getSupportedEncoders(true);
    return _encoderCache;
}

async function getDecoderList() {
    if (!_decoderCache) _decoderCache = await getSupportedDecoders(true);
    return _decoderCache;
}

function refreshCodecCache() {
    _encoderCache = null;
    _decoderCache = null;
}

const VIDEO_CODEC_FAMILIES = {
    h264: ["h264", "libx264", "libopenh264", "libx264rgb"],
    hevc: ["hevc", "libx265", "libvvenc"],
    av1: ["av1", "libaom-av1", "librav1e", "libsvtav1"],
    vp9: ["vp9", "libvpx-vp9"],
    vp8: ["vp8", "libvpx"],
    mpeg4: ["mpeg4"],
    mpeg2: ["mpeg2video"],
};

const AUDIO_CODEC_FAMILIES = {
    aac: ["aac", "libfdk_aac", "libvo_aacenc", "aac_at"],
    ac3: ["ac3"],
    eac3: ["eac3"],
    opus: ["libopus", "opus"],
    vorbis: ["libvorbis", "vorbis"],
    mp3: ["libmp3lame", "mp3", "mp3float"],
    flac: ["flac"],
    alac: ["alac"],
    pcm: ["pcm_s16le", "pcm_s24le", "pcm_s32le", "pcm_f32le", "pcm_f64le", "pcm_alaw", "pcm_mulaw"],
    dts: ["dca", "dts", "dts_es", "dts_es", "dts_24", "dts_es_ma", "dts_hd_ma", "dts_hd_hra"],
    truehd: ["truehd"],
};

function getCodecFamily(codecName) {
    const lower = (codecName || "").toLowerCase();
    for (const [family, names] of Object.entries(VIDEO_CODEC_FAMILIES)) {
        if (names.some(n => lower === n || lower.includes(n))) return { family, type: "video" };
    }
    for (const [family, names] of Object.entries(AUDIO_CODEC_FAMILIES)) {
        if (names.some(n => lower === n || lower.includes(n))) return { family, type: "audio" };
    }
    return { family: lower, type: "unknown" };
}

const HLS_COMPATIBLE_VIDEO = new Set(["h264"]);
const HLS_COMPATIBLE_AUDIO = new Set(["aac"]);
const DIRECT_PLAY_VIDEO = new Set(["h264", "hevc", "vp9", "av1", "vp8", "mpeg4"]);
const DIRECT_PLAY_AUDIO = new Set(["aac", "mp3", "ac3", "eac3", "opus", "flac", "vorbis"]);

function needsVideoTranscoding(sourceCodec) {
    const { family } = getCodecFamily(sourceCodec);
    return !HLS_COMPATIBLE_VIDEO.has(family);
}

function needsAudioTranscoding(sourceCodec) {
    const { family } = getCodecFamily(sourceCodec);
    return !HLS_COMPATIBLE_AUDIO.has(family);
}

function canDirectPlayVideo(sourceCodec) {
    const { family } = getCodecFamily(sourceCodec);
    return DIRECT_PLAY_VIDEO.has(family);
}

function canDirectPlayAudio(sourceCodec) {
    const { family } = getCodecFamily(sourceCodec);
    return DIRECT_PLAY_AUDIO.has(family);
}

async function pickBestVideoEncoder(encoders) {
    const list = await getEncoderList();
    const preferred = ["libx264", "h264_nvenc", "h264_vaapi", "h264_qsv", "h264_videotoolbox", "libopenh264"];
    for (const enc of preferred) {
        if (list.some(e => e.toLowerCase() === enc)) return enc;
    }
    if (list.some(e => e.toLowerCase().includes("h264"))) {
        return list.find(e => e.toLowerCase().includes("h264"));
    }
    return "libx264";
}

async function pickBestAudioEncoder() {
    const list = await getEncoderList();
    const preferred = ["libfdk_aac", "aac", "aac_at", "libvo_aacenc"];
    for (const enc of preferred) {
        if (list.some(e => e.toLowerCase() === enc)) return enc;
    }
    return "aac";
}

function getVideoEncoderArgs(encoder) {
    const base = encoder.toLowerCase();
    if (base.includes("nvenc")) return ["-c:v", encoder, "-preset", "p4", "-tune", "hq", "-rc", "constqp", "-qp", "23", "-spatial-aq", "1"];
    if (base.includes("vaapi")) return ["-c:v", encoder, "-qp", "23"];
    if (base.includes("qsv")) return ["-c:v", encoder, "-preset", "medium", "-global_quality", "23"];
    if (base.includes("libx264")) return ["-c:v", "libx264", "-preset", "veryfast", "-tune", "zerolatency", "-crf", "23", "-profile:v", "high", "-level", "4.1"];
    return ["-c:v", encoder, "-crf", "23"];
}

function getAudioEncoderArgs(encoder) {
    const base = encoder.toLowerCase();
    if (base.includes("libfdk_aac") || base === "aac" || base.includes("aac_at")) {
        return ["-c:a", encoder, "-b:a", "192k", "-ar", "48000", "-ac", "2"];
    }
    if (base.includes("libmp3lame") || base === "mp3") {
        return ["-c:a", "libmp3lame", "-b:a", "192k", "-ar", "48000", "-ac", "2"];
    }
    if (base.includes("libopus") || base === "opus") {
        return ["-c:a", "libopus", "-b:a", "128k", "-ar", "48000", "-ac", "2"];
    }
    return ["-c:a", encoder, "-b:a", "192k", "-ar", "48000", "-ac", "2"];
}

export {
    getSupportedEncoders,
    getSupportedDecoders,
    getEncoderList,
    getDecoderList,
    refreshCodecCache,
    getCodecFamily,
    needsVideoTranscoding,
    needsAudioTranscoding,
    canDirectPlayVideo,
    canDirectPlayAudio,
    pickBestVideoEncoder,
    pickBestAudioEncoder,
    getVideoEncoderArgs,
    getAudioEncoderArgs,
    HLS_COMPATIBLE_VIDEO,
    HLS_COMPATIBLE_AUDIO,
    DIRECT_PLAY_VIDEO,
    DIRECT_PLAY_AUDIO,
    VIDEO_CODEC_FAMILIES,
    AUDIO_CODEC_FAMILIES,
};
