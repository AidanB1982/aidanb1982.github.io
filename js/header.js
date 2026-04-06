// =========================
// LOAD HEADER
// =========================

async function loadHeader(type = "hero") {

    let file = "header.html";

    if (type === "simple") {
        file = "header-simple.html";
    }

    try {
        const res = await fetch(file);
        const html = await res.text();

        const container = document.getElementById("header-placeholder");

        if (container) {
            container.innerHTML = html;
        }

    } catch (err) {
        console.error("Header load failed:", err);
    }
}
