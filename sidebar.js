let screen = document.body.getElementsByClassName("screen")[0];

document.addEventListener("DOMContentLoaded", function() {

    // Create a new XMLHttpRequest object
    let xhr = new XMLHttpRequest();

    // Define the URL of the sidebar HTML file
    let url = "sidebar.html";

    // Open a GET request to fetch the sidebar HTML file
    xhr.open("GET", url, true);

    // Define a function to handle the response
    xhr.onreadystatechange = function() {
        if (xhr.readyState === XMLHttpRequest.DONE) {
            if (xhr.status === 200) {
                // If the request is successful (status code 200), process the response
                let sidebarContent = xhr.responseText;

                let div = document.createElement('div');
                div.innerHTML = sidebarContent;
                let sidebar = div.getElementsByClassName("sidebar-container")[0];

                // Insert the sidebar without rewriting the page, so the generated tables and their checkboxes stay as they are
                screen.insertAdjacentElement("afterbegin", sidebar);

                highlightCurrentPage(sidebar);
            } else {
                // If there's an error, log the error message
                console.error("Error fetching sidebar content: " + xhr.status);
            }
        }
    };

    // Send the request
    xhr.send();
});

// Highlights the link to the page we're on, and opens the dropdowns it's inside of
function highlightCurrentPage(sidebar) {
    let page = window.location.pathname.split("/").pop();
    if (page === "") {
        page = "index.html";
    }

    const links = sidebar.querySelectorAll("a.navbar-title");
    for (const link of links) {
        if (link.getAttribute("href") !== page) {
            continue;
        }

        link.classList.add("active");

        let dropdown = link.parentElement.closest(".navbar-dropdown");
        while (dropdown) {
            dropdown.querySelector(":scope > .navbar-title > input[type=checkbox]").checked = true;
            dropdown = dropdown.parentElement.closest(".navbar-dropdown");
        }
    }
}
