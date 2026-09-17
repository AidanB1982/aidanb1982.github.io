// =========================
// BLACKWOOD ARCHIVE
// Interactive Archive Room
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


    // =========================
    // CONFIGURATION
    // =========================

    const BLACKWOOD_ARCHIVE_CONFIG = {
        supabaseUrl:
            "https://bmnlynjldlnxfvunqbqq.supabase.co",

        supabaseKey:
            "sb_publishable_eL7qdDe_6XWGhzmdsql_7w_7dg6psC0",

        supabaseCdn:
            "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2",

        membersPagePath:
            "/pages/members.html",

        lampStorageKey:
            "blackwood-archive-lamp-state"
    };


    // =========================
    // STATE
    // =========================

    const BlackwoodArchiveState = {
        app: null,
        room: null,
        background: null,
        newsboard: null,
        cabinetPosition: null,
        lampPosition: null,
        lampToggle: null,

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
        closeTimer: null,

        lampIsOn: true,

        pointerFrame: null,
        pointerX: 0,
        pointerY: 0,

        reducedMotionQuery: null
    };


    // =========================
    // START
    // =========================

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

        BlackwoodArchiveState.app =
            app;

        initialiseArchiveRoom();

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

            const {
                data,
                error
            } =
                await BlackwoodArchiveState
                    .client
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
    // ARCHIVE ROOM
    // =========================

    function initialiseArchiveRoom() {
        BlackwoodArchiveState.room =
            document.getElementById(
                "blackwood-archive-room"
            );

        BlackwoodArchiveState.background =
            document.querySelector(
                ".archive-room-background"
            );

        BlackwoodArchiveState.newsboard =
            document.querySelector(
                ".archive-newsboard"
            );

        BlackwoodArchiveState.cabinetPosition =
            document.querySelector(
                ".archive-cabinet-position"
            );

        BlackwoodArchiveState.lampPosition =
            document.querySelector(
                ".archive-lamp-position"
            );

        BlackwoodArchiveState.lampToggle =
            document.getElementById(
                "archive-lamp-toggle"
            );

        initialiseReducedMotion();

        initialiseArchiveLamp();

        initialiseRoomParallax();
    }


    // =========================
    // REDUCED MOTION
    // =========================

    function initialiseReducedMotion() {
        if (!window.matchMedia) {
            return;
        }

        BlackwoodArchiveState.reducedMotionQuery =
            window.matchMedia(
                "(prefers-reduced-motion: reduce)"
            );

        const query =
            BlackwoodArchiveState
                .reducedMotionQuery;

        if (
            typeof query.addEventListener ===
            "function"
        ) {
            query.addEventListener(
                "change",
                handleReducedMotionChange
            );

            return;
        }

        if (
            typeof query.addListener ===
            "function"
        ) {
            query.addListener(
                handleReducedMotionChange
            );
        }
    }

    function handleReducedMotionChange() {
        if (prefersReducedMotion()) {
            resetRoomParallax();
        }
    }


    // =========================
    // DESK LAMP
    // =========================

    function initialiseArchiveLamp() {
        const room =
            BlackwoodArchiveState.room;

        const lampToggle =
            BlackwoodArchiveState
                .lampToggle;

        if (
            !room ||
            !lampToggle
        ) {
            return;
        }

        const savedState =
            readSavedLampState();

        BlackwoodArchiveState.lampIsOn =
            savedState !== "off";

        applyLampState(
            BlackwoodArchiveState
                .lampIsOn,
            false
        );

        lampToggle.addEventListener(
            "click",
            toggleArchiveLamp
        );
    }

    function toggleArchiveLamp() {
        const nextState =
            !BlackwoodArchiveState
                .lampIsOn;

        applyLampState(
            nextState,
            true
        );
    }

    function applyLampState(
        lampIsOn,
        saveState
    ) {
        const room =
            BlackwoodArchiveState.room;

        const lampToggle =
            BlackwoodArchiveState
                .lampToggle;

        if (
            !room ||
            !lampToggle
        ) {
            return;
        }

        BlackwoodArchiveState.lampIsOn =
            Boolean(
                lampIsOn
            );

        room.classList.toggle(
            "is-lamp-off",
            !BlackwoodArchiveState
                .lampIsOn
        );

        lampToggle.setAttribute(
            "aria-pressed",
            BlackwoodArchiveState
                .lampIsOn
                ? "true"
                : "false"
        );

        if (
            BlackwoodArchiveState
                .lampIsOn
        ) {
            lampToggle.setAttribute(
                "aria-label",
                "Turn archive lamp off"
            );

            lampToggle.setAttribute(
                "title",
                "Switch off the lamp"
            );

        } else {
            lampToggle.setAttribute(
                "aria-label",
                "Turn archive lamp on"
            );

            lampToggle.setAttribute(
                "title",
                "Switch on the lamp"
            );
        }

        if (saveState) {
            saveLampState(
                BlackwoodArchiveState
                    .lampIsOn
                    ? "on"
                    : "off"
            );
        }
    }

    function readSavedLampState() {
        try {
            const saved =
                window.localStorage
                    .getItem(
                        BLACKWOOD_ARCHIVE_CONFIG
                            .lampStorageKey
                    );

            if (
                saved === "on" ||
                saved === "off"
            ) {
                return saved;
            }

        } catch (error) {
            /*
             * localStorage can be unavailable
             * in some privacy modes.
             *
             * The Archive simply defaults
             * to lamp-on in that case.
             */
        }

        return null;
    }

    function saveLampState(value) {
        try {
            window.localStorage.setItem(
                BLACKWOOD_ARCHIVE_CONFIG
                    .lampStorageKey,
                value
            );

        } catch (error) {
            /*
             * Lamp state persistence is
             * optional. Failure here must
             * never prevent the room from
             * functioning.
             */
        }
    }


    // =========================
    // ROOM PARALLAX
    // =========================

    function initialiseRoomParallax() {
        const room =
            BlackwoodArchiveState.room;

        if (!room) {
            return;
        }

        room.addEventListener(
            "pointermove",
            handleRoomPointerMove,
            {
                passive: true
            }
        );

        room.addEventListener(
            "pointerleave",
            resetRoomParallax
        );

        window.addEventListener(
            "blur",
            resetRoomParallax
        );
    }

    function handleRoomPointerMove(
        event
    ) {
        if (
            prefersReducedMotion() ||
            !isFinePointer()
        ) {
            return;
        }

        const room =
            BlackwoodArchiveState.room;

        if (!room) {
            return;
        }

        const rect =
            room.getBoundingClientRect();

        if (
            !rect.width ||
            !rect.height
        ) {
            return;
        }

        const x =
            (
                event.clientX -
                rect.left
            ) /
            rect.width;

        const y =
            (
                event.clientY -
                rect.top
            ) /
            rect.height;

        BlackwoodArchiveState.pointerX =
            clamp(
                (x - 0.5) * 2,
                -1,
                1
            );

        BlackwoodArchiveState.pointerY =
            clamp(
                (y - 0.5) * 2,
                -1,
                1
            );

        requestParallaxFrame();
    }

    function requestParallaxFrame() {
        if (
            BlackwoodArchiveState
                .pointerFrame
        ) {
            return;
        }

        BlackwoodArchiveState.pointerFrame =
            window.requestAnimationFrame(
                applyRoomParallax
            );
    }

    function applyRoomParallax() {
        BlackwoodArchiveState.pointerFrame =
            null;

        if (
            prefersReducedMotion() ||
            !isFinePointer()
        ) {
            resetRoomParallax();
            return;
        }

        const x =
            BlackwoodArchiveState.pointerX;

        const y =
            BlackwoodArchiveState.pointerY;

        const background =
            BlackwoodArchiveState
                .background;

        const newsboard =
            BlackwoodArchiveState
                .newsboard;

        const cabinet =
            BlackwoodArchiveState
                .cabinetPosition;

        const lamp =
            BlackwoodArchiveState
                .lampPosition;

        /*
         * Keep this intentionally tiny.
         *
         * The Archive should feel like a
         * physical room with depth, not a
         * theme-park ride.
         */

        if (background) {
            background.style.transform =
                `translate3d(${(
                    x * -3
                ).toFixed(2)}px, ${(
                    y * -2
                ).toFixed(2)}px, 0) scale(1.025)`;
        }

        if (newsboard) {
            newsboard.style.marginLeft =
                `${(
                    x * -2
                ).toFixed(2)}px`;

            newsboard.style.marginTop =
                `${(
                    y * -1.5
                ).toFixed(2)}px`;
        }

        if (cabinet) {
            cabinet.style.marginLeft =
                `${(
                    x * 3
                ).toFixed(2)}px`;

            cabinet.style.marginBottom =
                `${(
                    y * 1.5
                ).toFixed(2)}px`;
        }

        if (lamp) {
            lamp.style.marginRight =
                `${(
                    x * 4
                ).toFixed(2)}px`;

            lamp.style.marginBottom =
                `${(
                    y * 2
                ).toFixed(2)}px`;
        }
    }

    function resetRoomParallax() {
        BlackwoodArchiveState.pointerX =
            0;

        BlackwoodArchiveState.pointerY =
            0;

        if (
            BlackwoodArchiveState
                .pointerFrame
        ) {
            window.cancelAnimationFrame(
                BlackwoodArchiveState
                    .pointerFrame
            );

            BlackwoodArchiveState
                .pointerFrame =
                null;
        }

        const background =
            BlackwoodArchiveState
                .background;

        const newsboard =
            BlackwoodArchiveState
                .newsboard;

        const cabinet =
            BlackwoodArchiveState
                .cabinetPosition;

        const lamp =
            BlackwoodArchiveState
                .lampPosition;

        if (background) {
            background.style.transform =
                "scale(1.025)";
        }

        if (newsboard) {
            newsboard.style.marginLeft =
                "";

            newsboard.style.marginTop =
                "";
        }

        if (cabinet) {
            cabinet.style.marginLeft =
                "";

            cabinet.style.marginBottom =
                "";
        }

        if (lamp) {
            lamp.style.marginRight =
                "";

            lamp.style.marginBottom =
                "";
        }
    }

    function isFinePointer() {
        if (!window.matchMedia) {
            return true;
        }

        return window.matchMedia(
            "(hover: hover) and (pointer: fine)"
        ).matches;
    }


    // =========================
    // SUPABASE
    // =========================

    function loadSupabaseLibrary() {
        return new Promise(
            function (resolve, reject) {
                if (
                    window.supabase &&
                    typeof window.supabase
                        .createClient ===
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
                        {
                            once: true
                        }
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
                        {
                            once: true
                        }
                    );

                    return;
                }

                const script =
                    document.createElement(
                        "script"
                    );

                script.src =
                    BLACKWOOD_ARCHIVE_CONFIG
                        .supabaseCdn;

                script.async = true;
                script.defer = true;

                script.dataset.blackwoodSupabase =
                    "true";

                script.onload =
                    function () {
                        if (
                            window.supabase &&
                            typeof window
                                .supabase
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

                script.onerror =
                    function () {
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


    // =========================
    // LOAD ARCHIVE DATA
    // =========================

    async function loadArchive() {
        renderLoadingState();

        try {
            const isCircleSession =
                isSignedInCircleMember();

            /*
             * Signed-in members use the main
             * Archive tables.
             *
             * RLS determines which records
             * they are permitted to receive.
             *
             * Signed-out visitors use the
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
                BlackwoodArchiveState
                    .client
                    .from(
                        titlesSource
                    )
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
                BlackwoodArchiveState
                    .client
                    .from(
                        entriesSource
                    )
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
            ] =
                await Promise.all([
                    titlesQuery,

                    entriesQuery,

                    BlackwoodArchiveState
                        .client
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

            if (
                restrictedCountsResult.error
            ) {
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

            BlackwoodArchiveState
                .restrictedCounts =
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
            BlackwoodArchiveState
                .app
                .innerHTML = `
                    <section class="archive-empty">
                        <p>
                            No publication records
                            are currently filed.
                        </p>
                    </section>
                `;

            return;
        }

        /*
         * The Archive room itself now provides
         * the context.
         *
         * We therefore render only the physical
         * publication cabinet here rather than
         * conventional webpage headings,
         * catalogue introductions or explanatory
         * copy.
         */

        BlackwoodArchiveState
            .app
            .innerHTML =
            renderPublicationCabinet(
                titles
            );

        bindArchiveCabinet();
    }


    // =========================
    // PUBLICATION CABINET
    // =========================

    function renderPublicationCabinet(
        titles
    ) {
        return `
            <div
                class="archive-cabinet archive-publication-cabinet"
                data-archive-publication-cabinet
                aria-label="${escapeAttribute(
                    `Blackwood Archive publication cabinet. ${formatPublicationCount(
                        titles.length
                    )} filed.`
                )}"
            >
                <div
                    class="archive-cabinet-top"
                    aria-hidden="true"
                ></div>

                <div class="archive-cabinet-body">
                    ${titles
                        .map(
                            renderPublicationDrawer
                        )
                        .join("")}
                </div>

                <div
                    class="archive-cabinet-base"
                    aria-hidden="true"
                ></div>
            </div>
        `;
    }


    // =========================
    // PUBLICATION DRAWER
    // =========================

    function renderPublicationDrawer(
        title
    ) {
        const status =
            formatStatus(
                title.publication_status
            );

        const statusClass =
            normaliseStatusClass(
                title.publication_status
            );

        const seriesText =
            getSeriesLabel(
                title
            );

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
                        ${escapeHtml(
                            status
                        )}
                    </span>
                </button>
            </div>
        `;
    }


    // =========================
    // CABINET EVENTS
    // =========================

    function bindArchiveCabinet() {
        if (
            !BlackwoodArchiveState.app
        ) {
            return;
        }

        const drawers =
            BlackwoodArchiveState
                .app
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
                                drawer
                                    .dataset
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


    // =========================
    // OPEN DRAWER
    // =========================

    function openPublicationDrawer(
        drawer,
        titleId
    ) {
        const title =
            getTitleById(
                titleId
            );

        if (!title) {
            console.warn(
                "Blackwood Archive: title not found.",
                titleId
            );

            return;
        }

        clearTimers();

        closeActiveDrawer();

        BlackwoodArchiveState
            .activeDrawer =
            drawer;

        BlackwoodArchiveState
            .activeTitleId =
            titleId;

        BlackwoodArchiveState
            .lastFocusedElement =
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

        BlackwoodArchiveState
            .openTimer =
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


    // =========================
    // CLOSE DRAWER
    // =========================

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

        BlackwoodArchiveState
            .activeDrawer =
            null;

        BlackwoodArchiveState
            .activeTitleId =
            null;
    }


    // =========================
    // MASTER CASE FILE
    // =========================

    function openPublicationCaseFile(
        title
    ) {
        removeExistingModal();

        const modal =
            document.createElement(
                "div"
            );

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

        bindCaseFileModal(
            modal
        );

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


    // =========================
    // MASTER CASE CONTENT
    // =========================

    function renderPublicationCaseFile(
        title
    ) {
        const entries =
            getEntriesForTitle(
                title.id
            )
                .slice()
                .sort(
                    function (a, b) {
                        return (
                            Number(
                                a.sort_order ||
                                0
                            ) -
                            Number(
                                b.sort_order ||
                                0
                            )
                        );
                    }
                );

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

                            ${renderMasterCaseCover(
                                title
                            )}

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
                                                entries,
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
    // MASTER CASE COVER
    // =========================

    function renderMasterCaseCover(
        title
    ) {
        if (
            !title.cover_image_path
        ) {
            return `
                <div class="archive-master-evidence">
                    <div
                        class="archive-master-cover archive-polaroid archive-cover-placeholder"
                        aria-hidden="true"
                    >
                        <span
                            class="archive-paperclip"
                            aria-hidden="true"
                        ></span>

                        <div class="archive-polaroid-placeholder">

                            <span>
                                ${escapeHtml(
                                    title.archive_code
                                )}
                            </span>

                            <strong>
                                Blackwood
                            </strong>

                        </div>

                        <div class="archive-polaroid-caption">
                            Publication reference
                        </div>

                    </div>
                </div>
            `;
        }

        return `
            <div class="archive-master-evidence">

                <figure class="archive-master-cover archive-polaroid">

                    <span
                        class="archive-paperclip"
                        aria-hidden="true"
                    ></span>

                    <div class="archive-polaroid-image">

                        <img
                            src="${escapeAttribute(
                                title.cover_image_path
                            )}"
                            alt="${escapeAttribute(
                                `${title.title} by ${title.author_name}`
                            )}"
                        >

                    </div>

                    <figcaption class="archive-polaroid-caption">

                        <span>
                            ${escapeHtml(
                                title.archive_code
                            )}
                        </span>

                        <strong>
                            Publication reference
                        </strong>

                    </figcaption>

                </figure>

            </div>
        `;
    }


    // =========================
    // PUBLICATION METADATA
    // =========================

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
                    .map(
                        function (item) {
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
                        }
                    )
                    .join("")}
            </dl>
        `;
    }


    // =========================
    // FILED RECORDS
    // =========================

    function renderCaseRecord(
        entry
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


    // =========================
    // FILED MEDIA
    // =========================

    function renderCaseFileMedia(
        entry
    ) {
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


    // =========================
    // MISSING MATERIAL
    // =========================

    function renderMissingCaseMaterial(
        entry
    ) {
        const status =
            String(
                entry.entry_status ||
                ""
            )
                .trim()
                .toLowerCase();

        if (
            status !== "missing"
        ) {
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
                restrictedCount ||
                0
            );

        if (count < 1) {
            return "";
        }

        const recordText =
            count === 1
                ? "1 additional record is held"
                : `${count} additional records are held`;

        /*
         * PUBLIC SAFETY:
         *
         * This notice uses only:
         *
         * - the public title
         * - the safe aggregate restricted count
         *
         * It does NOT receive or expose restricted:
         *
         * - entry IDs
         * - entry codes
         * - entry types
         * - titles
         * - summaries
         * - body text
         * - media paths
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

    function bindCaseFileModal(
        modal
    ) {
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

    function handleModalKeydown(
        event
    ) {
        if (
            event.key ===
            "Escape"
        ) {
            event.preventDefault();

            closeCaseFile(
                true
            );

            return;
        }

        if (
            event.key !== "Tab" ||
            !BlackwoodArchiveState
                .modal
        ) {
            return;
        }

        const focusable =
            BlackwoodArchiveState
                .modal
                .querySelectorAll(
                    'button:not([disabled]), a[href], audio[controls], [tabindex]:not([tabindex="-1"])'
                );

        const items =
            Array.from(
                focusable
            ).filter(
                function (element) {
                    return (
                        element.offsetWidth >
                            0 ||
                        element.offsetHeight >
                            0
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


    // =========================
    // CLOSE CASE FILE
    // =========================

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

        BlackwoodArchiveState
            .closeTimer =
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


    // =========================
    // REMOVE EXISTING MODAL
    // =========================

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


    // =========================
    // STOP CASE AUDIO
    // =========================

    function stopModalAudio(
        modal
    ) {
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
                     * Some browsers do not
                     * allow currentTime to be
                     * changed before metadata
                     * has loaded.
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
            BlackwoodArchiveState
                .session &&
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
        return (
            BlackwoodArchiveState
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
                ) ||
            null
        );
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
        entries,
        isCircleSession
    ) {
        /*
         * Signed-in:
         * Count records actually returned
         * by authenticated RLS.
         *
         * Signed-out:
         * Count only records actually
         * returned by the public-safe view.
         *
         * The restricted aggregate remains
         * separate and is represented by
         * the restricted notice.
         */

        if (isCircleSession) {
            return entries.length;
        }

        return entries.length;
    }

    function getSeriesLabel(
        title
    ) {
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
                entryCode ||
                ""
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
                count ||
                0
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
                count ||
                0
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
                value ||
                "record"
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
                value ||
                ""
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
            value ||
            "filed"
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

    function formatDate(
        value
    ) {
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
            return String(
                value
            );
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
                value ||
                ""
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
    // MOTION HELPERS
    // =========================

    function prefersReducedMotion() {
        if (
            BlackwoodArchiveState
                .reducedMotionQuery
        ) {
            return Boolean(
                BlackwoodArchiveState
                    .reducedMotionQuery
                    .matches
            );
        }

        return Boolean(
            window.matchMedia &&
            window.matchMedia(
                "(prefers-reduced-motion: reduce)"
            ).matches
        );
    }

    function clamp(
        value,
        minimum,
        maximum
    ) {
        return Math.min(
            maximum,
            Math.max(
                minimum,
                value
            )
        );
    }


    // =========================
    // TIMERS
    // =========================

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
    // LOADING STATE
    // =========================

    function renderLoadingState() {
        if (
            !BlackwoodArchiveState.app
        ) {
            return;
        }

        BlackwoodArchiveState
            .app
            .innerHTML = `
                <section class="archive-loading">

                    <span
                        class="archive-loading-mark"
                        aria-hidden="true"
                    ></span>

                    <p>
                        Opening the files...
                    </p>

                </section>
            `;
    }


    // =========================
    // ERROR STATE
    // =========================

    function renderErrorState(
        message
    ) {
        if (
            !BlackwoodArchiveState.app
        ) {
            return;
        }

        BlackwoodArchiveState
            .app
            .innerHTML = `
                <section class="archive-error">

                    <p>
                        Record unavailable
                    </p>

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

    function escapeHtml(
        value
    ) {
        return String(
            value ||
            ""
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
