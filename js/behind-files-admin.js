
"use strict";

// =========================
// BLACKWOOD PUBLISHING
// BEHIND THE FILES ADMIN
//
// Draft Circle updates,
// preview content,
// generate and copy JSON,
// display existing BFA posts.
//
// This file does not save
// directly to GitHub.
// =========================

window.addEventListener("load", async function () {
    try {
        if (typeof loadHeader === "function") {
            await loadHeader("simple");
        }
    } catch (error) {
        console.warn("Header could not be loaded:", error);
    }

    initBehindFilesAdmin();
});

function initBehindFilesAdmin() {
    const form = document.getElementById("bfa-form");
    const title = document.getElementById("bfa-post-title");
    const category = document.getElementById("bfa-category");
    const date = document.getElementById("bfa-date");
    const image = document.getElementById("bfa-image");
    const excerpt = document.getElementById("bfa-excerpt");
    const body = document.getElementById("bfa-body");
    const published = document.getElementById("bfa-published");
    const pinned = document.getElementById("bfa-pinned");
    const generate = document.getElementById("bfa-generate");
    const copy = document.getElementById("bfa-copy");
    const status = document.getElementById("bfa-status");
    const output = document.getElementById("bfa-json-output");

    const previewImage = document.getElementById("bfa-preview-image");
    const previewCategory = document.getElementById("bfa-preview-category");
    const previewDate = document.getElementById("bfa-preview-date");
    const previewPinned = document.getElementById("bfa-preview-pinned");
    const previewHeading = document.getElementById("bfa-preview-heading");
    const previewExcerpt = document.getElementById("bfa-preview-excerpt");
    const previewBody = document.getElementById("bfa-preview-body");

    if (
        !form ||
        !title ||
        !category ||
        !date ||
        !image ||
        !excerpt ||
        !body ||
        !published ||
        !pinned ||
        !generate ||
        !copy ||
        !status ||
        !output ||
        !previewImage ||
        !previewCategory ||
        !previewDate ||
        !previewPinned ||
        !previewHeading ||
        !previewExcerpt ||
        !previewBody
    ) {
        console.error("Behind the Files Admin: Required page elements are missing.");
        return;
    }

    const today = new Date().toISOString().slice(0, 10);

    date.value = today;
    image.value = "/assets/ArchiveFilesBG.png";

    [
        title,
        category,
        date,
        image,
        excerpt,
        body,
        published,
        pinned
    ].forEach(function (field) {
        field.addEventListener("input", updatePreview);
        field.addEventListener("change", updatePreview);
    });

    generate.addEventListener("click", function () {
        try {
            const post = buildPostObject();

            output.value = JSON.stringify(post, null, 4);

            setStatus(
                "Post JSON generated. Copy it into /data/BFA.json.",
                "is-success"
            );
        } catch (error) {
            setStatus(error.message, "is-error");
        }
    });

    copy.addEventListener("click", async function () {
        if (!output.value.trim()) {
            setStatus("Generate the JSON before copying.", "is-error");
            return;
        }

        try {
            await navigator.clipboard.writeText(output.value);
            setStatus("Post JSON copied to clipboard.", "is-success");
        } catch (error) {
            output.focus();
            output.select();
            setStatus(
                "Clipboard copy failed. The JSON has been selected for manual copy.",
                "is-error"
            );
        }
    });

    form.addEventListener("reset", function () {
        window.setTimeout(function () {
            date.value = today;
            image.value = "/assets/ArchiveFilesBG.png";
            published.checked = true;
            pinned.checked = false;
            output.value = "";
            setStatus("", "");
            updatePreview();
        }, 0);
    });

    updatePreview();
    loadExistingPosts();

    function buildPostObject() {
        const cleanTitle = title.value.trim();
        const cleanBody = body.value.trim();
        const cleanDate = date.value || today;

        if (!cleanTitle) {
            title.focus();
            throw new Error("Please enter a title.");
        }

        if (!cleanBody) {
            body.focus();
            throw new Error("Please enter the main body.");
        }

        return {
            id: createPostId(cleanTitle, cleanDate),
            title: cleanTitle,
            category: category.value || "Weekly Dispatch",
            excerpt: excerpt.value.trim(),
            body: cleanBody,
            image: image.value.trim() || "/assets/ArchiveFilesBG.png",
            published: published.checked,
            pinned: pinned.checked,
            publishedAt: cleanDate
        };
    }

    function updatePreview() {
        const cleanTitle = title.value.trim() || "This Week at Blackwood";
        const cleanCategory = category.value || "Weekly Dispatch";
        const cleanDate = date.value || today;
        const cleanImage = image.value.trim() || "/assets/ArchiveFilesBG.png";
        const cleanExcerpt = excerpt.value.trim() ||
            "A short preview of the dispatch will appear here.";
        const cleanBody = body.value.trim() ||
            "The full Behind the Files update will appear here as you draft it.";

        previewImage.src = cleanImage;
        previewCategory.textContent = cleanCategory;
        previewDate.textContent = formatDate(cleanDate);
        previewPinned.hidden = !pinned.checked;
        previewHeading.textContent = cleanTitle;
        previewExcerpt.textContent = cleanExcerpt;
        previewBody.innerHTML = formatPlainText(cleanBody);
    }

    async function loadExistingPosts() {
        const list = document.getElementById("bfa-existing-list");

        if (!list) {
            return;
        }

        try {
            const response = await fetch(
                "/data/BFA.json?cache=" + Date.now()
            );

            if (!response.ok) {
                throw new Error("BFA.json could not be loaded.");
            }

            const data = await response.json();
            const posts = Array.isArray(data.posts) ? data.posts : [];

            if (!posts.length) {
                list.innerHTML = `
                    <article class="bfa-existing-item">
                        <p class="bfa-muted">
                            No Behind the Files posts are in BFA.json yet.
                        </p>
                    </article>
                `;
                return;
            }

            list.innerHTML = posts
                .slice()
                .sort(function (a, b) {
                    return String(b.publishedAt || "")
                        .localeCompare(String(a.publishedAt || ""));
                })
                .slice(0, 6)
                .map(function (post) {
                    return `
                        <article class="bfa-existing-item">
                            <p class="bfa-status-pill">
                                ${escapeHtml(post.category || "Behind the Files")}
                            </p>

                            <h3>
                                ${escapeHtml(post.title || "Untitled File")}
                            </h3>

                            <p>
                                ${escapeHtml(post.publishedAt || "Undated")}
                                ${post.pinned ? "· Pinned" : ""}
                                ${post.published === false ? "· Draft" : ""}
                            </p>
                        </article>
                    `;
                })
                .join("");

        } catch (error) {
            console.warn("Behind the Files posts could not be loaded:", error);

            list.innerHTML = `
                <article class="bfa-existing-item">
                    <p class="bfa-muted">
                        Existing posts could not be loaded yet.
                    </p>
                </article>
            `;
        }
    }

    function setStatus(message, className) {
        status.textContent = message || "";
        status.classList.remove("is-success", "is-error");

        if (className) {
            status.classList.add(className);
        }
    }
}

function createPostId(title, date) {
    const slug = String(title || "behind-file")
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 48);

    const random = Math.random().toString(36).slice(2, 7);

    return "bfa-" +
        String(date || "").replace(/-/g, "") +
        "-" + slug +
        "-" + random;
}

function formatDate(value) {
    if (!value) {
        return "Filed today";
    }

    const date = new Date(value + "T12:00:00");

    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return date.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
}

function formatPlainText(value) {
    const clean = escapeHtml(value || "");

    if (!clean) {
        return "";
    }

    return clean
        .split(/\n{2,}/)
        .map(function (paragraph) {
            return "<p>" +
                paragraph.replace(/\n/g, "<br>") +
                "</p>";
        })
        .join("");
}

function escapeHtml(value) {
    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
