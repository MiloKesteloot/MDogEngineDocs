// Builds the method tables on each page, and has a few helpers the other docs scripts share.
//
// Put a script tag where a table should go, and call methodsTable with a list of methods:
//
// <script>
//     methodsTable([
//         {
//             name: "circle",
//             description: "Draws a circle.",
//             details: "Draws a circle using a distance method.",
//             parameters: [
//                 ["x, y", "The integer center of the drawn circle."],
//                 ["button?", "Names ending in ? are shown as optional."],
//             ],
//             settings: [
//                 ["layer", "An integer defining the canvas to draw to.", "0"],
//             ],
//             returns: "What the method gives back.",
//         },
//     ]);
// </script>
//
// Everything but name and description is optional. Strings can contain HTML.
// A method with no details, parameters, settings, returns, or demo gets a row without a dropdown.
//
// A method can also have a demo, which shows up in its dropdown as code people can edit and run (see demo() below):
//             demo: {code: `...`, keys: ["ArrowLeft", "ArrowRight"]},
//
// If the methods belong to a class, pass the class name second, like methodsTable([...], "Vector").
// It's used for the method's link (math.html#Vector.add) and in search results.
// Constructors are named like "new Vector", and get links like math.html#new-Vector.
//
// After changing any methods or headings, run "node build-index.js" so search and cross-links know about them.

// The MDog Engine version the docs are for. The demos run it, and "View engine code" shows its code.
// When a new version is tagged, change it here and in the import lines in the pages, then run "node build-index.js".
const docsEngineVersion = "v1.4.0";
const docsEngineBaseURL = "https://cdn.jsdelivr.net/gh/MiloKesteloot/MDogEngine@" + docsEngineVersion + "/";

// Every method table on this page adds its methods here, for search and cross-links
const docsPageEntries = [];

// GitHub Pages serves draw.html at /draw, so links there leave off ".html". Most local servers (like Live Server)
// don't, so ".html" stays when testing locally. If the docs move to a custom domain, add it here.
const docsCleanUrls = window.location.hostname.endsWith(".github.io");

// The link to a page, like "draw" on GitHub Pages or "draw.html" locally
function docsPageHref(page) {
    if (!docsCleanUrls) {
        return page;
    }
    return page === "index.html" ? "./" : page.replace(/\.html$/, "");
}

// The page we're on, always as a file name like "draw.html", whether the URL has ".html" or not
function docsCurrentPage() {
    const last = decodeURIComponent(window.location.pathname.split("/").pop());
    if (last === "") {
        return "index.html";
    }
    return last.includes(".") ? last : last + ".html";
}

// If someone comes in on a ".html" address on GitHub Pages, show the clean one instead
if (docsCleanUrls && window.location.pathname.endsWith(".html")) {
    const path = window.location.pathname.replace(/(^|\/)index\.html$/, "$1").replace(/\.html$/, "");
    history.replaceState(null, "", path + window.location.search + window.location.hash);
}

// Turns heading text into an id, like "Mouse Info Methods" into "mouse-info-methods"
function docsSlugify(text) {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// Turns HTML into plain text
function docsStripTags(html) {
    return html.replace(/<[^>]*>/g, "")
        .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&amp;/g, "&");
}

const docsLinkIcon = `<svg class="icon" viewBox="0 0 640 512" style="width: 1.25em"><path d="M579.8 267.7c56.5-56.5 56.5-148 0-204.5c-50-50-128.8-56.5-186.3-15.4l-1.6 1.1c-14.4 10.3-17.7 30.3-7.4 44.6s30.3 17.7 44.6 7.4l1.6-1.1c32.1-22.9 76-19.3 103.8 8.6c31.5 31.5 31.5 82.5 0 114L422.3 334.8c-31.5 31.5-82.5 31.5-114 0c-27.9-27.9-31.5-71.8-8.6-103.8l1.1-1.6c10.3-14.4 6.9-34.4-7.4-44.6s-34.4-6.9-44.6 7.4l-1.1 1.6C206.5 251.2 213 330 263 380c56.5 56.5 148 56.5 204.5 0L579.8 267.7zM60.2 244.3c-56.5 56.5-56.5 148 0 204.5c50 50 128.8 56.5 186.3 15.4l1.6-1.1c14.4-10.3 17.7-30.3 7.4-44.6s-30.3-17.7-44.6-7.4l-1.6 1.1c-32.1 22.9-76 19.3-103.8-8.6C74 372 74 321 105.5 289.5L217.7 177.2c31.5-31.5 82.5-31.5 114 0c27.9 27.9 31.5 71.8 8.6 103.9l-1.1 1.6c-10.3 14.4-6.9 34.4 7.4 44.6s34.4 6.9 44.6-7.4l1.1-1.6C433.5 260.8 427 182 377 132c-56.5-56.5-148-56.5-204.5 0L60.2 244.3z"/></svg>`;

class MethodsGrid {

    methods = [];

    constructor(methods, owner) {
        this.methods = methods.map(method => new Method(method, owner));
    }

    generateHTML() {
        let s = `<table class="methods-grid">
                    <tr>
                        <th>Method</th>
                        <th>Description</th>
                    </tr>`;

        for (let i = 0; i < this.methods.length; i++) {
            s += this.methods[i].generateHTML();
        }

        s += `</table>`;

        return s;
    }
}

class Method {

    name;
    owner;
    description;
    details;
    parameters = [];
    settings = [];
    returns;
    demo;

    constructor(data, owner) {
        this.name = data.name;
        this.owner = owner;
        this.description = data.description;
        this.details = data.details;
        this.parameters = (data.parameters ?? []).map(p => new Parameter(p[0], p[1]));
        this.settings = (data.settings ?? []).map(s => new Setting(s[0], s[1], s[2]));
        this.returns = data.returns;
        this.demo = data.demo;
    }

    // The class this constructs, if this is a constructor like "new Vector"
    constructs() {
        return this.name.startsWith("new ") ? this.name.slice(4) : null;
    }

    getId() {
        if (this.constructs()) {
            return "new-" + this.constructs();
        }
        return this.owner ? this.owner + "." + this.name : this.name;
    }

    // The name shown in search results, like "Vector.add()"
    getTitle() {
        if (this.constructs()) {
            return this.name + "()";
        }
        return (this.owner ? this.owner + "." : "") + this.name + "()";
    }

    getEntry() {
        // Parameter names for the playground's autofill, like ["x", "y", "radius", "color", "settings?"]
        const params = this.parameters.flatMap(p => p.names.map(n => n.optional ? n.name + "?" : n.name));
        if (this.settings.length > 0) {
            params.push("settings?");
        }
        return {
            kind: "method",
            id: this.getId(),
            title: this.getTitle(),
            name: this.name,
            owner: this.owner ?? null,
            constructs: this.constructs(),
            description: docsStripTags(this.description),
            params: params,
        };
    }

    hasDropdown() {
        return this.details !== undefined ||
            this.parameters.length > 0 ||
            this.settings.length > 0 ||
            this.returns !== undefined ||
            this.demo !== undefined ||
            this.getSource() !== null;
    }

    // Where this method's code is in the engine, from docs-index.js (made by build-index.js), or null
    getSource() {
        if (typeof docsIndex === "undefined") {
            return null;
        }
        const page = docsCurrentPage();
        const id = this.getId();
        return docsIndex.find(entry => entry.page === page && entry.id === id)?.source ?? null;
    }

    generateSignature() {
        let p = this.parameters.map(parameter => parameter.generatePeram());

        if (this.settings.length !== 0) {
            p.push(`<span class="optional">settings</span>`);
        }

        return `<code>${this.name}(${p.join(", ")})</code>`;
    }

    generateLink() {
        return `<a class="method-link" href="#${this.getId()}" title="Copy link">${docsLinkIcon}</a>`;
    }

    generateHTML() {

        if (!this.hasDropdown()) {
            // The empty row keeps the table stripes lined up with the rows that do have dropdowns
            return `
                    <tr class="no-dropdown" id="${this.getId()}">
                        <td>${this.generateSignature()}${this.generateLink()}</td>
                        <td>${this.description}</td>
                    </tr>
                    <tr class="dropdown-tr"></tr>`;
        }

        let s = `
                    <tr class="has-dropdown" id="${this.getId()}">
                        <td>
                            <label>
                            <input type="checkbox">
                            ${this.generateSignature()}
                            </label>
                            ${this.generateLink()}
                        </td>
                        <td>${this.description}</td>
                    </tr>`;

        let sections = [];

        if (this.details !== undefined) {
            sections.push(this.details + `<br>`);
        }

        if (this.parameters.length > 0) {
            let section = `<b>Parameters:</b><br>`;
            for (let i = 0; i < this.parameters.length; i++) {
                section += this.parameters[i].generateHTML() + `<br>`;
            }
            sections.push(section);
        }

        if (this.settings.length > 0) {
            let section = `<b>Settings (optional):</b><br>`;
            for (let i = 0; i < this.settings.length; i++) {
                section += this.settings[i].generateHTML() + `<br>`;
            }
            sections.push(section);
        }

        if (this.returns !== undefined) {
            sections.push(`<b>Returns:</b> ${this.returns}<br>`);
        }

        if (this.demo !== undefined) {
            sections.push(`<b>Try it:</b>` + docsDemoHTML(this.demo));
        }

        // The engine's own code for this method. It's loaded when it's opened (see page.js).
        const source = this.getSource();
        if (source !== null) {
            sections.push(`<details class="method-source" data-file="${source.file}" data-start="${source.start}" data-end="${source.end}">` +
                `<summary>View engine code</summary><div class="method-source-body"></div></details>`);
        }

        s += `
                    <tr class="dropdown-tr">
                        <td colspan="2" class="method-info">
                            ${sections.join(`<br>`)}
                        </td>
                    </tr>`;

        return s;
    }
}

class Parameter {

    names = [];
    description;

    // name can be a comma separated list like "x, y", and each name ends with "?" if it's optional
    constructor(name, description) {
        for (let n of name.split(",")) {
            n = n.trim();
            const optional = n.endsWith("?");
            if (optional) {
                n = n.slice(0, -1);
            }
            this.names.push({name: n, optional: optional});
        }
        this.description = description;
    }

    generatePeram() {
        return this.names.map(n => n.optional ? `<span class="optional">${n.name}</span>` : n.name).join(", ");
    }

    generateHTML() {
        const names = this.names.map(n => `<code class="outline">${n.name}</code>`).join(", ");
        const optional = this.names.every(n => n.optional) ? " (optional)" : "";
        return `${names}${optional}: ${this.description}`;
    }
}

class Setting {

    name;
    description;
    def;

    constructor(name, description, def) {
        this.name = name;
        this.description = description;
        this.def = def;
    }

    generateHTML() {
        let s = `<code class="outline">${this.name}</code> - ${this.description}`;
        if (this.def !== undefined) {
            s += ` Default: <code>${this.def}</code>.`;
        }
        return s;
    }
}

// Demos run MDog Engine code in a little game screen on the page. demos.js makes them work.
//
// <script>
//     demo({
//         code: `
//             function main() {
//                 MDog.Draw.clear();
//                 MDog.Draw.circle(80, 60, 20, "#ff5566");
//             }
//             MDog.setActiveFunction(main);
//         `,
//         keys: ["ArrowLeft", "ArrowRight"],
//     });
// </script>
//
// code: The code to run. MDog is already imported, and the screen is set to width by height. People can edit it.
// keys (optional): The keys the demo uses, like "ArrowLeft" or " ". Phones get buttons for them.
// width, height (optional): The screen size in art pixels. Default: 160 by 120.
// source (optional): Instead of code, a CSS selector for a <pre> with a whole game in it, import line and all.
//                    That's run as it is, without an editor, so the code shown and the code running are the same.
function docsDemoHTML(options) {
    const width = options.width ?? 160;
    const height = options.height ?? 120;
    const keys = options.keys ?? [];
    const code = options.code !== undefined ? docsDedent(options.code) : null;

    let html = `<div class="demo" data-width="${width}" data-height="${height}" data-keys="${docsEscape(JSON.stringify(keys))}"` +
        (options.source ? ` data-source="${docsEscape(options.source)}"` : "") + `>` +
        `<div class="demo-screen" style="aspect-ratio: ${width} / ${height}; max-width: ${Math.max(480, width)}px">` +
        `<button class="demo-start"><span>Click to run</span></button>` +
        `</div>` +
        `<div class="demo-touch-keys"></div>`;

    if (options.source) {
        html += `<div class="demo-bar">` +
            `<button class="demo-open" title="Open this code in the Playground in a new tab">Open in Playground</button>` +
            `</div>`;
    }

    if (code !== null) {
        html += `<div class="demo-editor">` +
            `<textarea class="demo-code" spellcheck="false" autocapitalize="off" autocomplete="off" rows="${code.split("\n").length}">${docsEscape(code)}</textarea>` +
            `<div class="demo-bar">` +
            `<button class="demo-run">Run</button>` +
            `<button class="demo-reset">Reset code</button>` +
            `<button class="demo-open" title="Open this code in the Playground in a new tab">Open in Playground</button>` +
            `<span class="demo-hint">Edit the code, then press Run or Ctrl+Enter</span>` +
            `</div>` +
            `<div class="demo-error"></div>` +
            `</div>`;
    }

    return html + `</div>`;
}

// Inserts a demo right where the calling script tag is
function demo(options) {
    document.currentScript.insertAdjacentHTML("beforebegin", docsDemoHTML(options));
}

// Takes off the indent that every line of a template string has, and the blank lines at the start and end
function docsDedent(text) {
    const lines = text.replace(/\t/g, "    ").split("\n");
    while (lines.length > 0 && lines[0].trim() === "") {
        lines.shift();
    }
    while (lines.length > 0 && lines[lines.length - 1].trim() === "") {
        lines.pop();
    }
    const indent = Math.min(...lines.filter(l => l.trim() !== "").map(l => l.match(/^ */)[0].length));
    return lines.map(l => l.slice(indent)).join("\n");
}

function docsEscape(text) {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ===== Playground links =====
// A playground project ({code, assets}) is squeezed into the part of a link after the #, like playground.html#p=...
// It's compressed with the browser's built-in compression, then written as letters and numbers that are safe in a link.
// The part after # is never sent to a server, so this works on any plain website.

async function docsEncodeProject(project) {
    const bytes = new TextEncoder().encode(JSON.stringify(project));
    const compressed = await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate-raw"))).arrayBuffer();
    let binary = "";
    for (const byte of new Uint8Array(compressed)) {
        binary += String.fromCharCode(byte);
    }
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function docsDecodeProject(text) {
    const binary = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
    const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
    const json = await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).text();
    return JSON.parse(json);
}

// The link that opens a project in the playground
async function docsPlaygroundLink(project) {
    return docsPageHref("playground.html") + "#p=" + await docsEncodeProject(project);
}

// Inserts a methods table right where the calling script tag is
function methodsTable(methods, owner) {
    const grid = new MethodsGrid(methods, owner);
    for (const method of grid.methods) {
        docsPageEntries.push(method.getEntry());
    }
    document.currentScript.insertAdjacentHTML("beforebegin", grid.generateHTML());
}
