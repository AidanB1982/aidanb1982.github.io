/* ======================================================
   BLACKWOOD CIRCLE — MEMBER ARC PROFILE
   Pulls and updates the signed-in member's ARC profile
   from the ARC Applications Google Sheet via Apps Script.
====================================================== */

(function () {
    "use strict";

    const BLACKWOOD_ARC_PROFILE_ENDPOINT = "https://script.google.com/macros/s/AKfycbwxZ1Qwc_EkRgrWjjkf8kx_HXw2TIPYz9hkws4dPHVaMzC8cLPXtMxQyWv30OenpZNh/exec";
    const BLACKWOOD_ARC_WELCOME_POSTER = "/assets/blackwood-arc-welcome.jpg";

    const ARC_EDITABLE_FIELDS = [
        {
            key: "Name",
            label: "Name",
            type: "text",
            placeholder: "Your reader name"
        },
        {
            key: "Country",
            label: "Country",
            type: "text",
            placeholder: "Country"
        },
        {
            key: "Preferred Format",
            label: "Preferred Format",
            type: "select",
            options: [
                "",
                "Digital ARC",
                "Paperback ARC",
                "Either",
                "BookFunnel",
                "Kindle / ebook",
                "PDF",
                "Other"
            ]
        },
        {
            key: "Preferred Genres",
            label: "Preferred Genres",
            type: "textarea",
            placeholder: "Horror, dark fantasy, literary fiction, gothic, folk horror..."
        },
        {
            key: "Blackwood Interests",
            label: "Blackwood Interests",
            type: "textarea",
            placeholder: "Archive Files, Cursed Bothies, Miren Vale, signed editions..."
        },
        {
            key: "Review Platforms",
            label: "Review Platforms",
            type: "textarea",
            placeholder: "Amazon, Goodreads, StoryGraph, Instagram, TikTok, blog..."
        },
        {
            key: "Amazon Profile",
            label: "Amazon Profile",
            type: "url",
            placeholder: "https://..."
        },
        {
            key: "Goodreads Profile",
            label: "Goodreads Profile",
            type: "url",
            placeholder: "https://..."
        },
        {
            key: "StoryGraph Profile",
            label: "StoryGraph Profile",
            type: "url",
            placeholder: "https://..."
        },
        {
            key: "Instagram",
            label: "Instagram",
            type: "text",
            placeholder: "@username or profile link"
        },
        {
            key: "TikTok",
            label: "TikTok",
            type: "text",
            placeholder: "@username or profile link"
        },
        {
            key: "Blog / Website",
            label: "Blog / Website",
            type: "url",
            placeholder: "https://..."
        },
        {
            key: "Previous ARC Experience",
            label: "Previous ARC Experience",
            type: "textarea",
            placeholder: "Tell us about any previous ARC reading or reviewing experience."
        },
        {
            key: "Can Review By Deadline",
            label: "Can Review By Deadline",
            type: "select",
            options: [
                "",
                "Yes",
                "No",
                "Usually",
                "Depends on timing"
            ]
        },
        {
            key: "Review Timeframe",
            label: "Review Timeframe",
            type: "text",
            placeholder: "Example: within 2 weeks / within 30 days"
        },
        {
            key: "Interested In",
            label: "Interested In",
            type: "textarea",
            placeholder: "Which Blackwood titles, series, or genres would you most like to read?"
        },
        {
            key: "Why Join ARC Team",
            label: "Why Join ARC Team",
            type: "textarea",
            placeholder: "Why would you like to be part of the Blackwood ARC Team?"
        }
    ];

    const ARC_READ_ONLY_FIELDS = [
        {
            key: "Application Status",
            label: "Application Status"
        },
        {
            key: "ARC Sent",
            label: "ARC Sent"
        },
        {
            key: "ARC Sent Date",
            label: "ARC Sent Date"
        },
        {
            key: "Review Due Date",
            label: "Review Due Date"
        },
        {
            key: "Review Received",
            label: "Review Received"
        },
        {
            key: "Review Link",
            label: "Review Link"
        },
        {
            key: "Application ID",
            label: "Application ID"
        },
        {
            key: "Email",
            label: "Circle Email"
        }
    ];

    window.initBlackwoodArcProfile = initBlackwoodArcProfile;

    async function initBlackwoodArcProfile(options) {
        const root = options && options.root ? options.root : null;
        const session = options && options.session ? options.session : null;

        if (!root) {
            return;
        }

        if (!session || !session.access_token) {
            renderArcProfileSignedOut(root);
            return;
        }

        renderArcProfileLoading(root);

        try {
            const response = await sendArcProfileRequest({
                action: "getArcProfile",
                accessToken: session.access_token
            });

            if (!response.ok) {
                if (response.notFound) {
                    renderArcProfileNotFound(root, response.error);
                    return;
                }

                throw new Error(response.error || "The ARC profile could not be loaded.");
            }

            renderArcProfile(root, {
                session,
                profile: response.profile
            });

        } catch (error) {
            console.warn("Blackwood ARC Profile failed:", error);
            renderArcProfileError(root, error.message || "The ARC profile could not be loaded.");
        }
    }

    function renderArcProfileLoading(root) {
        root.innerHTML = `
            <div class="arc-profile-card arc-profile-card-loading">
                <p class="arc-profile-kicker">ARC Team</p>
                <h2>Opening your ARC profile...</h2>
                <p>Your private ARC reader profile is being retrieved from the archive.</p>
            </div>
        `;
    }

    function renderArcProfileSignedOut(root) {
        root.innerHTML = `
            <div class="arc-profile-card arc-profile-card-error">
                <p class="arc-profile-kicker">ARC Team</p>
                <h2>Sign in required</h2>
                <p>Please sign into The Blackwood Circle to view your ARC profile.</p>
            </div>
        `;
    }

    function renderArcProfileNotFound(root, message) {
        root.innerHTML = `
            <div class="arc-profile-card arc-profile-card-muted">
                <p class="arc-profile-kicker">ARC Team</p>
                <h2>No ARC profile found</h2>
                <p>${escapeHtml(message || "No ARC application was found for your signed-in Circle email.")}</p>
                <p class="arc-profile-small-note">
                    If you recently applied, your ARC profile may not have been approved or matched yet.
                </p>
            </div>
        `;
    }

    function renderArcProfileError(root, message) {
        root.innerHTML = `
            <div class="arc-profile-card arc-profile-card-error">
                <p class="arc-profile-kicker">ARC Team</p>
                <h2>ARC profile unavailable</h2>
                <p>${escapeHtml(message || "Something went wrong while opening your ARC profile.")}</p>
            </div>
        `;
    }

    function renderArcProfile(root, options) {
        const session = options.session;
        const profile = options.profile || {};
        const editable = profile.editable || {};
        const readOnly = profile.readOnly || {};
        const applicationStatus = readOnly["Application Status"] || "";

        root.innerHTML = `
            <div class="arc-profile-card">
                <div class="arc-profile-heading">
                    <div>
                        <p class="arc-profile-kicker">ARC Team</p>
                        <h2>My ARC Profile</h2>
                        <p>
                            This is the reader profile Blackwood uses when selecting ARC readers,
                            sending advance copies, and tracking review links.
                        </p>
                    </div>

                    <div class="arc-profile-seal" aria-hidden="true">
                        ARC
                    </div>
                </div>

                <div class="arc-profile-status-panel" aria-label="ARC profile status">
                    ${renderReadOnlyFields(readOnly)}
                </div>

                ${renderArcWelcomePoster(applicationStatus)}

                <details class="arc-profile-details">
                    <summary class="arc-profile-details-summary">
                        <span>
                            View / Edit Reader Details
                        </span>

                        <small>
                            Preferences, platforms, links, and ARC reader notes
                        </small>
                    </summary>

                    <form class="arc-profile-form" data-arc-profile-form>
                        <div class="arc-profile-form-heading">
                            <h3>Reader Details</h3>
                            <p>
                                Keep your preferences, review platforms, and reader details up to date.
                                Your email and ARC status are locked to your Circle account.
                            </p>
                        </div>

                        <div class="arc-profile-grid">
                            ${renderEditableFields(editable)}
                        </div>

                        <div class="arc-profile-actions">
                            <button type="submit" class="arc-profile-button arc-profile-button-primary" data-arc-save-button>
                                Save ARC Profile
                            </button>

                            <button type="button" class="arc-profile-button arc-profile-button-secondary" data-arc-reset-button>
                                Reset Changes
                            </button>
                        </div>

                        <p class="arc-profile-message" data-arc-profile-message aria-live="polite"></p>
                    </form>
                </details>
            </div>
        `;

        bindArcProfileForm(root, {
            session,
            profile
        });
    }

    function renderArcWelcomePoster(applicationStatus) {
        if (!isAcceptedArcProfileStatus(applicationStatus)) {
            return "";
        }

        return `
            <section class="arc-welcome-poster" aria-labelledby="arc-welcome-poster-title">
                <div class="arc-welcome-poster-copy">
                    <p class="arc-profile-kicker">Welcome Poster</p>

                    <h3 id="arc-welcome-poster-title">
                        Welcome to the ARC Team
                    </h3>

                    <p>
                        Your official Blackwood ARC Team welcome poster is now filed inside your Circle profile.
                        Open it full size or save a copy for your own archive.
                    </p>

                    <div class="arc-welcome-poster-actions">
                        <a
                            href="${escapeAttribute(BLACKWOOD_ARC_WELCOME_POSTER)}"
                            class="arc-profile-button arc-profile-button-primary"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            Open Poster
                        </a>

                        <a
                            href="${escapeAttribute(BLACKWOOD_ARC_WELCOME_POSTER)}"
                            class="arc-profile-button arc-profile-button-secondary"
                            download
                        >
                            Download Poster
                        </a>
                    </div>
                </div>

                <a
                    class="arc-welcome-poster-preview"
                    href="${escapeAttribute(BLACKWOOD_ARC_WELCOME_POSTER)}"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Open the Blackwood ARC Team welcome poster"
                >
                    <img
                        src="${escapeAttribute(BLACKWOOD_ARC_WELCOME_POSTER)}"
                        alt="Welcome to the ARC Team poster by Blackwood Publishing"
                        loading="lazy"
                    >
                </a>
            </section>
        `;
    }

    function isAcceptedArcProfileStatus(applicationStatus) {
        const cleanStatus = String(applicationStatus || "")
            .trim()
            .toLowerCase();

        return [
            "accepted",
            "approved",
            "arc team",
            "arc team member"
        ].indexOf(cleanStatus) !== -1;
    }

    function renderReadOnlyFields(readOnly) {
        return ARC_READ_ONLY_FIELDS.map(function (field) {
            const rawValue = readOnly[field.key] || "";
            const value = rawValue ? rawValue : "Not recorded";

            if (field.key === "Review Link" && looksLikeUrl(rawValue)) {
                return `
                    <div class="arc-profile-status-item">
                        <span>${escapeHtml(field.label)}</span>
                        <a href="${escapeAttribute(rawValue)}" target="_blank" rel="noopener noreferrer">
                            View Review
                        </a>
                    </div>
                `;
            }

            return `
                <div class="arc-profile-status-item">
                    <span>${escapeHtml(field.label)}</span>
                    <strong>${escapeHtml(value)}</strong>
                </div>
            `;
        }).join("");
    }

    function renderEditableFields(editable) {
        return ARC_EDITABLE_FIELDS.map(function (field) {
            const value = editable[field.key] || "";
            const fieldId = createFieldId(field.key);

            if (field.type === "textarea") {
                return `
                    <div class="arc-profile-field arc-profile-field-wide">
                        <label for="${escapeAttribute(fieldId)}">${escapeHtml(field.label)}</label>
                        <textarea
                            id="${escapeAttribute(fieldId)}"
                            name="${escapeAttribute(field.key)}"
                            rows="4"
                            placeholder="${escapeAttribute(field.placeholder || "")}"
                        >${escapeHtml(value)}</textarea>
                    </div>
                `;
            }

            if (field.type === "select") {
                return `
                    <div class="arc-profile-field">
                        <label for="${escapeAttribute(fieldId)}">${escapeHtml(field.label)}</label>
                        <select id="${escapeAttribute(fieldId)}" name="${escapeAttribute(field.key)}">
                            ${renderSelectOptions(field.options || [], value)}
                        </select>
                    </div>
                `;
            }

            return `
                <div class="arc-profile-field">
                    <label for="${escapeAttribute(fieldId)}">${escapeHtml(field.label)}</label>
                    <input
                        id="${escapeAttribute(fieldId)}"
                        type="${escapeAttribute(field.type || "text")}"
                        name="${escapeAttribute(field.key)}"
                        value="${escapeAttribute(value)}"
                        placeholder="${escapeAttribute(field.placeholder || "")}"
                    >
                </div>
            `;
        }).join("");
    }

    function renderSelectOptions(options, currentValue) {
        const hasExistingOption = currentValue && options.indexOf(currentValue) === -1;
        const allOptions = hasExistingOption ? [currentValue].concat(options) : options;

        return allOptions.map(function (option) {
            const label = option || "Select an option";
            const selected = option === currentValue ? " selected" : "";

            return `
                <option value="${escapeAttribute(option)}"${selected}>
                    ${escapeHtml(label)}
                </option>
            `;
        }).join("");
    }

    function bindArcProfileForm(root, options) {
        const form = root.querySelector("[data-arc-profile-form]");
        const saveButton = root.querySelector("[data-arc-save-button]");
        const resetButton = root.querySelector("[data-arc-reset-button]");
        const message = root.querySelector("[data-arc-profile-message]");

        if (!form) {
            return;
        }

        const originalProfile = JSON.parse(JSON.stringify(options.profile || {}));

        form.addEventListener("submit", async function (event) {
            event.preventDefault();

            const updates = collectArcProfileUpdates(form);

            setArcProfileBusy(form, true);
            setArcProfileMessage(message, "Saving your ARC profile...", "loading");

            try {
                const response = await sendArcProfileRequest({
                    action: "updateArcProfile",
                    accessToken: options.session.access_token,
                    updates
                });

                if (!response.ok) {
                    throw new Error(response.error || "The ARC profile could not be saved.");
                }

                setArcProfileMessage(message, "ARC profile saved.", "success");

                window.setTimeout(function () {
                    renderArcProfile(root, {
                        session: options.session,
                        profile: response.profile
                    });
                }, 700);

            } catch (error) {
                console.warn("Blackwood ARC Profile save failed:", error);
                setArcProfileBusy(form, false);
                setArcProfileMessage(
                    message,
                    error.message || "The ARC profile could not be saved.",
                    "error"
                );
            }
        });

        if (resetButton) {
            resetButton.addEventListener("click", function () {
                renderArcProfile(root, {
                    session: options.session,
                    profile: originalProfile
                });
            });
        }

        if (saveButton) {
            saveButton.disabled = false;
        }
    }

    function collectArcProfileUpdates(form) {
        const updates = {};

        ARC_EDITABLE_FIELDS.forEach(function (field) {
            const input = form.elements[field.key];

            if (!input) {
                return;
            }

            updates[field.key] = String(input.value || "").trim();
        });

        return updates;
    }

    async function sendArcProfileRequest(payload) {
        const response = await fetch(BLACKWOOD_ARC_PROFILE_ENDPOINT, {
            method: "POST",
            redirect: "follow",
            headers: {
                "Content-Type": "text/plain;charset=utf-8"
            },
            body: JSON.stringify(payload)
        });

        const text = await response.text();

        if (!response.ok) {
            throw new Error("ARC endpoint returned " + response.status + ".");
        }

        try {
            return JSON.parse(text);
        } catch (error) {
            throw new Error("ARC endpoint returned an invalid response.");
        }
    }

    function setArcProfileBusy(form, isBusy) {
        const fields = form.querySelectorAll("input, textarea, select, button");

        fields.forEach(function (field) {
            field.disabled = isBusy;
        });
    }

    function setArcProfileMessage(message, text, state) {
        if (!message) {
            return;
        }

        message.textContent = text || "";
        message.className = "arc-profile-message";

        if (state) {
            message.classList.add("is-" + state);
        }
    }

    function createFieldId(key) {
        return "arc-profile-" + String(key || "")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "");
    }

    function looksLikeUrl(value) {
        return /^https?:\/\//i.test(String(value || "").trim());
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
