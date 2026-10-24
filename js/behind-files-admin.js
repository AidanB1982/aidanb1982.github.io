"use strict";

// ==========================================
// BLACKWOOD PUBLISHING
// BEHIND THE FILES ADMIN
//
// Supabase administrator verification
// Behind the Files drafting tools
// JSON generation and clipboard copying
// Live preview and existing posts
//
// This file does not save directly to GitHub.
//
// IMPORTANT:
// Client-side access checks protect the UI.
// Confidential data must also be protected
// by Supabase Row Level Security (RLS).
// ==========================================

(function () {
    const SUPABASE_URL =
        "https://bmnlynjldlnxfvunqbqq.supabase.co";

    const SUPABASE_PUBLISHABLE_KEY =
        "sb_publishable_eL7qdDe_6XWGhzmdsql_7w_7dg6psC0";

    const SUPABASE_CDN =
        "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";

    const MEMBERS_URL = "/pages/members.html";

    let supabaseClient = null;
    let editorInitialized = false;
    let accessCheckVersion = 0;

    // ==========================================
    // PAGE INITIALISATION
    // ==========================================

    window.addEventListener("load", async function () {
        const accessScreen =
            document.getElementById("bfa-access-screen");

        const adminContent =
            document.getElementById("bfa-admin-content");

        if (!accessScreen || !adminContent) {
            console.error(
                "Behind the Files Admin: Access screen or editor is missing."
            );
            return;
        }

        // Always start with the editor hidden.
        adminContent.hidden = true;
        accessScreen.hidden = false;

        try {
            if (typeof loadHeader === "function") {
                await loadHeader("simple");
            }
        } catch (error) {
            console.warn("Header could not be loaded:", error);
        }

        await initializeAdminAccess();
    });

    // ==========================================
    // SUPABASE INITIALISATION
    // ==========================================

    async function initializeAdminAccess() {
        showAccessMessage(
            "Verifying Access",
            "Checking your Archivist credentials..."
        );

        try {
            await loadSupabaseLibrary();

            if (
                !window.supabase ||
                typeof window.supabase.createClient !== "function"
            ) {
                throw new Error("Supabase library is unavailable.");
            }

            supabaseClient = window.supabase.createClient(
                SUPABASE_URL,
                SUPABASE_PUBLISHABLE_KEY,
                {
                    auth: {
                        persistSession: true,
                        autoRefreshToken: true,
                        detectSessionInUrl: true
                    }
                }
            );

            // Recheck whenever the session changes.
            // Keep the callback synchronous to avoid
            // calling Supabase methods inside it.
            supabaseClient.auth.onAuthStateChange(function (event) {
                if (event === "SIGNED_OUT") {
                    accessCheckVersion += 1;
                    lockAdminEditor();

                    showAccessMessage(
                        "Sign In Required",
                        "Your Archivist session has ended. Please sign in again through The Archivists."
                    );

                    return;
                }

                if (
                    event === "SIGNED_IN" ||
                    event === "TOKEN_REFRESHED" ||
                    event === "USER_UPDATED"
                ) {
                    // Defer verification until the auth event
                    // callback has completed.
                    window.setTimeout(function () {
                        verifyAdminAccess();
                    }, 0);
                }
            });

            await verifyAdminAccess();

        } catch (error) {
            console.error(
                "Behind the Files Admin: Authentication setup failed.",
                error
            );

            lockAdminEditor();

            showAccessMessage(
                "Access Unavailable",
                "We could not verify your administrator credentials. Please return to The Archivists and try again."
            );
        }
    }

    function loadSupabaseLibrary() {
        return new Promise(function (resolve, reject) {
            if (
                window.supabase &&
                typeof window.supabase.createClient === "function"
            ) {
                resolve();
                return;
            }

            const script = document.createElement("script");

            script.src = SUPABASE_CDN;
            script.async = true;

            script.onload = function () {
                if (
                    window.supabase &&
                    typeof window.supabase.createClient === "function"
                ) {
                    resolve();
                } else {
                    reject(
                        new Error("Supabase loaded without createClient.")
                    );
                }
            };

            script.onerror = function () {
                reject(
                    new Error("Failed to load the Supabase library.")
                );
            };

            document.head.appendChild(script);
        });
    }

    // ==========================================
    // ADMIN VERIFICATION
    // ==========================================

    async function verifyAdminAccess() {
        const checkVersion = ++accessCheckVersion;

        lockAdminEditor();

        showAccessMessage(
            "Verifying Access",
            "Checking your Archivist administrator permission..."
        );

        if (!supabaseClient) {
            showAccessMessage(
                "Access Unavailable",
                "The administrator connection is not ready."
            );
            return;
        }

        try {
            // getUser() validates the current user
            // with the Supabase Auth server.
            const userResult =
                await supabaseClient.auth.getUser();

            if (checkVersion !== accessCheckVersion) {
                return;
            }

            if (userResult.error || !userResult.data.user) {
                showAccessMessage(
                    "Sign In Required",
                    "Please sign in to The Archivists before opening the Blackwood Management Hub."
                );
                return;
            }

            const user = userResult.data.user;

            // Check the permission from the existing
            // Blackwood member_profiles table.
            const profileResult = await supabaseClient
                .from("member_profiles")
                .select("is_admin")
                .eq("id", user.id)
                .maybeSingle();

            if (checkVersion !== accessCheckVersion) {
                return;
            }

            if (profileResult.error) {
                console.error(
                    "Behind the Files Admin: Profile lookup failed.",
                    profileResult.error
                );

                showAccessMessage(
                    "Access Unavailable",
                    "Your administrator permission could not be verified. Please try again later."
                );
                return;
            }

            const profile = profileResult.data;

            const isAdmin =
                profile &&
                (
                    profile.is_admin === true ||
                    String(profile.is_admin).toLowerCase() === "true"
                );

            if (!isAdmin) {
                showAccessMessage(
                    "Access Denied",
                    "This area is reserved for Blackwood Publishing management."
                );
                return;
            }

            unlockAdminEditor();

        } catch (error) {
            if (checkVersion !== accessCheckVersion) {
                return;
            }

            console.error(
                "Behind the Files Admin: Verification failed.",
                error
            );

            lockAdminEditor();

            showAccessMessage(
                "Access Unavailable",
                "We could not verify your administrator access. Please return to The Archivists and try again."
            );
        }
    }

    function lockAdminEditor() {
        const adminContent =
            document.getElementById("bfa-admin-content");

        const accessScreen =
            document.getElementById("bfa-access-screen");

        if (adminContent) {
            adminContent.hidden = true;
        }

        if (accessScreen) {
            accessScreen.hidden = false;
        }
    }

    function unlockAdminEditor() {
        const adminContent =
            document.getElementById("bfa-admin-content");

        const accessScreen =
            document.getElementById("bfa-access-screen");

        if (!adminContent || !accessScreen) {
            return;
        }

        if (!editorInitialized) {
            const success = initBehindFilesAdmin();

            if (!success) {
                showAccessMessage(
                    "Editor Unavailable",
                    "The Behind the Files drafting desk could not be initialised."
                );
                return;
            }

            editorInitialized = true;
        }

        adminContent.hidden = false;
        accessScreen.hidden = true;
    }

    function showAccessMessage(title, message) {
        const titleElement =
            document.getElementById("bfa-access-title");

        const messageElement =
            document.getElementById("bfa-access-message");

        if (titleElement) {
            titleElement.textContent = title;
        }

        if (messageElement) {
            messageElement.textContent = message;
        }
    }

    // ==========================================
    // BEHIND THE FILES EDITOR
    // ==========================================

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

        const previewImage =
            document.getElementById("bfa-preview-image");

        const previewCategory =
            document.getElementById("bfa-preview-category");

        const previewDate =
            document.getElementById("bfa-preview-date");

        const previewPinned =
            document.getElementById("bfa-preview-pinned");

        const previewHeading =
            document.getElementById("bfa-preview-heading");

        const previewExcerpt =
            document.getElementById("bfa-preview-excerpt");

        const previewBody =
            document.getElementById("bfa-preview-body");

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
            console.error(
                "Behind the Files Admin: Required page elements are missing."
            );
            return false;
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

        // ==========================================
        // GENERATE JSON
        // ==========================================

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

        // ==========================================
        // COPY JSON
        // ==========================================

        copy.addEventListener("click", async function () {
            if (!output.value.trim()) {
                setStatus(
                    "Generate the JSON before copying.",
                    "is-error"
                );
                return;
            }

            try {
                await navigator.clipboard.writeText(output.value);

                setStatus(
                    "Post JSON copied to clipboard.",
                    "is-success"
                );
            } catch (error) {
                output.focus();
                output.select();

                setStatus(
                    "Clipboard copy failed. The JSON has been selected for manual copy.",
                    "is-error"
                );
            }
        });

        // ==========================================
        // RESET DRAFT
        // ==========================================

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

        // ==========================================
        // BUILD POST OBJECT
        // ==========================================

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
                image:
                    image.value.trim() ||
                    "/assets/ArchiveFilesBG.png",
                published: published.checked,
                pinned: pinned.checked,
                publishedAt: cleanDate
            };
        }

        // ==========================================
        // LIVE PREVIEW
        // ==========================================

        function updatePreview() {
            const cleanTitle =
                title.value.trim() ||
                "This Week at Blackwood";

            const cleanCategory =
                category.value ||
                "Weekly Dispatch";

            const cleanDate =
                date.value ||
                today;

            const cleanImage =
                image.value.trim() ||
                "/assets/ArchiveFilesBG.png";

            const cleanExcerpt =
                excerpt.value.trim() ||
                "A short preview of the dispatch will appear here.";

            const cleanBody =
                body.value.trim() ||
                "The full Behind the Files update will appear here as you draft it.";

            previewImage.src = cleanImage;
            previewCategory.textContent = cleanCategory;
            previewDate.textContent = formatDate(cleanDate);
            previewPinned.hidden = !pinned.checked;
            previewHeading.textContent = cleanTitle;
            previewExcerpt.textContent = cleanExcerpt;
            previewBody.innerHTML = formatPlainText(cleanBody);
        }

        // ==========================================
        // LOAD EXISTING POSTS
        // ==========================================

        async function loadExistingPosts() {
            const list =
                document.getElementById("bfa-existing-list");

            if (!list) {
                return;
            }

            try {
                const response = await fetch(
                    "/data/BFA.json?cache=" + Date.now()
                );

                if (!response.ok) {
                    throw new Error(
                        "BFA.json could not be loaded."
                    );
                }

                const data = await response.json();

                const posts = Array.isArray(data.posts)
                    ? data.posts
                    : [];

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
                            .localeCompare(
                                String(a.publishedAt || "")
                            );
                    })
                    .slice(0, 6)
                    .map(function (post) {
                        return `
                            <article class="bfa-existing-item">
                                <p class="bfa-status-pill">
                                    ${escapeHtml(
                                        post.category ||
                                        "Behind the Files"
                                    )}
                                </p>

                                <h3>
                                    ${escapeHtml(
                                        post.title ||
                                        "Untitled File"
                                    )}
                                </h3>

                                <p>
                                    ${escapeHtml(
                                        post.publishedAt ||
                                        "Undated"
                                    )}
                                    ${post.pinned ? "· Pinned" : ""}
                                    ${
                                        post.published === false
                                            ? "· Draft"
                                            : ""
                                    }
                                </p>
                            </article>
                        `;
                    })
                    .join("");

            } catch (error) {
                console.warn(
                    "Behind the Files posts could not be loaded:",
                    error
                );

                list.innerHTML = `
                    <article class="bfa-existing-item">
                        <p class="bfa-muted">
                            Existing posts could not be loaded yet.
                        </p>
                    </article>
                `;
            }
        }

        // ==========================================
        // STATUS MESSAGES
        // ==========================================

        function setStatus(message, className) {
            status.textContent = message || "";

            status.classList.remove(
                "is-success",
                "is-error"
            );

            if (className) {
                status.classList.add(className);
            }
        }

        return true;
    }

    // ==========================================
    // SHARED UTILITIES
    // ==========================================

    function createPostId(title, date) {
        const slug = String(title || "behind-file")
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "")
            .slice(0, 48);

        const random =
            Math.random().toString(36).slice(2, 7);

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
})();



Js next my friend, shall we do the old and new code?
