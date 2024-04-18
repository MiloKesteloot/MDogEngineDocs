const tableHeader = `<tr><th>Method</th><th>Description</th></tr>`;

class method {

    description;
    parameters = [];
    settings = [];

    constructor(description) {
        this.description = description;
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
                            <code>$FUNCTION_NAME($PERAMS$SETTINGS)</code>
                            </label>
                        </td>
                        <td>$DESCRIPTION</td>
                    </tr>`
        const templateNoDropdown = `
                    <tr class="has-dropdown">
                        <td>
                            <code>$FUNCTION_NAME($PERAMS$SETTINGS))</code>
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

        s += `<td>`;

        if (hasDropdown) {
            s += ` <label><input type="checkbox">`;
        }

        s += `<code>`;
    }
}