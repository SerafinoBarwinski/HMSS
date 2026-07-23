import express from "express";
import fs from "node:fs";
import path from "node:path";
import { spawn, execFile } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());
app.use(express.static(__dirname));

const PORT = 8099;
const MEDIA_FILE = path.join(__dirname, "media", "test.mp4");

const PROFILES = {
    "1080p": { w: 1920, h: 1080, bitrate: "5000k" },
    "720p":  { w: 1280, h: 720,  bitrate: "2500k" },
    "480p":  { w: 854,  h: 480,  bitrate: "1000k" },
    "360p":  { w: 640,  h: 360,  bitrate: "500k" },
};

// ordered by preference: best quality/efficiency first
const ENCODE_FORMATS = [
    { container: "mp4",  videoCodec: "h264", acodec: "aac",  vencoder: "libx264",   aencoder: "aac",       mime: 'video/mp4; codecs="avc1.42E01E, mp4a.40.2"' },
    { container: "webm", videoCodec: "vp9",  acodec: "opus", vencoder: "libvpx-vp9", aencoder: "libopus",    mime: 'video/webm; codecs="vp9, opus"' },
    { container: "mp4",  videoCodec: "h265", acodec: "aac",  vencoder: "libx265",    aencoder: "aac",        mime: 'video/mp4; codecs="hvc1.1.6.L120.90, mp4a.40.2"' },
];

// ---- Phase 1: Media Info ----

function probe(filePath) {
    return new Promise((resolve, reject) => {
        execFile("ffprobe", [
            "-v", "quiet", "-print_format", "json", "-show_format", "-show_streams", filePath
        ], (err, stdout) => {
            if (err) return reject(err);
            const data = JSON.parse(stdout);
            const v = data.streams.find(s => s.codec_type === "video");
            const a = data.streams.find(s => s.codec_type === "audio");
            resolve({
                container: data.format.format_name.split(",")[0],
                duration: parseFloat(data.format.duration || 0),
                size: parseInt(data.format.size || 0),
                videoCodec: v ? v.codec_name : null,
                videoWidth: v ? v.width : 0,
                videoHeight: v ? v.height : 0,
                videoBitrate: parseInt(v?.bit_rate || data.format.bit_rate || 0),
                audioCodec: a ? a.codec_name : null,
                canDirectPlay: !!(v && a),
            });
        });
    });
}

app.get("/api/media", async (req, res) => {
    try {
        const info = await probe(MEDIA_FILE);
        res.json(info);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ---- Phase 3: Transcode Options ----

app.get("/api/transcode-options", (req, res) => {
    res.json(ENCODE_FORMATS.map(f => ({
        container: f.container,
        videoCodec: f.videoCodec,
        audioCodec: f.acodec,
        mime: f.mime,
    })));
});

// ---- Phase 2/4: Streaming ----

function serveFile(filePath, req, res) {
    if (!fs.existsSync(filePath)) return res.status(404).end();
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        res.writeHead(206, {
            "Content-Range": `bytes ${start}-${end}/${fileSize}`,
            "Accept-Ranges": "bytes",
            "Content-Length": end - start + 1,
            "Content-Type": "video/mp4",
        });
        fs.createReadStream(filePath, { start, end }).pipe(res);
    } else {
        res.writeHead(200, { "Content-Length": fileSize, "Content-Type": "video/mp4" });
        fs.createReadStream(filePath).pipe(res);
    }
}

app.get("/stream", (req, res) => serveFile(MEDIA_FILE, req, res));

app.get("/transcode", (req, res) => {
    const { vc, ac, profile, ss } = req.query;
    console.log(`Transcode request: vc=${vc} ac=${ac} profile=${profile} ss=${ss || 0}`);
    const fmt = ENCODE_FORMATS.find(f => f.videoCodec === vc && f.acodec === ac);
    if (!fmt) return res.status(400).json({ error: "Unsupported codec combination" });

    const prof = PROFILES[profile] || PROFILES["720p"];
    const seekTime = parseFloat(ss) || 0;

    const args = [];
    if (seekTime > 0) {
        args.push("-ss", String(seekTime));
    }
    args.push(
        "-i", MEDIA_FILE,
        "-c:v", fmt.vencoder, "-preset", "ultrafast",
        "-pix_fmt", "yuv420p",
        "-b:v", prof.bitrate,
        "-vf", `scale=${prof.w}:${prof.h}:force_original_aspect_ratio=decrease`,
        "-c:a", fmt.aencoder, "-b:a", "128k",
        "-f", fmt.container === "webm" ? "webm" : "mp4",
        "-movflags", "frag_keyframe+empty_moov",
        "pipe:1"
    );

    const mime = `video/${fmt.container === "webm" ? "webm" : "mp4"}`;
    res.writeHead(200, { "Content-Type": mime });

    const proc = spawn("ffmpeg", args, { stdio: ["ignore", "pipe", "pipe"] });
    proc.stdout.pipe(res);
    proc.stderr.on("data", () => {});

    req.on("close", () => proc.kill());
});

app.get("/", (req, res) => res.sendFile(path.join(__dirname, "player.html")));

// ---- Progress persistence ----

const playbackState = new Map(); // itemId -> { position, updatedAt }

app.get("/api/progress/:itemId", (req, res) => {
    const state = playbackState.get(req.params.itemId);
    if (state) {
        res.json(state);
    } else {
        res.json({ position: 0, updatedAt: null });
    }
});

app.post("/api/progress/:itemId", (req, res) => {
    const { position } = req.body;
    if (typeof position !== "number") return res.status(400).json({ error: "position required" });
    playbackState.set(req.params.itemId, {
        position,
        updatedAt: new Date().toISOString(),
    });
    res.json({ ok: true });
});

app.listen(PORT, () => console.log(`POC http://localhost:${PORT}`));
