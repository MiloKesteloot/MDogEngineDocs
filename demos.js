// Runs the demos made with demo() in build-tables.js. Include this at the end of <body>, after page.js.
//
// Each demo runs in its own iframe, since MDog Engine takes over the page it's loaded on. Only one demo runs at a time,
// and a demo stops when it's scrolled out of view.
//
// To try the demos with an engine that isn't released yet, add ?engine= and the URL of its MDogMain.js to the page's
// address, like draw.html?engine=http://localhost:5500/MDogModules/MDogMain.js. It's remembered until the tab is closed.

// The engine the demos use. Keep this the same version as the import lines in the docs.
const demoEngineURL = "https://cdn.jsdelivr.net/gh/MiloKesteloot/MDogEngine@v1.1.0/MDogModules/MDogMain.js";

const demoEngineOverride = getEngineOverride();

// Names shown on the touch buttons
const demoKeyLabels = {ArrowLeft: "◀", ArrowRight: "▶", ArrowUp: "▲", ArrowDown: "▼", " ": "Space", Escape: "Esc", Enter: "Enter"};
// The physical key for each key name, so the engine sees the same thing a real keyboard would send
const demoKeyCodes = {ArrowLeft: "ArrowLeft", ArrowRight: "ArrowRight", ArrowUp: "ArrowUp", ArrowDown: "ArrowDown", " ": "Space", Escape: "Escape", Enter: "Enter"};

const demos = [...document.querySelectorAll(".demo")].map(element => setUpDemo(element));

// Stop a demo once it's scrolled all the way out of view
const demoObserver = new IntersectionObserver(entries => {
    for (const entry of entries) {
        const d = demos.find(d => d.element === entry.target);
        // Skip reports from before the demo started, like the first one every demo gets when the page loads
        if (!entry.isIntersecting && d && entry.time > d.startTime) {
            d.stop();
        }
    }
});
for (const d of demos) {
    demoObserver.observe(d.element);
}

// Errors from inside a demo's iframe
window.addEventListener("message", e => {
    if (e.data && e.data.demoError !== undefined) {
        demos.find(d => d.iframe && d.iframe.contentWindow === e.source)?.showError(e.data);
    }
});

function getEngineOverride() {
    try {
        const fromURL = new URLSearchParams(window.location.search).get("engine");
        if (fromURL) {
            sessionStorage.setItem("demo-engine", fromURL);
        }
        return sessionStorage.getItem("demo-engine");
    } catch (e) {
        return null;
    }
}

function setUpDemo(element) {
    const width = Number(element.dataset.width);
    const height = Number(element.dataset.height);
    const keys = JSON.parse(element.dataset.keys);
    const screen = element.querySelector(".demo-screen");
    const startButton = element.querySelector(".demo-start");
    const textArea = element.querySelector(".demo-code");
    const errorBox = element.querySelector(".demo-error");
    const originalCode = textArea ? textArea.value : null;

    const d = {element, iframe: null, codeOffset: 0, startTime: 0, stop, showError};

    startButton.addEventListener("click", run);

    if (textArea) {
        element.querySelector(".demo-run").addEventListener("click", run);
        element.querySelector(".demo-reset").addEventListener("click", () => {
            textArea.value = originalCode;
            fitTextArea();
            run();
        });
        textArea.addEventListener("input", fitTextArea);
        textArea.addEventListener("keydown", e => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                run();
            } else if (e.key === "Tab" && !e.shiftKey) {
                // Tab adds spaces instead of leaving the box
                e.preventDefault();
                const start = textArea.selectionStart;
                textArea.setRangeText("    ", start, textArea.selectionEnd, "end");
                fitTextArea();
            }
        });
    }

    setUpTouchKeys();

    function fitTextArea() {
        textArea.rows = textArea.value.split("\n").length;
    }

    function getCode() {
        if (element.dataset.source) {
            const pre = document.querySelector(element.dataset.source);
            return pre.querySelector("code").textContent;
        }
        return textArea.value;
    }

    function run() {
        for (const other of demos) {
            if (other !== d) {
                other.stop();
            }
        }
        stop();
        if (errorBox) {
            errorBox.textContent = "";
        }

        const iframe = document.createElement("iframe");
        iframe.className = "demo-iframe";
        iframe.title = "MDog Engine demo";
        iframe.srcdoc = makeDocument(getCode());
        iframe.addEventListener("load", () => {
            // Focus the game so the keyboard works right away
            iframe.focus();
            iframe.contentWindow.focus();
        });
        screen.appendChild(iframe);
        d.startTime = performance.now();
        startButton.hidden = true;
        element.classList.add("running");
        d.iframe = iframe;
    }

    function stop() {
        if (d.iframe) {
            d.iframe.remove();
            d.iframe = null;
        }
        startButton.hidden = false;
        element.classList.remove("running");
    }

    // The page the demo runs in. Errors are sent back to this page to show under the code.
    function makeDocument(code) {
        let script;
        if (element.dataset.source) {
            script = code;
            if (demoEngineOverride) {
                script = script.replace(/https:\/\/cdn\.jsdelivr\.net\/gh\/MiloKesteloot\/MDogEngine@[^/]+\/MDogModules\/MDogMain\.js/g, demoEngineOverride);
            }
        } else {
            const engine = demoEngineOverride ?? demoEngineURL;
            script = `import MDog from "${engine}";\nMDog.Draw.setScreenSize(${width}, ${height});\n` + code;
        }
        // A </script> in the code would end the script early
        script = script.replace(/<\/script/gi, "<\\/script");

        const before = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>html, body { margin: 0; height: 100%; overflow: hidden; background: #000; }</style>
<script>
window.addEventListener("error", e => parent.postMessage({demoError: e.message, line: e.filename === location.href ? e.lineno : null}, "*"));
window.addEventListener("unhandledrejection", e => parent.postMessage({demoError: String(e.reason), line: null}, "*"));
<\/script>
</head>
<body>
<script type="module">
`;
        // Errors give line numbers in this whole page, so remember where the demo's own code starts
        const headerLines = element.dataset.source ? 0 : 2;
        d.codeOffset = before.split("\n").length - 1 + headerLines;
        return before + script + "\n<\/script>\n</body>\n</html>";
    }

    function showError(data) {
        if (!errorBox) {
            console.error("Demo error:", data.demoError);
            return;
        }
        const line = data.line ? data.line - d.codeOffset : null;
        errorBox.textContent = data.demoError + (line && line > 0 ? ` (line ${line})` : "");
    }

    // Buttons that press keys in the demo, for phones. They're only shown on touch screens.
    function setUpTouchKeys() {
        const container = element.querySelector(".demo-touch-keys");
        if (keys.length === 0) {
            container.remove();
            return;
        }
        for (const key of keys) {
            const button = document.createElement("button");
            button.className = "demo-touch-key";
            button.textContent = demoKeyLabels[key] ?? key;
            button.setAttribute("aria-label", key === " " ? "Space" : key);

            const send = type => {
                if (!d.iframe) {
                    return;
                }
                const win = d.iframe.contentWindow;
                win.dispatchEvent(new win.KeyboardEvent(type, {key, code: demoKeyCodes[key] ?? key, bubbles: true}));
            };
            let held = false;
            button.addEventListener("pointerdown", e => {
                e.preventDefault();
                if (!d.iframe) {
                    // The game isn't loaded yet, so this press just starts it
                    run();
                    return;
                }
                held = true;
                button.setPointerCapture(e.pointerId);
                send("keydown");
            });
            const release = () => {
                if (held) {
                    held = false;
                    send("keyup");
                }
            };
            button.addEventListener("pointerup", release);
            button.addEventListener("pointercancel", release);
            button.addEventListener("contextmenu", e => e.preventDefault());
            container.appendChild(button);
        }
    }

    return d;
}
