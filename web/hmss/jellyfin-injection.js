const showCustomMenu = false;

const hmssMenuItems = [
    {
        title: "NFC",
        icon: "nfc",
        link: "/web/hmss/nfc.html"
    }
];

const designBtn = document.createElement("button");

designBtn.textContent = "designBtn";
designBtn.style.position = "fixed";
designBtn.style.bottom = "12px";
designBtn.style.right = "12px";
designBtn.style.zIndex = "9999";
designBtn.style.background = "rgba(30,30,30,0.7)";
designBtn.style.border = "1px solid #333";
designBtn.style.color = "#666";
designBtn.style.padding = "6px 10px";
designBtn.style.borderRadius = "6px";
designBtn.style.fontSize = "11px";
designBtn.style.cursor = "pointer";
designBtn.style.backdropFilter = "blur(6px)";

designBtn.onclick = () => {
    localStorage.removeItem("HMSSDesign");
    location.href = "/web/alt_index.html";
};

document.body.appendChild(designBtn);


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

    if (document.querySelector(".hmssMenuOptions")) {
        menuObserver.disconnect();
    }
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