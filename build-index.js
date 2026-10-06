// Builds docs-index.js, the list of every page, heading, and method that search and cross-links use.
// Run it with "node build-index.js" after changing any methods or headings.
//
// The pages come from the links in sidebar.js. Each page's method tables are read by running its inline scripts
// with the real build-tables.js, so the index always matches what the page shows.

const fs = require("fs");
const vm = require("vm");

const buildTables = fs.readFileSync("build-tables.js", "utf8");
const sidebar = fs.readFileSync("sidebar.js", "utf8");

// Any "something.html" in sidebar.js, whether it's in an href or a pageLink()
const pages = [...new Set([...sidebar.matchAll(/"([a-z0-9-]+\.html)"/g)].map(m => m[1]))];

const index = [];
let problems = 0;

for (const page of pages) {
    const html = fs.readFileSync(page, "utf8");

    // Run the page's inline scripts to get its method tables
    const context = {document: {currentScript: {insertAdjacentHTML() {}}}};
    vm.createContext(context);
    vm.runInContext(buildTables + "\nthis.docsPageEntries = docsPageEntries; this.docsSlugify = docsSlugify; this.docsStripTags = docsStripTags;", context);
    const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
    vm.runInContext(scripts.join("\n"), context);

    const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
    const pageTitle = h1 ? context.docsStripTags(h1[1]).trim() : page;

    index.push({page, kind: "page", id: "", title: pageTitle});

    // Headings get the same ids page.js gives them
    const usedIds = new Set();
    for (const m of html.matchAll(/<h([23])(\s[^>]*)?>([\s\S]*?)<\/h\1>/g)) {
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
        index.push({page, kind: "heading", id, title, context: pageTitle});
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

const lines = index.map(entry => "    " + JSON.stringify(entry) + ",");
const output = `// Made by build-index.js. Don't edit this by hand, run "node build-index.js" instead.
const docsIndex = [
${lines.join("\n")}
];
`;

fs.writeFileSync("docs-index.js", output);
console.log(`Wrote docs-index.js with ${index.length} entries from ${pages.length} pages.` + (problems ? ` ${problems} problem(s) above.` : ""));
