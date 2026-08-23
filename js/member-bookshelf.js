// =========================
// BLACKWOOD MEMBER BOOKSHELF
// Private shelf records powered by Supabase
// =========================

(function () {
    "use strict";

    const BLACKWOOD_BOOKSHELF_CONFIG = {
        rootId: "blackwood-bookshelf-root",
        tableName: "member_book_shelf"
    };

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
        shelfRecords: [],
        modalMode: "closed",
        activeBookId: "",
        statusMessage: "",
        statusType: "",
        isBusy: false,
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
        BlackwoodBookshelfState.modalMode = "closed";
        BlackwoodBookshelfState.activeBookId = "";
        BlackwoodBookshelfState.statusMessage = "";
        BlackwoodBookshelfState.statusType = "";

        ensureBookshelfEscapeListener();

        if (!BlackwoodBookshelfState.client || !getCurrentUserId()) {
            renderBookshelfUnavailable();
            return;
        }

        renderBookshelfLoading();

        try {
            await loadBookshelfRecords();
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

        const { data, error } = await BlackwoodBookshelfState.client
            .from(BLACKWOOD_BOOKSHELF_CONFIG.tableName)
            .select("*")
            .eq("member_id", userId)
            .order("shelf_order", { ascending: true })
            .order("created_at", { ascending: true });

        if (error) {
            throw error;
        }

        BlackwoodBookshelfState.shelfRecords = Array.isArray(data)
            ? data.map(normaliseShelfRecord)
            : [];
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

        BlackwoodBookshelfState.root.innerHTML = `
            <div class="blackwood-bookshelf">
                <div class="bookshelf-header">
                    <div>
                        <p class="bookshelf-kicker">Private Reader Shelf</p>
                        <h2>My Blackwood Bookshelf</h2>
                        <p>
                            Keep a private record of the Blackwood books on your shelf.
                            Mark the editions you own, note signed copies, and keep your own thoughts beside each title.
                        </p>
                    </div>

                    <button type="button" class="bookshelf-add-button" data-bookshelf-add>
                        Add to Your Collection
                    </button>
                </div>

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

            ${renderBookshelfModal()}
        `;

        bindBookshelfEvents();
        bindBookshelfImageFallbacks();
    }

    function renderShelfBoard(shelfItems) {
        return `
            <div class="bookshelf-board" aria-label="Your Blackwood book shelf">
                <div class="bookshelf-spine-list">
                    ${shelfItems.map(function (item) {
                        return renderShelfSpine(item.book, item.record);
                    }).join("")}
                </div>
            </div>
        `;
    }

    function renderShelfSpine(book, record) {
        const badges = [];

        if (record.is_arc) badges.push("ARC");
        if (record.owned) badges.push("Own");
        if (record.has_read) badges.push("Read");
        if (record.is_signed) badges.push("Signed");
        if (record.wants_signed) badges.push("Wants Signed");

        return `
            <div class="bookshelf-book-slot">
                <button
                    type="button"
                    class="bookshelf-spine-button ${record.owned ? "is-owned" : ""} ${record.has_read ? "is-read" : ""} ${record.is_signed ? "is-signed" : ""}"
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
                    ${badges.slice(0, 3).map(function (badge) {
                        return `<span>${escapeHtml(badge)}</span>`;
                    }).join("")}
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
                            You can add owned books, books you have read, ARC copies, signed editions, or titles you want to follow.
                            Add private notes, thoughts, edition details, reading memories, or anything you want to keep with this book.
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
                                        <p>You can click any spine on your shelf to update notes or statuses.</p>
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

    function bindBookshelfEvents() {
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

        const record = {
            member_id: userId,
            book_id: book.id,
            book_title: book.title,
            owned: Boolean(form.elements.owned && form.elements.owned.checked),
            has_read: Boolean(form.elements.has_read && form.elements.has_read.checked),
            is_arc: Boolean(form.elements.is_arc && form.elements.is_arc.checked),
            is_signed: Boolean(form.elements.is_signed && form.elements.is_signed.checked),
            wants_signed: Boolean(form.elements.wants_signed && form.elements.wants_signed.checked),
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
            .sort(function (a, b) {
                const aOrder = Number(a.record.shelf_order || a.book.defaultOrder || 1000);
                const bOrder = Number(b.record.shelf_order || b.book.defaultOrder || 1000);

                if (aOrder !== bOrder) {
                    return aOrder - bOrder;
                }

                return String(a.book.title).localeCompare(String(b.book.title));
            });
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
            owned: true,
            has_read: false,
            is_arc: false,
            is_signed: false,
            wants_signed: false,
            format: "Not specified",
            notes: "",
            shelf_order: book.defaultOrder || 1000
        };
    }

    function normaliseShelfRecord(record) {
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
            format: String(record.format || "Not specified").trim(),
            notes: String(record.notes || "").trim(),
            shelf_order: Number(record.shelf_order || 1000),
            created_at: record.created_at,
            updated_at: record.updated_at
        };
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
        status.classList.remove("is-error", "is-loading");

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

        return cleaned;
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
