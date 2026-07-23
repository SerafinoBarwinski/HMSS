export async function init(rootPsw, db, argon2) {
    if (!db || !argon2) return { succes: false, reason: "One of the modules is missing or null.", code: 5 };
    // Make User DB
    db.exec(`
        create table if not exists "users" (
            "id" INTEGER PRIMARY KEY AUTOINCREMENT,
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
    `);

    const rootUser = db
        .prepare("SELECT id FROM users WHERE name = ?")
        .get("root");

    if (!rootUser) {
        if (!rootPsw) return { succes: false, reason: "Root password missing", code: 6 };

        const passwordHash = await argon2.hash(rootPsw, {
            type: argon2.argon2id
        });

        db.prepare(`
            INSERT INTO users (name, password_hash, perms)
            VALUES (?, ?, ?)
        `).run("root", passwordHash, 3);

        console.log("Root user created.");
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
        allow_hdr
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