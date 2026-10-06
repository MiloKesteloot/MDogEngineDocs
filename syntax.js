// Colors code, like VS Code's dark theme. Used for code blocks (page.js) and the demo editors (demos.js).
//
// docsHighlight(code, language) takes plain text and gives back HTML with <span class="tok-...">s around each piece.
// The languages are "js", "html", and "text" (which isn't colored).

const docsLanguageNames = {js: "JavaScript", html: "HTML", text: "Text"};

// Guesses the language of a code block, for blocks that don't say with data-lang
function docsGuessLanguage(code) {
    const trimmed = code.trim();
    if (trimmed.startsWith("<")) {
        return "html";
    }
    return "js";
}

function docsHighlight(code, language) {
    if (language === "html") {
        return highlightHTML(code);
    }
    if (language === "js") {
        return highlightJS(code);
    }
    return escapeCode(code);
}

function escapeCode(text) {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function token(type, text) {
    return `<span class="tok-${type}">${escapeCode(text)}</span>`;
}

// Words that change what code runs, like VS Code colors purple
const jsControlWords = new Set(["if", "else", "for", "while", "do", "return", "break", "continue", "switch", "case",
    "default", "import", "from", "export", "try", "catch", "finally", "throw", "await", "of", "in"]);
// Other words that are part of JavaScript itself, colored blue
const jsKeywords = new Set(["const", "let", "var", "function", "new", "class", "extends", "this", "true", "false",
    "null", "undefined", "typeof", "instanceof", "async", "static", "get", "set", "super", "void", "delete"]);

function highlightJS(code) {
    // Comments, strings, numbers, words, and anything else, in that order of priority
    const pattern = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|("(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|`(?:\\.|[^`\\])*`)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_$][\w$]*)|([\s\S])/g;
    let html = "";
    let match;
    let previous = "";
    while ((match = pattern.exec(code)) !== null) {
        const [text, comment, string, number, word] = match;
        if (comment) {
            html += token("comment", text);
        } else if (string) {
            html += token("string", text);
        } else if (number) {
            html += token("number", text);
        } else if (word) {
            const rest = code.slice(pattern.lastIndex);
            if (jsControlWords.has(word) && previous !== ".") {
                html += token("control", word);
            } else if (jsKeywords.has(word) && previous !== ".") {
                html += token("keyword", word);
            } else if (/^[A-Z]/.test(word)) {
                // Capitalized names are classes (and modules like MDog.Draw), even when called like new Vector()
                html += token("class", word);
            } else if (/^\s*\(/.test(rest)) {
                html += token("function", word);
            } else {
                html += token("variable", word);
            }
        } else {
            html += escapeCode(text);
        }
        if (text.trim() !== "") {
            previous = text;
        }
    }
    return html;
}

function highlightHTML(code) {
    const pattern = /(<!--[\s\S]*?-->)|(<\/?[A-Za-z!][^>]*>)|([^<]+|<)/g;
    let html = "";
    let match;
    while ((match = pattern.exec(code)) !== null) {
        const [text, comment, tag] = match;
        if (comment) {
            html += token("comment", text);
        } else if (tag) {
            html += highlightTag(tag);
        } else {
            html += escapeCode(text);
        }
    }
    return html;
}

// A tag like <body style="margin: 0;">: the brackets are gray, the tag name blue, attributes light blue, and values orange
function highlightTag(tag) {
    const parts = tag.match(/^(<\/?)([A-Za-z!][\w-]*)([\s\S]*?)(\/?>)$/);
    if (!parts) {
        return escapeCode(tag);
    }
    const [, open, name, attributes, close] = parts;
    let html = token("punctuation", open) + token("tag", name);
    const attributePattern = /(\s+)|([^\s=]+)(?:(\s*=\s*)("[^"]*"|'[^']*'|[^\s"'>]+))?|([\s\S])/g;
    let match;
    while ((match = attributePattern.exec(attributes)) !== null) {
        const [text, space, attributeName, equals, value] = match;
        if (space) {
            html += space;
        } else if (attributeName) {
            html += token("attribute", attributeName) + escapeCode(equals ?? "") + (value ? token("string", value) : "");
        } else {
            html += token("attribute", text);
        }
    }
    return html + token("punctuation", close);
}
