import dgram from "node:dgram";
import os from "node:os";

export function startDiscovery(port, httpPort) {
    const socket = dgram.createSocket({ type: "udp4", reuseAddr: true });

    const serverId = getServerId();
    const serverName = os.hostname();
    const ip = getLocalIPv4();

    socket.on("message", (msg, rinfo) => {
        const text = msg.toString().trim();

        if (text.includes("who is JellyfinServer") || text.includes("M-SEARCH") || text.includes("ssdp:discover")) {
            const response = JSON.stringify({
                Address: `http://${ip}:${httpPort}`,
                Id: serverId,
                Name: serverName,
                EndpointAddress: `http://${ip}:${httpPort}`,
            });

            socket.send(response, rinfo.port, rinfo.address);
            console.log(`Discovery response sent to ${rinfo.address}:${rinfo.port}`);
        }
    });

    socket.on("listening", () => {
        socket.setBroadcast(true);
        console.log(`Discovery listening on UDP ${port}`);
    });

    socket.on("error", (err) => {
        console.warn(`Discovery socket error: ${err.message}`);
    });

    socket.bind(port);

    return socket;
}

function getServerId() {
    try {
        const db = globalThis.__db;
        if (db) {
            const sys = db.prepare("SELECT id FROM system").get();
            if (sys) return sys.id;
        }
    } catch {}
    return "hmss-local";
}

function getLocalIPv4() {
    const interfaces = os.networkInterfaces();
    for (const [, addrs] of Object.entries(interfaces)) {
        for (const addr of addrs) {
            if (addr.family === "IPv4" && !addr.internal) {
                return addr.address;
            }
        }
    }
    return "127.0.0.1";
}
