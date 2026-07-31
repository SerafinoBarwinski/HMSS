const showCustomMenu = true;


// is State
var hasEruda = false;

const hmssMenuItems = [
    {
        title: "NFC",
        icon: "nfc",
        link: "#/nfc",
        html: "/web/hmss/AdditionalJellyPages/nfc.html"
    }
];

function getAuthHeaders() {
    var token = window.ApiClient?.accessToken() || "";
    return {
        "X-Emby-Authorization": 'MediaBrowser Token="' + token + '"',
        "Content-Type": "application/json"
    };
}

function showToast(text, isError) {
    var opts = typeof text === "string" ? { text: text } : text;
    var container = document.querySelector(".toastContainer");
    if (!container) {
        container = document.createElement("div");
        container.classList.add("toastContainer");
        document.body.appendChild(container);
    }
    var el = document.createElement("div");
    el.classList.add("toast");
    if (isError) el.style.background = "#c33";
    el.textContent = opts.text;
    container.appendChild(el);
    setTimeout(function () {
        el.classList.add("toastVisible");
    }, 50);
    setTimeout(function () {
        el.classList.add("toastHide");
        setTimeout(function () {
            if (el.parentNode) el.parentNode.removeChild(el);
        }, 300);
    }, 3300);
}

let _nfcScannerActive = false;
let _nfcController = null;

function createFeaturesButton() {
    var btn = document.createElement("button");
    btn.textContent = "HMSS Features";
    btn.style.position = "fixed";
    btn.style.bottom = "12px";
    btn.style.right = "12px";
    btn.style.zIndex = "9999";
    btn.style.background = "rgba(30,30,30,0.7)";
    btn.style.border = "1px solid #333";
    btn.style.color = "#666";
    btn.style.padding = "6px 10px";
    btn.style.borderRadius = "10px";
    btn.style.fontSize = "11px";
    btn.style.cursor = "pointer";
    btn.style.backdropFilter = "blur(6px)";
    btn.style.maxWidth = "120px";

    var popup = document.createElement("div");
    popup.style.cssText = "display:none;position:fixed;bottom:44px;right:12px;z-index:10000;background:rgba(20,20,20,0.95);border:1px solid #444;border-radius:10px;padding:8px 0;min-width:180px;backdropFilter:blur(8px);";

    var items = [
        {
            label: "Change Design", icon: "palette", action: function () {
                localStorage.removeItem("HMSSDesign");
                location.href = "/web/alt_index.html";
            }
        },
        {
            label: "NFC", icon: "nfc", action: function () {
                popup.style.display = "none";
                startNFCScanner();
            }
        },
        {
            label: "Remote Debugging", icon: "bug_report", action: function () {
                popup.style.display = "none";
                toggleRemoteDebug();
            }
        }
    ];

    items.forEach(function (item, i) {
        var el = document.createElement("div");
        el.style.cssText = "padding:8px 16px;cursor:pointer;color:#ccc;font-size:13px;display:flex;align-items:center;gap:8px;";
        if (i < items.length - 1) el.style.borderBottom = "1px solid #333";
        el.textContent = item.label;
        el.addEventListener("mouseenter", function () { el.style.background = "rgba(255,255,255,0.1)"; });
        el.addEventListener("mouseleave", function () { el.style.background = "transparent"; });
        el.addEventListener("click", item.action);
        popup.appendChild(el);
    });

    btn.onclick = function () {
        popup.style.display = popup.style.display === "none" ? "block" : "none";
    };

    document.body.appendChild(btn);
    document.body.appendChild(popup);

    var mouseObserver = new MutationObserver(function () {
        var idle = document.body.classList.contains("mouseIdle");
        btn.style.opacity = idle ? "0" : "1";
        btn.style.pointerEvents = idle ? "none" : "auto";
        popup.style.display = "none";
    });
    mouseObserver.observe(document.body, { attributes: true, attributeFilter: ["class"] });
}

async function startNFCScanner() {
    if (!("NDEFReader" in window)) {
        showToast("HMSS: Web NFC not supported.");
        return;
    }
    if (_nfcScannerActive) {
        showToast("HMSS: NFC scanner already active.");
        return;
    }
    _nfcScannerActive = true;

    var userId = window.ApiClient?.getCurrentUserId() || "";
    if (!userId) { _nfcScannerActive = false; return; }

    try {
        var resp = await fetch("/hmss/nfc/" + userId, { headers: getAuthHeaders() });
        var data = await resp.json();
        var tags = data.Items || [];
        if (tags.length === 0) {
            console.log("HMSS: No known NFC tags.");
            _nfcScannerActive = false;
            return;
        }

        var ndef = new NDEFReader();
        _nfcController = ndef;
        await ndef.scan();
        console.log("HMSS: NFC scanner started, " + tags.length + " tags loaded.");

        ndef.addEventListener("reading", function (e) {
            var serial = e.serialNumber;
            var match = null;
            for (var i = 0; i < tags.length; i++) {
                if (tags[i].TagId === serial) { match = tags[i]; break; }
            }
            if (!match) {
                console.log("HMSS: Unknown NFC tag:", serial);
                return;
            }
            console.log("HMSS: Matched tag:", match.TagName);
            executeNFCAction(match);
        });
    } catch (err) {
        console.error("HMSS: NFC scanner error:", err);
        _nfcScannerActive = false;
    }
}

var _remoteDebugActive = false;
var _remoteDebugOriginals = {};

function toggleRemoteDebug() {
    if (_remoteDebugActive) {
        console.log = _remoteDebugOriginals.log;
        console.warn = _remoteDebugOriginals.warn;
        console.error = _remoteDebugOriginals.error;
        _remoteDebugActive = false;
        showToast("Remote Debugging disconnected");
        return;
    }

    if (!hasEruda) {
        const script = document.createElement("script");
        script.src = "/eruda";
        script.onload = () => {
            eruda.init();
        };
        document.head.appendChild(script);

        hasEruda = true;
    }

    var userId = window.ApiClient?.getCurrentUserId() || "";
    if (!userId) { showToast("Not logged in", true); return; }

    fetch("/hmss/remote-debug", { method: "POST", headers: getAuthHeaders(), body: JSON.stringify({ level: "log", message: "[ping]" }) })
        .then(function (r) {
            if (r.status === 403) { showToast("Server rejected remote debug", true); return; }
            if (!r.ok) { showToast("Remote debug unavailable", true); return; }

            _remoteDebugOriginals.log = console.log;
            _remoteDebugOriginals.warn = console.warn;
            _remoteDebugOriginals.error = console.error;

            var send = function (level, args) {
                var msg = Array.prototype.map.call(args, function (a) {
                    try { return typeof a === "object" ? JSON.stringify(a, null, 2) : String(a); } catch { return String(a); }
                }).join(" ");
                fetch("/hmss/remote-debug", {
                    method: "POST",
                    headers: getAuthHeaders(),
                    body: JSON.stringify({ level: level, message: msg, timestamp: new Date().toISOString() })
                }).catch(function () { });
            };

            console.log = function () { _remoteDebugOriginals.log.apply(console, arguments); send("log", arguments); };
            console.warn = function () { _remoteDebugOriginals.warn.apply(console, arguments); send("warn", arguments); };
            console.error = function () { _remoteDebugOriginals.error.apply(console, arguments); send("error", arguments); };

            _remoteDebugActive = true;
            showToast("Remote Debugging connected");
        });
}

function executeNFCAction(tag) {
    var actionType = tag.ActionType || "none";
    var d = tag.data || "";

    switch (actionType) {
        case "playmedia":
            if (d) {
                location.href = "/web/index.html#/details?id=" + encodeURIComponent(d);
            }
            break;
        case "changepage":
            if (d) {
                location.href = d;
            }
            break;
        default:
            console.log("HMSS: NFC tag '" + (tag.TagName || tag.TagId) + "' has no action.");
            break;
    }
}

createFeaturesButton();

function insertHMSSMenu() {
    if (!showCustomMenu) {
        return;
    }
    const libraryMenuOptions = document.querySelector(".libraryMenuOptions");

    if (!libraryMenuOptions || document.querySelector(".hmssMenuOptions")) {
        return;
    }

    const container = document.createElement("div");
    container.className = "hmssMenuOptions";

    const h3 = document.createElement("h3");
    h3.className = "sidebarHeader";
    h3.textContent = "HMSS";

    container.appendChild(h3);

    hmssMenuItems.forEach(item => {
        const link = document.createElement("a");
        link.setAttribute("is", "emby-linkbutton");
        link.className = "lnkMediaFolder navMenuOption emby-button";
        link.href = item.link;

        const icon = document.createElement("span");
        icon.className = `material-icons navMenuOptionIcon ${item.icon}`;
        icon.setAttribute("aria-hidden", "true");

        const text = document.createElement("span");
        text.className = "sectionName navMenuOptionText";
        text.textContent = item.title;

        link.appendChild(icon);
        link.appendChild(text);

        container.appendChild(link);
    });

    libraryMenuOptions.insertAdjacentElement("afterend", container);
}


const menuObserver = new MutationObserver(() => {
    insertHMSSMenu();
});

menuObserver.observe(document.body, {
    childList: true,
    subtree: true
});

insertHMSSMenu();


(function () {
    function applyBorderRadius() {
        document.querySelectorAll('div[style*="background-image"]').forEach(function (element) {
            element.style.borderRadius = "25px";
            element.style.overflow = "hidden";
        });
    }

    applyBorderRadius();

    new MutationObserver(function () {
        applyBorderRadius();
    }).observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["style"]
    });
})();

let _hmssPageLoaded = null;

async function loadHMSSPage() {
    const hash = window.location.hash;
    const menuItem = hmssMenuItems.find(item => item.link === hash);
    if (!menuItem) { _hmssPageLoaded = null; return; }

    const fallbackPage = document.getElementById("fallbackPage");
    const pageTitle = document.querySelector(".pageTitle");
    if (!fallbackPage) return;

    if (fallbackPage.querySelector(".nfcPage") && _hmssPageLoaded === hash) return;
    _hmssPageLoaded = hash;

    console.log("Loading HMSS page:", menuItem.title);

    try {
        const response = await fetch(menuItem.html);
        if (!response.ok) throw new Error("Failed to load: " + response.status);

        document.title = "HMSS - " + menuItem.title;
        pageTitle.textContent = menuItem.title;
        const html = await response.text();
        fallbackPage.innerHTML = html;
        fallbackPage.id = "";

        fallbackPage.querySelectorAll("script").forEach(function (old) {
            const s = document.createElement("script");
            s.textContent = old.textContent;
            old.replaceWith(s);
        });

    } catch (error) {
        console.error("HMSS Page load failed:", error);
        fallbackPage.innerHTML = '<div style="padding:40px;text-align:center;color:#666;">Page could not be loaded.</div>';
    }
}

window.addEventListener("hashchange", loadHMSSPage);

const pageObserver = new MutationObserver(() => {
    if (document.getElementById("fallbackPage")) {
        loadHMSSPage();
    }
});

pageObserver.observe(document.body, {
    childList: true,
    subtree: true
});
