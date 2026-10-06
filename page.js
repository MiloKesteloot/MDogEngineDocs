// Things every docs page does once it's loaded: heading links, opening the method in the URL, copy buttons, and cross-links.
// Include this at the end of <body>, after build-tables.js and docs-index.js are loaded in <head>.

const currentPage = docsCurrentPage();

giveHeadingsIds();
cleanPageLinks();

// The index of every page, but with this page's part made from what's really on it, in case docs-index.js is out of date
const fullIndex = makeFullIndex();

addCrossLinks();
addCopyButtons();
setUpMethodLinks();
openTargetFromURL();
window.addEventListener("hashchange", openTargetFromURL);

// Gives every h2 and h3 an id, so sections can be linked to. build-index.js gives them the same ids.
function giveHeadingsIds() {
    const usedIds = new Set();
    for (const heading of document.querySelectorAll(".page h2, .page h3")) {
        if (!heading.id) {
            const base = docsSlugify(heading.textContent);
            let id = base;
            let n = 2;
            while (usedIds.has(id)) {
                id = base + "-" + n++;
            }
            heading.id = id;
        }
        usedIds.add(heading.id);
    }
}

// Links written in the pages, like href="draw.html", lose the ".html" on GitHub Pages (see docsPageHref)
function cleanPageLinks() {
    if (!docsCleanUrls) {
        return;
    }
    for (const link of document.querySelectorAll(".page a[href]")) {
        const match = link.getAttribute("href").match(/^([a-z0-9-]+\.html)(#.*)?$/);
        if (match) {
            link.setAttribute("href", docsPageHref(match[1]) + (match[2] ?? ""));
        }
    }
}

function makeFullIndex() {
    const h1 = document.querySelector(".page h1");
    const pageTitle = h1 ? h1.textContent.trim() : currentPage;

    const thisPage = [{page: currentPage, kind: "page", id: "", title: pageTitle}];
    for (const heading of document.querySelectorAll(".page h2, .page h3")) {
        thisPage.push({page: currentPage, kind: "heading", id: heading.id, title: heading.textContent.trim(), context: pageTitle});
    }
    for (const entry of docsPageEntries) {
        thisPage.push({page: currentPage, ...entry, context: pageTitle});
    }

    const otherPages = (typeof docsIndex === "undefined" ? [] : docsIndex).filter(entry => entry.page !== currentPage);
    return otherPages.concat(thisPage);
}

// Opens and scrolls to the method or heading in the URL, like draw.html#circle
function openTargetFromURL() {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (!id) {
        return;
    }
    const target = document.getElementById(id);
    if (!target) {
        return;
    }

    const checkbox = target.querySelector("input[type=checkbox]");
    if (checkbox) {
        checkbox.checked = true;
    }

    target.scrollIntoView({block: "start"});

    // Flash the row so it's easy to spot
    target.classList.remove("targeted");
    void target.offsetWidth;
    target.classList.add("targeted");
}

// The link icon next to each method copies a link to it
function setUpMethodLinks() {
    for (const link of document.querySelectorAll(".method-link")) {
        link.addEventListener("click", e => {
            e.preventDefault();
            // Only copies the link and puts it in the address bar. The page doesn't move.
            const hash = link.getAttribute("href");
            history.replaceState(null, "", hash);
            copyText(window.location.href);
            showToast(link, "Link copied");
        });
    }
}

// Adds a copy button to every code block
function addCopyButtons() {
    for (const pre of document.querySelectorAll(".page pre")) {
        const button = document.createElement("button");
        button.className = "copy-button";
        button.textContent = "Copy";
        button.addEventListener("click", () => {
            copyText(pre.querySelector("code").textContent);
            button.textContent = "Copied!";
            setTimeout(() => button.textContent = "Copy", 1500);
        });
        pre.appendChild(button);
    }
}

function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text);
        return;
    }
    // Older browsers, or pages not on https
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.opacity = "0";
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand("copy");
    textArea.remove();
}

// Shows a little message next to an element for a moment
function showToast(element, message) {
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = message;
    document.body.appendChild(toast);
    const rect = element.getBoundingClientRect();
    toast.style.left = rect.right + 8 + "px";
    toast.style.top = rect.top + rect.height / 2 + "px";
    setTimeout(() => toast.remove(), 1200);
}

// Turns <code> that names a method or class into a link to it.
//
// To keep from linking the wrong thing, only these are linked:
//   name()              A method. If more than one method has that name, the class of the row or section it's in is used
//                       to pick. If that doesn't narrow it to one, it isn't linked.
//   ClassName.name()    A method on a class, like ParticleSystem.update().
//   ClassName           A class, like Vector. Links to its section, or its constructor if it has no section.
//   MDog.Module...      A full path, like MDog.Draw.circle() or MDog.Math.Vector.
// Lowercase words like layer or x are never linked. Code that's already in a link, in a code block, in a heading,
// or in a method's signature is skipped, and nothing links to itself. Add class="no-link" to a <code> to skip it.
function addCrossLinks() {
    const modulePages = {
        Draw: "draw.html", Input: "input.html", Math: "math.html", UI: "ui.html", FX: "fx.html",
        ThreeDee: "threedee.html", AssetManager: "asset-manager.html", Basics: "basics.html",
    };

    const methods = fullIndex.filter(entry => entry.kind === "method" && !entry.constructs);

    // Where each class name links to: its section heading if it has one, otherwise its constructor
    const classTargets = {};
    for (const entry of fullIndex) {
        if (entry.kind === "method" && entry.constructs) {
            classTargets[entry.constructs] = entry;
        }
    }
    const classNames = new Set([...Object.keys(classTargets), ...methods.map(m => m.owner).filter(Boolean)]);
    for (const entry of fullIndex) {
        if (entry.kind === "heading" && classNames.has(entry.title)) {
            classTargets[entry.title] = entry;
        }
    }

    function findMethod(name, owner, page) {
        return methods.filter(m => m.name === name &&
            (owner === undefined || m.owner === owner) &&
            (page === undefined || m.page === page));
    }

    // Works out what a piece of code should link to, or null
    function resolve(text, contextOwner) {
        const path = text.match(/^MDog((?:\.[A-Za-z]\w*)+)(\(\))?$/);
        if (path) {
            const parts = path[1].slice(1).split(".");
            const isCall = path[2] !== undefined;
            const page = modulePages[parts[0]];

            if (!page) {
                // Like MDog.setActiveFunction()
                const found = isCall && parts.length === 1 ? findMethod(parts[0], null, "core.html") : [];
                return found.length === 1 ? found[0] : null;
            }
            if (parts.length === 1) {
                return isCall ? null : {page, id: ""};
            }
            if (parts.length === 2) {
                if (isCall) {
                    const found = findMethod(parts[1], null, page);
                    return found.length === 1 ? found[0] : null;
                }
                return classTargets[parts[1]] ?? null;
            }
            if (parts.length === 3 && isCall) {
                const found = findMethod(parts[2], parts[1], page);
                return found.length === 1 ? found[0] : null;
            }
            return null;
        }

        const classCall = text.match(/^([A-Z]\w*)\.([a-zA-Z]\w*)\(\)$/);
        if (classCall) {
            const found = findMethod(classCall[2], classCall[1]);
            return found.length === 1 ? found[0] : null;
        }

        const call = text.match(/^([a-zA-Z]\w*)\(\)$/);
        if (call) {
            let found = findMethod(call[1]);
            if (found.length > 1 && contextOwner) {
                const inContext = found.filter(m => m.owner === contextOwner);
                if (inContext.length > 0) {
                    found = inContext;
                }
            }
            if (found.length > 1) {
                const onThisPage = found.filter(m => m.page === currentPage);
                if (onThisPage.length > 0) {
                    found = onThisPage;
                }
            }
            return found.length === 1 ? found[0] : null;
        }

        if (/^[A-Z]\w*$/.test(text)) {
            return classTargets[text] ?? null;
        }

        return null;
    }

    // The class a piece of code is talking about, from the method row it's in or the section it's under
    function getContextOwner(code) {
        const row = code.closest("tr");
        if (row) {
            const methodRow = row.classList.contains("dropdown-tr") ? row.previousElementSibling : row;
            const entry = methodRow && docsPageEntries.find(e => e.id === methodRow.id);
            if (entry) {
                return entry.constructs ?? entry.owner;
            }
        }
        const section = getSection(code);
        return section && classNames.has(section.textContent.trim()) ? section.textContent.trim() : null;
    }

    // The nearest heading above an element
    function getSection(element) {
        const headings = [...document.querySelectorAll(".page h2, .page h3")];
        let section = null;
        for (const heading of headings) {
            if (heading.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING) {
                section = heading;
            }
        }
        return section;
    }

    // The id of the method row a piece of code is in, so it doesn't link to itself
    function getOwnRowId(code) {
        const row = code.closest("tr");
        if (!row) {
            return null;
        }
        return row.classList.contains("dropdown-tr") ? row.previousElementSibling?.id : row.id;
    }

    const codes = document.querySelectorAll(".page code");
    for (const code of codes) {
        if (code.closest("a, pre, h1, h2, h3, .no-link") || code.classList.contains("outline")) {
            continue;
        }
        if (code.closest("td") && code.closest("td").cellIndex === 0 && code.closest("tr.has-dropdown, tr.no-dropdown")) {
            continue;
        }

        const text = code.textContent.trim();
        const contextOwner = getContextOwner(code);
        if (text === contextOwner) {
            // Like "Vector" in the description of a Vector method
            continue;
        }
        const target = resolve(text, contextOwner);
        if (!target) {
            continue;
        }
        if (target.page === currentPage) {
            if (!target.id || target.id === getOwnRowId(code)) {
                continue;
            }
            const section = getSection(code);
            if (section && target.id === section.id) {
                continue;
            }
        }

        const link = document.createElement("a");
        link.className = "cross-link";
        link.href = (target.page === currentPage ? "" : docsPageHref(target.page)) + (target.id ? "#" + target.id : "");
        code.replaceWith(link);
        link.appendChild(code);
    }
}
