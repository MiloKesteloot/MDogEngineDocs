// Makes animated GIFs, for the Playground's Record GIF button (see playground.js).
// Include this as a normal script. It adds mdogGifRecorder().
//
//   const recorder = mdogGifRecorder(width, height);
//   recorder.addFrame(imageData.data);      // as many times as needed, each width by height
//   const blob = await recorder.finish(5);  // 5 hundredths of a second per frame
//
// GIFs can only have 256 colors. Pixel art usually has fewer than that, so the exact colors are kept. If a game uses
// more, every color is rounded to the nearest of 252 evenly spread colors instead. Frames are turned into palette
// numbers as they're added, so a long recording takes a quarter of the memory it would as full pixels.
function mdogGifRecorder(width, height) {
    const frames = [];
    // Exact colors so far, as 0xRRGGBB, and their palette numbers
    let colors = new Map();
    let exact = true;

    const cubeIndex = (r, g, b) => Math.round(r * 5 / 255) * 42 + Math.round(g * 6 / 255) * 6 + Math.round(b * 5 / 255);
    const cubePalette = [];
    for (let r = 0; r < 6; r++) {
        for (let g = 0; g < 7; g++) {
            for (let b = 0; b < 6; b++) {
                cubePalette.push((Math.round(r * 255 / 5) << 16) | (Math.round(g * 255 / 6) << 8) | Math.round(b * 255 / 5));
            }
        }
    }

    // Too many colors: change every frame so far over to the 252 colors
    function switchToCube() {
        exact = false;
        const remap = new Uint8Array(256);
        for (const [color, index] of colors) {
            remap[index] = cubeIndex((color >> 16) & 255, (color >> 8) & 255, color & 255);
        }
        for (const frame of frames) {
            for (let p = 0; p < frame.length; p++) {
                frame[p] = remap[frame[p]];
            }
        }
    }

    function addFrame(rgba) {
        const frame = new Uint8Array(width * height);
        for (let p = 0, i = 0; p < frame.length; p++, i += 4) {
            const r = rgba[i], g = rgba[i + 1], b = rgba[i + 2];
            if (exact) {
                const color = (r << 16) | (g << 8) | b;
                let index = colors.get(color);
                if (index === undefined) {
                    if (colors.size < 256) {
                        index = colors.size;
                        colors.set(color, index);
                    } else {
                        // Change the frames so far over, this one included (it's added for a moment so it's changed
                        // too), then finish this one the new way from this pixel on
                        frames.push(frame);
                        switchToCube();
                        frames.pop();
                        frame[p] = cubeIndex(r, g, b);
                        continue;
                    }
                }
                frame[p] = index;
            } else {
                frame[p] = cubeIndex(r, g, b);
            }
        }
        frames.push(frame);
    }

    async function finish(delay, onProgress = () => {}) {
        const palette = exact ? [...colors.keys()] : cubePalette.slice();
        while (palette.length < 256) {
            palette.push(0);
        }

        const parts = [];
        const header = [];
        const write = (list, ...values) => {
            for (const value of values) {
                list.push(value);
            }
        };
        const write16 = (list, value) => write(list, value & 255, (value >> 8) & 255);

        // Header, size, and a 256 color palette
        write(header, ...[..."GIF89a"].map(c => c.charCodeAt(0)));
        write16(header, width);
        write16(header, height);
        write(header, 0xf7, 0, 0);
        for (const color of palette) {
            write(header, (color >> 16) & 255, (color >> 8) & 255, color & 255);
        }
        // Loop forever
        write(header, 0x21, 0xff, 11, ...[..."NETSCAPE2.0"].map(c => c.charCodeAt(0)), 3, 1, 0, 0, 0);
        parts.push(new Uint8Array(header));

        for (const [n, frame] of frames.entries()) {
            const bytes = [];
            // How long the frame shows, then where it goes
            write(bytes, 0x21, 0xf9, 4, 0, delay & 255, (delay >> 8) & 255, 0, 0);
            write(bytes, 0x2c);
            write16(bytes, 0);
            write16(bytes, 0);
            write16(bytes, width);
            write16(bytes, height);
            write(bytes, 0);
            writeLzw(frame, bytes);
            parts.push(new Uint8Array(bytes));

            onProgress((n + 1) / frames.length);
            // Lets the page draw the progress between frames
            await new Promise(resolve => setTimeout(resolve, 0));
        }
        parts.push(new Uint8Array([0x3b]));
        return new Blob(parts, {type: "image/gif"});
    }

    return {addFrame, finish, frameCount: () => frames.length};
}

// Writes one frame's palette numbers with LZW compression, the way GIFs store them, in blocks of up to 255 bytes
function writeLzw(pixels, bytes) {
    const minCodeSize = 8;
    const clearCode = 1 << minCodeSize;
    const endCode = clearCode + 1;
    bytes.push(minCodeSize);

    let block = [];
    let bitBuffer = 0;
    let bitCount = 0;
    const output = (code, size) => {
        bitBuffer |= code << bitCount;
        bitCount += size;
        while (bitCount >= 8) {
            block.push(bitBuffer & 255);
            bitBuffer >>= 8;
            bitCount -= 8;
            if (block.length === 255) {
                bytes.push(255);
                for (const value of block) {
                    bytes.push(value);
                }
                block = [];
            }
        }
    };

    // Each run of pixels seen so far gets a code. The table is keyed by (code of the run so far) * 256 + next pixel.
    let table = new Map();
    let nextCode = endCode + 1;
    let codeSize = minCodeSize + 1;
    output(clearCode, codeSize);

    let current = pixels[0];
    for (let i = 1; i < pixels.length; i++) {
        const pixel = pixels[i];
        const key = current * 256 + pixel;
        const found = table.get(key);
        if (found !== undefined) {
            current = found;
            continue;
        }
        output(current, codeSize);
        if (nextCode < 4096) {
            table.set(key, nextCode);
            if (nextCode === (1 << codeSize) && codeSize < 12) {
                codeSize++;
            }
            nextCode++;
        } else {
            // The table is full, so start a new one
            output(clearCode, codeSize);
            table = new Map();
            nextCode = endCode + 1;
            codeSize = minCodeSize + 1;
        }
        current = pixel;
    }
    output(current, codeSize);
    output(endCode, codeSize);
    if (bitCount > 0) {
        block.push(bitBuffer & 255);
    }
    if (block.length > 0) {
        bytes.push(block.length);
        for (const value of block) {
            bytes.push(value);
        }
    }
    bytes.push(0);
}
