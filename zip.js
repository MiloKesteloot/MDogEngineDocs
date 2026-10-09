// Downloads files together as one .zip, for the Playground and the Asset Packs page.
// Include this as a normal script. It adds mdogDownloadZip().
//
// Zips can store files without compressing them, which is simple enough to do by hand, and PNGs are already compressed
// anyway. files is a list of {name, url}, and a name can have folders in it, like "warrior/Idle/Warrior_Idle_1.png".
async function mdogDownloadZip(files, zipName) {
    const loaded = await Promise.all(files.map(async file => ({
        name: new TextEncoder().encode(file.name),
        data: new Uint8Array(await (await fetch(file.url)).arrayBuffer()),
    })));
    const parts = [];
    const directory = [];
    let offset = 0;
    for (const file of loaded) {
        const crc = mdogCrc32(file.data);
        const size = file.data.length;
        const header = mdogZipRecord(0x04034b50, [[20, 2], [0, 2], [0, 2], [0, 2], [0, 2], [crc, 4], [size, 4], [size, 4], [file.name.length, 2], [0, 2]]);
        directory.push(mdogZipRecord(0x02014b50, [[20, 2], [20, 2], [0, 2], [0, 2], [0, 2], [0, 2], [crc, 4], [size, 4], [size, 4], [file.name.length, 2], [0, 2], [0, 2], [0, 2], [0, 2], [0, 4], [offset, 4]]), file.name);
        parts.push(header, file.name, file.data);
        offset += header.length + file.name.length + size;
    }
    const directorySize = directory.reduce((total, part) => total + part.length, 0);
    const end = mdogZipRecord(0x06054b50, [[0, 2], [0, 2], [loaded.length, 2], [loaded.length, 2], [directorySize, 4], [offset, 4], [0, 2]]);

    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([...parts, ...directory, end], {type: "application/zip"}));
    link.download = zipName;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 10000);
}

// A zip record: a 4 byte signature, then each [value, number of bytes] written little-endian
function mdogZipRecord(signature, fields) {
    const bytes = new Uint8Array(4 + fields.reduce((total, [, size]) => total + size, 0));
    const view = new DataView(bytes.buffer);
    view.setUint32(0, signature, true);
    let position = 4;
    for (const [value, size] of fields) {
        if (size === 2) {
            view.setUint16(position, value, true);
        } else {
            view.setUint32(position, value, true);
        }
        position += size;
    }
    return bytes;
}

// The checksum zips use to check each file
function mdogCrc32(data) {
    let crc = 0xffffffff;
    for (const byte of data) {
        crc ^= byte;
        for (let bit = 0; bit < 8; bit++) {
            crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
        }
    }
    return (crc ^ 0xffffffff) >>> 0;
}
