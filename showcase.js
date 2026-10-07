// The playable games on the home page. All three show as cards, and clicking one opens it in a big player below them.
// Each game runs from the MDog Engine site on GitHub Pages, the same way the portfolio shows them, so they're always
// the newest version. A game only loads once its card is clicked.

const showcaseGames = [
    {
        id: "snack-man",
        name: "Snack Man",
        cover: "assets/showcase/snack-man.jpg",
        tagline: "Pac-Man meets Snake.",
        description: "Pac-Man meets Snake. Every pellet you eat makes you one tile longer, and running into your own body ends the run.",
        controls: "Enter to start, arrow keys or WASD to turn, and H for how to play. On a phone, tap to start and swipe to turn.",
    },
    {
        id: "side",
        name: "Modern Forest",
        cover: "assets/showcase/modern-forest.gif",
        tagline: "A time-trial platformer.",
        description: "A time-trial platformer. Run, jump, wall slide, and dash through the level as fast as you can.",
        controls: "Arrow keys or A and D to move, Space or C to jump, Shift or X to dash, and R to restart.",
    },
    {
        id: "sofiatale",
        name: "Cat Tale",
        cover: "assets/showcase/cat-tale.png",
        tagline: "An Undertale fan battle.",
        description: "An Undertale fan battle against a cat. Dodge its attacks with your heart, then pick what to do on your turn.",
        controls: "Arrow keys or WASD to move, Z, Space, or Enter to pick, and X to go back.",
    },
];

function showcaseGameURL(game) {
    return "https://milokesteloot.github.io/MDogEngine/?game=" + game.id;
}

const showcase = document.querySelector(".showcase");
if (showcase) {
    setUpShowcase(showcase);
}

function setUpShowcase(showcase) {
    const cards = showcase.querySelector(".showcase-cards");
    const player = showcase.querySelector(".showcase-player");
    const screen = showcase.querySelector(".showcase-screen");

    let current = null;
    let iframe = null;

    for (const game of showcaseGames) {
        const card = document.createElement("button");
        card.className = "showcase-card";
        card.innerHTML = `
            <span class="showcase-card-cover"><img src="${game.cover}" alt=""></span>
            <span class="showcase-card-text">
                <span class="showcase-card-name">${game.name}</span>
                <span class="showcase-card-tagline">${game.tagline}</span>
            </span>
            <span class="showcase-card-play">Play in browser</span>`;
        card.setAttribute("aria-label", "Play " + game.name + " in your browser");
        card.addEventListener("click", () => play(game));
        game.card = card;
        cards.appendChild(card);
    }

    showcase.querySelector(".showcase-close").addEventListener("click", close);

    // Full screen fills the screen with the game that's playing
    showcase.querySelector(".showcase-fullscreen").addEventListener("click", () => {
        iframe?.requestFullscreen?.();
    });

    function play(game) {
        if (game === current && iframe) {
            player.scrollIntoView({behavior: "smooth", block: "nearest"});
            return;
        }
        stopGame();
        current = game;

        for (const other of showcaseGames) {
            other.card.classList.toggle("selected", other === game);
            other.card.querySelector(".showcase-card-play").textContent = other === game ? "Playing" : "Play in browser";
        }
        player.hidden = false;
        player.querySelector(".showcase-player-name").textContent = game.name;
        player.querySelector(".showcase-description").textContent = game.description;
        player.querySelector(".showcase-controls").textContent = game.controls;
        player.querySelector(".showcase-open").href = showcaseGameURL(game);

        iframe = document.createElement("iframe");
        iframe.className = "showcase-iframe";
        iframe.title = game.name;
        // fullscreen=true makes the engine stretch the game to fill the player, instead of only growing by whole sizes
        iframe.src = showcaseGameURL(game) + "&fullscreen=true";
        iframe.allow = "autoplay; fullscreen";
        iframe.addEventListener("load", () => {
            // Focus the game so the keyboard works right away
            iframe.focus();
            iframe.contentWindow.focus();
        });
        screen.appendChild(iframe);

        // Bring the player into view, without jumping if it's already showing
        requestAnimationFrame(() => player.scrollIntoView({behavior: "smooth", block: "nearest"}));
    }

    function stopGame() {
        if (iframe) {
            iframe.remove();
            iframe = null;
        }
    }

    function close() {
        stopGame();
        current = null;
        player.hidden = true;
        for (const game of showcaseGames) {
            game.card.classList.remove("selected");
            game.card.querySelector(".showcase-card-play").textContent = "Play in browser";
        }
    }
}
