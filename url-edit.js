function setURL(urlPath){
    window.history.pushState({},"", urlPath);
}

// setURL("penis");


// window.addEventListener("popstate", (e) => {
//     if(e.state){
//         document.getElementById("content").innerHTML = e.state.html;
//         document.title = e.state.pageTitle;
//     }
// });




// function processAjaxData(response, urlPath){
//     document.getElementById("content").innerHTML = response.html;
//     document.title = response.pageTitle;
//     window.history.pushState({"html":response.html,"pageTitle":response.pageTitle},"", urlPath);
// }
