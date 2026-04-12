// =========================
// EDITOR PICKS CMS SYSTEM (PRO)
// =========================

async function loadEditorPicks() {

```
const container = document.querySelector('.editor-inner');
const title = document.querySelector('.month-title');

if (!container) return;

// =========================
// LOADING STATE
// =========================
container.innerHTML = `
    <div class="editor-loading">
        <p>Loading selections...</p>
    </div>
`;

try {
    const res = await fetch('/data/books.json');

    if (!res.ok) {
        throw new Error("Failed to load books.json");
    }

    const data = await res.json();

    const months = Object.keys(data);

    if (!months.length) {
        renderEmpty(container);
        return;
    }

    // =========================
    // GET LATEST MONTH
    // =========================
    const latestMonth = months[months.length - 1];
    const books = data[latestMonth];

    // =========================
    // UPDATE TITLE
    // =========================
    if (title) {
        title.textContent = formatMonth(latestMonth);
    }

    // =========================
    // CLEAR LOADER
    // =========================
    container.innerHTML = "";

    // =========================
    // EMPTY STATE
    // =========================
    if (!books || !books.length) {
        renderEmpty(container);
        return;
    }

    // =========================
    // RENDER BOOKS (STAGGERED)
    // =========================
    books.forEach((book, index) => {

        const el = createBookCard(book);

        // Staggered animation delay
        el.style.transitionDelay = `${index * 120}ms`;

        container.appendChild(el);
    });

    // =========================
    // RE-INIT ANIMATIONS
    // =========================
    if (typeof initFadeIn === "function") {
        initFadeIn();
    }

} catch (err) {
    console.error("Editor Picks Error:", err);
    renderError(container);
}
```

}

// =========================
// CREATE BOOK CARD (SAFE)
// =========================

function createBookCard(book) {

```
const el = document.createElement("div");
el.className = "pick fade-in";

// IMAGE
const img = document.createElement("img");
img.src = book.image;
img.alt = book.title;
img.loading = "lazy";

// TITLE
const title = document.createElement("h3");
title.textContent = book.title;

// AUTHOR
const author = document.createElement("p");
author.className = "pick-author";
author.textContent = book.author;

// NOTE
const note = document.createElement("p");
note.className = "pick-note";
note.textContent = book.note;

// LINK BUTTON
const link = document.createElement("a");
link.href = book.link;
link.target = "_blank";
link.rel = "noopener noreferrer";
link.className = "button copper";
link.textContent = "View Book";

// APPEND
el.appendChild(img);
el.appendChild(title);
el.appendChild(author);
el.appendChild(note);
el.appendChild(link);

return el;
```

}

// =========================
// EMPTY STATE
// =========================

function renderEmpty(container) {
container.innerHTML = `         <div class="editor-empty fade-in">             <p>No selections available yet.</p>         </div>
    `;
}

// =========================
// ERROR STATE
// =========================

function renderError(container) {
container.innerHTML = `         <div class="editor-error fade-in">             <p>Unable to load selections.</p>         </div>
    `;
}

// =========================
// FORMAT MONTH
// =========================

function formatMonth(key) {

```
const [month, year] = key.split("-");

return (
    month.charAt(0).toUpperCase() +
    month.slice(1) +
    " " +
    year
);
```

}

// =========================
// INIT
// =========================

document.addEventListener("DOMContentLoaded", () => {

```
if (!document.body.classList.contains("editors-page")) return;

loadEditorPicks();
```

});
