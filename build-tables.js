// Builds the method tables on each page, and has a few helpers the other docs scripts share.
//
// Put a script tag where a table should go, and call methodsTable with a list of methods:
//
// <script>
//     methodsTable([
//         {
//             name: "circle",
//             description: "Draws a circle.",
//             details: "Draws a circle using a distance method.",
//             parameters: [
//                 ["x, y", "The integer center of the drawn circle."],
//                 ["button?", "Names ending in ? are shown as optional."],
//             ],
//             settings: [
//                 ["layer", "An integer defining the canvas to draw to.", "0"],
//             ],
//             returns: "What the method gives back.",
//         },
//     ]);
// </script>
//
// Everything but name and description is optional. Strings can contain HTML.
// A method with no details, parameters, settings, or returns gets a row without a dropdown.
//
// If the methods belong to a class, pass the class name second, like methodsTable([...], "Vector").
// It's used for the method's link (math.html#Vector.add) and in search results.
// Constructors are named like "new Vector", and get links like math.html#new-Vector.
//
// After changing any methods or headings, run "node build-index.js" so search and cross-links know about them.

// Every method table on this page adds its methods here, for search and cross-links
const docsPageEntries = [];

// Turns heading text into an id, like "Mouse Info Methods" into "mouse-info-methods"
function docsSlugify(text) {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// Turns HTML into plain text
function docsStripTags(html) {
    return html.replace(/<[^>]*>/g, "")
        .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&amp;/g, "&");
}

const docsLinkIcon = `<svg class="icon" viewBox="0 0 640 512" style="width: 1.25em"><path d="M579.8 267.7c56.5-56.5 56.5-148 0-204.5c-50-50-128.8-56.5-186.3-15.4l-1.6 1.1c-14.4 10.3-17.7 30.3-7.4 44.6s30.3 17.7 44.6 7.4l1.6-1.1c32.1-22.9 76-19.3 103.8 8.6c31.5 31.5 31.5 82.5 0 114L422.3 334.8c-31.5 31.5-82.5 31.5-114 0c-27.9-27.9-31.5-71.8-8.6-103.8l1.1-1.6c10.3-14.4 6.9-34.4-7.4-44.6s-34.4-6.9-44.6 7.4l-1.1 1.6C206.5 251.2 213 330 263 380c56.5 56.5 148 56.5 204.5 0L579.8 267.7zM60.2 244.3c-56.5 56.5-56.5 148 0 204.5c50 50 128.8 56.5 186.3 15.4l1.6-1.1c14.4-10.3 17.7-30.3 7.4-44.6s-30.3-17.7-44.6-7.4l-1.6 1.1c-32.1 22.9-76 19.3-103.8-8.6C74 372 74 321 105.5 289.5L217.7 177.2c31.5-31.5 82.5-31.5 114 0c27.9 27.9 31.5 71.8 8.6 103.9l-1.1 1.6c-10.3 14.4-6.9 34.4 7.4 44.6s34.4 6.9 44.6-7.4l1.1-1.6C433.5 260.8 427 182 377 132c-56.5-56.5-148-56.5-204.5 0L60.2 244.3z"/></svg>`;

class MethodsGrid {

    methods = [];

    constructor(methods, owner) {
        this.methods = methods.map(method => new Method(method, owner));
    }

    generateHTML() {
        let s = `<table class="methods-grid">
                    <tr>
                        <th>Method</th>
                        <th>Description</th>
                    </tr>`;

        for (let i = 0; i < this.methods.length; i++) {
            s += this.methods[i].generateHTML();
        }

        s += `</table>`;

        return s;
    }
}

class Method {

    name;
    owner;
    description;
    details;
    parameters = [];
    settings = [];
    returns;

    constructor(data, owner) {
        this.name = data.name;
        this.owner = owner;
        this.description = data.description;
        this.details = data.details;
        this.parameters = (data.parameters ?? []).map(p => new Parameter(p[0], p[1]));
        this.settings = (data.settings ?? []).map(s => new Setting(s[0], s[1], s[2]));
        this.returns = data.returns;
    }

    // The class this constructs, if this is a constructor like "new Vector"
    constructs() {
        return this.name.startsWith("new ") ? this.name.slice(4) : null;
    }

    getId() {
        if (this.constructs()) {
            return "new-" + this.constructs();
        }
        return this.owner ? this.owner + "." + this.name : this.name;
    }

    // The name shown in search results, like "Vector.add()"
    getTitle() {
        if (this.constructs()) {
            return this.name + "()";
        }
        return (this.owner ? this.owner + "." : "") + this.name + "()";
    }

    getEntry() {
        return {
            kind: "method",
            id: this.getId(),
            title: this.getTitle(),
            name: this.name,
            owner: this.owner ?? null,
            constructs: this.constructs(),
            description: docsStripTags(this.description),
        };
    }

    hasDropdown() {
        return this.details !== undefined ||
            this.parameters.length > 0 ||
            this.settings.length > 0 ||
            this.returns !== undefined;
    }

    generateSignature() {
        let p = this.parameters.map(parameter => parameter.generatePeram());

        if (this.settings.length !== 0) {
            p.push(`<span class="optional">settings</span>`);
        }

        return `<code>${this.name}(${p.join(", ")})</code>`;
    }

    generateLink() {
        return `<a class="method-link" href="#${this.getId()}" title="Copy link">${docsLinkIcon}</a>`;
    }

    generateHTML() {

        if (!this.hasDropdown()) {
            // The empty row keeps the table stripes lined up with the rows that do have dropdowns
            return `
                    <tr class="no-dropdown" id="${this.getId()}">
                        <td>${this.generateSignature()}${this.generateLink()}</td>
                        <td>${this.description}</td>
                    </tr>
                    <tr class="dropdown-tr"></tr>`;
        }

        let s = `
                    <tr class="has-dropdown" id="${this.getId()}">
                        <td>
                            <label>
                            <input type="checkbox">
                            ${this.generateSignature()}
                            </label>
                            ${this.generateLink()}
                        </td>
                        <td>${this.description}</td>
                    </tr>`;

        let sections = [];

        if (this.details !== undefined) {
            sections.push(this.details + `<br>`);
        }

        if (this.parameters.length > 0) {
            let section = `<b>Parameters:</b><br>`;
            for (let i = 0; i < this.parameters.length; i++) {
                section += this.parameters[i].generateHTML() + `<br>`;
            }
            sections.push(section);
        }

        if (this.settings.length > 0) {
            let section = `<b>Settings (optional):</b><br>`;
            for (let i = 0; i < this.settings.length; i++) {
                section += this.settings[i].generateHTML() + `<br>`;
            }
            sections.push(section);
        }

        if (this.returns !== undefined) {
            sections.push(`<b>Returns:</b> ${this.returns}<br>`);
        }

        s += `
                    <tr class="dropdown-tr">
                        <td colspan="2" class="method-info">
                            ${sections.join(`<br>`)}
                        </td>
                    </tr>`;

        return s;
    }
}

class Parameter {

    names = [];
    description;

    // name can be a comma separated list like "x, y", and each name ends with "?" if it's optional
    constructor(name, description) {
        for (let n of name.split(",")) {
            n = n.trim();
            const optional = n.endsWith("?");
            if (optional) {
                n = n.slice(0, -1);
            }
            this.names.push({name: n, optional: optional});
        }
        this.description = description;
    }

    generatePeram() {
        return this.names.map(n => n.optional ? `<span class="optional">${n.name}</span>` : n.name).join(", ");
    }

    generateHTML() {
        const names = this.names.map(n => `<code class="outline">${n.name}</code>`).join(", ");
        const optional = this.names.every(n => n.optional) ? " (optional)" : "";
        return `${names}${optional}: ${this.description}`;
    }
}

class Setting {

    name;
    description;
    def;

    constructor(name, description, def) {
        this.name = name;
        this.description = description;
        this.def = def;
    }

    generateHTML() {
        let s = `<code class="outline">${this.name}</code> - ${this.description}`;
        if (this.def !== undefined) {
            s += ` Default: <code>${this.def}</code>.`;
        }
        return s;
    }
}

// Inserts a methods table right where the calling script tag is
function methodsTable(methods, owner) {
    const grid = new MethodsGrid(methods, owner);
    for (const method of grid.methods) {
        docsPageEntries.push(method.getEntry());
    }
    document.currentScript.insertAdjacentHTML("beforebegin", grid.generateHTML());
}
