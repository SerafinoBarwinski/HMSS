(function () {
    var _nfcScannerActive = false;
    var _nfcController = null;

    function getAuthHeaders() {
        return window.HMSS.getAuthHeaders();
    }

    async function startNFCScanner() {
        if (!("NDEFReader" in window)) {
            window.HMSS.showToast("HMSS: Web NFC not supported.");
            return;
        }
        if (_nfcScannerActive) {
            window.HMSS.showToast("HMSS: NFC scanner already active.");
            return;
        }
        _nfcScannerActive = true;

        var userId = window.HMSS.getUserId();
        if (!userId) { _nfcScannerActive = false; return; }

        try {
            var resp = await fetch("/hmss/nfc/" + userId, { headers: getAuthHeaders() });
            var data = await resp.json();
            var tags = data.Items || [];
            if (tags.length === 0) {
                console.log("NFC: No known NFC tags.");
                _nfcScannerActive = false;
                return;
            }

            var ndef = new NDEFReader();
            _nfcController = ndef;
            await ndef.scan();
            console.log("NFC: scanner started, " + tags.length + " tags loaded.");

            ndef.addEventListener("reading", function (e) {
                var serial = e.serialNumber;
                var match = null;
                for (var i = 0; i < tags.length; i++) {
                    if (tags[i].TagId === serial) { match = tags[i]; break; }
                }
                if (!match) {
                    console.log("NFC: Unknown tag:", serial);
                    return;
                }
                console.log("NFC: Matched tag:", match.TagName);
                executeNFCAction(match);
            });
        } catch (err) {
            console.error("NFC: scanner error:", err);
            _nfcScannerActive = false;
        }
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
                console.log("NFC: tag '" + (tag.TagName || tag.TagId) + "' has no action.");
                break;
        }
    }

    window.HMSS.addFeatureButton({
        label: "NFC",
        icon: "nfc",
        action: startNFCScanner
    });
})();
