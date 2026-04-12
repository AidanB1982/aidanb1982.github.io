// =========================
// EDITOR PICKS CMS SYSTEM
// =========================

async function loadEditorPicks() {

    try {
        const res = await fetch('/data/books.json');

        if (!res.ok) {
            throw new Error("Failed to load books.json");
        }

        const data = await res.json();

        const container = document.querySelector('.editor-inner');
        const title = document.querySelector('.month-title');

        if (!container) return;

        // =========================
        // GET LATEST MONTH
        // =========================

        const months = Object.keys(data);
        const latestMonth = months[months.length - 1];

        const books = data[latestMonth];

        // UPDATE TITLE
        if (title) {
            title.textContent = formatMonth(latestMonth);
        }

        // CLEAR EXISTING CONTENT
        container.innerHTML = "";

        // =========================
        // RENDER BOOKS
        // =========================

        books.forEach((book, index) => {

            const el = document.createElement("div");
            el.className = "pick fade-in";

            el.innerHTML = `
                <img src="${book.image}" alt="${book.title}">
                <h3>${book.title}</h3>
                <p class="pick-author">${book.author}</p>
                <p class="pick-note">${book.note}</p>
                <a href="${book.link}" target="_blank" class="button copper">
                    View Book
                </a>
            `;

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
    }
}

// =========================
// FORMAT MONTH
// =========================

function formatMonth(key) {

    // "march-2026" → "March 2026"
    const [month, year] = key.split("-");

    return (
        month.charAt(0).toUpperCase() +
        month.slice(1) +
        " " +
        year
    );
}

// =========================
// INIT
// =========================

document.addEventListener("DOMContentLoaded", () => {

    // Safety check (only run on correct page)
    if (!document.body.classList.contains("editors-page")) return;

    loadEditorPicks();
});
