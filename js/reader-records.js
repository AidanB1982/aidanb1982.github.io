/* ======================================================
   BLACKWOOD READER RECORDS
   Front-end bridge for Google Apps Script 
====================================================== */

const BLACKWOOD_READER_RECORDS_ENDPOINT = "https://script.google.com/macros/s/AKfycbwOWic3DTxR5VkXy0gFythhvDVO6TsOh81jse4LO3YpCyP7SnScUi8p-ccx0SqJPlBb/exec";

(function () {
    "use strict";

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
        moodFilterEl: null
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
                const records = Array.isArray(data.records) ? data.records : [];

                publicRecordsState.records = normaliseRecords(records);

                populateFilters(publicRecordsState.records);
                renderRecords();
            })
            .catch(() => {
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

            window[callbackName] = data => {
                resolve(data);
                cleanup();
            };

            const script = document.createElement("script");
            const separator = url.includes("?") ? "&" : "?";

            script.src = `${url}${separator}callback=${callbackName}&cache=${Date.now()}`;
            script.async = true;

            script.onerror = () => {
                reject(new Error("JSONP request failed."));
                cleanup();
            };

            function cleanup() {
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
            .map(record => ({
                ...record,
                book: String(record.book || "").trim(),
                mood: String(record.mood || "").trim(),
                displayName: String(record.displayName || "").trim(),
                readerRecord: String(record.readerRecord || "").trim(),
                timestamp: String(record.timestamp || "").trim(),
                featured: Boolean(record.featured),
                spoilerWarning: Boolean(record.spoilerWarning),
                finalRating: Number(record.finalRating || 0),
                atmosphere: Number(record.atmosphere || 0),
                story: Number(record.story || 0),
                characters: Number(record.characters || 0),
                dreadTension: Number(record.dreadTension || 0),
                ending: Number(record.ending || 0)
            }))
            .sort((a, b) => {
                if (a.featured && !b.featured) return -1;
                if (!a.featured && b.featured) return 1;

                return a.book.localeCompare(b.book);
            });
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

        const grouped = groupRecordsByBook(filtered);

        Object.keys(grouped).forEach(book => {
            list.appendChild(createBookGroup(book, grouped[book]));
        });
    }

    function groupRecordsByBook(records) {
        return records.reduce((groups, record) => {
            const book = record.book || "Unfiled Record";

            if (!groups[book]) {
                groups[book] = [];
            }

            groups[book].push(record);

            groups[book].sort((a, b) => {
                if (a.featured && !b.featured) return -1;
                if (!a.featured && b.featured) return 1;
                return 0;
            });

            return groups;
        }, {});
    }

    function createBookGroup(book, records) {
        const section = document.createElement("section");
        section.className = "reader-book-group";

        const heading = document.createElement("div");
        heading.className = "reader-book-group-heading";

        const title = document.createElement("h3");
        title.className = "reader-book-group-title";
        title.textContent = book;

        const count = document.createElement("p");
        count.className = "reader-book-group-count";
        count.textContent = `${records.length} ${records.length === 1 ? "record" : "records"}`;

        heading.appendChild(title);
        heading.appendChild(count);

        const grid = document.createElement("div");
        grid.className = "reader-book-group-grid";

        records.forEach(record => {
            grid.appendChild(createRecordCard(record));
        });

        section.appendChild(heading);
        section.appendChild(grid);

        return section;
    }

    function createRecordCard(record) {
        const meta = BOOK_META[record.book] || {
            image: "/assets/A8.png",
            link: "/pages/publications.html"
        };

        const card = document.createElement("article");
        card.className = "reader-public-card is-compact";

        const coverWrap = document.createElement("div");
        coverWrap.className = "reader-public-cover";

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
        content.className = "reader-public-content";

        const metaRow = document.createElement("div");
        metaRow.className = "reader-public-meta";

        metaRow.appendChild(createPill(record.mood || "Filed Record"));

        if (record.featured) {
            metaRow.appendChild(createPill("Featured"));
        }

        if (record.spoilerWarning) {
            metaRow.appendChild(createPill("Spoilers Hidden"));
        }

        const title = document.createElement("h4");
        title.textContent = record.book;

        const finalRating = Number(record.finalRating || 0);

        const rating = document.createElement("p");
        rating.className = "reader-public-rating";
        rating.textContent = `Final Archive Rating: ${finalRating ? finalRating.toFixed(1) : "—"} / 5`;

        const review = document.createElement("p");
        review.className = "reader-public-review";

        content.appendChild(metaRow);
        content.appendChild(title);
        content.appendChild(rating);

        if (record.spoilerWarning) {
            review.hidden = true;
            review.textContent = record.readerRecord;

            const spoilerWrap = document.createElement("div");
            spoilerWrap.className = "reader-public-spoiler";

            const spoilerButton = document.createElement("button");
            spoilerButton.type = "button";
            spoilerButton.textContent = "Reveal Spoiler Record";

            spoilerButton.addEventListener("click", () => {
                review.hidden = false;
                spoilerWrap.remove();
            });

            spoilerWrap.appendChild(spoilerButton);
            content.appendChild(spoilerWrap);
            content.appendChild(review);
        } else {
            review.textContent = record.readerRecord;
            content.appendChild(review);
        }

        content.appendChild(createBreakdown(record));

        const footer = document.createElement("p");
        footer.className = "reader-public-footer";
        footer.textContent = `Filed by ${record.displayName || "A reader"}${record.timestamp ? ` · ${record.timestamp}` : ""}`;

        content.appendChild(footer);

        card.appendChild(coverWrap);
        card.appendChild(content);

        return card;
    }

    function createPill(text) {
        const pill = document.createElement("span");
        pill.className = "reader-public-pill";
        pill.textContent = text;

        return pill;
    }

    function createBreakdown(record) {
        const breakdown = document.createElement("div");
        breakdown.className = "reader-public-breakdown";

        const scores = [
            ["Atmosphere", record.atmosphere],
            ["Story", record.story],
            ["Characters", record.characters],
            ["Dread", record.dreadTension],
            ["Ending", record.ending]
        ];

        scores.forEach(([label, value]) => {
            const item = document.createElement("div");
            item.className = "reader-public-score";

            const labelEl = document.createElement("span");
            labelEl.textContent = label;

            const valueEl = document.createElement("strong");
            valueEl.textContent = Number(value || 0) ? `${Number(value).toFixed(0)} / 5` : "—";

            item.appendChild(labelEl);
            item.appendChild(valueEl);

            breakdown.appendChild(item);
        });

        return breakdown;
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initReaderRecords);
    } else {
        initReaderRecords();
    }
})();
