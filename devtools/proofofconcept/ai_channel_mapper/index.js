// === AI-Powered Channel Mapper (Proof of Concept) ===
// Maps LiveTV channels using an OpenAI-compatible API with tool calling.
// also fallback to prompt based JSON output if tool calling fails.

 // === !WARNING! ===
// This is hot garbage on low end machines, like mine but maybe useful for some people. Use at your own risk.
// Warning: Could screw up your channel mapping if the AI makes mistakes. Always backup your DB first.

import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

var sessionToken = "";                                  // Acces token — leave empty to auto-detect from DB
var OpenAILikeEndoint = "http://localhost:11434/v1";    // e.g. "https://api.openai.com/v1" or Ollama
var APIKey = "";                                        // API key for the endpoint
var model = "qwen2.5-coder:7b";                         // Model name — leave empty for auto-detect
var localhostPort = 8000;                               // HMSS port
var providerId = "";                                    // Leave empty to auto-detect

// CLI args
var args = process.argv.slice(2);
var verbose = args.includes("-v") || args.includes("--verbose");
var noTool = args.includes("--no-tool");

function showThinking(text) {
    var m = text.match(/<thinking>([\s\S]*?)<\/thinking>/);
    if (m) console.log("  thinking: " + m[1].trim());
}

// --- No changes needed below ---

const BASE = `http://localhost:${localhostPort}`;

async function resolveToken() {
    if (sessionToken) return sessionToken;
    var dbDir = path.resolve(__dirname, "../../../");
    var dbPath = path.join(dbDir, "sql.db");
    var Database = require("better-sqlite3");
    var db = new Database(dbPath, { readonly: true });
    var row = db.prepare("SELECT token FROM sessions LIMIT 1").get();
    db.close();
    if (!row) throw new Error("No sessions in DB. Log in to WebUI first.");
    console.log("Token auto-detected from DB.");
    return row.token;
}

async function apiFetch(token, path, opts) {
    var res = await fetch(`${BASE}${path}`, {
        headers: { "Authorization": `MediaBrowser Token="${token}"`, "Content-Type": "application/json", ...(opts?.headers || {}) },
        method: opts?.method || "GET",
        body: opts?.body ? JSON.stringify(opts.body) : undefined,
    });
    if (!res.ok) {
        var text = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status}: ${text.substring(0, 200)}`);
    }
    return res.json();
}

async function main() {
    var token = await resolveToken();

    var pId = providerId;
    if (!pId) {
        console.log("Auto-detecting provider...");
        var config = await apiFetch(token, "/LiveTv/ListingProviders");
        if (!config || !config.length) throw new Error("No listing providers found. Set providerId manually.");
        pId = config[0].Id;
        console.log(`Using: "${config[0].Type || config[0].Id}" (${pId})`);
    }

    console.log("Fetching channels...");
    var options = await apiFetch(token, `/LiveTv/ChannelMappingOptions?providerId=${encodeURIComponent(pId)}`);
    var tunerChannels = options.TunerChannels || [];
    var providerChannels = options.ProviderChannels || [];
    console.log(`Tuner: ${tunerChannels.length}, Provider: ${providerChannels.length}`);

    if (!tunerChannels.length || !providerChannels.length) {
        throw new Error("No channels. Check your configuration.");
    }

    var preMapped = tunerChannels.filter(t => t.ProviderChannelName);
    if (preMapped.length) console.log(`${preMapped.length} already mapped.`);

    var messages = [
        {
            role: "system",
            content: "You are a TV channel mapping assistant. Match tuner channel names to provider channel names.\n\n"
                + "Rules:\n"
                + '- Match by name similarity (e.g. "ProSieben" ↔ "Pro7", "Sat.1" ↔ "Sat1", "RTL Zwei" ↔ "RTL2" ↔ "RTLZWEI")\n'
                + '- Ignore prefixes like "DE - " or ".de" suffixes\n'
                + '- Ignore HD/SD/FHD suffixes\n'
                + '- Map each tuner channel to ONE provider channel\n'
                + "- Be precise — skip if unsure\n"
                + "- Call submitMapping for each match"
        },
        {
            role: "user",
            content: "Tuner channels:\n"
                + tunerChannels.map(t => `  ID: ${t.Id} — Name: ${t.Name}`).join("\n")
                + "\n\nProvider channels:\n"
                + providerChannels.map(p => `  ID: ${p.Id} — Name: ${p.Name}`).join("\n")
                + "\n\nMap as many as you can."
        }
    ];

    var tools = [{
        type: "function",
        function: {
            name: "submitMapping",
            description: "Submit a channel mapping",
            parameters: {
                type: "object",
                properties: {
                    tunerChannelId: { type: "string", description: "Tuner channel ID" },
                    providerChannelId: { type: "string", description: "Provider channel ID" },
                    reason: { type: "string", description: "Why these match" },
                },
                required: ["tunerChannelId", "providerChannelId", "reason"],
            },
        },
    }];

    var mapped = 0;

    if (!noTool) {
        mapped = await runMappingLoop(token, pId, messages, tools, true);
    } else {
        console.log("--no-tool: skipping tool calling phase.");
    }

    if (mapped === 0) {
        console.log("\nTool calling produced no results. Retrying with JSON prompt...\n");
        // Try 2: prompt-based JSON output
        var tunerUnmapped = tunerChannels.filter(t => !t.ProviderChannelName);
        var jsonSystem = {
            role: "system",
            content: "Map tuner channels to provider channels by name similarity.\n"
                + "Return ONLY a JSON array: [{\"tunerChannelId\":\"...\",\"providerChannelId\":\"...\"}]\n"
                + "Ignore .de, HD, SD, FHD, country prefixes. Only use IDs from the lists below."
        };

        var allMapped = [];
        var batchSize = 20;
        for (var b = 0; b < tunerUnmapped.length; b += batchSize) {
            var batch = tunerUnmapped.slice(b, b + batchSize);
            console.log(`\nBatch ${Math.floor(b/batchSize)+1}/${Math.ceil(tunerUnmapped.length/batchSize)} (${batch.length} tuner channels)...`);

            var jsonPrompt = {
                role: "user",
                content: "Tuner channels:\n"
                    + batch.map(t => `${t.Id} = "${t.Name}"`).join("\n")
                    + "\n\nProvider channels:\n"
                    + providerChannels.map(p => `${p.Id} = "${p.Name}"`).join("\n")
            };
            var mapped = await runJsonMapping(token, pId, [jsonSystem, jsonPrompt]);
            allMapped.push(mapped);
            if (mapped === 0) {
                console.log("  No matches in this batch, skipping remaining.");
                break;
            }
        }
        mapped = allMapped.reduce((a, b) => a + b, 0);
    }

    async function runMappingLoop(token, pId, msgs, tools, first) {
        var count = 0;
        var it = 0;
        var endpoint = OpenAILikeEndoint.replace(/\/+$/, "") + "/chat/completions";
        while (it++ < 50) {
            var body = {
                model: model || (endpoint.includes("11434") ? "llama3.2" : "gpt-4o-mini"),
                temperature: 1.0,
                messages: msgs,
                tools: first ? tools : undefined,
                tool_choice: first ? "auto" : undefined,
            };

            if (verbose) console.log("--- REQUEST ---\n" + JSON.stringify(body, null, 2).substring(0, 2000) + "\n---");

            var response = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${APIKey}` },
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                var errText = await response.text().catch(() => "");
                throw new Error(`AI API error ${response.status}: ${errText.substring(0, 300)}`);
            }

            var result = await response.json();
            var choice = result.choices?.[0];
            if (!choice) throw new Error("No AI response");

            var msg = choice.message;
            if (msg.content) showThinking(msg.content);
            msgs.push(msg);

            var toolCalls = msg.tool_calls;
            if (!toolCalls || !toolCalls.length) {
                console.log("AI finished.");
                break;
            }

            for (var tc of toolCalls) {
                if (tc.function.name !== "submitMapping") continue;
                try {
                    var args = JSON.parse(tc.function.arguments);
                    await apiFetch(token, "/LiveTv/ChannelMappings", {
                        method: "POST",
                        body: { ProviderId: pId, TunerChannelId: args.tunerChannelId, ProviderChannelId: args.providerChannelId },
                    });
                    console.log(`  MAPPED: ${args.tunerChannelId} → ${args.providerChannelId} (${args.reason || "?"})`);
                    count++;
                } catch (e) {
                    console.error(`  FAILED: ${e.message}`);
                }
                msgs.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify({ success: true }) });
            }
        }
        return count;
    }

    async function runJsonMapping(token, pId, msgs) {
        var endpoint = OpenAILikeEndoint.replace(/\/+$/, "") + "/chat/completions";
        for (var attempt = 0; attempt < 3; attempt++) {
            var body = {
                model: model || (endpoint.includes("11434") ? "llama3.2" : "gpt-4o-mini"),
                temperature: 1.0,
                messages: msgs,
            };

            if (verbose) console.log("--- JSON REQUEST ---\n" + JSON.stringify(body, null, 2).substring(0, 2000) + "\n---");

            var response = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${APIKey}` },
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                var errText = await response.text().catch(() => "");
                throw new Error(`AI API error ${response.status}: ${errText.substring(0, 300)}`);
            }

            var result = await response.json();
            if (verbose) console.log("--- RESPONSE ---\n" + JSON.stringify(result, null, 2).substring(0, 2000) + "\n---");
            var content = result.choices?.[0]?.message?.content || "";
            if (content) showThinking(content);
            if (attempt === 0) console.log("AI raw:", content.substring(0, 200));

            // Try code block first, then raw array
            var json = content.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/);
            if (!json) json = content.match(/\[[\s\S]*?\]/);
            if (!json) {
                msgs.push({ role: "assistant", content });
                msgs.push({ role: "user", content: "No JSON array found. Respond ONLY with a JSON array like [{\"tunerChannelId\":\"...\",\"providerChannelId\":\"...\"}]" });
                continue;
            }

            var mappings;
            try {
                mappings = JSON.parse(json[0]);
            } catch (e) {
                msgs.push({ role: "assistant", content });
                msgs.push({ role: "user", content: `Invalid JSON: ${e.message}. Respond ONLY with a valid JSON array.` });
                continue;
            }

            if (!Array.isArray(mappings)) {
                msgs.push({ role: "assistant", content });
                msgs.push({ role: "user", content: "Response is not an array. Send ONLY a JSON array." });
                continue;
            }

            // Validate each entry
            var valid = 0;
            for (var m of mappings) {
                if (!m || typeof m !== "object" || !m.tunerChannelId || !m.providerChannelId) {
                    console.log(`  SKIP: bad entry ${JSON.stringify(m)}`);
                    continue;
                }
                try {
                    await apiFetch(token, "/LiveTv/ChannelMappings", {
                        method: "POST",
                        body: { ProviderId: pId, TunerChannelId: m.tunerChannelId, ProviderChannelId: m.providerChannelId },
                    });
                    console.log(`  MAPPED: ${m.tunerChannelId} → ${m.providerChannelId}`);
                    valid++;
                } catch (e) {
                    console.error(`  FAILED: ${m.tunerChannelId} → ${m.providerChannelId}: ${e.message}`);
                }
            }
            return valid;
        }
        return 0;
    }

    console.log(`\nDone. ${mapped} channels mapped.`);
}

main().catch(e => { console.error("Fatal:", e.message); process.exit(1); });
