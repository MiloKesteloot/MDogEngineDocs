let dropdowns = [];

document.addEventListener("DOMContentLoaded", function() {
    let temp_dropdowns = document.body.getElementsByClassName("dropdown-tr");

    for (let i = 0; i < temp_dropdowns.length; i++) {
        const dropdown = temp_dropdowns[i];

        const obj = [dropdown];

        obj.push(dropdown.getElementsByClassName("method-info")[0]);
        obj.push(dropdown.getElementsByClassName("method-info-spacer")[0]);

        dropdowns.push(obj);
    }

    loop();
});

function loop() {

    for (let i = 0; i < dropdowns.length; i++) {
        const dropdown = dropdowns[i];

        dropdown[2].style.height = dropdown[1].style.height;
    }

    requestAnimationFrame(loop);
}