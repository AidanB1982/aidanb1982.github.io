/* ======================================================
   BLACKWOOD READER RECORDS
   Front-end bridge for Google Apps Script
   Rotating public record view
====================================================== */

const BLACKWOOD_READER_RECORDS_ENDPOINT = "https://script.google.com/macros/s/AKfycbwOWic3DTxR5VkXy0gFythhvDVO6TsOh81jse4LO3YpCyP7SnScUi8p-ccx0SqJPlBb/exec";

(function () {
    "use strict";

    const ROTATION_DELAY = 9000;

    const BOOK_META = {
        "The Black Bothy": {
            image: "/assets/A8.png",
            link: "/pages/store.html#the-black-bothy"
        },
        "The Drowned Fjord": {
            image: "/assets/A7.png",
            link: "/pages/store.html#the-drowned-fjord"
        },
        "The Erased Archivist": {
            image: "/assets/A6.png",
            link: "/pages/store.html#the-erased-archivist"
        },
        "Holdfast": {
            image: "/assets/A5.png",
            link: "/pages/holdfast.html"
        },
        "Dour Hill House": {
            image: "/assets/book1.jpg",
            link: "/pages/store.html#dour-hill-house"
        },
        "The Red-Clad Collector": {
            image: "/assets/book11.png",
            link: "https://www.amazon.co.uk/dp/B0G76MRK8R"
        },
        "Corrour Bothy": {
            image: "/assets/book2.jpg",
            link: "/pages/store.html#corrour-bothy"
        },
        "The Corrour Bothy": {
            image: "/assets/book2.jpg",
            link: "/pages/store.html#corrour-bothy"
        },
        "Love, Abused": {
            image: "/assets/book15.jpg",
            link: "/pages/store.html#love-abused"
        },
        "The Scheme": {
            image: "/assets/book9.png",
            link: "/pages/store.html#the-scheme"
        },
        "Red Streets": {
            image: "/assets/book10.jpg",
            link: "/pages/store.html#red-streets"
        }
    };

    const BOOK_ORDER = [
        "The Black Bothy",
        "The Drowned Fjord",
        "The Erased Archivist",
        "Holdfast",
        "Dour Hill House",
        "The Red-Clad Collector",
        "Corrour Bothy",
        "The Corrour Bothy",
        "Love, Abused",
        "The Scheme",
        "Red Streets"
    ];

    const MOOD_MAP = {
        "isolated-grief": "Isolated Grief",
        "uncanny-obsession": "Uncanny Obsession",
        "dark-and-twisted": "Dark and Twisted",
        "bleak-coastal-dread": "Bleak Coastal Dread",
        "identity-collapse": "Identity Collapse",
        "haunted-memory": "Haunted Memory",
        "domestic-haunting": "Domestic Haunting",
        "urban-pressure": "Urban Pressure",
        "emotional-damage": "Emotional Damage",
        "blood-on-the-pavement": "Blood on the Pavement"
    };

    const publicRecordsState = {
        records: [],
        bookFilter: "all",
        moodFilter: "all",
        list: null,
        bookFilterEl: null,
        moodFilterEl: null,
        rotators: new Map()
    };

    function endpointConfigured() {
        return (
            BLACKWOOD_READER_RECORDS_ENDPOINT &&
            !BLACKWOOD_READER_RECORDS_ENDPOINT.includes("PASTE_YOUR_GOOGLE_APPS_SCRIPT")
        );
    }

    function initReaderRecords() {
        initForm();
        initPublicRecords();
    }

    /* ======================================================
       FORM
    ====================================================== */

    function initForm() {
        const form = document.querySelector("#reader-record-form");

        if (!form) return;

        const status = document.querySelector("#reader-record-status");
        const submitButton = document.querySelector("#reader-record-submit");
        const ratingDisplay = document.querySelector("#final-rating-display");
        const ratingFields = Array.from(form.querySelectorAll("[data-rating-field]"));
        const reviewText = document.querySelector("#reader-record-text");
        const reviewCount = document.querySelector("#reader-record-count");

        function setStatus(message, type) {
            if (!status) return;

            status.textContent = message || "";
            status.classList.remove("is-success", "is-error");

            if (type) {
                status.classList.add(type);
            }
        }

        function calculateRating() {
            const ratings = ratingFields
                .map(field => Number(field.value))
                .filter(value => Number.isFinite(value) && value >= 1 && value <= 5);

            if (ratings.length !== ratingFields.length) {
                if (ratingDisplay) {
                    ratingDisplay.textContent = "—";
                }

                return null;
            }

            const total = ratings.reduce((sum, value) => sum + value, 0);
            const average = Math.round((total / ratings.length) * 10) / 10;

            if (ratingDisplay) {
                ratingDisplay.textContent = `${average.toFixed(1)} / 5`;
            }

            return average;
        }

        function updateCount() {
            if (!reviewText || !reviewCount) return;

            reviewCount.textContent = String(reviewText.value.length);
        }

        function validateForm() {
            const requiredFields = Array.from(form.querySelectorAll("[required]"));

            for (const field of requiredFields) {
                if (!String(field.value || "").trim()) {
                    field.focus();
                    throw new Error("Please complete all required fields before submitting.");
                }
            }

            const email = form.querySelector("[name='email']");

            if (email && email.value.trim() && !email.checkValidity()) {
                email.focus();
                throw new Error("Please enter a valid email address or leave it blank.");
            }

            const review = form.querySelector("[name='readerRecord']");

            if (review && review.value.trim().length < 20) {
                review.focus();
                throw new Error("Please leave a slightly fuller reader record before submitting.");
            }

            const rating = calculateRating();

            if (rating === null) {
                throw new Error("Please rate all five Archive Rating categories.");
            }
        }

        async function submitRecord() {
            if (!endpointConfigured()) {
                throw new Error("The Google Apps Script Web App URL has not been added yet.");
            }

            const formData = new FormData(form);

            const rawMood = String(formData.get("mood") || "").trim();
            const cleanMood = MOOD_MAP[rawMood] || rawMood;

            const payload = {
                book: String(formData.get("book") || "").trim(),
                mood: cleanMood,
                displayName: String(formData.get("displayName") || "").trim(),
                email: String(formData.get("email") || "").trim(),
                readerRecord: String(formData.get("readerRecord") || "").trim(),
                spoilerWarning: formData.has("spoilerWarning"),
                permissionToPublish: formData.has("permissionToPublish"),
                atmosphere: String(formData.get("atmosphere") || "").trim(),
                story: String(formData.get("story") || "").trim(),
                characters: String(formData.get("characters") || "").trim(),
                dread: String(formData.get("dread") || "").trim(),
                ending: String(formData.get("ending") || "").trim()
            };

            await fetch(BLACKWOOD_READER_RECORDS_ENDPOINT, {
                method: "POST",
                mode: "no-cors",
                headers: {
                    "Content-Type": "text/plain;charset=utf-8"
                },
                body: JSON.stringify(payload)
            });
        }

        ratingFields.forEach(field => {
            field.addEventListener("change", calculateRating);
        });

        if (reviewText) {
            reviewText.addEventListener("input", updateCount);
            updateCount();
        }

        form.addEventListener("submit", async event => {
            event.preventDefault();

            try {
                setStatus("", "");

                validateForm();

                if (submitButton) {
                    submitButton.disabled = true;
                    submitButton.textContent = "Filing Record...";
                }

                await submitRecord();

                setStatus(
                    "Your reader record has been received. It will be reviewed before being added to the Archive.",
                    "is-success"
                );

                form.reset();
                updateCount();
                calculateRating();

            } catch (error) {
                setStatus(error.message || "Unable to submit your reader record.", "is-error");
            } finally {
                if (submitButton) {
                    submitButton.disabled = false;
                    submitButton.textContent = "Submit Reader Record";
                }
            }
        });
    }

    /* ======================================================
       PUBLIC RECORDS
    ====================================================== */

    function initPublicRecords() {
        const list = document.querySelector("#reader-records-list");
        const refresh = document.querySelector("#reader-records-refresh");
        const bookFilter = document.querySelector("#reader-records-book-filter");
        const moodFilter = document.querySelector("#reader-records-mood-filter");

        if (!list) return;

        publicRecordsState.list = list;
        publicRecordsState.bookFilterEl = bookFilter;
        publicRecordsState.moodFilterEl = moodFilter;

        if (refresh) {
            refresh.addEventListener("click", () => {
                loadApprovedRecords();
            });
        }

        if (bookFilter) {
            bookFilter.addEventListener("change", () => {
                publicRecordsState.bookFilter = bookFilter.value;
                renderRecords();
            });
        }

        if (moodFilter) {
            moodFilter.addEventListener("change", () => {
                publicRecordsState.moodFilter = moodFilter.value;
                renderRecords();
            });
        }

        loadApprovedRecords();
    }

    function loadApprovedRecords() {
        const list = publicRecordsState.list;

        if (!list) return;

        clearAllRotators();

        if (!endpointConfigured()) {
            list.innerHTML = "";

            const message = document.createElement("p");
            message.className = "reader-records-empty";
            message.textContent = "Reader Records are not connected yet. Add the Google Apps Script Web App URL in /js/reader-records.js.";

            list.appendChild(message);
            return;
        }

        list.innerHTML = "";

        const loading = document.createElement("p");
        loading.className = "reader-records-loading";
        loading.textContent = "Loading approved records...";

        list.appendChild(loading);

        requestJsonp(BLACKWOOD_READER_RECORDS_ENDPOINT)
            .then(data => {
                const records = Array.isArray(data)
    ? data
    : data && Array.isArray(data.records)
        ? data.records
        : [];

                publicRecordsState.records = normaliseRecords(records);

                populateFilters(publicRecordsState.records);
                renderRecords();
            })
            .catch(() => {
                clearAllRotators();

                list.innerHTML = "";

                const error = document.createElement("p");
                error.className = "reader-records-empty";
                error.textContent = "Unable to load reader records right now.";

                list.appendChild(error);
            });
    }

    function requestJsonp(url) {
    return new Promise((resolve, reject) => {
        const callbackName = `blackwoodReaderRecords_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        const timeoutLimit = 10000;

        let settled = false;

        const script = document.createElement("script");
        const separator = url.includes("?") ? "&" : "?";

        const timeout = window.setTimeout(() => {
            if (settled) return;

            settled = true;
            cleanup();
            reject(new Error("Reader Records request timed out."));
        }, timeoutLimit);

        window[callbackName] = data => {
            if (settled) return;

            settled = true;
            cleanup();
            resolve(data);
        };

        script.src = `${url}${separator}callback=${callbackName}&cache=${Date.now()}`;
        script.async = true;

        script.onerror = () => {
            if (settled) return;

            settled = true;
            cleanup();
            reject(new Error("Reader Records request failed."));
        };

        function cleanup() {
            window.clearTimeout(timeout);
            delete window[callbackName];

            if (script.parentNode) {
                script.parentNode.removeChild(script);
            }
        }

        document.body.appendChild(script);
    });
}

    function normaliseRecords(records) {
        return records
            .filter(record => record && record.book && record.readerRecord)
            .map(record => {
                const atmosphere = parseRating(record.atmosphere);
                const story = parseRating(record.story);
                const characters = parseRating(record.characters);
                const dreadTension = parseRating(record.dreadTension || record.dread);
                const ending = parseRating(record.ending);

                const fallbackRating = calculateAverage([
                    atmosphere,
                    story,
                    characters,
                    dreadTension,
                    ending
                ]);

                return {
                    ...record,
                    book: String(record.book || "").trim(),
                    mood: String(record.mood || "").trim(),
                    displayName: String(record.displayName || "").trim(),
                    readerRecord: String(record.readerRecord || "").trim(),
                    timestamp: String(record.timestamp || "").trim(),
                    featured: parseBoolean(record.featured),
                    spoilerWarning: parseBoolean(record.spoilerWarning),
                    finalRating: parseRating(record.finalRating) || fallbackRating,
                    atmosphere,
                    story,
                    characters,
                    dreadTension,
                    ending
                };
            })
            .sort(sortRecords);
    }

    function sortRecords(a, b) {
        if (a.featured && !b.featured) return -1;
        if (!a.featured && b.featured) return 1;

        const bookA = getBookSortIndex(a.book);
        const bookB = getBookSortIndex(b.book);

        if (bookA !== bookB) {
            return bookA - bookB;
        }

        return a.book.localeCompare(b.book);
    }

    function getBookSortIndex(book) {
        const index = BOOK_ORDER.indexOf(book);
        return index === -1 ? 999 : index;
    }

    function parseBoolean(value) {
        if (value === true) return true;
        if (value === false) return false;

        const clean = String(value || "").trim().toLowerCase();

        return clean === "true" || clean === "yes" || clean === "1" || clean === "featured";
    }

    function parseRating(value) {
        const number = Number(value);

        if (!Number.isFinite(number) || number <= 0) {
            return 0;
        }

        return number;
    }

    function calculateAverage(values) {
        const cleanValues = values.filter(value => Number.isFinite(value) && value > 0);

        if (!cleanValues.length) {
            return 0;
        }

        const total = cleanValues.reduce((sum, value) => sum + value, 0);

        return Math.round((total / cleanValues.length) * 10) / 10;
    }

    function populateFilters(records) {
        const bookFilter = publicRecordsState.bookFilterEl;
        const moodFilter = publicRecordsState.moodFilterEl;

        if (bookFilter) {
            const currentValue = bookFilter.value || "all";
            const books = uniqueValues(records.map(record => record.book));

            bookFilter.innerHTML = `<option value="all">All Books</option>`;

            books.forEach(book => {
                const option = document.createElement("option");
                option.value = book;
                option.textContent = book;
                bookFilter.appendChild(option);
            });

            bookFilter.value = books.includes(currentValue) ? currentValue : "all";
            publicRecordsState.bookFilter = bookFilter.value;
        }

        if (moodFilter) {
            const currentValue = moodFilter.value || "all";
            const moods = uniqueValues(records.map(record => record.mood));

            moodFilter.innerHTML = `<option value="all">All Moods</option>`;

            moods.forEach(mood => {
                const option = document.createElement("option");
                option.value = mood;
                option.textContent = mood;
                moodFilter.appendChild(option);
            });

            moodFilter.value = moods.includes(currentValue) ? currentValue : "all";
            publicRecordsState.moodFilter = moodFilter.value;
        }
    }

    function uniqueValues(values) {
        return Array.from(
            new Set(
                values
                    .map(value => String(value || "").trim())
                    .filter(Boolean)
            )
        ).sort((a, b) => a.localeCompare(b));
    }

    function renderRecords() {
        const list = publicRecordsState.list;

        if (!list) return;

        clearAllRotators();

        list.innerHTML = "";

        const filtered = publicRecordsState.records.filter(record => {
            const bookMatches =
                publicRecordsState.bookFilter === "all" ||
                record.book === publicRecordsState.bookFilter;

            const moodMatches =
                publicRecordsState.moodFilter === "all" ||
                record.mood === publicRecordsState.moodFilter;

            return bookMatches && moodMatches;
        });

        if (!filtered.length) {
            const empty = document.createElement("p");
            empty.className = "reader-records-empty";
            empty.textContent = "No approved reader records match this filter.";

            list.appendChild(empty);
            return;
        }

        const featuredRecords = filtered.filter(record => record.featured);

        if (featuredRecords.length) {
            list.appendChild(
                createRotatorSection({
                    key: "featured-records",
                    title: "Featured Reader Records",
                    countLabel: `${featuredRecords.length} ${featuredRecords.length === 1 ? "featured record" : "featured records"}`,
                    records: featuredRecords,
                    featuredSection: true
                })
            );
        }

        const bookRecords = filtered.filter(record => !record.featured);
const grouped = groupRecordsByBook(bookRecords);
const books = Object.keys(grouped).sort(sortBookNames);

        books.forEach(book => {
            const records = grouped[book];

            list.appendChild(
                createRotatorSection({
                    key: `book-${slugify(book)}`,
                    title: book,
                    countLabel: `${records.length} ${records.length === 1 ? "record" : "records"}`,
                    records,
                    featuredSection: false
                })
            );
        });
    }

    function groupRecordsByBook(records) {
        return records.reduce((groups, record) => {
            const book = record.book || "Unfiled Record";

            if (!groups[book]) {
                groups[book] = [];
            }

            groups[book].push(record);
            groups[book].sort(sortRecords);

            return groups;
        }, {});
    }

    function sortBookNames(a, b) {
        const indexA = getBookSortIndex(a);
        const indexB = getBookSortIndex(b);

        if (indexA !== indexB) {
            return indexA - indexB;
        }

        return a.localeCompare(b);
    }

    function createRotatorSection(config) {
        const section = document.createElement("section");
        section.className = config.featuredSection
            ? "reader-featured-records"
            : "reader-book-rotator";

        section.dataset.rotatorKey = config.key;

        const heading = document.createElement("div");
        heading.className = "reader-rotator-heading";

        const title = document.createElement("h3");
        title.textContent = config.title;

        const count = document.createElement("p");
        count.className = "reader-rotator-count";
        count.textContent = config.countLabel;

        heading.appendChild(title);
        heading.appendChild(count);

        const body = document.createElement("div");
        body.className = "reader-rotator-body";
        body.setAttribute("aria-live", "polite");

        const controls = document.createElement("div");
        controls.className = "reader-rotator-controls";

        const previous = document.createElement("button");
        previous.type = "button";
        previous.className = "reader-rotator-button";
        previous.textContent = "Previous";
        previous.disabled = config.records.length <= 1;

        const position = document.createElement("p");
        position.className = "reader-rotator-position";

        const next = document.createElement("button");
        next.type = "button";
        next.className = "reader-rotator-button";
        next.textContent = "Next";
        next.disabled = config.records.length <= 1;

        controls.appendChild(previous);
        controls.appendChild(position);
        controls.appendChild(next);

        section.appendChild(heading);
        section.appendChild(body);
        section.appendChild(controls);

        const rotator = {
            key: config.key,
            section,
            body,
            position,
            records: config.records,
            index: 0,
            timer: null,
            featuredSection: config.featuredSection
        };

        publicRecordsState.rotators.set(config.key, rotator);

        previous.addEventListener("click", () => {
            moveRotator(config.key, -1);
            restartRotator(config.key);
        });

        next.addEventListener("click", () => {
            moveRotator(config.key, 1);
            restartRotator(config.key);
        });

        section.addEventListener("mouseenter", () => pauseRotator(config.key));
        section.addEventListener("mouseleave", () => resumeRotator(config.key));

        section.addEventListener("focusin", () => pauseRotator(config.key));
        section.addEventListener("focusout", () => {
            window.setTimeout(() => {
                if (!section.contains(document.activeElement)) {
                    resumeRotator(config.key);
                }
            }, 50);
        });

        renderRotator(rotator);
        startRotator(config.key);

        return section;
    }

    function renderRotator(rotator) {
        const record = rotator.records[rotator.index];

        rotator.body.innerHTML = "";
        rotator.body.appendChild(createRotatorCard(record, rotator.featuredSection));

        rotator.position.textContent = `${rotator.index + 1} of ${rotator.records.length}`;
    }

    function moveRotator(key, direction) {
        const rotator = publicRecordsState.rotators.get(key);

        if (!rotator || rotator.records.length <= 1) {
            return;
        }

        const nextIndex = rotator.index + direction;

        if (nextIndex < 0) {
            rotator.index = rotator.records.length - 1;
        } else if (nextIndex >= rotator.records.length) {
            rotator.index = 0;
        } else {
            rotator.index = nextIndex;
        }

        renderRotator(rotator);
    }

    function startRotator(key) {
        const rotator = publicRecordsState.rotators.get(key);

        if (!rotator || rotator.records.length <= 1 || rotator.timer) {
            return;
        }

        rotator.timer = window.setInterval(() => {
            moveRotator(key, 1);
        }, ROTATION_DELAY);
    }

    function pauseRotator(key) {
        const rotator = publicRecordsState.rotators.get(key);

        if (!rotator || !rotator.timer) {
            return;
        }

        window.clearInterval(rotator.timer);
        rotator.timer = null;
    }

    function resumeRotator(key) {
        startRotator(key);
    }

    function restartRotator(key) {
        pauseRotator(key);
        startRotator(key);
    }

    function clearAllRotators() {
        publicRecordsState.rotators.forEach(rotator => {
            if (rotator.timer) {
                window.clearInterval(rotator.timer);
            }
        });

        publicRecordsState.rotators.clear();
    }

    function createRotatorCard(record, isFeaturedSection) {
        const meta = BOOK_META[record.book] || {
            image: "/assets/A8.png",
            link: "/pages/publications.html"
        };

        const card = document.createElement("article");
        card.className = "reader-rotator-card";

        const coverWrap = document.createElement("div");
        coverWrap.className = "reader-rotator-cover";

        const coverLink = document.createElement("a");
        coverLink.href = meta.link;

        if (meta.link.startsWith("http")) {
            coverLink.target = "_blank";
            coverLink.rel = "noopener noreferrer sponsored";
        }

        const cover = document.createElement("img");
        cover.src = meta.image;
        cover.alt = `${record.book} cover`;
        cover.loading = "lazy";

        coverLink.appendChild(cover);
        coverWrap.appendChild(coverLink);

        const content = document.createElement("div");
        content.className = "reader-rotator-content";

        const metaRow = document.createElement("div");
        metaRow.className = "reader-rotator-meta";

        metaRow.appendChild(createRotatorPill(record.mood || "Filed Record"));

        if (record.featured) {
            metaRow.appendChild(createRotatorPill("Featured"));
        }

        if (record.spoilerWarning) {
            metaRow.appendChild(createRotatorPill("Spoilers Hidden"));
        }

        const title = document.createElement("h4");
        title.className = "reader-rotator-title";
        title.textContent = isFeaturedSection ? record.book : "Reader Record";

        const finalRating = Number(record.finalRating || 0);

        const rating = document.createElement("p");
        rating.className = "reader-rotator-rating";
        rating.textContent = `Final Archive Rating: ${finalRating ? finalRating.toFixed(1) : "—"} / 5`;

        content.appendChild(metaRow);
        content.appendChild(title);
        content.appendChild(rating);

        const review = document.createElement("p");
        review.className = "reader-rotator-review";
        review.textContent = record.readerRecord;

        if (record.spoilerWarning) {
            review.hidden = true;

            const spoilerWrap = document.createElement("div");
            spoilerWrap.className = "reader-rotator-spoiler";

            const spoilerButton = document.createElement("button");
            spoilerButton.type = "button";
            spoilerButton.textContent = "Reveal Spoiler Record";

            spoilerButton.addEventListener("click", () => {
                review.hidden = false;
                spoilerWrap.remove();
            });

            spoilerWrap.appendChild(spoilerButton);
            content.appendChild(spoilerWrap);
        }

        content.appendChild(review);

        const footer = document.createElement("p");
        footer.className = "reader-rotator-footer";
        footer.textContent = `Filed by ${record.displayName || "A reader"}${record.timestamp ? ` · ${record.timestamp}` : ""}`;

        content.appendChild(footer);

        card.appendChild(coverWrap);
        card.appendChild(content);

        return card;
    }

    function createRotatorPill(text) {
        const pill = document.createElement("span");
        pill.className = "reader-rotator-pill";
        pill.textContent = text;

        return pill;
    }

    function slugify(value) {
        return String(value || "")
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "");
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initReaderRecords);
    } else {
        initReaderRecords();
    }
})();
