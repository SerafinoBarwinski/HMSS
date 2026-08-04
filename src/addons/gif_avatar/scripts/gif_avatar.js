(function () {
    if (window.__hmssGifAvatarLoaded) return;
    window.__hmssGifAvatarLoaded = true;

    var SEARCH_URL = "/hmss/gif-avatar/search";
    var IMAGE_URL = "/hmss/gif-avatar/image";
    var LAST_SEARCH_KEY = "hmssGifAvatarLastSearch";
    var MAX_GRID = 24;

    var _popup = null;
    var _grid = null;
    var _input = null;

    function isUserProfilePage() {
        var hash = window.location.hash || "";
        return hash.indexOf("#/userprofile") === 0;
    }

    function getUserId() {
        // profile page opened for another user (admin): use ?userId= from the hash
        var hash = window.location.hash || "";
        var qIdx = hash.indexOf("?");
        if (qIdx >= 0) {
            var params = new URLSearchParams(hash.slice(qIdx + 1));
            var target = params.get("userId");
            if (target) return target;
        }
        return window.HMSS ? window.HMSS.getUserId() : "";
    }

    function getToken() {
        return window.ApiClient && window.ApiClient.accessToken ? window.ApiClient.accessToken() : "";
    }

    function authHeaders() {
        var h = { "X-Emby-Authorization": 'MediaBrowser Token="' + getToken() + '"' };
        if (window.HMSS && window.HMSS.getAuthHeaders) {
            var base = window.HMSS.getAuthHeaders();
            for (var k in base) if (base.hasOwnProperty(k)) h[k] = base[k];
        }
        return h;
    }

    // ---- popup ----

    function createPopup() {
        var overlay = document.createElement("div");
        overlay.id = "hmssGifPopup";
        overlay.style.cssText = "position:fixed;inset:0;z-index:2147483001;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.6);";

        var panel = document.createElement("div");
        panel.style.cssText = "width:min(720px,94vw);max-height:86vh;display:flex;flex-direction:column;background:rgba(24,24,26,0.98);border:1px solid #444;border-radius:12px;overflow:hidden;color:#eee;font-family:inherit;";

        var header = document.createElement("div");
        header.style.cssText = "display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid #333;";

        var title = document.createElement("div");
        title.textContent = "GIF auswählen";
        title.style.cssText = "font-weight:600;flex:1;";

        var close = document.createElement("button");
        close.textContent = "✕";
        close.type = "button";
        close.style.cssText = "background:none;border:none;color:#aaa;font-size:16px;cursor:pointer;padding:4px 8px;";
        close.addEventListener("click", function () { closePopup(); });

        header.appendChild(title);
        header.appendChild(close);

        var searchRow = document.createElement("div");
        searchRow.style.cssText = "display:flex;gap:8px;padding:12px 16px;border-bottom:1px solid #333;";

        _input = document.createElement("input");
        _input.type = "text";
        _input.placeholder = "Suche nach GIFs (Enter drücken)…";
        _input.style.cssText = "flex:1;background:#111;border:1px solid #444;border-radius:8px;padding:9px 12px;color:#eee;outline:none;";
        _input.addEventListener("keydown", function (e) {
            if (e.key === "Enter") {
                e.preventDefault();
                search(_input.value);
            }
        });

        var searchBtn = document.createElement("button");
        searchBtn.textContent = "Suchen";
        searchBtn.type = "button";
        searchBtn.style.cssText = "background:#00a4dc;border:none;color:#fff;border-radius:8px;padding:9px 16px;cursor:pointer;";
        searchBtn.addEventListener("click", function () { search(_input.value); });

        searchRow.appendChild(_input);
        searchRow.appendChild(searchBtn);

        _grid = document.createElement("div");
        _grid.style.cssText = "flex:1;overflow-y:auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px;padding:16px;";

        panel.appendChild(header);
        panel.appendChild(searchRow);
        panel.appendChild(_grid);

        overlay.appendChild(panel);
        overlay.addEventListener("mousedown", function (e) {
            if (e.target === overlay) closePopup();
        });
        document.addEventListener("keydown", onPopupKey);

        document.body.appendChild(overlay);
        _popup = overlay;

        var last = "";
        try { last = localStorage.getItem(LAST_SEARCH_KEY) || ""; } catch (e) {}
        if (last) {
            _input.value = last;
            search(last);
        } else {
            search("");
        }
    }

    function onPopupKey(e) {
        if (e.key === "Escape") closePopup();
    }

    function closePopup() {
        if (_popup && _popup.parentNode) _popup.parentNode.removeChild(_popup);
        _popup = null;
        _grid = null;
        _input = null;
        document.removeEventListener("keydown", onPopupKey);
    }

    function setGridLoading(msg) {
        if (!_grid) return;
        _grid.innerHTML = "";
        var div = document.createElement("div");
        div.textContent = msg || "Lade…";
        div.style.cssText = "grid-column:1/-1;text-align:center;color:#888;padding:32px 0;";
        _grid.appendChild(div);
    }

    function search(q) {
        if (!_grid) return;
        q = (q || "").trim();
        try { localStorage.setItem(LAST_SEARCH_KEY, q); } catch (e) {}
        setGridLoading(q ? "Suche…" : "Trending…");

        var url = SEARCH_URL + "?limit=" + MAX_GRID;
        if (q) url += "&q=" + encodeURIComponent(q);

        fetch(url, { headers: authHeaders() })
            .then(function (r) {
                if (r.status === 401) throw new Error("Nicht angemeldet");
                if (!r.ok) return r.json().then(function (d) { throw new Error(d.error || ("HTTP " + r.status)); });
                return r.json();
            })
            .then(function (data) {
                renderGrid(data.Items || []);
            })
            .catch(function (err) {
                setGridLoading("Fehler: " + err.message);
            });
    }

    function renderGrid(items) {
        if (!_grid) return;
        _grid.innerHTML = "";
        if (!items.length) {
            setGridLoading("Keine GIFs gefunden.");
            return;
        }
        items.forEach(function (item) {
            var card = document.createElement("div");
            card.style.cssText = "position:relative;aspect-ratio:1;border-radius:8px;overflow:hidden;cursor:pointer;background:#111;border:1px solid #333;";
            card.title = item.title || "";

            var img = document.createElement("img");
            img.src = item.preview;
            img.loading = "lazy";
            img.style.cssText = "width:100%;height:100%;object-fit:cover;display:block;";
            img.addEventListener("click", function () { uploadGif(item); });

            card.appendChild(img);
            _grid.appendChild(card);
        });
    }

    // ---- upload ----

    function uploadGif(item) {
        var userId = getUserId();
        if (!userId) { showToast("Nicht angemeldet", true); return; }

        if (!item.full) { showToast("GIF konnte nicht geladen werden", true); return; }

        var uploading = document.createElement("div");
        uploading.textContent = "Wird hochgeladen…";
        uploading.style.cssText = "position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:2147483002;background:rgba(24,24,26,0.98);border:1px solid #444;border-radius:10px;padding:16px 24px;color:#eee;";
        document.body.appendChild(uploading);

        fetch(IMAGE_URL + "?url=" + encodeURIComponent(item.full), { headers: authHeaders() })
            .then(function (r) {
                if (!r.ok) throw new Error("GIF laden fehlgeschlagen");
                return r.blob();
            })
            .then(function (blob) {
                return blobToBase64(blob);
            })
            .then(function (b64) {
                return fetch("/Users/" + userId + "/Images/Primary", {
                    method: "POST",
                    headers: {
                        "X-Emby-Authorization": 'MediaBrowser Token="' + getToken() + '"',
                        "Content-Type": "image/gif"
                    },
                    body: b64
                });
            })
            .then(function (r) {
                if (!r.ok) throw new Error("Upload fehlgeschlagen (HTTP " + r.status + ")");
                closePopup();
                showToast("Profilbild aktualisiert ✓");
                setTimeout(function () { window.location.reload(); }, 1200);
            })
            .catch(function (err) {
                showToast(err.message, true);
            })
            .finally(function () {
                if (uploading.parentNode) uploading.parentNode.removeChild(uploading);
            });
    }

    function blobToBase64(blob) {
        return new Promise(function (resolve, reject) {
            var reader = new FileReader();
            reader.onload = function () {
                var result = String(reader.result);
                resolve(result.indexOf(",") >= 0 ? result.split(",").pop() : result);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    function showToast(text, isError) {
        if (window.HMSS && window.HMSS.showToast) {
            window.HMSS.showToast(text, isError);
        } else if (typeof text === "string") {
            window.alert(text);
        }
    }

    // ---- button injection ----

    function injectButton() {
        if (!isUserProfilePage()) return;
        // page re-renders on navigation — re-inject whenever the button is missing
        if (document.getElementById("hmssBtnAddGif")) return;

        var original = document.getElementById("btnAddImage");
        if (!original || !original.parentNode) return;

        var clone = original.cloneNode(true);
        clone.id = "hmssBtnAddGif";
        clone.classList.remove("hide");
        clone.removeAttribute("disabled");
        clone.style.marginLeft = "0.6em";

        var span = clone.querySelector("span");
        if (span) {
            span.textContent = "GIF hinzufügen";
        } else {
            clone.textContent = "GIF hinzufügen";
        }

        clone.addEventListener("click", function (e) {
            e.preventDefault();
            e.stopPropagation();
            if (_popup) { closePopup(); return; }
            createPopup();
            setTimeout(function () { if (_input) _input.focus(); }, 50);
        });

        original.parentNode.insertBefore(clone, original.nextSibling);
    }

    function removeButton() {
        var b = document.getElementById("hmssBtnAddGif");
        if (b && b.parentNode) b.parentNode.removeChild(b);
    }

    function onRouteChange() {
        if (isUserProfilePage()) {
            // wait for the React profile page to render its buttons
            setTimeout(injectButton, 300);
        } else {
            removeButton();
            if (_popup) closePopup();
        }
    }

    var observer = new MutationObserver(function () {
        if (isUserProfilePage()) injectButton();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    window.addEventListener("hashchange", onRouteChange);
    window.addEventListener("popstate", onRouteChange);
    onRouteChange();
})();
