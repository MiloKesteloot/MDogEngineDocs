// Makes the page a game runs in, for the Playground (playground.js) and for embedded games (embed.html).
// Include this as a normal script. It adds a few functions starting with "mdog".
//
// The game's page gets these, before the game runs:
//  - Files in assetURLs are used in place of "assets/..." for images and loadFile()
//  - console.log() and errors are sent to the page around it, as {playground: {level, text, line}} messages. Messages
//    from the engine itself, like "Created MDog instance.", are left out, since they aren't the game's.
//  - Images are loaded before the game starts, so nothing flickers in
//  - window.playgroundControl, for pausing, stepping one tick at a time, and reading the game's variables

// code is the game's code, which can leave out the import line. Gives back the page's HTML, and codeOffset, the line
// in the page where the code starts, to turn error line numbers back into the code's own line numbers.
function mdogGamePage({code, engineURL, assetURLs = {}, images = []}) {
    const addImport = !/import\s+MDog\s+from/.test(code);
    const userCode = (addImport ? `import MDog from "${engineURL}";\n` : "") + code;
    const engine = userCode.match(/import\s+MDog\s+from\s+["']([^"']+)["']/)?.[1] ?? engineURL;

    // All on one line, so the game's own line numbers stay simple. playgroundEval is made here, inside the game's
    // code, so it can read the game's variables.
    let script = `import playgroundMDog from "${engine}"; window.playgroundMDog = playgroundMDog; ` +
        `window.playgroundEval = playgroundExpression => eval(playgroundExpression); ` +
        `await playgroundPreload(playgroundMDog);\n` + userCode;
    // A </script> in the code would end the script early
    script = script.replace(/<\/script/gi, "<\\/script");

    const before = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>html, body { margin: 0; height: 100%; overflow: hidden; background: #000; }</style>
<script>
${mdogGameHelpers(assetURLs, images)}
<\/script>
</head>
<body>
<script type="module">
`;
    return {
        html: before + script + "\n<\/script>\n</body>\n</html>",
        codeOffset: before.split("\n").length - 1 + 1 + (addImport ? 1 : 0),
    };
}

function mdogGameHelpers(assetURLs, images) {
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
    if (typeof value === "function") {
        return "function " + (value.name || "") + "()";
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

// The line in this page an error happened on, from its stack, for errors that don't say
function playgroundLine(error) {
    const match = String(error && error.stack || "").match(/about:srcdoc:(\\d+):\\d+/);
    return match ? Number(match[1]) : null;
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

window.addEventListener("error", e => toPlayground({level: "error", text: e.message, line: e.filename === location.href ? e.lineno : playgroundLine(e.error)}));
window.addEventListener("unhandledrejection", e => toPlayground({level: "error", text: "Uncaught (in promise) " + playgroundFormat(e.reason), line: playgroundLine(e.reason)}));

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
]);

// Pausing holds back the engine's next frame. MDog Engine times itself with Date.now(), so its clock is reset when the
// game goes again, or it would try to catch up on the time it was paused.
let playgroundPaused = false;
let playgroundHeldFrame = null;
const playgroundRealFrame = window.requestAnimationFrame.bind(window);
window.requestAnimationFrame = callback => playgroundRealFrame(time => {
    if (playgroundPaused) {
        playgroundHeldFrame = callback;
    } else {
        callback(time);
    }
});

window.playgroundControl = {
    pause() {
        playgroundPaused = true;
    },
    resume() {
        if (!playgroundPaused) {
            return;
        }
        playgroundPaused = false;
        if (window.playgroundMDog) {
            window.playgroundMDog.Math.nowTime = Date.now();
        }
        if (playgroundHeldFrame) {
            const callback = playgroundHeldFrame;
            playgroundHeldFrame = null;
            playgroundRealFrame(callback);
        }
    },
    // Runs one tick and draws it, the same as the engine does each tick
    step() {
        const mdog = window.playgroundMDog;
        if (!mdog) {
            return;
        }
        try {
            if (mdog.activeFunction) {
                mdog.activeFunction();
            }
            mdog.Input._postInUpdate();
            mdog.Draw._postOutUpdate();
        } catch (error) {
            toPlayground({level: "error", text: "Uncaught " + playgroundFormat(error), line: playgroundLine(error)});
        }
    },
    // The value of something in the game, like "player.x", as text
    read(expression) {
        if (!window.playgroundEval) {
            return {ok: false, text: "not running yet"};
        }
        try {
            return {ok: true, text: playgroundFormat(window.playgroundEval(expression))};
        } catch (error) {
            return {ok: false, text: error.message};
        }
    },
};`;
}

// ===== Touch buttons, for playing on phones =====

// The keys a game's code checks for, like ["ArrowLeft", " "], from its isDown() and isClicked() calls
function mdogFindKeys(code) {
    const keys = new Set();
    for (const match of code.matchAll(/\.(?:isDown|isClicked)\(\s*["']([^"']+)["']\s*\)/g)) {
        keys.add(match[1]);
    }
    // Arrows first, in the order they're usually laid out
    const order = ["ArrowLeft", "ArrowUp", "ArrowDown", "ArrowRight"];
    return [...keys].sort((a, b) => (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99));
}

const mdogKeyLabels = {ArrowLeft: "◀", ArrowRight: "▶", ArrowUp: "▲", ArrowDown: "▼", " ": "Space", Escape: "Esc", Enter: "Enter", Shift: "Shift"};

// The KeyboardEvent.code for a key, like "KeyA" for "a"
function mdogKeyCode(key) {
    if (key === " ") {
        return "Space";
    }
    if (/^[a-z]$/i.test(key)) {
        return "Key" + key.toUpperCase();
    }
    if (/^[0-9]$/.test(key)) {
        return "Digit" + key;
    }
    return key;
}

// Fills container with a button for each key. Holding a button holds the key down in the game in getWindow().
function mdogTouchKeys(container, keys, getWindow) {
    container.innerHTML = "";
    for (const key of keys) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "mdog-touch-key";
        button.textContent = mdogKeyLabels[key] ?? key.toUpperCase();
        button.setAttribute("aria-label", key === " " ? "Space" : key);
        const send = type => {
            const gameWindow = getWindow();
            if (gameWindow) {
                gameWindow.dispatchEvent(new gameWindow.KeyboardEvent(type, {key, code: mdogKeyCode(key), bubbles: true}));
            }
        };
        let held = false;
        button.addEventListener("pointerdown", e => {
            e.preventDefault();
            button.setPointerCapture(e.pointerId);
            held = true;
            button.classList.add("held");
            send("keydown");
        });
        const release = () => {
            if (held) {
                held = false;
                button.classList.remove("held");
                send("keyup");
            }
        };
        button.addEventListener("pointerup", release);
        button.addEventListener("pointercancel", release);
        button.addEventListener("contextmenu", e => e.preventDefault());
        container.appendChild(button);
    }
}
