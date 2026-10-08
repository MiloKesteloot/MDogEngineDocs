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
import {keymap} from "https://esm.sh/@codemirror/view@^6.0.0";
import {EditorState} from "https://esm.sh/@codemirror/state@^6.0.0";
import {indentWithTab} from "https://esm.sh/@codemirror/commands@^6.0.0";
import {javascript, javascriptLanguage} from "https://esm.sh/@codemirror/lang-javascript@^6.0.0";
import {HighlightStyle, syntaxHighlighting, indentUnit} from "https://esm.sh/@codemirror/language@^6.0.0";
import {tags} from "https://esm.sh/@lezer/highlight@^1.0.0";

const engineURL = docsEngineBaseURL + "MDogModules/MDogMain.js";
const engineImport = `import MDog from "${engineURL}";`;
const codeKey = "mdog-playground-code";
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
const templates = [
    {name: "Blank", code: async () => blankCode},
    {name: "Moving square", code: async () => defaultCode},
    {name: "Tutorial: Warrior platformer", code: () => tutorialStepCode(6)},
    {name: "Example: Platformer", code: () => pageCode("example-platformer.html", "#example-code")},
    {name: "Example: Particles", code: () => pageCode("example-particles.html", "#example-code")},
    {name: "Example: Title Screen", code: () => pageCode("example-title-screen.html", "#example-code")},
    {name: "Example: Pseudo-3D Road", code: () => pageCode("example-road.html", "#example-code")},
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

// True while looking at a shared link. Nothing is saved then, so the person's own project isn't overwritten.
let viewingShared = false;

// ===== Files people add (assets) =====
// Each is {name, type, blob, url}. They're saved in IndexedDB, which can hold files, unlike localStorage.

let assets = [];

const database = new Promise(resolve => {
    try {
        const request = indexedDB.open("mdog-playground", 1);
        request.onupgradeneeded = () => request.result.createObjectStore("assets", {keyPath: "name"});
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(null);
    } catch (error) {
        // Some private windows don't allow IndexedDB, so files just aren't saved there
        resolve(null);
    }
});

async function loadSavedAssets() {
    const db = await database;
    if (!db) {
        return [];
    }
    return new Promise(resolve => {
        const request = db.transaction("assets").objectStore("assets").getAll();
        request.onsuccess = () => resolve(request.result.map(a => ({...a, url: URL.createObjectURL(a.blob)})));
        request.onerror = () => resolve([]);
    });
}

async function saveAssets() {
    if (viewingShared) {
        return;
    }
    const db = await database;
    if (!db) {
        return;
    }
    const store = db.transaction("assets", "readwrite").objectStore("assets");
    store.clear();
    for (const asset of assets) {
        store.put({name: asset.name, type: asset.type, blob: asset.blob});
    }
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

function renderAssets() {
    root.querySelector(".pg-assets-count").textContent = assets.length ? "(" + assets.length + ")" : "";
    assetList.innerHTML = "";
    for (const asset of assets) {
        const item = document.createElement("div");
        item.className = "pg-asset";
        item.innerHTML = `
            <span class="pg-asset-thumb">${isImage(asset.name) ? `<img src="${asset.url}" alt="">` : "📄"}</span>
            <span class="pg-asset-text">
                <button class="pg-asset-name" title="Copy a line of code that uses this">${docsEscape(asset.name)}</button>
                <span class="pg-asset-size">${formatSize(asset.blob.size)}</span>
            </span>
            <span class="pg-asset-buttons">
                <button data-action="rename">Rename</button>
                <a href="${asset.url}" download="${docsEscape(asset.name)}">Download</a>
                <button data-action="delete">Delete</button>
            </span>`;
        item.querySelector(".pg-asset-name").addEventListener("click", e => {
            copyText(assetUsage(asset.name));
            notify("Copied " + assetUsage(asset.name));
        });
        item.querySelector('[data-action="rename"]').addEventListener("click", async () => {
            const name = prompt("New name for " + asset.name, asset.name);
            if (name && name.trim() && name !== asset.name) {
                asset.name = name.trim();
                renderAssets();
                await saveAssets();
            }
        });
        item.querySelector('[data-action="delete"]').addEventListener("click", async () => {
            if (confirm("Delete " + asset.name + "?")) {
                URL.revokeObjectURL(asset.url);
                assets = assets.filter(a => a !== asset);
                renderAssets();
                await saveAssets();
            }
        });
        assetList.appendChild(item);
    }
}

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
}, {dark: true});

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
            EditorState.tabSize.of(4),
            indentUnit.of("    "),
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
            }),
        ],
    }),
});

function getCode() {
    return editor.state.doc.toString();
}

function setCode(code) {
    editor.dispatch({changes: {from: 0, to: editor.state.doc.length, insert: code}});
    variables = findVariables(code);
}

function codeChanged() {
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
    try {
        localStorage.setItem(codeKey, getCode());
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
    const code = getCode();
    variables = findVariables(code);

    // If the code doesn't import MDog Engine, the import is added for it
    const addImport = !/import\s+MDog\s+from/.test(code);
    const userCode = (addImport ? engineImport + "\n" : "") + code;
    const engine = userCode.match(/import\s+MDog\s+from\s+["']([^"']+)["']/)?.[1] ?? engineURL;

    // Load every image before the game starts, so nothing flickers in. Added files are used instead of built-in ones.
    const assetURLs = {};
    for (const asset of assets) {
        assetURLs[asset.name] = asset.url;
    }
    const builtInImages = (await findDemoImages(code)).filter(name => !(name in assetURLs));
    const images = [...assets.filter(a => isImage(a.name)).map(a => a.name), ...builtInImages];

    let script = `import playgroundMDog from "${engine}"; await playgroundPreload(playgroundMDog);\n` + userCode;
    // A </script> in the code would end the script early
    script = script.replace(/<\/script/gi, "<\\/script");

    const before = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>html, body { margin: 0; height: 100%; overflow: hidden; background: #000; }</style>
<script>
${frameHelpers(assetURLs, images)}
<\/script>
</head>
<body>
<script type="module">
`;
    // Errors give line numbers in this whole page, so remember where the code in the editor starts
    codeOffset = before.split("\n").length - 1 + 1 + (addImport ? 1 : 0);

    gameFrame?.remove();
    root.querySelector(".pg-coords")?.remove();
    gameFrame = document.createElement("iframe");
    gameFrame.className = "pg-frame";
    gameFrame.title = "Your game";
    gameFrame.srcdoc = before + script + "\n<\/script>\n</body>\n</html>";
    gameFrame.addEventListener("load", () => {
        gameFrame.focus();
        gameFrame.contentWindow.focus();
        showCoordinates(gameFrame);
    });
    gameBox.appendChild(gameFrame);
    gameBox.classList.add("running");

    // On small screens the code and game don't fit side by side, so pressing Run shows the game
    if (showGame === true && isNarrow() && main.dataset.view === "code") {
        setView("game");
    }
}

// The code that runs in the game's page before the game does:
//  - Added files are used in place of "assets/..." for images and loadFile()
//  - console.log() and errors are sent to the playground's console. Messages from the engine itself, like
//    "Created MDog instance.", are left out, since they aren't the game's.
//  - Images are loaded before the game starts (playgroundPreload)
function frameHelpers(assetURLs, images) {
    return `
const playgroundAssets = ${JSON.stringify(assetURLs)};
const playgroundImages = ${JSON.stringify(images)};
const toPlayground = message => parent.postMessage({playground: message}, "*");

function playgroundAsset(url) {
    const match = String(url).match(/^(?:\\.\\/)?assets\\/(.+)$/);
    return match && playgroundAssets[match[1]] ? playgroundAssets[match[1]] : url;
}

const imageSrc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "src");
Object.defineProperty(HTMLImageElement.prototype, "src", {
    configurable: true,
    get: imageSrc.get,
    set(value) {
        const match = String(value).match(/^(?:\\.\\/)?assets\\/(.+)$/);
        if (match) {
            this.addEventListener("error", () => toPlayground({level: "warn",
                text: 'Couldn\\'t load the image "' + match[1] + '". Check that it\\'s added in the Assets tab, and that the name matches exactly, capital letters too.'}), {once: true});
        }
        imageSrc.set.call(this, playgroundAsset(value));
    },
});

const realFetch = window.fetch.bind(window);
window.fetch = async (input, options) => {
    const url = typeof input === "string" ? input : input.url;
    const response = await realFetch(typeof input === "string" ? playgroundAsset(input) : input, options);
    const match = String(url).match(/^(?:\\.\\/)?assets\\/(.+)$/);
    if (match && !response.ok) {
        toPlayground({level: "warn", text: 'Couldn\\'t load the file "' + match[1] + '". Check that it\\'s added in the Assets tab.'});
    }
    return response;
};

function playgroundFormat(value) {
    if (typeof value === "string") {
        return value;
    }
    if (value instanceof Error) {
        return value.name + ": " + value.message;
    }
    if (value && typeof value === "object") {
        // Things like Vectors have their own toString(), like "(3, 4)"
        if (value.toString !== Object.prototype.toString && !Array.isArray(value)) {
            return String(value);
        }
        try {
            const seen = new WeakSet();
            const text = JSON.stringify(value, (key, inner) => {
                if (inner && typeof inner === "object") {
                    if (seen.has(inner)) {
                        return "[circular]";
                    }
                    seen.add(inner);
                }
                return inner;
            });
            return text.length > 500 ? text.slice(0, 500) + "..." : text;
        } catch (error) {
            return String(value);
        }
    }
    return String(value);
}

for (const level of ["log", "info", "warn", "error", "debug"]) {
    const original = console[level].bind(console);
    console[level] = (...args) => {
        const fromEngine = /MDogEngine@/.test((new Error().stack ?? "").split("\\n").slice(2, 3).join(""));
        if (!fromEngine) {
            toPlayground({level, text: args.map(playgroundFormat).join(" ")});
        }
        original(...args);
    };
}

window.addEventListener("error", e => toPlayground({level: "error", text: e.message, line: e.filename === location.href ? e.lineno : null}));
window.addEventListener("unhandledrejection", e => toPlayground({level: "error", text: "Uncaught (in promise) " + playgroundFormat(e.reason)}));

window.playgroundPreload = mdog => Promise.race([
    Promise.all(playgroundImages.map(path => new Promise(resolve => {
        const image = mdog.Draw._getImageByName(path);
        if (image.complete) {
            resolve();
        } else {
            image.addEventListener("load", resolve);
            image.addEventListener("error", resolve);
        }
    }))),
    new Promise(resolve => setTimeout(resolve, 5000)),
]);`;
}

// Which art pixel the mouse is on, in the corner of the game
function showCoordinates(frame) {
    const label = document.createElement("div");
    label.className = "pg-coords";
    label.hidden = true;
    gameBox.appendChild(label);
    const gameWindow = frame.contentWindow;
    gameWindow.addEventListener("mousemove", e => {
        const canvas = gameWindow.document.querySelector("canvas");
        if (!canvas) {
            return;
        }
        const rect = canvas.getBoundingClientRect();
        const x = Math.floor((e.clientX - rect.left) / rect.width * canvas.width);
        const y = Math.floor((e.clientY - rect.top) / rect.height * canvas.height);
        label.hidden = !(x >= 0 && y >= 0 && x < canvas.width && y < canvas.height);
        label.textContent = `x ${x}, y ${y}`;
    });
    gameWindow.document.addEventListener("mouseleave", () => label.hidden = true);
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
}

// The lines between the code and game, and between the game and console, can be dragged to resize them. The sizes are
// saved as how much of the space each part takes, so they still fit if the window changes size. Double-click to reset.
function setUpDividers() {
    const gameColumn = root.querySelector(".pg-game-column");
    let sizes = {};
    try {
        sizes = JSON.parse(localStorage.getItem(sizesKey)) ?? {};
    } catch (error) {}

    function apply() {
        // The code's share of the width, written as a grid fraction next to the game's 1fr
        if (sizes.code) {
            main.style.setProperty("--pg-code-width", (sizes.code / (1 - sizes.code)) + "fr");
        } else {
            main.style.removeProperty("--pg-code-width");
        }
        if (sizes.panels) {
            main.style.setProperty("--pg-panels-height", (sizes.panels * 100) + "%");
        } else {
            main.style.removeProperty("--pg-panels-height");
        }
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

async function share(button) {
    const totalSize = assets.reduce((total, a) => total + a.blob.size, 0);
    const includeAssets = totalSize <= maxLinkAssetBytes;
    const project = {code: getCode(), assets: includeAssets ? await assetsToSave(assets) : []};
    const link = new URL(await docsPlaygroundLink(project), window.location.href).href;
    copyText(link);
    if (assets.length > 0 && !includeAssets) {
        notify("Link copied, but your files are too big to fit in a link. Use Export to share them too.");
    } else {
        notify("Link copied");
    }
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
    const project = {version: 1, assets: await assetsToSave([...assets, ...builtIn])};
    // Written so the file can't accidentally end its own script tags
    const projectJSON = JSON.stringify(project).replace(/</g, "\\u003c");
    const safeCode = gameCode.replace(/<\/script/gi, "<\\/script");

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>My MDog Engine Game</title>
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
    link.download = "mdog-game.html";
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 10000);
}

async function importFile(file) {
    const html = await file.text();
    const page = new DOMParser().parseFromString(html, "text/html");
    const gameScript = page.querySelector("script#mdog-game") ?? page.querySelector('script[type="module"]');
    if (!gameScript) {
        alert("That file doesn't have any game code in it. Import opens files made with Export.");
        return;
    }
    if (!confirm("Replace your code and files with the ones in " + file.name + "?")) {
        return;
    }
    let saved = [];
    try {
        saved = JSON.parse(page.querySelector("script#mdog-project")?.textContent ?? "{}").assets ?? [];
    } catch (error) {}

    leaveShared(false);
    setCode(gameScript.textContent.replace(/<\\\/script/gi, "</script").trim() + "\n");
    setAssets(assetsFromSaved(saved));
    saveCode(false);
    await saveAssets();
    run();
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
    if (clearHash) {
        history.replaceState(null, "", window.location.pathname + window.location.search);
    }
}

async function loadOwnProject() {
    let code = null;
    try {
        code = localStorage.getItem(codeKey);
    } catch (error) {}
    setCode(code ?? defaultCode);
    setAssets(await loadSavedAssets());
}

// A message at the bottom of the screen for a few seconds
let notice = null;
function notify(message) {
    notice?.remove();
    notice = document.createElement("div");
    notice.className = "pg-notice";
    notice.setAttribute("role", "status");
    notice.textContent = message;
    document.body.appendChild(notice);
    const shown = notice;
    setTimeout(() => shown.remove(), 1500 + message.length * 40);
}

// ===== Starting up =====

function setUpControls() {
    const templateSelect = root.querySelector(".pg-template");
    for (const [i, template] of templates.entries()) {
        const option = document.createElement("option");
        option.value = i;
        option.textContent = template.name;
        templateSelect.appendChild(option);
    }
    templateSelect.addEventListener("change", async () => {
        const template = templates[templateSelect.value];
        templateSelect.value = "";
        if (!template || !confirm(`Replace your code with "${template.name}"? Your files are kept.`)) {
            return;
        }
        try {
            setCode(await template.code());
            saveCode(false);
            run();
        } catch (error) {
            notify("That template couldn't be loaded.");
        }
    });

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
    root.querySelector(".pg-fullscreen").addEventListener("click", () => gameBox.requestFullscreen?.());

    const shareButton = root.querySelector(".pg-share");
    shareButton.addEventListener("click", () => share(shareButton));
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
        leaveShared();
        saveCode(true);
        await saveAssets();
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
setUpControls();
setUpDividers();

let startView = "split";
try {
    startView = localStorage.getItem(viewKey) ?? "split";
} catch (error) {}
setView(startView);

if (!(await openSharedLink())) {
    await loadOwnProject();
}
savedLabel.textContent = "";
run();
