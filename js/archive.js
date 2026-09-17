// =========================
// BLACKWOOD ARCHIVE
// Publication Cabinet + Master Case Files
// Circle-Aware Archive Access
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
        activeTitleId: null,
        activeDrawer: null,
        modal: null,
        lastFocusedElement: null,
        openTimer: null,
        closeTimer: null
    };

    document.addEventListener(
        "DOMContentLoaded",
        initBlackwoodArchive
    );

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
                await BlackwoodArchiveState.client
                    .auth
                    .getSession();

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
        return new Promise(
            function (resolve, reject) {
                if (
                    window.supabase &&
                    typeof window.supabase.createClient ===
                        "function"
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
                    BLACKWOOD_ARCHIVE_CONFIG
                        .supabaseCdn;

                script.async = true;
                script.defer = true;

                script.dataset.blackwoodSupabase =
                    "true";

                script.onload = function () {
                    if (
                        window.supabase &&
                        typeof window.supabase
                            .createClient ===
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

                document.head.appendChild(
                    script
                );
            }
        );
    }

    async function loadArchive() {
        renderLoadingState();

        try {
            const isCircleSession =
                isSignedInCircleMember();

            /*
             * Signed-in members use the main Archive
             * tables and therefore receive only the
             * records allowed by authenticated RLS.
             *
             * Signed-out visitors use the public-safe
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
                Array.isArray(
                    titlesResult.data
                )
                    ? titlesResult.data
                    : [];

            BlackwoodArchiveState.entries =
                Array.isArray(
                    entriesResult.data
                )
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
    // MAIN ARCHIVE
    // =========================

    function renderArchive() {
        const titles =
            BlackwoodArchiveState.titles;

        removeExistingModal();
        clearTimers();
        closeActiveDrawer();

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
                        No public Blackwood publication
                        records are currently available.
                    </p>
                </section>
            `;

            return;
        }

        BlackwoodArchiveState.app.innerHTML = `
            <section
                class="archive-catalogue archive-publication-catalogue"
                aria-label="Blackwood publication archive"
            >
                <div class="archive-associated-heading archive-cabinet-heading">
                    <div>
                        <p class="archive-kicker">
                            Filed Publications
                        </p>

                        <h2>
                            Archive Cabinet
                        </h2>

                        <p class="archive-cabinet-intro">
                            Each drawer contains the permanent
                            Blackwood Archive record for a
                            publication and its associated filed
                            material.
                        </p>
                    </div>

                    <span>
                        ${escapeHtml(
                            formatPublicationCount(
                                titles.length
                            )
                        )}
                    </span>
                </div>

                ${renderPublicationCabinet(titles)}
            </section>
        `;

        bindArchiveCabinet();
    }

    // =========================
    // PUBLICATION CABINET
    // =========================

    function renderPublicationCabinet(titles) {
        return `
            <div
                class="archive-cabinet archive-publication-cabinet"
                data-archive-publication-cabinet
            >
                <div
                    class="archive-cabinet-top"
                    aria-hidden="true"
                ></div>

                <div class="archive-cabinet-body">
                    ${titles
                        .map(renderPublicationDrawer)
                        .join("")}
                </div>

                <div
                    class="archive-cabinet-base"
                    aria-hidden="true"
                ></div>
            </div>
        `;
    }

    function renderPublicationDrawer(title) {
        const status =
            formatStatus(
                title.publication_status
            );

        const statusClass =
            normaliseStatusClass(
                title.publication_status
            );

        const seriesText =
            getSeriesLabel(title);

        return `
            <div
                class="archive-drawer-shell archive-publication-drawer-shell is-${escapeAttribute(
                    statusClass
                )}"
            >
                <button
                    class="archive-drawer archive-publication-drawer"
                    type="button"
                    data-archive-title-id="${Number(
                        title.id
                    )}"
                    aria-haspopup="dialog"
                    aria-expanded="false"
                    aria-label="${escapeAttribute(
                        `Open archive case file for ${title.title}`
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
                            ${escapeHtml(
                                title.archive_code
                            )}
                        </span>

                        <span class="archive-drawer-title">
                            ${escapeHtml(
                                title.title
                            )}
                        </span>

                        <span class="archive-drawer-book">
                            ${escapeHtml(
                                seriesText ||
                                title.author_name
                            )}
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

    function bindArchiveCabinet() {
        if (!BlackwoodArchiveState.app) {
            return;
        }

        const drawers =
            BlackwoodArchiveState.app
                .querySelectorAll(
                    ".archive-publication-drawer[data-archive-title-id]"
                );

        drawers.forEach(
            function (drawer) {
                drawer.addEventListener(
                    "click",
                    function () {
                        const titleId =
                            Number(
                                drawer.dataset
                                    .archiveTitleId
                            );

                        openPublicationDrawer(
                            drawer,
                            titleId
                        );
                    }
                );
            }
        );
    }

    function openPublicationDrawer(
        drawer,
        titleId
    ) {
        const title =
            getTitleById(titleId);

        if (!title) {
            console.warn(
                "Blackwood Archive: title not found.",
                titleId
            );
            return;
        }

        clearTimers();
        closeActiveDrawer();

        BlackwoodArchiveState.activeDrawer =
            drawer;

        BlackwoodArchiveState.activeTitleId =
            titleId;

        BlackwoodArchiveState.lastFocusedElement =
            drawer;

        drawer.classList.add(
            "is-open"
        );

        drawer.setAttribute(
            "aria-expanded",
            "true"
        );

        const shell =
            drawer.closest(
                ".archive-drawer-shell"
            );

        if (shell) {
            shell.classList.add(
                "is-open"
            );
        }

        const delay =
            prefersReducedMotion()
                ? 0
                : 260;

        BlackwoodArchiveState.openTimer =
            window.setTimeout(
                function () {
                    if (
                        BlackwoodArchiveState
                            .activeTitleId !==
                        titleId
                    ) {
                        return;
                    }

                    openPublicationCaseFile(
                        title
                    );
                },
                delay
            );
    }

    function closeActiveDrawer() {
        const drawer =
            BlackwoodArchiveState
                .activeDrawer;

        if (drawer) {
            drawer.classList.remove(
                "is-open"
            );

            drawer.setAttribute(
                "aria-expanded",
                "false"
            );

            const shell =
                drawer.closest(
                    ".archive-drawer-shell"
                );

            if (shell) {
                shell.classList.remove(
                    "is-open"
                );
            }
        }

        BlackwoodArchiveState.activeDrawer =
            null;

        BlackwoodArchiveState.activeTitleId =
            null;
    }

    // =========================
    // MASTER CASE FILE
    // =========================

    function openPublicationCaseFile(title) {
        removeExistingModal();

        const modal =
            document.createElement("div");

        modal.className =
            "archive-case-modal";

        modal.dataset.archiveCaseModal =
            "true";

        modal.innerHTML =
            renderPublicationCaseFile(
                title
            );

        document.body.appendChild(
            modal
        );

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

    function renderPublicationCaseFile(title) {
        const entries =
            getEntriesForTitle(
                title.id
            )
                .slice()
                .sort(function (a, b) {
                    return (
                        Number(
                            a.sort_order || 0
                        ) -
                        Number(
                            b.sort_order || 0
                        )
                    );
                });

        const isCircleSession =
            isSignedInCircleMember();

        const restrictedCount =
            getRestrictedCountForTitle(
                title.id
            );

        const status =
            formatStatus(
                title.publication_status
            );

        const statusClass =
            normaliseStatusClass(
                title.publication_status
            );

        return `
            <div
                class="archive-case-backdrop"
                data-archive-case-close
                aria-hidden="true"
            ></div>

            <section
                class="archive-case-window archive-master-case-window"
                role="dialog"
                aria-modal="true"
                aria-labelledby="archive-master-case-title-${Number(
                    title.id
                )}"
            >
                <button
                    class="archive-case-close"
                    type="button"
                    data-archive-case-close
                    aria-label="${escapeAttribute(
                        `Close ${title.title} archive case file`
                    )}"
                >
                    <span aria-hidden="true">
                        ×
                    </span>
                </button>

                <div
                    class="archive-case-folder archive-master-case-folder"
                >
                    <div
                        class="archive-case-folder-tab"
                        aria-hidden="true"
                    >
                        ${escapeHtml(
                            title.archive_code
                        )}
                    </div>

                    <div
                        class="archive-case-paper archive-master-case-paper"
                    >
                        <header class="archive-case-header">
                            <div class="archive-case-reference">
                                <span>
                                    ${escapeHtml(
                                        title.archive_code
                                    )}
                                </span>

                                <strong>
                                    Permanent Publication Record
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

                        <div class="archive-master-record">
                            ${renderMasterCaseCover(
                                title
                            )}

                            <div class="archive-master-record-copy">
                                <p class="archive-case-kicker">
                                    Blackwood Archive
                                </p>

                                <h2
                                    id="archive-master-case-title-${Number(
                                        title.id
                                    )}"
                                >
                                    ${escapeHtml(
                                        title.title
                                    )}
                                </h2>

                                ${
                                    title.subtitle
                                        ? `
                                            <p class="archive-master-subtitle">
                                                ${escapeHtml(
                                                    title.subtitle
                                                )}
                                            </p>
                                        `
                                        : ""
                                }

                                <p class="archive-case-book">
                                    ${escapeHtml(
                                        title.author_name
                                    )}
                                </p>

                                ${renderMasterPublicationMetadata(
                                    title
                                )}

                                ${
                                    title.synopsis
                                        ? `
                                            <div class="archive-case-summary archive-master-synopsis">
                                                ${formatPlainTextAsHtml(
                                                    title.synopsis
                                                )}
                                            </div>
                                        `
                                        : ""
                                }
                            </div>
                        </div>

                        <section
                            class="archive-case-records"
                            aria-labelledby="archive-filed-records-${Number(
                                title.id
                            )}"
                        >
                            <div class="archive-case-records-heading">
                                <div>
                                    <p class="archive-case-kicker">
                                        Filed Material
                                    </p>

                                    <h3
                                        id="archive-filed-records-${Number(
                                            title.id
                                        )}"
                                    >
                                        Associated Records
                                    </h3>
                                </div>

                                <span>
                                    ${escapeHtml(
                                        formatRecordCount(
                                            getDisplayedRecordCount(
                                                title.id,
                                                entries,
                                                restrictedCount,
                                                isCircleSession
                                            )
                                        )
                                    )}
                                </span>
                            </div>

                            <div class="archive-case-record-list">
                                ${
                                    entries.length
                                        ? entries
                                            .map(
                                                renderCaseRecord
                                            )
                                            .join("")
                                        : `
                                            <p class="archive-case-empty">
                                                No public associated
                                                records are currently
                                                filed.
                                            </p>
                                        `
                                }

                                ${
                                    !isCircleSession &&
                                    restrictedCount > 0
                                        ? renderCaseRestrictedNotice(
                                            title,
                                            restrictedCount
                                        )
                                        : ""
                                }
                            </div>
                        </section>

                        <footer class="archive-case-footer">
                            <span>
                                Blackwood Publishing Archive
                            </span>

                            <span>
                                ${escapeHtml(
                                    title.archive_code
                                )}
                            </span>
                        </footer>
                    </div>
                </div>
            </section>
        `;
    }

    // =========================
    // MASTER PUBLICATION RECORD
    // =========================

    function renderMasterCaseCover(title) {
        if (!title.cover_image_path) {
            return `
                <div
                    class="archive-master-cover archive-cover-placeholder"
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
            <figure class="archive-master-cover">
                <img
                    src="${escapeAttribute(
                        title.cover_image_path
                    )}"
                    alt="${escapeAttribute(
                        `${title.title} by ${title.author_name}`
                    )}"
                >
            </figure>
        `;
    }

    function renderMasterPublicationMetadata(
        title
    ) {
        const metadata = [];

        metadata.push({
            label: "Archive",
            value: title.archive_code
        });

        metadata.push({
            label: "Status",
            value: formatStatus(
                title.publication_status
            )
        });

        if (title.series_name) {
            metadata.push({
                label: "Series",
                value: getSeriesLabel(
                    title
                )
            });
        }

        if (title.publication_date) {
            metadata.push({
                label: "Published",
                value: formatDate(
                    title.publication_date
                )
            });
        }

        if (title.isbn_paperback) {
            metadata.push({
                label: "Paperback ISBN",
                value:
                    title.isbn_paperback
            });
        }

        if (title.isbn_hardback) {
            metadata.push({
                label: "Hardback ISBN",
                value:
                    title.isbn_hardback
            });
        }

        if (title.isbn_ebook) {
            metadata.push({
                label: "eBook ISBN",
                value:
                    title.isbn_ebook
            });
        }

        return `
            <dl class="archive-case-details archive-master-details">
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
    // FILED RECORDS INSIDE CASE
    // =========================

    function renderCaseRecord(entry) {
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
            <article
                class="archive-case-record is-${escapeAttribute(
                    statusClass
                )}"
            >
                <header class="archive-case-record-header">
                    <div class="archive-case-record-reference">
                        <span>
                            ${escapeHtml(
                                reference
                            )}
                        </span>

                        <small>
                            ${escapeHtml(
                                formatEntryType(
                                    entry.entry_type
                                )
                            )}
                        </small>
                    </div>

                    <span
                        class="archive-case-record-status is-${escapeAttribute(
                            statusClass
                        )}"
                    >
                        ${escapeHtml(
                            status
                        )}
                    </span>
                </header>

                <div class="archive-case-record-content">
                    <h4>
                        ${escapeHtml(
                            entry.title
                        )}
                    </h4>

                    ${
                        entry.summary
                            ? `
                                <p class="archive-case-record-summary">
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
                                <div class="archive-case-record-body">
                                    ${formatPlainTextAsHtml(
                                        entry.body
                                    )}
                                </div>
                            `
                            : ""
                    }

                    ${renderCaseFileMedia(
                        entry
                    )}
                </div>
            </article>
        `;
    }

    function renderCaseFileMedia(entry) {
        if (!entry.media_path) {
            return renderMissingCaseMaterial(
                entry
            );
        }

        if (
            entry.entry_type ===
            "photograph"
        ) {
            return `
                <figure
                    class="archive-case-media archive-case-photograph"
                >
                    <div class="archive-case-photo-mount">
                        <img
                            src="${escapeAttribute(
                                entry.media_path
                            )}"
                            alt="${escapeAttribute(
                                entry.media_alt ||
                                ""
                            )}"
                            loading="lazy"
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

        if (
            entry.entry_type ===
            "audio"
        ) {
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

    function renderMissingCaseMaterial(
        entry
    ) {
        const status =
            String(
                entry.entry_status || ""
            )
                .trim()
                .toLowerCase();

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

    // =========================
    // PUBLIC RESTRICTED NOTICE
    // =========================

    function renderCaseRestrictedNotice(
        title,
        restrictedCount
    ) {
        const count =
            Number(
                restrictedCount || 0
            );

        if (count < 1) {
            return "";
        }

        const recordText =
            count === 1
                ? "1 additional record is held"
                : `${count} additional records are held`;

        /*
         * IMPORTANT:
         *
         * This public notice uses only:
         * - the public title
         * - the safe aggregate count
         *
         * It never receives or renders restricted
         * entry IDs, codes, types, titles, summaries,
         * body text or media paths.
         */
        return `
            <aside class="archive-case-restricted-message">
                <div
                    class="archive-case-restricted-mark"
                    aria-hidden="true"
                >
                    BW
                </div>

                <div>
                    <p class="archive-case-kicker">
                        Restricted Material
                    </p>

                    <h4>
                        ${escapeHtml(
                            recordText
                        )}
                    </h4>

                    <p>
                        Selected material associated with
                        ${escapeHtml(
                            title.title
                        )} is held under Blackwood Circle
                        access.
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
                        closeCaseFile(
                            true
                        );
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

            closeCaseFile(
                true
            );

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
            Array.from(
                focusable
            ).filter(
                function (element) {
                    return (
                        element.offsetWidth > 0 ||
                        element.offsetHeight > 0
                    );
                }
            );

        if (!items.length) {
            return;
        }

        const first =
            items[0];

        const last =
            items[
                items.length - 1
            ];

        if (
            event.shiftKey &&
            document.activeElement ===
                first
        ) {
            event.preventDefault();
            last.focus();
            return;
        }

        if (
            !event.shiftKey &&
            document.activeElement ===
                last
        ) {
            event.preventDefault();
            first.focus();
        }
    }

    function closeCaseFile(
        restoreFocus
    ) {
        clearOpenTimer();

        const modal =
            BlackwoodArchiveState.modal;

        const focusTarget =
            BlackwoodArchiveState
                .lastFocusedElement;

        if (!modal) {
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

            return;
        }

        stopModalAudio(
            modal
        );

        modal.classList.remove(
            "is-visible"
        );

        document.body.classList.remove(
            "archive-case-is-open"
        );

        const delay =
            prefersReducedMotion()
                ? 0
                : 220;

        clearCloseTimer();

        BlackwoodArchiveState.closeTimer =
            window.setTimeout(
                function () {
                    if (
                        modal.parentNode
                    ) {
                        modal.parentNode
                            .removeChild(
                                modal
                            );
                    }

                    if (
                        BlackwoodArchiveState
                            .modal ===
                        modal
                    ) {
                        BlackwoodArchiveState
                            .modal =
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

                    BlackwoodArchiveState
                        .closeTimer =
                        null;
                },
                delay
            );
    }

    function removeExistingModal() {
        clearCloseTimer();

        const existing =
            document.querySelector(
                "[data-archive-case-modal]"
            );

        if (existing) {
            stopModalAudio(
                existing
            );

            existing.remove();
        }

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

                    audio.currentTime =
                        0;
                } catch (error) {
                    /*
                     * Some browsers will not allow
                     * currentTime to be changed before
                     * media metadata has loaded.
                     */
                }
            }
        );
    }

    // =========================
    // DATA HELPERS
    // =========================

    function isSignedInCircleMember() {
        return Boolean(
            BlackwoodArchiveState.session &&
            BlackwoodArchiveState
                .session.user
        );
    }

    function getEntriesForTitle(
        titleId
    ) {
        return BlackwoodArchiveState
            .entries
            .filter(
                function (entry) {
                    return (
                        Number(
                            entry.title_id
                        ) ===
                        Number(
                            titleId
                        )
                    );
                }
            );
    }

    function getTitleById(
        titleId
    ) {
        return BlackwoodArchiveState
            .titles
            .find(
                function (title) {
                    return (
                        Number(
                            title.id
                        ) ===
                        Number(
                            titleId
                        )
                    );
                }
            ) || null;
    }

    function getRestrictedCountForTitle(
        titleId
    ) {
        const record =
            BlackwoodArchiveState
                .restrictedCounts
                .find(
                    function (item) {
                        return (
                            Number(
                                item.title_id
                            ) ===
                            Number(
                                titleId
                            )
                        );
                    }
                );

        return record
            ? Number(
                record.restricted_count ||
                0
            )
            : 0;
    }

    function getDisplayedRecordCount(
        titleId,
        entries,
        restrictedCount,
        isCircleSession
    ) {
        /*
         * Signed-in:
         * Count the records actually returned by RLS.
         *
         * Signed-out:
         * Keep the public record count public-safe.
         * The restricted aggregate is represented
         * separately by the restricted notice.
         */
        if (isCircleSession) {
            return entries.length;
        }

        return entries.length;
    }

    function getSeriesLabel(title) {
        if (!title.series_name) {
            return "";
        }

        if (
            Number(
                title.series_position
            ) > 0
        ) {
            return (
                `${title.series_name} · ` +
                `Book ${Number(
                    title.series_position
                )}`
            );
        }

        return title.series_name;
    }

    function getEntryReference(
        entryCode
    ) {
        const code =
            String(
                entryCode || ""
            );

        if (!code) {
            return "UNFILED";
        }

        const parts =
            code.split("/");

        return parts.length > 1
            ? parts[
                parts.length - 1
            ]
            : code;
    }

    // =========================
    // FORMATTERS
    // =========================

    function formatPublicationCount(
        count
    ) {
        const cleanCount =
            Number(
                count || 0
            );

        return cleanCount === 1
            ? "1 publication"
            : `${cleanCount} publications`;
    }

    function formatRecordCount(
        count
    ) {
        const cleanCount =
            Number(
                count || 0
            );

        return cleanCount === 1
            ? "1 record"
            : `${cleanCount} records`;
    }

    function formatEntryType(
        value
    ) {
        const cleanValue =
            String(
                value || "record"
            )
                .trim()
                .replace(
                    /_/g,
                    " "
                );

        return cleanValue.replace(
            /\b\w/g,
            function (character) {
                return character
                    .toUpperCase();
            }
        );
    }

    function formatStatus(
        value
    ) {
        const cleanValue =
            String(
                value || ""
            )
                .trim()
                .replace(
                    /_/g,
                    " "
                );

        if (!cleanValue) {
            return "Filed";
        }

        return cleanValue.replace(
            /\b\w/g,
            function (character) {
                return character
                    .toUpperCase();
            }
        );
    }

    function normaliseStatusClass(
        value
    ) {
        return String(
            value || "filed"
        )
            .trim()
            .toLowerCase()
            .replace(
                /[^a-z0-9]+/g,
                "-"
            )
            .replace(
                /^-+|-+$/g,
                ""
            );
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

    function formatPlainTextAsHtml(
        value
    ) {
        const text =
            escapeHtml(
                value || ""
            );

        if (!text) {
            return "";
        }

        return text
            .split(
                /\n{2,}/
            )
            .map(
                function (paragraph) {
                    return `
                        <p>
                            ${paragraph.replace(
                                /\n/g,
                                "<br>"
                            )}
                        </p>
                    `;
                }
            )
            .join("");
    }

    // =========================
    // TIMING
    // =========================

    function prefersReducedMotion() {
        return Boolean(
            window.matchMedia &&
            window.matchMedia(
                "(prefers-reduced-motion: reduce)"
            ).matches
        );
    }

    function clearOpenTimer() {
        if (
            BlackwoodArchiveState
                .openTimer
        ) {
            window.clearTimeout(
                BlackwoodArchiveState
                    .openTimer
            );

            BlackwoodArchiveState
                .openTimer =
                null;
        }
    }

    function clearCloseTimer() {
        if (
            BlackwoodArchiveState
                .closeTimer
        ) {
            window.clearTimeout(
                BlackwoodArchiveState
                    .closeTimer
            );

            BlackwoodArchiveState
                .closeTimer =
                null;
        }
    }

    function clearTimers() {
        clearOpenTimer();
        clearCloseTimer();
    }

    // =========================
    // STATES
    // =========================

    function renderLoadingState() {
        if (
            !BlackwoodArchiveState.app
        ) {
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

    function renderErrorState(
        message
    ) {
        if (
            !BlackwoodArchiveState.app
        ) {
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
                    ${escapeHtml(
                        message
                    )}
                </p>
            </section>
        `;
    }

    // =========================
    // ESCAPING
    // =========================

    function escapeHtml(value) {
        return String(
            value || ""
        )
            .replace(
                /&/g,
                "&amp;"
            )
            .replace(
                /</g,
                "&lt;"
            )
            .replace(
                />/g,
                "&gt;"
            )
            .replace(
                /"/g,
                "&quot;"
            )
            .replace(
                /'/g,
                "&#039;"
            );
    }

    function escapeAttribute(
        value
    ) {
        return escapeHtml(
            value
        ).replace(
            /`/g,
            "&#096;"
        );
    }

})();
