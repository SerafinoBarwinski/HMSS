const showCustomMenu = true;


// is State
var hasEruda = false;
// enables the login-page splash background fix (Jellyfin web bug: splash is not rendered there)
var jellyfinFixSplash = true;

// --- Addon UI registry, filled from /api/addons/ui ---
var _hmssRoutes = [];
var _hmssScripts = [];
var _hmssPageLoaded = null;

// feature buttons registered by addon persistent scripts
var _hmssFeatureItems = [];

function getAuthHeaders() {
    var token = window.ApiClient?.accessToken() || "";
    return {
        "X-Emby-Authorization": 'MediaBrowser Token="' + token + '"',
        "Content-Type": "application/json"
    };
}

function getUserId() {
    return window.ApiClient?.getCurrentUserId() || "";
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

// Global HMSS API for addon persistent scripts
window.HMSS = {
    showToast: showToast,
    getAuthHeaders: getAuthHeaders,
    getUserId: getUserId,
    addFeatureButton: function (entry) {
        if (entry && entry.label && typeof entry.action === "function") {
            _hmssFeatureItems.push(entry);
        }
    }
};

// --- Login splash background fix ---
// Jellyfin web doesn't render its splash on the login page, so we inject it:
// fill <div class="backgroundContainer withBackdrop"> with the generated
// splash image, seeded with a random t so every login shows a fresh one.
var jellyfinSplashFix = { wasApplied: false };

function isLoginPage() {
    return window.location.hash.indexOf("#/login") === 0;
}

function applyLoginSplash() {
    if (!jellyfinFixSplash) return;

    if (!isLoginPage()) {
        removeLoginSplash();
        return;
    }
    if (jellyfinSplashFix.wasApplied) return;
    if (document.getElementById("hmssLoginSplashImg")) return;

    var container = document.querySelector(".backgroundContainer.withBackdrop");
    if (!container) return;

    var img = document.createElement("img");
    img.id = "hmssLoginSplashImg";
    img.src = "/Branding/Splashscreen?t=" + Math.floor(Math.random() * 1000000000);
    img.alt = "";
    img.style.cssText = "position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:0;opacity:0;filter:brightness(.5);transition:opacity .6s;";
    img.onload = function () { img.style.opacity = "1"; };

    container.appendChild(img);
    jellyfinSplashFix.wasApplied = true;
}

function removeLoginSplash() {
    if (!jellyfinSplashFix.wasApplied) return;
    var img = document.getElementById("hmssLoginSplashImg");
    if (img && img.parentNode) img.parentNode.removeChild(img);
    jellyfinSplashFix.wasApplied = false;
}

var splashObserver = new MutationObserver(function () {
    applyLoginSplash();
});
splashObserver.observe(document.body, { childList: true, subtree: true });
window.addEventListener("hashchange", function () {
    applyLoginSplash();
});
applyLoginSplash();

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

    function buildPopup() {
        popup.innerHTML = "";

        var items = [
            {
                label: "Change Design", icon: "palette", action: function () {
                    popup.style.display = "none";
                    localStorage.removeItem("HMSSDesign");
                    location.href = "/web/alt_index.html";
                }
            },
            {
                label: "Remote Debugging", icon: "bug_report", action: function () {
                    popup.style.display = "none";
                    toggleRemoteDebug();
                }
            }
        ].concat(_hmssFeatureItems);

        items.forEach(function (item, i) {
            var el = document.createElement("div");
            el.style.cssText = "padding:8px 16px;cursor:pointer;color:#ccc;font-size:13px;display:flex;align-items:center;gap:8px;";
            if (i < items.length - 1) el.style.borderBottom = "1px solid #333";

            var iconSpan = document.createElement("span");
            iconSpan.className = "material-icons";
            iconSpan.style.fontSize = "14px";
            iconSpan.textContent = item.icon || "widgets";

            var labelSpan = document.createElement("span");
            labelSpan.textContent = item.label;

            el.appendChild(iconSpan);
            el.appendChild(labelSpan);

            el.addEventListener("mouseenter", function () { el.style.background = "rgba(255,255,255,0.1)"; });
            el.addEventListener("mouseleave", function () { el.style.background = "transparent"; });
            el.addEventListener("click", item.action);
            popup.appendChild(el);
        });
    }

    btn.onclick = function () {
        if (popup.style.display === "none") {
            buildPopup();
            popup.style.display = "block";
        } else {
            popup.style.display = "none";
        }
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

    var userId = getUserId();
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

function insertHMSSMenu() {
    if (!showCustomMenu) {
        return;
    }
    const routes = _hmssRoutes.filter(r => r.menu);
    if (routes.length === 0) {
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

    routes.forEach(item => {
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

function injectPersistentScripts() {
    _hmssScripts.forEach(function (src) {
        if (document.querySelector('script[src="' + src + '"]')) return;
        const s = document.createElement("script");
        s.src = src;
        s.async = true;
        document.body.appendChild(s);
    });
}

async function loadHMSSPage() {
    const hash = window.location.hash;
    const hashPath = hash.split("?")[0];
    const menuItem = _hmssRoutes.find(item => item.link === hashPath);
    if (!menuItem) { _hmssPageLoaded = null; return; }

    const fallbackPage = document.getElementById("fallbackPage");
    const pageTitle = document.querySelector(".pageTitle");
    if (!fallbackPage) return;

    if (_hmssPageLoaded === hash) return;
    _hmssPageLoaded = hash;

    console.log("Loading HMSS page:", menuItem.title);

    if (!menuItem.html) return;

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

async function bootHMSS() {
    try {
        const resp = await fetch("/api/addons/ui");
        if (resp.ok) {
            const registry = await resp.json();
            _hmssRoutes = registry.routes || [];
            _hmssScripts = registry.scripts || [];
        }
    } catch (e) {
        console.warn("HMSS: failed to load addon UI registry:", e);
    }

    injectPersistentScripts();
    insertHMSSMenu();
    loadHMSSPage();
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

// --- Gamepad controller support (virtual cursor) ---
// Left stick = cursor, A = enter/click, B = back, right stick = scroll.
// Disabled while a game runs in the emulator (native gamepad support there).
(function () {
    function isEmulatorActive() {
        var wrap = document.getElementById('emuFrameWrap');
        return !!(wrap && wrap.style.display !== 'none');
    }

    var cursor = null;
    function ensureCursor() {
        if (cursor) return;
        cursor = document.createElement('div');
        cursor.id = 'hmssCursor';
        cursor.style.cssText = 'position:fixed;left:0;top:0;width:22px;height:22px;pointer-events:none;z-index:2147483000;display:none;';
        cursor.innerHTML = '<svg width="22" height="22" viewBox="0 0 22 22"><path d="M2 1 L2 16 L7 11.5 L10.5 18.5 L13.5 17 L10 10 L16 10 Z" fill="#fff" stroke="#111" stroke-width="1.4"/></svg>';
        document.body.appendChild(cursor);
    }

    var hideStyle = null;
    function setControllerMode(on) {
        ensureCursor();
        if (on) {
            cursor.style.display = 'block';
            if (!hideStyle) {
                hideStyle = document.createElement('style');
                hideStyle.id = 'hmssCursorHide';
                hideStyle.textContent = '*{cursor:none!important}';
                document.head.appendChild(hideStyle);
            }
        } else {
            cursor.style.display = 'none';
            if (hideStyle) { hideStyle.remove(); hideStyle = null; }
        }
    }

    var pos = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    var last = performance.now();
    var aHeld = false;
    var bHeld = false;

    function navBack() {
        var before = window.location.href;
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, which: 27, bubbles: true, cancelable: true }));
        document.dispatchEvent(new KeyboardEvent('keyup', { key: 'Escape', keyCode: 27, which: 27, bubbles: true, cancelable: true }));
        setTimeout(function () {
            if (window.location.href === before && history.length > 1) history.back();
        }, 350);
    }

    function clickAt(x, y) {
        var el = document.elementFromPoint(x, y);
        if (!el) return;
        var act = el.closest('a, button, .card, .btn, [data-action], [is="emby-linkbutton"], [is="emby-button"]') || el;
        var opts = { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y, button: 0 };
        act.dispatchEvent(new MouseEvent('mousedown', opts));
        act.dispatchEvent(new MouseEvent('mouseup', opts));
        act.dispatchEvent(new MouseEvent('click', opts));
    }

    function loop() {
        requestAnimationFrame(loop);
        if (isEmulatorActive()) { setControllerMode(false); return; }

        var pads = [];
        try { pads = navigator.getGamepads() || []; } catch (e) { }
        var pad = null;
        for (var i = 0; i < pads.length; i++) {
            if (pads[i] && pads[i].connected) { pad = pads[i]; break; }
        }
        if (!pad) { setControllerMode(false); return; }

        var ax = pad.axes[0] || 0;
        var ay = pad.axes[1] || 0;
        var dead = 0.18;
        var mag = Math.sqrt(ax * ax + ay * ay);
        if (mag < dead) { ax = 0; ay = 0; mag = 0; }
        else {
            var norm = Math.min(1, (mag - dead) / (1 - dead));
            ax = (ax / mag) * norm;
            ay = (ay / mag) * norm;
            mag = norm;
        }

        var rx = pad.axes[2] || 0;
        var ry = pad.axes[3] || 0;
        var rMag = Math.sqrt(rx * rx + ry * ry);
        if (rMag < dead) { rx = 0; ry = 0; }

        var a = !!(pad.buttons[0] && pad.buttons[0].pressed);
        var b = !!(pad.buttons[1] && pad.buttons[1].pressed);

        if (!mag && !a && !b && rMag < dead) { setControllerMode(false); return; }
        setControllerMode(true);

        var now = performance.now();
        var dt = Math.min((now - last) / 1000, 0.05);
        last = now;

        var speed = 1200;
        var boost = 1 + mag * mag * 3;
        pos.x += ax * speed * boost * dt;
        pos.y += ay * speed * boost * dt;
        pos.x = Math.max(0, Math.min(window.innerWidth - 1, pos.x));
        pos.y = Math.max(0, Math.min(window.innerHeight - 1, pos.y));
        cursor.style.left = pos.x + 'px';
        cursor.style.top = pos.y + 'px';

        if (ry) {
            document.dispatchEvent(new WheelEvent('wheel', { deltaY: -ry * 600 * dt, bubbles: true, cancelable: true }));
        }
        if (rx) {
            document.dispatchEvent(new WheelEvent('wheel', { deltaX: -rx * 400 * dt, bubbles: true, cancelable: true }));
        }

        if (a && !aHeld) clickAt(pos.x, pos.y);
        aHeld = a;
        if (b && !bHeld) navBack();
        bHeld = b;
    }

    document.addEventListener('mousemove', function () {
        if (cursor && cursor.style.display === 'block') setControllerMode(false);
    }, true);

    requestAnimationFrame(loop);
})();

createFeaturesButton();
bootHMSS();
