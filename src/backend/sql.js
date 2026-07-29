import { randomUUID } from "node:crypto";
import { randomBytes } from "node:crypto";
import os from "node:os";

export async function init(rootPsw, db, argon2) {
    if (!db || !argon2) return { succes: false, reason: "One of the modules is missing or null.", code: 5 };
    // Make User DB
    db.exec(`
        create table if not exists "users" (
            "id" INTEGER PRIMARY KEY AUTOINCREMENT,
            "uuid" TEXT,
            "created_at" TEXT not null default CURRENT_TIMESTAMP,
            "created_by" TEXT not null default 'SYSTEM',
            "name" varchar(50) not null,
            "password_hash" TEXT not null,
            "perms" INT not null,
            "logo_path" TEXT null,
            "max_video_width" INT not null default 1920,
            "max_video_height" INT not null default 1080,
            "max_video_bitrate" INT not null default 20000000,
            "allow_hdr" BOOLEAN not null default true,
            "policy_json" TEXT null
        );

        create table if not exists "sessions" (
            "token" TEXT PRIMARY KEY,
            "user_id" INTEGER not null,
            "created_at" TEXT not null default CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        );

        create table if not exists "system" (
            "id" TEXT PRIMARY KEY,
            "server_name" TEXT not null,
            "product_name" TEXT not null,
            "startup_wizard_completed" BOOLEAN not null default false,
            "config_json" TEXT default '{}'
        );

        create table if not exists "user_data" (
            "user_id" INTEGER not null,
            "item_id" TEXT not null,
            "playback_position_ticks" INTEGER not null default 0,
            "play_count" INTEGER not null default 0,
            "is_favorite" BOOLEAN not null default false,
            "played" BOOLEAN not null default false,
            "last_played_date" TEXT,
            "played_percentage" REAL not null default 0,
            PRIMARY KEY (user_id, item_id),
            FOREIGN KEY (user_id) REFERENCES users(id)
        );

        create table if not exists "user_nfc" (
            "id" INTEGER PRIMARY KEY AUTOINCREMENT,
            "user_id" INTEGER not null,
            "tag_id" TEXT not null,
            "tag_name" TEXT not null default '',
            "action_type" TEXT not null default 'none',
            "action_payload" TEXT not null default '{}',
            "created_at" TEXT not null default CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id),
            UNIQUE(user_id, tag_id)
        );
    `); // PERMS: 0 - 3; where 3 is root and 2 admin. 1 manager and 0 visitor

    // add uuid column to existing tables (harmless if already exists)
    try { db.exec("ALTER TABLE users ADD COLUMN uuid TEXT"); } catch {}

    try { db.exec('ALTER TABLE user_nfc ADD COLUMN "description" TEXT not null default \'\''); } catch {}
    try { db.exec('ALTER TABLE user_nfc ADD COLUMN "is_from_ha" BOOLEAN not null default 0'); } catch {}

    // migrate: add UUID to existing users that don't have one
    const missingUuid = db.prepare("SELECT id FROM users WHERE uuid IS NULL").all();
    for (const row of missingUuid) {
        db.prepare("UPDATE users SET uuid = ? WHERE id = ?").run(randomUUID(), row.id);
    }

    try { db.exec("ALTER TABLE system ADD COLUMN telerising_autostart BOOLEAN default true"); } catch {}
    try { db.exec("ALTER TABLE users ADD COLUMN policy_json TEXT"); } catch {}

    // clear sessions older than 3 days
    db.exec("DELETE FROM sessions WHERE created_at < datetime('now', '-3 days')");

    // no root user auto-creation — first user is created via startup wizard

    const systemRow = db.prepare("SELECT id FROM system").get();
    if (!systemRow) {
        const id = randomBytes(16).toString("hex");
        db.prepare("INSERT INTO system (id, server_name, product_name) VALUES (?, ?, ?)")
            .run(id, os.hostname(), "Jellyfin Server");
        console.log("System row created:", id);
    }

    return { succes: true, reason: null, code: 0 };
}

export async function removeUser(userId, db) {
    if (userId == null || !db) {
        return {
            success: false,
            reason: "User ID or database is missing.",
            code: 4
        };
    }

    const user = db.prepare("SELECT id, name FROM users WHERE id = ?").get(userId);
    if (!user) {
        return {
            success: false,
            reason: "User not found.",
            code: 3
        };
    }

    if (user.name === "root") {
        return {
            success: false,
            reason: "Cannot remove the root user.",
            code: 2
        };
    }

    db.prepare("DELETE FROM users WHERE id = ?").run(userId);

    console.log(`User ${userId} removed.`);
    return { success: true, code: 0 };
}

export async function editUser(userId, updates, db, argon2) {
    if (userId == null || !db) {
        return {
            success: false,
            reason: "User ID or database is missing.",
            code: 4
        };
    }

    const user = db.prepare("SELECT id, name FROM users WHERE id = ?").get(userId);
    if (!user) {
        return {
            success: false,
            reason: "User not found.",
            code: 3
        };
    }

    if (user.name === "root") {
        return {
            success: false,
            reason: "Cannot edit the root user.",
            code: 2
        };
    }

    const allowedFields = [
        "name",
        "perms",
        "logo_path",
        "max_video_width",
        "max_video_height",
        "max_video_bitrate",
        "allow_hdr"
    ];

    const data = {};

    for (const field of allowedFields) {
        if (updates[field] !== undefined) {
            if (field === "name" && updates[field] === "root") {
                return {
                    success: false,
                    reason: "Cannot set username to 'root'.",
                    code: 8
                };
            }
            data[field] = updates[field];
        }
    }

    if (updates.password !== undefined) {
        if (!argon2) {
            return {
                success: false,
                reason: "Argon2 module is required for password updates.",
                code: 5
            };
        }
        data.password_hash = await argon2.hash(updates.password, {
            type: argon2.argon2id
        });
    }

    if (Object.keys(data).length === 0) {
        return {
            success: false,
            reason: "No valid fields to update.",
            code: 7
        };
    }

    const setClauses = Object.keys(data).map(key => `${key} = ?`).join(", ");
    const values = Object.values(data);

    db.prepare(`UPDATE users SET ${setClauses} WHERE id = ?`).run(...values, userId);

    const changedFields = Object.keys(data).map(k => k === "password_hash" ? "password" : k);
    console.log(`User ${userId} updated: ${changedFields.join(", ")}.`);
    return { success: true, code: 0 };
}

export async function addUser(
    name,
    created_by,
    password,
    perms,
    logo_path,
    max_video_width,
    max_video_height,
    max_video_bitrate,
    allow_hdr,
    db,
    argon2
) {
    if (
        name == null ||
        password == null ||
        perms == null ||
        created_by == null ||
        !db ||
        !argon2
    ) {
        return {
            success: false,
            reason: "Some mandatory values are not given.",
            code: 4
        };
    }

    if (name === "root") {
        return {
            success: false,
            reason: "Cannot create a user named 'root'.",
            code: 8
        };
    }

    const passwordHash = await argon2.hash(password, {
        type: argon2.argon2id
    });

    const data = {
        name,
        password_hash: passwordHash,
        created_by,
        perms,
        logo_path,
        max_video_width,
        max_video_height,
        max_video_bitrate,
        allow_hdr,
        uuid: randomUUID()
    };

    // Removes undefined values ​​so that SQL defaults apply.
    const entries = Object.entries(data).filter(([_, value]) => value !== undefined);

    const columns = entries.map(([key]) => key).join(", ");
    const placeholders = entries.map(() => "?").join(", ");
    const values = entries.map(([_, value]) => value);

    db.prepare(`
        INSERT INTO users (${columns})
        VALUES (${placeholders})
    `).run(...values);

    const userId = db.prepare("SELECT last_insert_rowid() as id").get().id;
    console.log(`User '${name}' created with ID ${userId}.`);
    return {
        success: true,
        userId,
        code: 0
    };
}

export async function loginUser(name, password, db, argon2) {
    if (!name || !password || !db || !argon2) {
        return { success: false, reason: "Missing credentials.", code: 4 };
    }

    const user = db.prepare("SELECT * FROM users WHERE name = ?").get(name);
    if (!user) {
        return { success: false, reason: "Invalid username or password.", code: 10 };
    }

    const valid = await argon2.verify(user.password_hash, password);
    if (!valid) {
        return { success: false, reason: "Invalid username or password.", code: 10 };
    }

    // generate session token
    const token = crypto.randomUUID();
    db.prepare("INSERT INTO sessions (token, user_id) VALUES (?, ?)").run(token, user.id);

    console.log(`User '${name}' logged in.`);

    return {
        success: true,
        code: 0,
        user: {
            id: String(user.id),
            uuid: user.uuid,
            name: user.name,
            perms: user.perms,
            logo_path: user.logo_path,
            max_video_width: user.max_video_width,
            max_video_height: user.max_video_height,
            max_video_bitrate: user.max_video_bitrate,
            allow_hdr: Boolean(user.allow_hdr),
        },
        accessToken: token,
    };
}

export function validateToken(token, db) {
    if (!token || !db) return null;

    const session = db.prepare(`
        SELECT users.*, sessions.created_at AS session_created FROM sessions
        JOIN users ON users.id = sessions.user_id
        WHERE sessions.token = ?
    `).get(token);

    if (!session) return null;

    const ageMs = Date.now() - new Date(session.session_created + "Z").getTime();
    if (ageMs > 3 * 24 * 60 * 60 * 1000) {
        db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
        return null;
    }

    return {
        id: String(session.id),
        uuid: session.uuid,
        name: session.name,
        perms: session.perms,
    };
}

export function logoutToken(token, db) {
    if (!token || !db) return;
    db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
}

export function getSystemInfo(db) {
    return db.prepare("SELECT * FROM system").get();
}

export function getUserData(db, userId, itemId) {
    const row = db.prepare("SELECT * FROM user_data WHERE user_id = ? AND item_id = ?").get(userId, itemId);
    if (!row) {
        return {
            PlaybackPositionTicks: 0,
            PlayCount: 0,
            IsFavorite: false,
            Played: false,
            PlayedPercentage: 0,
            LastPlayedDate: null,
        };
    }
    return {
        PlaybackPositionTicks: row.playback_position_ticks,
        PlayCount: row.play_count,
        IsFavorite: Boolean(row.is_favorite),
        Played: Boolean(row.played),
        PlayedPercentage: row.played_percentage,
        LastPlayedDate: row.last_played_date,
    };
}

export function setUserData(db, userId, itemId, data) {
    const existing = db.prepare("SELECT * FROM user_data WHERE user_id = ? AND item_id = ?").get(userId, itemId);
    const pos = data.PlaybackPositionTicks ?? existing?.playback_position_ticks ?? 0;
    const count = data.PlayCount ?? existing?.play_count ?? 0;
    const fav = data.IsFavorite ?? existing?.is_favorite ?? false;
    const played = data.Played ?? existing?.played ?? false;
    const pct = data.PlayedPercentage ?? existing?.played_percentage ?? 0;
    const lastDate = data.LastPlayedDate ?? existing?.last_played_date ?? null;

    if (existing) {
        db.prepare(`UPDATE user_data SET playback_position_ticks = ?, play_count = ?, is_favorite = ?, played = ?, played_percentage = ?, last_played_date = ? WHERE user_id = ? AND item_id = ?`)
            .run(pos, count, fav ? 1 : 0, played ? 1 : 0, pct, lastDate, userId, itemId);
    } else {
        db.prepare(`INSERT INTO user_data (user_id, item_id, playback_position_ticks, play_count, is_favorite, played, played_percentage, last_played_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(userId, itemId, pos, count, fav ? 1 : 0, played ? 1 : 0, pct, lastDate);
    }
}

export function getResumableItems(db, userId, mediaTypes, limit) {
    const rows = db.prepare(`
        SELECT * FROM user_data
        WHERE user_id = ?
          AND playback_position_ticks > 0
          AND (played = 0 OR played IS NULL)
        ORDER BY last_played_date DESC
        LIMIT ?
    `).all(userId, limit || 12);
    return rows;
}

export function getPlayedItems(db, userId, limit) {
    const rows = db.prepare(`
        SELECT * FROM user_data
        WHERE user_id = ?
          AND played = 1
        ORDER BY last_played_date DESC
        LIMIT ?
    `).all(userId, limit || 12);
    return rows;
}

export function getUserNFCs(db, userId) {
    return db.prepare("SELECT * FROM user_nfc WHERE user_id = ? ORDER BY created_at DESC").all(userId);
}

export function getNFCByTagId(db, userId, tagId) {
    return db.prepare("SELECT * FROM user_nfc WHERE user_id = ? AND tag_id = ?").get(userId, tagId);
}

export function addOrUpdateNFC(db, userId, tagId, tagName, actionType, data, description, isFromHA) {
    const existing = db.prepare("SELECT id, is_from_ha FROM user_nfc WHERE user_id = ? AND tag_id = ?").get(userId, tagId);
    if (existing) {
        const mergedHA = existing.is_from_ha ? true : Boolean(isFromHA);
        db.prepare("UPDATE user_nfc SET tag_name = ?, action_type = ?, action_payload = ?, description = ?, is_from_ha = ? WHERE user_id = ? AND tag_id = ?")
            .run(tagName || "", actionType || "none", data || "", description || "", mergedHA ? 1 : 0, userId, tagId);
        return { id: existing.id, updated: true };
    } else {
        const result = db.prepare("INSERT INTO user_nfc (user_id, tag_id, tag_name, action_type, action_payload, description, is_from_ha) VALUES (?, ?, ?, ?, ?, ?, ?)")
            .run(userId, tagId, tagName || "", actionType || "none", data || "", description || "", isFromHA ? 1 : 0);
        return { id: result.lastInsertRowid, updated: false };
    }
}

export function removeNFC(db, userId, tagId) {
    const result = db.prepare("DELETE FROM user_nfc WHERE user_id = ? AND tag_id = ?").run(userId, tagId);
    return result.changes > 0;
}