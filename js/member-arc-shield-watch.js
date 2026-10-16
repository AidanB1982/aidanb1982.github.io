
/* ============================================================
   BLACKWOOD PUBLISHING — ARC SHIELD WATCH ADMIN DESK
   File: /js/member-arc-shield-watch.js

   Private administrator dashboard powered by Supabase RPCs.

   Main desk displays ONLY:
   - Pending Review
   - Notice Prepared
   - Notice Sent

   All other findings remain stored in Supabase.
   No service-role key is used in the browser.
   ============================================================ */

(function () {
    "use strict";

    if (window.__BLACKWOOD_ARC_SHIELD_WATCH_LOADED__) {
        return;
    }

    window.__BLACKWOOD_ARC_SHIELD_WATCH_LOADED__ = true;

    // All statuses remain available for administrator review.
    const STATUSES = [
        ["pending_review", "Pending Review"],
        ["confirmed_infringement", "Confirmed Infringement"],
        ["false_positive", "False Positive"],
        ["notice_prepared", "Notice Prepared"],
        ["notice_sent", "Notice Sent"],
        ["removed", "Removed"],
        ["closed", "Closed"]
    ];

    // Only these statuses appear in the active desk.
    const ACTIVE_STATUSES = [
        "pending_review",
        "notice_prepared",
        "notice_sent"
    ];

    const FILTERS = [
        ["all", "All Active"],
        ["pending_review", "Pending Review"],
        ["notice_prepared", "Notice Prepared"],
        ["notice_sent", "Notice Sent"]
    ];

    const state = {
        client: null,
        root: null,
        loaded: false,
        busy: false,
        filter: "all",
        data: {
            titles: [],
            findings: [],
            counts: {}
        }
    };

    // ========================================================
    // HELPERS
    // ========================================================

    function escapeHtml(value) {
        return String(value == null ? "" : value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function formatDate(value) {
        if (!value) {
            return "Not recorded";
        }

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return String(value);
        }

        return date.toLocaleString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        });
    }

    function labelStatus(value) {
        const match = STATUSES.find(function (entry) {
            return entry[0] === value;
        });

        return match ? match[1] : String(value || "Unknown");
    }

    function safeUrl(value) {
        try {
            const url = new URL(String(value || ""));

            if (
                url.protocol === "https:" ||
                url.protocol === "http:"
            ) {
                return url.href;
            }

            return "";
        } catch (error) {
            return "";
        }
    }

    function getFindingId(finding) {
        return String(
            finding.id == null ? "" : finding.id
        );
    }

    function getFindingUrl(finding) {
        return safeUrl(
            finding.url ||
            finding.result_url ||
            finding.found_url ||
            finding.page_url ||
            finding.source_url ||
            ""
        );
    }

    function getFindingTitle(finding) {
        return String(
            finding.page_title ||
            finding.result_title ||
            finding.title ||
            finding.matched_title ||
            "Search finding"
        );
    }

    function getFindingNotes(finding) {
        return String(
            finding.notes ||
            finding.admin_notes ||
            ""
        );
    }

    function getFindingStatus(finding) {
        return String(
            finding.status || "pending_review"
        ).trim().toLowerCase();
    }

    function isActiveFinding(finding) {
        return ACTIVE_STATUSES.includes(
            getFindingStatus(finding)
        );
    }

    function getActiveFindings() {
        return state.data.findings.filter(
            isActiveFinding
        );
    }

    function getCount(status) {
        const serverCount = state.data.counts[status];

        if (serverCount != null) {
            return Number(serverCount) || 0;
        }

        return state.data.findings.filter(function (finding) {
            return getFindingStatus(finding) === status;
        }).length;
    }

    function getTotalActiveCount() {
        return ACTIVE_STATUSES.reduce(function (total, status) {
            return total + getCount(status);
        }, 0);
    }

    function setMessage(message, type) {
        const element = state.root
            ? state.root.querySelector(
                "[data-shield-message]"
            )
            : null;

        if (!element) {
            return;
        }

        element.textContent = message || "";
        element.dataset.type = type || "";
    }

    // ========================================================
    // ACTIVE MONITORING SUMMARY
    // ========================================================

    function renderSummary() {
        return `
            <div class="shield-stats">
                <article>
                    <span>Monitored Titles</span>
                    <strong>
                        ${state.data.titles.length}
                    </strong>
                </article>

                <article>
                    <span>Pending Review</span>
                    <strong>
                        ${getCount("pending_review")}
                    </strong>
                </article>

                <article>
                    <span>Notice Prepared</span>
                    <strong>
                        ${getCount("notice_prepared")}
                    </strong>
                </article>

                <article>
                    <span>Notice Sent</span>
                    <strong>
                        ${getCount("notice_sent")}
                    </strong>
                </article>
            </div>
        `;
    }

    // ========================================================
    // MONITORED TITLES
    // ========================================================

    function renderTitles() {
        const titles = state.data.titles;

        if (!titles.length) {
            return `
                <p class="shield-muted">
                    No monitored titles were returned.
                </p>
            `;
        }

        return `
            <div class="shield-titles">
                ${titles.map(function (title) {
                    const name =
                        title.title ||
                        title.book_title ||
                        title.name ||
                        "Untitled";

                    const author =
                        title.author_name ||
                        title.author ||
                        "";

                    const enabled = title.is_active != null
                        ? title.is_active
                        : title.enabled;

                    return `
                        <article class="shield-title-card">
                            <div>
                                <strong>
                                    ${escapeHtml(name)}
                                </strong>

                                ${
                                    author
                                        ? `
                                            <small>
                                                ${escapeHtml(author)}
                                            </small>
                                        `
                                        : ""
                                }
                            </div>

                            <span class="shield-tag">
                                ${
                                    enabled === false
                                        ? "Paused"
                                        : "Monitored"
                                }
                            </span>
                        </article>
                    `;
                }).join("")}
            </div>
        `;
    }

    // ========================================================
    // ACTIVE FILTERS
    // ========================================================

    function renderFilters() {
        return `
            <div
                class="shield-filters"
                aria-label="Filter active findings"
            >
                ${FILTERS.map(function (option) {
                    const value = option[0];
                    const label = option[1];

                    const count = value === "all"
                        ? getTotalActiveCount()
                        : getCount(value);

                    const isActive =
                        state.filter === value;

                    return `
                        <button
                            type="button"
                            data-shield-filter="${escapeHtml(value)}"
                            aria-pressed="${isActive}"
                            class="${isActive ? "is-active" : ""}"
                        >
                            ${escapeHtml(label)}
                            <span>${count}</span>
                        </button>
                    `;
                }).join("")}
            </div>
        `;
    }

    // ========================================================
    // FINDING CARDS
    // ========================================================

    function renderFinding(finding) {
        const id = getFindingId(finding);
        const status = getFindingStatus(finding);
        const url = getFindingUrl(finding);
        const title = getFindingTitle(finding);

        const snippet =
            finding.snippet ||
            finding.description ||
            finding.search_snippet ||
            "";

        const lastDetected =
            finding.last_detected_at ||
            finding.detected_at ||
            finding.created_at;

        return `
            <article
                class="shield-finding"
                data-shield-finding="${escapeHtml(id)}"
            >
                <div class="shield-finding-header">
                    <div>
                        <p class="shield-kicker">
                            Finding #${escapeHtml(id)}
                        </p>

                        <h4>
                            ${escapeHtml(title)}
                        </h4>

                        <small>
                            Last detected:
                            ${escapeHtml(formatDate(lastDetected))}
                        </small>
                    </div>

                    <span class="shield-tag">
                        ${escapeHtml(labelStatus(status))}
                    </span>
                </div>

                ${
                    url
                        ? `
                            <p>
                                <a
                                    href="${escapeHtml(url)}"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    class="shield-url"
                                >
                                    ${escapeHtml(url)}
                                </a>
                            </p>
                        `
                        : `
                            <p class="shield-muted">
                                No result URL available.
                            </p>
                        `
                }

                ${
                    snippet
                        ? `
                            <p class="shield-snippet">
                                ${escapeHtml(snippet)}
                            </p>
                        `
                        : ""
                }

                <form
                    data-shield-review-form="${escapeHtml(id)}"
                >
                    <div class="shield-form-grid">
                        <label>
                            Review status

                            <select
                                name="status"
                                required
                            >
                                ${STATUSES.map(function (option) {
                                    return `
                                        <option
                                            value="${escapeHtml(option[0])}"
                                            ${
                                                option[0] === status
                                                    ? "selected"
                                                    : ""
                                            }
                                        >
                                            ${escapeHtml(option[1])}
                                        </option>
                                    `;
                                }).join("")}
                            </select>
                        </label>

                        <label>
                            Private administrator notes

                            <textarea
                                name="notes"
                                rows="3"
                                maxlength="10000"
                                placeholder="Record evidence, decisions or takedown progress..."
                            >${escapeHtml(getFindingNotes(finding))}</textarea>
                        </label>
                    </div>

                    <button
                        type="submit"
                        class="circle-button circle-button-primary"
                    >
                        Save Review
                    </button>
                </form>
            </article>
        `;
    }

    // ========================================================
    // ACTIVE FINDINGS ONLY
    // ========================================================

    function renderFindings() {
        const findings = getActiveFindings().filter(
            function (finding) {
                return (
                    state.filter === "all" ||
                    getFindingStatus(finding) === state.filter
                );
            }
        );

        if (!findings.length) {
            if (getTotalActiveCount() === 0) {
                return `
                    <article class="shield-empty">
                        <p>
                            <strong>All clear.</strong>
                        </p>

                        <p>
                            No findings currently require
                            administrative attention.
                            ARC Shield Watch continues monitoring
                            in the background.
                        </p>
                    </article>
                `;
            }

            return `
                <article class="shield-empty">
                    <p>
                        No active findings match this filter.
                    </p>
                </article>
            `;
        }

        return `
            <div class="shield-findings">
                ${findings.map(renderFinding).join("")}
            </div>
        `;
    }

    // ========================================================
    // MAIN DASHBOARD CONTENT
    // ========================================================

    function renderContent() {
        if (!state.root) {
            return;
        }

        const content = state.root.querySelector(
            "[data-shield-content]"
        );

        if (!content) {
            return;
        }

        content.innerHTML = `
            ${renderSummary()}

            <section class="shield-block">
                <h3>Monitored Titles</h3>

                ${renderTitles()}
            </section>

            <section class="shield-block">
                <div class="shield-section-heading">
                    <div>
                        <h3>Findings Requiring Attention</h3>

                        <p>
                            Only pending reviews and active
                            takedown notices appear here.
                        </p>
                    </div>

                    <button
                        type="button"
                        class="circle-button circle-button-secondary"
                        data-shield-refresh
                    >
                        Refresh Findings
                    </button>
                </div>

                ${renderFilters()}

                ${renderFindings()}
            </section>
        `;

        bindContentEvents();
    }

    // ========================================================
    // LOAD MONITORING DATA
    // ========================================================

    async function loadDashboard() {
        if (
            state.busy ||
            !state.client ||
            !state.root
        ) {
            return;
        }

        state.busy = true;

        setMessage(
            "Retrieving ARC Shield Watch records...",
            "loading"
        );

        try {
            const { data, error } = await state.client.rpc(
                "get_arc_watch_admin_dashboard"
            );

            if (error) {
                throw error;
            }

            if (!data || data.success !== true) {
                throw new Error(
                    "ARC Shield Watch returned an unexpected response."
                );
            }

            state.data = {
                titles: Array.isArray(data.titles)
                    ? data.titles
                    : [],

                findings: Array.isArray(data.findings)
                    ? data.findings
                    : [],

                counts:
                    data.counts &&
                    typeof data.counts === "object"
                        ? data.counts
                        : {}
            };

            state.loaded = true;

            renderContent();

            const activeCount = getTotalActiveCount();

            const loadedActiveCount =
                getActiveFindings().length;

            if (activeCount > loadedActiveCount) {
                setMessage(
                    `${activeCount} active findings exist. ` +
                    `Showing ${loadedActiveCount} from the latest ` +
                    `${state.data.findings.length} loaded records.`,
                    "success"
                );
            } else if (activeCount === 0) {
                setMessage(
                    "All clear. No findings currently require attention.",
                    "success"
                );
            } else {
                setMessage(
                    `${activeCount} finding${activeCount === 1 ? "" : "s"} ` +
                    `require attention.`,
                    "success"
                );
            }

        } catch (error) {
            console.error(
                "ARC Shield Watch load failed:",
                error
            );

            setMessage(
                error && error.message
                    ? error.message
                    : "The monitoring records could not be loaded.",
                "error"
            );

        } finally {
            state.busy = false;
        }
    }

    // ========================================================
    // SAVE ADMINISTRATOR REVIEW
    // ========================================================

    async function saveReview(event) {
        event.preventDefault();

        if (
            state.busy ||
            !state.client
        ) {
            return;
        }

        const form = event.currentTarget;

        const id = String(
            form.dataset.shieldReviewForm || ""
        );

        const statusField =
            form.elements.namedItem("status");

        const notesField =
            form.elements.namedItem("notes");

        const button = form.querySelector(
            'button[type="submit"]'
        );

        if (!/^\d+$/.test(id)) {
            setMessage(
                "Invalid finding ID.",
                "error"
            );
            return;
        }

        if (!statusField || !notesField) {
            setMessage(
                "The review form is incomplete.",
                "error"
            );
            return;
        }

        const status = statusField.value;
        const notes = notesField.value;

        if (!STATUSES.some(function (option) {
            return option[0] === status;
        })) {
            setMessage(
                "Choose a valid review status.",
                "error"
            );
            return;
        }

        if (notes.length > 10000) {
            setMessage(
                "Notes cannot exceed 10,000 characters.",
                "error"
            );
            return;
        }

        state.busy = true;

        if (button) {
            button.disabled = true;
            button.textContent = "Saving...";
        }

        setMessage(
            `Saving finding #${id}...`,
            "loading"
        );

        try {
            const { data, error } = await state.client.rpc(
                "admin_update_arc_watch_finding",
                {
                    p_finding_id: id,
                    p_status: status,
                    p_notes: notes
                }
            );

            if (error) {
                throw error;
            }

            if (!data || data.success !== true) {
                throw new Error(
                    "The review could not be confirmed."
                );
            }

            // Release the busy flag before refreshing.
            state.busy = false;

            await loadDashboard();

        } catch (error) {
            console.error(
                "ARC Shield Watch review failed:",
                error
            );

            setMessage(
                error && error.message
                    ? error.message
                    : "The review could not be saved.",
                "error"
            );

        } finally {
            state.busy = false;

            if (button && button.isConnected) {
                button.disabled = false;
                button.textContent = "Save Review";
            }
        }
    }

    // ========================================================
    // EVENT BINDINGS
    // ========================================================

    function bindContentEvents() {
        if (!state.root) {
            return;
        }

        state.root.querySelectorAll(
            "[data-shield-filter]"
        ).forEach(function (button) {
            button.addEventListener("click", function () {
                const nextFilter =
                    button.dataset.shieldFilter || "all";

                const allowed = FILTERS.some(
                    function (filter) {
                        return filter[0] === nextFilter;
                    }
                );

                state.filter = allowed
                    ? nextFilter
                    : "all";

                renderContent();
            });
        });

        state.root.querySelectorAll(
            "[data-shield-review-form]"
        ).forEach(function (form) {
            form.addEventListener(
                "submit",
                saveReview
            );
        });

        const refreshButton = state.root.querySelector(
            "[data-shield-refresh]"
        );

        if (refreshButton) {
            refreshButton.addEventListener(
                "click",
                loadDashboard
            );
        }
    }

    // ========================================================
    // PUBLIC INITIALISER
    // Called by /js/members.js for administrators only.
    // ========================================================

    window.initBlackwoodArcShieldWatch = function (options) {
        const root = options && options.root;
        const client = options && options.client;

        if (
            !root ||
            !client ||
            typeof client.rpc !== "function"
        ) {
            console.warn(
                "ARC Shield Watch: missing root or Supabase client."
            );
            return;
        }

        state.root = root;
        state.client = client;
        state.loaded = false;
        state.busy = false;
        state.filter = "all";

        state.data = {
            titles: [],
            findings: [],
            counts: {}
        };

        root.innerHTML = `
            <details
                class="shield-desk"
                data-shield-details
            >
                <summary class="shield-summary">
                    <div>
                        <p class="shield-kicker">
                            Admin Only · Private Monitoring
                        </p>

                        <h2>ARC Shield Watch</h2>

                        <p>
                            Monitor search findings,
                            review potential infringements,
                            and maintain the private evidence record.
                        </p>
                    </div>

                    <span
                        class="shield-summary-indicator"
                        aria-hidden="true"
                    >
                        ↓
                    </span>
                </summary>

                <div class="shield-panel">
                    <p
                        class="shield-message"
                        data-shield-message
                        role="status"
                        aria-live="polite"
                    ></p>

                    <div data-shield-content>
                        <p class="shield-muted">
                            Open this desk to retrieve
                            the latest monitoring records.
                        </p>
                    </div>
                </div>
            </details>
        `;

        const details = root.querySelector(
            "[data-shield-details]"
        );

        if (!details) {
            return;
        }

        details.addEventListener(
            "toggle",
            function () {
                if (
                    details.open &&
                    !state.loaded
                ) {
                    loadDashboard();
                }
            }
        );
    };

})();
