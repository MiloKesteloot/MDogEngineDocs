// Builds docs-index.js, the list of every page, heading, and method that search, cross-links, and "View engine code" use.
// Run it with "node build-index.js" after changing any methods or headings, or the engine version in build-tables.js.
//
// The pages come from the links in sidebar.js. Each page's method tables are read by running its inline scripts
// with the real build-tables.js, so the index always matches what the page shows.
//
// For "View engine code", the engine is downloaded at the docs' version (docsEngineVersion in build-tables.js), and each
// method is matched to the file and lines its code is on. That needs an internet connection.

const fs = require("fs");
const vm = require("vm");

const buildTables = fs.readFileSync("build-tables.js", "utf8");
const sidebar = fs.readFileSync("sidebar.js", "utf8");

// Any "something.html" in sidebar.js, whether it's in an href or a pageLink()
const pages = [...new Set([...sidebar.matchAll(/"([a-z0-9-]+\.html)"/g)].map(m => m[1]))];

// The class each page's methods belong to when a table doesn't name one, like circle() being on Draw
const pageClasses = {
    "draw.html": "Draw",
    "math.html": "Maths",
    "asset-manager.html": "AssetManager",
    "core.html": "MDog",
};

main();

async function main() {
    const index = [];
    let problems = 0;
    let engineBaseURL = null;

    for (const page of pages) {
        const html = fs.readFileSync(page, "utf8");

        // Run the page's inline scripts to get its method tables
        const context = {
            document: {currentScript: {insertAdjacentHTML() {}}, querySelectorAll: () => []},
            window: {location: {hostname: "localhost", pathname: "/" + page, search: "", hash: ""}},
        };
        vm.createContext(context);
        vm.runInContext(buildTables + "\nthis.docsPageEntries = docsPageEntries; this.docsSlugify = docsSlugify; this.docsStripTags = docsStripTags; this.docsEngineBaseURL = docsEngineBaseURL;", context);
        const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
        vm.runInContext(scripts.join("\n"), context);
        engineBaseURL = context.docsEngineBaseURL;

        const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
        const pageTitle = h1 ? context.docsStripTags(h1[1]).trim() : page;

        // The words under each heading (and under the title, for the page itself), so search can find things that are
        // only in the text, like in the guides. Code and demos are left out, and it's cut short to keep the index small.
        const headings = [...html.matchAll(/<h([23])(\s[^>]*)?>([\s\S]*?)<\/h\1>/g)];
        const end = html.indexOf('<div class="copyright">');
        const textBetween = (from, to) => context.docsStripTags(html.slice(from, to)
            .replace(/<script[\s\S]*?<\/script>/g, " ")
            .replace(/<pre[\s\S]*?<\/pre>/g, " "))
            .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&")
            .replace(/\s+/g, " ").trim().slice(0, 400);
        const h1End = h1 ? h1.index + h1[0].length : 0;
        index.push({page, kind: "page", id: "", title: pageTitle, text: textBetween(h1End, headings[0]?.index ?? end)});

        // Headings get the same ids page.js gives them
        const usedIds = new Set();
        for (const [n, m] of headings.entries()) {
            // The Playground's headings are only in its pop-up boxes, which aren't useful to search for
            if (page === "playground.html") {
                break;
            }
            const title = context.docsStripTags(m[3]).trim();
            const explicitId = (m[2] ?? "").match(/id="([^"]+)"/);
            let id = explicitId ? explicitId[1] : context.docsSlugify(title);
            if (!explicitId) {
                let n = 2;
                const base = id;
                while (usedIds.has(id)) {
                    id = base + "-" + n++;
                }
            }
            usedIds.add(id);
            const text = textBetween(m.index + m[0].length, headings[n + 1]?.index ?? end);
            index.push({page, kind: "heading", id, title, context: pageTitle, text});
        }

        const methodIds = new Set();
        for (const entry of context.docsPageEntries) {
            if (methodIds.has(entry.id)) {
                console.log(`Warning: ${page} has two methods with the id "${entry.id}". Give one of the tables a class name.`);
                problems++;
            }
            methodIds.add(entry.id);
            index.push({page, ...entry, context: pageTitle});
        }
    }

    // Find each method's code in the engine
    let found = 0;
    const missing = [];
    try {
        const classes = findClasses(await downloadEngine(engineBaseURL));
        for (const entry of index) {
            if (entry.kind !== "method") {
                continue;
            }
            const source = findMethodSource(classes, entry);
            if (source) {
                entry.source = source;
                found++;
            } else {
                missing.push(`${entry.page} ${entry.title}`);
            }
        }
    } catch (error) {
        console.log(`Couldn't download the engine for "View engine code", so it's left out: ${error.message}`);
    }

    const lines = index.map(entry => "    " + JSON.stringify(entry) + ",");
    const output = `// Made by build-index.js. Don't edit this by hand, run "node build-index.js" instead.
const docsIndex = [
${lines.join("\n")}
];
`;

    fs.writeFileSync("docs-index.js", output);
    console.log(`Wrote docs-index.js with ${index.length} entries from ${pages.length} pages.` + (problems ? ` ${problems} problem(s) above.` : ""));
    console.log(`Found the engine code for ${found} methods.` + (missing.length ? ` Couldn't find: ${missing.join(", ")}` : ""));
}

// Downloads MDogMain.js and every engine file it imports. Gives back {path: text}, like {"MDogModules/MDogDraw.js": "..."}.
async function downloadEngine(baseURL) {
    const files = {};
    async function download(path) {
        if (path in files) {
            return;
        }
        files[path] = null;
        const response = await fetch(baseURL + path);
        if (!response.ok) {
            throw new Error(`${path} gave ${response.status}`);
        }
        const text = await response.text();
        files[path] = text;
        const imports = [...text.matchAll(/^\s*import\s+(?:[\w*{}\s,]+\s+from\s+)?["']([^"']+)["']/gm)].map(m => m[1]);
        await Promise.all(imports.map(relative => download(new URL(relative, "https://engine/" + path).pathname.slice(1))));
    }
    await download("MDogModules/MDogMain.js");
    return files;
}

// Finds every class in the engine and the lines of each of its methods.
// Gives back a list of {name, extends, file, methods: {methodName: {start, end}}}, with line numbers starting at 1.
function findClasses(files) {
    const classes = [];
    for (const [file, text] of Object.entries(files)) {
        const lines = text.replace(/\r\n/g, "\n").split("\n");
        for (let i = 0; i < lines.length; i++) {
            const classMatch = lines[i].match(/^class\s+(\w+)(?:\s+extends\s+(\w+))?\s*\{/);
            if (!classMatch) {
                continue;
            }
            const classEnd = findBlockEnd(lines, i);
            const methods = {};
            for (let j = i + 1; j < classEnd; j++) {
                // Methods are indented 4 spaces inside a class, like "    circle(x, y, radius, color, settings) {"
                const methodMatch = lines[j].match(/^    (?:static\s+)?(?:async\s+)?([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{/);
                if (!methodMatch || ["if", "for", "while", "switch", "catch"].includes(methodMatch[1])) {
                    continue;
                }
                const end = findBlockEnd(lines, j);
                // Include the comment lines right above the method
                let start = j;
                while (start > 0 && /^\s*\/\//.test(lines[start - 1])) {
                    start--;
                }
                methods[methodMatch[1]] = {start: start + 1, end: end + 1};
                j = end;
            }
            classes.push({name: classMatch[1], extends: classMatch[2] ?? null, file, methods});
            i = classEnd;
        }
    }
    return classes;
}

// The line where the { ... } block starting on startLine closes. Skips braces inside strings and comments.
function findBlockEnd(lines, startLine) {
    let depth = 0;
    let started = false;
    let inBlockComment = false;
    for (let i = startLine; i < lines.length; i++) {
        const line = lines[i];
        let quote = null;
        for (let c = 0; c < line.length; c++) {
            const char = line[c];
            const next = line[c + 1];
            if (inBlockComment) {
                if (char === "*" && next === "/") {
                    inBlockComment = false;
                    c++;
                }
            } else if (quote) {
                if (char === "\\") {
                    c++;
                } else if (char === quote) {
                    quote = null;
                }
            } else if (char === "/" && next === "/") {
                break;
            } else if (char === "/" && next === "*") {
                inBlockComment = true;
                c++;
            } else if (char === "\"" || char === "'" || char === "`") {
                quote = char;
            } else if (char === "{") {
                depth++;
                started = true;
            } else if (char === "}") {
                depth--;
                if (started && depth === 0) {
                    return i;
                }
            }
        }
    }
    return lines.length - 1;
}

// Finds where a documented method's code is. Looks in the method's class first, then classes built on it
// (like getImage(), which is on MultipleFileAnimation, not Animation), then the classes it's built on.
function findMethodSource(classes, entry) {
    const className = entry.constructs ?? entry.owner ?? pageClasses[entry.page];
    const methodName = entry.constructs ? "constructor" : entry.name;
    if (!className) {
        return null;
    }

    // Some class names are used twice (like the empty Maths in MDogFileManager.js), so the one with the most methods wins
    const byName = name => classes.filter(c => c.name === name).sort((a, b) => Object.keys(b.methods).length - Object.keys(a.methods).length);
    const own = byName(className);
    const children = classes.filter(c => c.extends === className);
    const parents = [];
    let parent = own[0]?.extends;
    while (parent) {
        const found = byName(parent)[0];
        if (!found) {
            break;
        }
        parents.push(found);
        parent = found.extends;
    }

    for (const candidate of [...own, ...children, ...parents]) {
        // Object.hasOwn, since every object already has a "constructor" that isn't one of the engine's methods
        const method = Object.hasOwn(candidate.methods, methodName) ? candidate.methods[methodName] : null;
        if (method) {
            return {file: candidate.file, start: method.start, end: method.end};
        }
    }
    return null;
}
