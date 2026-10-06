// Builds the method tables on each page.
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

class MethodsGrid {

    methods = [];

    constructor(methods) {
        this.methods = methods.map(method => new Method(method));
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
    description;
    details;
    parameters = [];
    settings = [];
    returns;

    constructor(data) {
        this.name = data.name;
        this.description = data.description;
        this.details = data.details;
        this.parameters = (data.parameters ?? []).map(p => new Parameter(p[0], p[1]));
        this.settings = (data.settings ?? []).map(s => new Setting(s[0], s[1], s[2]));
        this.returns = data.returns;
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

    generateHTML() {

        if (!this.hasDropdown()) {
            // The empty row keeps the table stripes lined up with the rows that do have dropdowns
            return `
                    <tr class="no-dropdown">
                        <td>${this.generateSignature()}</td>
                        <td>${this.description}</td>
                    </tr>
                    <tr class="dropdown-tr"></tr>`;
        }

        let s = `
                    <tr class="has-dropdown">
                        <td>
                            <label>
                            <input type="checkbox">
                            ${this.generateSignature()}
                            </label>
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
function methodsTable(methods) {
    const html = new MethodsGrid(methods).generateHTML();
    document.currentScript.insertAdjacentHTML("beforebegin", html);
}
