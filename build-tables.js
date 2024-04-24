class MethodsGrid {

    name;
    methods = [];

    constructor(name) {
        this.name = name;
    }

    addMethod(method) {
        this.methods.push(method);
    }

    generateHTML() {
        let s = `<h2>$NAME</h2><table class="methods-grid">`;

        s = s.replace("$NAME", this.name);

        s += `<tr>
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
    longDescription;
    parameters = [];
    settings = [];

    constructor(name, description, longDescription) {
        this.name = name;
        this.description = description;
        this.longDescription = longDescription;
    }

    addParameter(parameter) {
        this.parameters.push(parameter);
    }

    addSetting(setting) {
        this.settings.push(setting);
    }

    generateHTML() {

        const templateDropdown = `
                    <tr class="has-dropdown">
                        <td>
                            <label>
                            <input type="checkbox">
                            <code>$NAME($PERAMS)</code>
                            </label>
                        </td>
                        <td>$DESCRIPTION</td>
                    </tr>`
        const templateNoDropdown = `
                    <tr class="has-dropdown">
                        <td>
                            <code>$NAME($PERAMS))</code>
                        </td>
                        <td>$DESCRIPTION</td>
                    </tr>`

        let s = "";

        const hasDropdown = !(this.parameters.length === 0 && this.settings.length === 0);

        if (hasDropdown) {
            s = templateDropdown;
        } else {
            s = templateNoDropdown;
        }

        s = s.replace("$NAME", this.name);
        s = s.replace("$DESCRIPTION", this.description);

        let p = "";

        for (let i = 0; i < this.parameters.length; i++) {
            if (i !== 0) {
                p += `, `;
            }
            p += this.parameters[i].generatePeram();
        }

        if (this.settings.length !== 0) {
            if (this.parameters.length !== 0) {
                p += `, `;
            }
            p += `<span class="optional">settings</span>`;
        }

        s = s.replace("$PERAMS", p);

        let s2 = `<tr class="dropdown-tr">
                        <td colspan="2" class="method-info">`;

        s2 += `<b>Description:</b><br>`; // TODO not sure about this part
        s2 += this.longDescription + `<br>`;

        if (this.parameters.length > 0) {
            s2 += `<br><b>Parameters:</b><br>`
        }

        for (let i = 0; i < this.parameters.length; i++) {
            s2 += this.parameters[i].generateHTML() + `<br>`;
        }

        if (this.settings.length > 0) {
            s2 += `<br><b>Settings:</b><br>`
        }

        for (let i = 0; i < this.settings.length; i++) {
            s2 += this.settings[i].generateHTML() + `<br>`;
        }

        s2 += `</td>
                    </tr>`;

        s += s2;

        return s;
    }
}

class Parameter {

    name;
    description;

    constructor(name, description) {
        this.name = name;
        this.description = description;
    }

    generatePeram() {
        return this.name;
    }

    generateHTML() {
        let s = `<code class="outline">$NAME</code>: $DESCRIPTION`;

        s = s.replace("$NAME", this.name);
        s = s.replace("$DESCRIPTION", this.description);

        return s;
    }
}

class DoubleParameter extends Parameter {

    otherName;

    constructor(name, otherName, description) {
        super(name, description);
        this.otherName = otherName;
    }

    generatePeram() {
        return this.name + ", " + this.otherName;
    }

    generateHTML() {
        let s = `<code class="outline">$NAME</code>, <code class="outline">$OTHER_NAME</code>: $DESCRIPTION`;

        console.log(this.name);
        s = s.replace("$NAME", this.name);
        s = s.replace("$OTHER_NAME", this.otherName);
        s = s.replace("$DESCRIPTION", this.description);

        return s;
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
        let s = `<code class="outline">$NAME</code>: $DESCRIPTION Default: <code>$DEFAULT</code>.`;

        s = s.replace("$NAME", this.name);
        s = s.replace("$DESCRIPTION", this.description);
        s = s.replace("$DEFAULT", this.def);

        return s;
    }
}

const methodsGrid = new MethodsGrid("Drawing Methods");

{
    const method = new Method("circle", "Draws a circle.", "Draws a circle using a distance method.");
    method.addParameter(new DoubleParameter("x", "y", "The integer center of the drawn circle."));
    method.addParameter(new Parameter("radius", "The integer radius of the drawn circle."));
    method.addParameter(new Parameter("color", "Hex code for the circle fill."));
    method.addSetting(new Setting("layer", "An integer defining the canvas to draw to. If the layer has never been drawn to, a new canvas will be created.", "0"));
    methodsGrid.addMethod(method);
}

{
    const method = new Method("clear", "Clears the screen/layer to a color.", "Clears the screen (or specific layer) to a color.");
    method.addSetting(new Setting("color", "Hex code for background clear.", "0"));
    method.addSetting(new Setting("layer", "An integer defining the canvas to draw to clear. If no layer is given, all layers will be cleared.", "#000000"));
    methodsGrid.addMethod(method);
}

{
    const method = new Method("image", "Draws an image.", "Draws an image.");
    method.addParameter(new Parameter("fileName", "The name of the file to be drawn. This is auto-prefixed with \"assets/\"."));
    method.addParameter(new DoubleParameter("x", "y", "The integer top left of the image."));
    method.addSetting(new Setting("layer", "The canvas to draw to. If the layer specified layer has never been drawn to, a new canvas will be created.", "0"));
    method.addSetting(new Setting("scale", "How many pixels each image pixel maps to.", "1"));
    method.addSetting(new Setting("scaleX", "How horizontally stretched the image should be.", "1"));
    method.addSetting(new Setting("scaleY", "An", "0"));
    method.addSetting(new Setting("offsetX", "An", "0"));
    method.addSetting(new Setting("offsetY", "An", "0"));
    method.addSetting(new Setting("width", "An", "0"));
    method.addSetting(new Setting("height", "An", "0"));
    method.addSetting(new Setting("flipX", "An", "0"));
    method.addSetting(new Setting("flipY", "An", "0"));
    methodsGrid.addMethod(method);
}

{
    const method = new Method("interactable", "Draws an interactable.");
    method.addParameter(new Parameter("interactable", "The interactable to be drawn."));
    methodsGrid.addMethod(method);
}

document.addEventListener("DOMContentLoaded", function() {
    document.body.innerHTML = document.body.innerHTML.replace("$METHODS", methodsGrid.generateHTML());
});