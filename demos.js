// Runs the demos made with demo() in build-tables.js. Include this at the end of <body>, after page.js.
//
// Each demo runs in its own iframe, since MDog Engine takes over the page it's loaded on. Only one demo runs at a time,
// and a demo stops when it's scrolled out of view.
//
// To try the demos with an engine that isn't released yet, add ?engine= and the URL of its MDogMain.js to the page's
// address, like draw.html?engine=http://localhost:5500/MDogModules/MDogMain.js. It's remembered until the tab is closed.

// The engine the demos use. The version is set in build-tables.js.
const demoEngineURL = docsEngineBaseURL + "MDogModules/MDogMain.js";

const demoEngineOverride = getEngineOverride();

// Names shown on the touch buttons
const demoKeyLabels = {ArrowLeft: "◀", ArrowRight: "▶", ArrowUp: "▲", ArrowDown: "▼", " ": "Space", Escape: "Esc", Enter: "Enter"};
// The physical key for each key name, so the engine sees the same thing a real keyboard would send
const demoKeyCodes = {ArrowLeft: "ArrowLeft", ArrowRight: "ArrowRight", ArrowUp: "ArrowUp", ArrowDown: "ArrowDown", " ": "Space", Escape: "Escape", Enter: "Enter"};

// Resizes a demo's game box when the page width or zoom changes, or when a dropdown with a demo in it opens
// The resize waits for the next frame, since resizing the box changes the demo's own size, which would set this off
// again in the same frame and make the browser warn about a loop.
const demoResizeObserver = new ResizeObserver(entries => {
    requestAnimationFrame(() => {
        for (const entry of entries) {
            demos.find(d => d.element === entry.target)?.sizeScreen();
        }
    });
});

// Once the page is loaded and the browser isn't busy, download the whole engine in the background. The browser keeps
// the files (jsDelivr lets them be saved for a year), so when a demo starts, the engine is already there.
// This happens on every page, so the engine is ready before someone even gets to a page with demos.
const demoEnginePreloaded = new Promise(resolve => {
    const start = () => preloadEngine(demoEngineOverride ?? demoEngineURL).then(resolve, resolve);
    // Waits until the browser isn't busy, but no more than 2 seconds
    const whenIdle = () => window.requestIdleCallback ? requestIdleCallback(start, {timeout: 2000}) : setTimeout(start, 200);
    if (navigator.connection?.saveData) {
        // Someone who asked their browser to save data probably doesn't want the engine downloaded unless they need it
        resolve();
    } else if (document.readyState === "complete") {
        whenIdle();
    } else {
        window.addEventListener("load", whenIdle, {once: true});
    }
});

// Downloads a module and every module it imports, following the import lines
async function preloadEngine(url, seen = new Set()) {
    if (seen.has(url)) {
        return;
    }
    seen.add(url);
    const response = await fetch(url);
    const code = await response.text();
    const imports = [...code.matchAll(/^\s*import\s+(?:[\w*{}\s,]+\s+from\s+)?["']([^"']+)["']/gm)].map(m => new URL(m[1], url).href);
    await Promise.all(imports.map(next => preloadEngine(next, seen)));
}

// Previews are made one at a time, after the engine has been preloaded, so they don't slow the page down
let demoPreviewQueue = demoEnginePreloaded;
function queueDemoPreview(d) {
    if (navigator.connection?.saveData) {
        return;
    }
    demoPreviewQueue = demoPreviewQueue.then(() => d.makePreview());
}

// The frame files found for each name (see findFrames). Made before the demos are set up, since setting one up can use it.
const demoFrameSearches = new Map();

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

// The asset files a piece of code uses: any "something.png" (or .gif, .jpg, .csv, .txt, .json) string that isn't a web address
function findDemoAssets(code) {
    const paths = [];
    for (const match of code.matchAll(/["'`]([\w\-./?]+\.(?:png|gif|jpe?g|csv|txt|json))["'`]/g)) {
        if (!paths.includes(match[1])) {
            paths.push(match[1]);
        }
    }
    return paths;
}

// Every image file a piece of code uses, with animation names like "Warrior_Run_?.png" turned into each frame's file
async function findDemoImages(code) {
    const images = [];
    for (const path of findDemoAssets(code)) {
        if (!/\.(png|gif|jpe?g)$/.test(path)) {
            continue;
        }
        if (path.includes("?")) {
            images.push(...await findFrames(path));
        } else {
            images.push(path);
        }
    }
    return images;
}

// Finds the frame files for a name like "warrior/Run/Warrior_Run_?.png" by loading frame 1, 2, 3... until one is missing.
// Frame numbers start at 1, the same as MultipleFileAnimation.
function findFrames(pattern) {
    if (!demoFrameSearches.has(pattern)) {
        demoFrameSearches.set(pattern, (async () => {
            const frames = [];
            for (let i = 1; i <= 64; i++) {
                const path = pattern.replace("?", i);
                const found = await new Promise(resolve => {
                    const image = new Image();
                    image.onload = () => resolve(true);
                    image.onerror = () => resolve(false);
                    image.src = "assets/" + path;
                });
                if (!found) {
                    break;
                }
                frames.push(path);
            }
            return frames;
        })());
    }
    return demoFrameSearches.get(pattern);
}

// A thumbnail of an asset that downloads it when clicked. Images are shown with crisp pixels, a few times bigger.
function makeAssetLink(path, showName) {
    const fileName = path.split("/").pop();
    const link = document.createElement("a");
    link.className = "demo-asset";
    link.href = "assets/" + path;
    link.download = fileName;
    link.title = "Download " + fileName;

    if (/\.(png|gif|jpe?g)$/.test(path)) {
        const image = document.createElement("img");
        image.alt = fileName;
        image.addEventListener("load", () => {
            // Scale up small pixel art, but keep wide images (like fonts) from getting too big
            const scale = Math.max(1, Math.min(3, Math.floor(48 / image.naturalHeight)));
            const width = Math.min(image.naturalWidth * scale, 480);
            image.style.width = width + "px";
            image.style.height = image.naturalHeight * (width / image.naturalWidth) + "px";
        });
        image.src = "assets/" + path;
        link.appendChild(image);
    } else {
        link.classList.add("demo-asset-file");
    }

    if (showName || !link.querySelector("img")) {
        const name = document.createElement("span");
        name.className = "demo-asset-name";
        name.textContent = path;
        link.appendChild(name);
    }
    return link;
}

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

    let highlight = null;
    if (textArea) {
        highlight = setUpColoredEditor();
        element.querySelector(".demo-run").addEventListener("click", run);
        element.querySelector(".demo-reset").addEventListener("click", () => {
            textArea.value = originalCode;
            codeChanged();
            run();
        });
        element.querySelector(".demo-open").addEventListener("click", openInPlayground);
        textArea.addEventListener("input", codeChanged);
        textArea.addEventListener("scroll", () => {
            highlight.scrollLeft = textArea.scrollLeft;
        });
        textArea.addEventListener("keydown", e => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                run();
            } else if (e.key === "Tab" && !e.shiftKey) {
                // Tab adds spaces instead of leaving the box
                e.preventDefault();
                const start = textArea.selectionStart;
                textArea.setRangeText("    ", start, textArea.selectionEnd, "end");
                codeChanged();
            }
        });
    }

    setUpTouchKeys();
    let assetsShown = false;
    let shownAssets = "";
    sizeScreen();
    demoResizeObserver.observe(element);

    // The code box is a see-through textarea on top of a colored copy of the code, so typing works normally but the
    // code is colored. The copy is updated on every change.
    function setUpColoredEditor() {
        const wrap = document.createElement("div");
        wrap.className = "demo-code-wrap";
        textArea.replaceWith(wrap);

        const colored = document.createElement("pre");
        colored.className = "demo-highlight";
        colored.setAttribute("aria-hidden", "true");

        const label = document.createElement("div");
        label.className = "code-language";
        label.textContent = docsLanguageNames.js;

        wrap.append(colored, textArea, label);
        colored.innerHTML = docsHighlight(textArea.value, "js") + "\n";
        return colored;
    }

    function codeChanged() {
        fitTextArea();
        // The extra line keeps a new blank line at the end the same height as the textarea's
        highlight.innerHTML = docsHighlight(textArea.value, "js") + "\n";
        highlight.scrollLeft = textArea.scrollLeft;
    }

    // MDog Engine only scales the game by whole numbers of screen pixels. With display scaling like 125%,
    // a box that's a round number of CSS pixels isn't a whole multiple of the game's size in screen pixels,
    // which leaves a black border. So the box is sized to exactly fit the biggest whole scale that fits.
    function sizeScreen() {
        const available = element.clientWidth;
        if (available === 0) {
            // Hidden, like in a closed dropdown. It gets sized when it's shown.
            return;
        }
        // The assets and preview wait until the demo is shown too, so closed dropdowns don't load anything
        if (!assetsShown) {
            assetsShown = true;
            showAssets();
            queueDemoPreview(d);
        }
        const devicePixelRatio = window.devicePixelRatio || 1;
        // Small demos stay a reasonable size, and whole games can use the whole width
        const maxWidth = element.dataset.source ? available : Math.min(available, 520);
        const scale = Math.max(1, Math.floor(maxWidth * devicePixelRatio / width + 0.01));
        // Rounded up, since the browser rounds the iframe's inside down to whole CSS pixels, which can leave it
        // a hair too small for the scale (like 819.2 becoming 819). Rounding up adds less than a pixel.
        screen.style.width = Math.ceil(width * scale / devicePixelRatio) + "px";
        screen.style.height = Math.ceil(height * scale / devicePixelRatio) + "px";
        screen.style.maxWidth = "none";
        screen.style.aspectRatio = "auto";
    }
    d.sizeScreen = sizeScreen;

    function fitTextArea() {
        textArea.rows = textArea.value.split("\n").length;
    }

    // Opens the code in the Playground. Code that doesn't import MDog Engine gets the lines the demo box adds for it.
    async function openInPlayground() {
        let code = getCode();
        if (!/import\s+MDog\s+from/.test(code)) {
            code = `import MDog from "${demoEngineURL}";\nMDog.Draw.setScreenSize(${width}, ${height});\n\n` + code;
        }
        window.open(await docsPlaygroundLink({code: code.trimEnd() + "\n", assets: []}), "_blank");
    }

    function getCode() {
        if (element.dataset.source) {
            const pre = document.querySelector(element.dataset.source);
            return pre.querySelector("code").textContent;
        }
        return textArea.value;
    }

    // Shows the images and files the demo's code uses, so they can be seen and downloaded.
    // Animations with a ? in the file name show each frame.
    function showAssets() {
        const paths = findDemoAssets(getCode());
        if (paths.join("\n") === shownAssets) {
            return;
        }
        shownAssets = paths.join("\n");
        element.querySelector(".demo-assets")?.remove();
        if (paths.length === 0) {
            return;
        }

        const box = document.createElement("div");
        box.className = "demo-assets";
        box.innerHTML = `<div class="demo-assets-title">Assets used <span>(click to download)</span></div>`;
        const list = document.createElement("div");
        list.className = "demo-assets-list";
        box.appendChild(list);

        for (const path of paths) {
            if (path.includes("?")) {
                // An animation's frames, like warrior/Run/Warrior_Run_?.png
                const group = document.createElement("div");
                group.className = "demo-asset-group";
                group.innerHTML = `<div class="demo-asset-name">${docsEscape(path)}</div><div class="demo-asset-frames"></div>`;
                list.appendChild(group);
                findFrames(path).then(frames => {
                    for (const frame of frames) {
                        group.querySelector(".demo-asset-frames").appendChild(makeAssetLink(frame, false));
                    }
                    group.querySelector(".demo-asset-name").textContent = `${path} (${frames.length} frames)`;
                });
            } else {
                list.appendChild(makeAssetLink(path, true));
            }
        }

        const editor = element.querySelector(".demo-editor");
        element.insertBefore(box, editor);
    }

    async function run() {
        showAssets();
        for (const other of demos) {
            if (other !== d) {
                other.stop();
            }
        }
        stop();
        if (errorBox) {
            errorBox.textContent = "";
        }

        const code = getCode();
        const images = await findDemoImages(code);

        const iframe = document.createElement("iframe");
        iframe.className = "demo-iframe";
        iframe.title = "MDog Engine demo";
        iframe.srcdoc = makeDocument(code, images);
        iframe.addEventListener("load", () => {
            // Focus the game so the keyboard works right away
            iframe.focus();
            iframe.contentWindow.focus();
            showCoordinates(iframe);
        });
        screen.appendChild(iframe);
        d.startTime = performance.now();
        startButton.hidden = true;
        element.classList.add("running");
        d.iframe = iframe;
    }

    // While the mouse is over the game, shows which art pixel it's on in the corner, so it's easy to work out where
    // to draw things. It's worked out the same way MDog.Input.Mouse does it.
    function showCoordinates(iframe) {
        screen.querySelector(".demo-coords")?.remove();
        const label = document.createElement("div");
        label.className = "demo-coords";
        label.hidden = true;
        screen.appendChild(label);

        const gameWindow = iframe.contentWindow;
        gameWindow.addEventListener("mousemove", e => {
            const canvas = gameWindow.document.querySelector("canvas");
            if (!canvas) {
                return;
            }
            const rect = canvas.getBoundingClientRect();
            const x = Math.floor((e.clientX - rect.left) / rect.width * canvas.width);
            const y = Math.floor((e.clientY - rect.top) / rect.height * canvas.height);
            const onScreen = x >= 0 && y >= 0 && x < canvas.width && y < canvas.height;
            label.hidden = !onScreen;
            label.textContent = `x ${x}, y ${y}`;
        });
        gameWindow.document.addEventListener("mouseleave", () => {
            label.hidden = true;
        });
    }

    function stop() {
        screen.querySelector(".demo-coords")?.remove();
        if (d.iframe) {
            d.iframe.remove();
            d.iframe = null;
        }
        startButton.hidden = false;
        element.classList.remove("running");
    }

    // The page the demo runs in. Errors are sent back to this page to show under the code.
    //
    // Before the demo's code runs, every image it uses is loaded into the engine, so nothing flickers while the images
    // load. That's done by a line added in front of the code here, so it isn't in the code people see.
    //
    // For a preview (see makePreview), the engine's own loop is turned off so the preview can step it by hand,
    // MDog is put on window so the preview can reach it, and a message is sent once the demo's code has run.
    function makeDocument(code, images, forPreview = false) {
        let script;
        let engine = demoEngineOverride ?? demoEngineURL;
        let addedLines;
        if (element.dataset.source) {
            script = code;
            if (demoEngineOverride) {
                script = script.replace(/https:\/\/cdn\.jsdelivr\.net\/gh\/MiloKesteloot\/MDogEngine@[^/]+\/MDogModules\/MDogMain\.js/g, demoEngineOverride);
            }
            // The added line needs the same engine the game imports, so they share one MDog
            engine = script.match(/import\s+MDog\s+from\s+["']([^"']+)["']/)?.[1] ?? engine;
            script = `import demoPreloadMDog from "${engine}"; await demoPreloadImages(demoPreloadMDog);\n` + script;
            addedLines = 1;
        } else {
            script = `import MDog from "${engine}";\nMDog.Draw.setScreenSize(${width}, ${height});\nawait demoPreloadImages(MDog);\n` + code;
            addedLines = 3;
        }
        if (forPreview) {
            // At the end of the demo's code, so it's only sent once the code has run
            script += `\n;parent.postMessage({demoPreviewReady: true}, "*");`;
        }
        // A </script> in the code would end the script early
        script = script.replace(/<\/script/gi, "<\\/script");

        const previewHead = forPreview ? `<script>window.requestAnimationFrame = () => 0;<\/script>\n` : "";
        const previewStart = forPreview ? `<script type="module">import MDog from "${engine}"; window.demoMDog = MDog;<\/script>\n` : "";

        const before = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>html, body { margin: 0; height: 100%; overflow: hidden; background: #000; }</style>
${previewHead}<script>
window.addEventListener("error", e => parent.postMessage({demoError: e.message, line: e.filename === location.href ? e.lineno : null}, "*"));
window.addEventListener("unhandledrejection", e => parent.postMessage({demoError: String(e.reason), line: null}, "*"));
// Loads the demo's images into the engine. Gives up after 5 seconds so a missing image can't stop the demo.
window.demoPreloadImages = mdog => Promise.race([
    Promise.all(${JSON.stringify(images)}.map(path => new Promise(resolve => {
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
<\/script>
</head>
<body>
${previewStart}<script type="module">
`;
        if (!forPreview) {
            // Errors give line numbers in this whole page, so remember where the demo's own code starts
            d.codeOffset = before.split("\n").length - 1 + addedLines;
        }
        return before + script + "\n<\/script>\n</body>\n</html>";
    }

    // Runs the demo in a hidden iframe just long enough for its images to load, then shows that first frame behind
    // the start button, so the demo looks like what's about to play.
    function makePreview() {
        return new Promise(resolve => {
            const iframe = document.createElement("iframe");
            iframe.className = "demo-preview-iframe";
            iframe.setAttribute("aria-hidden", "true");
            iframe.tabIndex = -1;

            let finished = false;
            const finish = () => {
                if (!finished) {
                    finished = true;
                    window.removeEventListener("message", onMessage);
                    iframe.remove();
                    resolve();
                }
            };
            // Give up on demos that take too long, so one slow demo doesn't hold up the rest
            setTimeout(finish, 6000);

            const onMessage = async e => {
                if (e.source !== iframe.contentWindow || !e.data?.demoPreviewReady) {
                    return;
                }
                const mdog = iframe.contentWindow.demoMDog;
                const tick = () => {
                    mdog.activeFunction?.();
                    mdog.Input._postInUpdate();
                    mdog.Draw._postOutUpdate();
                };
                try {
                    // Keep stepping until every image the demo asked for has loaded, then take one more step so they're drawn
                    for (let i = 0; i < 60; i++) {
                        tick();
                        const images = [...mdog.Draw.imageCache.values()].filter(image => image instanceof iframe.contentWindow.HTMLImageElement);
                        if (images.every(image => image.complete)) {
                            break;
                        }
                        await new Promise(r => setTimeout(r, 50));
                    }
                    tick();
                    const picture = mdog.Draw.mainDrawingBoard.element.toDataURL();
                    screen.style.backgroundImage = `url(${picture})`;
                    element.classList.add("has-preview");
                } catch (error) {
                    // A demo that can't make a preview just keeps the plain start button
                }
                finish();
            };
            window.addEventListener("message", onMessage);

            const code = getCode();
            findDemoImages(code).then(images => {
                iframe.srcdoc = makeDocument(code, images, true);
                document.body.appendChild(iframe);
            });
        });
    }
    d.makePreview = makePreview;

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
