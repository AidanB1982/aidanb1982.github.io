// =========================
// BLACKWOOD MEMBER BOOKSHELF
// Private shelf records powered by Supabase
// Phase 2C: Collapsible shelf drawer + shelf stages + rearrange controls
// Phase 2E: Shelf customisation powered by /data/shelf-customisation-items.json
// =========================

(function () {
    "use strict";

    const BLACKWOOD_BOOKSHELF_CONFIG = {
        rootId: "blackwood-bookshelf-root",
        tableName: "member_book_shelf",
        customisationItemsPath: "/data/shelf-customisation-items.json",
        customisationTableNames: [
            "member_shelf_customisations",
            "member_bookshelf_customisations",
            "member_book_shelf_customisations"
        ],
        customisationLocalStoragePrefix: "blackwood-bookshelf-customisation:"
    };

    const BLACKWOOD_BOOKSHELF_STAGES = [
        {
            id: "want_to_read",
            label: "Want to Read",
            shortLabel: "Want",
            description: "Books marked for future reading."
        },
        {
            id: "tbr",
            label: "TBR",
            shortLabel: "TBR",
            description: "Books waiting on your Blackwood desk."
        },
        {
            id: "reading",
            label: "Reading",
            shortLabel: "Reading",
            description: "Books currently open."
        },
        {
            id: "read",
            label: "Read",
            shortLabel: "Read",
            description: "Books you have finished."
        },
        {
            id: "reviewed",
            label: "Reviewed",
            shortLabel: "Reviewed",
            description: "Books with a reader record or review filed."
        },
        {
            id: "favourite",
            label: "Favourite",
            shortLabel: "Favourite",
            description: "Books kept close in the archive."
        }
    ];

    const BLACKWOOD_BOOKSHELF_CUSTOMISATION_SLOTS = [
        {
            id: "background",
            label: "Shelf Background",
            shortLabel: "Background",
            description: "Change the wall, panel, or archive surface behind your shelf.",
            optional: false
        },
        {
            id: "bookends",
            label: "Bookends",
            shortLabel: "Bookends",
            description: "Add objects that hold the shelf at either side.",
            optional: true
        },
        {
            id: "charm",
            label: "Charm",
            shortLabel: "Charm",
            description: "Hang a recovered object from the archive shelf.",
            optional: true
        },
        {
            id: "object",
            label: "Shelf Object",
            shortLabel: "Object",
            description: "Place a small archive object near the shelf.",
            optional: true
        },
        {
            id: "nameplate",
            label: "Nameplate",
            shortLabel: "Nameplate",
            description: "Choose the label fixed to your private shelf.",
            optional: true
        },
        {
            id: "lighting",
            label: "Lighting",
            shortLabel: "Lighting",
            description: "Adjust the mood and atmosphere around your shelf.",
            optional: false
        }
    ];

    const BLACKWOOD_BOOKSHELF_CUSTOMISATION_FILTERS = [
        {
            id: "all",
            label: "All"
        },
        ...BLACKWOOD_BOOKSHELF_CUSTOMISATION_SLOTS.map(function (slot) {
            return {
                id: slot.id,
                label: slot.shortLabel
            };
        }),
        {
            id: "locked",
            label: "Locked"
        }
    ];

    const BLACKWOOD_BOOKSHELF_BOOKS = [
        {
            id: "the-black-bothy",
            title: "The Black Bothy",
            author: "Aidan Blackwood",
            series: "The Archive Files",
            spine: "/assets/BlackBothySpine.png",
            defaultOrder: 10
        },
        {
            id: "the-drowned-fjord",
            title: "The Drowned Fjord",
            author: "Aidan Blackwood",
            series: "The Archive Files",
            spine: "/assets/DrownedFjordSpine.png",
            defaultOrder: 20
        },
        {
            id: "the-erased-archivist",
            title: "The Erased Archivist",
            author: "Aidan Blackwood",
            series: "The Archive Files",
            spine: "/assets/ErasedArchivistSpine.png",
            defaultOrder: 30
        },
        {
            id: "holdfast",
            title: "Holdfast",
            author: "Aidan Blackwood",
            series: "The Archive Files",
            spine: "/assets/HoldfastSpine.png",
            defaultOrder: 40
        },
        {
            id: "the-crossing",
            title: "The Crossing",
            author: "Miren Vale",
            series: "Dark Literary Fantasy",
            spine: "/assets/CrossingSpine.png",
            defaultOrder: 50
        },
        {
            id: "gualachulain-bothy",
            title: "Gualachulain Bothy",
            author: "Aidan Blackwood",
            series: "The Cursed Bothies",
            spine: "/assets/GualachulainSpine.png",
            defaultOrder: 60
        },
        {
            id: "corrour-bothy",
            title: "Corrour Bothy",
            author: "Aidan Blackwood",
            series: "The Cursed Bothies",
            spine: "/assets/CorrourSpine.png",
            defaultOrder: 70
        },
        {
            id: "dour-hill-house",
            title: "Dour Hill House",
            author: "Aidan Blackwood",
            series: "Blackwood Horror",
            spine: "/assets/DourHillSpine.png",
            defaultOrder: 80
        },
        {
            id: "red-streets",
            title: "Red Streets",
            author: "Aidan Blackwood",
            series: "Blackwood Horror",
            spine: "/assets/RedStreetsSpine.png",
            defaultOrder: 90
        },
        {
            id: "the-scheme",
            title: "The Scheme",
            author: "Aidan Blackwood",
            series: "Blackwood Horror",
            spine: "/assets/SchemeSpine.png",
            defaultOrder: 100
        },
        {
            id: "love-abused",
            title: "Love, Abused",
            author: "Campbell Stewart",
            series: "Standalone Work",
            spine: "/assets/LoveAbusedSpine.png",
            defaultOrder: 110
        },
        {
            id: "sanae-per-mortem",
            title: "Sanare Per Mortem",
            author: "Aidan Blackwood",
            series: "Standalone Work",
            spine: "/assets/SanareSpine.png",
            defaultOrder: 120
        }
    ];

    const BLACKWOOD_BOOKSHELF_FORMATS = [
        "Not specified",
        "Kindle",
        "Paperback",
        "Signed paperback",
        "ARC",
        "Hardback",
        "Other"
    ];

    const BlackwoodBookshelfState = {
        root: null,
        client: null,
        session: null,
        memberProfile: null,
        shelfRecords: [],
        customisationItems: [],
        customisationRecord: createDefaultCustomisationRecord(),
        customisationFilter: "all",
        customisationPanelOpen: false,
        customisationStatusMessage: "",
        customisationStatusType: "",
        customisationLoadError: "",
        currentCustomisationTableName: "",
        modalMode: "closed",
        activeBookId: "",
        statusMessage: "",
        statusType: "",
        isBusy: false,
        isCustomisationBusy: false,
        isDrawerOpen: false,
        draggingBookId: "",
        draggingFromStageId: "",
        escapeListenerBound: false
    };

    window.initBlackwoodBookshelf = async function initBlackwoodBookshelf(options) {
        const root = options && options.root
            ? options.root
            : document.getElementById(BLACKWOOD_BOOKSHELF_CONFIG.rootId);

        if (!root) {
            console.warn("Blackwood Bookshelf: root element not found.");
            return;
        }

        BlackwoodBookshelfState.root = root;
        BlackwoodBookshelfState.client = options ? options.client : null;
        BlackwoodBookshelfState.session = options ? options.session : null;
        BlackwoodBookshelfState.memberProfile = null;
        BlackwoodBookshelfState.modalMode = "closed";
        BlackwoodBookshelfState.activeBookId = "";
        BlackwoodBookshelfState.statusMessage = "";
        BlackwoodBookshelfState.statusType = "";
        BlackwoodBookshelfState.customisationStatusMessage = "";
        BlackwoodBookshelfState.customisationStatusType = "";
        BlackwoodBookshelfState.customisationLoadError = "";
        BlackwoodBookshelfState.isCustomisationBusy = false;

        ensureBookshelfEscapeListener();

        if (!BlackwoodBookshelfState.client || !getCurrentUserId()) {
            renderBookshelfUnavailable();
            return;
        }

        renderBookshelfLoading();

        try {
            await Promise.all([
                loadBookshelfRecords(),
                loadBookshelfMemberProfile(),
                loadBookshelfCustomisationItems()
            ]);

            await loadBookshelfCustomisationRecord();
            applyDefaultCustomisationSelections();

            renderBookshelf();

        } catch (error) {
            console.error("Blackwood Bookshelf failed:", error);
            renderBookshelfError("Your Blackwood Bookshelf could not be opened. Please refresh and try again.");
        }
    };

    // =========================
    // DATA LOADING
    // =========================

    async function loadBookshelfRecords() {
        const userId = getCurrentUserId();

        if (!userId) {
            BlackwoodBookshelfState.shelfRecords = [];
            return;
        }

        let result = await BlackwoodBookshelfState.client
            .from(BLACKWOOD_BOOKSHELF_CONFIG.tableName)
            .select("*")
            .eq("member_id", userId)
            .order("shelf_status", { ascending: true })
            .order("shelf_position", { ascending: true })
            .order("shelf_order", { ascending: true })
            .order("created_at", { ascending: true });

        if (result.error && /shelf_status|shelf_position/i.test(String(result.error.message || ""))) {
            console.warn("Bookshelf stage columns unavailable, using legacy shelf order:", result.error.message);

            result = await BlackwoodBookshelfState.client
                .from(BLACKWOOD_BOOKSHELF_CONFIG.tableName)
                .select("*")
                .eq("member_id", userId)
                .order("shelf_order", { ascending: true })
                .order("created_at", { ascending: true });
        }

        if (result.error) {
            throw result.error;
        }

        BlackwoodBookshelfState.shelfRecords = Array.isArray(result.data)
            ? result.data.map(normaliseShelfRecord)
            : [];
    }

    async function loadBookshelfMemberProfile() {
        const userId = getCurrentUserId();

        if (!userId) {
            BlackwoodBookshelfState.memberProfile = null;
            return;
        }

        try {
            const { data, error } = await BlackwoodBookshelfState.client
                .from("member_profiles")
                .select("id,email,display_name,reader_name,member_tier,member_status,points_total")
                .eq("id", userId)
                .maybeSingle();

            if (error) {
                console.warn("Bookshelf member profile could not be loaded:", error.message);
                BlackwoodBookshelfState.memberProfile = null;
                return;
            }

            BlackwoodBookshelfState.memberProfile = data || null;

        } catch (error) {
            console.warn("Bookshelf member profile query failed:", error);
            BlackwoodBookshelfState.memberProfile = null;
        }
    }

    async function loadBookshelfCustomisationItems() {
        BlackwoodBookshelfState.customisationLoadError = "";

        try {
            const response = await fetch(
                `${BLACKWOOD_BOOKSHELF_CONFIG.customisationItemsPath}?cache=${Date.now()}`
            );

            if (!response.ok) {
                throw new Error("Shelf customisation items could not be loaded.");
            }

            const data = await response.json();
            const rawItems = flattenCustomisationItems(data);

            BlackwoodBookshelfState.customisationItems = rawItems
                .map(normaliseCustomisationItem)
                .filter(function (item) {
                    return item.id && item.slot;
                })
                .sort(sortCustomisationItems);

        } catch (error) {
            console.warn("Shelf customisation JSON could not be loaded:", error);
            BlackwoodBookshelfState.customisationItems = [];
            BlackwoodBookshelfState.customisationLoadError = "Shelf customisation items could not be loaded.";
        }
    }

    async function loadBookshelfCustomisationRecord() {
        const userId = getCurrentUserId();

        BlackwoodBookshelfState.customisationRecord = createDefaultCustomisationRecord();

        if (!userId) {
            return;
        }

        const tableNames = getCustomisationTableNamesForQuery();

        for (const tableName of tableNames) {
            try {
                const { data, error } = await BlackwoodBookshelfState.client
                    .from(tableName)
                    .select("*")
                    .eq("member_id", userId)
                    .maybeSingle();

                if (error) {
                    if (isLikelyMissingDbStructureError(error.message)) {
                        continue;
                    }

                    console.warn(`Bookshelf customisation table "${tableName}" could not be loaded:`, error.message);
                    continue;
                }

                BlackwoodBookshelfState.currentCustomisationTableName = tableName;

                if (data) {
                    BlackwoodBookshelfState.customisationRecord = normaliseCustomisationRecord(data);
                    saveCustomisationToLocalStorage(BlackwoodBookshelfState.customisationRecord);
                    return;
                }

                const localRecord = loadCustomisationFromLocalStorage();

                if (localRecord) {
                    BlackwoodBookshelfState.customisationRecord = localRecord;
                    return;
                }

                BlackwoodBookshelfState.customisationRecord = createDefaultCustomisationRecord();
                return;

            } catch (error) {
                console.warn(`Bookshelf customisation query failed for "${tableName}":`, error);
            }
        }

        const localRecord = loadCustomisationFromLocalStorage();

        if (localRecord) {
            BlackwoodBookshelfState.customisationRecord = localRecord;
        }
    }

    // =========================
    // BASE RENDER STATES
    // =========================

    function renderBookshelfLoading() {
        BlackwoodBookshelfState.root.innerHTML = `
            <div class="blackwood-bookshelf">
                <div class="bookshelf-empty-card">
                    <p class="bookshelf-kicker">My Blackwood Bookshelf</p>
                    <h3>Opening your shelf...</h3>
                    <p>Your private Blackwood book records are being retrieved.</p>
                </div>
            </div>
        `;
    }

    function renderBookshelfUnavailable() {
        BlackwoodBookshelfState.root.innerHTML = `
            <div class="blackwood-bookshelf">
                <div class="bookshelf-empty-card">
                    <p class="bookshelf-kicker">My Blackwood Bookshelf</p>
                    <h3>Shelf unavailable</h3>
                    <p>Please sign in to view your private Blackwood Bookshelf.</p>
                </div>
            </div>
        `;
    }

    function renderBookshelfError(message) {
        BlackwoodBookshelfState.root.innerHTML = `
            <div class="blackwood-bookshelf">
                <div class="bookshelf-empty-card">
                    <p class="bookshelf-kicker">My Blackwood Bookshelf</p>
                    <h3>Something went wrong</h3>
                    <p>${escapeHtml(message)}</p>
                </div>
            </div>
        `;
    }

    // =========================
    // BOOKSHELF RENDER
    // =========================

    function renderBookshelf() {
        const shelfItems = getShelfItems();
        const totalBooks = shelfItems.length;
        const totalLabel = totalBooks === 1 ? "1 Book" : `${totalBooks} Books`;
        const customisationSummary = getBookshelfCustomisationSummary();

        BlackwoodBookshelfState.root.innerHTML = `
            <div 
                class="blackwood-bookshelf ${escapeAttribute(getBookshelfCustomisationClassNames())}"
                ${getBookshelfCustomisationDataAttributes()}
                style="${escapeAttribute(getBookshelfCustomisationStyle())}"
            >
                <details 
                    class="bookshelf-drawer" 
                    data-bookshelf-drawer
                    ${BlackwoodBookshelfState.isDrawerOpen ? "open" : ""}
                >
                    <summary class="bookshelf-drawer-summary">
                        <div class="bookshelf-drawer-title-block">
                            <p class="bookshelf-kicker">Private Reader Shelf</p>
                            <h2>My Blackwood Bookshelf</h2>
                            <p>
                                Your books are grouped by reading stage, keeping the member page tidy while your archive grows.
                            </p>
                        </div>

                        <div class="bookshelf-drawer-summary-side">
                            <span class="bookshelf-total-pill">${escapeHtml(totalLabel)}</span>
                            <span class="bookshelf-total-pill bookshelf-customisation-pill">
                                ${escapeHtml(customisationSummary)}
                            </span>
                            <span class="bookshelf-drawer-chevrons" aria-hidden="true"></span>
                        </div>
                    </summary>

                    <div class="bookshelf-drawer-panel">
                        <div class="bookshelf-header">
                            <div>
                                <p class="bookshelf-kicker">Shelf Stages</p>
                                <h3>Your private reading board</h3>
                                <p>
                                    Move books between shelves, mark owned or signed editions, rearrange titles,
                                    and customise the shelf with recovered archive objects.
                                </p>
                            </div>

                            <button type="button" class="bookshelf-add-button" data-bookshelf-add>
                                Add to Your Collection
                            </button>
                        </div>

                        ${renderBookshelfStageSummary(shelfItems)}

                        ${renderBookshelfCustomisationPanel()}

                        <p 
                            class="bookshelf-status ${escapeAttribute(BlackwoodBookshelfState.statusType)}" 
                            id="blackwood-bookshelf-status" 
                            aria-live="polite"
                        >
                            ${escapeHtml(BlackwoodBookshelfState.statusMessage)}
                        </p>

                        ${
                            shelfItems.length
                                ? renderShelfBoard(shelfItems)
                                : renderEmptyShelf()
                        }
                    </div>
                </details>
            </div>

            ${renderBookshelfModal()}
        `;

        bindBookshelfEvents();
        bindBookshelfImageFallbacks();
    }

    function renderBookshelfStageSummary(shelfItems) {
        const counts = getShelfStageCounts(shelfItems);

        return `
            <div class="bookshelf-stage-summary" aria-label="Bookshelf stage summary">
                ${BLACKWOOD_BOOKSHELF_STAGES.map(function (stage) {
                    const count = counts[stage.id] || 0;

                    return `
                        <span class="bookshelf-stage-pill ${count ? "has-books" : "is-empty"}">
                            <strong>${escapeHtml(stage.shortLabel)}</strong>
                            <span>${count}</span>
                        </span>
                    `;
                }).join("")}
            </div>
        `;
    }

    function renderShelfBoard(shelfItems) {
        return `
            <div 
                class="bookshelf-display-shell ${escapeAttribute(getBookshelfCustomisationClassNames())}"
                ${getBookshelfCustomisationDataAttributes()}
                style="${escapeAttribute(getBookshelfCustomisationStyle())}"
            >
                ${renderBookshelfDisplayDecor()}

                <div class="bookshelf-board" aria-label="Your Blackwood book shelves">
                    ${BLACKWOOD_BOOKSHELF_STAGES.map(function (stage) {
                        const stageItems = shelfItems.filter(function (item) {
                            return item.record.shelf_status === stage.id;
                        });

                        return renderShelfStage(stage, stageItems);
                    }).join("")}
                </div>
            </div>
        `;
    }

    function renderShelfStage(stage, stageItems) {
        const count = stageItems.length;
        const countLabel = count === 1 ? "1 book" : `${count} books`;

        return `
            <section 
                class="bookshelf-stage ${count ? "has-books" : "is-empty"}" 
                data-bookshelf-stage="${escapeAttribute(stage.id)}"
                data-bookshelf-drop-stage="${escapeAttribute(stage.id)}"
                aria-labelledby="bookshelf-stage-${escapeAttribute(stage.id)}"
            >
                <div class="bookshelf-stage-header">
                    <div>
                        <h3 id="bookshelf-stage-${escapeAttribute(stage.id)}">
                            ${escapeHtml(stage.label)}
                        </h3>
                        <p>${escapeHtml(stage.description)}</p>
                    </div>

                    <span>${escapeHtml(countLabel)}</span>
                </div>

                ${
                    count
                        ? `
                            <div 
                                class="bookshelf-spine-list bookshelf-stage-spine-list"
                                data-bookshelf-drop-list="${escapeAttribute(stage.id)}"
                            >
                                ${stageItems.map(function (item, index) {
                                    return renderShelfSpine(item.book, item.record, index, stageItems.length);
                                }).join("")}
                            </div>
                        `
                        : `
                            <div 
                                class="bookshelf-stage-empty"
                                data-bookshelf-empty-drop="${escapeAttribute(stage.id)}"
                            >
                                <p>No books on this shelf yet. Drop a book here to file it.</p>
                            </div>
                        `
                }
            </section>
        `;
    }

    function renderShelfSpine(book, record, index, stageLength) {
        const badges = [];
        const stage = getShelfStageById(record.shelf_status);
        const canMoveEarlier = index > 0;
        const canMoveLater = index < stageLength - 1;

        badges.push(stage ? stage.shortLabel : "Filed");

        if (record.is_favourite) badges.push("Favourite");
        if (record.is_arc) badges.push("ARC");
        if (record.owned) badges.push("Own");
        if (record.has_read) badges.push("Read");
        if (record.is_signed) badges.push("Signed");
        if (record.wants_signed) badges.push("Wants Signed");

        return `
            <div 
                class="bookshelf-book-slot"
                draggable="true"
                data-bookshelf-drag-book="${escapeAttribute(book.id)}"
                data-bookshelf-drop-before="${escapeAttribute(book.id)}"
                data-bookshelf-stage-book="${escapeAttribute(record.shelf_status)}"
            >
                <button
                    type="button"
                    class="bookshelf-spine-button ${record.owned ? "is-owned" : ""} ${record.has_read ? "is-read" : ""} ${record.is_signed ? "is-signed" : ""} ${record.is_favourite ? "is-favourite" : ""}"
                    data-bookshelf-open-book="${escapeAttribute(book.id)}"
                    aria-label="Open shelf record for ${escapeAttribute(book.title)}"
                >
                    <img
                        src="${escapeAttribute(book.spine)}"
                        alt=""
                        loading="lazy"
                        data-bookshelf-spine-image
                    >

                    <span class="bookshelf-spine-fallback">
                        ${escapeHtml(book.title)}
                    </span>
                </button>

                <div class="bookshelf-spine-badges" aria-hidden="true">
                    ${badges.slice(0, 4).map(function (badge) {
                        return `<span>${escapeHtml(badge)}</span>`;
                    }).join("")}
                </div>

                <div class="bookshelf-spine-controls">
                    <label>
                        <span>Move to</span>

                        <select 
                            data-bookshelf-stage-select
                            data-bookshelf-book-id="${escapeAttribute(book.id)}"
                            aria-label="Move ${escapeAttribute(book.title)} to another shelf"
                        >
                            ${renderShelfStageOptions(record.shelf_status)}
                        </select>
                    </label>

                    <div class="bookshelf-order-controls" aria-label="Rearrange ${escapeAttribute(book.title)}">
                        <button
                            type="button"
                            data-bookshelf-move="earlier"
                            data-bookshelf-book-id="${escapeAttribute(book.id)}"
                            ${canMoveEarlier ? "" : "disabled"}
                            aria-label="Move ${escapeAttribute(book.title)} earlier"
                            title="Move earlier"
                        >
                            &lt;
                        </button>

                        <button
                            type="button"
                            data-bookshelf-move="later"
                            data-bookshelf-book-id="${escapeAttribute(book.id)}"
                            ${canMoveLater ? "" : "disabled"}
                            aria-label="Move ${escapeAttribute(book.title)} later"
                            title="Move later"
                        >
                            &gt;
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    function renderEmptyShelf() {
        return `
            <div class="bookshelf-empty-card">
                <p class="bookshelf-kicker">Your shelf is waiting</p>
                <h3>No books filed yet</h3>
                <p>
                    Add the Blackwood books you own, have read, reviewed, received as ARCs,
                    or would like signed one day.
                </p>

                <button type="button" class="bookshelf-add-button" data-bookshelf-add>
                    Add to Your Collection
                </button>
            </div>
        `;
    }

    // =========================
    // CUSTOMISATION RENDER
    // =========================

    function renderBookshelfCustomisationPanel() {
        const items = Array.isArray(BlackwoodBookshelfState.customisationItems)
            ? BlackwoodBookshelfState.customisationItems
            : [];

        if (!items.length && !BlackwoodBookshelfState.customisationLoadError) {
            return "";
        }

        const metrics = getBookshelfCustomisationMetrics();
        const unlockedIds = getUnlockedCustomisationItemIds();
        const unlockedCount = items.filter(function (item) {
            return unlockedIds.has(item.id);
        }).length;

        const totalCount = items.length;
        const filteredItems = getCustomisationItemsForDisplay();
        const openAttribute = BlackwoodBookshelfState.customisationPanelOpen ? "open" : "";

        return `
            <details 
                class="bookshelf-customiser" 
                data-bookshelf-customiser
                ${openAttribute}
            >
                <summary class="bookshelf-customiser-summary">
                    <div>
                        <p class="bookshelf-kicker">Issued Shelf Additions</p>
                        <h3>Customise Your Shelf</h3>
                        <p>
                            Change the atmosphere of your private Blackwood shelf with backgrounds,
                            bookends, charms, objects, nameplates, and lighting earned through reader activity.
                        </p>
                    </div>

                    <div class="bookshelf-customiser-summary-side">
                        <span>${escapeHtml(String(unlockedCount))} / ${escapeHtml(String(totalCount))} issued</span>
                        <small>${escapeHtml(getBookshelfCustomisationMetricSummary(metrics))}</small>
                    </div>
                </summary>

                <div class="bookshelf-customiser-panel">
                    ${
                        BlackwoodBookshelfState.customisationLoadError
                            ? `
                                <div class="bookshelf-empty-card">
                                    <p>${escapeHtml(BlackwoodBookshelfState.customisationLoadError)}</p>
                                </div>
                            `
                            : `
                                ${renderBookshelfCustomisationCurrentSelections()}

                                ${renderBookshelfCustomisationFilters()}

                                <p 
                                    class="bookshelf-customisation-status ${escapeAttribute(BlackwoodBookshelfState.customisationStatusType)}"
                                    id="bookshelf-customisation-status"
                                    aria-live="polite"
                                >
                                    ${escapeHtml(BlackwoodBookshelfState.customisationStatusMessage)}
                                </p>

                                ${
                                    filteredItems.length
                                        ? `
                                            <div class="bookshelf-customisation-grid">
                                                ${filteredItems.map(renderBookshelfCustomisationItem).join("")}
                                            </div>
                                        `
                                        : `
                                            <div class="bookshelf-empty-card">
                                                <p>No shelf additions match this filter yet.</p>
                                            </div>
                                        `
                                }

                                <div class="bookshelf-customisation-actions">
                                    <button 
                                        type="button" 
                                        class="bookshelf-modal-button"
                                        data-bookshelf-customisation-reset
                                        ${BlackwoodBookshelfState.isCustomisationBusy ? "disabled" : ""}
                                    >
                                        Reset Display
                                    </button>
                                </div>
                            `
                    }
                </div>
            </details>
        `;
    }

    function renderBookshelfCustomisationCurrentSelections() {
        const selections = getNormalisedCustomisationSelections();

        return `
            <div class="bookshelf-customisation-current" aria-label="Current shelf display">
                ${BLACKWOOD_BOOKSHELF_CUSTOMISATION_SLOTS.map(function (slot) {
                    const item = selections[slot.id]
                        ? getCustomisationItemById(selections[slot.id])
                        : null;

                    return `
                        <article class="bookshelf-customisation-current-card">
                            <span>${escapeHtml(slot.label)}</span>

                            <strong>
                                ${escapeHtml(item ? item.title : "Not selected")}
                            </strong>

                            ${
                                slot.optional && item
                                    ? `
                                        <button 
                                            type="button"
                                            data-bookshelf-customisation-clear="${escapeAttribute(slot.id)}"
                                            ${BlackwoodBookshelfState.isCustomisationBusy ? "disabled" : ""}
                                        >
                                            Clear
                                        </button>
                                    `
                                    : ""
                            }
                        </article>
                    `;
                }).join("")}
            </div>
        `;
    }

    function renderBookshelfCustomisationFilters() {
        const counts = getCustomisationFilterCounts();

        return `
            <div class="bookshelf-customisation-filters" aria-label="Shelf customisation filters">
                ${BLACKWOOD_BOOKSHELF_CUSTOMISATION_FILTERS.map(function (filter) {
                    const isActive = BlackwoodBookshelfState.customisationFilter === filter.id;

                    return `
                        <button
                            type="button"
                            class="${isActive ? "is-active" : ""}"
                            data-bookshelf-customisation-filter="${escapeAttribute(filter.id)}"
                            aria-pressed="${isActive ? "true" : "false"}"
                            ${BlackwoodBookshelfState.isCustomisationBusy ? "disabled" : ""}
                        >
                            <span>${escapeHtml(filter.label)}</span>
                            <strong>${escapeHtml(String(counts[filter.id] || 0))}</strong>
                        </button>
                    `;
                }).join("")}
            </div>
        `;
    }

    function renderBookshelfCustomisationItem(item) {
        const slot = getCustomisationSlotById(item.slot);
        const unlockedIds = getUnlockedCustomisationItemIds();
        const isUnlocked = unlockedIds.has(item.id);
        const isSelected = isCustomisationItemSelected(item);
        const label = isUnlocked ? "Issued" : getCustomisationLockedReason(item);

        return `
            <button
                type="button"
                class="bookshelf-customisation-item ${isUnlocked ? "is-unlocked" : "is-locked"} ${isSelected ? "is-selected" : ""}"
                data-bookshelf-customisation-select="${escapeAttribute(item.id)}"
                ${isUnlocked && !BlackwoodBookshelfState.isCustomisationBusy ? "" : "disabled"}
                aria-pressed="${isSelected ? "true" : "false"}"
            >
                <span class="bookshelf-customisation-item-preview ${escapeAttribute(item.className)}" aria-hidden="true">
                    ${
                        item.image
                            ? `
                                <img 
                                    src="${escapeAttribute(item.image)}" 
                                    alt=""
                                    loading="lazy"
                                    data-bookshelf-customisation-image
                                >
                            `
                            : `
                                <span>${escapeHtml(item.symbol || "✦")}</span>
                            `
                    }
                </span>

                <span class="bookshelf-customisation-item-copy">
                    <span class="bookshelf-customisation-item-kicker">
                        ${escapeHtml(slot ? slot.shortLabel : "Shelf")}
                    </span>

                    <strong>${escapeHtml(item.title)}</strong>

                    <small>${escapeHtml(item.description || "A recovered shelf addition.")}</small>

                    <em>${escapeHtml(label)}</em>
                </span>
            </button>
        `;
    }

    function renderBookshelfDisplayDecor() {
        const bookends = getSelectedCustomisationItemBySlot("bookends");
        const charm = getSelectedCustomisationItemBySlot("charm");
        const object = getSelectedCustomisationItemBySlot("object");
        const nameplate = getSelectedCustomisationItemBySlot("nameplate");
        const lighting = getSelectedCustomisationItemBySlot("lighting");

        if (!bookends && !charm && !object && !nameplate && !lighting) {
            return "";
        }

        return `
            <div class="bookshelf-customisation-decor" aria-hidden="true">
                ${
                    lighting
                        ? `
                            <div class="bookshelf-customisation-lighting ${escapeAttribute(lighting.className)}">
                                <span>${escapeHtml(lighting.symbol || "")}</span>
                            </div>
                        `
                        : ""
                }

                ${
                    nameplate
                        ? `
                            <div class="bookshelf-customisation-nameplate ${escapeAttribute(nameplate.className)}">
                                <span>${escapeHtml(nameplate.title)}</span>
                            </div>
                        `
                        : ""
                }

                ${
                    bookends
                        ? `
                            <div class="bookshelf-customisation-bookends ${escapeAttribute(bookends.className)}">
                                <span class="bookshelf-customisation-bookend is-left">${escapeHtml(bookends.symbol || "")}</span>
                                <span class="bookshelf-customisation-bookend is-right">${escapeHtml(bookends.symbol || "")}</span>
                            </div>
                        `
                        : ""
                }

                ${
                    charm
                        ? `
                            <div class="bookshelf-customisation-charm ${escapeAttribute(charm.className)}">
                                <span>${escapeHtml(charm.symbol || "✦")}</span>
                            </div>
                        `
                        : ""
                }

                ${
                    object
                        ? `
                            <div class="bookshelf-customisation-object ${escapeAttribute(object.className)}">
                                <span>${escapeHtml(object.symbol || "▣")}</span>
                            </div>
                        `
                        : ""
                }
            </div>
        `;
    }

    // =========================
    // MODALS
    // =========================

    function renderBookshelfModal() {
        if (BlackwoodBookshelfState.modalMode === "picker") {
            return renderBookPickerModal();
        }

        if (BlackwoodBookshelfState.modalMode === "record") {
            const book = getBookById(BlackwoodBookshelfState.activeBookId);

            if (!book) {
                return "";
            }

            return renderBookRecordModal(book);
        }

        return "";
    }

    function renderBookPickerModal() {
        const availableBooks = getAvailableBooks();

        return `
            <div class="bookshelf-modal" role="dialog" aria-modal="true" aria-labelledby="bookshelf-picker-title">
                <div class="bookshelf-modal-panel" role="document">
                    <button type="button" class="bookshelf-modal-close" data-bookshelf-close>
                        Close
                    </button>

                    <div class="bookshelf-modal-inner">
                        <p class="bookshelf-modal-kicker">Add to your collection</p>

                        <h3 class="bookshelf-modal-title" id="bookshelf-picker-title">
                            Choose a Blackwood book
                        </h3>

                        <p class="bookshelf-modal-copy">
                            Add owned books, books you want to read, ARC copies, signed editions, reviewed titles,
                            or favourites you want to keep close in the archive.
                        </p>

                        ${
                            availableBooks.length
                                ? `
                                    <div class="bookshelf-picker-grid">
                                        ${availableBooks.map(renderBookPickerButton).join("")}
                                    </div>
                                `
                                : `
                                    <div class="bookshelf-empty-card">
                                        <h3>Every current spine is already on your shelf.</h3>
                                        <p>You can click any spine on your shelf to update notes, stages, or statuses.</p>
                                    </div>
                                `
                        }
                    </div>
                </div>
            </div>
        `;
    }

    function renderBookPickerButton(book) {
        return `
            <button
                type="button"
                class="bookshelf-picker-book"
                data-bookshelf-pick-book="${escapeAttribute(book.id)}"
            >
                <img
                    src="${escapeAttribute(book.spine)}"
                    alt=""
                    loading="lazy"
                    data-bookshelf-spine-image
                >

                <span>
                    <strong>${escapeHtml(book.title)}</strong>
                    <span>${escapeHtml(book.author)} · ${escapeHtml(book.series)}</span>
                </span>
            </button>
        `;
    }

    function renderBookRecordModal(book) {
        const existingRecord = getRecordByBookId(book.id);
        const record = existingRecord || createDefaultRecord(book);
        const isNewRecord = !existingRecord;

        return `
            <div class="bookshelf-modal" role="dialog" aria-modal="true" aria-labelledby="bookshelf-record-title">
                <div class="bookshelf-modal-panel" role="document">
                    <button type="button" class="bookshelf-modal-close" data-bookshelf-close>
                        Close
                    </button>

                    <div class="bookshelf-modal-inner">
                        <div class="bookshelf-record-layout">
                            <img
                                class="bookshelf-record-spine"
                                src="${escapeAttribute(book.spine)}"
                                alt=""
                                loading="lazy"
                                data-bookshelf-spine-image
                            >

                            <div>
                                <p class="bookshelf-modal-kicker">
                                    ${escapeHtml(book.series)}
                                </p>

                                <h3 class="bookshelf-modal-title" id="bookshelf-record-title">
                                    ${escapeHtml(book.title)}
                                </h3>

                                <p class="bookshelf-modal-copy">
                                    ${escapeHtml(book.author)}. Keep a private record for this title.
                                </p>

                                <form 
                                    class="bookshelf-record-form" 
                                    data-bookshelf-record-form
                                    data-bookshelf-book-id="${escapeAttribute(book.id)}"
                                >
                                    <label class="bookshelf-field">
                                        <span>Shelf stage</span>

                                        <select name="shelf_status">
                                            ${renderShelfStageOptions(record.shelf_status)}
                                        </select>
                                    </label>

                                    <div class="bookshelf-check-grid">
                                        <label class="bookshelf-check">
                                            <input type="checkbox" name="owned" ${record.owned ? "checked" : ""}>
                                            <span>I own this book</span>
                                        </label>

                                        <label class="bookshelf-check">
                                            <input type="checkbox" name="has_read" ${record.has_read ? "checked" : ""}>
                                            <span>I have read this book</span>
                                        </label>

                                        <label class="bookshelf-check">
                                            <input type="checkbox" name="is_arc" ${record.is_arc ? "checked" : ""}>
                                            <span>This was an ARC copy</span>
                                        </label>

                                        <label class="bookshelf-check">
                                            <input type="checkbox" name="is_signed" ${record.is_signed ? "checked" : ""}>
                                            <span>My copy is signed</span>
                                        </label>

                                        <label class="bookshelf-check">
                                            <input type="checkbox" name="wants_signed" ${record.wants_signed ? "checked" : ""}>
                                            <span>I'd like this signed</span>
                                        </label>

                                        <label class="bookshelf-check">
                                            <input type="checkbox" name="is_favourite" ${record.is_favourite ? "checked" : ""}>
                                            <span>Keep as favourite</span>
                                        </label>
                                    </div>

                                    <label class="bookshelf-field">
                                        <span>Format</span>

                                        <select name="format">
                                            ${BLACKWOOD_BOOKSHELF_FORMATS.map(function (format) {
                                                return `
                                                    <option value="${escapeAttribute(format)}" ${record.format === format ? "selected" : ""}>
                                                        ${escapeHtml(format)}
                                                    </option>
                                                `;
                                            }).join("")}
                                        </select>
                                    </label>

                                    <label class="bookshelf-field">
                                        <span>Private shelf note</span>

                                        <textarea 
                                            name="notes" 
                                            maxlength="2000"
                                            placeholder="Add private notes, thoughts, memories, edition details, or anything you want to keep with this book."
                                        >${escapeHtml(record.notes)}</textarea>
                                    </label>

                                    <div class="bookshelf-modal-actions">
                                        <button type="submit" class="bookshelf-modal-button primary" data-bookshelf-save>
                                            ${isNewRecord ? "Add to Shelf" : "Save Shelf Record"}
                                        </button>

                                        ${
                                            isNewRecord
                                                ? ""
                                                : `
                                                    <button type="button" class="bookshelf-modal-button danger" data-bookshelf-remove>
                                                        Remove from My Shelf
                                                    </button>
                                                `
                                        }

                                        <p class="bookshelf-modal-status" id="bookshelf-modal-status" aria-live="polite"></p>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    function renderShelfStageOptions(currentStatus) {
        const cleanStatus = normaliseShelfStatus(currentStatus);

        return BLACKWOOD_BOOKSHELF_STAGES.map(function (stage) {
            return `
                <option value="${escapeAttribute(stage.id)}" ${stage.id === cleanStatus ? "selected" : ""}>
                    ${escapeHtml(stage.label)}
                </option>
            `;
        }).join("");
    }

    // =========================
    // EVENT BINDING
    // =========================

    function bindBookshelfEvents() {
        const drawer = BlackwoodBookshelfState.root.querySelector("[data-bookshelf-drawer]");

        if (drawer) {
            drawer.addEventListener("toggle", function () {
                BlackwoodBookshelfState.isDrawerOpen = drawer.open;
            });
        }

        BlackwoodBookshelfState.root.querySelectorAll("[data-bookshelf-add]").forEach(function (button) {
            button.addEventListener("click", openBookPickerModal);
        });

        BlackwoodBookshelfState.root.querySelectorAll("[data-bookshelf-open-book]").forEach(function (button) {
            button.addEventListener("click", function () {
                openBookRecordModal(button.dataset.bookshelfOpenBook || "");
            });
        });

        BlackwoodBookshelfState.root.querySelectorAll("[data-bookshelf-pick-book]").forEach(function (button) {
            button.addEventListener("click", function () {
                openBookRecordModal(button.dataset.bookshelfPickBook || "");
            });
        });

        BlackwoodBookshelfState.root.querySelectorAll("[data-bookshelf-close]").forEach(function (button) {
            button.addEventListener("click", closeBookshelfModal);
        });

        BlackwoodBookshelfState.root.querySelectorAll("[data-bookshelf-stage-select]").forEach(function (select) {
            select.addEventListener("change", handleQuickShelfStatusChange);
        });

        BlackwoodBookshelfState.root.querySelectorAll("[data-bookshelf-move]").forEach(function (button) {
            button.addEventListener("click", handleMoveShelfRecord);
        });

        bindBookshelfCustomisationEvents();
        bindBookshelfDragAndDrop();

        const modal = BlackwoodBookshelfState.root.querySelector(".bookshelf-modal");

        if (modal) {
            modal.addEventListener("click", function (event) {
                if (event.target === modal) {
                    closeBookshelfModal();
                }
            });
        }

        const form = BlackwoodBookshelfState.root.querySelector("[data-bookshelf-record-form]");

        if (form) {
            form.addEventListener("submit", handleSaveShelfRecord);
        }

        const removeButton = BlackwoodBookshelfState.root.querySelector("[data-bookshelf-remove]");

        if (removeButton) {
            removeButton.addEventListener("click", handleRemoveShelfRecord);
        }
    }

    function bindBookshelfCustomisationEvents() {
        const customiser = BlackwoodBookshelfState.root.querySelector("[data-bookshelf-customiser]");

        if (customiser) {
            customiser.addEventListener("toggle", function () {
                BlackwoodBookshelfState.customisationPanelOpen = customiser.open;
            });
        }

        BlackwoodBookshelfState.root.querySelectorAll("[data-bookshelf-customisation-filter]").forEach(function (button) {
            button.addEventListener("click", function () {
                BlackwoodBookshelfState.customisationFilter = normaliseCustomisationFilter(
                    button.dataset.bookshelfCustomisationFilter || "all"
                );

                BlackwoodBookshelfState.customisationPanelOpen = true;
                BlackwoodBookshelfState.isDrawerOpen = true;

                renderBookshelf();
            });
        });

        BlackwoodBookshelfState.root.querySelectorAll("[data-bookshelf-customisation-select]").forEach(function (button) {
            button.addEventListener("click", handleCustomisationItemSelect);
        });

        BlackwoodBookshelfState.root.querySelectorAll("[data-bookshelf-customisation-clear]").forEach(function (button) {
            button.addEventListener("click", handleCustomisationSlotClear);
        });

        BlackwoodBookshelfState.root.querySelectorAll("[data-bookshelf-customisation-reset]").forEach(function (button) {
            button.addEventListener("click", handleCustomisationReset);
        });
    }

    function bindBookshelfDragAndDrop() {
        BlackwoodBookshelfState.root.querySelectorAll("[data-bookshelf-drag-book]").forEach(function (slot) {
            slot.addEventListener("dragstart", handleBookshelfDragStart);
            slot.addEventListener("dragend", handleBookshelfDragEnd);
        });

        BlackwoodBookshelfState.root.querySelectorAll("[data-bookshelf-drop-stage]").forEach(function (stage) {
            stage.addEventListener("dragover", handleBookshelfDragOver);
            stage.addEventListener("dragenter", handleBookshelfDragOver);
            stage.addEventListener("dragleave", handleBookshelfDragLeave);
            stage.addEventListener("drop", handleBookshelfDrop);
        });
    }

    function bindBookshelfImageFallbacks() {
        BlackwoodBookshelfState.root.querySelectorAll("[data-bookshelf-spine-image]").forEach(function (image) {
            image.addEventListener("error", function () {
                const button = image.closest(".bookshelf-spine-button");

                if (button) {
                    button.classList.add("is-image-missing");
                }

                image.hidden = true;
            });
        });

        BlackwoodBookshelfState.root.querySelectorAll("[data-bookshelf-customisation-image]").forEach(function (image) {
            image.addEventListener("error", function () {
                const preview = image.closest(".bookshelf-customisation-item-preview");

                if (preview) {
                    preview.classList.add("is-image-missing");
                }

                image.hidden = true;
            });
        });
    }

    function ensureBookshelfEscapeListener() {
        if (BlackwoodBookshelfState.escapeListenerBound) {
            return;
        }

        document.addEventListener("keydown", function (event) {
            if (event.key === "Escape" && BlackwoodBookshelfState.modalMode !== "closed") {
                closeBookshelfModal();
            }
        });

        BlackwoodBookshelfState.escapeListenerBound = true;
    }

    // =========================
    // CUSTOMISATION ACTIONS
    // =========================

    async function handleCustomisationItemSelect(event) {
        if (BlackwoodBookshelfState.isCustomisationBusy) {
            return;
        }

        const button = event.currentTarget;
        const itemId = button.dataset.bookshelfCustomisationSelect || "";
        const item = getCustomisationItemById(itemId);
        const unlockedIds = getUnlockedCustomisationItemIds();

        if (!item) {
            setBookshelfCustomisationStatus("That shelf addition could not be found.", "is-error");
            return;
        }

        if (!unlockedIds.has(item.id)) {
            setBookshelfCustomisationStatus(getCustomisationLockedReason(item), "is-error");
            return;
        }

        BlackwoodBookshelfState.isCustomisationBusy = true;
        BlackwoodBookshelfState.customisationPanelOpen = true;
        BlackwoodBookshelfState.isDrawerOpen = true;

        setBookshelfCustomisationStatus(`Filing ${item.title} on your shelf...`, "is-loading");

        const record = normaliseCustomisationRecord(BlackwoodBookshelfState.customisationRecord);
        record.selections[item.slot] = item.id;
        record.unlockedItemIds = uniqueStrings([
            ...record.unlockedItemIds,
            item.id
        ]);
        record.updated_at = new Date().toISOString();

        BlackwoodBookshelfState.customisationRecord = record;

        try {
            const result = await saveBookshelfCustomisationRecord();

            BlackwoodBookshelfState.customisationStatusMessage = result.savedLocally
                ? `${item.title} applied and saved locally on this device.`
                : `${item.title} applied to your shelf.`;

            BlackwoodBookshelfState.customisationStatusType = "is-success";

            renderBookshelf();

        } catch (error) {
            console.error("Shelf customisation save failed:", error);
            setBookshelfCustomisationStatus(cleanBookshelfError(error.message), "is-error");

        } finally {
            BlackwoodBookshelfState.isCustomisationBusy = false;
        }
    }

    async function handleCustomisationSlotClear(event) {
        if (BlackwoodBookshelfState.isCustomisationBusy) {
            return;
        }

        const button = event.currentTarget;
        const slotId = normaliseCustomisationSlot(button.dataset.bookshelfCustomisationClear || "");
        const slot = getCustomisationSlotById(slotId);

        if (!slot || !slot.optional) {
            setBookshelfCustomisationStatus("That shelf slot cannot be cleared.", "is-error");
            return;
        }

        BlackwoodBookshelfState.isCustomisationBusy = true;
        BlackwoodBookshelfState.customisationPanelOpen = true;
        BlackwoodBookshelfState.isDrawerOpen = true;

        setBookshelfCustomisationStatus(`Clearing ${slot.shortLabel.toLowerCase()}...`, "is-loading");

        const record = normaliseCustomisationRecord(BlackwoodBookshelfState.customisationRecord);
        delete record.selections[slot.id];
        record.updated_at = new Date().toISOString();

        BlackwoodBookshelfState.customisationRecord = record;

        try {
            const result = await saveBookshelfCustomisationRecord();

            BlackwoodBookshelfState.customisationStatusMessage = result.savedLocally
                ? `${slot.label} cleared and saved locally on this device.`
                : `${slot.label} cleared.`;

            BlackwoodBookshelfState.customisationStatusType = "is-success";

            renderBookshelf();

        } catch (error) {
            console.error("Shelf customisation clear failed:", error);
            setBookshelfCustomisationStatus(cleanBookshelfError(error.message), "is-error");

        } finally {
            BlackwoodBookshelfState.isCustomisationBusy = false;
        }
    }

    async function handleCustomisationReset() {
        if (BlackwoodBookshelfState.isCustomisationBusy) {
            return;
        }

        const confirmed = window.confirm("Reset your shelf display to its default issued style?");

        if (!confirmed) {
            return;
        }

        BlackwoodBookshelfState.isCustomisationBusy = true;
        BlackwoodBookshelfState.customisationPanelOpen = true;
        BlackwoodBookshelfState.isDrawerOpen = true;

        setBookshelfCustomisationStatus("Resetting shelf display...", "is-loading");

        const record = normaliseCustomisationRecord(BlackwoodBookshelfState.customisationRecord);
        record.selections = {};
        record.updated_at = new Date().toISOString();

        BlackwoodBookshelfState.customisationRecord = record;
        applyDefaultCustomisationSelections();

        try {
            const result = await saveBookshelfCustomisationRecord();

            BlackwoodBookshelfState.customisationStatusMessage = result.savedLocally
                ? "Shelf display reset and saved locally on this device."
                : "Shelf display reset.";

            BlackwoodBookshelfState.customisationStatusType = "is-success";

            renderBookshelf();

        } catch (error) {
            console.error("Shelf customisation reset failed:", error);
            setBookshelfCustomisationStatus(cleanBookshelfError(error.message), "is-error");

        } finally {
            BlackwoodBookshelfState.isCustomisationBusy = false;
        }
    }

    async function saveBookshelfCustomisationRecord() {
        const userId = getCurrentUserId();
        const record = normaliseCustomisationRecord(BlackwoodBookshelfState.customisationRecord);

        record.member_id = userId;
        record.updated_at = record.updated_at || new Date().toISOString();

        BlackwoodBookshelfState.customisationRecord = record;
        saveCustomisationToLocalStorage(record);

        if (!BlackwoodBookshelfState.client || !userId) {
            return {
                savedLocally: true
            };
        }

        const tableNames = getCustomisationTableNamesForQuery();
        const payloads = buildCustomisationPayloads(userId, record);
        const errors = [];

        for (const tableName of tableNames) {
            for (const payload of payloads) {
                try {
                    const result = await writeCustomisationPayloadToTable(tableName, payload);

                    if (!result.error) {
                        BlackwoodBookshelfState.currentCustomisationTableName = tableName;

                        return {
                            savedLocally: false,
                            tableName
                        };
                    }

                    errors.push(result.error);

                    if (!isLikelyMissingDbStructureError(result.error.message)) {
                        console.warn("Shelf customisation save warning:", result.error.message);
                    }

                } catch (error) {
                    errors.push(error);
                }
            }
        }

        const hardError = errors.find(function (error) {
            return error && !isLikelyMissingDbStructureError(error.message);
        });

        if (hardError) {
            throw hardError;
        }

        return {
            savedLocally: true
        };
    }

    async function writeCustomisationPayloadToTable(tableName, payload) {
        const userId = getCurrentUserId();

        const upsertResult = await BlackwoodBookshelfState.client
            .from(tableName)
            .upsert(payload, {
                onConflict: "member_id"
            })
            .select("*")
            .maybeSingle();

        if (!upsertResult.error) {
            return upsertResult;
        }

        if (!/unique|constraint|conflict/i.test(String(upsertResult.error.message || ""))) {
            return upsertResult;
        }

        const updatePayload = {
            ...payload
        };

        delete updatePayload.member_id;

        const updateResult = await BlackwoodBookshelfState.client
            .from(tableName)
            .update(updatePayload)
            .eq("member_id", userId)
            .select("*");

        if (updateResult.error) {
            return updateResult;
        }

        if (Array.isArray(updateResult.data) && updateResult.data.length) {
            return {
                data: updateResult.data[0],
                error: null
            };
        }

        return BlackwoodBookshelfState.client
            .from(tableName)
            .insert(payload)
            .select("*")
            .maybeSingle();
    }

    // =========================
    // BOOK RECORD ACTIONS
    // =========================

    function openBookPickerModal() {
        BlackwoodBookshelfState.isDrawerOpen = true;
        BlackwoodBookshelfState.modalMode = "picker";
        BlackwoodBookshelfState.activeBookId = "";
        renderBookshelf();
    }

    function openBookRecordModal(bookId) {
        const book = getBookById(bookId);

        if (!book) {
            setBookshelfStatus("That book could not be found.", "is-error");
            return;
        }

        BlackwoodBookshelfState.isDrawerOpen = true;
        BlackwoodBookshelfState.modalMode = "record";
        BlackwoodBookshelfState.activeBookId = book.id;
        renderBookshelf();
    }

    function closeBookshelfModal() {
        BlackwoodBookshelfState.modalMode = "closed";
        BlackwoodBookshelfState.activeBookId = "";
        BlackwoodBookshelfState.isBusy = false;
        renderBookshelf();
    }

    async function handleSaveShelfRecord(event) {
        event.preventDefault();

        if (BlackwoodBookshelfState.isBusy) {
            return;
        }

        const form = event.currentTarget;
        const bookId = form.dataset.bookshelfBookId || "";
        const book = getBookById(bookId);
        const userId = getCurrentUserId();

        if (!book || !userId) {
            setBookshelfModalStatus("This shelf record could not be saved.", "is-error");
            return;
        }

        BlackwoodBookshelfState.isBusy = true;
        setBookshelfModalStatus("Saving shelf record...", "is-loading");

        const existingRecord = getRecordByBookId(book.id);
        const selectedShelfStatus = normaliseShelfStatus(
            form.elements.shelf_status ? form.elements.shelf_status.value : "want_to_read"
        );

        const shouldKeepPosition = existingRecord &&
            existingRecord.shelf_status === selectedShelfStatus &&
            Number(existingRecord.shelf_position || 0) > 0;

        const shelfPosition = shouldKeepPosition
            ? Number(existingRecord.shelf_position || 0)
            : getNextShelfPosition(selectedShelfStatus);

        const isFavourite = Boolean(form.elements.is_favourite && form.elements.is_favourite.checked) ||
            selectedShelfStatus === "favourite";

        const record = {
            member_id: userId,
            book_id: book.id,
            book_title: book.title,
            owned: Boolean(form.elements.owned && form.elements.owned.checked),
            has_read: Boolean(form.elements.has_read && form.elements.has_read.checked),
            is_arc: Boolean(form.elements.is_arc && form.elements.is_arc.checked),
            is_signed: Boolean(form.elements.is_signed && form.elements.is_signed.checked),
            wants_signed: Boolean(form.elements.wants_signed && form.elements.wants_signed.checked),
            is_favourite: isFavourite,
            shelf_status: selectedShelfStatus,
            shelf_position: shelfPosition,
            format: String(form.elements.format ? form.elements.format.value : "Not specified").trim() || "Not specified",
            notes: String(form.elements.notes ? form.elements.notes.value : "").trim(),
            shelf_order: existingRecord
                ? Number(existingRecord.shelf_order || book.defaultOrder)
                : Number(book.defaultOrder || 1000),
            updated_at: new Date().toISOString()
        };

        try {
            const { error } = await BlackwoodBookshelfState.client
                .from(BLACKWOOD_BOOKSHELF_CONFIG.tableName)
                .upsert(record, {
                    onConflict: "member_id,book_id"
                });

            if (error) {
                throw error;
            }

            await loadBookshelfRecords();

            BlackwoodBookshelfState.modalMode = "closed";
            BlackwoodBookshelfState.activeBookId = "";
            BlackwoodBookshelfState.isDrawerOpen = true;
            BlackwoodBookshelfState.statusMessage = existingRecord
                ? `${book.title} shelf record saved.`
                : `${book.title} has been placed on your shelf.`;
            BlackwoodBookshelfState.statusType = "is-success";

            renderBookshelf();

        } catch (error) {
            console.error("Shelf record save failed:", error);
            setBookshelfModalStatus(cleanBookshelfError(error.message), "is-error");

        } finally {
            BlackwoodBookshelfState.isBusy = false;
        }
    }

    async function handleRemoveShelfRecord() {
        if (BlackwoodBookshelfState.isBusy) {
            return;
        }

        const book = getBookById(BlackwoodBookshelfState.activeBookId);

        if (!book) {
            setBookshelfModalStatus("This shelf record could not be removed.", "is-error");
            return;
        }

        const confirmed = window.confirm(`Remove "${book.title}" from your Blackwood Bookshelf?`);

        if (!confirmed) {
            return;
        }

        BlackwoodBookshelfState.isBusy = true;
        setBookshelfModalStatus("Removing shelf record...", "is-loading");

        try {
            const { error } = await BlackwoodBookshelfState.client
                .from(BLACKWOOD_BOOKSHELF_CONFIG.tableName)
                .delete()
                .eq("member_id", getCurrentUserId())
                .eq("book_id", book.id);

            if (error) {
                throw error;
            }

            await loadBookshelfRecords();

            BlackwoodBookshelfState.modalMode = "closed";
            BlackwoodBookshelfState.activeBookId = "";
            BlackwoodBookshelfState.isDrawerOpen = true;
            BlackwoodBookshelfState.statusMessage = `${book.title} has been removed from your shelf.`;
            BlackwoodBookshelfState.statusType = "is-success";

            renderBookshelf();

        } catch (error) {
            console.error("Shelf record remove failed:", error);
            setBookshelfModalStatus(cleanBookshelfError(error.message), "is-error");

        } finally {
            BlackwoodBookshelfState.isBusy = false;
        }
    }

    async function handleQuickShelfStatusChange(event) {
        if (BlackwoodBookshelfState.isBusy) {
            return;
        }

        const select = event.currentTarget;
        const bookId = select.dataset.bookshelfBookId || "";
        const book = getBookById(bookId);
        const record = getRecordByBookId(bookId);
        const nextStatus = normaliseShelfStatus(select.value);

        if (!book || !record) {
            setBookshelfStatus("That shelf record could not be moved.", "is-error");
            return;
        }

        if (record.shelf_status === nextStatus) {
            return;
        }

        BlackwoodBookshelfState.isBusy = true;
        select.disabled = true;
        setBookshelfStatus(`Moving ${book.title}...`, "is-loading");

        try {
            const nextPosition = getNextShelfPosition(nextStatus);
            const updatePayload = {
                shelf_status: nextStatus,
                shelf_position: nextPosition,
                updated_at: new Date().toISOString()
            };

            if (nextStatus === "favourite") {
                updatePayload.is_favourite = true;
            }

            const { error } = await BlackwoodBookshelfState.client
                .from(BLACKWOOD_BOOKSHELF_CONFIG.tableName)
                .update(updatePayload)
                .eq("member_id", getCurrentUserId())
                .eq("book_id", book.id);

            if (error) {
                throw error;
            }

            await loadBookshelfRecords();

            BlackwoodBookshelfState.isDrawerOpen = true;
            BlackwoodBookshelfState.statusMessage = `${book.title} moved to ${getShelfStageLabel(nextStatus)}.`;
            BlackwoodBookshelfState.statusType = "is-success";

            renderBookshelf();

        } catch (error) {
            console.error("Shelf stage move failed:", error);
            setBookshelfStatus(cleanBookshelfError(error.message), "is-error");
            select.disabled = false;

        } finally {
            BlackwoodBookshelfState.isBusy = false;
        }
    }

    async function handleMoveShelfRecord(event) {
        if (BlackwoodBookshelfState.isBusy) {
            return;
        }

        const button = event.currentTarget;
        const bookId = button.dataset.bookshelfBookId || "";
        const direction = button.dataset.bookshelfMove || "";
        const book = getBookById(bookId);
        const record = getRecordByBookId(bookId);

        if (!book || !record || !direction) {
            setBookshelfStatus("That shelf record could not be rearranged.", "is-error");
            return;
        }

        const stageItems = getShelfItemsForStage(record.shelf_status);
        const currentIndex = stageItems.findIndex(function (item) {
            return item.record.book_id === bookId;
        });

        if (currentIndex < 0) {
            setBookshelfStatus("That shelf position could not be found.", "is-error");
            return;
        }

        const targetIndex = direction === "earlier"
            ? currentIndex - 1
            : currentIndex + 1;

        if (targetIndex < 0 || targetIndex >= stageItems.length) {
            return;
        }

        const reorderedItems = stageItems.slice();
        const movedItem = reorderedItems.splice(currentIndex, 1)[0];

        reorderedItems.splice(targetIndex, 0, movedItem);

        BlackwoodBookshelfState.isBusy = true;
        button.disabled = true;
        setBookshelfStatus(`Rearranging ${book.title}...`, "is-loading");

        try {
            await saveShelfStageOrder(reorderedItems);

            await loadBookshelfRecords();

            BlackwoodBookshelfState.isDrawerOpen = true;
            BlackwoodBookshelfState.statusMessage = `${book.title} shelf position updated.`;
            BlackwoodBookshelfState.statusType = "is-success";

            renderBookshelf();

        } catch (error) {
            console.error("Shelf reorder failed:", error);
            setBookshelfStatus(cleanBookshelfError(error.message), "is-error");
            button.disabled = false;

        } finally {
            BlackwoodBookshelfState.isBusy = false;
        }
    }

    async function saveShelfStageOrder(stageItems) {
        const userId = getCurrentUserId();

        if (!userId) {
            throw new Error("Sign in required.");
        }

        const updates = stageItems.map(function (item, index) {
            const position = (index + 1) * 10;

            return BlackwoodBookshelfState.client
                .from(BLACKWOOD_BOOKSHELF_CONFIG.tableName)
                .update({
                    shelf_position: position,
                    updated_at: new Date().toISOString()
                })
                .eq("member_id", userId)
                .eq("book_id", item.record.book_id);
        });

        const results = await Promise.all(updates);
        const failedResult = results.find(function (result) {
            return result && result.error;
        });

        if (failedResult && failedResult.error) {
            throw failedResult.error;
        }
    }

    // =========================
    // DRAG AND DROP
    // =========================

    function handleBookshelfDragStart(event) {
        if (BlackwoodBookshelfState.isBusy) {
            event.preventDefault();
            return;
        }

        const interactiveElement = event.target.closest(
            "select, input, textarea, .bookshelf-order-controls button"
        );

        if (interactiveElement) {
            event.preventDefault();
            return;
        }

        const slot = event.currentTarget;
        const bookId = slot.dataset.bookshelfDragBook || "";
        const record = getRecordByBookId(bookId);

        if (!bookId || !record) {
            event.preventDefault();
            return;
        }

        BlackwoodBookshelfState.draggingBookId = bookId;
        BlackwoodBookshelfState.draggingFromStageId = record.shelf_status || "want_to_read";

        if (event.dataTransfer) {
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData("text/plain", bookId);
        }

        window.setTimeout(function () {
            slot.classList.add("is-dragging");
            document.body.classList.add("is-bookshelf-dragging");
        }, 0);
    }

    function handleBookshelfDragOver(event) {
        const draggingBookId = BlackwoodBookshelfState.draggingBookId;

        if (!draggingBookId) {
            return;
        }

        event.preventDefault();

        if (event.dataTransfer) {
            event.dataTransfer.dropEffect = "move";
        }

        clearBookshelfDropIndicators();

        const dropInfo = getBookshelfDropInfo(event);

        if (dropInfo.stageElement) {
            dropInfo.stageElement.classList.add("is-drag-over");
        }

        if (dropInfo.slotElement && dropInfo.slotElement.dataset.bookshelfDragBook !== draggingBookId) {
            dropInfo.slotElement.classList.add(dropInfo.dropAfter ? "is-drop-after" : "is-drop-before");
        }
    }

    function handleBookshelfDragLeave(event) {
        const stage = event.currentTarget;

        if (!stage || stage.contains(event.relatedTarget)) {
            return;
        }

        stage.classList.remove("is-drag-over");

        stage.querySelectorAll(".is-drop-before, .is-drop-after").forEach(function (element) {
            element.classList.remove("is-drop-before", "is-drop-after");
        });
    }

    async function handleBookshelfDrop(event) {
        const draggedBookId = event.dataTransfer
            ? event.dataTransfer.getData("text/plain") || BlackwoodBookshelfState.draggingBookId
            : BlackwoodBookshelfState.draggingBookId;

        if (!draggedBookId) {
            return;
        }

        event.preventDefault();

        const dropInfo = getBookshelfDropInfo(event);

        clearBookshelfDropIndicators();

        if (!dropInfo.stageId) {
            resetBookshelfDragState();
            return;
        }

        await moveShelfRecordByDrag(draggedBookId, dropInfo.stageId, dropInfo.beforeBookId);
    }

    function handleBookshelfDragEnd() {
        clearBookshelfDropIndicators();
        resetBookshelfDragState();
    }

    async function moveShelfRecordByDrag(bookId, targetStageId, beforeBookId) {
        if (BlackwoodBookshelfState.isBusy) {
            return;
        }

        const book = getBookById(bookId);
        const record = getRecordByBookId(bookId);
        const cleanTargetStage = normaliseShelfStatus(targetStageId);

        if (!book || !record) {
            setBookshelfStatus("That book could not be moved.", "is-error");
            return;
        }

        const currentStage = normaliseShelfStatus(record.shelf_status);

        const targetItems = getShelfItemsForStage(cleanTargetStage).filter(function (item) {
            return item.record.book_id !== bookId;
        });

        const movedItem = {
            book,
            record: {
                ...record,
                shelf_status: cleanTargetStage
            }
        };

        const insertIndex = beforeBookId
            ? targetItems.findIndex(function (item) {
                return item.record.book_id === beforeBookId;
            })
            : -1;

        if (insertIndex >= 0) {
            targetItems.splice(insertIndex, 0, movedItem);
        } else {
            targetItems.push(movedItem);
        }

        const sourceItems = currentStage === cleanTargetStage
            ? []
            : getShelfItemsForStage(currentStage).filter(function (item) {
                return item.record.book_id !== bookId;
            });

        BlackwoodBookshelfState.isBusy = true;
        setBookshelfStatus(`Moving ${book.title}...`, "is-loading");

        try {
            if (sourceItems.length) {
                await saveShelfStageOrderForDrag(sourceItems, currentStage);
            }

            await saveShelfStageOrderForDrag(targetItems, cleanTargetStage);

            await loadBookshelfRecords();

            BlackwoodBookshelfState.isDrawerOpen = true;
            BlackwoodBookshelfState.statusMessage = `${book.title} moved to ${getShelfStageLabel(cleanTargetStage)}.`;
            BlackwoodBookshelfState.statusType = "is-success";

            renderBookshelf();

        } catch (error) {
            console.error("Bookshelf drag move failed:", error);
            setBookshelfStatus(cleanBookshelfError(error.message), "is-error");

        } finally {
            BlackwoodBookshelfState.isBusy = false;
            resetBookshelfDragState();
        }
    }

    async function saveShelfStageOrderForDrag(stageItems, stageId) {
        const userId = getCurrentUserId();
        const cleanStageId = normaliseShelfStatus(stageId);
        const now = new Date().toISOString();

        if (!userId) {
            throw new Error("Sign in required.");
        }

        const updates = stageItems.map(function (item, index) {
            const payload = {
                shelf_status: cleanStageId,
                shelf_position: (index + 1) * 10,
                updated_at: now
            };

            if (cleanStageId === "favourite") {
                payload.is_favourite = true;
            }

            return BlackwoodBookshelfState.client
                .from(BLACKWOOD_BOOKSHELF_CONFIG.tableName)
                .update(payload)
                .eq("member_id", userId)
                .eq("book_id", item.record.book_id);
        });

        const results = await Promise.all(updates);

        const failedResult = results.find(function (result) {
            return result && result.error;
        });

        if (failedResult && failedResult.error) {
            throw failedResult.error;
        }
    }

    function getBookshelfDropInfo(event) {
        const stageElement = event.target.closest("[data-bookshelf-drop-stage]");
        const slotElement = event.target.closest("[data-bookshelf-drop-before]");

        const stageId = stageElement
            ? normaliseShelfStatus(stageElement.dataset.bookshelfDropStage || "")
            : "";

        let beforeBookId = "";
        let dropAfter = false;

        if (slotElement && stageId) {
            const slotBookId = slotElement.dataset.bookshelfDropBefore || "";
            const rect = slotElement.getBoundingClientRect();
            const midpoint = rect.left + rect.width / 2;

            dropAfter = event.clientX > midpoint;

            if (dropAfter) {
                beforeBookId = getNextBookIdAfter(slotBookId, stageId);
            } else {
                beforeBookId = slotBookId;
            }
        }

        return {
            stageElement,
            slotElement,
            stageId,
            beforeBookId,
            dropAfter
        };
    }

    function getNextBookIdAfter(bookId, stageId) {
        const items = getShelfItemsForStage(stageId);
        const currentIndex = items.findIndex(function (item) {
            return item.record.book_id === bookId;
        });

        if (currentIndex < 0 || currentIndex >= items.length - 1) {
            return "";
        }

        return items[currentIndex + 1].record.book_id;
    }

    function clearBookshelfDropIndicators() {
        if (!BlackwoodBookshelfState.root) {
            return;
        }

        BlackwoodBookshelfState.root.querySelectorAll(".is-drag-over, .is-drop-before, .is-drop-after, .is-dragging").forEach(function (element) {
            element.classList.remove("is-drag-over", "is-drop-before", "is-drop-after", "is-dragging");
        });
    }

    function resetBookshelfDragState() {
        BlackwoodBookshelfState.draggingBookId = "";
        BlackwoodBookshelfState.draggingFromStageId = "";

        document.body.classList.remove("is-bookshelf-dragging");
    }

    // =========================
    // SHELF DATA HELPERS
    // =========================

    function getShelfItems() {
        return BlackwoodBookshelfState.shelfRecords
            .map(function (record) {
                return {
                    record,
                    book: getBookById(record.book_id)
                };
            })
            .filter(function (item) {
                return Boolean(item.book);
            })
            .sort(sortShelfItems);
    }

    function getShelfItemsForStage(stageId) {
        const cleanStageId = normaliseShelfStatus(stageId);

        return getShelfItems().filter(function (item) {
            return item.record.shelf_status === cleanStageId;
        });
    }

    function sortShelfItems(a, b) {
        const aStageOrder = getShelfStageOrder(a.record.shelf_status);
        const bStageOrder = getShelfStageOrder(b.record.shelf_status);

        if (aStageOrder !== bStageOrder) {
            return aStageOrder - bStageOrder;
        }

        const aPosition = Number(a.record.shelf_position || a.record.shelf_order || a.book.defaultOrder || 1000);
        const bPosition = Number(b.record.shelf_position || b.record.shelf_order || b.book.defaultOrder || 1000);

        if (aPosition !== bPosition) {
            return aPosition - bPosition;
        }

        const aOrder = Number(a.record.shelf_order || a.book.defaultOrder || 1000);
        const bOrder = Number(b.record.shelf_order || b.book.defaultOrder || 1000);

        if (aOrder !== bOrder) {
            return aOrder - bOrder;
        }

        return String(a.book.title).localeCompare(String(b.book.title));
    }

    function getAvailableBooks() {
        const filedBookIds = new Set(
            BlackwoodBookshelfState.shelfRecords.map(function (record) {
                return record.book_id;
            })
        );

        return BLACKWOOD_BOOKSHELF_BOOKS
            .filter(function (book) {
                return !filedBookIds.has(book.id);
            })
            .sort(function (a, b) {
                return Number(a.defaultOrder || 1000) - Number(b.defaultOrder || 1000);
            });
    }

    function getBookById(bookId) {
        return BLACKWOOD_BOOKSHELF_BOOKS.find(function (book) {
            return book.id === bookId;
        }) || null;
    }

    function getRecordByBookId(bookId) {
        return BlackwoodBookshelfState.shelfRecords.find(function (record) {
            return record.book_id === bookId;
        }) || null;
    }

    function createDefaultRecord(book) {
        return {
            member_id: getCurrentUserId(),
            book_id: book.id,
            book_title: book.title,
            owned: false,
            has_read: false,
            is_arc: false,
            is_signed: false,
            wants_signed: false,
            is_favourite: false,
            shelf_status: "want_to_read",
            shelf_position: getNextShelfPosition("want_to_read"),
            format: "Not specified",
            notes: "",
            shelf_order: book.defaultOrder || 1000
        };
    }

    function normaliseShelfRecord(record) {
        const cleanShelfStatus = normaliseShelfStatus(
            record.shelf_status || deriveShelfStatusFromLegacyRecord(record)
        );

        return {
            id: record.id,
            member_id: record.member_id,
            book_id: String(record.book_id || "").trim(),
            book_title: String(record.book_title || "").trim(),
            owned: record.owned === true,
            has_read: record.has_read === true,
            is_arc: record.is_arc === true,
            is_signed: record.is_signed === true,
            wants_signed: record.wants_signed === true,
            is_favourite: record.is_favourite === true || cleanShelfStatus === "favourite",
            shelf_status: cleanShelfStatus,
            shelf_position: Number(record.shelf_position || record.shelf_order || 1000),
            format: String(record.format || "Not specified").trim(),
            notes: String(record.notes || "").trim(),
            shelf_order: Number(record.shelf_order || 1000),
            created_at: record.created_at,
            updated_at: record.updated_at
        };
    }

    function deriveShelfStatusFromLegacyRecord(record) {
        if (!record) {
            return "want_to_read";
        }

        if (record.is_favourite === true) {
            return "favourite";
        }

        if (record.has_read === true) {
            return "read";
        }

        if (record.owned === true || record.is_arc === true) {
            return "tbr";
        }

        return "want_to_read";
    }

    function getShelfStageCounts(shelfItems) {
        return shelfItems.reduce(function (counts, item) {
            const status = normaliseShelfStatus(item.record.shelf_status);

            counts[status] = (counts[status] || 0) + 1;

            return counts;
        }, {});
    }

    function getShelfStageById(stageId) {
        const cleanStageId = normaliseShelfStatus(stageId);

        return BLACKWOOD_BOOKSHELF_STAGES.find(function (stage) {
            return stage.id === cleanStageId;
        }) || BLACKWOOD_BOOKSHELF_STAGES[0];
    }

    function getShelfStageLabel(stageId) {
        const stage = getShelfStageById(stageId);

        return stage ? stage.label : "Want to Read";
    }

    function getShelfStageOrder(stageId) {
        const cleanStageId = normaliseShelfStatus(stageId);
        const index = BLACKWOOD_BOOKSHELF_STAGES.findIndex(function (stage) {
            return stage.id === cleanStageId;
        });

        return index >= 0 ? index : 999;
    }

    function getNextShelfPosition(stageId) {
        const stageItems = getShelfItemsForStage(stageId);

        if (!stageItems.length) {
            return 10;
        }

        const highestPosition = stageItems.reduce(function (highest, item) {
            return Math.max(
                highest,
                Number(item.record.shelf_position || item.record.shelf_order || item.book.defaultOrder || 0)
            );
        }, 0);

        return highestPosition + 10;
    }

    function normaliseShelfStatus(value) {
        const cleanValue = String(value || "")
            .trim()
            .toLowerCase()
            .replace(/\s+/g, "_")
            .replace(/-/g, "_");

        const allowed = BLACKWOOD_BOOKSHELF_STAGES.some(function (stage) {
            return stage.id === cleanValue;
        });

        return allowed ? cleanValue : "want_to_read";
    }

    // =========================
    // CUSTOMISATION DATA HELPERS
    // =========================

    function flattenCustomisationItems(data) {
        if (Array.isArray(data)) {
            return data;
        }

        if (!data || typeof data !== "object") {
            return [];
        }

        if (Array.isArray(data.items)) {
            return data.items;
        }

        if (Array.isArray(data.customisationItems)) {
            return data.customisationItems;
        }

        if (Array.isArray(data.shelfItems)) {
            return data.shelfItems;
        }

        const groupedItems = [];

        BLACKWOOD_BOOKSHELF_CUSTOMISATION_SLOTS.forEach(function (slot) {
            const possibleKeys = getCustomisationSlotKeys(slot.id);

            possibleKeys.forEach(function (key) {
                if (Array.isArray(data[key])) {
                    data[key].forEach(function (item) {
                        groupedItems.push({
                            ...item,
                            slot: item.slot || slot.id
                        });
                    });
                }
            });
        });

        if (Array.isArray(data.categories)) {
            data.categories.forEach(function (category) {
                const slot = normaliseCustomisationSlot(category.slot || category.id || category.type || "");

                if (Array.isArray(category.items)) {
                    category.items.forEach(function (item) {
                        groupedItems.push({
                            ...item,
                            slot: item.slot || slot
                        });
                    });
                }
            });
        }

        return groupedItems;
    }

    function normaliseCustomisationItem(rawItem, index) {
        const raw = rawItem && typeof rawItem === "object" ? rawItem : {};
        const slot = normaliseCustomisationSlot(raw.slot || raw.type || raw.category || raw.kind || "");
        const title = String(raw.title || raw.label || raw.name || "Shelf Addition").trim();
        const id = createSlug(String(raw.id || raw.slug || `${slot}-${title}-${index || 0}`));

        const pointsRequired = Number(
            raw.points_required ||
            raw.pointsRequired ||
            raw.required_points ||
            raw.requiredPoints ||
            raw.unlock_points ||
            raw.unlockPoints ||
            0
        );

        const purchaseCost = Number(
            raw.purchase_cost ||
            raw.purchaseCost ||
            raw.points_cost ||
            raw.pointsCost ||
            raw.cost ||
            0
        );

        return {
            id,
            slot,
            title,
            description: String(raw.description || raw.copy || raw.note || raw.unlock_description || "").trim(),
            symbol: String(raw.symbol || raw.icon || raw.glyph || "").trim(),
            image: String(raw.image || raw.image_url || raw.imageUrl || raw.preview || "").trim(),
            className: String(raw.className || raw.class || raw.cssClass || raw.themeClass || `bookshelf-custom-${slot}-${id}`).trim(),
            rarity: String(raw.rarity || raw.issue || "standard").trim(),
            defaultSelected: raw.default === true || raw.defaultSelected === true || raw.is_default === true,
            isDefault: raw.default === true || raw.isDefault === true || raw.is_default === true,
            isFree: raw.free === true || raw.is_free === true,
            pointsRequired: Number.isFinite(pointsRequired) ? Math.max(0, pointsRequired) : 0,
            purchaseCost: Number.isFinite(purchaseCost) ? Math.max(0, purchaseCost) : 0,
            requires: normaliseCustomisationRequirements(raw),
            unlockText: String(raw.unlockText || raw.unlock_text || raw.lockedText || raw.locked_text || "").trim(),
            sortOrder: Number(raw.order || raw.sortOrder || raw.sort_order || raw.defaultOrder || 1000),
            cssVars: normaliseCssVars(raw.cssVars || raw.css_vars || raw.variables || {}),
            background: String(raw.background || raw.backgroundColor || raw.background_color || "").trim(),
            accent: String(raw.accent || raw.accentColor || raw.accent_color || "").trim(),
            glow: String(raw.glow || raw.glowColor || raw.glow_color || "").trim()
        };
    }

    function normaliseCustomisationRequirements(raw) {
        const unlock = raw.unlock && typeof raw.unlock === "object" ? raw.unlock : {};
        const requires = raw.requires && typeof raw.requires === "object" ? raw.requires : {};
        const achievement = raw.achievement && typeof raw.achievement === "object" ? raw.achievement : {};

        return {
            points: Number(
                requires.points ||
                unlock.points ||
                unlock.points_required ||
                raw.points_required ||
                raw.pointsRequired ||
                0
            ),
            ownedBooks: Number(
                requires.ownedBooks ||
                requires.owned_books ||
                unlock.ownedBooks ||
                unlock.owned_books ||
                raw.ownedBooksRequired ||
                raw.owned_books_required ||
                0
            ),
            readBooks: Number(
                requires.readBooks ||
                requires.read_books ||
                unlock.readBooks ||
                unlock.read_books ||
                raw.readBooksRequired ||
                raw.read_books_required ||
                0
            ),
            reviewedBooks: Number(
                requires.reviewedBooks ||
                requires.reviewed_books ||
                unlock.reviewedBooks ||
                unlock.reviewed_books ||
                raw.reviewedBooksRequired ||
                raw.reviewed_books_required ||
                0
            ),
            favouriteBooks: Number(
                requires.favouriteBooks ||
                requires.favoriteBooks ||
                requires.favourite_books ||
                requires.favorite_books ||
                unlock.favouriteBooks ||
                unlock.favoriteBooks ||
                raw.favouriteBooksRequired ||
                raw.favoriteBooksRequired ||
                0
            ),
            arcBooks: Number(
                requires.arcBooks ||
                requires.arc_books ||
                unlock.arcBooks ||
                unlock.arc_books ||
                raw.arcBooksRequired ||
                raw.arc_books_required ||
                0
            ),
            signedBooks: Number(
                requires.signedBooks ||
                requires.signed_books ||
                unlock.signedBooks ||
                unlock.signed_books ||
                raw.signedBooksRequired ||
                raw.signed_books_required ||
                0
            ),
            bookId: String(
                requires.bookId ||
                requires.book_id ||
                unlock.bookId ||
                unlock.book_id ||
                achievement.bookId ||
                achievement.book_id ||
                raw.requiresBookId ||
                raw.requires_book_id ||
                ""
            ).trim(),
            readBookId: String(
                requires.readBookId ||
                requires.read_book_id ||
                unlock.readBookId ||
                unlock.read_book_id ||
                achievement.readBookId ||
                achievement.read_book_id ||
                raw.requiresReadBookId ||
                raw.requires_read_book_id ||
                ""
            ).trim(),
            stage: normaliseShelfStatus(
                requires.stage ||
                requires.shelf_status ||
                unlock.stage ||
                unlock.shelf_status ||
                raw.requiresStage ||
                ""
            ),
            stageCount: Number(
                requires.stageCount ||
                requires.stage_count ||
                unlock.stageCount ||
                unlock.stage_count ||
                raw.requiresStageCount ||
                raw.requires_stage_count ||
                0
            )
        };
    }

    function normaliseCssVars(rawVars) {
        const vars = {};

        if (!rawVars || typeof rawVars !== "object" || Array.isArray(rawVars)) {
            return vars;
        }

        Object.keys(rawVars).forEach(function (key) {
            const cleanKey = String(key || "").trim();

            if (!/^--[a-z0-9-]+$/i.test(cleanKey)) {
                return;
            }

            vars[cleanKey] = String(rawVars[key] || "").trim();
        });

        return vars;
    }

    function sortCustomisationItems(a, b) {
        const aSlotOrder = getCustomisationSlotOrder(a.slot);
        const bSlotOrder = getCustomisationSlotOrder(b.slot);

        if (aSlotOrder !== bSlotOrder) {
            return aSlotOrder - bSlotOrder;
        }

        if (Number(a.sortOrder || 1000) !== Number(b.sortOrder || 1000)) {
            return Number(a.sortOrder || 1000) - Number(b.sortOrder || 1000);
        }

        return String(a.title).localeCompare(String(b.title));
    }

    function getCustomisationItemsForDisplay() {
        const filter = normaliseCustomisationFilter(BlackwoodBookshelfState.customisationFilter);
        const items = Array.isArray(BlackwoodBookshelfState.customisationItems)
            ? BlackwoodBookshelfState.customisationItems
            : [];

        if (filter === "all") {
            return items;
        }

        if (filter === "locked") {
            const unlockedIds = getUnlockedCustomisationItemIds();

            return items.filter(function (item) {
                return !unlockedIds.has(item.id);
            });
        }

        return items.filter(function (item) {
            return item.slot === filter;
        });
    }

    function getCustomisationFilterCounts() {
        const items = Array.isArray(BlackwoodBookshelfState.customisationItems)
            ? BlackwoodBookshelfState.customisationItems
            : [];

        const unlockedIds = getUnlockedCustomisationItemIds();

        return items.reduce(function (counts, item) {
            counts.all += 1;
            counts[item.slot] = (counts[item.slot] || 0) + 1;

            if (!unlockedIds.has(item.id)) {
                counts.locked += 1;
            }

            return counts;
        }, {
            all: 0,
            background: 0,
            bookends: 0,
            charm: 0,
            object: 0,
            nameplate: 0,
            lighting: 0,
            locked: 0
        });
    }

    function createDefaultCustomisationRecord() {
        return {
            member_id: "",
            selections: {},
            unlockedItemIds: [],
            updated_at: ""
        };
    }

    function normaliseCustomisationRecord(record) {
        const source = record && typeof record === "object"
            ? record
            : createDefaultCustomisationRecord();

        const selectedItems = parseMaybeJson(source.selected_items || source.selectedItems || {});
        const unlockedItems = parseMaybeJson(
            source.unlocked_items ||
            source.unlocked_item_ids ||
            source.unlockedItemIds ||
            []
        );

        const selections = {
            ...normaliseCustomisationSelectionMap(selectedItems)
        };

        BLACKWOOD_BOOKSHELF_CUSTOMISATION_SLOTS.forEach(function (slot) {
            const flatValue = source[`selected_${slot.id}_id`] ||
                source[`${slot.id}_id`] ||
                source[slot.id];

            if (flatValue) {
                selections[slot.id] = String(flatValue).trim();
            }
        });

        return {
            member_id: String(source.member_id || getCurrentUserId() || "").trim(),
            selections,
            unlockedItemIds: uniqueStrings(Array.isArray(unlockedItems) ? unlockedItems : []),
            updated_at: source.updated_at || ""
        };
    }

    function normaliseCustomisationSelectionMap(rawSelections) {
        const selections = {};

        if (!rawSelections || typeof rawSelections !== "object" || Array.isArray(rawSelections)) {
            return selections;
        }

        BLACKWOOD_BOOKSHELF_CUSTOMISATION_SLOTS.forEach(function (slot) {
            const value = rawSelections[slot.id] ||
                rawSelections[`${slot.id}_id`] ||
                rawSelections[`selected_${slot.id}_id`];

            if (value) {
                selections[slot.id] = String(value).trim();
            }
        });

        return selections;
    }

    function buildCustomisationPayloads(userId, record) {
        const selections = getNormalisedCustomisationSelections(record);
        const unlockedItemIds = uniqueStrings(record.unlockedItemIds || []);
        const now = record.updated_at || new Date().toISOString();

        const flatPayload = {
            member_id: userId,
            selected_background_id: selections.background || null,
            selected_bookends_id: selections.bookends || null,
            selected_charm_id: selections.charm || null,
            selected_object_id: selections.object || null,
            selected_nameplate_id: selections.nameplate || null,
            selected_lighting_id: selections.lighting || null,
            updated_at: now
        };

        const jsonPayload = {
            member_id: userId,
            selected_items: selections,
            unlocked_items: unlockedItemIds,
            updated_at: now
        };

        const jsonPayloadAlternative = {
            member_id: userId,
            selected_items: selections,
            unlocked_item_ids: unlockedItemIds,
            updated_at: now
        };

        return [
            {
                ...flatPayload,
                selected_items: selections,
                unlocked_items: unlockedItemIds
            },
            {
                ...flatPayload,
                selected_items: selections,
                unlocked_item_ids: unlockedItemIds
            },
            jsonPayload,
            jsonPayloadAlternative,
            flatPayload
        ];
    }

    function applyDefaultCustomisationSelections() {
        const record = normaliseCustomisationRecord(BlackwoodBookshelfState.customisationRecord);
        const unlockedIds = getUnlockedCustomisationItemIds(record);
        const selections = {
            ...record.selections
        };

        BLACKWOOD_BOOKSHELF_CUSTOMISATION_SLOTS.forEach(function (slot) {
            if (selections[slot.id]) {
                return;
            }

            const defaultItem = BlackwoodBookshelfState.customisationItems.find(function (item) {
                return item.slot === slot.id &&
                    unlockedIds.has(item.id) &&
                    (item.defaultSelected || item.isDefault);
            });

            if (defaultItem) {
                selections[slot.id] = defaultItem.id;
            }
        });

        record.selections = selections;
        BlackwoodBookshelfState.customisationRecord = record;
    }

    function getUnlockedCustomisationItemIds(recordOverride) {
        const record = normaliseCustomisationRecord(recordOverride || BlackwoodBookshelfState.customisationRecord);
        const metrics = getBookshelfCustomisationMetrics();
        const selectedIds = Object.values(record.selections || {}).filter(Boolean);
        const storedIds = Array.isArray(record.unlockedItemIds) ? record.unlockedItemIds : [];
        const unlockedIds = new Set(uniqueStrings([
            ...selectedIds,
            ...storedIds
        ]));

        BlackwoodBookshelfState.customisationItems.forEach(function (item) {
            if (isCustomisationItemAutomaticallyUnlocked(item, metrics)) {
                unlockedIds.add(item.id);
            }
        });

        return unlockedIds;
    }

    function isCustomisationItemAutomaticallyUnlocked(item, metrics) {
        if (!item) {
            return false;
        }

        if (item.isDefault || item.isFree || item.defaultSelected) {
            return true;
        }

        const hasAnyRequirement = hasCustomisationRequirement(item);

        if (!hasAnyRequirement) {
            return true;
        }

        if (item.pointsRequired > 0 && metrics.points < item.pointsRequired) {
            return false;
        }

        const requires = item.requires || {};

        if (Number(requires.points || 0) > 0 && metrics.points < Number(requires.points || 0)) {
            return false;
        }

        if (Number(requires.ownedBooks || 0) > 0 && metrics.ownedBooks < Number(requires.ownedBooks || 0)) {
            return false;
        }

        if (Number(requires.readBooks || 0) > 0 && metrics.readBooks < Number(requires.readBooks || 0)) {
            return false;
        }

        if (Number(requires.reviewedBooks || 0) > 0 && metrics.reviewedBooks < Number(requires.reviewedBooks || 0)) {
            return false;
        }

        if (Number(requires.favouriteBooks || 0) > 0 && metrics.favouriteBooks < Number(requires.favouriteBooks || 0)) {
            return false;
        }

        if (Number(requires.arcBooks || 0) > 0 && metrics.arcBooks < Number(requires.arcBooks || 0)) {
            return false;
        }

        if (Number(requires.signedBooks || 0) > 0 && metrics.signedBooks < Number(requires.signedBooks || 0)) {
            return false;
        }

        if (requires.bookId && !hasBookOnShelf(requires.bookId)) {
            return false;
        }

        if (requires.readBookId && !hasReadBookOnShelf(requires.readBookId)) {
            return false;
        }

        if (requires.stage && Number(requires.stageCount || 0) > 0) {
            const count = getShelfItemsForStage(requires.stage).length;

            if (count < Number(requires.stageCount || 0)) {
                return false;
            }
        }

        return true;
    }

    function hasCustomisationRequirement(item) {
        const requires = item.requires || {};

        return item.pointsRequired > 0 ||
            item.purchaseCost > 0 ||
            Number(requires.points || 0) > 0 ||
            Number(requires.ownedBooks || 0) > 0 ||
            Number(requires.readBooks || 0) > 0 ||
            Number(requires.reviewedBooks || 0) > 0 ||
            Number(requires.favouriteBooks || 0) > 0 ||
            Number(requires.arcBooks || 0) > 0 ||
            Number(requires.signedBooks || 0) > 0 ||
            Boolean(requires.bookId) ||
            Boolean(requires.readBookId) ||
            Boolean(requires.stage && Number(requires.stageCount || 0) > 0);
    }

    function getBookshelfCustomisationMetrics() {
        const shelfItems = getShelfItems();
        const points = getBookshelfPointsTotal();

        return {
            points,
            totalBooks: shelfItems.length,
            ownedBooks: shelfItems.filter(function (item) {
                return item.record.owned === true;
            }).length,
            readBooks: shelfItems.filter(function (item) {
                return item.record.has_read === true ||
                    ["read", "reviewed", "favourite"].includes(item.record.shelf_status);
            }).length,
            reviewedBooks: shelfItems.filter(function (item) {
                return item.record.shelf_status === "reviewed";
            }).length,
            favouriteBooks: shelfItems.filter(function (item) {
                return item.record.is_favourite === true ||
                    item.record.shelf_status === "favourite";
            }).length,
            arcBooks: shelfItems.filter(function (item) {
                return item.record.is_arc === true;
            }).length,
            signedBooks: shelfItems.filter(function (item) {
                return item.record.is_signed === true;
            }).length
        };
    }

    function getBookshelfPointsTotal() {
        const profile = BlackwoodBookshelfState.memberProfile || {};
        const points = Number(profile.points_total || 0);

        return Number.isFinite(points) ? points : 0;
    }

    function getBookshelfCustomisationMetricSummary(metrics) {
        const bookLabel = metrics.totalBooks === 1 ? "1 spine filed" : `${metrics.totalBooks} spines filed`;

        return `${bookLabel} · ${metrics.points} Circle points`;
    }

    function getBookshelfCustomisationSummary() {
        const items = Array.isArray(BlackwoodBookshelfState.customisationItems)
            ? BlackwoodBookshelfState.customisationItems
            : [];

        if (!items.length) {
            return "Shelf Display";
        }

        const unlockedIds = getUnlockedCustomisationItemIds();
        const unlockedCount = items.filter(function (item) {
            return unlockedIds.has(item.id);
        }).length;

        return `${unlockedCount} Issued`;
    }

    function getCustomisationLockedReason(item) {
        if (!item) {
            return "Locked";
        }

        if (item.unlockText) {
            return item.unlockText;
        }

        const requirements = [];
        const requires = item.requires || {};

        if (item.pointsRequired > 0) {
            requirements.push(`${item.pointsRequired} Circle points`);
        }

        if (Number(requires.points || 0) > 0) {
            requirements.push(`${Number(requires.points)} Circle points`);
        }

        if (Number(requires.ownedBooks || 0) > 0) {
            requirements.push(`own ${Number(requires.ownedBooks)} book${Number(requires.ownedBooks) === 1 ? "" : "s"}`);
        }

        if (Number(requires.readBooks || 0) > 0) {
            requirements.push(`read ${Number(requires.readBooks)} book${Number(requires.readBooks) === 1 ? "" : "s"}`);
        }

        if (Number(requires.reviewedBooks || 0) > 0) {
            requirements.push(`review ${Number(requires.reviewedBooks)} book${Number(requires.reviewedBooks) === 1 ? "" : "s"}`);
        }

        if (Number(requires.favouriteBooks || 0) > 0) {
            requirements.push(`favourite ${Number(requires.favouriteBooks)} book${Number(requires.favouriteBooks) === 1 ? "" : "s"}`);
        }

        if (Number(requires.arcBooks || 0) > 0) {
            requirements.push(`file ${Number(requires.arcBooks)} ARC book${Number(requires.arcBooks) === 1 ? "" : "s"}`);
        }

        if (Number(requires.signedBooks || 0) > 0) {
            requirements.push(`own ${Number(requires.signedBooks)} signed book${Number(requires.signedBooks) === 1 ? "" : "s"}`);
        }

        if (requires.bookId) {
            const book = getBookById(requires.bookId);
            requirements.push(`add ${book ? book.title : requires.bookId}`);
        }

        if (requires.readBookId) {
            const book = getBookById(requires.readBookId);
            requirements.push(`read ${book ? book.title : requires.readBookId}`);
        }

        if (requirements.length) {
            return `Issued after you ${requirements.join(", ")}.`;
        }

        return "Locked";
    }

    function getNormalisedCustomisationSelections(recordOverride) {
        const record = normaliseCustomisationRecord(recordOverride || BlackwoodBookshelfState.customisationRecord);

        return {
            ...record.selections
        };
    }

    function getSelectedCustomisationItems() {
        const selections = getNormalisedCustomisationSelections();

        return Object.keys(selections)
            .map(function (slotId) {
                return getCustomisationItemById(selections[slotId]);
            })
            .filter(Boolean);
    }

    function getSelectedCustomisationItemBySlot(slotId) {
        const cleanSlotId = normaliseCustomisationSlot(slotId);
        const selections = getNormalisedCustomisationSelections();

        return selections[cleanSlotId]
            ? getCustomisationItemById(selections[cleanSlotId])
            : null;
    }

    function isCustomisationItemSelected(item) {
        const selections = getNormalisedCustomisationSelections();

        return selections[item.slot] === item.id;
    }

    function getCustomisationItemById(itemId) {
        const cleanItemId = String(itemId || "").trim();

        return BlackwoodBookshelfState.customisationItems.find(function (item) {
            return item.id === cleanItemId;
        }) || null;
    }

    function getCustomisationSlotById(slotId) {
        const cleanSlotId = normaliseCustomisationSlot(slotId);

        return BLACKWOOD_BOOKSHELF_CUSTOMISATION_SLOTS.find(function (slot) {
            return slot.id === cleanSlotId;
        }) || null;
    }

    function getCustomisationSlotOrder(slotId) {
        const cleanSlotId = normaliseCustomisationSlot(slotId);
        const index = BLACKWOOD_BOOKSHELF_CUSTOMISATION_SLOTS.findIndex(function (slot) {
            return slot.id === cleanSlotId;
        });

        return index >= 0 ? index : 999;
    }

    function normaliseCustomisationSlot(value) {
        const cleanValue = String(value || "")
            .trim()
            .toLowerCase()
            .replace(/\s+/g, "_")
            .replace(/-/g, "_");

        if (["background", "backgrounds", "shelf_background", "shelf_wall", "wall"].includes(cleanValue)) {
            return "background";
        }

        if (["bookend", "bookends", "book_end", "book_ends"].includes(cleanValue)) {
            return "bookends";
        }

        if (["charm", "charms", "hanging_object", "hanging_objects"].includes(cleanValue)) {
            return "charm";
        }

        if (["object", "objects", "desk_object", "desk_objects", "shelf_object", "shelf_objects", "prop", "props"].includes(cleanValue)) {
            return "object";
        }

        if (["nameplate", "nameplates", "label", "labels", "plate", "plates"].includes(cleanValue)) {
            return "nameplate";
        }

        if (["lighting", "light", "lights", "atmosphere", "mood"].includes(cleanValue)) {
            return "lighting";
        }

        const allowed = BLACKWOOD_BOOKSHELF_CUSTOMISATION_SLOTS.some(function (slot) {
            return slot.id === cleanValue;
        });

        return allowed ? cleanValue : "";
    }

    function normaliseCustomisationFilter(value) {
        const cleanValue = String(value || "")
            .trim()
            .toLowerCase()
            .replace(/\s+/g, "_")
            .replace(/-/g, "_");

        const allowed = BLACKWOOD_BOOKSHELF_CUSTOMISATION_FILTERS.some(function (filter) {
            return filter.id === cleanValue;
        });

        return allowed ? cleanValue : "all";
    }

    function getCustomisationSlotKeys(slotId) {
        if (slotId === "background") {
            return ["background", "backgrounds", "shelf_backgrounds", "shelfBackgrounds"];
        }

        if (slotId === "bookends") {
            return ["bookends", "book_ends", "bookEnds"];
        }

        if (slotId === "charm") {
            return ["charms", "charm", "hanging_objects", "hangingObjects"];
        }

        if (slotId === "object") {
            return ["objects", "object", "desk_objects", "deskObjects", "shelf_objects", "shelfObjects"];
        }

        if (slotId === "nameplate") {
            return ["nameplates", "nameplate", "labels", "plates"];
        }

        if (slotId === "lighting") {
            return ["lighting", "lights", "atmosphere"];
        }

        return [slotId];
    }

    function getBookshelfCustomisationClassNames() {
        const classes = [];

        getSelectedCustomisationItems().forEach(function (item) {
            classes.push(`has-custom-${item.slot}`);
            classes.push(`has-custom-${item.slot}-${item.id}`);

            if (item.className) {
                classes.push(item.className);
            }
        });

        return uniqueStrings(classes).join(" ");
    }

    function getBookshelfCustomisationDataAttributes() {
        const selections = getNormalisedCustomisationSelections();

        return BLACKWOOD_BOOKSHELF_CUSTOMISATION_SLOTS.map(function (slot) {
            const value = selections[slot.id] || "";

            return `data-bookshelf-custom-${escapeAttribute(slot.id)}="${escapeAttribute(value)}"`;
        }).join(" ");
    }

    function getBookshelfCustomisationStyle() {
        const declarations = [];

        getSelectedCustomisationItems().forEach(function (item) {
            if (item.slot === "background" && item.image) {
                declarations.push(`--bookshelf-custom-background-image: url('${safeCssUrl(item.image)}')`);
            }

            if (item.background) {
                declarations.push(`--bookshelf-custom-background: ${safeCssValue(item.background)}`);
            }

            if (item.accent) {
                declarations.push(`--bookshelf-custom-accent: ${safeCssValue(item.accent)}`);
            }

            if (item.glow) {
                declarations.push(`--bookshelf-custom-glow: ${safeCssValue(item.glow)}`);
            }

            Object.keys(item.cssVars || {}).forEach(function (key) {
                declarations.push(`${key}: ${safeCssValue(item.cssVars[key])}`);
            });
        });

        return declarations.length ? `${declarations.join("; ")};` : "";
    }

    function hasBookOnShelf(bookId) {
        const cleanBookId = String(bookId || "").trim();

        return BlackwoodBookshelfState.shelfRecords.some(function (record) {
            return record.book_id === cleanBookId;
        });
    }

    function hasReadBookOnShelf(bookId) {
        const cleanBookId = String(bookId || "").trim();

        return BlackwoodBookshelfState.shelfRecords.some(function (record) {
            return record.book_id === cleanBookId &&
                (
                    record.has_read === true ||
                    ["read", "reviewed", "favourite"].includes(record.shelf_status)
                );
        });
    }

    function getCustomisationTableNamesForQuery() {
        return uniqueStrings([
            BlackwoodBookshelfState.currentCustomisationTableName,
            ...BLACKWOOD_BOOKSHELF_CONFIG.customisationTableNames
        ].filter(Boolean));
    }

    function getCustomisationStorageKey() {
        return `${BLACKWOOD_BOOKSHELF_CONFIG.customisationLocalStoragePrefix}${getCurrentUserId() || "anonymous"}`;
    }

    function loadCustomisationFromLocalStorage() {
        try {
            const stored = window.localStorage.getItem(getCustomisationStorageKey());

            if (!stored) {
                return null;
            }

            return normaliseCustomisationRecord(JSON.parse(stored));

        } catch (error) {
            console.warn("Bookshelf customisation local storage could not be loaded:", error);
            return null;
        }
    }

    function saveCustomisationToLocalStorage(record) {
        try {
            window.localStorage.setItem(
                getCustomisationStorageKey(),
                JSON.stringify(normaliseCustomisationRecord(record))
            );
        } catch (error) {
            console.warn("Bookshelf customisation local storage could not be saved:", error);
        }
    }

    // =========================
    // STATUS HELPERS
    // =========================

    function setBookshelfStatus(message, className) {
        BlackwoodBookshelfState.statusMessage = message || "";
        BlackwoodBookshelfState.statusType = className || "";

        const status = document.getElementById("blackwood-bookshelf-status");

        if (!status) {
            return;
        }

        status.textContent = BlackwoodBookshelfState.statusMessage;
        status.classList.remove("is-success", "is-error", "is-loading");

        if (BlackwoodBookshelfState.statusType) {
            status.classList.add(BlackwoodBookshelfState.statusType);
        }
    }

    function setBookshelfCustomisationStatus(message, className) {
        BlackwoodBookshelfState.customisationStatusMessage = message || "";
        BlackwoodBookshelfState.customisationStatusType = className || "";

        const status = document.getElementById("bookshelf-customisation-status");

        if (!status) {
            return;
        }

        status.textContent = BlackwoodBookshelfState.customisationStatusMessage;
        status.classList.remove("is-success", "is-error", "is-loading");

        if (BlackwoodBookshelfState.customisationStatusType) {
            status.classList.add(BlackwoodBookshelfState.customisationStatusType);
        }
    }

    function setBookshelfModalStatus(message, className) {
        const status = document.getElementById("bookshelf-modal-status");

        if (!status) {
            return;
        }

        status.textContent = message || "";
        status.classList.remove("is-success", "is-error", "is-loading");

        if (className) {
            status.classList.add(className);
        }
    }

    // =========================
    // GENERAL HELPERS
    // =========================

    function getCurrentUserId() {
        return BlackwoodBookshelfState.session &&
            BlackwoodBookshelfState.session.user &&
            BlackwoodBookshelfState.session.user.id
            ? BlackwoodBookshelfState.session.user.id
            : "";
    }

    function cleanBookshelfError(message) {
        const cleaned = String(message || "").trim();

        if (!cleaned) {
            return "Something went wrong. Please try again.";
        }

        if (/duplicate key/i.test(cleaned)) {
            return "This book is already on your shelf.";
        }

        if (/row-level security/i.test(cleaned)) {
            return "Your shelf record could not be saved securely. Please sign out and back in.";
        }

        if (/shelf_status|shelf_position|is_favourite/i.test(cleaned)) {
            return "Bookshelf stage fields are missing in Supabase. Please run the Phase 2C bookshelf SQL first.";
        }

        if (/customisation|customization|selected_items|unlocked_items|selected_background_id|selected_lighting_id/i.test(cleaned)) {
            return "Shelf customisation fields could not be saved. The display has been kept locally on this device.";
        }

        return cleaned;
    }

    function isLikelyMissingDbStructureError(message) {
        const cleaned = String(message || "");

        return /does not exist|schema cache|column|relation|table|selected_items|unlocked_items|selected_background_id|selected_lighting_id|selected_bookends_id|selected_charm_id|selected_object_id|selected_nameplate_id/i.test(cleaned);
    }

    function parseMaybeJson(value) {
        if (!value) {
            return Array.isArray(value) ? [] : {};
        }

        if (typeof value === "object") {
            return value;
        }

        if (typeof value === "string") {
            try {
                return JSON.parse(value);
            } catch (error) {
                return value
                    .split(",")
                    .map(function (item) {
                        return item.trim();
                    })
                    .filter(Boolean);
            }
        }

        return {};
    }

    function uniqueStrings(values) {
        return Array.from(new Set(
            values
                .map(function (value) {
                    return String(value || "").trim();
                })
                .filter(Boolean)
        ));
    }

    function createSlug(value) {
        return String(value || "")
            .trim()
            .toLowerCase()
            .replace(/&/g, "and")
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "")
            .slice(0, 80);
    }

    function safeCssUrl(value) {
        return String(value || "")
            .replace(/\\/g, "")
            .replace(/'/g, "\\'")
            .replace(/"/g, "")
            .replace(/[<>]/g, "");
    }

    function safeCssValue(value) {
        return String(value || "")
            .replace(/[<>]/g, "")
            .replace(/"/g, "'")
            .trim();
    }

    function escapeHtml(value) {
        return String(value || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function escapeAttribute(value) {
        return escapeHtml(value).replace(/`/g, "&#096;");
    }
})();

        const kicker = item.querySelector(".bookshelf-customisation-item-kicker");

        if (kicker && kicker.textContent) {
            return normaliseFilter(kicker.textContent);
        }

        return getFilterFromText(item.textContent || "");
    }

    function getFilterFromText(text) {
        const cleanText = String(text || "").toLowerCase();

        if (cleanText.includes("background")) return "background";
        if (cleanText.includes("bookend")) return "bookends";
        if (cleanText.includes("charm")) return "charm";
        if (cleanText.includes("object")) return "object";
        if (cleanText.includes("nameplate")) return "nameplate";
        if (cleanText.includes("lighting")) return "lighting";
        if (cleanText.includes("locked")) return "locked";

        return "all";
    }

    function normaliseFilter(value) {
        const cleanValue = String(value || "all")
            .trim()
            .toLowerCase()
            .replace(/\s+/g, "_")
            .replace(/-/g, "_");

        if (cleanValue === "backgrounds") return "background";
        if (cleanValue === "background") return "background";

        if (cleanValue === "bookend") return "bookends";
        if (cleanValue === "bookends") return "bookends";

        if (cleanValue === "charms") return "charm";
        if (cleanValue === "charm") return "charm";

        if (cleanValue === "objects") return "object";
        if (cleanValue === "object") return "object";

        if (cleanValue === "nameplates") return "nameplate";
        if (cleanValue === "nameplate") return "nameplate";

        if (cleanValue === "lights") return "lighting";
        if (cleanValue === "light") return "lighting";
        if (cleanValue === "lighting") return "lighting";

        if (cleanValue === "locked") return "locked";

        return "all";
    }

    function getFilterLabel(filter) {
        const labels = {
            all: "All",
            background: "Background",
            bookends: "Bookends",
            charm: "Charm",
            object: "Object",
            nameplate: "Nameplate",
            lighting: "Lighting",
            locked: "Locked"
        };

        return labels[filter] || "All";
    }
})();
