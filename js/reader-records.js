/* ======================================================
   BLACKWOOD READER RECORDS
   Front-end bridge for Google Apps Script
====================================================== */

const BLACKWOOD_READER_RECORDS_ENDPOINT = "https://script.google.com/macros/s/AKfycbxlvZEvfKy59rT0gp29voxP3pXFHWI4L54GCk2mv49Iqt7xMBGfNEFuQths2OYC2S4k/exec";

(function () {
    "use strict";

    const BOOK_META = {
        "The Black Bothy": {
            image: "/assets/A8.png",
            link: "https://amzn.eu/d/0iArX1Pv"
        },
        "The Drowned Fjord": {
            image: "/assets/A7.png",
            link: "https://amzn.eu/d/07uDWvaN"
        },
        "The Erased Archivist": {
            image: "/assets/A6.png",
            link: "https://amzn.eu/d/06fDEnwB"
        },
        "Holdfast": {
            image: "/assets/A5.png",
            link: "/pages/holdfast.html"
        },
        "Dour Hill House": {
            image: "/assets/book1.jpg",
            link: "https://mybook.to/DourHillHouse"
        },
        "The Red-Clad Collector": {
            image: "/assets/book11.png",
            link: "https://www.amazon.co.uk/dp/B0G76MRK8R"
        },
        "Corrour Bothy": {
            image: "/assets/book2.jpg",
            link: "https://mybook.to/Corrour"
        },
        "Love, Abused": {
            image: "/assets/book15.jpg",
            link: "https://www.amazon.co.uk/Love-Abused-Record-What-Missed-ebook/dp/B0GCLV1WBF"
        },
        "The Scheme": {
            image: "/assets/book9.png",
            link: "https://www.amazon.co.uk/dp/B0H3C64H11"
        },
        "Red Streets": {
            image: "/assets/book10.jpg",
            link: "https://mybook.to/RedStreets"
        }
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
                ratingDisplay.textContent = "—";
                return null;
            }

            const total = ratings.reduce((sum, value) => sum + value, 0);
            const average = Math.round((total / ratings.length) * 10) / 10;

            ratingDisplay.textContent = `${average.toFixed(1)} / 5`;

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
            const payload = new URLSearchParams();

            for (const [key, value] of formData.entries()) {
                payload.append(key, value);
            }

            if (!formData.has("spoilerWarning")) {
                payload.append("spoilerWarning", "false");
            }

            if (!formData.has("permissionToPublish")) {
                payload.append("permissionToPublish", "false");
            }

            await fetch(BLACKWOOD_READER_RECORDS_ENDPOINT, {
                method: "POST",
                mode: "no-cors",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"
                },
                body: payload.toString()
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

                submitButton.disabled = true;
                submitButton.textContent = "Filing Record...";

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
                submitButton.disabled = false;
                submitButton.textContent = "Submit Reader Record";
            }
        });
    }

    /* ======================================================
       PUBLIC RECORDS
    ====================================================== */

    function initPublicRecords() {
        const list = document.querySelector("#reader-records-list");
        const refresh = document.querySelector("#reader-records-refresh");

        if (!list) return;

        if (refresh) {
            refresh.addEventListener("click", () => {
                loadApprovedRecords(list);
            });
        }

        loadApprovedRecords(list);
    }

    function loadApprovedRecords(list) {
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

                renderRecords(list, records);
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

    function renderRecords(list, records) {
        list.innerHTML = "";

        const filtered = records
            .filter(record => record && record.book && record.readerRecord)
            .sort((a, b) => {
                if (a.featured && !b.featured) return -1;
                if (!a.featured && b.featured) return 1;
                return 0;
            });

        if (!filtered.length) {
            const empty = document.createElement("p");
            empty.className = "reader-records-empty";
            empty.textContent = "No approved reader records have been filed yet.";

            list.appendChild(empty);
            return;
        }

        filtered.forEach(record => {
            list.appendChild(createRecordCard(record));
        });
    }

    function createRecordCard(record) {
        const meta = BOOK_META[record.book] || {
            image: "/assets/A8.png",
            link: "/pages/publications.html"
        };

        const card = document.createElement("article");
        card.className = "reader-public-card";

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

        const title = document.createElement("h3");
        title.textContent = record.book;

        const finalRating = Number(record.finalRating || 0);

        const rating = document.createElement("p");
        rating.className = "reader-public-rating";
        rating.textContent = `Final Archive Rating: ${finalRating ? finalRating.toFixed(1) : "—"} / 5`;

        const review = document.createElement("p");
        review.className = "reader-public-review";

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

            content.appendChild(metaRow);
            content.appendChild(title);
            content.appendChild(rating);
            content.appendChild(spoilerWrap);
            content.appendChild(review);
        } else {
            review.textContent = record.readerRecord;

            content.appendChild(metaRow);
            content.appendChild(title);
            content.appendChild(rating);
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
