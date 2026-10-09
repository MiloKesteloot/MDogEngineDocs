// Adds the sidebar to the page.
// Include this script as the first thing inside <div class="screen">. It runs before the rest of the page is drawn,
// so the sidebar is there from the start instead of popping in after the page loads.
//
// After adding or renaming a page here, run "node build-index.js" so search knows about it.

// The icons are inline SVGs so they show up right away, instead of waiting on an icon font to load.
// Icons from Font Awesome Free 6.7.2 by @fontawesome - https://fontawesome.com - License: CC BY 4.0 (https://fontawesome.com/license/free)
// Each icon is [viewBox width, path], and every icon is 512 tall. The "sidebar" icon isn't from Font Awesome: it's a box
// with its left side filled in, drawn with a hole cut out of it (evenodd).
const icons = {
    "magnifying-glass": [512, "M416 208c0 45.9-14.9 88.3-40 122.7L502.6 457.4c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0L330.7 376c-34.4 25.2-76.8 40-122.7 40C93.1 416 0 322.9 0 208S93.1 0 208 0S416 93.1 416 208zM208 352a144 144 0 1 0 0-288 144 144 0 1 0 0 288z"],
    "mug-hot": [512, "M88 0C74.7 0 64 10.7 64 24c0 38.9 23.4 59.4 39.1 73.1l1.1 1C120.5 112.3 128 119.9 128 136c0 13.3 10.7 24 24 24s24-10.7 24-24c0-38.9-23.4-59.4-39.1-73.1l-1.1-1C119.5 47.7 112 40.1 112 24c0-13.3-10.7-24-24-24zM32 192c-17.7 0-32 14.3-32 32L0 416c0 53 43 96 96 96l192 0c53 0 96-43 96-96l16 0c61.9 0 112-50.1 112-112s-50.1-112-112-112l-48 0L32 192zm352 64l16 0c26.5 0 48 21.5 48 48s-21.5 48-48 48l-16 0 0-96zM224 24c0-13.3-10.7-24-24-24s-24 10.7-24 24c0 38.9 23.4 59.4 39.1 73.1l1.1 1C232.5 112.3 240 119.9 240 136c0 13.3 10.7 24 24 24s24-10.7 24-24c0-38.9-23.4-59.4-39.1-73.1l-1.1-1C231.5 47.7 224 40.1 224 24z"],
    "rocket": [512, "M156.6 384.9L125.7 354c-8.5-8.5-11.5-20.8-7.7-32.2c3-8.9 7-20.5 11.8-33.8L24 288c-8.6 0-16.6-4.6-20.9-12.1s-4.2-16.7 .2-24.1l52.5-88.5c13-21.9 36.5-35.3 61.9-35.3l82.3 0c2.4-4 4.8-7.7 7.2-11.3C289.1-4.1 411.1-8.1 483.9 5.3c11.6 2.1 20.6 11.2 22.8 22.8c13.4 72.9 9.3 194.8-111.4 276.7c-3.5 2.4-7.3 4.8-11.3 7.2l0 82.3c0 25.4-13.4 49-35.3 61.9l-88.5 52.5c-7.4 4.4-16.6 4.5-24.1 .2s-12.1-12.2-12.1-20.9l0-107.2c-14.1 4.9-26.4 8.9-35.7 11.9c-11.2 3.6-23.4 .5-31.8-7.8zM384 168a40 40 0 1 0 0-80 40 40 0 1 0 0 80z"],
    "code": [640, "M392.8 1.2c-17-4.9-34.7 5-39.6 22l-128 448c-4.9 17 5 34.7 22 39.6s34.7-5 39.6-22l128-448c4.9-17-5-34.7-22-39.6zm80.6 120.1c-12.5 12.5-12.5 32.8 0 45.3L562.7 256l-89.4 89.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0l112-112c12.5-12.5 12.5-32.8 0-45.3l-112-112c-12.5-12.5-32.8-12.5-45.3 0zm-306.7 0c-12.5-12.5-32.8-12.5-45.3 0l-112 112c-12.5 12.5-12.5 32.8 0 45.3l112 112c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L77.3 256l89.4-89.4c12.5-12.5 12.5-32.8 0-45.3z"],
    "gamepad": [640, "M192 64C86 64 0 150 0 256S86 448 192 448l256 0c106 0 192-86 192-192s-86-192-192-192L192 64zM496 168a40 40 0 1 1 0 80 40 40 0 1 1 0-80zM392 304a40 40 0 1 1 80 0 40 40 0 1 1 -80 0zM168 200c0-13.3 10.7-24 24-24s24 10.7 24 24l0 32 32 0c13.3 0 24 10.7 24 24s-10.7 24-24 24l-32 0 0 32c0 13.3-10.7 24-24 24s-24-10.7-24-24l0-32-32 0c-13.3 0-24-10.7-24-24s10.7-24 24-24l32 0 0-32z"],
    "caret-right": [256, "M246.6 278.6c12.5-12.5 12.5-32.8 0-45.3l-128-128c-9.2-9.2-22.9-11.9-34.9-6.9s-19.8 16.6-19.8 29.6l0 256c0 12.9 7.8 24.6 19.8 29.6s25.7 2.2 34.9-6.9l128-128z"],
    "caret-down": [320, "M137.4 374.6c12.5 12.5 32.8 12.5 45.3 0l128-128c9.2-9.2 11.9-22.9 6.9-34.9s-16.6-19.8-29.6-19.8L32 192c-12.9 0-24.6 7.8-29.6 19.8s-2.2 25.7 6.9 34.9l128 128z"],
    "bars": [448, "M0 96C0 78.3 14.3 64 32 64l384 0c17.7 0 32 14.3 32 32s-14.3 32-32 32L32 128C14.3 128 0 113.7 0 96zM0 256c0-17.7 14.3-32 32-32l384 0c17.7 0 32 14.3 32 32s-14.3 32-32 32L32 288c-17.7 0-32-14.3-32-32zM448 416c0 17.7-14.3 32-32 32L32 448c-17.7 0-32-14.3-32-32s14.3-32 32-32l384 0c17.7 0 32 14.3 32 32z"],
    "github": [496, "M165.9 397.4c0 2-2.3 3.6-5.2 3.6-3.3.3-5.6-1.3-5.6-3.6 0-2 2.3-3.6 5.2-3.6 3-.3 5.6 1.3 5.6 3.6zm-31.1-4.5c-.7 2 1.3 4.3 4.3 4.9 2.6 1 5.6 0 6.2-2s-1.3-4.3-4.3-5.2c-2.6-.7-5.5.3-6.2 2.3zm44.2-1.7c-2.9.7-4.9 2.6-4.6 4.9.3 2 2.9 3.3 5.9 2.6 2.9-.7 4.9-2.6 4.6-4.6-.3-1.9-3-3.2-5.9-2.9zM244.8 8C106.1 8 0 113.3 0 252c0 110.9 69.8 205.8 169.5 239.2 12.8 2.3 17.3-5.6 17.3-12.1 0-6.2-.3-40.4-.3-61.4 0 0-70 15-84.7-29.8 0 0-11.4-29.1-27.8-36.6 0 0-22.9-15.7 1.6-15.4 0 0 24.9 2 38.6 25.8 21.9 38.6 58.6 27.5 72.9 20.9 2.3-16 8.8-27.1 16-33.7-55.9-6.2-112.3-14.3-112.3-110.5 0-27.5 7.6-41.3 23.6-58.9-2.6-6.5-11.1-33.3 2.6-67.9 20.9-6.5 69 27 69 27 20-5.6 41.5-8.5 62.8-8.5s42.8 2.9 62.8 8.5c0 0 48.1-33.6 69-27 13.7 34.7 5.2 61.4 2.6 67.9 16 17.7 25.8 31.5 25.8 58.9 0 96.5-58.9 104.2-114.8 110.5 9.2 7.9 17 22.9 17 46.4 0 33.7-.3 75.4-.3 83.6 0 6.5 4.6 14.4 17.3 12.1C428.2 457.8 496 362.9 496 252 496 113.3 383.5 8 244.8 8zM97.2 352.9c-1.3 1-1 3.3.7 5.2 1.6 1.6 3.9 2.3 5.2 1 1.3-1 1-3.3-.7-5.2-1.6-1.6-3.9-2.3-5.2-1zm-10.8-8.1c-.7 1.3.3 2.9 2.3 3.9 1.6 1 3.6.7 4.3-.7.7-1.3-.3-2.9-2.3-3.9-2-.6-3.6-.3-4.3.7zm32.4 35.6c-1.6 1.3-1 4.3 1.3 6.2 2.3 2.3 5.2 2.6 6.5 1 1.3-1.3.7-4.3-1.3-6.2-2.2-2.3-5.2-2.6-6.5-1zm-11.4-14.7c-1.6 1-1.6 3.6 0 5.9 1.6 2.3 4.3 3.3 5.6 2.3 1.6-1.3 1.6-3.9 0-6.2-1.4-2.3-4-3.3-5.6-2z"],
    "graduation-cap": [640, "M320 32c-8.1 0-16.1 1.4-23.7 4.1L15.8 137.4C6.3 140.9 0 149.9 0 160s6.3 19.1 15.8 22.6l57.9 20.9C57.3 229.3 48 259.8 48 291.9l0 28.1c0 28.4-10.8 57.7-22.3 80.8c-6.5 13-13.9 25.8-22.5 37.6C0 442.7-.9 448.3 .9 453.4s6 8.9 11.2 10.2l64 16c4.2 1.1 8.7 .3 12.4-2s6.3-6.1 7.1-10.4c8.6-42.8 4.3-81.2-2.1-108.7C90.3 344.3 86 329.8 80 316.5l0-24.6c0-30.2 10.2-58.7 27.9-81.5c12.9-15.5 29.6-28 49.2-35.7l157-61.7c8.2-3.2 17.5 .8 20.7 9s-.8 17.5-9 20.7l-157 61.7c-12.4 4.9-23.3 12.4-32.2 21.6l159.6 57.6c7.6 2.7 15.6 4.1 23.7 4.1s16.1-1.4 23.7-4.1L624.2 182.6c9.5-3.4 15.8-12.5 15.8-22.6s-6.3-19.1-15.8-22.6L343.7 36.1C336.1 33.4 328.1 32 320 32zM128 408c0 35.3 86 72 192 72s192-36.7 192-72L496.7 262.6 354.5 314c-11.1 4-22.8 6-34.5 6s-23.5-2-34.5-6L143.3 262.6 128 408z"],
    "sidebar": [512, "M96 64h320a64 64 0 0 1 64 64v256a64 64 0 0 1-64 64H96a64 64 0 0 1-64-64V128a64 64 0 0 1 64-64zM208 112v288h208a16 16 0 0 0 16-16V128a16 16 0 0 0-16-16z", "evenodd"],
    "image": [512, "M0 96C0 60.7 28.7 32 64 32l384 0c35.3 0 64 28.7 64 64l0 320c0 35.3-28.7 64-64 64L64 480c-35.3 0-64-28.7-64-64L0 96zM323.8 202.5c-4.5-6.6-11.9-10.5-19.8-10.5s-15.4 3.9-19.8 10.5l-87 127.6L170.7 297c-4.6-5.7-11.5-9-18.7-9s-14.2 3.3-18.7 9l-64 80c-5.8 7.2-6.9 17.1-2.9 25.4s12.4 13.6 21.6 13.6l96 0 32 0 208 0c8.9 0 17.1-4.9 21.2-12.8s3.6-17.4-1.4-24.7l-120-176zM112 192a48 48 0 1 0 0-96 48 48 0 1 0 0 96z"],
    "sun": [512, "M361.5 1.2c5 2.1 8.6 6.6 9.6 11.9L391 121l107.9 19.8c5.3 1 9.8 4.6 11.9 9.6s1.5 10.7-1.6 15.2L446.9 256l62.3 90.3c3.1 4.5 3.7 10.2 1.6 15.2s-6.6 8.6-11.9 9.6L391 391 371.1 498.9c-1 5.3-4.6 9.8-9.6 11.9s-10.7 1.5-15.2-1.6L256 446.9l-90.3 62.3c-4.5 3.1-10.2 3.7-15.2 1.6s-8.6-6.6-9.6-11.9L121 391 13.1 371.1c-5.3-1-9.8-4.6-11.9-9.6s-1.5-10.7 1.6-15.2L65.1 256 2.8 165.7c-3.1-4.5-3.7-10.2-1.6-15.2s6.6-8.6 11.9-9.6L121 121 140.9 13.1c1-5.3 4.6-9.8 9.6-11.9s10.7-1.5 15.2 1.6L256 65.1 346.3 2.8c4.5-3.1 10.2-3.7 15.2-1.6zM160 256a96 96 0 1 1 192 0 96 96 0 1 1 -192 0zm224 0a128 128 0 1 0 -256 0 128 128 0 1 0 256 0z"],
    "moon": [384, "M223.5 32C100 32 0 132.3 0 256S100 480 223.5 480c60.6 0 115.5-24.2 155.8-63.4c5-4.9 6.3-12.5 3.1-18.7s-10.1-9.7-17-8.5c-9.8 1.7-19.8 2.6-30.1 2.6c-96.9 0-175.5-78.8-175.5-176c0-65.8 36-123.1 89.3-153.3c6.1-3.5 9.2-10.5 7.7-17.3s-7.3-11.9-14.3-12.5c-6.3-.5-12.6-.8-19-.8z"],
    "lightbulb": [384, "M272 384c9.6-31.9 29.5-59.1 49.2-86.2c0 0 0 0 0 0c5.2-7.1 10.4-14.2 15.4-21.4c19.8-28.5 31.4-63 31.4-100.3C368 78.8 289.2 0 192 0S16 78.8 16 176c0 37.3 11.6 71.9 31.4 100.3c5 7.2 10.2 14.3 15.4 21.4c0 0 0 0 0 0c19.8 27.1 39.7 54.4 49.2 86.2l160 0zM192 512c44.2 0 80-35.8 80-80l0-16-160 0 0 16c0 44.2 35.8 80 80 80zM112 176c0 8.8-7.2 16-16 16s-16-7.2-16-16c0-61.9 50.1-112 112-112c8.8 0 16 7.2 16 16s-7.2 16-16 16c-44.2 0-80 35.8-80 80z"],
    "flask": [448, "M288 0L160 0 128 0C110.3 0 96 14.3 96 32s14.3 32 32 32l0 132.8c0 11.8-3.3 23.5-9.5 33.5L10.3 406.2C3.6 417.2 0 429.7 0 442.6C0 480.9 31.1 512 69.4 512l309.2 0c38.3 0 69.4-31.1 69.4-69.4c0-12.8-3.6-25.4-10.3-36.4L329.5 230.4c-6.2-10.1-9.5-21.7-9.5-33.5L320 64c17.7 0 32-14.3 32-32s-14.3-32-32-32L288 0zM192 196.8L192 64l64 0 0 132.8c0 23.7 6.6 46.9 19 67.1L309.5 320l-171 0L173 263.9c12.4-20.2 19-43.4 19-67.1z"],
};

// Makes the SVG for an icon. It's 1em tall, the same size the icon font was.
function icon(name, classes) {
    const [width, path, fillRule = "nonzero"] = icons[name];
    return `<svg class="icon ${classes}" viewBox="0 0 ${width} 512" style="width: ${width / 512}em"><path fill-rule="${fillRule}" d="${path}"/></svg>`;
}

// Makes a sidebar link to a page
function pageLink(href, text) {
    return `
                        <div class="navbar-button">
                            <a class="navbar-title" data-page="${href}" href="${docsPageHref(href)}">
                                <span class="navbar-title-text">${text}</span>
                            </a>
                        </div>`;
}

const sidebarHTML = `
<div class="mobile-topbar">
    <button class="menu-button" aria-label="Open menu">${icon("bars", "")}</button>
    <a class="mobile-title" href="${docsPageHref("index.html")}">MDog Engine Docs</a>
</div>

<div class="sidebar-overlay"></div>

<div class="sidebar-container">
    <div class="sidebar-fixed">

        <div class="searchbar-container">
            <button class="sidebar-toggle" aria-label="Collapse the sidebar" title="Collapse the sidebar">${icon("sidebar", "")}</button>
            <div class="searchbar">
                ${icon("magnifying-glass", "")}
                <input type="text" placeholder="Search..." aria-label="Search the docs" autocomplete="off" spellcheck="false">
                <kbd class="search-shortcut">/</kbd>
            </div>
            <div class="search-results"></div>
        </div>

        <div class="navbar-container">
            <div class="header-text">Docs</div>

            <div class="navbar-padding">

                <div class="navbar-button navbar-search-button">
                    <button class="navbar-title">
                        ${icon("magnifying-glass", "navbar-title-icon navbar-icon")}
                        <span class="navbar-title-text">Search</span>
                    </button>
                </div>

                <div class="navbar-button">
                    <a class="navbar-title" data-page="index.html" href="${docsPageHref("index.html")}">
                        ${icon("mug-hot", "navbar-title-icon navbar-icon")}
                        <span class="navbar-title-text">What is MDog Engine?</span>
                    </a>
                </div>

                <div class="navbar-button">
                    <a class="navbar-title" data-page="getting-started.html" href="${docsPageHref("getting-started.html")}">
                        ${icon("rocket", "navbar-title-icon navbar-icon")}
                        <span class="navbar-title-text">Getting Started</span>
                    </a>
                </div>

                <div class="navbar-button navbar-dropdown">
                    <label class="navbar-title">
                        <input type="checkbox">
                        ${icon("graduation-cap", "navbar-title-icon navbar-icon")}
                        <span class="navbar-title-text">Tutorials</span>
                        <span class="spacer"></span>
                        ${icon("caret-right", "closed-i dropdown-indicator")}
                        ${icon("caret-down", "open-i dropdown-indicator")}
                    </label>

                    <div class="navbar-children indent">

                        <div class="sidebar-sideline"></div>
                        ${pageLink("tutorial.html", "Platformer")}
                        ${pageLink("tutorial-shooter.html", "Space Shooter")}
                        ${pageLink("tutorial-racer.html", "3D Racer")}
                        ${pageLink("tutorial-adventure.html", "Top-Down Adventure")}

                    </div>
                </div>

                <div class="navbar-button">
                    <a class="navbar-title" data-page="playground.html" href="${docsPageHref("playground.html")}">
                        ${icon("flask", "navbar-title-icon navbar-icon")}
                        <span class="navbar-title-text">Playground</span>
                    </a>
                </div>

                <div class="navbar-button">
                    <a class="navbar-title" data-page="asset-packs.html" href="${docsPageHref("asset-packs.html")}">
                        ${icon("image", "navbar-title-icon navbar-icon")}
                        <span class="navbar-title-text">Asset Packs</span>
                    </a>
                </div>

                <div class="navbar-button navbar-dropdown">
                    <label class="navbar-title">
                        <input type="checkbox">
                        ${icon("code", "navbar-title-icon navbar-icon")}
                        <span class="navbar-title-text">Engine</span>
                        <span class="spacer"></span>
                        ${icon("caret-right", "closed-i dropdown-indicator")}
                        ${icon("caret-down", "open-i dropdown-indicator")}
                    </label>

                    <div class="navbar-children indent">

                        <div class="sidebar-sideline"></div>
                        ${pageLink("core.html", "Core")}
                        ${pageLink("draw.html", "Draw")}
                        ${pageLink("input.html", "Input")}
                        ${pageLink("math.html", "Math")}
                        ${pageLink("ui.html", "UI")}
                        ${pageLink("fx.html", "FX")}
                        ${pageLink("threedee.html", "ThreeDee")}
                        ${pageLink("asset-manager.html", "Asset Manager")}
                        ${pageLink("basics.html", "Basics")}
                        ${pageLink("all-methods.html", "All Methods")}
                        ${pageLink("cheat-sheet.html", "Cheat Sheet")}
                        ${pageLink("glossary.html", "Glossary")}

                    </div>
                </div>

                <div class="navbar-button navbar-dropdown">
                    <label class="navbar-title">
                        <input type="checkbox">
                        ${icon("lightbulb", "navbar-title-icon navbar-icon")}
                        <span class="navbar-title-text">Guides</span>
                        <span class="spacer"></span>
                        ${icon("caret-right", "closed-i dropdown-indicator")}
                        ${icon("caret-down", "open-i dropdown-indicator")}
                    </label>

                    <div class="navbar-children indent">

                        <div class="sidebar-sideline"></div>
                        ${pageLink("guide-camera.html", "Following the Player")}
                        ${pageLink("guide-levels.html", "Levels From a File")}
                        ${pageLink("guide-saving.html", "Saving Progress")}
                        ${pageLink("guide-pausing.html", "Pausing")}
                        ${pageLink("guide-timers.html", "Timers and Cooldowns")}

                    </div>
                </div>

                <div class="navbar-button navbar-dropdown">
                    <label class="navbar-title">
                        <input type="checkbox">
                        ${icon("gamepad", "navbar-title-icon navbar-icon")}
                        <span class="navbar-title-text">Examples</span>
                        <span class="spacer"></span>
                        ${icon("caret-right", "closed-i dropdown-indicator")}
                        ${icon("caret-down", "open-i dropdown-indicator")}
                    </label>

                    <div class="navbar-children indent">

                        <div class="sidebar-sideline"></div>
                        ${pageLink("example-platformer.html", "Platformer")}
                        ${pageLink("example-particles.html", "Particles")}
                        ${pageLink("example-title-screen.html", "Title Screen")}
                        ${pageLink("example-road.html", "Pseudo-3D Road")}

                    </div>
                </div>

            </div>

            <div class="navbar-footer">
                <div class="navbar-button">
                    <a class="navbar-title" href="https://github.com/MiloKesteloot/MDogEngine" target="_blank" rel="noopener">
                        ${icon("github", "navbar-title-icon navbar-icon")}
                        <span class="navbar-title-text">MDog Engine on GitHub</span>
                    </a>
                </div>
                <div class="navbar-button">
                    <button class="navbar-title theme-toggle">
                        ${icon("sun", "navbar-title-icon navbar-icon theme-icon-sun")}
                        ${icon("moon", "navbar-title-icon navbar-icon theme-icon-moon")}
                        <span class="navbar-title-text">Light mode</span>
                    </button>
                </div>
            </div>
        </div>
    </div>
</div>
`;

document.currentScript.insertAdjacentHTML("beforebegin", sidebarHTML);
const sidebar = document.querySelector(".sidebar-container");
restoreOpenDropdowns(sidebar);
highlightCurrentPage(sidebar);
setUpMobileMenu();
setUpCollapsing(sidebar);
setUpThemeToggle(sidebar);

// Every page load makes a new sidebar, so which dropdowns are open is saved for this tab and put back on the next page.
// Dropdowns are saved by their title, like "Engine".
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
    const page = docsCurrentPage();

    const links = sidebar.querySelectorAll("a.navbar-title");
    for (const link of links) {
        if (link.dataset.page !== page) {
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

// On narrow screens the sidebar slides in from the left when the menu button is pressed
function setUpMobileMenu() {
    const button = document.querySelector(".menu-button");
    const overlay = document.querySelector(".sidebar-overlay");

    button.addEventListener("click", () => document.body.classList.add("sidebar-open"));
    overlay.addEventListener("click", () => document.body.classList.remove("sidebar-open"));
    document.addEventListener("keydown", e => {
        if (e.key === "Escape") {
            document.body.classList.remove("sidebar-open");
        }
    });
}

// On bigger screens, the button left of the search bar shrinks the sidebar down to just its icons, to give the page
// more room. It stays that way on every page until it's pressed again.
function setUpCollapsing(sidebar) {
    const toggle = sidebar.querySelector(".sidebar-toggle");
    let collapsed = false;
    try {
        collapsed = localStorage.getItem("sidebar-collapsed") === "true";
    } catch (e) {}
    setSidebarCollapsed(collapsed, false);

    // Only animated after the page is drawn, so a collapsed sidebar doesn't visibly shrink on every page load
    requestAnimationFrame(() => requestAnimationFrame(() => document.body.classList.add("sidebar-animate")));

    toggle.addEventListener("click", () => setSidebarCollapsed(!document.body.classList.contains("sidebar-collapsed")));

    // While collapsed, the icons open the sidebar back up: Search goes to the search bar, and Code and Examples open
    // their list of pages
    sidebar.querySelector(".navbar-search-button button").addEventListener("click", () => {
        setSidebarCollapsed(false);
        sidebar.querySelector(".searchbar input").focus();
    });
    for (const label of sidebar.querySelectorAll(".navbar-dropdown > .navbar-title")) {
        label.addEventListener("click", e => {
            if (document.body.classList.contains("sidebar-collapsed")) {
                e.preventDefault();
                setSidebarCollapsed(false);
                const checkbox = label.querySelector("input[type=checkbox]");
                checkbox.checked = true;
                checkbox.dispatchEvent(new Event("change"));
            }
        });
    }
}

function setSidebarCollapsed(collapsed, save = true) {
    // How tall each open dropdown is, so it folds from exactly its own height (see sidebar.css)
    for (const children of document.querySelectorAll(".navbar-children")) {
        if (children.scrollHeight > 0) {
            children.style.setProperty("--open-height", children.scrollHeight + "px");
        }
    }
    document.body.classList.toggle("sidebar-collapsed", collapsed);
    const toggle = document.querySelector(".sidebar-toggle");
    const label = collapsed ? "Expand the sidebar" : "Collapse the sidebar";
    toggle.setAttribute("aria-label", label);
    toggle.title = label;

    // The names are hidden while collapsed, so they show when the mouse is over an icon instead
    for (const title of document.querySelectorAll(".navbar-padding > .navbar-button > .navbar-title, .navbar-footer .navbar-title")) {
        if (collapsed) {
            title.title = title.querySelector(".navbar-title-text").textContent;
        } else {
            title.removeAttribute("title");
        }
    }

    if (save) {
        try {
            localStorage.setItem("sidebar-collapsed", collapsed);
        } catch (e) {}
    }
}

// The button at the bottom of the sidebar that switches between light and dark (see docsSetTheme in build-tables.js).
// It says what it switches to.
function setUpThemeToggle(sidebar) {
    const button = sidebar.querySelector(".theme-toggle");
    const label = () => {
        const light = document.documentElement.dataset.theme === "light";
        const text = light ? "Dark mode" : "Light mode";
        button.querySelector(".navbar-title-text").textContent = text;
        button.setAttribute("aria-label", "Switch to " + text.toLowerCase());
        if (button.title) {
            button.title = text;
        }
    };
    label();
    button.addEventListener("click", () => {
        docsSetTheme(document.documentElement.dataset.theme === "light" ? "dark" : "light");
        label();
    });
}
