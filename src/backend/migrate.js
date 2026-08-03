import Database from "better-sqlite3";
import { existsSync } from "node:fs";
import { randomUUID } from "node:crypto";

function commonColumns(srcCols, destCols) {
    return srcCols.filter(c => destCols.includes(c));
}

function copyTable(src, dest, table, userCol, srcUserId, destUserId, excludeCols = []) {
    const srcCols = src.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
    const destCols = dest.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
    const cols = commonColumns(srcCols, destCols).filter(c => !excludeCols.includes(c));
    if (!cols.length || !cols.includes(userCol)) return 0;

    const select = cols.map(c => `"${c}"`).join(", ");
    const placeholders = cols.map(() => "?").join(", ");
    const insert = dest.prepare(`INSERT INTO ${table} (${select}) VALUES (${placeholders})`);

    const rows = src.prepare(`SELECT ${select} FROM ${table} WHERE "${userCol}" = ?`).all(srcUserId);
    let count = 0;
    for (const row of rows) {
        insert.run(...cols.map(c => (c === userCol ? destUserId : row[c])));
        count++;
    }
    return count;
}

function importUserChildren(src, dest, srcUserId, destUserId, stats) {
    dest.prepare("DELETE FROM Permissions WHERE UserId = ?").run(destUserId);
    dest.prepare("DELETE FROM Preferences WHERE UserId = ?").run(destUserId);
    dest.prepare("DELETE FROM AccessSchedules WHERE UserId = ?").run(destUserId);
    stats.permissions += copyTable(src, dest, "Permissions", "UserId", srcUserId, destUserId, ["Id"]);
    stats.preferences += copyTable(src, dest, "Preferences", "UserId", srcUserId, destUserId, ["Id"]);
    stats.schedules += copyTable(src, dest, "AccessSchedules", "UserId", srcUserId, destUserId, ["Id"]);
}

export function migrateJellyfinDb(sourcePath, destDb) {
    if (!sourcePath || !destDb) return { success: false, error: "Source path or destination DB missing." };
    if (!existsSync(sourcePath)) return { success: false, error: `Source DB not found: ${sourcePath}` };

    const src = new Database(sourcePath, { readonly: true });

    const hasUsers = src.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='Users'").get();
    if (!hasUsers) {
        src.close();
        return { success: false, error: "Source DB has no 'Users' table - not a Jellyfin database." };
    }

    const stats = { users: 0, updated: 0, skipped: 0, devices: 0, permissions: 0, preferences: 0, schedules: 0 };

    const srcUserCols = src.prepare("PRAGMA table_info(Users)").all().map(c => c.name);
    const destUserCols = destDb.prepare("PRAGMA table_info(Users)").all().map(c => c.name);
    const userCols = commonColumns(srcUserCols, destUserCols);
    if (!userCols.includes("Id") || !userCols.includes("Username")) {
        src.close();
        return { success: false, error: "Users table columns mismatch." };
    }

    const selectUserCols = userCols.map(c => `"${c}"`).join(", ");
    const users = src.prepare(`SELECT ${selectUserCols} FROM Users`).all();

    destDb.exec("BEGIN");
    try {
        const maxInternal = destDb.prepare("SELECT MAX(InternalId) AS max FROM Users").get().max || 0;
        let internalId = maxInternal + 1;

        for (const u of users) {
            const existing = destDb.prepare("SELECT Id FROM Users WHERE Id = ?").get(u.Id);
            if (existing) {
                stats.skipped++;
                continue;
            }

            const byName = destDb.prepare("SELECT Id FROM Users WHERE Username = ? COLLATE NOCASE").get(u.Username);
            if (byName) {
                const cols = userCols.filter(c => c !== "Id");
                const sets = cols.map(c => `"${c}" = ?`).join(", ");
                destDb.prepare(`UPDATE Users SET ${sets} WHERE Id = ?`)
                    .run(...cols.map(c => (c === "InternalId" && u[c] == null ? internalId++ : u[c])), byName.Id);
                importUserChildren(src, destDb, u.Id, byName.Id, stats);
                stats.updated++;
                continue;
            }

            const cols = userCols;
            const placeholders = cols.map(() => "?").join(", ");
            const values = cols.map(c => {
                if (c === "Id" && u[c] == null) return crypto.randomUUID().toUpperCase();
                if (c === "InternalId" && u[c] == null) return internalId++;
                if (c === "NormalizedUsername" && u[c] == null) return String(u.Username).toUpperCase();
                return u[c];
            });
            destDb.prepare(`INSERT INTO Users (${cols.map(c => `"${c}"`).join(", ")}) VALUES (${placeholders})`).run(...values);
            importUserChildren(src, destDb, u.Id, u.Id, stats);
            stats.users++;
        }

        const srcDevCols = src.prepare("PRAGMA table_info(Devices)").all().map(c => c.name);
        const destDevCols = destDb.prepare("PRAGMA table_info(Devices)").all().map(c => c.name);
        const devCols = commonColumns(srcDevCols, destDevCols);
        if (devCols.length) {
            const select = devCols.map(c => `"${c}"`).join(", ");
            const placeholders = devCols.map(() => "?").join(", ");
            const insert = destDb.prepare(`INSERT OR IGNORE INTO Devices (${select}) VALUES (${placeholders})`);
            const devices = src.prepare(`SELECT ${select} FROM Devices`).all();
            for (const d of devices) {
                if (insert.run(...devCols.map(c => d[c])).changes) stats.devices++;
            }
        }

        destDb.exec("COMMIT");
    } catch (err) {
        destDb.exec("ROLLBACK");
        src.close();
        return { success: false, error: err.message };
    }
    src.close();

    // Users exist now -> the startup wizard is done and the login screen shows.
    destDb.prepare("UPDATE system SET startup_wizard_completed = 1").run();

    return { success: true, stats };
}
