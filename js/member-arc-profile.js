// ======================================================
// BLACKWOOD CIRCLE — MEMBER ARC PROFILE
// Pulls editable ARC profile from Apps Script.
// Pulls ARC file assignments from Supabase.
// Requires copyright acceptance before opening ARC download.
// Allows ARC readers to submit/update review links.
// Shows review status labels: Active, Due Soon, Due Today,
// Overdue, Review Filed.
// Includes admin-only ARC Assignment Monitor.
// ======================================================

(function () {
    "use strict";

    const BLACKWOOD_ARC_PROFILE_ENDPOINT = "https://script.google.com/macros/s/AKfycbwxZ1Qwc_EkRgrWjjkf8kx_HXw2TIPYz9hkws4dPHVaMzC8cLPXtMxQyWv30OenpZNh/exec";
    const BLACKWOOD_ARC_WELCOME_POSTER = "/assets/blackwood-arc-welcome.jpg";

    const BLACKWOOD_SUPABASE_URL = "https://bmnlynjldlnxfvunqbqq.supabase.co";
    const BLACKWOOD_SUPABASE_PUBLIC_KEY = "sb_publishable_eL7qdDe_6XWGhzmdsql_7w_7dg6psC0";
    const BLACKWOOD_WATERMARKED_ARC_FUNCTION_URL = "https://bmnlynjldlnxfvunqbqq.supabase.co/functions/v1/generate-watermarked-arc";

    const ARC_TERMS_VERSION = "ARC Copyright Terms v1";

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
                            sending advance copies, and managing review records.
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

                <div data-arc-vault-root>
                    ${renderArcVaultLoading()}
                </div>

                <div data-arc-admin-root></div>

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

        loadArcVault(root, session);
        loadArcAdminDashboard(root, session);
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

    function renderArcVaultLoading() {
        return `
            <section class="arc-current-card arc-vault-card" aria-labelledby="arc-vault-title">
                <div class="arc-current-card-main">
                    <p class="arc-profile-kicker">Blackwood ARC Vault</p>
                    <h3 id="arc-vault-title">Checking assigned ARC files...</h3>
                    <p>Your private ARC assignments are being checked.</p>
                </div>
            </section>
        `;
    }

    async function loadArcVault(root, session) {
        const vaultRoot = root.querySelector("[data-arc-vault-root]");

        if (!vaultRoot) {
            return;
        }

        try {
            const assignments = await fetchArcAssignments(session);

            if (!assignments.length) {
                vaultRoot.innerHTML = renderArcVaultEmpty();
                return;
            }

            vaultRoot.innerHTML = renderArcVaultAssignments(assignments);
            bindArcVaultActions(root, session);

        } catch (error) {
            console.warn("Blackwood ARC Vault failed:", error);

            vaultRoot.innerHTML = `
                <section class="arc-current-card arc-vault-card arc-profile-card-error">
                    <div class="arc-current-card-main">
                        <p class="arc-profile-kicker">Blackwood ARC Vault</p>
                        <h3>ARC files unavailable</h3>
                        <p>${escapeHtml(error.message || "Your ARC files could not be loaded.")}</p>
                    </div>
                </section>
            `;
        }
    }

    function renderArcVaultEmpty() {
        return `
            <section class="arc-current-card arc-vault-card" aria-labelledby="arc-vault-title">
                <div class="arc-current-card-main">
                    <p class="arc-profile-kicker">Blackwood ARC Vault</p>
                    <h3 id="arc-vault-title">No active ARC files</h3>
                    <p>
                        You do not currently have an active ARC download assigned to this Circle account.
                        When an ARC is issued, it will appear here.
                    </p>
                </div>
            </section>
        `;
    }

    function renderArcVaultAssignments(assignments) {
        return `
            <section class="arc-current-card arc-vault-card" aria-labelledby="arc-vault-title">
                <div class="arc-current-card-main">
                    <p class="arc-profile-kicker">Blackwood ARC Vault</p>

                    <h3 id="arc-vault-title">
                        Assigned ARC Files
                    </h3>

                    <p>
                        Your active ARC files are listed below. Each file is supplied for private review use only.
                        Accept the copyright terms to generate a temporary secure download link.
                    </p>

                    <div class="arc-vault-list">
                        ${assignments.map(renderArcVaultAssignment).join("")}
                    </div>
                </div>
            </section>
        `;
    }

    async function loadArcAdminDashboard(root, session) {
        const adminRoot = root.querySelector("[data-arc-admin-root]");

        if (!adminRoot || !session || !session.access_token) {
            return;
        }

        adminRoot.innerHTML = "";

        try {
            const rows = await supabaseRestRpc(session, "get_arc_admin_dashboard", {});

            if (!Array.isArray(rows) || !rows.length) {
                adminRoot.innerHTML = "";
                return;
            }

            adminRoot.innerHTML = renderArcAdminDashboard(rows);

        } catch (error) {
            console.warn("Blackwood ARC Admin dashboard unavailable:", error);
            adminRoot.innerHTML = "";
        }
    }

    function renderArcAdminDashboard(rows) {
    return `
        <details class="arc-admin-card arc-admin-collapsible" data-arc-admin-details>
            <summary class="arc-admin-summary">
                <div class="arc-admin-heading">
                    <div>
                        <p class="arc-profile-kicker">ARC Admin</p>

                        <h3 id="arc-admin-title">
                            ARC Assignment Monitor
                        </h3>

                        <p>
                            Active ARC assignments, reader downloads, due dates, and filed review links.
                        </p>
                    </div>

                    <div class="arc-admin-summary-meta">
                        <span class="arc-admin-count">
                            ${escapeHtml(String(rows.length))} Active
                        </span>

                        <span class="arc-admin-chevron" aria-hidden="true">
                            ▾
                        </span>
                    </div>
                </div>
            </summary>

            <div class="arc-admin-body">
                <div class="arc-admin-table-wrap">
                    <table class="arc-admin-table">
                        <thead>
                            <tr>
                                <th>Reader</th>
                                <th>ARC</th>
                                <th>Due</th>
                                <th>Status</th>
                                <th>Downloads</th>
                                <th>Last Opened</th>
                                <th>Review</th>
                            </tr>
                        </thead>

                        <tbody>
                            ${rows.map(renderArcAdminRow).join("")}
                        </tbody>
                    </table>
                </div>
            </div>
        </details>
    `;
}

    function renderArcAdminRow(row) {
        const reviewStatus = row.review_status || "Active";
        const reviewClass = getArcAdminStatusClass(reviewStatus);
        const reviewLink = row.review_link || "";

        return `
            <tr>
                <td>
                    <strong>${escapeHtml(row.reader_name || "Unknown reader")}</strong>
                    <span>${escapeHtml(row.reader_email || "No email recorded")}</span>
                </td>

                <td>
                    <strong>${escapeHtml(row.title || "Unknown ARC")}</strong>
                    <span>${escapeHtml(row.author_name || "Blackwood Publishing")}</span>
                </td>

                <td>
                    ${escapeHtml(formatDateForDisplay(row.review_due_date) || "Not recorded")}
                </td>

                <td>
                    <span class="arc-admin-status ${escapeAttribute(reviewClass)}">
                        ${escapeHtml(reviewStatus)}
                    </span>
                </td>

                <td>
                    ${escapeHtml(String(Number(row.download_count || 0)))}
                </td>

                <td>
                    ${escapeHtml(formatDateTimeForDisplay(row.last_downloaded_at) || "Not yet")}
                </td>

                <td>
                    ${reviewLink && looksLikeUrl(reviewLink) ? `
                        <a href="${escapeAttribute(reviewLink)}" target="_blank" rel="noopener noreferrer">
                            View Review
                        </a>
                    ` : `
                        <span class="arc-admin-muted">Not filed</span>
                    `}
                </td>
            </tr>
        `;
    }

    function getArcAdminStatusClass(status) {
        const cleanStatus = String(status || "")
            .trim()
            .toLowerCase();

        if (cleanStatus === "review filed") {
            return "is-review-filed";
        }

        if (cleanStatus === "overdue") {
            return "is-overdue";
        }

        if (cleanStatus === "due today") {
            return "is-due-today";
        }

        if (cleanStatus === "due soon") {
            return "is-due-soon";
        }

        return "is-active";
    }

    function renderArcVaultAssignment(assignment) {
        const arcFile = normalizeArcFileRelation(assignment.arc_files);
        const assignmentId = String(assignment.id || "");
        const title = arcFile.title || "Current Blackwood ARC";
        const authorName = arcFile.author_name || "Blackwood Publishing";
        const reviewStatus = getArcReviewStatus(assignment);
        const reviewDueDate = assignment.review_due_date || "";
        const downloadCount = Number(assignment.download_count || 0);
        const lastDownloadedAt = assignment.last_downloaded_at || "";
        const reviewLink = assignment.review_link || "";
        const safeAssignmentId = escapeAttribute(assignmentId);

        return `
            <article class="arc-vault-item" data-arc-assignment-card data-assignment-id="${safeAssignmentId}">
                <div class="arc-vault-item-heading">
                    <div>
                        <p class="arc-profile-kicker">Advance Reader Copy</p>

                        <h4>
                            ${escapeHtml(title)}
                        </h4>

                        <p>
                            ${escapeHtml(authorName)}
                        </p>
                    </div>

                    <span class="arc-vault-status ${escapeAttribute(reviewStatus.className)}">
                        ${escapeHtml(reviewStatus.label)}
                    </span>
                </div>

                <div class="arc-current-meta">
                    <div>
                        <span>Review Due</span>
                        <strong>${escapeHtml(formatDateForDisplay(reviewDueDate) || "Not recorded")}</strong>
                    </div>

                    <div>
                        <span>Downloads</span>
                        <strong>${escapeHtml(String(downloadCount))}</strong>
                    </div>

                    <div>
                        <span>Last Opened</span>
                        <strong>${escapeHtml(formatDateTimeForDisplay(lastDownloadedAt) || "Not yet")}</strong>
                    </div>
                </div>

                <div class="arc-copyright-box">
                    <strong>ARC copyright agreement</strong>

                    <label>
                        <input type="checkbox" data-arc-term>
                        I understand this ARC is for my personal review use only.
                    </label>

                    <label>
                        <input type="checkbox" data-arc-term>
                        I will not upload, sell, share, copy, forward, or redistribute this file.
                    </label>

                    <label>
                        <input type="checkbox" data-arc-term>
                        I understand this is an advance/review copy and may differ from the final published edition.
                    </label>

                    <p>
                        Terms version: ${escapeHtml(ARC_TERMS_VERSION)}
                    </p>
                </div>

                <div class="arc-current-actions">
                    <button
                        type="button"
                        class="arc-profile-button arc-profile-button-primary"
                        data-generate-watermarked-arc
                        data-assignment-id="${safeAssignmentId}"
                        disabled
                    >
                        Accept Terms to Unlock
                    </button>

                    ${reviewLink && looksLikeUrl(reviewLink) ? `
                        <a
                            href="${escapeAttribute(reviewLink)}"
                            class="arc-profile-button arc-profile-button-secondary"
                            target="_blank"
                            rel="noopener noreferrer"
                            data-arc-review-view-link
                        >
                            View Filed Review
                        </a>
                    ` : ""}

                    <button
                        type="button"
                        class="arc-profile-button arc-profile-button-secondary"
                        data-open-arc-review-link
                    >
                        ${reviewLink ? "Update Review Link" : "Add Review Link"}
                    </button>
                </div>

                <form class="arc-review-link-panel" data-arc-review-form hidden>
                    <label for="arc-review-link-${safeAssignmentId}">
                        Review link
                    </label>

                    <div class="arc-review-link-row">
                        <input
                            id="arc-review-link-${safeAssignmentId}"
                            type="url"
                            value="${escapeAttribute(reviewLink)}"
                            placeholder="https://..."
                            data-arc-review-link-input
                        >

                        <button
                            type="submit"
                            class="arc-profile-button arc-profile-button-primary"
                            data-save-arc-review-link
                            data-assignment-id="${safeAssignmentId}"
                        >
                            Save Review Link
                        </button>

                        <button
                            type="button"
                            class="arc-profile-button arc-profile-button-secondary"
                            data-cancel-arc-review-link
                        >
                            Cancel
                        </button>
                    </div>

                    <p class="arc-review-link-message" data-arc-review-link-message aria-live="polite"></p>
                </form>

                <p class="arc-current-download-message" data-watermarked-arc-message aria-live="polite"></p>
            </article>
        `;
    }

    function bindArcVaultActions(root, session) {
        const cards = root.querySelectorAll("[data-arc-assignment-card]");

        cards.forEach(function (card) {
            const terms = Array.from(card.querySelectorAll("[data-arc-term]"));
            const downloadButton = card.querySelector("[data-generate-watermarked-arc]");
            const reviewButton = card.querySelector("[data-open-arc-review-link]");
            const reviewForm = card.querySelector("[data-arc-review-form]");
            const reviewInput = card.querySelector("[data-arc-review-link-input]");
            const reviewCancelButton = card.querySelector("[data-cancel-arc-review-link]");
            const reviewMessage = card.querySelector("[data-arc-review-link-message]");
            const message = card.querySelector("[data-watermarked-arc-message]");

            terms.forEach(function (checkbox) {
                checkbox.addEventListener("change", function () {
                    updateArcVaultButtonState(card);
                });
            });

            updateArcVaultButtonState(card);

            if (reviewButton && reviewForm) {
                reviewButton.addEventListener("click", function () {
                    reviewForm.hidden = !reviewForm.hidden;

                    if (!reviewForm.hidden && reviewInput) {
                        reviewInput.focus();
                        reviewInput.scrollIntoView({
                            behavior: "smooth",
                            block: "center"
                        });
                    }
                });
            }

            if (reviewCancelButton && reviewForm) {
                reviewCancelButton.addEventListener("click", function () {
                    reviewForm.hidden = true;
                    setArcReviewLinkMessage(reviewMessage, "", "");
                });
            }

            if (reviewForm) {
                reviewForm.addEventListener("submit", async function (event) {
                    event.preventDefault();

                    const saveButton = reviewForm.querySelector("[data-save-arc-review-link]");
                    const assignmentId = saveButton
                        ? saveButton.getAttribute("data-assignment-id") || ""
                        : card.getAttribute("data-assignment-id") || "";

                    const reviewLink = reviewInput
                        ? String(reviewInput.value || "").trim()
                        : "";

                    if (!reviewLink || !looksLikeUrl(reviewLink)) {
                        setArcReviewLinkMessage(
                            reviewMessage,
                            "Please enter a valid review link starting with http:// or https://",
                            "error"
                        );
                        return;
                    }

                    if (!session || !session.access_token) {
                        setArcReviewLinkMessage(
                            reviewMessage,
                            "Please sign into The Blackwood Circle before filing your review link.",
                            "error"
                        );
                        return;
                    }

                    const originalText = saveButton ? saveButton.textContent : "";

                    if (saveButton) {
                        saveButton.disabled = true;
                        saveButton.textContent = "Filing...";
                    }

                    setArcReviewLinkMessage(
                        reviewMessage,
                        "Filing your review link...",
                        "loading"
                    );

                    try {
                        await requestArcReviewLinkSave(session, assignmentId, reviewLink);

                        setArcReviewLinkMessage(
                            reviewMessage,
                            "Review link filed. Refreshing ARC record...",
                            "success"
                        );

                        window.setTimeout(function () {
                            loadArcVault(root, session);
                            loadArcAdminDashboard(root, session);
                        }, 800);

                    } catch (error) {
                        console.warn("ARC review link save failed:", error);

                        if (saveButton) {
                            saveButton.disabled = false;
                            saveButton.textContent = originalText || "Save Review Link";
                        }

                        setArcReviewLinkMessage(
                            reviewMessage,
                            error.message || "The review link could not be filed.",
                            "error"
                        );
                    }
                });
            }

            if (!downloadButton) {
                return;
            }

            downloadButton.addEventListener("click", async function () {
                if (!session || !session.access_token) {
                    setWatermarkedArcMessage(
                        message,
                        "Please sign into The Blackwood Circle before opening your ARC.",
                        "error"
                    );
                    return;
                }

                if (!areAllArcTermsAccepted(card)) {
                    setWatermarkedArcMessage(
                        message,
                        "Please accept the ARC copyright terms before opening this file.",
                        "error"
                    );
                    return;
                }

                const assignmentId = downloadButton.getAttribute("data-assignment-id") || "";
                const originalText = downloadButton.textContent;

                downloadButton.disabled = true;
                downloadButton.textContent = "Preparing ARC...";

                setWatermarkedArcMessage(
                    message,
                    "Preparing your secure ARC download. This may take a few moments.",
                    "loading"
                );

                try {
                    const result = await requestWatermarkedArcDownload(session, assignmentId);

                    if (!result.ok || !result.downloadUrl) {
                        throw new Error(result.error || "The ARC could not be opened.");
                    }

                    setWatermarkedArcMessage(
                        message,
                        "Your secure ARC link is ready. Opening now...",
                        "success"
                    );

                    triggerWatermarkedArcDownload(result.downloadUrl);

                    window.setTimeout(function () {
                        loadArcVault(root, session);
                        loadArcAdminDashboard(root, session);
                    }, 1400);

                } catch (error) {
                    console.warn("ARC download failed:", error);

                    downloadButton.disabled = false;
                    downloadButton.textContent = originalText;

                    setWatermarkedArcMessage(
                        message,
                        error.message || "The ARC could not be opened.",
                        "error"
                    );
                }
            });
        });
    }

    function updateArcVaultButtonState(card) {
        const downloadButton = card.querySelector("[data-generate-watermarked-arc]");

        if (!downloadButton) {
            return;
        }

        if (areAllArcTermsAccepted(card)) {
            downloadButton.disabled = false;
            downloadButton.textContent = "Accept Terms & Download PDF";
            return;
        }

        downloadButton.disabled = true;
        downloadButton.textContent = "Accept Terms to Unlock";
    }

    function areAllArcTermsAccepted(card) {
        const terms = Array.from(card.querySelectorAll("[data-arc-term]"));

        return terms.length > 0 && terms.every(function (checkbox) {
            return checkbox.checked;
        });
    }

    async function fetchArcAssignments(session) {
        const memberId = getSessionUserId(session);

        if (!memberId) {
            throw new Error("Your Circle member ID could not be confirmed.");
        }

        const baseSelect = [
            "id",
            "member_id",
            "arc_file_id",
            "application_id",
            "status",
            "review_due_date",
            "review_link",
            "watermarked_storage_bucket",
            "watermarked_storage_path",
            "download_count",
            "last_downloaded_at",
            "created_at"
        ];

        const selectWithArcFile = baseSelect.concat([
            "arc_files(title,slug,author_name,mime_type)"
        ]).join(",");

        let assignments = [];

        try {
            assignments = await supabaseRestSelect(session, "arc_file_assignments", {
                select: selectWithArcFile,
                member_id: "eq." + memberId,
                status: "eq.active",
                order: "created_at.desc"
            });
        } catch (error) {
            console.warn("ARC assignment join failed, trying assignment-only fetch:", error);

            assignments = await supabaseRestSelect(session, "arc_file_assignments", {
                select: baseSelect.join(","),
                member_id: "eq." + memberId,
                status: "eq.active",
                order: "created_at.desc"
            });
        }

        return enrichArcAssignmentsWithFileDetails(session, assignments);
    }

    async function enrichArcAssignmentsWithFileDetails(session, assignments) {
        if (!Array.isArray(assignments) || !assignments.length) {
            return [];
        }

        const missingFileDetails = assignments.filter(function (assignment) {
            const arcFile = normalizeArcFileRelation(assignment.arc_files);

            return !arcFile.title && assignment.arc_file_id;
        });

        if (!missingFileDetails.length) {
            return assignments;
        }

        const arcFileIds = Array.from(new Set(
            missingFileDetails
                .map(function (assignment) {
                    return Number(assignment.arc_file_id);
                })
                .filter(function (id) {
                    return Number.isFinite(id) && id > 0;
                })
        ));

        if (!arcFileIds.length) {
            return assignments;
        }

        try {
            const arcFiles = await fetchArcFilesByIds(session, arcFileIds);
            const arcFileMap = {};

            arcFiles.forEach(function (arcFile) {
                arcFileMap[String(arcFile.id)] = arcFile;
            });

            return assignments.map(function (assignment) {
                const existingArcFile = normalizeArcFileRelation(assignment.arc_files);

                if (existingArcFile.title) {
                    return assignment;
                }

                const fallbackArcFile = arcFileMap[String(assignment.arc_file_id)] || {};

                return {
                    ...assignment,
                    arc_files: fallbackArcFile
                };
            });

        } catch (error) {
            console.warn("ARC file title fallback failed:", error);

            return assignments;
        }
    }

    async function fetchArcFilesByIds(session, arcFileIds) {
        if (!arcFileIds.length) {
            return [];
        }

        return supabaseRestSelect(session, "arc_files", {
            select: "id,title,slug,author_name,mime_type",
            id: "in.(" + arcFileIds.join(",") + ")"
        });
    }

    async function supabaseRestSelect(session, tableName, queryParams) {
        const url = new URL(BLACKWOOD_SUPABASE_URL + "/rest/v1/" + tableName);

        Object.keys(queryParams || {}).forEach(function (key) {
            url.searchParams.set(key, queryParams[key]);
        });

        const response = await fetch(url.toString(), {
            method: "GET",
            headers: {
                "apikey": BLACKWOOD_SUPABASE_PUBLIC_KEY,
                "Authorization": "Bearer " + session.access_token,
                "Accept": "application/json"
            }
        });

        const text = await response.text();
        let payload = null;

        try {
            payload = text ? JSON.parse(text) : null;
        } catch (error) {
            throw new Error("The ARC vault returned an invalid response.");
        }

        if (!response.ok) {
            const message = payload && payload.message
                ? payload.message
                : "The ARC vault returned " + response.status + ".";

            throw new Error(message);
        }

        return Array.isArray(payload) ? payload : [];
    }

    async function requestWatermarkedArcDownload(session, assignmentId) {
        const response = await fetch(BLACKWOOD_WATERMARKED_ARC_FUNCTION_URL, {
            method: "POST",
            headers: {
                "Authorization": "Bearer " + session.access_token,
                "apikey": BLACKWOOD_SUPABASE_PUBLIC_KEY,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                assignmentId: Number(assignmentId),
                assignment_id: Number(assignmentId),
                acceptedTerms: true,
                accepted_terms: true,
                acceptedTermsAt: new Date().toISOString(),
                termsVersion: ARC_TERMS_VERSION,
                terms_version: ARC_TERMS_VERSION,
                userAgent: navigator.userAgent || ""
            })
        });

        const text = await response.text();
        let payload = {};

        try {
            payload = text ? JSON.parse(text) : {};
        } catch (error) {
            throw new Error("The ARC vault returned an invalid response.");
        }

        if (!response.ok) {
            throw new Error(payload.error || payload.message || "The ARC vault returned " + response.status + ".");
        }

        const downloadUrl = payload.downloadUrl || payload.signedUrl || payload.url || "";

        return {
            ...payload,
            ok: payload.ok !== false && Boolean(downloadUrl),
            downloadUrl
        };
    }

    async function requestArcReviewLinkSave(session, assignmentId, reviewLink) {
        const cleanAssignmentId = Number(assignmentId);

        if (!Number.isFinite(cleanAssignmentId) || cleanAssignmentId <= 0) {
            throw new Error("ARC assignment could not be confirmed.");
        }

        return supabaseRestRpc(session, "submit_arc_review_link", {
            p_assignment_id: cleanAssignmentId,
            p_review_link: reviewLink
        });
    }

    async function supabaseRestRpc(session, functionName, payload) {
        const url = BLACKWOOD_SUPABASE_URL + "/rest/v1/rpc/" + functionName;

        const response = await fetch(url, {
            method: "POST",
            headers: {
                "apikey": BLACKWOOD_SUPABASE_PUBLIC_KEY,
                "Authorization": "Bearer " + session.access_token,
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            body: JSON.stringify(payload || {})
        });

        const text = await response.text();
        let result = null;

        try {
            result = text ? JSON.parse(text) : null;
        } catch (error) {
            throw new Error("The ARC vault returned an invalid review-link response.");
        }

        if (!response.ok) {
            const message = result && (result.message || result.error || result.details)
                ? result.message || result.error || result.details
                : "The ARC vault returned " + response.status + ".";

            throw new Error(message);
        }

        return result;
    }

    function triggerWatermarkedArcDownload(downloadUrl) {
        const link = document.createElement("a");

        link.href = downloadUrl;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.download = "";

        document.body.appendChild(link);
        link.click();
        link.remove();
    }

    function renderReadOnlyFields(readOnly) {
        return ARC_READ_ONLY_FIELDS.map(function (field) {
            const rawValue = readOnly[field.key] || "";
            const value = rawValue ? rawValue : "Not recorded";

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

    function setWatermarkedArcMessage(messageElement, text, state) {
        if (!messageElement) {
            return;
        }

        messageElement.textContent = text || "";
        messageElement.className = "arc-current-download-message";

        if (state) {
            messageElement.classList.add("is-" + state);
        }
    }

    function setArcReviewLinkMessage(messageElement, text, state) {
        if (!messageElement) {
            return;
        }

        messageElement.textContent = text || "";
        messageElement.className = "arc-review-link-message";

        if (state) {
            messageElement.classList.add("is-" + state);
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

    function normalizeArcFileRelation(value) {
        if (Array.isArray(value)) {
            return value[0] || {};
        }

        if (value && typeof value === "object") {
            return value;
        }

        return {};
    }

    function getSessionUserId(session) {
        if (session && session.user && session.user.id) {
            return session.user.id;
        }

        const token = session && session.access_token ? session.access_token : "";

        if (!token) {
            return "";
        }

        try {
            const parts = token.split(".");

            if (parts.length < 2) {
                return "";
            }

            const payload = JSON.parse(base64UrlDecode(parts[1]));

            return payload.sub || "";
        } catch (error) {
            return "";
        }
    }

    function base64UrlDecode(value) {
        const base64 = String(value || "")
            .replace(/-/g, "+")
            .replace(/_/g, "/");

        const padded = base64.padEnd(base64.length + ((4 - base64.length % 4) % 4), "=");

        return decodeURIComponent(
            atob(padded)
                .split("")
                .map(function (character) {
                    return "%" + ("00" + character.charCodeAt(0).toString(16)).slice(-2);
                })
                .join("")
        );
    }

    function getArcReviewStatus(assignment) {
        const reviewLink = assignment.review_link || "";
        const reviewDueDate = assignment.review_due_date || "";

        if (reviewLink && looksLikeUrl(reviewLink)) {
            return {
                label: "Review Filed",
                className: "is-review-filed"
            };
        }

        const daysUntilDue = getDaysUntilDate(reviewDueDate);

        if (daysUntilDue === null) {
            return {
                label: "Active",
                className: "is-active"
            };
        }

        if (daysUntilDue < 0) {
            return {
                label: "Overdue",
                className: "is-overdue"
            };
        }

        if (daysUntilDue === 0) {
            return {
                label: "Due Today",
                className: "is-due-today"
            };
        }

        if (daysUntilDue <= 7) {
            return {
                label: "Due Soon",
                className: "is-due-soon"
            };
        }

        return {
            label: "Active",
            className: "is-active"
        };
    }

    function getDaysUntilDate(value) {
        if (!value) {
            return null;
        }

        const dueDate = new Date(value + "T00:00:00");

        if (Number.isNaN(dueDate.getTime())) {
            return null;
        }

        const today = new Date();

        today.setHours(0, 0, 0, 0);
        dueDate.setHours(0, 0, 0, 0);

        const difference = dueDate.getTime() - today.getTime();

        return Math.round(difference / 86400000);
    }

    function formatDateForDisplay(value) {
        if (!value) {
            return "";
        }

        const date = new Date(value + "T00:00:00");

        if (Number.isNaN(date.getTime())) {
            return value;
        }

        return date.toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric"
        });
    }

    function formatDateTimeForDisplay(value) {
        if (!value) {
            return "";
        }

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return value;
        }

        return date.toLocaleString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        });
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
