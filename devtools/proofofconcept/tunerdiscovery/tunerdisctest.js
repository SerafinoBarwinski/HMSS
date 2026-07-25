import HDHomeRun from "hdhomerun";
import SSDP from "node-ssdp";
import { XMLParser } from "fast-xml-parser";
import crypto from "node:crypto";

HDHomeRun.discover((err, devices) => {
    if (err) {
        console.error(err);
        return;
    }

    console.log("HDHHR: " + devices);
});

const { Client } = SSDP;
const client = new Client();

const seen = new Set();

client.on("response", async (headers, statusCode, rinfo) => {
    if (seen.has(rinfo.address)) {
        return;
    }
    seen.add(rinfo.address);
    
    var server = await satipToJellyfin(headers.LOCATION)
    console.log(server);
});
//client.search("ssdp:all");
client.search("urn:ses-com:device:SatIPServer:1");

export async function satipToJellyfin(location) {
    let response;

    try {
        response = await fetch(location);

        if (!response.ok && [400, 401, 403].includes(response.status)) {
            console.log("Tuner rejected. Trying with UserAgent")
            response = await fetch(location, {
                headers: {
                    "User-Agent": "Jellyfin-SATIP"
                }
            });
        }
    } catch (error) {
        response = await fetch(location, {
            headers: {
                "User-Agent": "Jellyfin-SATIP"
            }
        });
    }

    if (!response.ok) {
        throw new Error(`Failed loading ${location}`);
    }

    const xml = await response.text();

    const parser = new XMLParser({
        ignoreAttributes: false
    });

    const data = parser.parse(xml);

    const device = data.root?.device ?? data.device;

    const friendlyName =
        device?.friendlyName ?? "SAT>IP Server";

    const caps =
        device?.["satip:X_SATIPCAP"] ??
        device?.["X_SATIPCAP"] ??
        "";

    const tunerCount = getTunerCount(caps);

    const deviceId = crypto
        .createHash("md5")
        .update(location)
        .digest("hex")
        .substring(0, 12);

    return {
        Id: deviceId,
        Url: location,
        Type: "m3u",
        DeviceId: deviceId,
        FriendlyName: friendlyName,
        ImportFavoritesOnly: false,
        AllowHWTranscoding: false,
        AllowFmp4TranscodingContainer: false,
        AllowStreamSharing: false,
        FallbackMaxStreamingBitrate: 0,
        EnableStreamLooping: false,
        Source: "SSDP",
        TunerCount: tunerCount,
        UserAgent: "",
        IgnoreDts: true,
        ReadAtNativeFramerate: true
    };
}


function getTunerCount(capabilities) {
    if (typeof capabilities !== "string" || !capabilities.trim()) {
        return 0;
    }

    return capabilities
        .split(",")
        .map(cap => {
            const match = cap.match(/-(\d+)$/);
            return match ? Number(match[1]) : 0;
        })
        .reduce((max, count) => Math.max(max, count), 0);
}