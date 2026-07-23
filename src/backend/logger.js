import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function enableConsoleFileLogger(file = "logs/other.log", maxLines = 10000) {
    const logPath = path.resolve(__dirname, file);

    fs.mkdirSync(path.dirname(logPath), { recursive: true });

    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;

    const writeLog = (type, args) => {
        const timestamp = new Date().toISOString();

        const message = args
            .map(arg => {
                if (typeof arg === "object") {
                    return JSON.stringify(arg, null, 2);
                }

                return String(arg);
            })
            .join(" ");

        const line = `[${timestamp}] [${type}] ${message}`;

        let lines = [];

        if (fs.existsSync(logPath)) {
            lines = fs.readFileSync(logPath, "utf8")
                .split("\n")
                .filter(Boolean);
        }

        if (lines.length >= maxLines) {
            lines = lines.slice(lines.length - maxLines + 1);
        }

        lines.push(line);

        fs.writeFileSync(
            logPath,
            lines.join("\n") + "\n"
        );
    };

    console.log = (...args) => {
        writeLog("LOG", args);
        originalLog(...args);
    };

    console.error = (...args) => {
        writeLog("ERROR", args);
        originalError(...args);
    };

    console.warn = (...args) => {
        writeLog("WARN", args);
        originalWarn(...args);
    };
}