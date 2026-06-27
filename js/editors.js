// =========================
// EDITOR PICKS CMS SYSTEM
// =========================

let editorData = {};
let sortedMonths = [];
let currentMonthIndex = 0;
let editorRotationInterval = null;
let isEditorTransitioning = false;
let editorPicksStarted = false;

async function loadEditorPicks() {
    const container = document.querySelector(".editor-inner");

    if (!container) {
        console.warn("Editor picks container not found.");
        return;
    }

    if (editorPicksStarted) {
        return;
    }

    editorPicksStarted = true;

    container.innerHTML = `
        <div class="editor-loading fade-in visible">
            <p>Loading selections...</p>
        </div>
    `;

    try {
        const response = await fetch("/data/books.json", {
            cache: "no-store"
        });

        if (!response.ok) {
            throw new Error(`Failed to load books.json: ${response.status}`);
        }

        editorData = await response.json();

        const months = Object.keys(editorData);

        if (!months.length) {
            renderEmpty(container);
            return;
        }

        sortedMonths = months.sort((a, b) => {
            return parseMonthKey(a) - parseMonthKey(b);
        });

        currentMonthIndex = sortedMonths.length - 1;

        renderMonth(true);
        startRotation();
        setupHoverPause();

    } catch (error) {
        console.error("Editor Picks Error:", error);
        renderError(container);
    }
}

function renderMonth(initial = false) {
    if (isEditorTransitioning) return;

    isEditorTransitioning = true;

    const container = document.querySelector(".editor-inner");
    const title = document.querySelector(".month-title");

    if (!container) {
        isEditorTransitioning = false;
        return;
    }

    const monthKey = sortedMonths[currentMonthIndex];
    const books = editorData[monthKey] || [];

    if (!initial) {
        container.classList.add("fading");
    }

    setTimeout(() => {
        container.innerHTML = "";

        if (title) {
            title.textContent = formatMonth(monthKey);
        }

        if (!books.length) {
            renderEmpty(container);
            isEditorTransitioning = false;
            return;
        }

        container.classList.toggle("single", books.length === 1);

        books.forEach((book, index) => {
            const card = createBookCard(book);

            if (books.length === 1) {
                card.classList.add("featured-pick", "active-pick");
            }

            card.style.transitionDelay = `${index * 120}ms`;
            container.appendChild(card);
        });

        container.classList.remove("fading");

        requestAnimationFrame(() => {
            container.querySelectorAll(".fade-in").forEach(element => {
                element.classList.add("visible");
            });

            if (typeof initFadeIn === "function") {
                initFadeIn();
            }
        });

        setTimeout(() => {
            isEditorTransitioning = false;
        }, 500);

    }, initial ? 0 : 400);
}

function createBookCard(book) {
    const card = document.createElement("article");
    card.className = "pick fade-in";

    const image = document.createElement("img");
    image.src = book.image;
    image.alt = `${book.title} book cover`;
    image.loading = "lazy";

    image.onerror = () => {
        console.warn(`Image failed to load: ${book.image}`);
        image.style.opacity = "0.25";
    };

    const heading = document.createElement("h3");
    heading.textContent = book.title;

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
    link.textContent = book.link ? "View Book" : "Unavailable";

    const affiliate = document.createElement("span");
    affiliate.className = "affiliate-subtle";
    affiliate.textContent = "via Bookshop";

    card.appendChild(image);
    card.appendChild(heading);
    card.appendChild(author);
    card.appendChild(note);
    card.appendChild(link);
    card.appendChild(affiliate);

    return card;
}

function startRotation() {
    if (editorRotationInterval) {
        clearInterval(editorRotationInterval);
    }

    editorRotationInterval = setInterval(() => {
        if (isEditorTransitioning || !sortedMonths.length) return;

        currentMonthIndex--;

        if (currentMonthIndex < 0) {
            currentMonthIndex = sortedMonths.length - 1;
        }

        renderMonth();

    }, 8000);
}

function setupHoverPause() {
    const container = document.querySelector(".editor-inner");

    if (!container) return;

    container.addEventListener("mouseenter", () => {
        if (editorRotationInterval) {
            clearInterval(editorRotationInterval);
        }
    });

    container.addEventListener("mouseleave", () => {
        startRotation();
    });
}

function renderEmpty(container) {
    container.innerHTML = `
        <div class="editor-empty">
            <p>No selections available.</p>
        </div>
    `;
}

function renderError(container) {
    container.innerHTML = `
        <div class="editor-error">
            <p>Unable to load selections.</p>
        </div>
    `;
}

function formatMonth(key) {
    const [month, year] = key.split("-");

    return `${month.charAt(0).toUpperCase()}${month.slice(1)} ${year}`;
}

function parseMonthKey(key) {
    const [month, year] = key.split("-");

    const monthMap = {
        january: 0,
        february: 1,
        march: 2,
        april: 3,
        may: 4,
        june: 5,
        july: 6,
        august: 7,
        september: 8,
        october: 9,
        november: 10,
        december: 11
    };

    return new Date(Number(year), monthMap[month.toLowerCase()] ?? 0, 1);
}
