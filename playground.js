// The playground: write MDog Engine code and see it run right next to it.
//
// The editor is CodeMirror (https://codemirror.net), loaded from esm.sh. Its autofill comes from docs-index.js, so it
// knows every module, class, and method in the docs. The game runs in an iframe, like the demos (see demos.js).
//
// The code is saved in the browser (localStorage), and added files are saved too (IndexedDB), so nothing is lost on a
// refresh. Share puts the project in a link (see docsEncodeProject in build-tables.js). Export makes one HTML file with
// everything in it, which Import can open again.
//
// The CodeMirror imports ask for the newest version in each major version (like ^6.0.0), the same way the CodeMirror parts
// ask for each other. That way they all get one copy of each part, since two copies of a part don't work together.
// The codemirror package itself is pinned to 6.0.1, since its newest 6.x is the old CodeMirror 5.

import {EditorView, basicSetup} from "https://esm.sh/codemirror@6.0.1";
import {keymap, hoverTooltip} from "https://esm.sh/@codemirror/view@^6.0.0";
import {EditorState, Transaction} from "https://esm.sh/@codemirror/state@^6.0.0";
import {indentWithTab, undo} from "https://esm.sh/@codemirror/commands@^6.0.0";
import {javascript, javascriptLanguage} from "https://esm.sh/@codemirror/lang-javascript@^6.0.0";
import {HighlightStyle, syntaxHighlighting, indentUnit, syntaxTree, ensureSyntaxTree} from "https://esm.sh/@codemirror/language@^6.0.0";
import {tags} from "https://esm.sh/@lezer/highlight@^1.0.0";
import {search} from "https://esm.sh/@codemirror/search@^6.0.0";
import {setDiagnostics, lintGutter} from "https://esm.sh/@codemirror/lint@^6.0.0";

const engineURL = docsEngineBaseURL + "MDogModules/MDogMain.js";
const engineImport = `import MDog from "${engineURL}";`;
// Before there were projects, the code was saved under this key. It's moved into the first project.
const oldCodeKey = "mdog-playground-code";
const projectsKey = "mdog-playground-projects";
const currentProjectKey = "mdog-playground-current";
const codeKeyFor = id => "mdog-playground-code:" + id;
const viewKey = "mdog-playground-view";
const autorunKey = "mdog-playground-autorun";
const sizesKey = "mdog-playground-sizes";

const defaultCode = `${engineImport}

// Welcome to the playground! Change this code, then press Run (or Ctrl+Enter).
// Everything in the docs works here. Try typing "MDog." to see what's there.

const position = new MDog.Math.Vector(256, 192);

function main() {
    // Move with the arrow keys
    if (MDog.Input.Keyboard.isDown("ArrowLeft")) {
        position.x -= 1;
    }
    if (MDog.Input.Keyboard.isDown("ArrowRight")) {
        position.x += 1;
    }
    if (MDog.Input.Keyboard.isDown("ArrowUp")) {
        position.y -= 1;
    }
    if (MDog.Input.Keyboard.isDown("ArrowDown")) {
        position.y += 1;
    }

    MDog.Draw.clear({color: "#1c1c3c"});
    MDog.Draw.rectangleFill(position.x - 8, position.y - 8, 16, 16, "#ff8800");
}

MDog.setActiveFunction(main);
`;

const blankCode = `${engineImport}

function main() {
    MDog.Draw.clear();

}

MDog.setActiveFunction(main);
`;

// Templates come from the pages they're shown on, so they're always the same as the docs
// Each one's picture is assets/templates/<id>.png, a screenshot of it running (Blank doesn't have one).
const templates = [
    {id: "blank", name: "Blank", description: "An empty game loop, ready for your own code.", code: async () => blankCode},
    {id: "square", name: "Moving square", description: "A square you move around with the arrow keys.", code: async () => defaultCode},
    {id: "warrior", name: "Warrior platformer", description: "The game from the Tutorial. Run, jump between platforms, and collect coins.", code: () => tutorialStepCode(6)},
    {id: "platformer", name: "Platformer", description: "A player that runs and jumps between platforms.", code: () => pageCode("example-platformer.html", "#example-code")},
    {id: "particles", name: "Particles", description: "Explosions and sparkles. Click, or hold the mouse down.", code: () => pageCode("example-particles.html", "#example-code")},
    {id: "title-screen", name: "Title screen", description: "A title screen that starts the game, and switching between screens.", code: () => pageCode("example-title-screen.html", "#example-code")},
    {id: "road", name: "Pseudo-3D road", description: "A curving road like an old racing game, made with ThreeDee.", code: () => pageCode("example-road.html", "#example-code")},
];

async function fetchPage(page) {
    const response = await fetch(page);
    if (!response.ok) {
        throw new Error("Couldn't load " + page);
    }
    return response.text();
}

// The code in a page's code block
async function pageCode(page, selector) {
    const html = await fetchPage(page);
    const pre = new DOMParser().parseFromString(html, "text/html").querySelector(selector);
    return pre.textContent.trim() + "\n";
}

// A step from the tutorial, with the import and screen size its demo box adds
async function tutorialStepCode(step) {
    const html = await fetchPage("tutorial.html");
    const code = [...html.matchAll(/code: `([\s\S]*?)`,/g)][step - 1][1];
    return `${engineImport}\nMDog.Draw.setScreenSize(256, 192);\n\n${docsDedent(code)}\n`;
}

// ===== The parts of the page =====

const root = document.querySelector(".playground");
const main = root.querySelector(".pg-main");
const gameBox = root.querySelector(".pg-game");
const consoleBox = root.querySelector(".pg-console");
const assetList = root.querySelector(".pg-asset-list");
const callHint = root.querySelector(".pg-call-hint");
const savedLabel = root.querySelector(".pg-saved");
const banner = root.querySelector(".pg-banner");

// True while looking at a shared link. Nothing is saved then, so the person's own projects aren't overwritten.
let viewingShared = false;

// ===== Files people add (assets) =====
// Each is {name, type, blob, url}. They're saved in IndexedDB, which can hold files, unlike localStorage. Each file is
// saved under its project's id and its name. The "assets" store is from before there were projects, and is only read
// to move those files into the first project.

let assets = [];

// If IndexedDB doesn't answer within a few seconds, the playground carries on without saving files, instead of
// waiting forever
const database = Promise.race([new Promise(resolve => setTimeout(() => resolve(null), 3000)), new Promise(resolve => {
    try {
        const request = indexedDB.open("mdog-playground", 2);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains("assets")) {
                db.createObjectStore("assets", {keyPath: "name"});
            }
            if (!db.objectStoreNames.contains("files")) {
                db.createObjectStore("files", {keyPath: ["project", "name"]});
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(null);
    } catch (error) {
        // Some private windows don't allow IndexedDB, so files just aren't saved there
        resolve(null);
    }
})]);

// Every key from [id, ""] to [id, "\uffff"] is one project's files
const projectFiles = id => IDBKeyRange.bound([id, ""], [id, "\uffff"]);

async function loadSavedAssets(projectId) {
    const db = await database;
    if (!db) {
        return [];
    }
    return new Promise(resolve => {
        const request = db.transaction("files").objectStore("files").getAll(projectFiles(projectId));
        request.onsuccess = () => resolve(request.result.map(a => ({name: a.name, type: a.type, blob: a.blob, url: URL.createObjectURL(a.blob)})));
        request.onerror = () => resolve([]);
    });
}

async function saveProjectFiles(projectId, list) {
    const db = await database;
    if (!db) {
        return;
    }
    await new Promise(resolve => {
        const transaction = db.transaction("files", "readwrite");
        const store = transaction.objectStore("files");
        store.delete(projectFiles(projectId));
        for (const asset of list) {
            store.put({project: projectId, name: asset.name, type: asset.type, blob: asset.blob});
        }
        transaction.oncomplete = resolve;
        transaction.onerror = resolve;
    });
}

async function saveAssets() {
    if (viewingShared || !currentProject) {
        return;
    }
    await saveProjectFiles(currentProject.id, assets);
}

function setAssets(newAssets) {
    for (const asset of assets) {
        URL.revokeObjectURL(asset.url);
    }
    assets = newAssets;
    renderAssets();
}

async function addFiles(files) {
    for (const file of files) {
        // A file with the same name as one that's already added replaces it
        const old = assets.find(a => a.name === file.name);
        if (old) {
            URL.revokeObjectURL(old.url);
            assets = assets.filter(a => a !== old);
        }
        assets.push({name: file.name, type: file.type || "application/octet-stream", blob: file, url: URL.createObjectURL(file)});
    }
    assets.sort((a, b) => a.name.localeCompare(b.name));
    renderAssets();
    await saveAssets();
    showPanel("assets");
}

function isImage(name) {
    return /\.(png|gif|jpe?g|webp)$/i.test(name);
}

// The line of code that uses an asset, to copy into the code
function assetUsage(name) {
    return isImage(name) ? `MDog.Draw.image("${name}", 0, 0);` : `MDog.AssetManager.loadFile("${name}", "${name}");`;
}

function formatSize(bytes) {
    return bytes < 1024 ? bytes + " B" : (bytes / 1024).toFixed(1) + " KB";
}

// Each file is shown as a tile with a picture of it. Clicking the picture copies a line of code that uses it.
function renderAssets() {
    root.querySelector(".pg-assets-count").textContent = assets.length ? "(" + assets.length + ")" : "";
    assetList.innerHTML = "";
    if (assets.length === 0) {
        assetList.innerHTML = `<div class="pg-asset-empty">Nothing added yet.</div>`;
    }
    for (const asset of assets) {
        const tile = makeAssetTile({
            name: asset.name,
            info: formatSize(asset.blob.size),
            usage: assetUsage(asset.name),
            image: isImage(asset.name) ? asset.url : null,
        });
        const buttons = tile.querySelector(".pg-asset-buttons");
        buttons.innerHTML = `
            <button data-action="rename">Rename</button>
            <a href="${asset.url}" download="${docsEscape(asset.name)}">Download</a>
            <button data-action="delete">Delete</button>`;
        buttons.querySelector('[data-action="rename"]').addEventListener("click", () => renameAssetInPlace(tile, asset));
        buttons.querySelector('[data-action="delete"]').addEventListener("click", async () => {
            const sure = await ask({
                title: `Delete "${asset.name}"?`,
                text: "The game won't be able to use it anymore.",
                ok: "Delete",
                danger: true,
            });
            if (sure) {
                URL.revokeObjectURL(asset.url);
                assets = assets.filter(a => a !== asset);
                renderAssets();
                await saveAssets();
            }
        });
        assetList.appendChild(tile);
    }
}

// Turns a file's name on its tile into a text box, like renaming a project. Enter or clicking away saves it, and
// Escape puts it back.
function renameAssetInPlace(tile, asset) {
    const nameElement = tile.querySelector(".pg-asset-name");
    const input = document.createElement("input");
    input.className = "pg-asset-name-input";
    input.value = asset.name;
    input.setAttribute("aria-label", "File name");
    nameElement.replaceWith(input);
    input.focus();
    // Select the name without the extension, like most file managers do
    const dot = asset.name.lastIndexOf(".");
    input.setSelectionRange(0, dot > 0 ? dot : asset.name.length);

    let done = false;
    const finish = async save => {
        if (done) {
            return;
        }
        done = true;
        const name = input.value.trim();
        if (save && name && name !== asset.name) {
            if (assets.some(a => a !== asset && a.name === name)) {
                notify(`There's already a file named "${name}".`);
            } else {
                asset.name = name;
                assets.sort((a, b) => a.name.localeCompare(b.name));
                await saveAssets();
            }
        }
        renderAssets();
    };
    input.addEventListener("keydown", e => {
        if (e.key === "Enter") {
            e.preventDefault();
            finish(true);
        } else if (e.key === "Escape") {
            e.preventDefault();
            finish(false);
        }
    });
    input.addEventListener("blur", () => finish(true));
}

// The files in the docs' assets folder. Animations are shown playing, at the speed the docs use them at.
const builtInAssets = [
    {name: "warrior/Idle/Warrior_Idle_?.png", frames: 6, speed: 8, usage: `new MDog.Draw.MultipleFileAnimation("warrior/Idle/Warrior_Idle_?.png", 6, 8)`},
    {name: "warrior/Run/Warrior_Run_?.png", frames: 8, speed: 12, usage: `new MDog.Draw.MultipleFileAnimation("warrior/Run/Warrior_Run_?.png", 8, 12)`},
    {name: "warrior/Attack/Warrior_Attack_?.png", frames: 12, speed: 12, usage: `new MDog.Draw.MultipleFileAnimation("warrior/Attack/Warrior_Attack_?.png", 12, 12)`},
    {name: "warrior/warrior-run-sheet.png", info: "Sprite sheet, 8 frames", frames: 8, speed: 12, frameWidth: 64, usage: `new MDog.Draw.SpriteSheetAnimation("warrior/warrior-run-sheet.png", 8, 12, 64)`},
    {name: "tiles.png", info: "4 tiles, 16 by 16", usage: `MDog.Draw.image("tiles.png", 0, 0);`},
    {name: "fonts/marsfont.png", info: "Font", wide: true, usage: `MDog.Draw.textImage("Hello", 0, 0, "#ffffff", "fonts/marsfont.png");`},
    {name: "fonts/determinationfont.png", info: "Font", wide: true, usage: `MDog.Draw.textImage("Hello", 0, 0, "#ffffff", "fonts/determinationfont.png");`},
];

function renderBuiltInAssets() {
    const list = root.querySelector(".pg-builtin-list");
    for (const asset of builtInAssets) {
        const frameFiles = asset.frames && !asset.frameWidth
            ? Array.from({length: asset.frames}, (_, i) => "assets/" + asset.name.replace("?", i + 1))
            : null;
        const tile = makeAssetTile({
            name: asset.name,
            info: asset.info ?? asset.frames + " frames",
            usage: asset.usage,
            image: frameFiles ? frameFiles : "assets/" + asset.name,
            frameWidth: asset.frameWidth,
            speed: asset.speed,
            wide: asset.wide,
        });
        const buttons = tile.querySelector(".pg-asset-buttons");
        if (frameFiles) {
            // A set of frames is many files, so they're downloaded together in a .zip
            const button = document.createElement("button");
            button.textContent = "Download .zip";
            button.title = "Download all " + frameFiles.length + " frames";
            button.addEventListener("click", () => downloadZip(frameFiles, asset.name.split("/").at(-1).replace(/_?\?\.png$/, "") + ".zip"));
            buttons.appendChild(button);
        } else {
            buttons.innerHTML = `<a href="assets/${asset.name}" download>Download</a>`;
        }
        list.appendChild(tile);
    }
}

// Downloads files together as one .zip. Zips can store files without compressing them, which is simple enough to do by
// hand, and PNGs are already compressed anyway.
async function downloadZip(urls, zipName) {
    const files = await Promise.all(urls.map(async url => ({
        name: url.split("/").at(-1),
        data: new Uint8Array(await (await fetch(url)).arrayBuffer()),
    })));
    const parts = [];
    const directory = [];
    let offset = 0;
    for (const file of files) {
        const name = new TextEncoder().encode(file.name);
        const crc = crc32(file.data);
        const header = zipHeader(0x04034b50, [[20, 2], [0, 2], [0, 2], [0, 2], [0, 2], [crc, 4], [file.data.length, 4], [file.data.length, 4], [name.length, 2], [0, 2]]);
        directory.push(zipHeader(0x02014b50, [[20, 2], [20, 2], [0, 2], [0, 2], [0, 2], [0, 2], [crc, 4], [file.data.length, 4], [file.data.length, 4], [name.length, 2], [0, 2], [0, 2], [0, 2], [0, 2], [0, 4], [offset, 4]]), name);
        parts.push(header, name, file.data);
        offset += header.length + name.length + file.data.length;
    }
    const directorySize = directory.reduce((total, part) => total + part.length, 0);
    const end = zipHeader(0x06054b50, [[0, 2], [0, 2], [files.length, 2], [files.length, 2], [directorySize, 4], [offset, 4], [0, 2]]);
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([...parts, ...directory, end], {type: "application/zip"}));
    link.download = zipName;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 10000);
}

// A zip record: a 4 byte signature, then each [value, number of bytes] written little-endian
function zipHeader(signature, fields) {
    const bytes = new Uint8Array(4 + fields.reduce((total, [, size]) => total + size, 0));
    const view = new DataView(bytes.buffer);
    view.setUint32(0, signature, true);
    let position = 4;
    for (const [value, size] of fields) {
        if (size === 2) {
            view.setUint16(position, value, true);
        } else {
            view.setUint32(position, value, true);
        }
        position += size;
    }
    return bytes;
}

// The checksum zips use to check each file
function crc32(data) {
    let crc = 0xffffffff;
    for (const byte of data) {
        crc ^= byte;
        for (let bit = 0; bit < 8; bit++) {
            crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
        }
    }
    return (crc ^ 0xffffffff) >>> 0;
}

// A tile for one file. image is a URL, a list of frame URLs (an animation), or null for a file that isn't a picture.
// frameWidth makes it a sprite sheet animation instead.
function makeAssetTile({name, info, usage, image, frameWidth, speed, wide}) {
    const tile = document.createElement("div");
    tile.className = "pg-asset" + (wide ? " pg-asset-wide" : "");
    tile.innerHTML = `
        <button class="pg-asset-preview" title="Copy: ${docsEscape(usage)}"></button>
        <div class="pg-asset-name" title="${docsEscape(name)}">${docsEscape(name)}</div>
        <div class="pg-asset-info">${docsEscape(info)}</div>
        <div class="pg-asset-buttons"></div>`;
    const preview = tile.querySelector(".pg-asset-preview");
    preview.addEventListener("click", () => {
        copyText(usage);
        notify("Copied " + usage);
    });

    if (!image) {
        preview.innerHTML = `<span class="pg-asset-file">${docsEscape((name.split(".").pop() || "file").toUpperCase())}</span>`;
        return tile;
    }

    // Drawn on a canvas, so animations can be played and pixel art stays sharp
    const canvas = document.createElement("canvas");
    preview.appendChild(canvas);
    const context = canvas.getContext("2d");
    const urls = Array.isArray(image) ? image : [image];
    const images = urls.map(url => Object.assign(new Image(), {src: url}));
    const frameCount = frameWidth ? null : images.length;

    Promise.all(images.map(img => img.decode().catch(() => {}))).then(() => {
        const first = images[0];
        if (!first.naturalWidth) {
            preview.innerHTML = `<span class="pg-asset-file">?</span>`;
            return;
        }
        const width = frameWidth ?? first.naturalWidth;
        const height = first.naturalHeight;
        canvas.width = width;
        canvas.height = height;
        if (!wide) {
            // The picture area is at least 146 by 104 (the tab can be hidden now, so it isn't measured)
            const room = Math.min(134 / width, 92 / height);
            // Whole-number sizes keep pixel art even, unless it has to shrink to fit
            const scale = room >= 1 ? Math.floor(room) : room;
            canvas.style.width = width * scale + "px";
            canvas.style.height = height * scale + "px";
        }
        const frames = frameWidth ? Math.floor(first.naturalWidth / frameWidth) : frameCount;
        const draw = frame => {
            context.clearRect(0, 0, width, height);
            if (frameWidth) {
                context.drawImage(first, frame * frameWidth, 0, frameWidth, height, 0, 0, width, height);
            } else {
                context.drawImage(images[frame], 0, 0);
            }
        };
        draw(0);
        if (frames > 1) {
            playingPreviews.push({draw, frames, speed: speed ?? 10, element: canvas});
        }
    });
    return tile;
}

// Animated previews only play while the Assets tab can be seen
const playingPreviews = [];
setInterval(() => {
    if (root.querySelector(".pg-assets").hidden || main.dataset.view === "code") {
        return;
    }
    const time = performance.now() / 1000;
    for (const preview of playingPreviews) {
        preview.draw(Math.floor(time * preview.speed) % preview.frames);
    }
}, 1000 / 24);

// ===== What autofill knows about: built from the docs =====

const pageModules = {
    "draw.html": "Draw", "input.html": "Input", "math.html": "Math", "ui.html": "UI", "fx.html": "FX",
    "threedee.html": "ThreeDee", "asset-manager.html": "AssetManager", "basics.html": "Basics", "core.html": null,
};
// Classes that are built on another class, so they have its methods too
const parentClasses = {
    MultipleFileAnimation: "Animation", SpriteSheetAnimation: "Animation",
    ChunkParticle: "Particle", LineParticle: "Particle", AnimationParticle: "Particle",
    TextInteractable: "Interactable", TilemapInteractable: "Interactable", RectangleGridInteractable: "Interactable",
    VectorGridInteractable: "RectangleGridInteractable",
};

// Each thing is {kind, name, entry, members}. kind is "object" (like MDog.Draw or MDog.Input.Keyboard), "class", "method", or "property".
const mdogRoot = {kind: "object", name: "MDog", members: new Map(), info: "MDog Engine. Every module is in here."};
const classes = new Map();

function getClass(name) {
    if (!classes.has(name)) {
        classes.set(name, {kind: "class", name, members: new Map(), instanceMembers: new Map()});
    }
    return classes.get(name);
}

function buildModel() {
    for (const [page, module] of Object.entries(pageModules)) {
        if (module) {
            const title = docsIndex.find(e => e.page === page && e.kind === "page")?.title;
            mdogRoot.members.set(module, {kind: "object", name: module, members: new Map(), info: title});
        }
    }
    mdogRoot.members.set("ticksPerSecond", {kind: "property", name: "ticksPerSecond", info: "How many times per second the active function runs. Defaults to 160."});

    for (const entry of docsIndex) {
        if (entry.kind !== "method" || !(entry.page in pageModules)) {
            continue;
        }
        const module = pageModules[entry.page];
        const container = module ? mdogRoot.members.get(module) : mdogRoot;
        const method = {kind: "method", name: entry.name, entry};

        if (entry.constructs) {
            const cls = getClass(entry.constructs);
            cls.entry = entry;
            container.members.set(cls.name, cls);
        } else if (entry.owner && entry.page === "input.html") {
            // Keyboard and Mouse are objects, not classes
            if (!container.members.has(entry.owner)) {
                container.members.set(entry.owner, {kind: "object", name: entry.owner, members: new Map(), info: "MDog.Input." + entry.owner});
            }
            container.members.get(entry.owner).members.set(entry.name, method);
        } else if (entry.owner) {
            getClass(entry.owner).instanceMembers.set(entry.name, method);
        } else {
            container.members.set(entry.name, method);
        }
    }
}

// The methods an instance of a class has, including the ones from the classes it's built on
function instanceMembersOf(cls) {
    const members = new Map();
    let current = cls;
    while (current) {
        for (const [name, member] of current.instanceMembers) {
            if (!members.has(name)) {
                members.set(name, member);
            }
        }
        current = parentClasses[current.name] ? classes.get(parentClasses[current.name]) : null;
    }
    return members;
}

function membersOf(thing) {
    if (!thing) {
        return new Map();
    }
    if (thing.instanceOf) {
        return instanceMembersOf(thing.instanceOf);
    }
    return thing.members ?? new Map();
}

// Works out what names in the code are, like "const Vector = MDog.Math.Vector" or "const player = new Vector(1, 2)"
function findVariables(code) {
    const variables = new Map();
    const pattern = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(new\s+)?([A-Za-z_$][\w$]*(?:\s*\.\s*[A-Za-z_$][\w$]*)*)/g;
    // Twice, so a name can use one that's made later in the code
    for (let pass = 0; pass < 2; pass++) {
        for (const match of code.matchAll(pattern)) {
            const [, name, isNew, path] = match;
            const thing = resolve(path.split(/\s*\.\s*/), variables);
            if (!thing) {
                continue;
            }
            if (isNew && thing.kind === "class") {
                variables.set(name, {instanceOf: thing});
            } else if (!isNew) {
                variables.set(name, thing);
            }
        }
    }
    return variables;
}

function resolve(parts, variables) {
    let thing = parts[0] === "MDog" ? mdogRoot : variables.get(parts[0]);
    for (const part of parts.slice(1)) {
        thing = membersOf(thing).get(part);
        if (!thing) {
            return null;
        }
    }
    return thing ?? null;
}

let variables = new Map();

function signature(entry) {
    return "(" + (entry?.params ?? []).join(", ") + ")";
}

function completionFor(thing) {
    if (thing.kind === "method") {
        return {label: thing.name, type: "method", detail: signature(thing.entry), info: thing.entry.description};
    }
    if (thing.kind === "class") {
        return {label: thing.name, type: "class", detail: thing.entry ? signature(thing.entry) : "", info: thing.entry?.description};
    }
    if (thing.kind === "property") {
        return {label: thing.name, type: "property", info: thing.info};
    }
    return {label: thing.name, type: "namespace", info: thing.info};
}

// Autofill for anything after a dot, like "MDog.Draw." or "player."
function mdogCompletions(context) {
    const word = context.matchBefore(/(?:[A-Za-z_$][\w$]*\s*\.\s*)*[A-Za-z_$]*$/);
    if (!word) {
        return null;
    }
    const dot = word.text.lastIndexOf(".");
    if (dot === -1) {
        // Before any dot, only suggest MDog itself. Other names come from CodeMirror's own JavaScript autofill.
        if (word.text.length > 0 && "MDog".startsWith(word.text) && word.text !== "MDog") {
            return {from: word.from, options: [completionFor(mdogRoot)], validFor: /^[\w$]*$/};
        }
        return null;
    }
    const thing = resolve(word.text.slice(0, dot).split(/\s*\.\s*/), variables);
    const members = membersOf(thing);
    if (members.size === 0) {
        return null;
    }
    return {from: word.from + dot + 1, options: [...members.values()].map(completionFor), validFor: /^[\w$]*$/};
}

// The hint under the editor showing the method the cursor is in, like "circle(x, y, radius, color, settings?)",
// with the argument being typed in bold
function updateCallHint(state) {
    const position = state.selection.main.head;
    const before = state.doc.sliceString(Math.max(0, position - 500), position);
    let depth = 0;
    let argument = 0;
    for (let i = before.length - 1; i >= 0; i--) {
        const char = before[i];
        if (char === ")" || char === "]" || char === "}") {
            depth++;
        } else if (char === "(" || char === "[" || char === "{") {
            if (depth > 0) {
                depth--;
                continue;
            }
            if (char !== "(") {
                break;
            }
            const call = before.slice(0, i).match(/(new\s+)?([A-Za-z_$][\w$]*(?:\s*\.\s*[A-Za-z_$][\w$]*)*)\s*$/);
            const thing = call && resolve(call[2].split(/\s*\.\s*/), variables);
            const entry = thing?.entry;
            if (entry && (thing.kind === "method" || thing.kind === "class")) {
                const params = (entry.params ?? []).map((p, n) => n === argument ? `<b>${docsEscape(p)}</b>` : docsEscape(p));
                const name = thing.kind === "class" ? "new " + thing.name : thing.name;
                callHint.innerHTML = `<code>${docsEscape(name)}(${params.join(", ")})</code> <span>${docsEscape(entry.description)}</span>`;
                return;
            }
            break;
        } else if (char === "," && depth === 0) {
            argument++;
        } else if (char === ";" && depth === 0) {
            break;
        }
    }
    callHint.innerHTML = "";
}

// ===== The editor =====

// The same colors as VS Code's dark theme, like the docs' code blocks
const highlightStyle = HighlightStyle.define([
    {tag: tags.keyword, color: "#569cd6"},
    {tag: [tags.controlKeyword, tags.moduleKeyword], color: "#c586c0"},
    {tag: [tags.string, tags.special(tags.string)], color: "#ce9178"},
    {tag: tags.number, color: "#b5cea8"},
    {tag: [tags.bool, tags.null, tags.self], color: "#569cd6"},
    {tag: [tags.lineComment, tags.blockComment, tags.comment], color: "#6a9955"},
    {tag: [tags.function(tags.variableName), tags.function(tags.propertyName)], color: "#dcdcaa"},
    {tag: [tags.className, tags.typeName], color: "#4ec9b0"},
    {tag: [tags.variableName, tags.propertyName, tags.definition(tags.variableName)], color: "#9cdcfe"},
]);

const editorTheme = EditorView.theme({
    "&": {height: "100%", backgroundColor: "transparent", color: "#d4d4d4", fontSize: "14px"},
    ".cm-scroller": {fontFamily: "var(--font-mono)", lineHeight: "1.5"},
    ".cm-content": {caretColor: "#e6e9ee"},
    ".cm-gutters": {backgroundColor: "transparent", color: "var(--text-faint)", border: "none"},
    ".cm-activeLine": {backgroundColor: "rgba(255, 255, 255, 0.03)"},
    ".cm-activeLineGutter": {backgroundColor: "transparent", color: "var(--text-muted)"},
    "&.cm-focused .cm-cursor": {borderLeftColor: "#e6e9ee"},
    ".cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection": {backgroundColor: "rgba(140, 184, 255, 0.25) !important"},
    ".cm-matchingBracket": {backgroundColor: "rgba(140, 184, 255, 0.2)", outline: "none"},
    ".cm-tooltip": {backgroundColor: "var(--surface-raised)", border: "1px solid var(--border-strong)", borderRadius: "6px"},
    ".cm-tooltip-autocomplete ul li": {padding: "2px 8px"},
    ".cm-tooltip-autocomplete ul li[aria-selected]": {backgroundColor: "rgba(140, 184, 255, 0.2)", color: "var(--text)"},
    ".cm-completionDetail": {color: "var(--text-faint)", fontStyle: "normal", marginLeft: "8px"},
    ".cm-completionInfo": {padding: "6px 10px", maxWidth: "320px", fontFamily: "var(--font-sans)", color: "var(--text-muted)"},
    ".cm-foldPlaceholder": {backgroundColor: "var(--surface-raised)", border: "none", color: "var(--text-muted)"},
    // Find and replace. Laid out in two rows like VS Code's: the search box, the option toggles, and the buttons, then
    // the replace box and its buttons. ".cm-panel.cm-search" is used so these win over CodeMirror's own styles.
    ".cm-panels": {backgroundColor: "var(--surface)", color: "var(--text)"},
    ".cm-panels.cm-panels-top": {borderBottom: "1px solid var(--border)"},
    ".cm-panel.cm-search": {
        display: "grid", gridTemplateColumns: "minmax(80px, 320px) repeat(6, auto)", justifyContent: "start", alignItems: "center",
        gap: "6px", padding: "8px 44px 8px 12px", fontFamily: "var(--font-sans)", fontSize: "13px",
    },
    ".cm-panel.cm-search br": {display: "none"},
    ".cm-panel.cm-search input, .cm-panel.cm-search button, .cm-panel.cm-search label": {margin: "0", height: "30px", boxSizing: "border-box"},
    ".cm-panel.cm-search [name=search]": {gridRow: "1", gridColumn: "1"},
    ".cm-panel.cm-search label:nth-of-type(1)": {gridRow: "1", gridColumn: "2"},
    ".cm-panel.cm-search label:nth-of-type(2)": {gridRow: "1", gridColumn: "3"},
    ".cm-panel.cm-search label:nth-of-type(3)": {gridRow: "1", gridColumn: "4"},
    ".cm-panel.cm-search [name=prev]": {gridRow: "1", gridColumn: "5"},
    ".cm-panel.cm-search [name=next]": {gridRow: "1", gridColumn: "6"},
    ".cm-panel.cm-search [name=select]": {gridRow: "1", gridColumn: "7"},
    ".cm-panel.cm-search [name=replace]": {gridRow: "2", gridColumn: "1"},
    ".cm-panel.cm-search [name=replace].cm-button": {gridColumn: "2 / 6"},
    ".cm-panel.cm-search [name=replaceAll]": {gridRow: "2", gridColumn: "6 / 8"},
    ".cm-panel.cm-search .cm-textfield": {
        width: "100%", padding: "0 9px", border: "1px solid var(--border-strong)", borderRadius: "var(--radius-small)",
        backgroundColor: "rgba(255, 255, 255, 0.04)", color: "var(--text)", fontFamily: "var(--font-mono)", fontSize: "13px", outline: "none",
    },
    ".cm-panel.cm-search .cm-textfield:focus": {borderColor: "var(--accent)"},
    ".cm-panel.cm-search .cm-button": {
        padding: "0 11px", border: "1px solid var(--border-strong)", borderRadius: "var(--radius-small)",
        backgroundImage: "none", backgroundColor: "var(--surface-raised)", color: "var(--text)", fontSize: "13px", cursor: "pointer",
    },
    ".cm-panel.cm-search .cm-button:hover": {borderColor: "var(--accent)"},
    ".cm-panel.cm-search .cm-button:active": {backgroundImage: "none", backgroundColor: "var(--accent-bg)"},
    // The options are toggle buttons, lit up when they're on. The checkbox inside is hidden but still works.
    ".cm-panel.cm-search label": {
        position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: "30px", padding: "0 6px",
        border: "1px solid transparent", borderRadius: "var(--radius-small)", color: "var(--text-muted)",
        fontFamily: "var(--font-mono)", fontSize: "13px", cursor: "pointer", userSelect: "none",
    },
    ".cm-panel.cm-search label:hover": {backgroundColor: "var(--hover-bg)", color: "var(--text)"},
    ".cm-panel.cm-search label:has(input:checked)": {borderColor: "rgba(140, 184, 255, 0.5)", backgroundColor: "var(--accent-bg)", color: "var(--accent)"},
    ".cm-panel.cm-search label:has(input:focus-visible)": {outline: "2px solid var(--accent)"},
    ".cm-panel.cm-search input[type=checkbox]": {position: "absolute", opacity: "0", width: "0", height: "0", pointerEvents: "none"},
    ".cm-panel.cm-search button[name=close]": {
        position: "absolute", top: "8px", right: "8px", width: "30px", padding: "0", border: "none", borderRadius: "var(--radius-small)",
        backgroundColor: "transparent", color: "var(--text-muted)", font: "22px/1 var(--font-sans)", cursor: "pointer",
    },
    ".cm-panel.cm-search button[name=close]:hover": {backgroundColor: "var(--hover-bg)", color: "var(--text)"},
    ".cm-searchMatch": {backgroundColor: "rgba(255, 200, 80, 0.22)", outline: "none"},
    ".cm-searchMatch.cm-searchMatch-selected": {backgroundColor: "rgba(255, 200, 80, 0.5)"},
    ".cm-selectionMatch": {backgroundColor: "rgba(140, 184, 255, 0.12)"},
    // Errors: a red squiggle under the code, a dot next to the line number, and the message when the mouse is over it
    ".cm-gutter-lint": {width: "14px"},
    ".cm-gutter-lint .cm-gutterElement": {padding: "0 2px"},
    ".cm-lint-marker": {width: "10px", height: "10px", marginTop: "4px"},
    ".cm-tooltip.cm-tooltip-lint": {maxWidth: "460px"},
    ".cm-diagnostic": {padding: "6px 10px", fontFamily: "var(--font-sans)", fontSize: "13px", whiteSpace: "pre-wrap"},
    ".cm-diagnostic-error": {borderLeft: "3px solid var(--error)"},
    // The box that shows a method's docs, or a variable's value, when the mouse is over it
    ".cm-tooltip.cm-tooltip-hover": {maxWidth: "420px"},
    ".pg-hover": {padding: "8px 11px", fontFamily: "var(--font-sans)", fontSize: "13px", lineHeight: "1.5"},
    ".pg-hover code": {color: "#dcdcaa", fontFamily: "var(--font-mono)", fontSize: "13px"},
    ".pg-hover-text": {marginTop: "3px", color: "var(--text-muted)"},
    ".pg-hover-value": {marginTop: "3px", color: "var(--text)", fontFamily: "var(--font-mono)", fontSize: "12px", wordBreak: "break-word"},
    ".pg-hover-links": {display: "flex", gap: "12px", marginTop: "6px"},
    ".pg-hover-links a, .pg-hover-links button": {
        padding: "0", border: "none", background: "none", color: "var(--accent)", fontFamily: "var(--font-sans)", fontSize: "13px",
        textDecoration: "underline", textUnderlineOffset: "2px", cursor: "pointer",
    },
}, {dark: true});

// ===== Hovering over code =====

// The docs page for each module, for links from the hover box
const modulePages = Object.fromEntries(Object.entries(pageModules).filter(([, module]) => module).map(([page, module]) => [module, page]));

// When the mouse is over something in the code: an engine method or class shows its docs, and anything else shows its
// value from the running game, with a button to watch it.
function hoverInfo(view, pos) {
    const word = view.state.wordAt(pos);
    if (!word) {
        return null;
    }
    const nodeName = syntaxTree(view.state).resolveInner(pos, 1).name;
    if (/String|Comment|Template/.test(nodeName)) {
        return null;
    }
    // The whole name up to the word, like "MDog.Draw.circle" or "player.x"
    const line = view.state.doc.lineAt(word.from);
    const match = line.text.slice(0, word.to - line.from).match(/([A-Za-z_$][\w$]*(?:\s*\.\s*[A-Za-z_$][\w$]*)*)$/);
    if (!match) {
        return null;
    }
    const path = match[1].replace(/\s+/g, "");
    const from = word.to - match[1].length;
    const thing = resolve(path.split("."), variables);

    const box = document.createElement("div");
    box.className = "pg-hover";

    if (thing && (thing.kind === "method" || thing.kind === "class") && thing.entry) {
        const name = thing.kind === "class" ? "new " + thing.name : thing.name;
        box.innerHTML = `
            <code>${docsEscape(name)}${docsEscape(signature(thing.entry))}</code>
            <div class="pg-hover-text">${docsEscape(thing.entry.description)}</div>
            <div class="pg-hover-links"><a href="${docsPageHref(thing.entry.page)}#${thing.entry.id}" target="_blank">Read the docs ↗</a></div>`;
    } else if (thing && (thing.kind === "object" || thing.kind === "property") && thing.info) {
        const page = thing === mdogRoot ? "core.html" : modulePages[thing.name] ?? (thing.name === "Keyboard" || thing.name === "Mouse" ? "input.html" : null);
        box.innerHTML = `
            <code>${docsEscape(path)}</code>
            <div class="pg-hover-text">${docsEscape(thing.info)}</div>
            ${page ? `<div class="pg-hover-links"><a href="${docsPageHref(page)}" target="_blank">Read the docs ↗</a></div>` : ""}`;
    } else {
        // A value from the game, if it's running and the name means something there
        if (/^(true|false|null|undefined|this|NaN|Infinity|function|return|if|else|for|while|let|const|var|new)$/.test(path)) {
            return null;
        }
        const value = gameFrame?.contentWindow?.playgroundControl?.read(path);
        if (!value?.ok || value.text.startsWith("function")) {
            return null;
        }
        box.innerHTML = `
            <code>${docsEscape(path)}</code>
            <div class="pg-hover-value"></div>
            <div class="pg-hover-links"><button>Watch</button></div>`;
        box.querySelector(".pg-hover-value").textContent = value.text;
        box.querySelector("button").addEventListener("click", () => addWatch(path));
    }
    return {pos: from, end: word.to, above: true, create: () => ({dom: box})};
}

// ===== Errors in the code =====
// Two kinds: code that isn't finished JavaScript (found as you type), and errors from running the game (from the
// console). Both are shown as squiggles in the editor.

let syntaxDiagnostics = [];
let runtimeDiagnostics = [];
let syntaxTimer = null;

function showDiagnostics() {
    editor.dispatch(setDiagnostics(editor.state, [...syntaxDiagnostics, ...runtimeDiagnostics]));
}

// Finds the first place the code stops making sense, like a missing bracket. Only the first one is shown, since
// everything after it can look wrong too.
function checkSyntax() {
    const state = editor.state;
    const tree = ensureSyntaxTree(state, state.doc.length, 200) ?? syntaxTree(state);
    let found = null;
    tree.iterate({
        enter(node) {
            if (found) {
                return false;
            }
            if (node.type.isError) {
                found = node.from;
                return false;
            }
        },
    });
    syntaxDiagnostics = [];
    if (found !== null) {
        const line = state.doc.lineAt(found);
        // Underline the rest of the line. If the problem is noticed at the very start of a line, the mistake is
        // usually at the end of the line before (like a missing bracket), so that line is underlined instead.
        let from = found;
        let to = line.to;
        const startOfLine = line.from + line.text.search(/\S|$/);
        if (found <= startOfLine && line.number > 1) {
            let previous = state.doc.line(line.number - 1);
            while (previous.number > 1 && previous.text.trim() === "") {
                previous = state.doc.line(previous.number - 1);
            }
            from = previous.from + previous.text.search(/\S|$/);
            to = previous.to;
        }
        if (to > from) {
            syntaxDiagnostics.push({from, to, severity: "error", message: "This doesn't look like finished JavaScript. Check for a missing bracket, quote, or comma around here."});
        }
    }
    showDiagnostics();
}

// An error from the running game, on one line of the code
function addRuntimeError(lineNumber, message) {
    if (lineNumber < 1 || lineNumber > editor.state.doc.lines || runtimeDiagnostics.some(d => d.lineNumber === lineNumber)) {
        return;
    }
    const line = editor.state.doc.line(lineNumber);
    const from = line.from + line.text.search(/\S|$/);
    runtimeDiagnostics.push({lineNumber, from, to: Math.max(line.to, from + 1), severity: "error", message});
    showDiagnostics();
}

let saveTimer = null;
let autorunTimer = null;
let variablesTimer = null;

const editor = new EditorView({
    parent: root.querySelector(".pg-editor"),
    state: EditorState.create({
        doc: "",
        extensions: [
            basicSetup,
            javascript(),
            javascriptLanguage.data.of({autocomplete: mdogCompletions}),
            syntaxHighlighting(highlightStyle),
            editorTheme,
            // Find and replace (Ctrl+F) opens above the code, with the words capitalized
            search({top: true}),
            EditorState.phrases.of({
                "Find": "Find", "Replace": "Replace with", "next": "Next", "previous": "Previous", "all": "All",
                "match case": "Aa", "regexp": ".*", "by word": "ab",
                "replace": "Replace", "replace all": "Replace all", "close": "Close",
            }),
            EditorState.tabSize.of(4),
            indentUnit.of("    "),
            lintGutter(),
            hoverTooltip(hoverInfo, {hoverTime: 350}),
            keymap.of([
                {key: "Mod-Enter", run: () => { run(true); return true; }},
                {key: "Mod-s", run: () => { saveCode(true); return true; }, preventDefault: true},
                indentWithTab,
            ]),
            EditorView.updateListener.of(update => {
                if (update.docChanged) {
                    codeChanged();
                }
                if (update.docChanged || update.selectionSet) {
                    updateCallHint(update.state);
                }
                nameSearchToggles(update.view);
            }),
        ],
    }),
});

// The find options are shown as "Aa", ".*", and "ab", so they get names that show when the mouse is over them
const searchToggleNames = {case: "Match case", re: "Use regular expression", word: "Match whole word"};
function nameSearchToggles(view) {
    for (const input of view.dom.querySelectorAll(".cm-search input[type=checkbox]:not([aria-label])")) {
        const name = searchToggleNames[input.name] ?? "";
        input.setAttribute("aria-label", name);
        input.parentElement.title = name;
    }
}

function getCode() {
    return editor.state.doc.toString();
}

// Replaces all the code. When undoable is true, Undo (Ctrl+Z) puts the old code back. Loading the saved code when the
// page opens isn't undoable, so Ctrl+Z can't empty the editor.
function setCode(code, undoable = false) {
    editor.dispatch({
        changes: {from: 0, to: editor.state.doc.length, insert: code},
        annotations: undoable ? [] : [Transaction.addToHistory.of(false)],
    });
    variables = findVariables(code);
}

function codeChanged() {
    // Errors from running the game are about the old code, so they're cleared, and the new code is checked
    if (runtimeDiagnostics.length > 0) {
        runtimeDiagnostics = [];
        showDiagnostics();
    }
    clearTimeout(syntaxTimer);
    syntaxTimer = setTimeout(checkSyntax, 700);
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => saveCode(false), 400);
    clearTimeout(variablesTimer);
    variablesTimer = setTimeout(() => variables = findVariables(getCode()), 300);
    if (root.querySelector(".pg-autorun input").checked) {
        clearTimeout(autorunTimer);
        autorunTimer = setTimeout(run, 900);
    }
}

function saveCode(showIt) {
    if (viewingShared) {
        if (showIt) {
            savedLabel.textContent = "Not saved (shared project)";
        }
        return;
    }
    if (!currentProject) {
        return;
    }
    try {
        localStorage.setItem(codeKeyFor(currentProject.id), getCode());
        currentProject.updated = Date.now();
        saveProjectList();
        savedLabel.textContent = "Saved";
    } catch (error) {
        savedLabel.textContent = "Couldn't save";
    }
}

// ===== Running the game =====

let gameFrame = null;
let codeOffset = 0;

async function run(showGame = false) {
    clearConsole();
    stopRecording(false);
    const code = getCode();
    variables = findVariables(code);
    runtimeDiagnostics = [];
    checkSyntax();

    // Load every image before the game starts, so nothing flickers in. Added files are used instead of built-in ones.
    const assetURLs = {};
    for (const asset of assets) {
        assetURLs[asset.name] = asset.url;
    }
    const builtInImages = (await findDemoImages(code)).filter(name => !(name in assetURLs));
    const images = [...assets.filter(a => isImage(a.name)).map(a => a.name), ...builtInImages];

    // The page the game runs in (see game-page.js). Errors give line numbers in that whole page, so codeOffset is where
    // the code in the editor starts.
    const page = mdogGamePage({code, engineURL, assetURLs, images});
    codeOffset = page.codeOffset;

    gameFrame?.remove();
    gameFrame = document.createElement("iframe");
    gameFrame.className = "pg-frame";
    gameFrame.title = "Your game";
    gameFrame.srcdoc = page.html;
    setPaused(false);
    showTouchKeys(code);
    const frame = gameFrame;
    gameFrame.addEventListener("load", () => {
        frame.focus();
        frame.contentWindow.focus();
        // A picture of the game for the project list, once it's had a moment to draw something
        setTimeout(() => saveThumbnail(frame), 2500);
    });
    gameBox.appendChild(gameFrame);
    gameBox.classList.add("running");

    // On small screens the code and game don't fit side by side, so pressing Run shows the game
    if (showGame === true && isNarrow() && main.dataset.view === "code") {
        setView("game");
    }
}

// ===== Controlling the game: restart, pause, step, screenshots, and GIFs =====

let gamePaused = false;
let recorder = null;

function setPaused(paused) {
    gamePaused = paused;
    const control = gameFrame?.contentWindow?.playgroundControl;
    if (control) {
        if (paused) {
            control.pause();
        } else {
            control.resume();
        }
    }
    const button = root.querySelector(".pg-game-pause");
    button.textContent = paused ? "Resume" : "Pause";
    button.title = paused ? "Keep playing" : "Pause the game";
    root.querySelector(".pg-game-step").disabled = !paused;
    gameBox.classList.toggle("paused", paused);
}

// The game's picture, every layer drawn together, made bigger by scale
function gamePicture(scale) {
    const canvases = [...(gameFrame?.contentDocument?.querySelectorAll("canvas") ?? [])];
    if (canvases.length === 0 || !canvases[0].width) {
        return null;
    }
    const picture = document.createElement("canvas");
    picture.width = canvases[0].width * scale;
    picture.height = canvases[0].height * scale;
    const context = picture.getContext("2d", {willReadFrequently: true});
    context.imageSmoothingEnabled = false;
    context.fillStyle = "#000";
    context.fillRect(0, 0, picture.width, picture.height);
    for (const canvas of canvases) {
        context.drawImage(canvas, 0, 0, picture.width, picture.height);
    }
    return picture;
}

function downloadName(extension) {
    const name = viewingShared ? "mdog-game" : currentProject?.name ?? "mdog-game";
    return (name.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-").toLowerCase() || "mdog-game") + "." + extension;
}

function download(blob, name) {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 10000);
}

// GIFs are recorded at 20 frames per second, for up to 10 seconds, at a whole-number size up to about 480 wide
const gifFrameTime = 50;
const gifMaxFrames = 200;
let recordTimer = null;

function startRecording() {
    const art = gamePicture(1);
    if (!art) {
        notify("Run the game first, then record it.");
        return;
    }
    const scale = Math.max(1, Math.floor(480 / art.width));
    recorder = {gif: mdogGifRecorder(art.width * scale, art.height * scale), width: art.width * scale, scale, started: Date.now()};
    const button = root.querySelector(".pg-game-record");
    button.classList.add("recording");
    const capture = () => {
        const picture = gamePicture(recorder.scale);
        // Only frames the same size as the first, in case the game changes its size while recording
        if (picture && picture.width === recorder.width) {
            recorder.gif.addFrame(picture.getContext("2d").getImageData(0, 0, picture.width, picture.height).data);
        }
        const seconds = Math.floor((Date.now() - recorder.started) / 1000);
        button.textContent = `Stop (0:${String(seconds).padStart(2, "0")})`;
        if (recorder.gif.frameCount() >= gifMaxFrames) {
            stopRecording(true);
        }
    };
    capture();
    recordTimer = setInterval(capture, gifFrameTime);
}

// Stops recording, and makes the GIF if save is true
async function stopRecording(save) {
    if (!recorder) {
        return;
    }
    clearInterval(recordTimer);
    const done = recorder;
    recorder = null;
    const button = root.querySelector(".pg-game-record");
    button.classList.remove("recording");
    if (!save || done.gif.frameCount() === 0) {
        button.textContent = "Record GIF";
        return;
    }
    button.disabled = true;
    const blob = await done.gif.finish(gifFrameTime / 10, progress => {
        button.textContent = `Making GIF ${Math.round(progress * 100)}%`;
    });
    button.disabled = false;
    button.textContent = "Record GIF";
    download(blob, downloadName("gif"));
    notify(`Saved a ${(blob.size / 1024 / 1024).toFixed(1)} MB GIF.`);
}

function setUpGameControls() {
    root.querySelector(".pg-game-restart").addEventListener("click", () => run(true));
    root.querySelector(".pg-game-pause").addEventListener("click", () => setPaused(!gamePaused));
    root.querySelector(".pg-game-step").addEventListener("click", () => gameFrame?.contentWindow?.playgroundControl?.step());
    root.querySelector(".pg-game-screenshot").addEventListener("click", () => {
        const art = gamePicture(1);
        if (!art) {
            notify("Run the game first, then take a screenshot.");
            return;
        }
        // Pixel art is saved bigger, with each pixel a whole number of pixels, about 960 wide
        const picture = gamePicture(Math.max(1, Math.floor(960 / art.width)));
        picture.toBlob(blob => {
            download(blob, downloadName("png"));
            notify("Saved a screenshot.");
        });
    });
    root.querySelector(".pg-game-record").addEventListener("click", () => {
        if (recorder) {
            stopRecording(true);
        } else {
            startRecording();
        }
    });
    root.querySelector(".pg-fullscreen").addEventListener("click", () => gameBox.requestFullscreen?.());
}

// ===== Touch buttons, for playing on phones =====

// Shows a button for each key the code checks for, on touch screens
function showTouchKeys(code) {
    const container = root.querySelector(".pg-touch-keys");
    const keys = window.matchMedia("(pointer: coarse)").matches ? mdogFindKeys(code) : [];
    container.hidden = keys.length === 0;
    mdogTouchKeys(container, keys, () => gameFrame?.contentWindow);
    layOut();
}

// ===== Watching values from the game =====
// Each project has its own list of things to watch, saved like its code.

let watches = [];
const watchKeyFor = id => "mdog-playground-watch:" + id;

function loadWatches() {
    try {
        watches = JSON.parse(localStorage.getItem(watchKeyFor(currentProject?.id))) ?? [];
    } catch (error) {
        watches = [];
    }
    renderWatches();
}

function saveWatches() {
    if (viewingShared || !currentProject) {
        return;
    }
    try {
        localStorage.setItem(watchKeyFor(currentProject.id), JSON.stringify(watches));
    } catch (error) {}
}

function addWatch(expression) {
    expression = expression.trim();
    if (expression && !watches.includes(expression)) {
        watches.push(expression);
        saveWatches();
        renderWatches();
    }
    showPanel("watch");
}

function renderWatches() {
    const list = root.querySelector(".pg-watch-list");
    list.innerHTML = "";
    for (const expression of watches) {
        const row = document.createElement("div");
        row.className = "pg-watch-row";
        row.innerHTML = `<code class="pg-watch-name"></code><span class="pg-watch-value"></span><button class="pg-watch-remove" aria-label="Stop watching" title="Stop watching">×</button>`;
        row.querySelector(".pg-watch-name").textContent = expression;
        row.querySelector(".pg-watch-remove").addEventListener("click", () => {
            watches = watches.filter(w => w !== expression);
            saveWatches();
            renderWatches();
        });
        row.dataset.expression = expression;
        list.appendChild(row);
    }
    root.querySelector(".pg-watch-empty").hidden = watches.length > 0;
    root.querySelector(".pg-watch-count").textContent = watches.length ? "(" + watches.length + ")" : "";
    updateWatches();
}

// Reads every watched value from the game
function updateWatches() {
    const control = gameFrame?.contentWindow?.playgroundControl;
    for (const row of root.querySelectorAll(".pg-watch-row")) {
        const value = control ? control.read(row.dataset.expression) : {ok: false, text: "the game isn't running"};
        const element = row.querySelector(".pg-watch-value");
        element.textContent = value.text;
        element.classList.toggle("problem", !value.ok);
    }
}

function setUpWatch() {
    const form = root.querySelector(".pg-watch-form");
    form.addEventListener("submit", e => {
        e.preventDefault();
        const input = form.querySelector("input");
        addWatch(input.value);
        input.value = "";
    });
    // Kept up to date while the Watch tab can be seen
    setInterval(() => {
        if (!root.querySelector(".pg-watch").hidden && main.dataset.view !== "code") {
            updateWatches();
        }
    }, 150);
}

// ===== The console =====

const maxConsoleLines = 500;
let consoleLines = 0;
let lastLine = null;

window.addEventListener("message", e => {
    if (gameFrame && e.source === gameFrame.contentWindow && e.data?.playground) {
        addConsoleLine(e.data.playground);
    }
});

function clearConsole() {
    consoleBox.querySelectorAll(".pg-log").forEach(line => line.remove());
    consoleBox.querySelector(".pg-console-empty").hidden = false;
    consoleLines = 0;
    lastLine = null;
    root.querySelector(".pg-console-count").textContent = "";
}

function addConsoleLine({level, text, line}) {
    const userLine = line ? line - codeOffset : null;
    const key = level + "|" + text + "|" + userLine;

    // A game prints the same thing many times a second, so repeats are counted instead of added again
    if (lastLine && lastLine.key === key) {
        lastLine.count++;
        lastLine.countLabel.textContent = "×" + lastLine.count;
        lastLine.countLabel.hidden = false;
        return;
    }

    consoleBox.querySelector(".pg-console-empty").hidden = true;
    const element = document.createElement("div");
    element.className = "pg-log pg-log-" + level;

    const textElement = document.createElement("span");
    textElement.className = "pg-log-text";
    textElement.textContent = text;
    element.appendChild(textElement);

    if (userLine && userLine > 0) {
        const lineButton = document.createElement("button");
        lineButton.className = "pg-log-line";
        lineButton.textContent = "line " + userLine;
        lineButton.title = "Go to this line";
        lineButton.addEventListener("click", () => goToLine(userLine));
        element.appendChild(lineButton);
    }

    const countLabel = document.createElement("span");
    countLabel.className = "pg-log-count";
    countLabel.hidden = true;
    element.appendChild(countLabel);

    const atBottom = consoleBox.scrollHeight - consoleBox.scrollTop - consoleBox.clientHeight < 30;
    consoleBox.appendChild(element);
    lastLine = {key, count: 1, countLabel};

    consoleLines++;
    if (consoleLines > maxConsoleLines) {
        consoleBox.querySelector(".pg-log")?.remove();
        consoleLines--;
    }
    if (atBottom) {
        consoleBox.scrollTop = consoleBox.scrollHeight;
    }
    root.querySelector(".pg-console-count").textContent = "(" + consoleLines + ")";
    if (level === "error") {
        showPanel("console");
        if (userLine) {
            addRuntimeError(userLine, text);
        }
    }
}

function goToLine(number) {
    const line = editor.state.doc.line(Math.min(number, editor.state.doc.lines));
    editor.dispatch({selection: {anchor: line.from, head: line.to}, scrollIntoView: true});
    editor.focus();
    if (main.dataset.view === "game") {
        setView(isNarrow() ? "code" : "split");
    }
}

// ===== Views and panels =====

function isNarrow() {
    return window.matchMedia("(max-width: 800px)").matches;
}

function setView(view) {
    if (view === "split" && isNarrow()) {
        view = "code";
    }
    main.dataset.view = view;
    for (const button of root.querySelectorAll(".pg-views button")) {
        button.classList.toggle("selected", button.dataset.view === view);
    }
    try {
        localStorage.setItem(viewKey, view);
    } catch (error) {}
    if (view !== "game") {
        editor.requestMeasure();
    }
    layOut();
}

// Set by setUpDividers. Works out the sizes of the code, game, and console again.
let layOut = () => {};

// The game's size in art pixels, like {width: 256, height: 192}, once it's running
let gameArtSize = null;

// Games can set their size any time, so it's checked every so often
setInterval(() => {
    const canvas = gameFrame?.contentDocument?.querySelector("canvas");
    if (canvas && (canvas.width !== gameArtSize?.width || canvas.height !== gameArtSize?.height)) {
        gameArtSize = {width: canvas.width, height: canvas.height};
        layOut();
    }
}, 250);

// The lines between the code and game, and between the game and console, can be dragged to resize them. The sizes are
// saved as how much of the space each part takes, so they still fit if the window changes size. Double-click to reset.
//
// Until a line is dragged, the game's box is made exactly the size the game draws at, so there are no black bars
// around it. MDog Engine makes each art pixel a whole number of screen pixels, so the biggest whole number is picked
// that keeps the game to half the width (in Split view) and leaves room for the console.
// The height of the bar above the game, and the touch buttons under it, which share the game's column
function gameExtrasHeight() {
    return root.querySelector(".pg-game-bar").offsetHeight + root.querySelector(".pg-touch-keys").offsetHeight;
}

function setUpDividers() {
    const gameColumn = root.querySelector(".pg-game-column");
    let sizes = {};
    try {
        sizes = JSON.parse(localStorage.getItem(sizesKey)) ?? {};
    } catch (error) {}

    function apply() {
        const fit = fitGame();

        // The code's share of the width, written as a grid fraction next to the game's 1fr
        if (sizes.code) {
            main.style.setProperty("--pg-columns", `minmax(0, ${sizes.code / (1 - sizes.code)}fr) minmax(0, 1fr)`);
        } else if (fit && main.dataset.view === "split") {
            main.style.setProperty("--pg-columns", `minmax(0, 1fr) ${fit.width}px`);
        } else {
            main.style.removeProperty("--pg-columns");
        }

        if (sizes.panels) {
            main.style.setProperty("--pg-panels-height", (sizes.panels * 100) + "%");
        } else if (fit) {
            main.style.setProperty("--pg-panels-height", `calc(100% - ${fit.height + gameExtrasHeight()}px)`);
        } else {
            main.style.removeProperty("--pg-panels-height");
        }
    }

    // The size the game's box should be to fit the game exactly, in CSS pixels. This only uses the default limits, never
    // the dragged sizes, so dragging one line can't move the other.
    function fitGame() {
        if (!gameArtSize || main.dataset.view === "code") {
            return null;
        }
        const rect = main.getBoundingClientRect();
        const ratio = window.devicePixelRatio || 1;
        const maxWidth = main.dataset.view === "split" ? rect.width / 2 : rect.width;
        const maxHeight = rect.height - 150 - gameExtrasHeight();
        const scale = Math.max(1, Math.floor(Math.min(maxWidth * ratio / gameArtSize.width, maxHeight * ratio / gameArtSize.height)));
        // Rounded up to a whole CSS pixel, since the game's page is given a whole number of pixels to draw in. Rounding
        // down there would leave it a hair too small, and the game would drop to the next size down.
        return {width: Math.ceil(gameArtSize.width * scale / ratio), height: Math.ceil(gameArtSize.height * scale / ratio)};
    }

    function save() {
        try {
            localStorage.setItem(sizesKey, JSON.stringify(sizes));
        } catch (error) {}
    }

    function makeDraggable(divider, name, getSize) {
        let dragging = false;
        divider.addEventListener("pointerdown", e => {
            if (e.button !== 0) {
                return;
            }
            e.preventDefault();
            dragging = true;
            divider.classList.add("dragging");
            root.classList.add("resizing", "resizing-" + (name === "code" ? "columns" : "rows"));
        });
        // On the whole window, so the drag keeps going when the mouse moves faster than the line
        window.addEventListener("pointermove", e => {
            if (dragging) {
                sizes[name] = Math.min(0.85, Math.max(0.15, getSize(e)));
                apply();
            }
        });
        const stop = () => {
            if (dragging) {
                dragging = false;
                divider.classList.remove("dragging");
                root.classList.remove("resizing", "resizing-columns", "resizing-rows");
                save();
            }
        };
        window.addEventListener("pointerup", stop);
        window.addEventListener("pointercancel", stop);
        divider.addEventListener("dblclick", () => {
            delete sizes[name];
            apply();
            save();
        });
    }

    makeDraggable(root.querySelector(".pg-divider-columns"), "code", e => {
        const rect = main.getBoundingClientRect();
        return (e.clientX - rect.left) / rect.width;
    });
    makeDraggable(root.querySelector(".pg-divider-rows"), "panels", e => {
        const rect = gameColumn.getBoundingClientRect();
        return (rect.bottom - e.clientY) / rect.height;
    });
    layOut = apply;
    // Again whenever the playground changes size, like when the window is resized or the sidebar is collapsed.
    // Waits a frame, since apply() changes the layout too.
    new ResizeObserver(() => requestAnimationFrame(apply)).observe(main);
    apply();
}

function showPanel(name) {
    for (const button of root.querySelectorAll(".pg-panel-tabs [data-panel]")) {
        button.classList.toggle("selected", button.dataset.panel === name);
    }
    for (const panel of root.querySelectorAll(".pg-panels > [data-panel]")) {
        panel.hidden = panel.dataset.panel !== name;
    }
}

// ===== Sharing, exporting, and importing =====

function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(",")[1]);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
    });
}

function base64ToBlob(data, type) {
    const binary = atob(data);
    return new Blob([Uint8Array.from(binary, char => char.charCodeAt(0))], {type});
}

async function assetsToSave(list) {
    return Promise.all(list.map(async a => ({name: a.name, type: a.type, data: await blobToBase64(a.blob)})));
}

function assetsFromSaved(list) {
    return (list ?? []).map(a => {
        const blob = base64ToBlob(a.data, a.type);
        return {name: a.name, type: a.type, blob, url: URL.createObjectURL(blob)};
    });
}

// Files over this many bytes in total are too big to fit in a link
const maxLinkAssetBytes = 12000;

const shareDialog = root.querySelector(".pg-share-dialog");

function setUpSharing() {
    let encoded = "";
    const embedCode = () => {
        const width = Number(shareDialog.querySelector(".pg-embed-width").value) || 640;
        const height = Number(shareDialog.querySelector(".pg-embed-height").value) || 480;
        const src = new URL(docsPageHref("embed.html"), window.location.href).href + "#p=" + encoded;
        const title = viewingShared ? "MDog Engine game" : currentProject?.name ?? "MDog Engine game";
        return `<iframe src="${src}" width="${width}" height="${height}" title="${docsEscape(title)}" style="border: 0;" allow="fullscreen"></iframe>`;
    };
    const update = () => {
        shareDialog.querySelector(".pg-embed-code").value = embedCode();
    };

    root.querySelector(".pg-share").addEventListener("click", async () => {
        const totalSize = assets.reduce((total, a) => total + a.blob.size, 0);
        const includeAssets = totalSize <= maxLinkAssetBytes;
        shareDialog.querySelector(".pg-share-warning").hidden = assets.length === 0 || includeAssets;
        encoded = await docsEncodeProject({code: getCode(), assets: includeAssets ? await assetsToSave(assets) : []});
        shareDialog.querySelector(".pg-share-link").value = new URL(docsPageHref("playground.html"), window.location.href).href + "#p=" + encoded;

        // Starts at a size the game fits exactly, about 640 wide
        if (gameArtSize) {
            const scale = Math.max(1, Math.floor(640 / gameArtSize.width));
            shareDialog.querySelector(".pg-embed-width").value = gameArtSize.width * scale;
            shareDialog.querySelector(".pg-embed-height").value = gameArtSize.height * scale;
        }
        update();
        shareDialog.showModal();
        shareDialog.focus();
    });
    for (const input of shareDialog.querySelectorAll("input[type=number]")) {
        input.addEventListener("input", update);
    }
    shareDialog.querySelector(".pg-copy-link").addEventListener("click", e => {
        copyText(shareDialog.querySelector(".pg-share-link").value);
        notify("Link copied");
    });
    shareDialog.querySelector(".pg-copy-embed").addEventListener("click", () => {
        copyText(shareDialog.querySelector(".pg-embed-code").value);
        notify("Embed code copied");
    });
    shareDialog.querySelector(".pg-dialog-close").addEventListener("click", () => shareDialog.close());
    shareDialog.addEventListener("click", e => {
        if (e.target === shareDialog) {
            shareDialog.close();
        }
    });
}

// Makes one HTML file with the game's code and files in it. It runs when it's opened, and Import can open it again.
async function exportProject() {
    const code = getCode();
    const addImport = !/import\s+MDog\s+from/.test(code);
    const gameCode = (addImport ? engineImport + "\n" : "") + code;

    // Built-in images the code uses are put in the file too, so it works anywhere
    const names = new Set(assets.map(a => a.name));
    const builtIn = [];
    for (const name of await findDemoImages(code)) {
        if (names.has(name)) {
            continue;
        }
        const response = await fetch("assets/" + name);
        if (response.ok) {
            const blob = await response.blob();
            builtIn.push({name, type: blob.type || "image/png", blob});
        }
    }
    const name = viewingShared ? "Shared project" : currentProject?.name ?? "My MDog Engine Game";
    const project = {version: 1, name, assets: await assetsToSave([...assets, ...builtIn])};
    // Written so the file can't accidentally end its own script tags
    const projectJSON = JSON.stringify(project).replace(/</g, "\\u003c");
    const safeCode = gameCode.replace(/<\/script/gi, "<\\/script");

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${docsEscape(name)}</title>
<style>html, body { margin: 0; height: 100%; background: #000; } body { display: flex; justify-content: center; align-items: center; }</style>
<!-- Made in the MDog Engine Playground. To keep working on it, open this file with Import in the Playground. -->
<script type="application/json" id="mdog-project">${projectJSON}<\/script>
<script>
// Lets the game load the files saved in this page, as if they were in an assets folder
(() => {
    const project = JSON.parse(document.getElementById("mdog-project").textContent);
    const assets = {};
    for (const asset of project.assets) {
        assets[asset.name] = "data:" + asset.type + ";base64," + asset.data;
    }
    const assetURL = url => {
        const match = String(url).match(/^(?:\\.\\/)?assets\\/(.+)$/);
        return match && assets[match[1]] ? assets[match[1]] : url;
    };
    const imageSrc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "src");
    Object.defineProperty(HTMLImageElement.prototype, "src", {configurable: true, get: imageSrc.get, set(value) { imageSrc.set.call(this, assetURL(value)); }});
    const realFetch = window.fetch.bind(window);
    window.fetch = (input, options) => realFetch(typeof input === "string" ? assetURL(input) : input, options);
})();
<\/script>
</head>
<body>
<script type="module" id="mdog-game">
${safeCode}
<\/script>
</body>
</html>
`;
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([html], {type: "text/html"}));
    link.download = (name.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-").toLowerCase() || "mdog-game") + ".html";
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 10000);
}

async function importFile(file) {
    const html = await file.text();
    const page = new DOMParser().parseFromString(html, "text/html");
    const gameScript = page.querySelector("script#mdog-game") ?? page.querySelector('script[type="module"]');
    if (!gameScript) {
        await ask({
            title: "That file can't be imported",
            text: `"${file.name}" doesn't have any game code in it. Import opens files that were made with Export.`,
            ok: "OK",
            cancel: null,
        });
        return;
    }
    let saved = {};
    try {
        saved = JSON.parse(page.querySelector("script#mdog-project")?.textContent ?? "{}");
    } catch (error) {}

    // Imported files become a new project, so nothing is replaced
    leaveShared(false);
    const name = saved.name ?? file.name.replace(/\.html?$/i, "");
    const code = gameScript.textContent.replace(/<\\\/script/gi, "</script").trim() + "\n";
    await makeProject(name, code, assetsFromSaved(saved.assets ?? []));
    notify(`Imported "${name}" as a new project.`);
}

// ===== Shared links =====

async function openSharedLink() {
    const match = window.location.hash.match(/^#p=(.+)$/);
    if (!match) {
        return false;
    }
    try {
        const project = await docsDecodeProject(match[1]);
        viewingShared = true;
        banner.hidden = false;
        showProjectName();
        setCode(project.code ?? "");
        setAssets(assetsFromSaved(project.assets));
        return true;
    } catch (error) {
        notify("That link couldn't be opened. It might be cut off.");
        return false;
    }
}

function leaveShared(clearHash = true) {
    viewingShared = false;
    banner.hidden = true;
    showProjectName();
    if (clearHash) {
        history.replaceState(null, "", window.location.pathname + window.location.search);
    }
}

// ===== Projects =====
// The list of projects is saved in localStorage as [{id, name, updated, thumbnail}]. Each project's code is saved
// under its own key, and its files are saved in IndexedDB under its id.

let projects = [];
let currentProject = null;

function saveProjectList() {
    try {
        localStorage.setItem(projectsKey, JSON.stringify(projects));
        if (currentProject) {
            localStorage.setItem(currentProjectKey, currentProject.id);
        }
    } catch (error) {}
}

function newProjectId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// Loads the list of projects. The first time, whatever was saved before there were projects becomes "My project".
async function loadProjects() {
    try {
        projects = JSON.parse(localStorage.getItem(projectsKey)) ?? [];
    } catch (error) {
        projects = [];
    }
    if (projects.length > 0) {
        return;
    }
    const project = {id: newProjectId(), name: "My project", updated: Date.now()};
    projects = [project];
    let oldCode = null;
    try {
        oldCode = localStorage.getItem(oldCodeKey);
        localStorage.setItem(codeKeyFor(project.id), oldCode ?? defaultCode);
    } catch (error) {}

    const db = await database;
    if (db) {
        const oldFiles = await new Promise(resolve => {
            const request = db.transaction("assets").objectStore("assets").getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => resolve([]);
        });
        await saveProjectFiles(project.id, oldFiles);
        db.transaction("assets", "readwrite").objectStore("assets").clear();
    }
    try {
        localStorage.removeItem(oldCodeKey);
    } catch (error) {}
    currentProject = project;
    saveProjectList();
}

async function openProject(project) {
    currentProject = project;
    saveProjectList();
    let code = null;
    try {
        code = localStorage.getItem(codeKeyFor(project.id));
    } catch (error) {}
    setCode(code ?? defaultCode);
    setAssets(await loadSavedAssets(project.id));
    showProjectName();
    loadWatches();
    savedLabel.textContent = "";
}

async function loadOwnProject() {
    let id = null;
    try {
        id = localStorage.getItem(currentProjectKey);
    } catch (error) {}
    await openProject(projects.find(p => p.id === id) ?? mostRecentProject());
}

function mostRecentProject() {
    return [...projects].sort((a, b) => b.updated - a.updated)[0];
}

// Makes a new project with some code and files, and opens it
async function makeProject(name, code, files = []) {
    const project = {id: newProjectId(), name, updated: Date.now()};
    projects.push(project);
    try {
        localStorage.setItem(codeKeyFor(project.id), code);
    } catch (error) {}
    await saveProjectFiles(project.id, files);
    await openProject(project);
    run();
    return project;
}

// A name that isn't taken yet, like "Untitled 2"
function freeName(base) {
    const names = new Set(projects.map(p => p.name));
    if (!names.has(base)) {
        return base;
    }
    let n = 2;
    while (names.has(base + " " + n)) {
        n++;
    }
    return base + " " + n;
}

function showProjectName() {
    const label = root.querySelector(".pg-project-name");
    label.textContent = viewingShared ? "Shared project" : currentProject?.name ?? "My project";
}

// A small picture of the running game, saved with the project for the project list
function saveThumbnail(frame) {
    if (viewingShared || !currentProject || frame !== gameFrame) {
        return;
    }
    try {
        const canvases = [...frame.contentDocument.querySelectorAll("canvas")];
        if (canvases.length === 0 || !canvases[0].width) {
            return;
        }
        const scale = Math.min(1, 200 / canvases[0].width, 150 / canvases[0].height);
        const picture = document.createElement("canvas");
        picture.width = Math.max(1, Math.round(canvases[0].width * scale));
        picture.height = Math.max(1, Math.round(canvases[0].height * scale));
        const context = picture.getContext("2d");
        context.imageSmoothingEnabled = scale < 1;
        context.fillStyle = "#000";
        context.fillRect(0, 0, picture.width, picture.height);
        for (const canvas of canvases) {
            context.drawImage(canvas, 0, 0, picture.width, picture.height);
        }
        currentProject.thumbnail = picture.toDataURL("image/png");
        saveProjectList();
    } catch (error) {}
}

// "5 minutes ago", "yesterday", and so on
function timeAgo(time) {
    const seconds = (Date.now() - time) / 1000;
    if (seconds < 60) {
        return "just now";
    }
    const units = [["minute", 60], ["hour", 3600], ["day", 86400], ["week", 604800], ["month", 2592000], ["year", 31536000]];
    let [unit, size] = units[0];
    for (const [name, length] of units) {
        if (seconds >= length) {
            [unit, size] = [name, length];
        }
    }
    const count = Math.floor(seconds / size);
    return count === 1 ? (unit === "day" ? "yesterday" : "1 " + unit + " ago") : count + " " + unit + "s ago";
}

const projectDialog = root.querySelector(".pg-project-dialog");

function renderProjects() {
    const list = projectDialog.querySelector(".pg-project-list");
    list.innerHTML = "";
    for (const project of [...projects].sort((a, b) => b.updated - a.updated)) {
        const isOpen = project === currentProject && !viewingShared;
        const card = document.createElement("div");
        card.className = "pg-project-card" + (isOpen ? " open" : "");
        // The picture and the name both open the project. The name is its own button, so Rename can swap it for a text box.
        card.innerHTML = `
            <button class="pg-project-open pg-project-picture" title="Open ${docsEscape(project.name)}" tabindex="-1">
                <span class="pg-template-picture">${project.thumbnail
                    ? `<img src="${project.thumbnail}" alt="">`
                    : `<span class="pg-template-blank">{ }</span>`}</span>
            </button>
            <span class="pg-project-info">
                <button class="pg-project-open pg-project-name" title="Open ${docsEscape(project.name)}">${docsEscape(project.name)}</button>
                <span class="pg-project-edited">${isOpen ? "Open now · " : ""}Edited ${timeAgo(project.updated)}</span>
            </span>
            <span class="pg-project-buttons">
                <button data-action="rename">Rename</button>
                <button data-action="duplicate">Duplicate</button>
                <button data-action="delete">Delete</button>
            </span>`;
        for (const button of card.querySelectorAll(".pg-project-open")) {
            button.addEventListener("click", async () => {
                projectDialog.close();
                if (!isOpen) {
                    leaveShared();
                    await openProject(project);
                    run();
                }
            });
        }
        card.querySelector('[data-action="rename"]').addEventListener("click", () => renameInPlace(card, project));
        card.querySelector('[data-action="duplicate"]').addEventListener("click", async () => {
            const copy = {id: newProjectId(), name: freeName(project.name + " copy"), updated: Date.now(), thumbnail: project.thumbnail};
            try {
                localStorage.setItem(codeKeyFor(copy.id), localStorage.getItem(codeKeyFor(project.id)) ?? defaultCode);
            } catch (error) {}
            await saveProjectFiles(copy.id, await loadSavedAssets(project.id));
            projects.push(copy);
            saveProjectList();
            renderProjects();
        });
        card.querySelector('[data-action="delete"]').addEventListener("click", async () => {
            const sure = await ask({
                title: `Delete "${project.name}"?`,
                text: "Its code and files will be gone for good.",
                ok: "Delete",
                danger: true,
            });
            if (!sure) {
                return;
            }
            projects = projects.filter(p => p !== project);
            try {
                localStorage.removeItem(codeKeyFor(project.id));
            } catch (error) {}
            await saveProjectFiles(project.id, []);
            if (project === currentProject) {
                if (projects.length === 0) {
                    currentProject = null;
                    await makeProject("My project", defaultCode);
                } else {
                    await openProject(mostRecentProject());
                    run();
                }
            }
            saveProjectList();
            renderProjects();
        });
        list.appendChild(card);
    }
}

// Turns a project's name on its card into a text box. Enter or clicking away saves it, and Escape puts it back.
function renameInPlace(card, project) {
    const nameButton = card.querySelector(".pg-project-name");
    const input = document.createElement("input");
    input.className = "pg-project-name-input";
    input.value = project.name;
    input.setAttribute("aria-label", "Project name");
    input.maxLength = 80;
    nameButton.replaceWith(input);
    input.focus();
    input.select();

    let done = false;
    const finish = save => {
        if (done) {
            return;
        }
        done = true;
        const name = input.value.trim();
        if (save && name && name !== project.name) {
            project.name = name;
            saveProjectList();
            showProjectName();
        }
        renderProjects();
    };
    input.addEventListener("keydown", e => {
        if (e.key === "Enter") {
            e.preventDefault();
            finish(true);
        } else if (e.key === "Escape") {
            // Only stops renaming. Without this, Escape would close the whole list too.
            e.preventDefault();
            e.stopPropagation();
            finish(false);
        }
    });
    input.addEventListener("blur", () => finish(true));
}

function setUpProjects() {
    root.querySelector(".pg-project").addEventListener("click", () => {
        renderProjects();
        projectDialog.showModal();
        projectDialog.focus();
    });
    projectDialog.querySelector(".pg-dialog-close").addEventListener("click", () => projectDialog.close());
    projectDialog.addEventListener("click", e => {
        if (e.target === projectDialog) {
            projectDialog.close();
        }
    });
    projectDialog.querySelector(".pg-new-project").addEventListener("click", async () => {
        projectDialog.close();
        leaveShared();
        await makeProject(freeName("Untitled"), blankCode);
        notify("Made a new project.", {
            label: "Start from a template",
            run: () => {
                templateDialog.showModal();
                templateDialog.focus();
            },
        });
    });
}

// Asks a question in a box over the playground, instead of the browser's own popup. Gives back true if the person
// pressed the OK button, or false for Cancel, Escape, or clicking outside the box. cancel: null leaves out the Cancel
// button, for messages that only need an OK. danger makes the OK button red, for things that can't be undone.
const askDialog = root.querySelector(".pg-ask-dialog");

function ask({title, text, ok = "OK", cancel = "Cancel", danger = false}) {
    askDialog.querySelector(".pg-ask-title").textContent = title;
    askDialog.querySelector(".pg-ask-text").textContent = text;
    const okButton = askDialog.querySelector(".pg-ask-ok");
    const cancelButton = askDialog.querySelector(".pg-ask-cancel");
    okButton.textContent = ok;
    okButton.classList.toggle("danger", danger);
    cancelButton.hidden = cancel === null;
    cancelButton.textContent = cancel ?? "";

    return new Promise(resolve => {
        let answer = false;
        const answerWith = value => () => {
            answer = value;
            askDialog.close();
        };
        const onOk = answerWith(true);
        const onCancel = answerWith(false);
        const onOutside = e => {
            if (e.target === askDialog) {
                askDialog.close();
            }
        };
        okButton.addEventListener("click", onOk);
        cancelButton.addEventListener("click", onCancel);
        askDialog.addEventListener("click", onOutside);
        askDialog.addEventListener("close", () => {
            okButton.removeEventListener("click", onOk);
            cancelButton.removeEventListener("click", onCancel);
            askDialog.removeEventListener("click", onOutside);
            resolve(answer);
        }, {once: true});

        askDialog.showModal();
        // For things that can't be undone, Enter doesn't do them by accident
        (danger && cancel !== null ? cancelButton : okButton).focus();
    });
}

// A message at the bottom of the screen for a few seconds. action is an optional button, like {label: "Undo", run}.
let notice = null;
function notify(message, action) {
    notice?.remove();
    notice = document.createElement("div");
    notice.className = "pg-notice";
    notice.setAttribute("role", "status");
    notice.textContent = message;
    const shown = notice;
    if (action) {
        const button = document.createElement("button");
        button.textContent = action.label;
        button.addEventListener("click", () => {
            shown.remove();
            action.run();
        });
        notice.appendChild(button);
    }
    document.body.appendChild(notice);
    setTimeout(() => shown.remove(), (action ? 6000 : 1500) + message.length * 40);
}

// ===== Templates =====

const templateDialog = root.querySelector(".pg-template-dialog");

function setUpTemplates() {
    const list = templateDialog.querySelector(".pg-template-list");
    for (const template of templates) {
        const card = document.createElement("button");
        card.className = "pg-template-card";
        card.innerHTML = `
            <span class="pg-template-picture">${template.id === "blank"
                ? `<span class="pg-template-blank">{ }</span>`
                : `<img src="assets/templates/${template.id}.png" alt="" loading="lazy">`}</span>
            <span class="pg-template-name">${docsEscape(template.name)}</span>
            <span class="pg-template-description">${docsEscape(template.description)}</span>`;
        card.addEventListener("click", () => useTemplate(template));
        list.appendChild(card);
    }
    root.querySelector(".pg-templates").addEventListener("click", () => {
        templateDialog.showModal();
        // Focus the box itself, instead of its first button
        templateDialog.focus();
    });
    templateDialog.querySelector(".pg-dialog-close").addEventListener("click", () => templateDialog.close());
    // Clicking outside the box closes it
    templateDialog.addEventListener("click", e => {
        if (e.target === templateDialog) {
            templateDialog.close();
        }
    });
}

async function useTemplate(template) {
    let code;
    try {
        code = await template.code();
    } catch (error) {
        notify("That template couldn't be loaded.");
        return;
    }
    templateDialog.close();
    // Replacing the code is one change in the editor's history, so Undo puts the old code back
    setCode(code, true);
    saveCode(false);
    run();
    notify(`Loaded "${template.name}".`, {
        label: "Undo",
        run: () => {
            undo(editor);
            variables = findVariables(getCode());
            run();
        },
    });
}

// ===== Starting up =====

function setUpControls() {
    setUpTemplates();
    setUpProjects();

    root.querySelector(".pg-run").addEventListener("click", () => run(true));

    const autorun = root.querySelector(".pg-autorun input");
    try {
        autorun.checked = localStorage.getItem(autorunKey) === "true";
    } catch (error) {}
    autorun.addEventListener("change", () => {
        try {
            localStorage.setItem(autorunKey, autorun.checked);
        } catch (error) {}
    });

    for (const button of root.querySelectorAll(".pg-views button")) {
        button.addEventListener("click", () => setView(button.dataset.view));
    }
    for (const button of root.querySelectorAll(".pg-panel-tabs [data-panel]")) {
        button.addEventListener("click", () => showPanel(button.dataset.panel));
    }
    root.querySelector(".pg-clear-console").addEventListener("click", clearConsole);
    setUpGameControls();
    setUpWatch();

    setUpSharing();
    root.querySelector(".pg-export").addEventListener("click", exportProject);
    const importInput = root.querySelector(".pg-import-file");
    root.querySelector(".pg-import").addEventListener("click", () => importInput.click());
    importInput.addEventListener("change", () => {
        if (importInput.files[0]) {
            importFile(importInput.files[0]);
        }
        importInput.value = "";
    });

    // Adding files: the button, or dropping them anywhere on the playground. Dropping an exported .html imports it.
    const fileInput = root.querySelector(".pg-drop input");
    fileInput.addEventListener("change", () => {
        addFiles([...fileInput.files]);
        fileInput.value = "";
    });
    root.addEventListener("dragover", e => {
        e.preventDefault();
        root.classList.add("dragging");
    });
    root.addEventListener("dragleave", e => {
        if (!root.contains(e.relatedTarget)) {
            root.classList.remove("dragging");
        }
    });
    root.addEventListener("drop", e => {
        e.preventDefault();
        root.classList.remove("dragging");
        const files = [...e.dataTransfer.files];
        const html = files.find(f => /\.html?$/i.test(f.name));
        if (html) {
            importFile(html);
        } else if (files.length > 0) {
            addFiles(files);
        }
    });

    root.querySelector(".pg-keep-shared").addEventListener("click", async () => {
        const code = getCode();
        const files = assets;
        leaveShared();
        const project = await makeProject(freeName("Shared project"), code, files);
        notify(`Saved as "${project.name}". Rename it from the project button at the top.`);
    });
    root.querySelector(".pg-back-to-mine").addEventListener("click", async () => {
        leaveShared();
        await loadOwnProject();
        run();
    });
    window.addEventListener("hashchange", async () => {
        if (await openSharedLink()) {
            run();
        }
    });
}

buildModel();
renderBuiltInAssets();
setUpControls();
setUpDividers();

let startView = "split";
try {
    startView = localStorage.getItem(viewKey) ?? "split";
} catch (error) {}
setView(startView);

await loadProjects();
if (!(await openSharedLink())) {
    await loadOwnProject();
}
savedLabel.textContent = "";
run();
