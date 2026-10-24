
"use strict";

// ==========================================
// BLACKWOOD PUBLISHING
// PUBLISHING INVENTORY — DEPARTMENT 02
//
// Read-only catalogue from Supabase.
// Administrator verification.
// Searchable titles, editions and distributors.
//
// Does not modify Behind the Files.
// Does not write or delete database records.
// ==========================================

(function () {
    const SUPABASE_URL =
        "https://bmnlynjldlnxfvunqbqq.supabase.co";

    const SUPABASE_PUBLISHABLE_KEY =
        "sb_publishable_eL7qdDe_6XWGhzmdsql_7w_7dg6psC0";

    const SUPABASE_CDN =
        "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";

    let supabaseClient = null;
    let catalogue = [];
    let accessCheckVersion = 0;

    function $(id) {
        return document.getElementById(id);
    }

    // ==========================================
    // PAGE INITIALISATION
    // ==========================================

    window.addEventListener("load", async function () {
        if (!$("pi-access-screen") || !$("pi-admin-content")) {
            console.error(
                "Publishing Inventory: Required page elements missing."
            );
            return;
        }

        lockInventory();

        try {
            if (typeof loadHeader === "function") {
                await loadHeader("simple");
            }
        } catch (error) {
            console.warn(
                "Publishing Inventory: Header could not be loaded.",
                error
            );
        }

        await initializeAccess();
    });

    // ==========================================
    // SUPABASE INITIALISATION
    // ==========================================

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
                        new Error("Supabase library is unavailable.")
                    );
                }
            };

            script.onerror = function () {
                reject(
                    new Error("Failed to load Supabase.")
                );
            };

            document.head.appendChild(script);
        });
    }

    async function initializeAccess() {
        showAccessMessage(
            "Checking your Blackwood management credentials..."
        );

        try {
            await loadSupabaseLibrary();

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

            supabaseClient.auth.onAuthStateChange(function (event) {
                if (event === "SIGNED_OUT") {
                    accessCheckVersion += 1;
                    lockInventory();

                    showAccessMessage(
                        "Your session has ended. Please sign in again."
                    );

                    return;
                }

                if (
                    event === "SIGNED_IN" ||
                    event === "TOKEN_REFRESHED" ||
                    event === "USER_UPDATED"
                ) {
                    window.setTimeout(function () {
                        verifyAccess();
                    }, 0);
                }
            });

            await verifyAccess();

        } catch (error) {
            console.error(
                "Publishing Inventory: Authentication failed.",
                error
            );

            lockInventory();

            showAccessMessage(
                "Unable to verify management access."
            );
        }
    }

    // ==========================================
    // ADMINISTRATOR ACCESS
    // ==========================================

    function lockInventory() {
        const content = $("pi-admin-content");
        const screen = $("pi-access-screen");

        if (content) {
            content.hidden = true;
        }

        if (screen) {
            screen.hidden = false;
        }

        catalogue = [];
    }

    function unlockInventory() {
        $("pi-admin-content").hidden = false;
        $("pi-access-screen").hidden = true;
    }

    function showAccessMessage(message) {
        const element = $("pi-access-message");

        if (element) {
            element.textContent = message;
        }
    }

    async function verifyAccess() {
        const version = ++accessCheckVersion;

        lockInventory();

        showAccessMessage(
            "Checking your administrator permission..."
        );

        try {
            const result = await supabaseClient.auth.getUser();

            if (version !== accessCheckVersion) {
                return;
            }

            if (result.error || !result.data.user) {
                showAccessMessage(
                    "Please sign in through The Archivists first."
                );
                return;
            }

            const profileResult = await supabaseClient
                .from("member_profiles")
                .select("is_admin")
                .eq("id", result.data.user.id)
                .maybeSingle();

            if (version !== accessCheckVersion) {
                return;
            }

            if (profileResult.error) {
                throw profileResult.error;
            }

            const isAdmin =
                profileResult.data &&
                (
                    profileResult.data.is_admin === true ||
                    String(
                        profileResult.data.is_admin
                    ).toLowerCase() === "true"
                );

            if (!isAdmin) {
                showAccessMessage(
                    "Access denied. This department is reserved " +
                    "for Blackwood Publishing management."
                );
                return;
            }

            unlockInventory();
            await loadCatalogue(version);

        } catch (error) {
            if (version !== accessCheckVersion) {
                return;
            }

            console.error(
                "Publishing Inventory: Access check failed.",
                error
            );

            lockInventory();

            showAccessMessage(
                "Unable to verify administrator access."
            );
        }
    }

    // ==========================================
    // LOAD PUBLISHING CATALOGUE
    // ==========================================

    async function loadCatalogue(version) {
        setStatus("Loading the Blackwood catalogue...");

        try {
            const result = await supabaseClient
                .from("publishing_titles")
                .select(`
                    id,
                    title,
                    author_name,
                    publishing_editions (
                        id,
                        edition_title,
                        format,
                        isbn,
                        asin,
                        publishing_distribution (
                            id,
                            platform,
                            listing_status,
                            platform_format,
                            submitted_at,
                            platform_publication_date
                        )
                    )
                `)
                .order("title", { ascending: true });

            if (version !== accessCheckVersion) {
                return;
            }

            if (result.error) {
                throw result.error;
            }

            catalogue = result.data || [];

            catalogue.forEach(function (book) {
                book.publishing_editions =
                    (book.publishing_editions || []).sort(
                        function (a, b) {
                            return String(a.format || "")
                                .localeCompare(
                                    String(b.format || "")
                                );
                        }
                    );
            });

            updateStatistics();
            renderCatalogue();

        } catch (error) {
            if (version !== accessCheckVersion) {
                return;
            }

            console.error(
                "Publishing Inventory: Catalogue load failed.",
                error
            );

            setStatus(
                "The catalogue could not be loaded. " +
                "Please refresh and try again."
            );
        }
    }

    // ==========================================
    // STATISTICS
    // ==========================================

    function updateStatistics() {
        const editions = catalogue.flatMap(function (book) {
            return book.publishing_editions || [];
        });

        const distributions = editions.flatMap(
            function (edition) {
                return edition.publishing_distribution || [];
            }
        );

        $("pi-title-count").textContent =
            String(catalogue.length);

        $("pi-edition-count").textContent =
            String(editions.length);

        $("pi-kdp-count").textContent =
            String(
                distributions.filter(function (item) {
                    return item.platform === "kdp";
                }).length
            );

        $("pi-ingram-count").textContent =
            String(
                distributions.filter(function (item) {
                    return item.platform === "ingramspark";
                }).length
            );
    }

    // ==========================================
    // SEARCH AND DISPLAY
    // ==========================================

    function escapeHtml(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function displayValue(value) {
        if (
            value === null ||
            value === undefined ||
            value === ""
        ) {
            return "—";
        }

        return escapeHtml(value);
    }

    function formatDate(value) {
        if (!value) {
            return "—";
        }

        const date = new Date(value + "T12:00:00");

        if (Number.isNaN(date.getTime())) {
            return displayValue(value);
        }

        return escapeHtml(
            date.toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric"
            })
        );
    }

    function renderDistribution(item) {
        const name =
            item.platform === "kdp"
                ? "Amazon KDP"
                : item.platform === "ingramspark"
                    ? "IngramSpark"
                    : item.platform;

        const details = [];

        if (item.listing_status) {
            details.push(
                "<p>Status: " +
                displayValue(item.listing_status) +
                "</p>"
            );
        }

        if (item.platform_format) {
            details.push(
                "<p>Platform format: " +
                displayValue(item.platform_format) +
                "</p>"
            );
        }

        if (item.submitted_at) {
            details.push(
                "<p>Submitted: " +
                formatDate(item.submitted_at) +
                "</p>"
            );
        }

        if (item.platform_publication_date) {
            details.push(
                "<p>Publication date: " +
                formatDate(item.platform_publication_date) +
                "</p>"
            );
        }

        return (
            '<div class="pi-distribution-details">' +
                "<strong>" + escapeHtml(name) + "</strong>" +
                details.join("") +
            "</div>"
        );
    }

    function renderEdition(edition) {
        const distributions =
            edition.publishing_distribution || [];

        const badges = distributions.map(function (item) {
            const name =
                item.platform === "kdp"
                    ? "Amazon KDP"
                    : item.platform === "ingramspark"
                        ? "IngramSpark"
                        : item.platform;

            return (
                '<span class="pi-platform">' +
                escapeHtml(name) +
                "</span>"
            );
        }).join("");

        const heading =
            edition.edition_title ||
            edition.format ||
            "Edition";

        return `
            <article class="pi-edition">
                <h3>${displayValue(heading)}</h3>

                <dl>
                    <dt>Format</dt>
                    <dd>${displayValue(edition.format)}</dd>

                    <dt>ISBN</dt>
                    <dd>${displayValue(edition.isbn)}</dd>

                    <dt>ASIN</dt>
                    <dd>${displayValue(edition.asin)}</dd>
                </dl>

                <div class="pi-distributors">
                    ${badges}
                </div>

                ${distributions.map(renderDistribution).join("")}
            </article>
        `;
    }

    function renderBook(book) {
        const editions = book.publishing_editions || [];

        return `
            <details class="pi-book">
                <summary>
                    <span class="pi-book-title">
                        ${displayValue(book.title)}
                    </span>

                    <span class="pi-book-author">
                        ${displayValue(book.author_name)}
                    </span>

                    <span class="pi-book-count">
                        ${editions.length}
                        ${editions.length === 1 ? "edition" : "editions"}
                    </span>
                </summary>

                <div class="pi-editions">
                    ${editions.map(renderEdition).join("")}
                </div>
            </details>
        `;
    }

    function renderCatalogue() {
        const container = $("pi-catalogue");

        if (!container) {
            return;
        }

        const search =
            ($("pi-search")?.value || "")
                .trim()
                .toLowerCase();

        const matching = catalogue.filter(function (book) {
            const terms = [
                book.title,
                book.author_name
            ];

            (book.publishing_editions || []).forEach(
                function (edition) {
                    terms.push(
                        edition.edition_title,
                        edition.format,
                        edition.isbn,
                        edition.asin
                    );

                    (edition.publishing_distribution || [])
                        .forEach(function (item) {
                            terms.push(
                                item.platform,
                                item.listing_status
                            );
                        });
                }
            );

            return terms
                .filter(Boolean)
                .join(" ")
                .toLowerCase()
                .includes(search);
        });

        if (!matching.length) {
            container.innerHTML =
                '<p class="pi-empty">No matching titles found.</p>';

            setStatus("No matching titles.");
            return;
        }

        container.innerHTML =
            matching.map(renderBook).join("");

        setStatus(
            "Showing " + matching.length +
            " of " + catalogue.length + " titles."
        );
    }

    // ==========================================
    // STATUS
    // ==========================================

    function setStatus(message) {
        const element = $("pi-status");

        if (element) {
            element.textContent = message;
        }
    }

    // Search input is attached once the DOM is ready.
    document.addEventListener("DOMContentLoaded", function () {
        const search = $("pi-search");

        if (search) {
            search.addEventListener("input", renderCatalogue);
        }
    });
})();
