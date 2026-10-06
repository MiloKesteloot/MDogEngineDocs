// Adds the sidebar to the page.
// Include this script as the first thing inside <div class="screen">. It runs before the rest of the page is drawn,
// so the sidebar is there from the start instead of popping in after the page loads.

// The sidebar icons are inline SVGs so they show up right away, instead of waiting on an icon font to load.
// Icons from Font Awesome Free 6.7.2 by @fontawesome - https://fontawesome.com - License: CC BY 4.0 (https://fontawesome.com/license/free)
// Each icon is [viewBox width, path], and every icon is 512 tall.
const icons = {
    "magnifying-glass": [512, "M416 208c0 45.9-14.9 88.3-40 122.7L502.6 457.4c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0L330.7 376c-34.4 25.2-76.8 40-122.7 40C93.1 416 0 322.9 0 208S93.1 0 208 0S416 93.1 416 208zM208 352a144 144 0 1 0 0-288 144 144 0 1 0 0 288z"],
    "mug-hot": [512, "M88 0C74.7 0 64 10.7 64 24c0 38.9 23.4 59.4 39.1 73.1l1.1 1C120.5 112.3 128 119.9 128 136c0 13.3 10.7 24 24 24s24-10.7 24-24c0-38.9-23.4-59.4-39.1-73.1l-1.1-1C119.5 47.7 112 40.1 112 24c0-13.3-10.7-24-24-24zM32 192c-17.7 0-32 14.3-32 32L0 416c0 53 43 96 96 96l192 0c53 0 96-43 96-96l16 0c61.9 0 112-50.1 112-112s-50.1-112-112-112l-48 0L32 192zm352 64l16 0c26.5 0 48 21.5 48 48s-21.5 48-48 48l-16 0 0-96zM224 24c0-13.3-10.7-24-24-24s-24 10.7-24 24c0 38.9 23.4 59.4 39.1 73.1l1.1 1C232.5 112.3 240 119.9 240 136c0 13.3 10.7 24 24 24s24-10.7 24-24c0-38.9-23.4-59.4-39.1-73.1l-1.1-1C231.5 47.7 224 40.1 224 24z"],
    "rocket": [512, "M156.6 384.9L125.7 354c-8.5-8.5-11.5-20.8-7.7-32.2c3-8.9 7-20.5 11.8-33.8L24 288c-8.6 0-16.6-4.6-20.9-12.1s-4.2-16.7 .2-24.1l52.5-88.5c13-21.9 36.5-35.3 61.9-35.3l82.3 0c2.4-4 4.8-7.7 7.2-11.3C289.1-4.1 411.1-8.1 483.9 5.3c11.6 2.1 20.6 11.2 22.8 22.8c13.4 72.9 9.3 194.8-111.4 276.7c-3.5 2.4-7.3 4.8-11.3 7.2l0 82.3c0 25.4-13.4 49-35.3 61.9l-88.5 52.5c-7.4 4.4-16.6 4.5-24.1 .2s-12.1-12.2-12.1-20.9l0-107.2c-14.1 4.9-26.4 8.9-35.7 11.9c-11.2 3.6-23.4 .5-31.8-7.8zM384 168a40 40 0 1 0 0-80 40 40 0 1 0 0 80z"],
    "code": [640, "M392.8 1.2c-17-4.9-34.7 5-39.6 22l-128 448c-4.9 17 5 34.7 22 39.6s34.7-5 39.6-22l128-448c4.9-17-5-34.7-22-39.6zm80.6 120.1c-12.5 12.5-12.5 32.8 0 45.3L562.7 256l-89.4 89.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0l112-112c12.5-12.5 12.5-32.8 0-45.3l-112-112c-12.5-12.5-32.8-12.5-45.3 0zm-306.7 0c-12.5-12.5-32.8-12.5-45.3 0l-112 112c-12.5 12.5-12.5 32.8 0 45.3l112 112c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L77.3 256l89.4-89.4c12.5-12.5 12.5-32.8 0-45.3z"],
    "caret-right": [256, "M246.6 278.6c12.5-12.5 12.5-32.8 0-45.3l-128-128c-9.2-9.2-22.9-11.9-34.9-6.9s-19.8 16.6-19.8 29.6l0 256c0 12.9 7.8 24.6 19.8 29.6s25.7 2.2 34.9-6.9l128-128z"],
    "caret-down": [320, "M137.4 374.6c12.5 12.5 32.8 12.5 45.3 0l128-128c9.2-9.2 11.9-22.9 6.9-34.9s-16.6-19.8-29.6-19.8L32 192c-12.9 0-24.6 7.8-29.6 19.8s-2.2 25.7 6.9 34.9l128 128z"],
};

// Makes the SVG for an icon. It's 1em tall, the same size the icon font was.
function icon(name, classes) {
    const [width, path] = icons[name];
    return `<svg class="icon ${classes}" viewBox="0 0 ${width} 512" style="width: ${width / 512}em"><path d="${path}"/></svg>`;
}

const sidebarHTML = `
<div class="sidebar-container">
    <div class="sidebar-fixed">

        <div class="searchbar-container">
            <div>
                ${icon("magnifying-glass", "")}
                <input type="text" placeholder="Search...">
            </div>
        </div>

        <div class="navbar-container">
            <div class="header-text">Docs</div>

            <div class="navbar-padding">

                <div class="navbar-button">
                    <a class="navbar-title" href="index.html">
                        ${icon("mug-hot", "navbar-title-icon navbar-icon")}
                        <span class="navbar-title-text">What is MDog Engine?</span>
                    </a>
                </div>

                <div class="navbar-button">
                    <a class="navbar-title" href="getting-started.html">
                        ${icon("rocket", "navbar-title-icon navbar-icon")}
                        <span class="navbar-title-text">Getting Started</span>
                    </a>
                </div>

                <div class="navbar-button navbar-dropdown">
                    <label class="navbar-title">
                        <input type="checkbox">
                        ${icon("code", "navbar-title-icon navbar-icon")}
                        <span class="navbar-title-text">Code</span>
                        <span class="spacer"></span>
                        ${icon("caret-right", "closed-i dropdown-indicator")}
                        ${icon("caret-down", "open-i dropdown-indicator")}
                    </label>

                    <div class="navbar-children indent">

                        <div class="sidebar-sideline"></div>

                        <div class="navbar-button">
                            <a class="navbar-title" href="core.html">
                                <span class="navbar-title-text">Core</span>
                            </a>
                        </div>

                        <div class="navbar-button">
                            <a class="navbar-title" href="draw.html">
                                <span class="navbar-title-text">Draw</span>
                            </a>
                        </div>

                        <div class="navbar-button">
                            <a class="navbar-title" href="input.html">
                                <span class="navbar-title-text">Input</span>
                            </a>
                        </div>

                        <div class="navbar-button">
                            <a class="navbar-title" href="math.html">
                                <span class="navbar-title-text">Math</span>
                            </a>
                        </div>

                        <div class="navbar-button">
                            <a class="navbar-title" href="ui.html">
                                <span class="navbar-title-text">UI</span>
                            </a>
                        </div>

                        <div class="navbar-button">
                            <a class="navbar-title" href="fx.html">
                                <span class="navbar-title-text">FX</span>
                            </a>
                        </div>

                        <div class="navbar-button">
                            <a class="navbar-title" href="threedee.html">
                                <span class="navbar-title-text">ThreeDee</span>
                            </a>
                        </div>

                        <div class="navbar-button">
                            <a class="navbar-title" href="asset-manager.html">
                                <span class="navbar-title-text">Asset Manager</span>
                            </a>
                        </div>

                        <div class="navbar-button">
                            <a class="navbar-title" href="basics.html">
                                <span class="navbar-title-text">Basics</span>
                            </a>
                        </div>

                    </div>
                </div>

            </div>
        </div>
    </div>
</div>
`;

document.currentScript.insertAdjacentHTML("beforebegin", sidebarHTML);
const sidebar = document.currentScript.previousElementSibling;
restoreOpenDropdowns(sidebar);
highlightCurrentPage(sidebar);

// Every page load makes a new sidebar, so which dropdowns are open is saved for this tab and put back on the next page.
// Dropdowns are saved by their title, like "Code".
function restoreOpenDropdowns(sidebar) {
    let open = [];
    try {
        open = JSON.parse(sessionStorage.getItem("sidebar-open-dropdowns")) ?? [];
    } catch (e) {}

    for (const dropdown of sidebar.querySelectorAll(".navbar-dropdown")) {
        const title = dropdown.querySelector(":scope > .navbar-title .navbar-title-text").textContent;
        const checkbox = dropdown.querySelector(":scope > .navbar-title > input[type=checkbox]");

        checkbox.checked = open.includes(title);

        checkbox.addEventListener("change", () => {
            open = open.filter(t => t !== title);
            if (checkbox.checked) {
                open.push(title);
            }
            try {
                sessionStorage.setItem("sidebar-open-dropdowns", JSON.stringify(open));
            } catch (e) {}
        });
    }
}

// Highlights the link to the page we're on, and opens the dropdowns it's inside of
function highlightCurrentPage(sidebar) {
    let page = window.location.pathname.split("/").pop();
    if (page === "") {
        page = "index.html";
    }

    const links = sidebar.querySelectorAll("a.navbar-title");
    for (const link of links) {
        if (link.getAttribute("href") !== page) {
            continue;
        }

        link.classList.add("active");

        let dropdown = link.parentElement.closest(".navbar-dropdown");
        while (dropdown) {
            const checkbox = dropdown.querySelector(":scope > .navbar-title > input[type=checkbox]");
            checkbox.checked = true;
            checkbox.dispatchEvent(new Event("change")); // So it stays open on the next page too
            dropdown = dropdown.parentElement.closest(".navbar-dropdown");
        }
    }
}
