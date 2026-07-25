import SSDP from "node-ssdp";
import http from "node:http";

const port = 8001;

const requiredUserAgent = "Jellyfin-SATIP";

const deviceXml = `<?xml version="1.0"?>
<root xmlns="urn:schemas-upnp-org:device-1-0"
      xmlns:satip="urn:ses-com:satip">
    <specVersion>
        <major>1</major>
        <minor>0</minor>
    </specVersion>

    <device>
        <deviceType>
            urn:ses-com:device:SatIPServer:1
        </deviceType>

        <friendlyName>
            Node SAT>IP Server
        </friendlyName>

        <manufacturer>
            NodeJS
        </manufacturer>

        <modelName>
            Virtual SAT>IP Tuner
        </modelName>

        <UDN>
            uuid:node-satip-server-001
        </UDN>

        <satip:X_SATIPCAP>
            DVBS2-4
        </satip:X_SATIPCAP>
    </device>
</root>`;


// HTTP Server für device.xml
const httpServer = http.createServer((req, res) => {
    if (req.url === "/device.xml") {
        const userAgent = req.headers["user-agent"] ?? "";

        if (false && !userAgent.includes(requiredUserAgent)) {
            res.writeHead(403, {
                "Content-Type": "text/plain"
            });

            res.end("Forbidden");
            return;
        }

        res.writeHead(200, {
            "Content-Type": "application/xml"
        });

        res.end(deviceXml);
        return;
    }

    res.writeHead(404);
    res.end();
});

httpServer.listen(port, () => {
    console.log(`XML Server läuft auf Port ${port}`);
});


// SSDP Server
const ssdp = new SSDP.Server({
    location: `http://127.0.0.1:${port}/device.xml`
});

ssdp.addUSN("urn:ses-com:device:SatIPServer:1");

ssdp.start();

console.log("SSDP Server läuft");