// =========================
// EDITOR PICKS CMS SYSTEM
// Loads books from /data/books.json
// =========================

let editorData = {};
let sortedMonths = [];
let currentMonthIndex = 0;
let editorRotationInterval = null;
let isEditorTransitioning = false;
let editorPicksStarted = false;
let editorHoverPauseBound = false;

async function loadEditorPicks() {
    const container = document.querySelector(".editor-inner");

    if (!container) {
        console.warn("Editor Picks: .editor-inner container not found.");
        return;
    }

    if (editorPicksStarted) {
        renderMonth(true);
        return;
    }

    editorPicksStarted = true;

    container.innerHTML = `
        <div class="editor-loading fade-in visible">
            <p>Loading selections...</p>
        </div>
    `;

    try {
        const response = await fetch(`/data/books.json?cache=${Date.now()}`, {
            cache: "no-store"
        });

        if (!response.ok) {
            throw new Error(`Failed to load /data/books.json. Status: ${response.status}`);
        }

        const rawData = await response.json();
        editorData = normaliseEditorBooksData(rawData);

        sortedMonths = Object.keys(editorData)
            .filter(function (monthKey) {
                return Array.isArray(editorData[monthKey]) && editorData[monthKey].length > 0;
            })
            .sort(function (a, b) {
                return parseMonthKey(a) - parseMonthKey(b);
            });

        if (!sortedMonths.length) {
            console.warn("Editor Picks: books.json loaded, but no valid monthly book selections were found.", rawData);
            renderEmpty(container);
            return;
        }

        currentMonthIndex = sortedMonths.length - 1;

        renderMonth(true);
        startRotation();
        setupHoverPause();

    } catch (error) {
        console.error("Editor Picks Error:", error);
        renderError(container);
    }
}

function normaliseEditorBooksData(rawData) {
    if (!rawData) {
        return {};
    }

    if (Array.isArray(rawData)) {
        return groupBooksArrayByMonth(rawData);
    }

    if (rawData.months && typeof rawData.months === "object") {
        return rawData.months;
    }

    if (rawData.picks && typeof rawData.picks === "object" && !Array.isArray(rawData.picks)) {
        return rawData.picks;
    }

    if (Array.isArray(rawData.picks)) {
        return groupBooksArrayByMonth(rawData.picks);
    }

    if (rawData.books && Array.isArray(rawData.books)) {
        return groupBooksArrayByMonth(rawData.books);
    }

    return rawData;
}

function groupBooksArrayByMonth(books) {
    return books.reduce(function (grouped, book) {
        const monthKey = String(
            book.monthKey ||
            book.month ||
            book.editorMonth ||
            getCurrentMonthKey()
        ).trim();

        if (!grouped[monthKey]) {
            grouped[monthKey] = [];
        }

        grouped[monthKey].push(book);

        return grouped;
    }, {});
}

function renderMonth(initial = false) {
    if (isEditorTransitioning) {
        return;
    }

    const container = document.querySelector(".editor-inner");
    const title = document.querySelector(".month-title");

    if (!container) {
        isEditorTransitioning = false;
        return;
    }

    if (!sortedMonths.length) {
        renderEmpty(container);
        return;
    }

    isEditorTransitioning = true;

    const monthKey = sortedMonths[currentMonthIndex];
    const books = Array.isArray(editorData[monthKey]) ? editorData[monthKey] : [];

    if (!initial) {
        container.classList.add("fading");
    }

    window.setTimeout(function () {
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

        books.forEach(function (book, index) {
            const card = createBookCard(book, index);

            if (books.length === 1) {
                card.classList.add("featured-pick", "active-pick");
            }

            card.style.transitionDelay = `${index * 120}ms`;
            container.appendChild(card);
        });

        container.classList.remove("fading");

        requestAnimationFrame(function () {
            container.querySelectorAll(".fade-in").forEach(function (element) {
                element.classList.add("visible");
            });

            if (typeof initFadeIn === "function") {
                initFadeIn();
            }
        });

        window.setTimeout(function () {
            isEditorTransitioning = false;
        }, 500);

    }, initial ? 0 : 400);
}

function createBookCard(book) {
    const safeBook = normaliseBook(book);

    const card = document.createElement("article");
    card.className = "pick fade-in";

    const image = document.createElement("img");
    image.src = safeBook.image;
    image.alt = `${safeBook.title} book cover`;
    image.loading = "lazy";

    image.onerror = function () {
        console.warn(`Editor Picks: image failed to load: ${safeBook.image}`);
        image.style.opacity = "0.25";
        image.alt = "";
    };

    const heading = document.createElement("h3");
    heading.textContent = safeBook.title;

    const author = document.createElement("p");
    author.className = "pick-author";
    author.textContent = safeBook.author;

    const note = document.createElement("p");
    note.className = "pick-note";
    note.textContent = safeBook.note;

    const link = document.createElement("a");
    link.href = safeBook.link || "#";
    link.className = "button copper";
    link.textContent = safeBook.link ? "View Book" : "Unavailable";

    if (safeBook.link) {
        link.target = "_blank";
        link.rel = "noopener noreferrer";
    } else {
        link.setAttribute("aria-disabled", "true");
        link.addEventListener("click", function (event) {
            event.preventDefault();
        });
    }

    card.appendChild(image);
    card.appendChild(heading);
    card.appendChild(author);
    card.appendChild(note);
    card.appendChild(link);

    if (safeBook.affiliateText) {
        const affiliate = document.createElement("span");
        affiliate.className = "affiliate-subtle";
        affiliate.textContent = safeBook.affiliateText;
        card.appendChild(affiliate);
    }

    return card;
}

function normaliseBook(book) {
    const fallbackImage = "/assets/ArchiveFilesBG.png";

    return {
        title: String(book && book.title ? book.title : "Untitled Book").trim(),
        author: String(book && book.author ? book.author : "Unknown author").trim(),
        note: String(book && book.note ? book.note : book && book.description ? book.description : "").trim(),
        image: String(book && (book.image || book.cover || book.image_url) ? book.image || book.cover || book.image_url : fallbackImage).trim(),
        link: String(book && (book.link || book.url || book.bookshop) ? book.link || book.url || book.bookshop : "").trim(),
        affiliateText: String(book && book.affiliateText ? book.affiliateText : "via Bookshop").trim()
    };
}

function startRotation() {
    if (editorRotationInterval) {
        clearInterval(editorRotationInterval);
    }

    if (sortedMonths.length <= 1) {
        return;
    }

    editorRotationInterval = window.setInterval(function () {
        if (isEditorTransitioning || !sortedMonths.length) {
            return;
        }

        currentMonthIndex--;

        if (currentMonthIndex < 0) {
            currentMonthIndex = sortedMonths.length - 1;
        }

        renderMonth();

    }, 8000);
}

function setupHoverPause() {
    const container = document.querySelector(".editor-inner");

    if (!container || editorHoverPauseBound) {
        return;
    }

    editorHoverPauseBound = true;

    container.addEventListener("mouseenter", function () {
        if (editorRotationInterval) {
            clearInterval(editorRotationInterval);
            editorRotationInterval = null;
        }
    });

    container.addEventListener("mouseleave", function () {
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
    const cleanKey = String(key || "").trim();

    if (!cleanKey) {
        return "Editor Picks";
    }

    const normalised = cleanKey.replace("_", "-");
    const parts = normalised.split("-");

    if (parts.length < 2) {
        return capitaliseWords(cleanKey);
    }

    const month = parts[0];
    const year = parts[1];

    return `${capitaliseWords(month)} ${year}`;
}

function parseMonthKey(key) {
    const cleanKey = String(key || "").trim().toLowerCase().replace("_", "-");
    const parts = cleanKey.split("-");
    const month = parts[0];
    const year = Number(parts[1]);

    const monthMap = {
        january: 0,
        jan: 0,
        february: 1,
        feb: 1,
        march: 2,
        mar: 2,
        april: 3,
        apr: 3,
        may: 4,
        june: 5,
        jun: 5,
        july: 6,
        jul: 6,
        august: 7,
        aug: 7,
        september: 8,
        sep: 8,
        sept: 8,
        october: 9,
        oct: 9,
        november: 10,
        nov: 10,
        december: 11,
        dec: 11
    };

    const monthIndex = monthMap[month];

    if (!Number.isFinite(year) || typeof monthIndex !== "number") {
        return 0;
    }

    return new Date(year, monthIndex, 1).getTime();
}

function getCurrentMonthKey() {
    const monthNames = [
        "january",
        "february",
        "march",
        "april",
        "may",
        "june",
        "july",
        "august",
        "september",
        "october",
        "november",
        "december"
    ];

    const now = new Date();

    return `${monthNames[now.getMonth()]}-${now.getFullYear()}`;
}

function capitaliseWords(value) {
    return String(value || "")
        .replace(/[-_]+/g, " ")
        .split(" ")
        .filter(Boolean)
        .map(function (word) {
            return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        })
        .join(" ");
}

window.loadEditorPicks = loadEditorPicks;

document.addEventListener("DOMContentLoaded", function () {
    if (document.querySelector(".editor-inner")) {
        loadEditorPicks();
    }
});
