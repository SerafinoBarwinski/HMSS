import { getUserNFCs, getNFCByTagId, addOrUpdateNFC, removeNFC } from "../../backend/sql.js";

const HA_TAG_REGEX = /^https?:\/\/(www\.)?home-assistant\.io\/tag\/(.+)$/i;

export async function init(config) {
    console.log("[NFC] Addon loaded");
}

export function registerRoutes(app, { getDb }) {
    app.get("/hmss/nfc/:UserID", (req, res) => {
        if (!req.user) return res.status(401).json({ error: "Unauthorized." });
        const db = getDb();
        const nfcTags = getUserNFCs(db, req.user.id);
        res.json({
            Items: nfcTags.map(n => ({
                Id: n.id,
                UserId: String(n.user_id),
                TagId: n.tag_id,
                TagName: n.tag_name,
                TagDescription: n.description || "",
                ActionType: n.action_type,
                data: n.action_payload || "",
                isFromHA: Boolean(n.is_from_ha),
                CreatedAt: n.created_at,
            })),
            TotalRecordCount: nfcTags.length,
        });
    });

    app.post("/hmss/nfc/:UserID/:TagID", (req, res) => {
        if (!req.user) return res.status(401).json({ error: "Unauthorized." });
        const db = getDb();
        const { TagName, TagDescription, ActionType, data, isFromHA } = req.body || {};

        let finalTagId = req.params.TagID;
        let detectedHA = Boolean(isFromHA);

        const haMatch = finalTagId.match(HA_TAG_REGEX);
        if (haMatch) {
            finalTagId = haMatch[2];
            detectedHA = true;
        }

        const existing = getNFCByTagId(db, req.user.id, finalTagId);
        if (existing && existing.is_from_ha && !detectedHA) {
            return res.status(409).json({ error: "This tag was scanned via Home Assistant and its UUID cannot be changed." });
        }

        const result = addOrUpdateNFC(
            db,
            req.user.id,
            finalTagId,
            TagName || "",
            ActionType || "none",
            data || "",
            TagDescription || "",
            detectedHA
        );
        res.status(result.updated ? 200 : 201).json({
            Id: result.id,
            UserId: String(req.user.id),
            TagId: finalTagId,
            TagName: TagName || "",
            TagDescription: TagDescription || "",
            ActionType: ActionType || "none",
            data: data || "",
            isFromHA: detectedHA,
            Updated: result.updated,
        });
    });

    app.delete("/hmss/nfc/:UserID/:TagID", (req, res) => {
        if (!req.user) return res.status(401).json({ error: "Unauthorized." });
        const db = getDb();
        const removed = removeNFC(db, req.user.id, req.params.TagID);
        if (!removed) return res.status(404).json({ error: "NFC tag not found." });
        res.status(204).end();
    });
}
