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
                let body = div.getElementsByClassName("sidebar-container")[0];

                // Get a NodeList of all script elements in the body
                let scripts = body.querySelectorAll('script');

                // Iterate through each script element
                scripts.forEach(function(script) {
                    // Remove the script element from the DOM
                    script.parentNode.removeChild(script);

                    document.head.appendChild(script);
                });

                // Create a new script element
                let script = document.createElement('script');
// Set the script content (your script code)
                script.innerHTML = "console.log('Script executed!')";
// Append the script element to the document's head or body
                document.head.appendChild(script);

                body = body.outerHTML;
                screen.innerHTML = body + screen.innerHTML;

                // Do whatever you want with the sidebarContent here
                // console.log(sidebarContent);
            } else {
                // If there's an error, log the error message
                console.error("Error fetching sidebar content: " + xhr.status);
            }
        }
    };

    // Send the request
    xhr.send();
});