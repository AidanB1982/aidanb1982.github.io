// =========================
// BLACKWOOD ARCHIVE
// Public Catalogue + Circle-Aware Archive Access
// Cabinet + Case File System
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
        restrictedCounts: [],
        activeEntryId: null,
        activeDrawer: null,
        modal: null,
        lastFocusedElement: null
    };

    document.addEventListener("DOMContentLoaded", function () {
        initBlackwoodArchive();
    });

    // =========================
    // INITIALISATION
    // =========================

    async function initBlackwoodArchive() {
        const app =
            document.getElementById(
                "blackwood-archive-app"
            );

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
            const isCircleSession =
                isSignedInCircleMember();

            /*
             * Signed-in Circle members read from the main
             * Archive tables.
             *
             * Signed-out visitors read only from the
             * public-safe Archive sources.
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

        closeCaseFile(false);

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

        bindArchiveCabinets();
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

        const isCircleSession =
            isSignedInCircleMember();

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

                ${renderArchiveCabinet(
                    title,
                    publicEntries,
                    circleEntries,
                    restrictedCount,
                    displayedRecordCount,
                    isCircleSession
                )}
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

    // =========================
    // ARCHIVE CABINET
    // =========================

    function renderArchiveCabinet(
        title,
        publicEntries,
        circleEntries,
        restrictedCount,
        displayedRecordCount,
        isCircleSession
    ) {
        const visibleEntries =
            isCircleSession
                ? publicEntries.concat(circleEntries)
                : publicEntries;

        const sortedEntries =
            visibleEntries
                .slice()
                .sort(function (a, b) {
                    return (
                        Number(a.sort_order || 0) -
                        Number(b.sort_order || 0)
                    );
                });

        const hasRestrictedDrawer =
            !isCircleSession &&
            Number(restrictedCount || 0) > 0;

        const hasAnyDrawer =
            sortedEntries.length > 0 ||
            hasRestrictedDrawer;

        return `
            <section
                class="archive-associated-records archive-cabinet-section"
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

                        <p class="archive-cabinet-intro">
                            Additional material associated with this
                            publication, held in the Blackwood Archive.
                            Open a drawer to view the file.
                        </p>
                    </div>

                    <span>
                        ${escapeHtml(
                            formatRecordCount(
                                displayedRecordCount
                            )
                        )}
                    </span>
                </div>

                ${
                    hasAnyDrawer
                        ? `
                            <div
                                class="archive-cabinet"
                                data-archive-cabinet="${Number(
                                    title.id
                                )}"
                            >
                                <div
                                    class="archive-cabinet-top"
                                    aria-hidden="true"
                                ></div>

                                <div class="archive-cabinet-body">
                                    ${sortedEntries
                                        .map(function (entry) {
                                            return renderArchiveDrawer(
                                                entry,
                                                title
                                            );
                                        })
                                        .join("")}

                                    ${
                                        hasRestrictedDrawer
                                            ? renderRestrictedDrawer(
                                                title,
                                                restrictedCount
                                            )
                                            : ""
                                    }
                                </div>

                                <div
                                    class="archive-cabinet-base"
                                    aria-hidden="true"
                                ></div>
                            </div>
                        `
                        : `
                            <p class="archive-muted">
                                No associated records are currently filed.
                            </p>
                        `
                }
            </section>
        `;
    }

    function renderArchiveDrawer(entry, title) {
        const entryId =
            Number(entry.id);

        const reference =
            getEntryReference(
                entry.entry_code
            );

        const type =
            formatEntryType(
                entry.entry_type
            );

        const status =
            formatStatus(
                entry.entry_status
            );

        const statusClass =
            normaliseStatusClass(
                entry.entry_status
            );

        return `
            <div
                class="archive-drawer-shell is-${escapeAttribute(
                    statusClass
                )}"
            >
                <button
                    class="archive-drawer"
                    type="button"
                    data-archive-entry-id="${entryId}"
                    aria-haspopup="dialog"
                    aria-expanded="false"
                    aria-label="${escapeAttribute(
                        `Open ${reference} ${type}`
                    )}"
                >
                    <span
                        class="archive-drawer-pull"
                        aria-hidden="true"
                    >
                        <span></span>
                    </span>

                    <span class="archive-drawer-label">
                        <span class="archive-drawer-reference">
                            ${escapeHtml(reference)}
                        </span>

                        <span class="archive-drawer-title">
                            ${escapeHtml(
                                getDrawerLabel(entry)
                            )}
                        </span>

                        <span class="archive-drawer-book">
                            ${escapeHtml(title.title)}
                        </span>
                    </span>

                    <span
                        class="archive-drawer-status is-${escapeAttribute(
                            statusClass
                        )}"
                    >
                        ${escapeHtml(status)}
                    </span>
                </button>
            </div>
        `;
    }

    function renderRestrictedDrawer(
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
            <div
                class="archive-drawer-shell archive-drawer-shell-restricted"
            >
                <button
                    class="archive-drawer archive-drawer-restricted"
                    type="button"
                    data-archive-restricted-title-id="${Number(
                        title.id
                    )}"
                    aria-haspopup="dialog"
                    aria-expanded="false"
                    aria-label="Open restricted files notice"
                >
                    <span
                        class="archive-drawer-pull"
                        aria-hidden="true"
                    >
                        <span></span>
                    </span>

                    <span class="archive-drawer-label">
                        <span class="archive-drawer-reference">
                            Restricted
                        </span>

                        <span class="archive-drawer-title">
                            Restricted Files
                        </span>

                        <span class="archive-drawer-book">
                            ${escapeHtml(recordText)}
                        </span>
                    </span>

                    <span class="archive-drawer-status is-restricted">
                        Circle
                    </span>
                </button>
            </div>
        `;
    }

    function getDrawerLabel(entry) {
        const type =
            String(entry.entry_type || "")
                .toLowerCase();

        const labels = {
            history: "Publication Record",
            photograph: "Photographic Record",
            manuscript: "Manuscript File",
            deleted_material: "Deleted Material",
            author_note: "Author Note",
            production_note: "Production Note",
            edition: "Edition Record",
            audio: "Audio Record",
            document: "Document File",
            other: "Archive Record"
        };

        return labels[type] ||
            formatEntryType(type);
    }

    // =========================
    // CABINET EVENTS
    // =========================

    function bindArchiveCabinets() {
        if (!BlackwoodArchiveState.app) {
            return;
        }

        const drawers =
            BlackwoodArchiveState.app
                .querySelectorAll(
                    ".archive-drawer[data-archive-entry-id]"
                );

        drawers.forEach(function (drawer) {
            drawer.addEventListener(
                "click",
                function () {
                    const entryId =
                        Number(
                            drawer.dataset.archiveEntryId
                        );

                    openArchiveDrawer(
                        drawer,
                        entryId
                    );
                }
            );
        });

        const restrictedDrawers =
            BlackwoodArchiveState.app
                .querySelectorAll(
                    ".archive-drawer[data-archive-restricted-title-id]"
                );

        restrictedDrawers.forEach(function (drawer) {
            drawer.addEventListener(
                "click",
                function () {
                    const titleId =
                        Number(
                            drawer.dataset
                                .archiveRestrictedTitleId
                        );

                    openRestrictedDrawer(
                        drawer,
                        titleId
                    );
                }
            );
        });
    }

    function openArchiveDrawer(
        drawer,
        entryId
    ) {
        const entry =
            getEntryById(entryId);

        if (!entry) {
            console.warn(
                "Blackwood Archive: entry not found.",
                entryId
            );
            return;
        }

        closeActiveDrawer();

        BlackwoodArchiveState.activeDrawer =
            drawer;

        BlackwoodArchiveState.activeEntryId =
            entryId;

        BlackwoodArchiveState.lastFocusedElement =
            drawer;

        drawer.classList.add("is-open");
        drawer.setAttribute(
            "aria-expanded",
            "true"
        );

        const shell =
            drawer.closest(
                ".archive-drawer-shell"
            );

        if (shell) {
            shell.classList.add("is-open");
        }

        /*
         * The short delay allows the drawer movement
         * to begin before the case file appears.
         */
        window.setTimeout(
            function () {
                if (
                    BlackwoodArchiveState.activeEntryId !==
                    entryId
                ) {
                    return;
                }

                openCaseFile(entry);
            },
            260
        );
    }

    function openRestrictedDrawer(
        drawer,
        titleId
    ) {
        const title =
            getTitleById(titleId);

        if (!title) {
            return;
        }

        closeActiveDrawer();

        BlackwoodArchiveState.activeDrawer =
            drawer;

        BlackwoodArchiveState.activeEntryId =
            null;

        BlackwoodArchiveState.lastFocusedElement =
            drawer;

        drawer.classList.add("is-open");
        drawer.setAttribute(
            "aria-expanded",
            "true"
        );

        const shell =
            drawer.closest(
                ".archive-drawer-shell"
            );

        if (shell) {
            shell.classList.add("is-open");
        }

        window.setTimeout(
            function () {
                if (
                    BlackwoodArchiveState.activeDrawer !==
                    drawer
                ) {
                    return;
                }

                openRestrictedCaseFile(
                    title
                );
            },
            260
        );
    }

    function closeActiveDrawer() {
        const drawer =
            BlackwoodArchiveState.activeDrawer;

        if (!drawer) {
            return;
        }

        drawer.classList.remove("is-open");

        drawer.setAttribute(
            "aria-expanded",
            "false"
        );

        const shell =
            drawer.closest(
                ".archive-drawer-shell"
            );

        if (shell) {
            shell.classList.remove("is-open");
        }

        BlackwoodArchiveState.activeDrawer =
            null;

        BlackwoodArchiveState.activeEntryId =
            null;
    }

    // =========================
    // CASE FILE MODAL
    // =========================

    function openCaseFile(entry) {
        const title =
            getTitleById(
                entry.title_id
            );

        if (!title) {
            return;
        }

        removeExistingModal();

        const modal =
            document.createElement("div");

        modal.className =
            "archive-case-modal";

        modal.dataset.archiveCaseModal =
            "true";

        modal.innerHTML =
            renderCaseFileModal(
                entry,
                title
            );

        document.body.appendChild(modal);

        BlackwoodArchiveState.modal =
            modal;

        document.body.classList.add(
            "archive-case-is-open"
        );

        bindCaseFileModal(modal);

        window.requestAnimationFrame(
            function () {
                modal.classList.add(
                    "is-visible"
                );
            }
        );

        const closeButton =
            modal.querySelector(
                ".archive-case-close"
            );

        if (closeButton) {
            closeButton.focus();
        }
    }

    function openRestrictedCaseFile(title) {
        const restrictedCount =
            getRestrictedCountForTitle(
                title.id
            );

        removeExistingModal();

        const modal =
            document.createElement("div");

        modal.className =
            "archive-case-modal";

        modal.dataset.archiveCaseModal =
            "true";

        modal.innerHTML =
            renderRestrictedCaseFileModal(
                title,
                restrictedCount
            );

        document.body.appendChild(modal);

        BlackwoodArchiveState.modal =
            modal;

        document.body.classList.add(
            "archive-case-is-open"
        );

        bindCaseFileModal(modal);

        window.requestAnimationFrame(
            function () {
                modal.classList.add(
                    "is-visible"
                );
            }
        );

        const closeButton =
            modal.querySelector(
                ".archive-case-close"
            );

        if (closeButton) {
            closeButton.focus();
        }
    }

    function renderCaseFileModal(
        entry,
        title
    ) {
        const reference =
            getEntryReference(
                entry.entry_code
            );

        const status =
            formatStatus(
                entry.entry_status
            );

        const statusClass =
            normaliseStatusClass(
                entry.entry_status
            );

        return `
            <div
                class="archive-case-backdrop"
                data-archive-case-close
                aria-hidden="true"
            ></div>

            <section
                class="archive-case-window"
                role="dialog"
                aria-modal="true"
                aria-labelledby="archive-case-title-${Number(
                    entry.id
                )}"
            >
                <button
                    class="archive-case-close"
                    type="button"
                    data-archive-case-close
                    aria-label="Close archive case file"
                >
                    <span aria-hidden="true">
                        ×
                    </span>
                </button>

                <div
                    class="archive-case-folder"
                >
                    <div
                        class="archive-case-folder-tab"
                        aria-hidden="true"
                    >
                        BLACKWOOD ARCHIVE
                    </div>

                    <div class="archive-case-paper">
                        <header class="archive-case-header">
                            <div class="archive-case-reference">
                                <span>
                                    ${escapeHtml(
                                        title.archive_code
                                    )}
                                    /
                                    ${escapeHtml(
                                        reference
                                    )}
                                </span>

                                <strong>
                                    Case File
                                </strong>
                            </div>

                            <span
                                class="archive-case-status is-${escapeAttribute(
                                    statusClass
                                )}"
                            >
                                ${escapeHtml(
                                    status
                                )}
                            </span>
                        </header>

                        <div class="archive-case-heading">
                            <p class="archive-case-kicker">
                                ${escapeHtml(
                                    formatEntryType(
                                        entry.entry_type
                                    )
                                )}
                            </p>

                            <h2
                                id="archive-case-title-${Number(
                                    entry.id
                                )}"
                            >
                                ${escapeHtml(
                                    entry.title
                                )}
                            </h2>

                            <p class="archive-case-book">
                                ${escapeHtml(
                                    title.title
                                )}
                            </p>
                        </div>

                        ${renderCaseFileDetails(
                            entry,
                            title
                        )}

                        ${
                            entry.summary
                                ? `
                                    <div class="archive-case-summary">
                                        <p>
                                            ${escapeHtml(
                                                entry.summary
                                            )}
                                        </p>
                                    </div>
                                `
                                : ""
                        }

                        ${
                            entry.body
                                ? `
                                    <div class="archive-case-body">
                                        ${formatPlainTextAsHtml(
                                            entry.body
                                        )}
                                    </div>
                                `
                                : ""
                        }

                        ${renderCaseFileMedia(entry)}

                        <footer class="archive-case-footer">
                            <span>
                                Blackwood Publishing Archive
                            </span>

                            <span>
                                ${escapeHtml(
                                    entry.entry_code
                                )}
                            </span>
                        </footer>
                    </div>
                </div>
            </section>
        `;
    }

    function renderCaseFileDetails(
        entry,
        title
    ) {
        const details = [];

        details.push({
            label: "Archive",
            value: title.archive_code
        });

        details.push({
            label: "Reference",
            value: getEntryReference(
                entry.entry_code
            )
        });

        details.push({
            label: "Classification",
            value: formatEntryType(
                entry.entry_type
            )
        });

        details.push({
            label: "Status",
            value: formatStatus(
                entry.entry_status
            )
        });

        if (entry.occurred_at) {
            details.push({
                label: "Record Date",
                value: formatDate(
                    entry.occurred_at
                )
            });
        }

        return `
            <dl class="archive-case-details">
                ${details
                    .map(function (detail) {
                        return `
                            <div>
                                <dt>
                                    ${escapeHtml(
                                        detail.label
                                    )}
                                </dt>

                                <dd>
                                    ${escapeHtml(
                                        detail.value
                                    )}
                                </dd>
                            </div>
                        `;
                    })
                    .join("")}
            </dl>
        `;
    }

    function renderCaseFileMedia(entry) {
        if (!entry.media_path) {
            return renderMissingCaseMaterial(
                entry
            );
        }

        if (entry.entry_type === "photograph") {
            return `
                <figure class="archive-case-media archive-case-photograph">
                    <div class="archive-case-photo-mount">
                        <img
                            src="${escapeAttribute(
                                entry.media_path
                            )}"
                            alt="${escapeAttribute(
                                entry.media_alt || ""
                            )}"
                        >
                    </div>

                    ${
                        entry.media_alt
                            ? `
                                <figcaption>
                                    ${escapeHtml(
                                        entry.media_alt
                                    )}
                                </figcaption>
                            `
                            : ""
                    }
                </figure>
            `;
        }

        if (entry.entry_type === "audio") {
            return `
                <section class="archive-case-audio">
                    <p class="archive-case-audio-label">
                        Archive Audio
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
                </section>
            `;
        }

        return `
            <div class="archive-case-file-link">
                <a
                    href="${escapeAttribute(
                        entry.media_path
                    )}"
                    target="_blank"
                    rel="noopener"
                >
                    Open filed material
                </a>
            </div>
        `;
    }

    function renderMissingCaseMaterial(entry) {
        const status =
            String(
                entry.entry_status || ""
            ).toLowerCase();

        if (status !== "missing") {
            return "";
        }

        return `
            <div class="archive-case-missing">
                <span aria-hidden="true">
                    BW
                </span>

                <div>
                    <p>
                        Archive Material
                    </p>

                    <strong>
                        Record unavailable
                    </strong>

                    <small>
                        No filed material is currently
                        attached to this record.
                    </small>
                </div>
            </div>
        `;
    }

    function renderRestrictedCaseFileModal(
        title,
        restrictedCount
    ) {
        const count =
            Number(restrictedCount || 0);

        const recordText =
            count === 1
                ? "1 additional record is held"
                : `${count} additional records are held`;

        return `
            <div
                class="archive-case-backdrop"
                data-archive-case-close
                aria-hidden="true"
            ></div>

            <section
                class="archive-case-window archive-case-window-restricted"
                role="dialog"
                aria-modal="true"
                aria-labelledby="archive-restricted-case-title-${Number(
                    title.id
                )}"
            >
                <button
                    class="archive-case-close"
                    type="button"
                    data-archive-case-close
                    aria-label="Close restricted archive notice"
                >
                    <span aria-hidden="true">
                        ×
                    </span>
                </button>

                <div class="archive-case-folder">
                    <div
                        class="archive-case-folder-tab"
                        aria-hidden="true"
                    >
                        RESTRICTED FILE
                    </div>

                    <div class="archive-case-paper">
                        <header class="archive-case-header">
                            <div class="archive-case-reference">
                                <span>
                                    ${escapeHtml(
                                        title.archive_code
                                    )}
                                </span>

                                <strong>
                                    Restricted Material
                                </strong>
                            </div>

                            <span
                                class="archive-case-status is-restricted"
                            >
                                Restricted
                            </span>
                        </header>

                        <div class="archive-case-heading">
                            <p class="archive-case-kicker">
                                Blackwood Circle
                            </p>

                            <h2
                                id="archive-restricted-case-title-${Number(
                                    title.id
                                )}"
                            >
                                Restricted Files
                            </h2>

                            <p class="archive-case-book">
                                ${escapeHtml(
                                    title.title
                                )}
                            </p>
                        </div>

                        <div class="archive-case-restricted-message">
                            <div
                                class="archive-case-restricted-mark"
                                aria-hidden="true"
                            >
                                BW
                            </div>

                            <p>
                                ${escapeHtml(
                                    recordText
                                )} in the Blackwood Archive
                                under Circle access.
                            </p>

                            <p>
                                File references and classifications
                                remain sealed until authorised access
                                is established.
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

                        <footer class="archive-case-footer">
                            <span>
                                Blackwood Publishing Archive
                            </span>

                            <span>
                                Restricted
                            </span>
                        </footer>
                    </div>
                </div>
            </section>
        `;
    }

    // =========================
    // MODAL EVENTS
    // =========================

    function bindCaseFileModal(modal) {
        const closeControls =
            modal.querySelectorAll(
                "[data-archive-case-close]"
            );

        closeControls.forEach(
            function (control) {
                control.addEventListener(
                    "click",
                    function () {
                        closeCaseFile(true);
                    }
                );
            }
        );

        modal.addEventListener(
            "keydown",
            handleModalKeydown
        );
    }

    function handleModalKeydown(event) {
        if (
            event.key === "Escape"
        ) {
            event.preventDefault();
            closeCaseFile(true);
            return;
        }

        if (
            event.key !== "Tab" ||
            !BlackwoodArchiveState.modal
        ) {
            return;
        }

        const focusable =
            BlackwoodArchiveState.modal
                .querySelectorAll(
                    'button:not([disabled]), a[href], audio[controls], [tabindex]:not([tabindex="-1"])'
                );

        const items =
            Array.from(focusable)
                .filter(function (element) {
                    return (
                        element.offsetWidth > 0 ||
                        element.offsetHeight > 0
                    );
                });

        if (!items.length) {
            return;
        }

        const first =
            items[0];

        const last =
            items[items.length - 1];

        if (
            event.shiftKey &&
            document.activeElement === first
        ) {
            event.preventDefault();
            last.focus();
            return;
        }

        if (
            !event.shiftKey &&
            document.activeElement === last
        ) {
            event.preventDefault();
            first.focus();
        }
    }

    function closeCaseFile(
        restoreFocus
    ) {
        const modal =
            BlackwoodArchiveState.modal;

        if (!modal) {
            closeActiveDrawer();
            return;
        }

        stopModalAudio(modal);

        modal.classList.remove(
            "is-visible"
        );

        document.body.classList.remove(
            "archive-case-is-open"
        );

        const focusTarget =
            BlackwoodArchiveState
                .lastFocusedElement;

        window.setTimeout(
            function () {
                if (
                    modal.parentNode
                ) {
                    modal.parentNode.removeChild(
                        modal
                    );
                }

                if (
                    BlackwoodArchiveState.modal ===
                    modal
                ) {
                    BlackwoodArchiveState.modal =
                        null;
                }

                closeActiveDrawer();

                if (
                    restoreFocus &&
                    focusTarget &&
                    document.contains(
                        focusTarget
                    )
                ) {
                    focusTarget.focus();
                }

                BlackwoodArchiveState
                    .lastFocusedElement =
                        null;
            },
            220
        );
    }

    function removeExistingModal() {
        const existing =
            document.querySelector(
                "[data-archive-case-modal]"
            );

        if (!existing) {
            return;
        }

        stopModalAudio(existing);

        existing.remove();

        BlackwoodArchiveState.modal =
            null;

        document.body.classList.remove(
            "archive-case-is-open"
        );
    }

    function stopModalAudio(modal) {
        const audioElements =
            modal.querySelectorAll(
                "audio"
            );

        audioElements.forEach(
            function (audio) {
                try {
                    audio.pause();
                    audio.currentTime = 0;
                } catch (error) {
                    /*
                     * Nothing needs to happen here.
                     * Some browsers may not allow currentTime
                     * changes before media metadata is loaded.
                     */
                }
            }
        );
    }

    // =========================
    // HELPERS
    // =========================

    function isSignedInCircleMember() {
        return Boolean(
            BlackwoodArchiveState.session &&
            BlackwoodArchiveState.session.user
        );
    }

    function getEntriesForTitle(titleId) {
        return BlackwoodArchiveState.entries
            .filter(function (entry) {
                return (
                    Number(entry.title_id) ===
                    Number(titleId)
                );
            });
    }

    function getEntryById(entryId) {
        return BlackwoodArchiveState.entries
            .find(function (entry) {
                return (
                    Number(entry.id) ===
                    Number(entryId)
                );
            }) || null;
    }

    function getTitleById(titleId) {
        return BlackwoodArchiveState.titles
            .find(function (title) {
                return (
                    Number(title.id) ===
                    Number(titleId)
                );
            }) || null;
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
            new Date(
                `${value}T12:00:00`
            );

        if (
            Number.isNaN(
                date.getTime()
            )
        ) {
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
