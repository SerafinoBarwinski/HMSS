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
            "allow_hdr" BOOLEAN not null default true
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
            "startup_wizard_completed" BOOLEAN not null default false
        );
    `); // PERMS: 0 - 3; where 3 is root and 2 admin. 1 manager and 0 visitor

    // add uuid column to existing tables (harmless if already exists)
    try { db.exec("ALTER TABLE users ADD COLUMN uuid TEXT"); } catch {}

    // migrate: add UUID to existing users that don't have one
    const missingUuid = db.prepare("SELECT id FROM users WHERE uuid IS NULL").all();
    for (const row of missingUuid) {
        db.prepare("UPDATE users SET uuid = ? WHERE id = ?").run(randomUUID(), row.id);
    }

    const rootUser = db
        .prepare("SELECT id FROM users WHERE name = ?")
        .get("root");

    if (!rootUser) {
        if (!rootPsw) return { succes: false, reason: "Root password missing", code: 6 };

        const passwordHash = await argon2.hash(rootPsw, {
            type: argon2.argon2id
        });

        db.prepare(`
            INSERT INTO users (name, password_hash, perms, uuid)
            VALUES (?, ?, ?, ?)
        `).run("root", passwordHash, 3, randomUUID());

        console.log("Root user created.");
    }

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
        SELECT users.* FROM sessions
        JOIN users ON users.id = sessions.user_id
        WHERE sessions.token = ?
    `).get(token);

    if (!session) return null;

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