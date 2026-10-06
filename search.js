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
    const typing = document.activeElement && ["INPUT", "TEXTAREA"].includes(document.activeElement.tagName);
    if (!typing) {
        e.preventDefault();
        document.body.classList.add("sidebar-open");
        searchInput.focus();
    }
});

function updateSearch() {
    const words = searchInput.value.toLowerCase().split(/\s+/).filter(Boolean);
    if (words.length === 0) {
        shownResults = [];
        searchResults.classList.remove("open");
        return;
    }

    const scored = [];
    for (const entry of fullIndex) {
        const score = scoreEntry(entry, words);
        if (score > 0) {
            scored.push({entry, score});
        }
    }
    scored.sort((a, b) => b.score - a.score || a.entry.title.length - b.entry.title.length);

    shownResults = scored.slice(0, maxResults).map(s => s.entry);
    activeResult = 0;
    renderResults();
}

// Higher is a better match. 0 means it doesn't match. Every word has to be found somewhere in the entry.
function scoreEntry(entry, words) {
    const title = entry.title.toLowerCase();
    const name = (entry.name ?? entry.title).toLowerCase().replace(/\(\)$/, "");
    const other = [entry.owner, entry.context, entry.description].filter(Boolean).join(" ").toLowerCase();

    let score = 0;
    for (const word of words) {
        if (name === word || title === word || title === word + "()") {
            score += 100;
        } else if (name.startsWith(word) || title.startsWith(word)) {
            score += 60;
        } else if (title.includes(word)) {
            score += 40;
        } else if (other.includes(word)) {
            score += 10;
        } else {
            return 0;
        }
    }

    // When matches are just as good, pages come first, then methods, then headings
    score += {page: 3, method: 2, heading: 1}[entry.kind];
    return score;
}

function renderResults() {
    if (shownResults.length === 0) {
        searchResults.innerHTML = `<div class="search-empty">No results</div>`;
        searchResults.classList.add("open");
        return;
    }

    searchResults.innerHTML = shownResults.map((entry, i) => {
        const where = entry.kind === "page" ? "Page" : entry.context;
        const extra = entry.description ? " · " + entry.description : "";
        return `<a class="search-result${i === activeResult ? " active" : ""}" href="${resultHref(entry)}">
                    <div class="search-result-title">${escapeHTML(entry.title)}</div>
                    <div class="search-result-info">${escapeHTML(where + extra)}</div>
                </a>`;
    }).join("");
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
    return entry.page + (entry.id ? "#" + entry.id : "");
}

function goToResult(entry) {
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
