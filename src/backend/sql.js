import { randomUUID } from "node:crypto";
import { randomBytes } from "node:crypto";
import { pbkdf2Sync, timingSafeEqual } from "node:crypto";
import os from "node:os";

// ---------------------------------------------------------------------------
// Jellyfin-compatible permission & preference kinds (see PermissionKind.cs and
// PreferenceKind.cs in jellyfin/jellyfin). Values are written 1:1 into the
// Permissions / Preferences tables so the HMSS schema is byte-identical to a
// real Jellyfin install (a converter tool can copy rows later).
// ---------------------------------------------------------------------------

export const PermissionKinds = {
    IsAdministrator: 0,
    IsHidden: 1,
    IsDisabled: 2,
    EnableSharedDeviceControl: 3,
    EnableRemoteAccess: 4,
    EnableLiveTvManagement: 5,
    EnableLiveTvAccess: 6,
    EnableMediaPlayback: 7,
    EnableAudioPlaybackTranscoding: 8,
    EnableVideoPlaybackTranscoding: 9,
    EnableContentDeletion: 10,
    EnableContentDownloading: 11,
    EnableSyncTranscoding: 12,
    EnableMediaConversion: 13,
    EnableAllDevices: 14,
    EnableAllChannels: 15,
    EnableAllFolders: 16,
    EnablePublicSharing: 17,
    EnableRemoteControlOfOtherUsers: 18,
    EnablePlaybackRemuxing: 19,
    ForceRemoteSourceTranscoding: 20,
    EnableCollectionManagement: 21,
    EnableSubtitleManagement: 22,
    EnableLyricManagement: 23
};

export const PreferenceKinds = {
    BlockedTags: 0,
    BlockedChannels: 1,
    BlockedMediaFolders: 2,
    EnabledDevices: 3,
    EnabledChannels: 4,
    EnabledFolders: 5,
    EnableContentDeletionFromFolders: 6,
    LatestItemExcludes: 7,
    MyMediaExcludes: 8,
    GroupedFolders: 9,
    BlockUnratedItems: 10,
    OrderedViews: 11,
    AllowedTags: 12
};

export const DefaultUserPolicy = {
    IsAdministrator: false,
    IsHidden: false,
    IsDisabled: false,
    AuthenticationProviderId: "Jellyfin.Server.Implementations.Users.DefaultAuthenticationProvider",
    PasswordResetProviderId: "Jellyfin.Server.Implementations.Users.DefaultPasswordResetProvider",
    InvalidLoginAttemptCount: 0,
    EnableSharedDeviceControl: true,
    EnableRemoteAccess: true,
    EnableLiveTvManagement: false,
    EnableLiveTvAccess: false,
    EnableMediaPlayback: true,
    EnableAudioPlaybackTranscoding: true,
    EnableVideoPlaybackTranscoding: true,
    EnableContentDeletion: false,
    EnableContentDownloading: true,
    EnableSyncTranscoding: true,
    EnableMediaConversion: true,
    EnableAllDevices: true,
    EnableAllChannels: false,
    EnableAllFolders: true,
    EnablePublicSharing: true,
    EnableRemoteControlOfOtherUsers: false,
    EnablePlaybackRemuxing: true,
    ForceRemoteSourceTranscoding: false,
    EnableCollectionManagement: false,
    EnableSubtitleManagement: false,
    EnableLyricManagement: false,
    BlockedTags: [],
    BlockedChannels: [],
    BlockedMediaFolders: [],
    EnabledDevices: [],
    EnabledChannels: [],
    EnabledFolders: [],
    EnableContentDeletionFromFolders: [],
    BlockUnratedItems: [],
    AllowedTags: [],
    MaxParentalRating: null,
    RemoteClientBitrateLimit: 0,
    LoginAttemptsBeforeLockout: -1,
    MaxActiveSessions: 0,
    EnableUserPreferenceAccess: true,
    SyncPlayAccess: "CreateAndJoinGroups"
};

const PERMISSION_ORDER = [
    "IsAdministrator", "IsHidden", "IsDisabled",
    "EnableSharedDeviceControl", "EnableRemoteAccess",
    "EnableLiveTvManagement", "EnableLiveTvAccess",
    "EnableMediaPlayback", "EnableAudioPlaybackTranscoding",
    "EnableVideoPlaybackTranscoding", "EnableContentDeletion",
    "EnableContentDownloading", "EnableSyncTranscoding",
    "EnableMediaConversion", "EnableAllDevices", "EnableAllChannels",
    "EnableAllFolders", "EnablePublicSharing",
    "EnableRemoteControlOfOtherUsers", "EnablePlaybackRemuxing",
    "ForceRemoteSourceTranscoding", "EnableCollectionManagement",
    "EnableSubtitleManagement", "EnableLyricManagement"
];

const PREFERENCE_ORDER = [
    "BlockedTags", "BlockedChannels", "BlockedMediaFolders",
    "EnabledDevices", "EnabledChannels", "EnabledFolders",
    "EnableContentDeletionFromFolders", "LatestItemExcludes",
    "MyMediaExcludes", "GroupedFolders", "BlockUnratedItems",
    "OrderedViews", "AllowedTags"
];

// ---------------------------------------------------------------------------
// Password hashing (Jellyfin PBKDF2-SHA512)
// ---------------------------------------------------------------------------

export function hashPassword(password) {
    if (password === undefined || password === null) return null;
    const salt = randomBytes(16);
    const hash = pbkdf2Sync(password, salt, 210000, 64, "sha512");
    return `$PBKDF2-SHA512$iterations=210000$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export function verifyPassword(encoded, password) {
    if (password === undefined || password === null) return false;
    if (encoded && encoded.startsWith("$argon2")) {
        // Legacy HMSS argon2 hashes. The user DB is flushed on migration, but
        // keep the fallback so the future converter tool can import old data.
        return verifyLegacyArgon2(encoded, password);
    }
    if (!encoded) return true; // user has no password -> empty password accepted
    const parts = encoded.split("$");
    if (parts.length < 5 || parts[1] !== "PBKDF2-SHA512") return false;
    const iterations = parseInt(parts[2].split("=")[1], 10);
    const salt = Buffer.from(parts[3], "hex");
    const expected = Buffer.from(parts[4], "hex");
    if (!salt.length || !expected.length) return false;
    const actual = pbkdf2Sync(password, salt, iterations || 210000, expected.length, "sha512");
    return timingSafeEqual(actual, expected);
}

async function verifyLegacyArgon2(encoded, password) {
    try {
        const { default: argon2 } = await import("argon2");
        return await argon2.verify(encoded, password);
    } catch {
        return false;
    }
}

// ---------------------------------------------------------------------------
// User policy helpers
// ---------------------------------------------------------------------------

function defaultsTemplateFrom(policy) {
    const copy = { ...DefaultUserPolicy };
    for (const [field, value] of Object.entries(policy || {})) {
        if (value !== undefined && value !== null) copy[field] = value;
    }
    return copy;
}

function boolToInt(v) {
    return v ? 1 : 0;
}

function listToStored(value) {
    return Array.isArray(value) ? value.join(";") : "";
}

function storedToList(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    return String(value).split(";").filter(v => v.length > 0);
}

function syncPlayToInt(v) {
    switch (v) {
        case "JoinOnly": return 1;
        case "CreateAndJoinGroups": return 2;
        case "CreateGroupOnly": return 3;
        default: return 0;
    }
}

function intToSyncPlay(v) {
    switch (v) {
        case 1: return "JoinOnly";
        case 2: return "CreateAndJoinGroups";
        case 3: return "CreateGroupOnly";
        default: return "None";
    }
}

export function permsFromPolicy(policy) {
    if (!policy) return 0;
    if (policy.IsDisabled) return 0;
    if (policy.IsAdministrator) return 3;
    return 1;
}

export function buildUserObject(user, policy) {
    return {
        id: user.Id,
        uuid: user.Id,
        name: user.Username,
        username: user.Username,
        perms: permsFromPolicy(policy),
        policy,
    };
}

// ---------------------------------------------------------------------------
// Database init
// ---------------------------------------------------------------------------

export async function init(rootPsw, db, argon2) {
    if (!db) return { succes: false, reason: "Database is missing.", code: 5 };

    // Detect the legacy (pre-Jellyfin) HMSS schema. SQLite table names are
    // case-insensitive, so the old `users` table must be dropped BEFORE the
    // new Jellyfin `Users` table can be created.
    const hadLegacyUsers = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'users'").get() !== undefined;
    if (hadLegacyUsers) {
        db.exec("DROP TABLE IF EXISTS user_data; DROP TABLE IF EXISTS user_nfc; DROP TABLE IF EXISTS sessions; DROP TABLE IF EXISTS users; DROP TABLE IF EXISTS hmss_user_image;");
        console.log("[sql] Legacy user tables dropped - HMSS user database reset (users flushed).");
    }

    db.exec(`
        CREATE TABLE IF NOT EXISTS "Users" (
            "Id" TEXT NOT NULL CONSTRAINT "PK_Users" PRIMARY KEY,
            "AudioLanguagePreference" TEXT NULL,
            "AuthenticationProviderId" TEXT NULL,
            "CastReceiverId" TEXT NULL,
            "DisplayCollectionsView" INTEGER NULL,
            "DisplayMissingEpisodes" INTEGER NULL,
            "EnableAutoLogin" INTEGER NULL,
            "EnableLocalPassword" INTEGER NULL,
            "EnableNextEpisodeAutoPlay" INTEGER NULL,
            "EnableUserPreferenceAccess" INTEGER NULL,
            "HidePlayedInLatest" INTEGER NULL,
            "InternalId" INTEGER NOT NULL,
            "InvalidLoginAttemptCount" INTEGER NULL,
            "LastActivityDate" TEXT NULL,
            "LastLoginDate" TEXT NULL,
            "LoginAttemptsBeforeLockout" INTEGER NULL,
            "MaxActiveSessions" INTEGER NULL,
            "MaxParentalRatingScore" INTEGER NULL,
            "MustUpdatePassword" INTEGER NULL,
            "Password" TEXT NULL,
            "PasswordResetProviderId" TEXT NULL,
            "PlayDefaultAudioTrack" INTEGER NULL,
            "RememberAudioSelections" INTEGER NULL,
            "RememberSubtitleSelections" INTEGER NULL,
            "RemoteClientBitrateLimit" INTEGER NULL,
            "RowVersion" INTEGER NOT NULL,
            "SubtitleLanguagePreference" TEXT NULL,
            "SubtitleMode" INTEGER NULL,
            "SyncPlayAccess" INTEGER NULL,
            "Username" TEXT NOT NULL,
            "MaxParentalRatingSubScore" INTEGER NULL,
            "NormalizedUsername" TEXT NULL
        );

        CREATE TABLE IF NOT EXISTS "Devices" (
            "Id" TEXT NOT NULL CONSTRAINT "PK_Devices" PRIMARY KEY,
            "UserId" TEXT NOT NULL,
            "AccessToken" TEXT NULL,
            "AppName" TEXT NULL,
            "AppVersion" TEXT NULL,
            "DeviceName" TEXT NULL,
            "DeviceId" TEXT NULL,
            "IsActive" INTEGER NOT NULL,
            "DateCreated" TEXT NULL,
            "DateModified" TEXT NULL
        );

        CREATE TABLE IF NOT EXISTS "Permissions" (
            "Id" INTEGER NOT NULL CONSTRAINT "PK_Permissions" PRIMARY KEY AUTOINCREMENT,
            "Kind" INTEGER NOT NULL,
            "Permission_Permissions_Guid" TEXT NULL,
            "RowVersion" INTEGER NOT NULL,
            "UserId" TEXT NULL,
            "Value" INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS "Preferences" (
            "Id" INTEGER NOT NULL CONSTRAINT "PK_Preferences" PRIMARY KEY AUTOINCREMENT,
            "Kind" INTEGER NOT NULL,
            "Preference_Preferences_Guid" TEXT NULL,
            "RowVersion" INTEGER NOT NULL,
            "UserId" TEXT NULL,
            "Value" TEXT NULL
        );

        CREATE TABLE IF NOT EXISTS "AccessSchedules" (
            "Id" INTEGER NOT NULL CONSTRAINT "PK_AccessSchedules" PRIMARY KEY AUTOINCREMENT,
            "UserId" TEXT NOT NULL,
            "DayOfWeek" INTEGER NOT NULL,
            "StartHour" REAL NOT NULL,
            "EndHour" REAL NOT NULL
        );

        CREATE TABLE IF NOT EXISTS "system" (
            "id" TEXT PRIMARY KEY,
            "server_name" TEXT not null,
            "product_name" TEXT not null,
            "startup_wizard_completed" BOOLEAN not null default false,
            "config_json" TEXT default '{}'
        );

        CREATE TABLE IF NOT EXISTS "user_data" (
            "user_id" TEXT not null,
            "item_id" TEXT not null,
            "playback_position_ticks" INTEGER not null default 0,
            "play_count" INTEGER not null default 0,
            "is_favorite" BOOLEAN not null default false,
            "played" BOOLEAN not null default false,
            "last_played_date" TEXT,
            "played_percentage" REAL not null default 0,
            PRIMARY KEY (user_id, item_id)
        );

        CREATE TABLE IF NOT EXISTS "user_nfc" (
            "id" INTEGER PRIMARY KEY AUTOINCREMENT,
            "user_id" TEXT not null,
            "tag_id" TEXT not null,
            "tag_name" TEXT not null default '',
            "action_type" TEXT not null default 'none',
            "action_payload" TEXT not null default '{}',
            "created_at" TEXT not null default CURRENT_TIMESTAMP,
            "description" TEXT not null default '',
            "is_from_ha" BOOLEAN not null default 0,
            UNIQUE(user_id, tag_id)
        );

        CREATE TABLE IF NOT EXISTS "hmss_user_image" (
            "user_id" TEXT PRIMARY KEY,
            "logo_path" TEXT
        );

        CREATE TABLE IF NOT EXISTS "addons" (
            "id" TEXT PRIMARY KEY,
            "config_json" TEXT not null default '{}',
            "enabled" BOOLEAN not null default true,
            "installed_at" TEXT not null default CURRENT_TIMESTAMP,
            "updated_at" TEXT not null default CURRENT_TIMESTAMP
        );

        CREATE UNIQUE INDEX IF NOT EXISTS "IX_Users_Username" ON "Users" ("Username");
        CREATE UNIQUE INDEX IF NOT EXISTS "IX_Users_NormalizedUsername" ON "Users" ("NormalizedUsername");
        CREATE INDEX IF NOT EXISTS "IX_Devices_UserId" ON "Devices" ("UserId");
        CREATE INDEX IF NOT EXISTS "IX_Permissions_UserId" ON "Permissions" ("UserId");
        CREATE INDEX IF NOT EXISTS "IX_Preferences_UserId" ON "Preferences" ("UserId");
    `);

    try { db.exec("ALTER TABLE system ADD COLUMN telerising_autostart BOOLEAN default true"); } catch {}

    // Write the default (UserId NULL) permission/preference template, matching
    // what a real Jellyfin install stores.
    writePermissionDefaults(db);

    // No users -> the startup wizard must show again (e.g. after a flush), so
    // it is impossible to end up locked out of the server.
    if (getUserCount(db) === 0) {
        db.prepare("UPDATE system SET startup_wizard_completed = 0").run();
    }

    const systemRow = db.prepare("SELECT id FROM system").get();
    if (!systemRow) {
        const id = randomBytes(16).toString("hex");
        db.prepare("INSERT INTO system (id, server_name, product_name) VALUES (?, ?, ?)")
            .run(id, os.hostname(), "Jellyfin Server");
        console.log("[sql] System row created:", id);
    }

    return { succes: true, reason: null, code: 0 };
}

function writePermissionDefaults(db) {
    db.prepare("DELETE FROM Permissions WHERE UserId IS NULL").run();
    db.prepare("DELETE FROM Preferences WHERE UserId IS NULL").run();

    const policy = defaultsTemplateFrom(null);
    const insertPerm = db.prepare("INSERT INTO Permissions (Kind, Permission_Permissions_Guid, RowVersion, UserId, Value) VALUES (?, NULL, ?, NULL, ?)");
    const insertPref = db.prepare("INSERT INTO Preferences (Kind, Preference_Preferences_Guid, RowVersion, UserId, Value) VALUES (?, NULL, ?, NULL, ?)");
    let rv = 1;
    for (const field of PERMISSION_ORDER) {
        insertPerm.run(PermissionKinds[field], rv, boolToInt(policy[field]));
        rv++;
    }
    for (const field of PREFERENCE_ORDER) {
        insertPref.run(PreferenceKinds[field], rv, listToStored(policy[field]));
        rv++;
    }
}

// ---------------------------------------------------------------------------
// User CRUD
// ---------------------------------------------------------------------------

export function getUserById(db, userId) {
    if (!db || !userId) return null;
    return db.prepare("SELECT * FROM Users WHERE Id = ?").get(String(userId));
}

export function getUserByName(db, name) {
    if (!db || !name) return null;
    return db.prepare("SELECT * FROM Users WHERE Username = ? COLLATE NOCASE").get(name);
}

export function getAllUsers(db) {
    return db.prepare("SELECT * FROM Users ORDER BY Username COLLATE NOCASE").all();
}

export function getUserCount(db) {
    return db.prepare("SELECT COUNT(*) AS count FROM Users").get().count;
}

function nextInternalId(db) {
    const row = db.prepare("SELECT MAX(InternalId) AS max FROM Users").get();
    return (row.max || 0) + 1;
}

export function addUser(name, password, isAdmin, db) {
    if (name == null || !db) {
        return { success: false, reason: "Some mandatory values are not given.", code: 4 };
    }
    if (name === "root") {
        return { success: false, reason: "Cannot create a user named 'root'.", code: 8 };
    }
    if (getUserByName(db, name)) {
        return { success: false, reason: "A user with this name already exists.", code: 8 };
    }

    const id = randomUUID().toUpperCase();
    const internalId = nextInternalId(db);
    const hash = hashPassword(password);

    db.prepare(`
        INSERT INTO Users (Id, AuthenticationProviderId, PasswordResetProviderId, InternalId, RowVersion, Username, NormalizedUsername, Password)
        VALUES (?, 'DefaultAuthenticationProvider', 'DefaultPasswordResetProvider', ?, 1, ?, ?, ?)
    `).run(id, internalId, name, name.toUpperCase(), hash);

    setUserPolicy(db, id, isAdmin ? { ...DefaultUserPolicy, IsAdministrator: true } : DefaultUserPolicy);

    console.log(`[sql] User '${name}' created with Id ${id}.`);
    return { success: true, userId: id, code: 0 };
}

export function removeUser(userId, db) {
    if (userId == null || !db) {
        return { success: false, reason: "User ID or database is missing.", code: 4 };
    }

    const user = getUserById(db, userId);
    if (!user) {
        return { success: false, reason: "User not found.", code: 3 };
    }
    if (user.Username === "root") {
        return { success: false, reason: "Cannot remove the root user.", code: 2 };
    }

    db.exec("BEGIN");
    try {
        db.prepare("DELETE FROM Devices WHERE UserId = ?").run(user.Id);
        db.prepare("DELETE FROM Permissions WHERE UserId = ?").run(user.Id);
        db.prepare("DELETE FROM Preferences WHERE UserId = ?").run(user.Id);
        db.prepare("DELETE FROM AccessSchedules WHERE UserId = ?").run(user.Id);
        db.prepare("DELETE FROM user_data WHERE user_id = ?").run(user.Id);
        db.prepare("DELETE FROM user_nfc WHERE user_id = ?").run(user.Id);
        db.prepare("DELETE FROM hmss_user_image WHERE user_id = ?").run(user.Id);
        db.prepare("DELETE FROM Users WHERE Id = ?").run(user.Id);
        db.exec("COMMIT");
    } catch (err) {
        db.exec("ROLLBACK");
        return { success: false, reason: "Failed to remove user.", code: 6 };
    }

    console.log(`[sql] User ${user.Id} removed.`);

    if (getUserCount(db) === 0) {
        db.prepare("UPDATE system SET startup_wizard_completed = 0").run();
    }

    return { success: true, code: 0 };
}

export function editUser(userId, updates, db) {
    if (userId == null || !db) {
        return { success: false, reason: "User ID or database is missing.", code: 4 };
    }

    const user = getUserById(db, userId);
    if (!user) {
        return { success: false, reason: "User not found.", code: 3 };
    }
    if (user.Username === "root") {
        return { success: false, reason: "Cannot edit the root user.", code: 2 };
    }

    const data = {};
    if (updates.name !== undefined) {
        if (updates.name === "root") {
            return { success: false, reason: "Cannot set username to 'root'.", code: 8 };
        }
        if (getUserByName(db, updates.name) && String(getUserByName(db, updates.name).Id) !== String(user.Id)) {
            return { success: false, reason: "A user with this name already exists.", code: 8 };
        }
        data.Username = updates.name;
        data.NormalizedUsername = updates.name.toUpperCase();
    }
    if (updates.password !== undefined) {
        data.Password = hashPassword(updates.password);
    }
    if (updates.logo_path !== undefined) {
        setUserImage(db, user.Id, updates.logo_path);
    }

    if (Object.keys(data).length === 0) {
        return { success: false, reason: "No valid fields to update.", code: 7 };
    }

    const setClauses = Object.keys(data).map(key => `"${key}" = ?`).join(", ");
    db.prepare(`UPDATE Users SET ${setClauses} WHERE Id = ?`).run(...Object.values(data), user.Id);

    const changedFields = Object.keys(data).map(k => (k === "Password" ? "password" : k.toLowerCase()));
    console.log(`[sql] User ${user.Id} updated: ${changedFields.join(", ")}.`);
    return { success: true, code: 0 };
}

// ---------------------------------------------------------------------------
// Authentication / sessions (Jellyfin Devices = sessions)
// ---------------------------------------------------------------------------

export function createSession(db, userId, deviceInfo) {
    const user = getUserById(db, userId);
    if (!user) return null;

    const token = randomUUID().toUpperCase().replace(/-/g, "");
    const deviceId = deviceInfo?.DeviceId || randomUUID().toUpperCase();
    const deviceName = deviceInfo?.DeviceName || "HMSS";
    const appName = deviceInfo?.AppName || "HMSS Web";
    const appVersion = deviceInfo?.AppVersion || "1.0.0";
    const now = new Date().toISOString();

    db.prepare(`
        INSERT INTO Devices (Id, UserId, AccessToken, AppName, AppVersion, DeviceName, DeviceId, IsActive, DateCreated, DateModified)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `).run(randomUUID().toUpperCase(), user.Id, token, appName, appVersion, deviceName, deviceId, now, now);

    db.prepare("UPDATE Users SET LastLoginDate = ?, LastActivityDate = ? WHERE Id = ?").run(now, now, user.Id);

    return { accessToken: token, user, deviceName, appName, appVersion, deviceId };
}

export async function loginUser(name, password, db, deviceInfo) {
    if (!name || !db) {
        return { success: false, reason: "Missing credentials.", code: 4 };
    }

    const user = getUserByName(db, name);
    if (!user) {
        return { success: false, reason: "Invalid username or password.", code: 10 };
    }

    if (!verifyPassword(user.Password, password)) {
        return { success: false, reason: "Invalid username or password.", code: 10 };
    }

    const session = createSession(db, user.Id, deviceInfo);
    if (!session) {
        return { success: false, reason: "Failed to create session.", code: 6 };
    }

    console.log(`[sql] User '${name}' logged in.`);

    const policy = getUserPolicy(db, user.Id);
    const userObj = buildUserObject(user, policy);
    userObj.logo_path = getUserImage(db, user.Id)?.logo_path || null;

    return {
        success: true,
        code: 0,
        user: userObj,
        accessToken: session.accessToken,
    };
}

export function validateToken(token, db) {
    if (!token || !db) return null;

    const device = db.prepare(`
        SELECT Devices.*, Users.Username AS Username
        FROM Devices
        JOIN Users ON Users.Id = Devices.UserId
        WHERE Devices.AccessToken = ?
    `).get(String(token).toUpperCase());

    if (!device) return null;

    return {
        id: device.UserId,
        uuid: device.UserId,
        name: device.Username,
        username: device.Username,
        perms: permsFromPolicy(getUserPolicy(db, device.UserId)),
    };
}

export function logoutToken(token, db) {
    if (!token || !db) return;
    db.prepare("DELETE FROM Devices WHERE AccessToken = ?").run(String(token).toUpperCase());
}

// ---------------------------------------------------------------------------
// Policy / configuration
// ---------------------------------------------------------------------------

export function getUserPolicy(db, userId) {
    const user = getUserById(db, userId);
    if (!user) return null;

    const policy = { ...DefaultUserPolicy };

    const permRows = db.prepare("SELECT Kind, Value FROM Permissions WHERE UserId = ?").all(user.Id);
    for (const row of permRows) {
        for (const [field, kind] of Object.entries(PermissionKinds)) {
            if (kind === row.Kind) policy[field] = row.Value !== 0;
        }
    }

    const prefRows = db.prepare("SELECT Kind, Value FROM Preferences WHERE UserId = ?").all(user.Id);
    for (const row of prefRows) {
        for (const [field, kind] of Object.entries(PreferenceKinds)) {
            if (kind === row.Kind) policy[field] = storedToList(row.Value);
        }
    }

    policy.MaxParentalRating = user.MaxParentalRatingScore;
    policy.MaxParentalRatingScore = user.MaxParentalRatingScore;
    policy.MaxParentalSubRating = user.MaxParentalRatingSubScore;
    policy.MaxParentalRatingSubScore = user.MaxParentalRatingSubScore;
    policy.RemoteClientBitrateLimit = user.RemoteClientBitrateLimit || 0;
    policy.LoginAttemptsBeforeLockout = user.LoginAttemptsBeforeLockout ?? -1;
    policy.MaxActiveSessions = user.MaxActiveSessions || 0;
    policy.EnableUserPreferenceAccess = user.EnableUserPreferenceAccess === null ? true : Boolean(user.EnableUserPreferenceAccess);
    policy.SyncPlayAccess = intToSyncPlay(user.SyncPlayAccess);
    if (user.AuthenticationProviderId) policy.AuthenticationProviderId = user.AuthenticationProviderId;
    if (user.PasswordResetProviderId) policy.PasswordResetProviderId = user.PasswordResetProviderId;
    if (user.InvalidLoginAttemptCount != null) policy.InvalidLoginAttemptCount = user.InvalidLoginAttemptCount;

    return policy;
}

export function setUserPolicy(db, userId, policy) {
    const user = getUserById(db, userId);
    if (!user) return { success: false, reason: "User not found.", code: 3 };

    const merged = defaultsTemplateFrom(policy);

    db.exec("BEGIN");
    try {
        db.prepare("DELETE FROM Permissions WHERE UserId = ?").run(user.Id);
        db.prepare("DELETE FROM Preferences WHERE UserId = ?").run(user.Id);
        db.prepare("DELETE FROM AccessSchedules WHERE UserId = ?").run(user.Id);

        const insertPerm = db.prepare("INSERT INTO Permissions (Kind, Permission_Permissions_Guid, RowVersion, UserId, Value) VALUES (?, NULL, ?, ?, ?)");
        const insertPref = db.prepare("INSERT INTO Preferences (Kind, Preference_Preferences_Guid, RowVersion, UserId, Value) VALUES (?, NULL, ?, ?, ?)");
        let rv = 1;
        for (const field of PERMISSION_ORDER) {
            insertPerm.run(PermissionKinds[field], rv, user.Id, boolToInt(merged[field]));
            rv++;
        }
        for (const field of PREFERENCE_ORDER) {
            insertPref.run(PreferenceKinds[field], rv, user.Id, listToStored(merged[field]));
            rv++;
        }

        const insertSched = db.prepare("INSERT INTO AccessSchedules (UserId, DayOfWeek, StartHour, EndHour) VALUES (?, ?, ?, ?)");
        if (Array.isArray(merged.AccessSchedules)) {
            for (const s of merged.AccessSchedules) {
                insertSched.run(user.Id, s.DayOfWeek ?? 0, s.StartHour ?? 0, s.EndHour ?? 24);
            }
        }

        const scalar = {};
        if (merged.MaxParentalRating !== undefined && merged.MaxParentalRating !== null) scalar.MaxParentalRatingScore = merged.MaxParentalRating;
        if (merged.MaxParentalSubRating !== undefined && merged.MaxParentalSubRating !== null) scalar.MaxParentalRatingSubScore = merged.MaxParentalSubRating;
        if (merged.RemoteClientBitrateLimit !== undefined) scalar.RemoteClientBitrateLimit = merged.RemoteClientBitrateLimit || 0;
        if (merged.LoginAttemptsBeforeLockout !== undefined) scalar.LoginAttemptsBeforeLockout = merged.LoginAttemptsBeforeLockout ?? -1;
        if (merged.MaxActiveSessions !== undefined) scalar.MaxActiveSessions = merged.MaxActiveSessions || 0;
        if (merged.EnableUserPreferenceAccess !== undefined) scalar.EnableUserPreferenceAccess = merged.EnableUserPreferenceAccess ? 1 : 0;
        if (merged.SyncPlayAccess !== undefined) scalar.SyncPlayAccess = syncPlayToInt(merged.SyncPlayAccess);
        if (Object.keys(scalar).length) {
            const sets = Object.keys(scalar).map(k => `"${k}" = ?`).join(", ");
            db.prepare(`UPDATE Users SET ${sets} WHERE Id = ?`).run(...Object.values(scalar), user.Id);
        }

        db.exec("COMMIT");
    } catch (err) {
        db.exec("ROLLBACK");
        return { success: false, reason: "Failed to save policy.", code: 6 };
    }

    // Mirror the defaults template like Jellyfin does (Permissions/Preferences rows with UserId NULL).
    writePermissionDefaults(db);

    return { success: true, code: 0 };
}

export function getUserConfiguration(db, userId) {
    const user = getUserById(db, userId);
    if (!user) return null;

    const pref = (kind) => {
        const row = db.prepare("SELECT Value FROM Preferences WHERE UserId = ? AND Kind = ?").get(user.Id, kind);
        return row ? storedToList(row.Value) : [];
    };

    const subtitleMode = user.SubtitleMode;
    const subtitleModeStr = subtitleMode === 1 ? "Always" : subtitleMode === 2 ? "OnlyForced" : subtitleMode === 3 ? "None" : subtitleMode === 4 ? "Smart" : "Default";

    return {
        AudioLanguagePreference: user.AudioLanguagePreference || "",
        PlayDefaultAudioTrack: user.PlayDefaultAudioTrack === null ? true : Boolean(user.PlayDefaultAudioTrack),
        SubtitleLanguagePreference: user.SubtitleLanguagePreference || "",
        DisplayMissingEpisodes: user.DisplayMissingEpisodes === null ? false : Boolean(user.DisplayMissingEpisodes),
        GroupedFolders: pref(PreferenceKinds.GroupedFolders),
        SubtitleMode: subtitleModeStr,
        DisplayCollectionsView: user.DisplayCollectionsView === null ? false : Boolean(user.DisplayCollectionsView),
        EnableLocalPassword: user.EnableLocalPassword === null ? false : Boolean(user.EnableLocalPassword),
        OrderedViews: pref(PreferenceKinds.OrderedViews),
        LatestItemsExcludes: pref(PreferenceKinds.LatestItemExcludes),
        MyMediaExcludes: pref(PreferenceKinds.MyMediaExcludes),
        HidePlayedInLatest: user.HidePlayedInLatest === null ? false : Boolean(user.HidePlayedInLatest),
        RememberAudioSelections: user.RememberAudioSelections === null ? false : Boolean(user.RememberAudioSelections),
        RememberSubtitleSelections: user.RememberSubtitleSelections === null ? false : Boolean(user.RememberSubtitleSelections),
        EnableNextEpisodeAutoPlay: user.EnableNextEpisodeAutoPlay === null ? true : Boolean(user.EnableNextEpisodeAutoPlay),
        CastReceiverId: user.CastReceiverId,
    };
}

export function setUserConfiguration(db, userId, config) {
    const user = getUserById(db, userId);
    if (!user) return { success: false, reason: "User not found.", code: 3 };

    const scalar = {};
    if (config.AudioLanguagePreference !== undefined) scalar.AudioLanguagePreference = config.AudioLanguagePreference;
    if (config.PlayDefaultAudioTrack !== undefined) scalar.PlayDefaultAudioTrack = config.PlayDefaultAudioTrack ? 1 : 0;
    if (config.SubtitleLanguagePreference !== undefined) scalar.SubtitleLanguagePreference = config.SubtitleLanguagePreference;
    if (config.DisplayMissingEpisodes !== undefined) scalar.DisplayMissingEpisodes = config.DisplayMissingEpisodes ? 1 : 0;
    if (config.SubtitleMode !== undefined) {
        const v = config.SubtitleMode;
        scalar.SubtitleMode = v === "Always" ? 1 : v === "OnlyForced" ? 2 : v === "None" ? 3 : v === "Smart" ? 4 : 0;
    }
    if (config.DisplayCollectionsView !== undefined) scalar.DisplayCollectionsView = config.DisplayCollectionsView ? 1 : 0;
    if (config.EnableLocalPassword !== undefined) scalar.EnableLocalPassword = config.EnableLocalPassword ? 1 : 0;
    if (config.HidePlayedInLatest !== undefined) scalar.HidePlayedInLatest = config.HidePlayedInLatest ? 1 : 0;
    if (config.RememberAudioSelections !== undefined) scalar.RememberAudioSelections = config.RememberAudioSelections ? 1 : 0;
    if (config.RememberSubtitleSelections !== undefined) scalar.RememberSubtitleSelections = config.RememberSubtitleSelections ? 1 : 0;
    if (config.EnableNextEpisodeAutoPlay !== undefined) scalar.EnableNextEpisodeAutoPlay = config.EnableNextEpisodeAutoPlay ? 1 : 0;
    if (config.CastReceiverId !== undefined) scalar.CastReceiverId = config.CastReceiverId;

    db.exec("BEGIN");
    try {
        if (Object.keys(scalar).length) {
            const sets = Object.keys(scalar).map(k => `"${k}" = ?`).join(", ");
            db.prepare(`UPDATE Users SET ${sets} WHERE Id = ?`).run(...Object.values(scalar), user.Id);
        }

        const listKinds = {
            GroupedFolders: PreferenceKinds.GroupedFolders,
            OrderedViews: PreferenceKinds.OrderedViews,
            LatestItemExcludes: PreferenceKinds.LatestItemExcludes,
            MyMediaExcludes: PreferenceKinds.MyMediaExcludes,
        };
        for (const [field, kind] of Object.entries(listKinds)) {
            if (config[field] !== undefined) {
                db.prepare("DELETE FROM Preferences WHERE UserId = ? AND Kind = ?").run(user.Id, kind);
                db.prepare("INSERT INTO Preferences (Kind, Preference_Preferences_Guid, RowVersion, UserId, Value) VALUES (?, NULL, 99, ?, ?)")
                    .run(kind, user.Id, listToStored(config[field]));
            }
        }
        db.exec("COMMIT");
    } catch (err) {
        db.exec("ROLLBACK");
        return { success: false, reason: "Failed to save configuration.", code: 6 };
    }

    return { success: true, code: 0 };
}

// ---------------------------------------------------------------------------
// User images (logo_path, stored in a sidecar table)
// ---------------------------------------------------------------------------

export function getUserImage(db, userId) {
    if (!db || !userId) return null;
    return db.prepare("SELECT * FROM hmss_user_image WHERE user_id = ?").get(String(userId));
}

export function setUserImage(db, userId, logoPath) {
    if (!db || !userId) return;
    const existing = db.prepare("SELECT user_id FROM hmss_user_image WHERE user_id = ?").get(String(userId));
    if (existing) {
        db.prepare("UPDATE hmss_user_image SET logo_path = ? WHERE user_id = ?").run(logoPath || null, String(userId));
    } else {
        db.prepare("INSERT INTO hmss_user_image (user_id, logo_path) VALUES (?, ?)").run(String(userId), logoPath || null);
    }
}

export function clearUserImage(db, userId) {
    if (!db || !userId) return;
    db.prepare("DELETE FROM hmss_user_image WHERE user_id = ?").run(String(userId));
}

// ---------------------------------------------------------------------------
// System / user data / NFC / addons
// ---------------------------------------------------------------------------

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
    return db.prepare(`
        SELECT * FROM user_data
        WHERE user_id = ?
          AND playback_position_ticks > 0
          AND (played = 0 OR played IS NULL)
        ORDER BY last_played_date DESC
        LIMIT ?
    `).all(userId, limit || 12);
}

export function getPlayedItems(db, userId, limit) {
    return db.prepare(`
        SELECT * FROM user_data
        WHERE user_id = ?
          AND played = 1
        ORDER BY last_played_date DESC
        LIMIT ?
    `).all(userId, limit || 12);
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

export function getAddonRow(db, addonId) {
    return db.prepare("SELECT * FROM addons WHERE id = ?").get(addonId);
}

export function getAllAddonRows(db) {
    return db.prepare("SELECT * FROM addons ORDER BY id").all();
}

export function setAddonConfig(db, addonId, config) {
    const existing = db.prepare("SELECT id FROM addons WHERE id = ?").get(addonId);
    const json = JSON.stringify(config || {});
    if (existing) {
        db.prepare("UPDATE addons SET config_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(json, addonId);
    } else {
        db.prepare("INSERT INTO addons (id, config_json) VALUES (?, ?)").run(addonId, json);
    }
}

export function setAddonEnabled(db, addonId, enabled) {
    const existing = db.prepare("SELECT id FROM addons WHERE id = ?").get(addonId);
    if (existing) {
        db.prepare("UPDATE addons SET enabled = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(enabled ? 1 : 0, addonId);
    } else {
        db.prepare("INSERT INTO addons (id, config_json, enabled) VALUES (?, ?, ?)").run(addonId, "{}", enabled ? 1 : 0);
    }
}
