// =========================
// EDITOR PICKS CMS SYSTEM (PRO)
// =========================

async function loadEditorPicks() {

    const container = document.querySelector('.editor-inner');
    const title = document.querySelector('.month-title');

    if (!container) return;

    container.innerHTML = `
        <div class="editor-loading fade-in visible">
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

        
        const sortedMonths = months.sort((a, b) => {
            const [monthA, yearA] = a.split("-");
            const [monthB, yearB] = b.split("-");

            const dateA = new Date(`${monthA} 1, ${yearA}`);
            const dateB = new Date(`${monthB} 1, ${yearB}`);

            return dateA - dateB;
        });

        const latestMonth = sortedMonths[sortedMonths.length - 1];
        const books = data[latestMonth];

        // UPDATE TITLE
        if (title) {
            title.textContent = formatMonth(latestMonth);
        }

        container.innerHTML = "";

        if (!books || !books.length) {
            renderEmpty(container);
            return;
        }

        books.forEach((book, index) => {

            const el = createBookCard(book);

            if (index === 0) {
                el.classList.add("featured-pick");
            }

            el.style.transitionDelay = `${index * 120}ms`;

            container.appendChild(el);
        });

        if (typeof initFadeIn === "function") {
            initFadeIn();
        }

    } catch (err) {
        console.error("Editor Picks Error:", err);
        renderError(container);
    }
}

// =========================
// CREATE BOOK CARD
// =========================

function createBookCard(book) {

    const el = document.createElement("div");
    el.className = "pick fade-in";

    const img = document.createElement("img");
    img.src = book.image;
    img.alt = book.title;
    img.loading = "lazy";

    img.onerror = () => {
        img.src = "/assets/placeholder.jpg";
    };

    const title = document.createElement("h3");
    title.textContent = book.title;

    const author = document.createElement("p");
    author.className = "pick-author";
    author.textContent = book.author;

    const note = document.createElement("p");
    note.className = "pick-note";
    note.textContent = book.note;

    const link = document.createElement("a");
    link.href = book.link || "#";
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.className = "button copper";

    if (!book.link) {
        link.textContent = "Unavailable";
        link.style.opacity = "0.4";
        link.style.pointerEvents = "none";
    } else {
        link.textContent = "View Book";
    }

    const sub = document.createElement("span");
    sub.className = "affiliate-subtle";
    sub.textContent = "via Bookshop";

    el.appendChild(img);
    el.appendChild(title);
    el.appendChild(author);
    el.appendChild(note);
    el.appendChild(link);
    el.appendChild(sub);

    return el; // ✅ CRITICAL FIX
}

// =========================
// EMPTY STATE
// =========================

function renderEmpty(container) {
    container.innerHTML = `
        <div class="editor-empty fade-in">
            <p>No selections available yet.</p>
        </div>
    `;
}

// =========================
// ERROR STATE
// =========================

function renderError(container) {
    container.innerHTML = `
        <div class="editor-error fade-in">
            <p>Unable to load selections.</p>
        </div>
    `;
}

// =========================
// FORMAT MONTH
// =========================

function formatMonth(key) {
    const [month, year] = key.split("-");
    return month.charAt(0).toUpperCase() + month.slice(1) + " " + year;
}

// =========================
// INIT
// =========================

document.addEventListener("DOMContentLoaded", () => {

    if (!document.body.classList.contains("editors-page")) return;

    if (!window.__editorPicksLoaded) {
        window.__editorPicksLoaded = true;
        loadEditorPicks();
    }

});
