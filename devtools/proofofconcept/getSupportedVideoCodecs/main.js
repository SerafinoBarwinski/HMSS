import { exec } from "node:child_process";

function parseVideoCodecs(output) {
    return output
        .split("\n")
        .map(line => line.trim())
        .filter(line => /^([VAS])\S+\s+\S+/.test(line))
        .map(line => {
            const match = line.match(/^([VAS])\S+\s+(\S+)/);
            return match ? match[2] : null;
        })
        .filter(Boolean)
        .filter(codec => codec !== "=" && !codec.includes("="));
}

function isImportantCodec(codec) {
    const normalized = codec.toLowerCase();
    const importantPatterns = [
        "h264",
        "h265",
        "hevc",
        "av1",
        "vp8",
        "vp9",
        "mpeg4",
        "mpeg2",
        "mjpeg",
        "prores",
        "jpeg2000",
        "theora",
        "rawvideo",
        "h263",
        "vc1",
        "gif",
        "png",
        "webp",
        "libx264",
        "libx265",
        "libaom-av1",
        "librav1e",
        "libsvtav1",
        "libvpx",
        "libvpx-vp9",
        "libvvenc",
        "libjxl",
        "libwebp",
        "libopenh264"
    ];

    return importantPatterns.some(pattern => normalized.includes(pattern));
}

function filterImportantCodecs(codecs) {
    return codecs.filter(codec => isImportantCodec(codec));
}

function getSupportedEncoders(importantOnly = false) {
    return new Promise((resolve, reject) => {
        exec("ffmpeg -hide_banner -encoders 2>&1", (error, stdout, stderr) => {
            if (error) {
                reject(new Error(stderr.trim() || error.message));
                return;
            }

            try {
                const codecs = parseVideoCodecs(stdout);
                resolve(importantOnly ? filterImportantCodecs(codecs) : codecs);
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
                const codecs = parseVideoCodecs(stdout);
                resolve(importantOnly ? filterImportantCodecs(codecs) : codecs);
            } catch (parseError) {
                reject(parseError);
            }
        });
    });
}

export { getSupportedEncoders, getSupportedDecoders };