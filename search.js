// The search bar at the top of the sidebar. It searches every page, heading, and method in fullIndex (from page.js).
// Press / anywhere to jump to it, arrow keys to pick a result, and Enter to go to it.

const searchInput = document.querySelector(".searchbar input");
const searchResults = document.querySelector(".search-results");
const maxResults = 12;
let shownResults = [];
let activeResult = 0;

searchInput.addEventListener("input", updateSearch);
searchInput.addEventListener("focus", updateSearch);
searchInput.addEventListener("blur", () => searchResults.classList.remove("open"));

// Keep the input focused while clicking a result
searchResults.addEventListener("mousedown", e => e.preventDefault());

searchInput.addEventListener("keydown", e => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        if (shownResults.length > 0) {
            const step = e.key === "ArrowDown" ? 1 : -1;
            activeResult = (activeResult + step + shownResults.length) % shownResults.length;
            renderResults();
        }
    } else if (e.key === "Enter") {
        if (shownResults.length > 0) {
            goToResult(shownResults[activeResult]);
        }
    } else if (e.key === "Escape") {
        searchInput.value = "";
        searchInput.blur();
    }
});

document.addEventListener("keydown", e => {
    if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) {
        return;
    }
    // Typing in a box shouldn't jump to search. The Playground's code editor is a contenteditable, not a textarea.
    const active = document.activeElement;
    const typing = active && (["INPUT", "TEXTAREA", "SELECT"].includes(active.tagName) || active.isContentEditable);
    if (!typing) {
        e.preventDefault();
        document.body.classList.add("sidebar-open");
        if (typeof setSidebarCollapsed === "function") {
            setSidebarCollapsed(false);
        }
        searchInput.focus();
    }
});


// What was opened from search lately, shown when the search bar is clicked with nothing typed
const recentKey = "docs-recent-searches";
const maxRecent = 6;
let showingRecent = false;

function loadRecent() {
    try {
        return JSON.parse(localStorage.getItem(recentKey)) ?? [];
    } catch (error) {
        return [];
    }
}

function saveRecent(entry) {
    const recent = loadRecent().filter(r => !(r.page === entry.page && r.id === entry.id));
    recent.unshift({page: entry.page, id: entry.id, kind: entry.kind, title: entry.title, context: entry.context, description: entry.description});
    try {
        localStorage.setItem(recentKey, JSON.stringify(recent.slice(0, maxRecent)));
    } catch (error) {}
}

function updateSearch() {
    const words = searchInput.value.toLowerCase().split(/\s+/).filter(Boolean);
    if (words.length === 0) {
        // Nothing typed: show what was opened lately, if anything
        const recent = document.activeElement === searchInput ? loadRecent() : [];
        showingRecent = recent.length > 0;
        shownResults = recent;
        activeResult = 0;
        if (showingRecent) {
            renderResults();
        } else {
            searchResults.classList.remove("open");
        }
        return;
    }
    showingRecent = false;

    const scored = [];
    for (const entry of fullIndex) {
        const match = scoreEntry(entry, words);
        if (match.score > 0) {
            scored.push({entry, ...match});
        }
    }
    // Best matches first. When two match just as well, pages and methods come before headings, then shorter names.
    const kindOrder = {page: 0, method: 1, heading: 2};
    scored.sort((a, b) => b.score - a.score || kindOrder[a.entry.kind] - kindOrder[b.entry.kind] || a.entry.title.length - b.entry.title.length);

    shownResults = scored.slice(0, maxResults).map(s => ({...s.entry, snippet: s.snippet}));
    activeResult = 0;
    renderResults();
}

// The words in a name, like "get", "half", "screen", and "width" for getHalfScreenWidth
function nameWords(text) {
    return text.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

// How many letters have to change to turn a into b, counting two swapped letters as one change. Stops counting
// once it's more than max, since only close words matter.
function typoDistance(a, b, max) {
    if (Math.abs(a.length - b.length) > max) {
        return max + 1;
    }
    let before = null;
    let previous = Array.from({length: b.length + 1}, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
        const current = [i];
        let best = i;
        for (let j = 1; j <= b.length; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
            if (before && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
                current[j] = Math.min(current[j], before[j - 2] + 1);
            }
            best = Math.min(best, current[j]);
        }
        if (best > max) {
            return max + 1;
        }
        before = previous;
        previous = current;
    }
    return previous[b.length];
}

// Whether a typed word is probably a typo of one of these words. Short words have to be exact, since a one letter
// change is a different word.
function isTypoOf(word, words) {
    if (word.length < 4) {
        return false;
    }
    const max = word.length >= 7 ? 2 : 1;
    return words.some(w => typoDistance(word, w, max) <= max);
}

// How well an entry matches, as {score, snippet}. A score of 0 means it doesn't match. Every word has to be found
// somewhere in the entry. Matches in the name count the most, then the title, then typos, then the description, then
// the text under a heading.
function scoreEntry(entry, words) {
    const title = entry.title.toLowerCase();
    const name = (entry.name ?? entry.title).toLowerCase().replace(/\(\)$/, "");
    const titleWords = nameWords(entry.name ?? entry.title).concat(nameWords(entry.title));
    const other = [entry.owner, entry.context, entry.description].filter(Boolean).join(" ").toLowerCase();
    const text = (entry.text ?? "").toLowerCase();

    let score = 0;
    let textWord = null;
    for (const word of words) {
        if (name === word || title === word || title === word + "()") {
            score += 100;
        } else if (name.startsWith(word) || title.startsWith(word)) {
            score += 60;
        } else if (titleWords.some(w => w.startsWith(word))) {
            score += 45;
        } else if (title.includes(word)) {
            score += 40;
        } else if (isTypoOf(word, titleWords.concat(name))) {
            score += 25;
        } else if (other.includes(word)) {
            score += 10;
        } else if (text.includes(word)) {
            score += 4;
            textWord = textWord ?? word;
        } else {
            return {score: 0};
        }
    }
    return {score, snippet: textWord ? snippet(entry.text, textWord) : null};
}

// A bit of the text around a word, to show why something matched
function snippet(text, word) {
    const at = text.toLowerCase().indexOf(word);
    const start = Math.max(0, at - 40);
    const end = Math.min(text.length, at + word.length + 60);
    return (start > 0 ? "..." : "") + text.slice(start, end).trim() + (end < text.length ? "..." : "");
}

function renderResults() {
    if (shownResults.length === 0) {
        searchResults.innerHTML = `<div class="search-empty">No results</div>`;
        searchResults.classList.add("open");
        return;
    }

    const items = shownResults.map((entry, i) => {
        const where = entry.kind === "page" ? "Page" : entry.context;
        const extra = entry.snippet ? " · " + entry.snippet : entry.description ? " · " + entry.description : "";
        return `<a class="search-result${i === activeResult ? " active" : ""}" href="${resultHref(entry)}">
                    <div class="search-result-title">${escapeHTML(entry.title)}</div>
                    <div class="search-result-info">${escapeHTML(where + extra)}</div>
                </a>`;
    }).join("");
    searchResults.innerHTML = (showingRecent ? `<div class="search-heading">Recent</div>` : "") + items +
        `<div class="search-hints"><kbd>↑</kbd><kbd>↓</kbd> to choose <kbd>Enter</kbd> to open <kbd>Esc</kbd> to close</div>`;
    searchResults.classList.add("open");

    searchResults.querySelectorAll(".search-result").forEach((element, i) => {
        element.addEventListener("click", e => {
            e.preventDefault();
            goToResult(shownResults[i]);
        });
    });

    searchResults.querySelector(".search-result.active")?.scrollIntoView({block: "nearest"});
}

function resultHref(entry) {
    return docsPageHref(entry.page) + (entry.id ? "#" + entry.id : "");
}

function goToResult(entry) {
    saveRecent(entry);
    searchInput.value = "";
    searchInput.blur();
    document.body.classList.remove("sidebar-open");

    if (entry.page === currentPage) {
        if (!entry.id) {
            window.scrollTo(0, 0);
        } else if (window.location.hash === "#" + entry.id) {
            openTargetFromURL();
        } else {
            window.location.hash = entry.id;
        }
        return;
    }
    window.location.href = resultHref(entry);
}

function escapeHTML(text) {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
