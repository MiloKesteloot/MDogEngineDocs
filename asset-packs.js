// The art that comes with the docs, in the assets folder. Used by the Asset Packs page (asset-packs.html) and the
// Playground's Assets tab (playground.js). Include this as a normal script. It adds mdogAssetPacks and mdogAssetUsage().
//
// Each item is one thing to use in a game:
//   path       Its name in the assets folder. Animations have a ? where the frame number goes.
//   frames     For animations, how many frames there are
//   speed      For animations, how fast they look right, in roughly frames per second
//   frameWidth For sprite sheets, the width of each frame
//   loop       false for animations that play once, like Death
//   wide       For long thin pictures, like fonts, that look better across a whole row
const mdogAssetPacks = [
    {
        id: "warrior",
        name: "Warrior",
        credit: {name: "Clembod", url: "https://clembod.itch.io/warrior-free-animation-set"},
        description: "A warrior with a sword, with 22 animations for running, jumping, attacking, and more. Every frame is 44 pixels tall, and her feet are always at the bottom row of the picture (y 42).",
        items: [
            {name: "Idle", path: "warrior/Idle/Warrior_Idle_?.png", frames: 6, speed: 8},
            {name: "Run", path: "warrior/Run/Warrior_Run_?.png", frames: 8, speed: 12},
            {name: "Jump", path: "warrior/Jump/Warrior_Jump_?.png", frames: 3, speed: 10},
            {name: "Up to Fall", path: "warrior/Up-To-Fall/Warrior_UptoFall_?.png", frames: 2, speed: 10, loop: false},
            {name: "Fall", path: "warrior/Fall/Warrior_Fall_?.png", frames: 3, speed: 10},
            {name: "Attack", path: "warrior/Attack/Warrior_Attack_?.png", frames: 12, speed: 16, loop: false},
            {name: "Crouch", path: "warrior/Crouch/Warrior_Crouch_?.png", frames: 5, speed: 12, loop: false},
            {name: "Dash", path: "warrior/Dash/Warrior_Dash_?.png", frames: 7, speed: 14, loop: false},
            {name: "Dash (no dust)", path: "warrior/Dash-NoDust/Warrior_Dash_?.png", frames: 7, speed: 14, loop: false},
            {name: "Dash Attack", path: "warrior/Dash-Attack/Warrior_Dash-Attack_?.png", frames: 10, speed: 14, loop: false},
            {name: "Dash Attack (no dust)", path: "warrior/Dash-Attack-NoDust/Warrior_Dash-Attack_?.png", frames: 10, speed: 14, loop: false},
            {name: "Slide", path: "warrior/Slide/Warrior-Slide_?.png", frames: 5, speed: 12, loop: false},
            {name: "Slide (no effect)", path: "warrior/Slide-NoEffect/Warrior-SlideNoEffect_?.png", frames: 5, speed: 12, loop: false},
            {name: "Wall Slide", path: "warrior/Wall-Slide/Warrior_WallSlide_?.png", frames: 3, speed: 10},
            {name: "Wall Slide (no dust)", path: "warrior/Wall-Slide-NoDust/Warrior_WallSlide_?.png", frames: 3, speed: 10},
            {name: "Edge Grab", path: "warrior/Edge-Grab/Warrior_Edge-Grab_?.png", frames: 5, speed: 10, loop: false},
            {name: "Edge Idle", path: "warrior/Edge-Idle/Warrior_Edge-Idle_?.png", frames: 6, speed: 8},
            {name: "Ladder Grab", path: "warrior/Ladder-Grab/Warrior-Ladder-Grab_?.png", frames: 8, speed: 10},
            {name: "Hurt", path: "warrior/Hurt/Warrior_hurt_?.png", frames: 4, speed: 10, loop: false},
            {name: "Hurt (no effect)", path: "warrior/Hurt-NoEffect/Warrior_hurt_?.png", frames: 4, speed: 10, loop: false},
            {name: "Death", path: "warrior/Death/Warrior_Death_?.png", frames: 11, speed: 10, loop: false},
            {name: "Death (no effect)", path: "warrior/Death-NoEffect/Warrior_Death_?.png", frames: 11, speed: 10, loop: false},
            {name: "Run (sprite sheet)", path: "warrior/warrior-run-sheet.png", frames: 8, speed: 12, frameWidth: 64},
        ],
    },
    {
        id: "tiles",
        name: "Tiles",
        description: "Four 16 by 16 tiles in one row, for tilemaps: grass (0), dirt (1), stone (2), and water (3).",
        items: [
            {name: "Tiles", path: "tiles.png"},
        ],
    },
    {
        id: "fonts",
        name: "Fonts",
        description: "The two pixel fonts textImage() can draw with. They have letters, numbers, and !~-.,?[]/:*'\"<>_",
        items: [
            {name: "Mars font", path: "fonts/marsfont.png", wide: true, info: "5 by 5 pixel letters"},
            {name: "Determination font", path: "fonts/determinationfont.png", wide: true, info: "8 by 13 pixel letters"},
        ],
    },
];

// The JavaScript variable name for an item, like "dashAttack" for "Dash Attack"
function mdogAssetVariable(item) {
    const words = item.name.replace(/\(.*\)/, "").trim().split(/[^A-Za-z0-9]+/).filter(Boolean);
    return words.map((word, i) => i === 0 ? word.toLowerCase() : word[0].toUpperCase() + word.slice(1).toLowerCase()).join("") || "art";
}

// A line or two of code that uses an item
function mdogAssetUsage(item) {
    const name = mdogAssetVariable(item);
    if (item.frameWidth) {
        return `const ${name} = new MDog.Draw.SpriteSheetAnimation(\n    "${item.path}", ${item.frames}, ${item.speed}, ${item.frameWidth});\nMDog.Draw.animation(${name}, x, y);`;
    }
    if (item.frames) {
        return `const ${name} = new MDog.Draw.MultipleFileAnimation(\n    "${item.path}", ${item.frames}, ${item.speed});\nMDog.Draw.animation(${name}, x, y);`;
    }
    if (item.path.startsWith("fonts/")) {
        return `MDog.Draw.textImage("Hello!", x, y, "#ffffff", "${item.path}");`;
    }
    if (item.path === "tiles.png") {
        return `const tilemap = new MDog.UI.TilemapInteractable(x, y,\n    "0, 0, 0\\n1, 1, 1\\n2, 2, 2", 16, "tiles.png", 4);\nMDog.Draw.interactable(tilemap);`;
    }
    return `MDog.Draw.image("${item.path}", x, y);`;
}

// The one line of code that makes an item, for copying in the Playground
function mdogAssetUsageLine(item) {
    if (item.frameWidth) {
        return `new MDog.Draw.SpriteSheetAnimation("${item.path}", ${item.frames}, ${item.speed}, ${item.frameWidth})`;
    }
    if (item.frames) {
        return `new MDog.Draw.MultipleFileAnimation("${item.path}", ${item.frames}, ${item.speed})`;
    }
    if (item.path === "tiles.png") {
        return `new MDog.UI.TilemapInteractable(0, 0, "0, 0, 0\\n1, 1, 1", 16, "tiles.png", 4)`;
    }
    return mdogAssetUsage(item);
}

// The files for an item, as paths in the assets folder: every frame of an animation, or the one file
function mdogAssetFiles(item) {
    if (item.frames && !item.frameWidth) {
        return Array.from({length: item.frames}, (_, i) => item.path.replace("?", i + 1));
    }
    return [item.path];
}

// ===== The Asset Packs page =====

// Fills in each <div class="pack-items" data-pack="..."> with a card for every item in that pack, and each
// <div class="pack-download" data-pack="..."> with a button to download the whole pack. Call this before page.js runs,
// so the code in the cards gets colored and copy buttons like every other code block.
function mdogRenderAssetPacks() {
    const playing = [];

    for (const container of document.querySelectorAll(".pack-items")) {
        const pack = mdogAssetPacks.find(p => p.id === container.dataset.pack);

        // data-layout="grid" shows every item as a small playing picture in a grid, with the code for the one that's
        // clicked under it, so a pack with lots of animations doesn't take up the whole page
        const grid = container.dataset.layout === "grid";
        let tiles = null;
        if (grid) {
            container.classList.add("grid");
            container.innerHTML = `<div class="pack-tiles"></div><div class="pack-chosen"></div>`;
            tiles = container.querySelector(".pack-tiles");
        }

        for (const [n, item] of pack.items.entries()) {
            const card = document.createElement("div");
            card.className = "pack-card" + (item.wide ? " wide" : "");
            card.innerHTML = `
                <div class="pack-preview"><canvas></canvas></div>
                <div class="pack-card-body">
                    <div class="pack-card-title">${docsEscape(item.name)} <span class="pack-card-info"></span></div>
                    <pre><code>${docsEscape(mdogAssetUsage(item))}</code></pre>
                    <div class="pack-card-buttons"></div>
                </div>`;

            // Download the file, or every frame together as a .zip
            const files = mdogAssetFiles(item);
            const buttons = card.querySelector(".pack-card-buttons");
            if (files.length > 1) {
                const button = document.createElement("button");
                button.textContent = `Download ${files.length} frames (.zip)`;
                button.addEventListener("click", () => mdogDownloadZip(
                    files.map(file => ({name: file.split("/").at(-1), url: "assets/" + file})),
                    item.path.split("/").at(-1).replace(/_?\?\.png$/, "") + ".zip"));
                buttons.appendChild(button);
            } else {
                buttons.innerHTML = `<a class="pack-download-link" href="assets/${item.path}" download>Download ${docsEscape(item.path.split("/").at(-1))}</a>`;
            }

            // In a grid, the picture goes in a tile, and only the chosen item's code is shown
            if (grid) {
                const tile = document.createElement("button");
                tile.className = "pack-tile" + (n === 0 ? " chosen" : "");
                tile.title = "Show the code for " + item.name;
                tile.innerHTML = `<span class="pack-tile-name">${docsEscape(item.name)}</span>`;
                tile.prepend(card.querySelector(".pack-preview"));
                card.hidden = n !== 0;
                tile.addEventListener("click", () => {
                    for (const other of tiles.querySelectorAll(".pack-tile")) {
                        other.classList.toggle("chosen", other === tile);
                    }
                    for (const other of container.querySelectorAll(".pack-card")) {
                        other.hidden = other !== card;
                    }
                });
                tiles.appendChild(tile);
            }

            // The picture, drawn on a canvas so animations can play and pixel art stays sharp
            const canvas = (grid ? tiles.lastElementChild : card).querySelector("canvas");
            const context = canvas.getContext("2d");
            const images = (item.frameWidth ? [item.path] : files).map(file => Object.assign(new Image(), {src: "assets/" + file}));
            Promise.all(images.map(image => image.decode().catch(() => {}))).then(() => {
                const first = images[0];
                const width = item.frameWidth ?? first.naturalWidth;
                const height = first.naturalHeight;
                canvas.width = width;
                canvas.height = height;
                if (!item.wide) {
                    // Twice as big, so the pixels are easy to see
                    canvas.style.width = width * 2 + "px";
                    canvas.style.height = height * 2 + "px";
                }
                const frames = item.frameWidth ? Math.floor(first.naturalWidth / item.frameWidth) : images.length;
                card.querySelector(".pack-card-info").textContent = item.info ?? (frames > 1 ? `${frames} frames, ${width} by ${height}` : `${width} by ${height}`);
                const draw = frame => {
                    context.clearRect(0, 0, width, height);
                    if (item.frameWidth) {
                        context.drawImage(first, frame * item.frameWidth, 0, item.frameWidth, height, 0, 0, width, height);
                    } else {
                        context.drawImage(images[frame], 0, 0);
                    }
                };
                draw(0);
                if (frames > 1) {
                    playing.push({draw, frames, speed: item.speed ?? 10, canvas});
                }
            });
            (grid ? container.querySelector(".pack-chosen") : container).appendChild(card);
        }
    }

    // Plays every animation that can be seen
    const visible = new Set();
    const observer = new IntersectionObserver(entries => {
        for (const entry of entries) {
            if (entry.isIntersecting) {
                visible.add(entry.target);
            } else {
                visible.delete(entry.target);
            }
        }
    });
    for (const card of document.querySelectorAll(".pack-preview canvas")) {
        observer.observe(card);
    }
    setInterval(() => {
        const time = performance.now() / 1000;
        for (const animation of playing) {
            if (visible.has(animation.canvas)) {
                animation.draw(Math.floor(time * animation.speed) % animation.frames);
            }
        }
    }, 1000 / 30);

    // Downloading a whole pack, with its folders
    for (const container of document.querySelectorAll(".pack-download")) {
        const pack = mdogAssetPacks.find(p => p.id === container.dataset.pack);
        const files = pack.items.flatMap(item => mdogAssetFiles(item));
        const button = document.createElement("button");
        button.className = "pack-download-all";
        button.textContent = `Download the whole pack (${files.length} files, .zip)`;
        button.addEventListener("click", async () => {
            button.disabled = true;
            button.textContent = "Zipping...";
            await mdogDownloadZip(files.map(file => ({name: file, url: "assets/" + file})), pack.id + ".zip");
            button.disabled = false;
            button.textContent = `Download the whole pack (${files.length} files, .zip)`;
        });
        container.appendChild(button);
    }
}
