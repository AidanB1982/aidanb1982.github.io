// =========================
// EDITOR PICKS CMS SYSTEM (CINEMATIC PRO)
// =========================

let editorData = {};
let sortedMonths = [];
let currentMonthIndex = 0;
let interval = null;
let isTransitioning = false;

// =========================
// LOAD DATA
// =========================

async function loadEditorPicks() {

    const container = document.querySelector('.editor-inner');

    if (!container) return;

    container.innerHTML = `
        <div class="editor-loading fade-in visible">
            <p>Loading selections...</p>
        </div>
    `;

    try {
        const res = await fetch('/data/books.json');
        if (!res.ok) throw new Error("Failed to load books.json");

        editorData = await res.json();

        const months = Object.keys(editorData);

        if (!months.length) {
            renderEmpty(container);
            return;
        }

        // SORT MONTHS (chronological)
        sortedMonths = months.sort((a, b) => {
            const [mA, yA] = a.split("-");
            const [mB, yB] = b.split("-");
            return new Date(`${mA} 1, ${yA}`) - new Date(`${mB} 1, ${yB}`);
        });

        // start at latest
        currentMonthIndex = sortedMonths.length - 1;

        renderMonth(true);

        startRotation();

        setupHoverPause();

    } catch (err) {
        console.error("Editor Picks Error:", err);
        renderError(container);
    }
}

// =========================
// RENDER MONTH
// =========================

function renderMonth(initial = false) {

    if (isTransitioning) return;
    isTransitioning = true;

    const container = document.querySelector('.editor-inner');
    const title = document.querySelector('.month-title');

    const monthKey = sortedMonths[currentMonthIndex];
    const books = editorData[monthKey];

    // use CSS fade class instead of inline styles
    if (!initial) {
        container.classList.add("fading");
    }

    setTimeout(() => {

        container.innerHTML = "";

        // update title
        if (title) {
            title.textContent = formatMonth(monthKey);
        }

        if (!books || !books.length) {
            renderEmpty(container);
            isTransitioning = false;
            return;
        }

        books.forEach((book, index) => {

            const el = createBookCard(book);

            // FEATURED + ACTIVE
            if (index === 0) {
                el.classList.add("featured-pick", "active-pick");
            }

            el.style.transitionDelay = `${index * 120}ms`;

            container.appendChild(el);
        });

        // fade back in
        container.classList.remove("fading");

        if (typeof initFadeIn === "function") {
            initFadeIn();
        }

        // allow next transition
        setTimeout(() => {
            isTransitioning = false;
        }, 500);

    }, initial ? 0 : 400);
}

// =========================
// ROTATION SYSTEM
// =========================

function startRotation() {

    if (interval) clearInterval(interval);

    interval = setInterval(() => {

        if (isTransitioning) return;

        currentMonthIndex--;

        if (currentMonthIndex < 0) {
            currentMonthIndex = sortedMonths.length - 1;
        }

        renderMonth();

    }, 8000);
}

// =========================
// PAUSE ON HOVER (UX BOOST)
// =========================

function setupHoverPause() {

    const container = document.querySelector('.editor-inner');
    if (!container) return;

    container.addEventListener("mouseenter", () => {
        if (interval) clearInterval(interval);
    });

    container.addEventListener("mouseleave", () => {
        startRotation();
    });
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

    return el;
}

// =========================
// STATES
// =========================

function renderEmpty(container) {
    container.innerHTML = `<div class="editor-empty"><p>No selections available.</p></div>`;
}

function renderError(container) {
    container.innerHTML = `<div class="editor-error"><p>Unable to load selections.</p></div>`;
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

    loadEditorPicks();
});
