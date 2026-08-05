import { spawn } from "node:child_process";
import { mkdirSync, rmSync, existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { DEBUG_GENEREL } from "../../server.js";
import {
    needsVideoTranscoding,
    needsAudioTranscoding,
    pickBestVideoEncoder,
    pickBestAudioEncoder,
    getVideoEncoderArgs,
    getAudioEncoderArgs,
} from "./codecs.js";

const FFMPEG_BIN = "/bin/ffmpeg";
const HLS_SEGMENT_TIME = 4;
const HLS_LIST_SIZE = 0;
const SESSION_TTL_MS = 120000;
const TRANSCODE_ROOT = path.join(os.tmpdir(), "hmss-transcode");

const activeSessions = new Map();

function ensureTranscodeDir(sessionId) {
    const dir = path.join(TRANSCODE_ROOT, sessionId);
    mkdirSync(dir, { recursive: true });
    return dir;
}

function cleanupSession(sessionId) {
    const session = activeSessions.get(sessionId);
    if (session?.process && !session.process.killed) {
        session.process.kill("SIGTERM");
    }
    const dir = path.join(TRANSCODE_ROOT, sessionId);
    if (existsSync(dir)) {
        try { rmSync(dir, { recursive: true, force: true }); } catch {}
    }
    activeSessions.delete(sessionId);
}

function needsTranscoding(probe) {
    const videoStream = probe?.streams?.find(s => s.Type === "Video");
    const audioStream = probe?.streams?.find(s => s.Type === "Audio");
    const videoNeeded = videoStream ? needsVideoTranscoding(videoStream.Codec) : false;
    const audioNeeded = audioStream ? needsAudioTranscoding(audioStream.Codec) : false;
    return { videoNeeded, audioNeeded, needed: videoNeeded || audioNeeded };
}

async function buildFfmpegArgs(sourceFile, outputDir, probe, audioStreamIndex, startTimeSec) {
    if (DEBUG_GENEREL) console.log("[FFMPEG] buildFfmpegArgs input:", JSON.stringify({ sourceFile, audioStreamIndex, startTimeSec, streamCount: probe?.streams?.length }));

    const args = ["-hide_banner", "-loglevel", "warning"];
    if (startTimeSec > 0) args.push("-ss", String(startTimeSec));
    args.push("-i", sourceFile);

    const videoStream = probe?.streams?.find(s => s.Type === "Video");
    const videoNeed = videoStream ? needsVideoTranscoding(videoStream.Codec) : false;

    if (videoNeed) {
        const encoder = await pickBestVideoEncoder();
        const pixFmt = (videoStream?.PixelFormat || "").toLowerCase();
        const needsPixFmtConversion = pixFmt && !pixFmt.startsWith("yuv420") && !pixFmt.startsWith("yuvj420");
        if (needsPixFmtConversion) {
            args.push("-vf", "format=yuv420p");
        }
        args.push(...getVideoEncoderArgs(encoder));
    } else if (videoStream) {
        args.push("-c:v", "copy");
    }

    var audioIdx = audioStreamIndex != null ? audioStreamIndex : (probe?.streams?.findIndex(s => s.Type === "Audio") >= 0 ? probe.streams.findIndex(s => s.Type === "Audio") : null);
    if (DEBUG_GENEREL) console.log("[FFMPEG] audioIdx:", audioIdx, "total streams:", probe?.streams?.map(s => s.Type + ":" + s.Index));

    if (audioIdx != null && probe?.streams?.[audioIdx]?.Type === "Audio") {
        var audioMapIdx = probe.streams.filter(s => s.Type === "Audio").indexOf(probe.streams[audioIdx]);
        if (DEBUG_GENEREL) console.log("[FFMPEG] mapping audio: program stream index", audioIdx, "→ ffmpeg -map 0:a:" + audioMapIdx, "codec:", probe.streams[audioIdx].Codec, "language:", probe.streams[audioIdx].Language);
        args.push("-map", "0:v:0", "-map", "0:a:" + audioMapIdx);
        var audioStream = probe.streams[audioIdx];
        if (needsAudioTranscoding(audioStream.Codec)) {
            const encoder = await pickBestAudioEncoder();
            args.push(...getAudioEncoderArgs(encoder));
        } else {
            args.push("-c:a", "copy");
        }
    } else {
        args.push("-map", "0:v:0");
        var firstAudio = probe?.streams?.find(s => s.Type === "Audio");
        if (firstAudio) {
            args.push("-map", "0:a:0");
            if (needsAudioTranscoding(firstAudio.Codec)) {
                const encoder = await pickBestAudioEncoder();
                args.push(...getAudioEncoderArgs(encoder));
            } else {
                args.push("-c:a", "copy");
            }
        }
    }

    args.push("-f", "hls");
    args.push("-hls_time", String(HLS_SEGMENT_TIME));
    args.push("-hls_list_size", String(HLS_LIST_SIZE));
    args.push("-hls_flags", "independent_segments");
    args.push("-hls_segment_type", "mpegts");
    args.push("-hls_segment_filename", path.join(outputDir, "seg_%05d.ts"));
    args.push(path.join(outputDir, "playlist.m3u8"));

    if (DEBUG_GENEREL) console.log("[FFMPEG] final args:", args.join(" "));
    return args;
}

function startTranscode(sourceFile, probe, audioStreamIndex, startTimeSec) {
    const sessionId = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
    const outputDir = ensureTranscodeDir(sessionId);

    const info = needsTranscoding(probe);

    return buildFfmpegArgs(sourceFile, outputDir, probe, audioStreamIndex, startTimeSec).then(args => {
        return new Promise((resolve, reject) => {
            const proc = spawn(FFMPEG_BIN, args, {
                stdio: ["ignore", "pipe", "pipe"],
            });

            let stderrBuf = "";
            proc.stderr.on("data", (chunk) => { stderrBuf += chunk; });

            const session = {
                id: sessionId,
                process: proc,
                outputDir,
                sourceFile,
                startedAt: Date.now(),
                finishedAt: null,
                info,
            };
            activeSessions.set(sessionId, session);

            let resolved = false;
            const checkReady = () => {
                if (resolved) return;
                const playlist = path.join(outputDir, "playlist.m3u8");
                if (existsSync(playlist)) {
                    const content = readFileSync(playlist, "utf8");
                    if (content.includes("#EXT-X-MEDIA-SEQUENCE") && content.includes(".ts")) {
                        resolved = true;
                        resolve(session);
                    }
                }
                if (!resolved) setTimeout(checkReady, 200);
            };

            proc.on("error", (err) => {
                if (!resolved) reject(err);
                cleanupSession(sessionId);
            });

            proc.on("exit", (code) => {
                if (!resolved) {
                    const playlist = path.join(outputDir, "playlist.m3u8");
                    const content = existsSync(playlist) ? readFileSync(playlist, "utf8") : "";
                    const hasValidPlaylist = content.includes("#EXT-X-MEDIA-SEQUENCE") && content.includes(".ts");
                    if (code === 0 && hasValidPlaylist) {
                        resolved = true;
                        session.finishedAt = Date.now();
                        resolve(session);
                        setTimeout(() => cleanupSession(sessionId), SESSION_TTL_MS);
                        return;
                    }
                    reject(new Error(`ffmpeg exited with code ${code}: ${stderrBuf.slice(-500)}`));
                    cleanupSession(sessionId);
                    return;
                }
                session.finishedAt = Date.now();
                setTimeout(() => cleanupSession(sessionId), SESSION_TTL_MS);
            });

            setTimeout(checkReady, 500);
        });
    });
}

function getTranscodePath(sessionId) {
    const dir = path.join(TRANSCODE_ROOT, sessionId);
    if (!existsSync(dir)) return null;
    return dir;
}

function getActiveSessions() {
    return activeSessions;
}

function listSegments(sessionId) {
    const dir = getTranscodePath(sessionId);
    if (!dir) return [];
    try {
        return readdirSync(dir)
            .filter(f => f.endsWith(".ts"))
            .sort();
    } catch {
        return [];
    }
}

function readPlaylist(sessionId) {
    const dir = getTranscodePath(sessionId);
    if (!dir) return null;
    const playlistPath = path.join(dir, "playlist.m3u8");
    if (!existsSync(playlistPath)) return null;
    try {
        return readFileSync(playlistPath, "utf8");
    } catch {
        return null;
    }
}

function getSegmentPath(sessionId, segmentName) {
    const dir = getTranscodePath(sessionId);
    if (!dir) return null;
    const segPath = path.join(dir, segmentName);
    if (!existsSync(segPath)) return null;
    return segPath;
}

function cleanupAll() {
    for (const [id] of activeSessions) {
        cleanupSession(id);
    }
    if (existsSync(TRANSCODE_ROOT)) {
        try { rmSync(TRANSCODE_ROOT, { recursive: true, force: true }); } catch {}
    }
}

process.on("exit", cleanupAll);
process.on("SIGINT", () => { cleanupAll(); process.exit(0); });
process.on("SIGTERM", () => { cleanupAll(); process.exit(0); });

export {
    startTranscode,
    getTranscodePath,
    getActiveSessions,
    listSegments,
    readPlaylist,
    getSegmentPath,
    cleanupSession,
    cleanupAll,
    needsTranscoding,
};
