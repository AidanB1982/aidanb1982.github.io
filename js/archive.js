// =========================
// BLACKWOOD ARCHIVE
// Public Catalogue + Circle-Aware Archive Access
// Powered by Supabase
// =========================

(function () {
    "use strict";

    if (window.__BLACKWOOD_ARCHIVE_SCRIPT_LOADED__) {
        return;
    }

    window.__BLACKWOOD_ARCHIVE_SCRIPT_LOADED__ = true;

    const BLACKWOOD_ARCHIVE_CONFIG = {
        supabaseUrl: "https://bmnlynjldlnxfvunqbqq.supabase.co",
        supabaseKey: "sb_publishable_eL7qdDe_6XWGhzmdsql_7w_7dg6psC0",
        supabaseCdn: "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2",
        membersPagePath: "/pages/members.html"
    };

    const BlackwoodArchiveState = {
        app: null,
        client: null,
        session: null,
        titles: [],
        entries: [],
        restrictedCounts: []
    };

    document.addEventListener("DOMContentLoaded", function () {
        initBlackwoodArchive();
    });

    async function initBlackwoodArchive() {
        const app = document.getElementById("blackwood-archive-app");

        if (!app) {
            console.warn(
                "Blackwood Archive: #blackwood-archive-app not found."
            );
            return;
        }

        BlackwoodArchiveState.app = app;

        renderLoadingState();

        try {
            await loadSupabaseLibrary();

            BlackwoodArchiveState.client =
                window.supabase.createClient(
                    BLACKWOOD_ARCHIVE_CONFIG.supabaseUrl,
                    BLACKWOOD_ARCHIVE_CONFIG.supabaseKey,
                    {
                        auth: {
                            persistSession: true,
                            autoRefreshToken: true,
                            detectSessionInUrl: true
                        }
                    }
                );

            const { data, error } =
                await BlackwoodArchiveState.client.auth.getSession();

            if (error) {
                throw error;
            }

            BlackwoodArchiveState.session =
                data.session || null;

            await loadArchive();

        } catch (error) {
            console.error(
                "Blackwood Archive initialisation failed:",
                error
            );

            renderErrorState(
                "The Archive could not be opened. Please refresh and try again."
            );
        }
    }

    // =========================
    // SUPABASE
    // =========================

    function loadSupabaseLibrary() {
        return new Promise(function (resolve, reject) {
            if (
                window.supabase &&
                typeof window.supabase.createClient === "function"
            ) {
                resolve();
                return;
            }

            const existingScript =
                document.querySelector(
                    "script[data-blackwood-supabase]"
                );

            if (existingScript) {
                existingScript.addEventListener(
                    "load",
                    function () {
                        resolve();
                    },
                    { once: true }
                );

                existingScript.addEventListener(
                    "error",
                    function () {
                        reject(
                            new Error(
                                "Supabase could not be loaded."
                            )
                        );
                    },
                    { once: true }
                );

                return;
            }

            const script =
                document.createElement("script");

            script.src =
                BLACKWOOD_ARCHIVE_CONFIG.supabaseCdn;

            script.async = true;
            script.defer = true;
            script.dataset.blackwoodSupabase = "true";

            script.onload = function () {
                if (
                    window.supabase &&
                    typeof window.supabase.createClient ===
                        "function"
                ) {
                    resolve();
                    return;
                }

                reject(
                    new Error(
                        "Supabase loaded, but createClient was unavailable."
                    )
                );
            };

            script.onerror = function () {
                reject(
                    new Error(
                        "Supabase could not be loaded."
                    )
                );
            };

            document.head.appendChild(script);
        });
    }

    async function loadArchive() {
        renderLoadingState();

        try {
            const isCircleSession = Boolean(
                BlackwoodArchiveState.session &&
                BlackwoodArchiveState.session.user
            );

            /*
             * Signed-in Circle members read from the main
             * Archive tables.
             *
             * Signed-out visitors read from the public-safe
             * Archive sources.
             */
            const titlesSource =
                isCircleSession
                    ? "archive_titles"
                    : "archive_public_titles";

            const entriesSource =
                isCircleSession
                    ? "archive_entries"
                    : "archive_public_entries";

            let titlesQuery =
                BlackwoodArchiveState.client
                    .from(titlesSource)
                    .select("*");

            if (isCircleSession) {
                titlesQuery =
                    titlesQuery.eq(
                        "public_visible",
                        true
                    );
            }

            titlesQuery =
                titlesQuery.order(
                    "id",
                    {
                        ascending: true
                    }
                );

            const entriesQuery =
                BlackwoodArchiveState.client
                    .from(entriesSource)
                    .select("*")
                    .order(
                        "sort_order",
                        {
                            ascending: true
                        }
                    );

            const [
                titlesResult,
                entriesResult,
                restrictedCountsResult
            ] = await Promise.all([
                titlesQuery,

                entriesQuery,

                BlackwoodArchiveState.client
                    .rpc(
                        "get_archive_restricted_counts"
                    )
            ]);

            if (titlesResult.error) {
                throw titlesResult.error;
            }

            if (entriesResult.error) {
                throw entriesResult.error;
            }

            if (restrictedCountsResult.error) {
                throw restrictedCountsResult.error;
            }

            BlackwoodArchiveState.titles =
                Array.isArray(titlesResult.data)
                    ? titlesResult.data
                    : [];

            BlackwoodArchiveState.entries =
                Array.isArray(entriesResult.data)
                    ? entriesResult.data
                    : [];

            BlackwoodArchiveState.restrictedCounts =
                Array.isArray(
                    restrictedCountsResult.data
                )
                    ? restrictedCountsResult.data
                    : [];

            renderArchive();

        } catch (error) {
            console.error(
                "Blackwood Archive query failed:",
                error
            );

            renderErrorState(
                "Publication records could not be retrieved."
            );
        }
    }

    // =========================
    // ARCHIVE RENDERING
    // =========================

    function renderArchive() {
        const titles =
            BlackwoodArchiveState.titles;

        if (!titles.length) {
            BlackwoodArchiveState.app.innerHTML = `
                <section class="archive-empty">
                    <p class="archive-kicker">
                        Archive Index
                    </p>

                    <h2>
                        No records filed
                    </h2>

                    <p>
                        No public Blackwood publication records are
                        currently available.
                    </p>
                </section>
            `;

            return;
        }

        BlackwoodArchiveState.app.innerHTML = `
            <section
                class="archive-catalogue"
                aria-label="Blackwood publication archive"
            >
                ${titles
                    .map(renderArchiveTitle)
                    .join("")}
            </section>
        `;
    }

    function renderArchiveTitle(title) {
        const entries =
            getEntriesForTitle(title.id);

        const publicEntries =
            entries.filter(function (entry) {
                return entry.access_level === "public";
            });

        const circleEntries =
            entries.filter(function (entry) {
                return entry.access_level === "circle";
            });

        const isCircleSession = Boolean(
            BlackwoodArchiveState.session &&
            BlackwoodArchiveState.session.user
        );

        const restrictedCount =
            getRestrictedCountForTitle(title.id);

        const displayedRecordCount =
            isCircleSession
                ? entries.length
                : publicEntries.length;

        return `
            <article
                class="archive-record"
                id="${escapeAttribute(title.slug)}"
                data-archive-code="${escapeAttribute(
                    title.archive_code
                )}"
            >
                <header class="archive-record-header">
                    <div class="archive-record-reference">
                        <span>
                            Archive Record
                        </span>

                        <strong>
                            ${escapeHtml(
                                title.archive_code
                            )}
                        </strong>
                    </div>

                    <span
                        class="archive-status is-${escapeAttribute(
                            normaliseStatusClass(
                                title.publication_status
                            )
                        )}"
                    >
                        ${escapeHtml(
                            formatStatus(
                                title.publication_status
                            )
                        )}
                    </span>
                </header>

                <div class="archive-record-main">
                    ${renderCover(title)}

                    <div class="archive-record-copy">
                        <p class="archive-kicker">
                            Publication Record
                        </p>

                        <h2>
                            ${escapeHtml(title.title)}
                        </h2>

                        ${
                            title.subtitle
                                ? `
                                    <p class="archive-record-subtitle">
                                        ${escapeHtml(
                                            title.subtitle
                                        )}
                                    </p>
                                `
                                : ""
                        }

                        <p class="archive-record-author">
                            ${escapeHtml(
                                title.author_name
                            )}
                        </p>

                        ${renderSynopsis(title)}

                        ${renderPublicationMetadata(title)}
                    </div>
                </div>

                <section
                    class="archive-associated-records"
                    aria-labelledby="archive-associated-${Number(
                        title.id
                    )}"
                >
                    <div class="archive-associated-heading">
                        <div>
                            <p class="archive-kicker">
                                Filed Material
                            </p>

                            <h3
                                id="archive-associated-${Number(
                                    title.id
                                )}"
                            >
                                Associated Records
                            </h3>
                        </div>

                        <span>
                            ${escapeHtml(
                                formatRecordCount(
                                    displayedRecordCount
                                )
                            )}
                        </span>
                    </div>

                    <div class="archive-entry-list">
                        ${
                            publicEntries.length
                                ? publicEntries
                                    .map(
                                        renderArchiveEntry
                                    )
                                    .join("")
                                : `
                                    <p class="archive-muted">
                                        No public associated records
                                        are currently filed.
                                    </p>
                                `
                        }

                        ${
                            isCircleSession
                                ? circleEntries
                                    .map(
                                        renderArchiveEntry
                                    )
                                    .join("")
                                : renderRestrictedNotice(
                                    title,
                                    restrictedCount
                                )
                        }
                    </div>
                </section>
            </article>
        `;
    }

    function renderCover(title) {
        if (!title.cover_image_path) {
            return `
                <div
                    class="archive-cover archive-cover-placeholder"
                    aria-hidden="true"
                >
                    <span>
                        ${escapeHtml(
                            title.archive_code
                        )}
                    </span>

                    <strong>
                        Blackwood
                    </strong>
                </div>
            `;
        }

        return `
            <figure class="archive-cover">
                <img
                    src="${escapeAttribute(
                        title.cover_image_path
                    )}"
                    alt="${escapeAttribute(
                        `${title.title} by ${title.author_name}`
                    )}"
                    loading="lazy"
                >
            </figure>
        `;
    }

    function renderSynopsis(title) {
        if (!title.synopsis) {
            return "";
        }

        return `
            <div class="archive-synopsis">
                ${formatPlainTextAsHtml(
                    title.synopsis
                )}
            </div>
        `;
    }

    function renderPublicationMetadata(title) {
        const metadata = [];

        metadata.push({
            label: "Status",
            value: formatStatus(
                title.publication_status
            )
        });

        if (title.publication_date) {
            metadata.push({
                label: "Published",
                value: formatDate(
                    title.publication_date
                )
            });
        }

        if (title.series_name) {
            const seriesPosition =
                Number(title.series_position) > 0
                    ? ` · Book ${Number(
                        title.series_position
                    )}`
                    : "";

            metadata.push({
                label: "Series",
                value:
                    `${title.series_name}${seriesPosition}`
            });
        }

        if (title.isbn_paperback) {
            metadata.push({
                label: "Paperback ISBN",
                value: title.isbn_paperback
            });
        }

        if (title.isbn_hardback) {
            metadata.push({
                label: "Hardback ISBN",
                value: title.isbn_hardback
            });
        }

        if (title.isbn_ebook) {
            metadata.push({
                label: "eBook ISBN",
                value: title.isbn_ebook
            });
        }

        return `
            <dl class="archive-metadata">
                ${metadata
                    .map(function (item) {
                        return `
                            <div>
                                <dt>
                                    ${escapeHtml(
                                        item.label
                                    )}
                                </dt>

                                <dd>
                                    ${escapeHtml(
                                        item.value
                                    )}
                                </dd>
                            </div>
                        `;
                    })
                    .join("")}
            </dl>
        `;
    }

    function renderArchiveEntry(entry) {
        return `
            <article
                class="archive-entry is-${escapeAttribute(
                    normaliseStatusClass(
                        entry.entry_status
                    )
                )}"
            >
                <div class="archive-entry-reference">
                    <span>
                        ${escapeHtml(
                            getEntryReference(
                                entry.entry_code
                            )
                        )}
                    </span>

                    <strong>
                        ${escapeHtml(
                            formatStatus(
                                entry.entry_status
                            )
                        )}
                    </strong>
                </div>

                <div class="archive-entry-copy">
                    <p class="archive-entry-type">
                        ${escapeHtml(
                            formatEntryType(
                                entry.entry_type
                            )
                        )}
                    </p>

                    <h4>
                        ${escapeHtml(entry.title)}
                    </h4>

                    ${
                        entry.summary
                            ? `
                                <p>
                                    ${escapeHtml(
                                        entry.summary
                                    )}
                                </p>
                            `
                            : ""
                    }

                    ${
                        entry.body
                            ? `
                                <div class="archive-entry-body">
                                    ${formatPlainTextAsHtml(
                                        entry.body
                                    )}
                                </div>
                            `
                            : ""
                    }

                    ${renderEntryMedia(entry)}
                </div>
            </article>
        `;
    }

    function renderEntryMedia(entry) {
        if (!entry.media_path) {
            return "";
        }

        if (entry.entry_type === "photograph") {
            return `
                <figure class="archive-entry-media">
                    <img
                        src="${escapeAttribute(
                            entry.media_path
                        )}"
                        alt="${escapeAttribute(
                            entry.media_alt || ""
                        )}"
                        loading="lazy"
                    >
                </figure>
            `;
        }

        if (entry.entry_type === "audio") {
            return `
                <div class="archive-audio-record">
                    <p>
                        Archive audio filed.
                    </p>

                    <audio
                        controls
                        preload="none"
                    >
                        <source
                            src="${escapeAttribute(
                                entry.media_path
                            )}"
                        >
                    </audio>
                </div>
            `;
        }

        return `
            <p class="archive-file-link">
                <a
                    href="${escapeAttribute(
                        entry.media_path
                    )}"
                    target="_blank"
                    rel="noopener"
                >
                    Open filed material
                </a>
            </p>
        `;
    }

    function renderRestrictedNotice(
    title,
    restrictedCount
) {
    const count =
        Number(restrictedCount || 0);

    if (count < 1) {
        return "";
    }

    const recordText =
        count === 1
            ? "1 additional record held"
            : `${count} additional records held`;

    return `
        <aside class="archive-restricted-notice">
            <div
                class="archive-restricted-mark"
                aria-hidden="true"
            >
                BW
            </div>

            <div>
                <p class="archive-kicker">
                    Restricted Material
                </p>

                <h4>
                    ${escapeHtml(recordText)}
                </h4>

                <p>
                    Selected material associated with this
                    publication is held under Blackwood
                    Circle access.
                </p>

                <a
                    href="${escapeAttribute(
                        BLACKWOOD_ARCHIVE_CONFIG
                            .membersPagePath
                    )}"
                >
                    Blackwood Circle access
                </a>
            </div>
        </aside>
    `;
}

    // =========================
    // HELPERS
    // =========================

    function getEntriesForTitle(titleId) {
        return BlackwoodArchiveState.entries
            .filter(function (entry) {
                return (
                    Number(entry.title_id) ===
                    Number(titleId)
                );
            });
    }

    function getRestrictedCountForTitle(titleId) {
        const record =
            BlackwoodArchiveState.restrictedCounts
                .find(function (item) {
                    return (
                        Number(item.title_id) ===
                        Number(titleId)
                    );
                });

        return record
            ? Number(
                record.restricted_count || 0
            )
            : 0;
    }

    function getEntryReference(entryCode) {
        const code =
            String(entryCode || "");

        if (!code) {
            return "UNFILED";
        }

        const parts =
            code.split("/");

        return parts.length > 1
            ? parts[parts.length - 1]
            : code;
    }

    function formatRecordCount(count) {
        const cleanCount =
            Number(count || 0);

        return cleanCount === 1
            ? "1 record"
            : `${cleanCount} records`;
    }

    function formatEntryType(value) {
        const cleanValue =
            String(value || "record")
                .trim()
                .replace(/_/g, " ");

        return cleanValue.replace(
            /\b\w/g,
            function (character) {
                return character.toUpperCase();
            }
        );
    }

    function formatStatus(value) {
        const cleanValue =
            String(value || "")
                .trim()
                .replace(/_/g, " ");

        if (!cleanValue) {
            return "Filed";
        }

        return cleanValue.replace(
            /\b\w/g,
            function (character) {
                return character.toUpperCase();
            }
        );
    }

    function normaliseStatusClass(value) {
        return String(value || "filed")
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "");
    }

    function formatDate(value) {
        if (!value) {
            return "";
        }

        const date =
            new Date(`${value}T12:00:00`);

        if (Number.isNaN(date.getTime())) {
            return String(value);
        }

        return date.toLocaleDateString(
            "en-GB",
            {
                day: "2-digit",
                month: "long",
                year: "numeric"
            }
        );
    }

    function formatPlainTextAsHtml(value) {
        const text =
            escapeHtml(value || "");

        if (!text) {
            return "";
        }

        return text
            .split(/\n{2,}/)
            .map(function (paragraph) {
                return `
                    <p>
                        ${paragraph.replace(
                            /\n/g,
                            "<br>"
                        )}
                    </p>
                `;
            })
            .join("");
    }

    // =========================
    // STATES
    // =========================

    function renderLoadingState() {
        if (!BlackwoodArchiveState.app) {
            return;
        }

        BlackwoodArchiveState.app.innerHTML = `
            <section class="archive-loading">
                <p class="archive-kicker">
                    Archive Index
                </p>

                <h2>
                    Opening the files...
                </h2>

                <p>
                    Publication records are being retrieved.
                </p>
            </section>
        `;
    }

    function renderErrorState(message) {
        if (!BlackwoodArchiveState.app) {
            return;
        }

        BlackwoodArchiveState.app.innerHTML = `
            <section class="archive-error">
                <p class="archive-kicker">
                    Archive Index
                </p>

                <h2>
                    Record unavailable
                </h2>

                <p>
                    ${escapeHtml(message)}
                </p>
            </section>
        `;
    }

    // =========================
    // ESCAPING
    // =========================

    function escapeHtml(value) {
        return String(value || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function escapeAttribute(value) {
        return escapeHtml(value)
            .replace(/`/g, "&#096;");
    }

})();
