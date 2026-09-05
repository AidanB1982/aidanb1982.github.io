// =========================
// BLACKWOOD MEMBER BOOKSHELF
// Private shelf records powered by Supabase
// Phase 2C: Collapsible shelf drawer + shelf stages + rearrange controls
// Phase 2E: Shelf customisation, filters, unlock checks + safe local/Supabase save
// =========================

(function () {
    "use strict";

    const BLACKWOOD_BOOKSHELF_CONFIG = {
        rootId: "blackwood-bookshelf-root",
        tableName: "member_book_shelf",
        customisationItemsPath: "/data/shelf-customisation-items.json",
        customisationTableNames: [
            "member_shelf_customisations",
            "member_shelf_customisation",
            "member_bookshelf_customisations"
        ]
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
            emptyLabel: "Not selected"
        },
        {
            id: "bookends",
            label: "Bookends",
            shortLabel: "Bookends",
            emptyLabel: "Not selected"
        },
        {
            id: "charm",
            label: "Charm",
            shortLabel: "Charm",
            emptyLabel: "Not selected"
        },
        {
            id: "object",
            label: "Shelf Object",
            shortLabel: "Object",
            emptyLabel: "Not selected"
        },
        {
            id: "nameplate",
            label: "Nameplate",
            shortLabel: "Nameplate",
            emptyLabel: "Not selected"
        },
        {
            id: "lighting",
            label: "Lighting",
            shortLabel: "Lighting",
            emptyLabel: "Not selected"
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
        member: null,
        pointsTotal: 0,

        shelfRecords: [],

        customisationItems: [],
        customisationItemsLoaded: false,
        customisationItemsError: "",
        customisationSelections: createEmptyCustomisationSelections(),
        customisationFilter: "all",
        customisationStatusMessage: "",
        customisationStatusType: "",
        customisationStorageTable: "",
        customisationSaveMode: "local",
        isSavingCustomisation: false,

        modalMode: "closed",
        activeBookId: "",
        statusMessage: "",
        statusType: "",
        isBusy: false,
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
    BlackwoodBookshelfState.member = options ? options.member || null : null;
    BlackwoodBookshelfState.pointsTotal = Number(options && options.pointsTotal ? options.pointsTotal : 0);

    BlackwoodBookshelfState.modalMode = "closed";
    BlackwoodBookshelfState.activeBookId = "";
    BlackwoodBookshelfState.statusMessage = "";
    BlackwoodBookshelfState.statusType = "";
    BlackwoodBookshelfState.customisationStatusMessage = "";
    BlackwoodBookshelfState.customisationStatusType = "";
    BlackwoodBookshelfState.customisationFilter = "all";
    BlackwoodBookshelfState.customisationSaveMode = "local";
    BlackwoodBookshelfState.customisationStorageTable = "";

    ensureBookshelfEscapeListener();

    if (!BlackwoodBookshelfState.client || !getCurrentUserId()) {
        renderBookshelfUnavailable();
        return;
    }

    renderBookshelfLoading();

    try {
        await withBookshelfTimeout(
            loadBookshelfRecords(),
            8000,
            "Bookshelf records timed out."
        );

        BlackwoodBookshelfState.customisationSelections = normaliseCustomisationSelections(
            loadLocalShelfCustomisationSelections()
        );

        try {
            await withBookshelfTimeout(
                loadShelfCustomisationItems(),
                3000,
                "Shelf customisation items timed out."
            );
        } catch (customisationError) {
            console.warn("Shelf customisation skipped:", customisationError);
            BlackwoodBookshelfState.customisationItems = [];
            BlackwoodBookshelfState.customisationItemsLoaded = false;
            BlackwoodBookshelfState.customisationItemsError = "";
        }

        renderBookshelf();

    } catch (error) {
        console.error("Blackwood Bookshelf failed:", error);
        renderBookshelfError("Your Blackwood Bookshelf could not be opened. Please refresh and try again.");
    }
};

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

    async function loadShelfCustomisationItems() {
        BlackwoodBookshelfState.customisationItemsError = "";

        try {
            const response = await fetch(`${BLACKWOOD_BOOKSHELF_CONFIG.customisationItemsPath}?cache=${Date.now()}`);

            if (!response.ok) {
                throw new Error("Shelf customisation items could not be loaded.");
            }

            const data = await response.json();
            const items = extractCustomisationItemsFromData(data);

            BlackwoodBookshelfState.customisationItems = items;
            BlackwoodBookshelfState.customisationItemsLoaded = true;

        } catch (error) {
            console.warn("Shelf customisation JSON could not be loaded:", error);
            BlackwoodBookshelfState.customisationItems = [];
            BlackwoodBookshelfState.customisationItemsLoaded = false;
            BlackwoodBookshelfState.customisationItemsError = "Shelf customisation items could not be loaded.";
        }
    }

    async function loadShelfCustomisationRecord() {
    BlackwoodBookshelfState.customisationSelections = normaliseCustomisationSelections(
        loadLocalShelfCustomisationSelections()
    );

    BlackwoodBookshelfState.customisationStorageTable = "";
    BlackwoodBookshelfState.customisationSaveMode = "local";
}

        for (const tableName of BLACKWOOD_BOOKSHELF_CONFIG.customisationTableNames) {
            try {
                const { data, error } = await BlackwoodBookshelfState.client
                    .from(tableName)
                    .select("*")
                    .eq("member_id", userId)
                    .maybeSingle();

                if (error) {
                    continue;
                }

                BlackwoodBookshelfState.customisationStorageTable = tableName;
                BlackwoodBookshelfState.customisationSaveMode = "supabase";

                if (data) {
                    BlackwoodBookshelfState.customisationSelections = normaliseCustomisationSelections(
                        getRemoteShelfCustomisationSelections(data)
                    );
                }

                return;

            } catch (error) {
                console.warn(`Shelf customisation table check failed for ${tableName}:`, error);
            }
        }

        BlackwoodBookshelfState.customisationSaveMode = "local";
    }

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

    function renderBookshelf() {
        const shelfItems = getShelfItems();
        const totalBooks = shelfItems.length;
        const totalLabel = totalBooks === 1 ? "1 Book" : `${totalBooks} Books`;
        
        BlackwoodBookshelfState.root.innerHTML = `
            <div class="blackwood-bookshelf">
            <details
                class="bookshelf-drawer ${escapeAttribute(getShelfCustomisationClassNames())}"
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
                            <span class="bookshelf-drawer-chevrons" aria-hidden="true"></span>
                        </div>
                    </summary>

                    <div class="bookshelf-drawer-panel">
                        <div class="bookshelf-header">
                            <div>
                                <p class="bookshelf-kicker">Shelf Stages</p>
                                <h3>Your private reading board</h3>
                                <p>
                                    Move books between shelves, mark owned or signed editions, and rearrange titles inside each stage.
                                </p>
                            </div>

                            <button type="button" class="bookshelf-add-button" data-bookshelf-add>
                                Add to Your Collection
                            </button>
                        </div>

                        ${renderBookshelfStageSummary(shelfItems)}

                        ${renderShelfCustomisationPanel(shelfItems)}

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

    function renderShelfCustomisationPanel(shelfItems) {
        const items = BlackwoodBookshelfState.customisationItems;
        const pointsTotal = getCustomisationPointsTotal();
        const filedCount = shelfItems.length;
        const issuedCount = getIssuedCustomisationItems().length;
        const selectedItems = getSelectedCustomisationItems();

        if (BlackwoodBookshelfState.customisationItemsError) {
            return `
                <section class="bookshelf-customisation-panel" aria-labelledby="bookshelf-customisation-title">
                    <div class="bookshelf-customisation-header">
                        <div>
                            <p class="bookshelf-kicker">Issued Objects</p>
                            <h3 id="bookshelf-customisation-title">Customise Your Shelf</h3>
                            <p>${escapeHtml(BlackwoodBookshelfState.customisationItemsError)}</p>
                        </div>
                    </div>
                </section>
            `;
        }

        if (!items.length) {
            return `
                <section class="bookshelf-customisation-panel" aria-labelledby="bookshelf-customisation-title">
                    <div class="bookshelf-customisation-header">
                        <div>
                            <p class="bookshelf-kicker">Issued Objects</p>
                            <h3 id="bookshelf-customisation-title">Customise Your Shelf</h3>
                            <p>Shelf customisation items are waiting to be filed in the archive.</p>
                        </div>
                    </div>
                </section>
            `;
        }

        return `
            <section class="bookshelf-customisation-panel" aria-labelledby="bookshelf-customisation-title">
                <div class="bookshelf-customisation-header">
                    <div>
                        <p class="bookshelf-kicker">Issued Objects</p>
                        <h3 id="bookshelf-customisation-title">Customise Your Shelf</h3>
                        <p>
                            Change the atmosphere of your private Blackwood shelf with backgrounds, bookends,
                            charms, objects, nameplates, and lighting earned through reader activity.
                        </p>
                    </div>

                    <div class="bookshelf-customisation-meta">
                        <strong>${issuedCount} / ${items.length}</strong>
                        <span>issued</span>
                    </div>
                </div>

                <div class="bookshelf-customisation-record">
                    <p>
                        ${filedCount} ${filedCount === 1 ? "spine" : "spines"} filed · ${pointsTotal} Circle points
                    </p>

                    <div class="bookshelf-customisation-selected-grid">
                        ${BLACKWOOD_BOOKSHELF_CUSTOMISATION_SLOTS.map(function (slot) {
                            const selectedItem = selectedItems[slot.id] || null;

                            return `
                                <div>
                                    <span>${escapeHtml(slot.label)}</span>
                                    <strong>${escapeHtml(selectedItem ? selectedItem.title : slot.emptyLabel)}</strong>
                                </div>
                            `;
                        }).join("")}
                    </div>
                </div>

                ${renderShelfCustomisationDisplayPreview(selectedItems)}

                ${renderShelfCustomisationFilters()}

                <p
                    class="bookshelf-customisation-status ${escapeAttribute(BlackwoodBookshelfState.customisationStatusType)}"
                    id="bookshelf-customisation-status"
                    aria-live="polite"
                >
                    ${escapeHtml(BlackwoodBookshelfState.customisationStatusMessage)}
                </p>

                <div class="bookshelf-customisation-grid">
                    ${renderShelfCustomisationItems()}
                </div>

                <div class="bookshelf-customisation-actions">
                    <button
                        type="button"
                        class="bookshelf-modal-button"
                        data-bookshelf-customisation-reset
                        ${BlackwoodBookshelfState.isSavingCustomisation ? "disabled" : ""}
                    >
                        Reset Display
                    </button>
                </div>
            </section>
        `;
    }

    function renderShelfCustomisationDisplayPreview(selectedItems) {
        const background = selectedItems.background;
        const bookends = selectedItems.bookends;
        const charm = selectedItems.charm;
        const object = selectedItems.object;
        const nameplate = selectedItems.nameplate;
        const lighting = selectedItems.lighting;

        return `
            <div class="bookshelf-customisation-preview" aria-label="Shelf customisation preview">
                <div class="bookshelf-customisation-preview-light"></div>

                <div class="bookshelf-customisation-preview-row">
                    <span class="bookshelf-customisation-preview-bookend">
                        ${escapeHtml(bookends ? bookends.title : "Bookend")}
                    </span>

                    <span class="bookshelf-customisation-preview-object">
                        ${escapeHtml(object ? object.title : "Object")}
                    </span>

                    <span class="bookshelf-customisation-preview-charm">
                        ${escapeHtml(charm ? charm.title : "Charm")}
                    </span>
                </div>

                <div class="bookshelf-customisation-preview-plate">
                    ${escapeHtml(nameplate ? nameplate.title : "Reader Shelf")}
                </div>

                <p>
                    ${escapeHtml(background ? background.title : "Default Archive Shelf")}
                    ${lighting ? ` · ${escapeHtml(lighting.title)}` : ""}
                </p>
            </div>
        `;
    }

    function renderShelfCustomisationFilters() {
        const counts = getCustomisationCategoryCounts();
        const filters = [
            {
                id: "all",
                label: "All",
                count: BlackwoodBookshelfState.customisationItems.length
            },
            ...BLACKWOOD_BOOKSHELF_CUSTOMISATION_SLOTS.map(function (slot) {
                return {
                    id: slot.id,
                    label: slot.shortLabel,
                    count: counts[slot.id] || 0
                };
            }),
            {
                id: "locked",
                label: "Locked",
                count: getLockedCustomisationItems().length
            }
        ];

        return `
            <div class="bookshelf-customisation-filters" aria-label="Shelf customisation filters">
                ${filters.map(function (filter) {
                    const isActive = BlackwoodBookshelfState.customisationFilter === filter.id;

                    return `
                        <button
                            type="button"
                            class="${isActive ? "is-active" : ""}"
                            data-bookshelf-customisation-filter="${escapeAttribute(filter.id)}"
                            aria-pressed="${isActive ? "true" : "false"}"
                        >
                            <span>${escapeHtml(filter.label)}</span>
                            <strong>${escapeHtml(String(filter.count))}</strong>
                        </button>
                    `;
                }).join("")}
            </div>
        `;
    }

    function renderShelfCustomisationItems() {
        const filteredItems = getFilteredCustomisationItems();

        if (!filteredItems.length) {
            return `
                <article class="bookshelf-empty-card">
                    <h3>No issued objects match this filter.</h3>
                    <p>Choose another category to view available shelf customisations.</p>
                </article>
            `;
        }

        return filteredItems.map(renderShelfCustomisationItem).join("");
    }

    function renderShelfCustomisationItem(item) {
        const slot = getCustomisationSlotById(item.category);
        const unlockInfo = getShelfCustomisationUnlockInfo(item);
        const isSelected = BlackwoodBookshelfState.customisationSelections[item.category] === item.id;
        const isIssued = unlockInfo.unlocked;
        const label = isSelected ? "Applied" : isIssued ? "Issued" : "Locked";

        return `
            <button
                type="button"
                class="bookshelf-customisation-item ${isSelected ? "is-selected" : ""} ${isIssued ? "is-issued" : "is-locked"}"
                data-bookshelf-customisation-item="${escapeAttribute(item.id)}"
                data-bookshelf-customisation-slot="${escapeAttribute(item.category)}"
                ${isIssued && !BlackwoodBookshelfState.isSavingCustomisation ? "" : "disabled"}
                title="${escapeAttribute(unlockInfo.reason)}"
            >
                <span class="bookshelf-customisation-item-kicker">
                    ✦ ${escapeHtml(slot ? slot.shortLabel : "Object")}
                </span>

                <strong>${escapeHtml(item.title)}</strong>

                <small>${escapeHtml(item.description)}</small>

                <em>${escapeHtml(label)}${unlockInfo.reason ? ` · ${escapeHtml(unlockInfo.reason)}` : ""}</em>
            </button>
        `;
    }

    function renderShelfBoard(shelfItems) {
        return `
            <div class="bookshelf-board" aria-label="Your Blackwood book shelves">
                ${BLACKWOOD_BOOKSHELF_STAGES.map(function (stage) {
                    const stageItems = shelfItems.filter(function (item) {
                        return item.record.shelf_status === stage.id;
                    });

                    return renderShelfStage(stage, stageItems);
                }).join("")}
            </div>
        `;
    }

    function renderShelfStage(stage, stageItems) {
    const count = stageItems.length;
    const countLabel = count === 1 ? "1 book" : `${count} books`;
    const visualStyle = renderShelfCustomisationVisualStyle();
    const customisationClasses = getShelfCustomisationClassNames();
    const customisationDecorations = renderShelfStageCustomisationDecorations();

    return `
        <section
            class="bookshelf-stage ${count ? "has-books" : "is-empty"} ${escapeAttribute(customisationClasses)}"
            data-bookshelf-stage="${escapeAttribute(stage.id)}"
            data-bookshelf-drop-stage="${escapeAttribute(stage.id)}"
            aria-labelledby="bookshelf-stage-${escapeAttribute(stage.id)}"
            ${visualStyle ? `style="${escapeAttribute(visualStyle)}"` : ""}
        >
            ${customisationDecorations}

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
function renderShelfStageCustomisationDecorations() {
    const selectedItems = getSelectedCustomisationItems();

    const bookends = selectedItems.bookends || null;
    const charm = selectedItems.charm || null;
    const object = selectedItems.object || null;
    const nameplate = selectedItems.nameplate || null;
    const lighting = selectedItems.lighting || null;

    if (!bookends && !charm && !object && !nameplate && !lighting) {
        return "";
    }

    return `
        <div class="bookshelf-stage-customisation" aria-hidden="true">
            ${
                lighting
                    ? `
                        <span class="bookshelf-stage-lighting">
                            ${escapeHtml(getShortCustomisationTitle(lighting, "Light"))}
                        </span>
                    `
                    : ""
            }

            ${
                bookends
                    ? `
                        <span class="bookshelf-stage-bookend is-left">
                            ${escapeHtml(getShortCustomisationTitle(bookends, "Bookend"))}
                        </span>

                        <span class="bookshelf-stage-bookend is-right">
                            ${escapeHtml(getShortCustomisationTitle(bookends, "Bookend"))}
                        </span>
                    `
                    : ""
            }

            ${
                charm
                    ? `
                        <span class="bookshelf-stage-charm">
                            ${escapeHtml(getShortCustomisationTitle(charm, "Charm"))}
                        </span>
                    `
                    : ""
            }

            ${
                object
                    ? `
                        <span class="bookshelf-stage-object">
                            ${escapeHtml(getShortCustomisationTitle(object, "Object"))}
                        </span>
                    `
                    : ""
            }

            ${
                nameplate
                    ? `
                        <span class="bookshelf-stage-nameplate">
                            ${escapeHtml(getShortCustomisationTitle(nameplate, "Reader Shelf"))}
                        </span>
                    `
                    : ""
            }
        </div>
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

        BlackwoodBookshelfState.root.querySelectorAll("[data-bookshelf-customisation-filter]").forEach(function (button) {
            button.addEventListener("click", handleShelfCustomisationFilter);
        });

        BlackwoodBookshelfState.root.querySelectorAll("[data-bookshelf-customisation-item]").forEach(function (button) {
            button.addEventListener("click", handleShelfCustomisationApply);
        });

        const resetCustomisationButton = BlackwoodBookshelfState.root.querySelector("[data-bookshelf-customisation-reset]");

        if (resetCustomisationButton) {
            resetCustomisationButton.addEventListener("click", handleShelfCustomisationReset);
        }

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

        let targetItems = getShelfItemsForStage(cleanTargetStage).filter(function (item) {
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

    function handleShelfCustomisationFilter(event) {
        const button = event.currentTarget;
        const filter = normaliseCustomisationFilter(button.dataset.bookshelfCustomisationFilter || "all");

        BlackwoodBookshelfState.customisationFilter = filter;
        BlackwoodBookshelfState.isDrawerOpen = true;

        renderBookshelf();
    }

    async function handleShelfCustomisationApply(event) {
        const button = event.currentTarget;

        if (BlackwoodBookshelfState.isSavingCustomisation) {
            return;
        }

        const itemId = button.dataset.bookshelfCustomisationItem || "";
        const slotId = normaliseCustomisationSlot(button.dataset.bookshelfCustomisationSlot || "");
        const item = getCustomisationItemById(itemId);

        if (!item || !slotId) {
            setCustomisationStatus("That shelf object could not be found.", "is-error");
            return;
        }

        const unlockInfo = getShelfCustomisationUnlockInfo(item);

        if (!unlockInfo.unlocked) {
            setCustomisationStatus(unlockInfo.reason || "That object is still locked.", "is-error");
            return;
        }

        BlackwoodBookshelfState.customisationSelections[slotId] = item.id;
        BlackwoodBookshelfState.isSavingCustomisation = true;
        BlackwoodBookshelfState.isDrawerOpen = true;
        BlackwoodBookshelfState.customisationStatusMessage = `Applying ${item.title}...`;
        BlackwoodBookshelfState.customisationStatusType = "is-loading";

        renderBookshelf();

        try {
            const savedMode = await saveShelfCustomisationSelections();

            BlackwoodBookshelfState.customisationStatusMessage = savedMode === "supabase"
                ? `${item.title} applied and saved to your Circle record.`
                : `${item.title} applied and saved locally on this device.`;

            BlackwoodBookshelfState.customisationStatusType = "is-success";

        } catch (error) {
            console.error("Shelf customisation save failed:", error);

            saveLocalShelfCustomisationSelections();

            BlackwoodBookshelfState.customisationStatusMessage = `${item.title} applied and saved locally on this device.`;
            BlackwoodBookshelfState.customisationStatusType = "is-success";

        } finally {
            BlackwoodBookshelfState.isSavingCustomisation = false;
            renderBookshelf();
        }
    }

    async function handleShelfCustomisationReset() {
        if (BlackwoodBookshelfState.isSavingCustomisation) {
            return;
        }

        BlackwoodBookshelfState.customisationSelections = createDefaultCustomisationSelections();
        BlackwoodBookshelfState.isSavingCustomisation = true;
        BlackwoodBookshelfState.isDrawerOpen = true;
        BlackwoodBookshelfState.customisationStatusMessage = "Resetting shelf display...";
        BlackwoodBookshelfState.customisationStatusType = "is-loading";

        renderBookshelf();

        try {
            const savedMode = await saveShelfCustomisationSelections();

            BlackwoodBookshelfState.customisationStatusMessage = savedMode === "supabase"
                ? "Shelf display reset and saved to your Circle record."
                : "Shelf display reset and saved locally on this device.";

            BlackwoodBookshelfState.customisationStatusType = "is-success";

        } catch (error) {
            console.error("Shelf customisation reset failed:", error);

            saveLocalShelfCustomisationSelections();

            BlackwoodBookshelfState.customisationStatusMessage = "Shelf display reset and saved locally on this device.";
            BlackwoodBookshelfState.customisationStatusType = "is-success";

        } finally {
            BlackwoodBookshelfState.isSavingCustomisation = false;
            renderBookshelf();
        }
    }

    async function saveShelfCustomisationSelections() {
    const selections = normaliseCustomisationSelections(
        BlackwoodBookshelfState.customisationSelections
    );

    BlackwoodBookshelfState.customisationSelections = selections;
    BlackwoodBookshelfState.customisationSaveMode = "local";
    BlackwoodBookshelfState.customisationStorageTable = "";

    saveLocalShelfCustomisationSelections();

    return "local";
}

        const tableCandidates = BlackwoodBookshelfState.customisationStorageTable
            ? [
                BlackwoodBookshelfState.customisationStorageTable,
                ...BLACKWOOD_BOOKSHELF_CONFIG.customisationTableNames.filter(function (tableName) {
                    return tableName !== BlackwoodBookshelfState.customisationStorageTable;
                })
            ]
            : BLACKWOOD_BOOKSHELF_CONFIG.customisationTableNames;

        for (const tableName of tableCandidates) {
            const payloads = buildRemoteShelfCustomisationPayloads(selections);

            for (const payload of payloads) {
                try {
                    const { error } = await BlackwoodBookshelfState.client
                        .from(tableName)
                        .upsert(payload, {
                            onConflict: "member_id"
                        });

                    if (!error) {
                        BlackwoodBookshelfState.customisationStorageTable = tableName;
                        BlackwoodBookshelfState.customisationSaveMode = "supabase";
                        return "supabase";
                    }

                } catch (error) {
                    console.warn(`Shelf customisation save failed for ${tableName}:`, error);
                }
            }
        }

        BlackwoodBookshelfState.customisationSaveMode = "local";
        return "local";
    }

    function setCustomisationStatus(message, className) {
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

    function extractCustomisationItemsFromData(data) {
        const rawItems = [];

        if (Array.isArray(data)) {
            rawItems.push(...data);
        }

        if (data && Array.isArray(data.items)) {
            rawItems.push(...data.items);
        }

        if (data && Array.isArray(data.customisationItems)) {
            rawItems.push(...data.customisationItems);
        }

        if (data && Array.isArray(data.shelfCustomisationItems)) {
            rawItems.push(...data.shelfCustomisationItems);
        }

        if (data && typeof data === "object" && !Array.isArray(data)) {
            Object.keys(data).forEach(function (key) {
                if (Array.isArray(data[key])) {
                    data[key].forEach(function (item) {
                        rawItems.push({
                            ...item,
                            category: item.category || item.type || item.slot || key
                        });
                    });
                }
            });
        }

        const seen = new Set();

        return rawItems
            .map(function (item, index) {
                return normaliseCustomisationItem(item, index);
            })
            .filter(function (item) {
                if (!item || !item.id || !item.category) {
                    return false;
                }

                const key = `${item.category}:${item.id}`;

                if (seen.has(key)) {
                    return false;
                }

                seen.add(key);
                return true;
            })
            .sort(sortCustomisationItems);
    }

    function normaliseCustomisationItem(rawItem, index) {
        if (!rawItem || typeof rawItem !== "object") {
            return null;
        }

        const category = normaliseCustomisationSlot(
            rawItem.category ||
            rawItem.type ||
            rawItem.slot ||
            rawItem.group ||
            ""
        );

        if (!category) {
            return null;
        }

        const title = String(
            rawItem.title ||
            rawItem.name ||
            rawItem.label ||
            `${category} ${index + 1}`
        ).trim();

        const id = String(
            rawItem.id ||
            rawItem.slug ||
            createSlug(`${category}-${title}`)
        ).trim();

        const pointsRequired = Number(
            rawItem.points_required ??
            rawItem.pointsRequired ??
            rawItem.required_points ??
            rawItem.requiredPoints ??
            rawItem.points ??
            rawItem.cost ??
            0
        );

        const booksRequired = Number(
            rawItem.books_required ??
            rawItem.booksRequired ??
            rawItem.required_books ??
            rawItem.requiredBooks ??
            0
        );

        return {
            id,
            category,
            title,
            description: String(rawItem.description || rawItem.copy || rawItem.summary || "").trim(),
            pointsRequired: Number.isFinite(pointsRequired) ? pointsRequired : 0,
            booksRequired: Number.isFinite(booksRequired) ? booksRequired : 0,
            requiredBookId: String(rawItem.required_book_id || rawItem.requiredBookId || rawItem.book_id || rawItem.bookId || "").trim(),
            requiredReadBookId: String(rawItem.required_read_book_id || rawItem.requiredReadBookId || "").trim(),
            requiredStage: normaliseShelfStatus(rawItem.required_stage || rawItem.requiredStage || ""),
            unlockText: String(rawItem.unlock_text || rawItem.unlockText || rawItem.unlock || rawItem.requirement || "").trim(),
            isDefault: rawItem.is_default === true || rawItem.default === true || rawItem.isDefault === true,
            isFree: rawItem.is_free === true || rawItem.free === true || rawItem.isFree === true,
            isIssued: rawItem.issued === true || rawItem.unlocked === true || rawItem.is_unlocked === true,
            sortOrder: Number(rawItem.sort_order || rawItem.sortOrder || rawItem.order || index + 1),
            rarity: String(rawItem.rarity || "").trim()
        };
    }

    function sortCustomisationItems(a, b) {
        const aSlotOrder = getCustomisationSlotOrder(a.category);
        const bSlotOrder = getCustomisationSlotOrder(b.category);

        if (aSlotOrder !== bSlotOrder) {
            return aSlotOrder - bSlotOrder;
        }

        if (a.sortOrder !== b.sortOrder) {
            return a.sortOrder - b.sortOrder;
        }

        return a.title.localeCompare(b.title);
    }

    function getFilteredCustomisationItems() {
        const filter = normaliseCustomisationFilter(BlackwoodBookshelfState.customisationFilter);

        if (filter === "all") {
            return BlackwoodBookshelfState.customisationItems;
        }

        if (filter === "locked") {
            return getLockedCustomisationItems();
        }

        return BlackwoodBookshelfState.customisationItems.filter(function (item) {
            return item.category === filter;
        });
    }

    function getIssuedCustomisationItems() {
        return BlackwoodBookshelfState.customisationItems.filter(function (item) {
            return getShelfCustomisationUnlockInfo(item).unlocked;
        });
    }

    function getLockedCustomisationItems() {
        return BlackwoodBookshelfState.customisationItems.filter(function (item) {
            return !getShelfCustomisationUnlockInfo(item).unlocked;
        });
    }

    function getCustomisationCategoryCounts() {
        return BlackwoodBookshelfState.customisationItems.reduce(function (counts, item) {
            counts[item.category] = (counts[item.category] || 0) + 1;
            return counts;
        }, {});
    }

    function getShelfCustomisationUnlockInfo(item) {
        const pointsTotal = getCustomisationPointsTotal();
        const filedCount = getShelfItems().length;

        if (!item) {
            return {
                unlocked: false,
                reason: "Object unavailable."
            };
        }

        if (item.isDefault || item.isFree || item.isIssued) {
            return {
                unlocked: true,
                reason: "Issued"
            };
        }

        if (item.pointsRequired > 0 && pointsTotal < item.pointsRequired) {
            return {
                unlocked: false,
                reason: `${item.pointsRequired - pointsTotal} more points needed`
            };
        }

        if (item.booksRequired > 0 && filedCount < item.booksRequired) {
            return {
                unlocked: false,
                reason: `${item.booksRequired - filedCount} more spines needed`
            };
        }

        if (item.requiredBookId && !getRecordByBookId(item.requiredBookId)) {
            const book = getBookById(item.requiredBookId);

            return {
                unlocked: false,
                reason: book ? `File ${book.title}` : "Required book not filed"
            };
        }

        if (item.requiredReadBookId) {
            const record = getRecordByBookId(item.requiredReadBookId);
            const book = getBookById(item.requiredReadBookId);

            if (!record || !record.has_read) {
                return {
                    unlocked: false,
                    reason: book ? `Read ${book.title}` : "Required book not read"
                };
            }
        }

        if (item.requiredStage && item.requiredStage !== "want_to_read") {
            const hasStageItem = getShelfItems().some(function (shelfItem) {
                return shelfItem.record.shelf_status === item.requiredStage;
            });

            if (!hasStageItem) {
                return {
                    unlocked: false,
                    reason: `File a book as ${getShelfStageLabel(item.requiredStage)}`
                };
            }
        }

        if (item.pointsRequired > 0 || item.booksRequired > 0 || item.requiredBookId || item.requiredReadBookId) {
            return {
                unlocked: true,
                reason: "Issued"
            };
        }

        return {
            unlocked: true,
            reason: item.unlockText || "Issued"
        };
    }

    function getSelectedCustomisationItems() {
        const selectedItems = {};

        BLACKWOOD_BOOKSHELF_CUSTOMISATION_SLOTS.forEach(function (slot) {
            const selectedId = BlackwoodBookshelfState.customisationSelections[slot.id] || "";
            selectedItems[slot.id] = selectedId ? getCustomisationItemById(selectedId) : null;
        });

        return selectedItems;
    }

    function getCustomisationItemById(itemId) {
        return BlackwoodBookshelfState.customisationItems.find(function (item) {
            return item.id === itemId;
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
            .replace(/&/g, "and")
            .replace(/\s+/g, "_")
            .replace(/-/g, "_");

        if (["background", "shelf_background", "shelf_wall", "wall"].includes(cleanValue)) {
            return "background";
        }

        if (["bookend", "bookends", "shelf_bookends"].includes(cleanValue)) {
            return "bookends";
        }

        if (["charm", "charms", "hanging_object", "hanging_objects"].includes(cleanValue)) {
            return "charm";
        }

        if (["object", "objects", "shelf_object", "shelf_objects", "desk_object", "desk_objects"].includes(cleanValue)) {
            return "object";
        }

        if (["nameplate", "nameplates", "label", "labels", "plate"].includes(cleanValue)) {
            return "nameplate";
        }

        if (["lighting", "light", "lights", "atmosphere"].includes(cleanValue)) {
            return "lighting";
        }

        return "";
    }

    function normaliseCustomisationFilter(value) {
        const cleanValue = String(value || "").trim().toLowerCase();

        if (cleanValue === "all" || cleanValue === "locked") {
            return cleanValue;
        }

        return normaliseCustomisationSlot(cleanValue) || "all";
    }

    function createEmptyCustomisationSelections() {
        return {
            background: "",
            bookends: "",
            charm: "",
            object: "",
            nameplate: "",
            lighting: ""
        };
    }

    function createDefaultCustomisationSelections() {
        const selections = createEmptyCustomisationSelections();

        BLACKWOOD_BOOKSHELF_CUSTOMISATION_SLOTS.forEach(function (slot) {
            const defaultItem = findDefaultCustomisationItem(slot.id);

            if (defaultItem) {
                selections[slot.id] = defaultItem.id;
            }
        });

        return selections;
    }

    function findDefaultCustomisationItem(slotId) {
        const cleanSlotId = normaliseCustomisationSlot(slotId);
        const slotItems = BlackwoodBookshelfState.customisationItems.filter(function (item) {
            return item.category === cleanSlotId;
        });

        return slotItems.find(function (item) {
            return item.isDefault;
        }) || slotItems.find(function (item) {
            const text = lowerClean(`${item.id} ${item.title}`);
            return text.includes("default") || text.includes("no_") || text.includes("no ") || text.includes("plain");
        }) || null;
    }

    function normaliseCustomisationSelections(selections) {
        const cleanSelections = createEmptyCustomisationSelections();
        const source = selections && typeof selections === "object" ? selections : {};

        BLACKWOOD_BOOKSHELF_CUSTOMISATION_SLOTS.forEach(function (slot) {
            const value = String(
                source[slot.id] ||
                source[`${slot.id}_id`] ||
                source[`shelf_${slot.id}_id`] ||
                ""
            ).trim();

            cleanSelections[slot.id] = value;
        });

        return cleanSelections;
    }

    function getRemoteShelfCustomisationSelections(row) {
        return {
            background: row.background_id || row.shelf_background_id || row.selected_background_id || row.background || "",
            bookends: row.bookends_id || row.bookend_id || row.selected_bookends_id || row.bookends || "",
            charm: row.charm_id || row.selected_charm_id || row.charm || "",
            object: row.object_id || row.shelf_object_id || row.selected_object_id || row.object || "",
            nameplate: row.nameplate_id || row.selected_nameplate_id || row.nameplate || "",
            lighting: row.lighting_id || row.light_id || row.selected_lighting_id || row.lighting || ""
        };
    }

    function buildRemoteShelfCustomisationPayloads(selections) {
        const userId = getCurrentUserId();
        const now = new Date().toISOString();

        return [
            {
                member_id: userId,
                background_id: selections.background || null,
                bookends_id: selections.bookends || null,
                charm_id: selections.charm || null,
                object_id: selections.object || null,
                nameplate_id: selections.nameplate || null,
                lighting_id: selections.lighting || null,
                updated_at: now
            },
            {
                member_id: userId,
                shelf_background_id: selections.background || null,
                bookend_id: selections.bookends || null,
                charm_id: selections.charm || null,
                shelf_object_id: selections.object || null,
                nameplate_id: selections.nameplate || null,
                light_id: selections.lighting || null,
                updated_at: now
            }
        ];
    }

    function getLocalShelfCustomisationKey() {
        return `blackwood:shelf-customisation:${getCurrentUserId() || "guest"}`;
    }

    function loadLocalShelfCustomisationSelections() {
        try {
            const rawValue = window.localStorage.getItem(getLocalShelfCustomisationKey());

            if (!rawValue) {
                return createEmptyCustomisationSelections();
            }

            return normaliseCustomisationSelections(JSON.parse(rawValue));

        } catch (error) {
            console.warn("Local shelf customisation could not be read:", error);
            return createEmptyCustomisationSelections();
        }
    }

    function saveLocalShelfCustomisationSelections() {
        try {
            window.localStorage.setItem(
                getLocalShelfCustomisationKey(),
                JSON.stringify(normaliseCustomisationSelections(BlackwoodBookshelfState.customisationSelections))
            );
        } catch (error) {
            console.warn("Local shelf customisation could not be saved:", error);
        }
    }

    function getCustomisationPointsTotal() {
        const explicitPoints = Number(BlackwoodBookshelfState.pointsTotal);

        if (Number.isFinite(explicitPoints) && explicitPoints > 0) {
            return explicitPoints;
        }

        const memberPoints = Number(BlackwoodBookshelfState.member && BlackwoodBookshelfState.member.points_total);

        return Number.isFinite(memberPoints) ? memberPoints : 0;
    }

    function getShelfCustomisationClassNames() {
        const selections = getSelectedCustomisationItems();

        return BLACKWOOD_BOOKSHELF_CUSTOMISATION_SLOTS.map(function (slot) {
            const item = selections[slot.id];

            if (!item) {
                return "";
            }

            return `has-${slot.id}-${createSlug(item.id)}`;
        }).filter(Boolean).join(" ");
    }

    function renderShelfCustomisationVisualStyle() {
        const selections = getSelectedCustomisationItems();
        const backgroundText = lowerClean(selections.background ? `${selections.background.id} ${selections.background.title}` : "");
        const lightingText = lowerClean(selections.lighting ? `${selections.lighting.id} ${selections.lighting.title}` : "");

        let baseBackground = "radial-gradient(circle at top left, rgba(196, 122, 44, 0.11), transparent 34%), linear-gradient(180deg, rgba(255, 255, 255, 0.035), rgba(255, 255, 255, 0.01)), rgba(0, 0, 0, 0.42)";
        let baseShadow = "0 18px 52px rgba(0, 0, 0, 0.34), inset 0 0 0 1px rgba(255, 255, 255, 0.018)";

        if (backgroundText.includes("charcoal")) {
            baseBackground = "radial-gradient(circle at top left, rgba(120, 120, 120, 0.12), transparent 34%), linear-gradient(180deg, rgba(32, 31, 29, 0.88), rgba(5, 4, 3, 0.96))";
        } else if (backgroundText.includes("oak") || backgroundText.includes("wood")) {
            baseBackground = "radial-gradient(circle at top left, rgba(196, 122, 44, 0.18), transparent 34%), linear-gradient(180deg, rgba(64, 34, 16, 0.88), rgba(12, 6, 3, 0.96))";
        } else if (backgroundText.includes("green") || backgroundText.includes("archive")) {
            baseBackground = "radial-gradient(circle at top left, rgba(120, 150, 102, 0.14), transparent 34%), linear-gradient(180deg, rgba(18, 36, 27, 0.88), rgba(3, 6, 5, 0.96))";
        } else if (backgroundText.includes("window") || backgroundText.includes("mist")) {
            baseBackground = "radial-gradient(circle at 74% 8%, rgba(180, 190, 190, 0.13), transparent 30%), linear-gradient(180deg, rgba(19, 23, 26, 0.9), rgba(3, 4, 5, 0.97))";
        } else if (backgroundText.includes("stone") || backgroundText.includes("chapel")) {
            baseBackground = "radial-gradient(circle at top left, rgba(160, 150, 130, 0.13), transparent 34%), linear-gradient(180deg, rgba(37, 34, 30, 0.9), rgba(7, 6, 5, 0.97))";
        } else if (backgroundText.includes("storm") || backgroundText.includes("blue")) {
            baseBackground = "radial-gradient(circle at top right, rgba(98, 122, 152, 0.16), transparent 35%), linear-gradient(180deg, rgba(8, 13, 22, 0.92), rgba(2, 3, 6, 0.98))";
        } else if (backgroundText.includes("parchment")) {
            baseBackground = "radial-gradient(circle at top left, rgba(214, 177, 129, 0.16), transparent 34%), linear-gradient(180deg, rgba(70, 50, 31, 0.72), rgba(9, 6, 4, 0.95))";
        }

        if (lightingText.includes("warm") || lightingText.includes("lamp") || lightingText.includes("candle")) {
            baseShadow = "0 18px 52px rgba(0, 0, 0, 0.34), inset 0 0 70px rgba(196, 122, 44, 0.12), 0 0 34px rgba(196, 122, 44, 0.08)";
        } else if (lightingText.includes("cold") || lightingText.includes("blue")) {
            baseShadow = "0 18px 52px rgba(0, 0, 0, 0.34), inset 0 0 70px rgba(120, 150, 190, 0.1), 0 0 34px rgba(120, 150, 190, 0.06)";
        } else if (lightingText.includes("storm")) {
            baseShadow = "0 18px 52px rgba(0, 0, 0, 0.34), inset 0 0 80px rgba(100, 120, 160, 0.13), 0 0 36px rgba(80, 100, 140, 0.08)";
        }

        return `background: ${baseBackground}; box-shadow: ${baseShadow};`;
    }

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

        return cleaned;
    }

    function bindBlackwoodBookshelf() {
    const root = document.getElementById("blackwood-bookshelf-root");

    if (!root || typeof window.initBlackwoodBookshelf !== "function") {
        return;
    }

    window.initBlackwoodBookshelf({
        root,
        client: BlackwoodMembersState.client,
        session: BlackwoodMembersState.session,
        member: BlackwoodMembersState.member,
        pointsTotal: getCurrentPointsTotal()
    });
}
})();
