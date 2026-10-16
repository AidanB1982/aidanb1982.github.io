
/* ============================================================
   BLACKWOOD PUBLISHING — ARC SHIELD WATCH ADMIN DESK
   File: /js/member-arc-shield-watch.js

   Uses existing Supabase RPC functions.
   Never uses a service-role key.
   ============================================================ */

(function () {
    "use strict";

    if (window.__BLACKWOOD_ARC_SHIELD_WATCH_LOADED__) return;
    window.__BLACKWOOD_ARC_SHIELD_WATCH_LOADED__ = true;

    const STATUSES = [
        ["pending_review", "Pending Review"],
        ["confirmed_infringement", "Confirmed Infringement"],
        ["false_positive", "False Positive"],
        ["notice_prepared", "Notice Prepared"],
        ["notice_sent", "Notice Sent"],
        ["removed", "Removed"],
        ["closed", "Closed"]
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

    function escapeHtml(value) {
        return String(value == null ? "" : value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function formatDate(value) {
        if (!value) return "Not recorded";

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

            return ["http:", "https:"].includes(url.protocol)
                ? url.href
                : "";
        } catch (error) {
            return "";
        }
    }

    function getFindingId(finding) {
        return String(finding.id == null ? "" : finding.id);
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
        return String(finding.status || "pending_review");
    }

    function getCount(status) {
        const count = state.data.counts[status];

        if (count != null) return Number(count) || 0;

        return state.data.findings.filter(function (finding) {
            return getFindingStatus(finding) === status;
        }).length;
    }

    function setMessage(message, type) {
        const element = state.root
            ? state.root.querySelector("[data-shield-message]")
            : null;

        if (!element) return;

        element.textContent = message || "";
        element.dataset.type = type || "";
    }

    function renderSummary() {
        const counts = state.data.counts || {};
        const titles = state.data.titles || [];

        const titleCount = titles.length;
        const findingCount = counts.total != null
            ? Number(counts.total) || 0
            : state.data.findings.length;

        return `
            <div class="shield-stats">
                <article>
                    <span>Monitored Titles</span>
                    <strong>${titleCount}</strong>
                </article>
                <article>
                    <span>Total Findings</span>
                    <strong>${findingCount}</strong>
                </article>
                <article>
                    <span>Pending Review</span>
                    <strong>${getCount("pending_review")}</strong>
                </article>
                <article>
                    <span>Confirmed</span>
                    <strong>${getCount("confirmed_infringement")}</strong>
                </article>
            </div>
        `;
    }

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
                    const name = title.title ||
                        title.book_title ||
                        title.name ||
                        "Untitled";

                    const author = title.author_name ||
                        title.author ||
                        "";

                    const enabled = title.is_active != null
                        ? title.is_active
                        : title.enabled;

                    return `
                        <article class="shield-title-card">
                            <div>
                                <strong>${escapeHtml(name)}</strong>
                                ${author
                                    ? `<small>${escapeHtml(author)}</small>`
                                    : ""}
                            </div>
                            <span class="shield-tag">
                                ${enabled === false
                                    ? "Paused"
                                    : "Monitored"}
                            </span>
                        </article>
                    `;
                }).join("")}
            </div>
        `;
    }

    function renderFilters() {
        const options = [
            ["all", "All"],
            ...STATUSES
        ];

        return `
            <div class="shield-filters" aria-label="Filter findings">
                ${options.map(function (option) {
                    const value = option[0];
                    const label = option[1];
                    const count = value === "all"
                        ? (Number(state.data.counts.total) ||
                            state.data.findings.length)
                        : getCount(value);

                    return `
                        <button
                            type="button"
                            data-shield-filter="${escapeHtml(value)}"
                            aria-pressed="${state.filter === value}"
                            class="${state.filter === value ? "is-active" : ""}"
                        >
                            ${escapeHtml(label)}
                            <span>${count}</span>
                        </button>
                    `;
                }).join("")}
            </div>
        `;
    }

    function renderFinding(finding) {
        const id = getFindingId(finding);
        const status = getFindingStatus(finding);
        const url = getFindingUrl(finding);
        const title = getFindingTitle(finding);

        const snippet = finding.snippet ||
            finding.description ||
            finding.search_snippet ||
            "";

        const lastDetected = finding.last_detected_at ||
            finding.detected_at ||
            finding.created_at;

        return `
            <article class="shield-finding" data-shield-finding="${escapeHtml(id)}">
                <div class="shield-finding-header">
                    <div>
                        <p class="shield-kicker">
                            Finding #${escapeHtml(id)}
                        </p>
                        <h4>${escapeHtml(title)}</h4>
                        <small>
                            Last detected: ${escapeHtml(formatDate(lastDetected))}
                        </small>
                    </div>
                    <span class="shield-tag">
                        ${escapeHtml(labelStatus(status))}
                    </span>
                </div>

                ${url
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
                    `}

                ${snippet
                    ? `<p class="shield-snippet">${escapeHtml(snippet)}</p>`
                    : ""}

                <form data-shield-review-form="${escapeHtml(id)}">
                    <div class="shield-form-grid">
                        <label>
                            Review status
                            <select name="status" required>
                                ${STATUSES.map(function (option) {
                                    return `
                                        <option
                                            value="${escapeHtml(option[0])}"
                                            ${option[0] === status ? "selected" : ""}
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

    function renderFindings() {
        const findings = state.data.findings.filter(function (finding) {
            return state.filter === "all" ||
                getFindingStatus(finding) === state.filter;
        });

        if (!findings.length) {
            return `
                <article class="shield-empty">
                    <p>No findings match this filter.</p>
                </article>
            `;
        }

        return `
            <div class="shield-findings">
                ${findings.map(renderFinding).join("")}
            </div>
        `;
    }

    function renderContent() {
        const content = state.root.querySelector("[data-shield-content]");

        if (!content) return;

        content.innerHTML = `
            ${renderSummary()}

            <section class="shield-block">
                <h3>Monitored Titles</h3>
                ${renderTitles()}
            </section>

            <section class="shield-block">
                <div class="shield-section-heading">
                    <div>
                        <h3>Finding Review</h3>
                        <p>Review suspicious results and maintain the evidence record.</p>
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

    async function loadDashboard() {
        if (state.busy || !state.client || !state.root) return;

        state.busy = true;
        setMessage("Retrieving ARC Shield Watch records...", "loading");

        try {
            const result = await state.client.rpc(
                "get_arc_watch_admin_dashboard"
            );

            if (result.error) throw result.error;

            const data = result.data || {};

            if (data.success !== true) {
                throw new Error("ARC Shield Watch returned an unexpected response.");
            }

            state.data = {
                titles: Array.isArray(data.titles) ? data.titles : [],
                findings: Array.isArray(data.findings) ? data.findings : [],
                counts: data.counts && typeof data.counts === "object"
                    ? data.counts
                    : {}
            };

            state.loaded = true;
            renderContent();

            const limit = Number(data.findings_limit || 500);
            const total = Number(state.data.counts.total || 0);

            setMessage(
                total > state.data.findings.length
                    ? `Showing the latest ${state.data.findings.length} of ${total} findings.`
                    : "ARC Shield Watch records loaded.",
                "success"
            );

        } catch (error) {
            console.error("ARC Shield Watch load failed:", error);

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

    async function saveReview(event) {
        event.preventDefault();

        if (state.busy || !state.client) return;

        const form = event.currentTarget;
        const id = form.dataset.shieldReviewForm;
        const status = form.elements.status.value;
        const notes = form.elements.notes.value;
        const button = form.querySelector('button[type="submit"]');

        if (!/^\d+$/.test(id)) {
            setMessage("Invalid finding ID.", "error");
            return;
        }

        if (!STATUSES.some(function (option) {
            return option[0] === status;
        })) {
            setMessage("Choose a valid review status.", "error");
            return;
        }

        if (notes.length > 10000) {
            setMessage("Notes cannot exceed 10,000 characters.", "error");
            return;
        }

        state.busy = true;
        if (button) {
            button.disabled = true;
            button.textContent = "Saving...";
        }

        setMessage(`Saving finding #${id}...`, "loading");

        try {
            const result = await state.client.rpc(
                "admin_update_arc_watch_finding",
                {
                    p_finding_id: id,
                    p_status: status,
                    p_notes: notes
                }
            );

            if (result.error) throw result.error;

            if (!result.data || result.data.success !== true) {
                throw new Error("The review could not be confirmed.");
            }

            setMessage(`Finding #${id} saved successfully.`, "success");

            state.busy = false;
            await loadDashboard();

        } catch (error) {
            console.error("ARC Shield Watch review failed:", error);

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

    function bindContentEvents() {
        state.root.querySelectorAll("[data-shield-filter]")
            .forEach(function (button) {
                button.addEventListener("click", function () {
                    state.filter = button.dataset.shieldFilter || "all";
                    renderContent();
                });
            });

        state.root.querySelectorAll("[data-shield-review-form]")
            .forEach(function (form) {
                form.addEventListener("submit", saveReview);
            });

        const refresh = state.root.querySelector("[data-shield-refresh]");

        if (refresh) {
            refresh.addEventListener("click", loadDashboard);
        }
    }

    window.initBlackwoodArcShieldWatch = function (options) {
        const root = options && options.root;
        const client = options && options.client;

        if (!root || !client || typeof client.rpc !== "function") {
            console.warn("ARC Shield Watch: missing root or Supabase client.");
            return;
        }

        state.root = root;
        state.client = client;
        state.loaded = false;
        state.busy = false;
        state.filter = "all";

        root.innerHTML = `
            <details class="shield-desk" data-shield-details>
                <summary class="shield-summary">
                    <div>
                        <p class="shield-kicker">Admin Only · Private Monitoring</p>
                        <h2>ARC Shield Watch</h2>
                        <p>
                            Monitor search findings, review potential infringements,
                            and maintain the private evidence record.
                        </p>
                    </div>
                    <span class="shield-summary-indicator" aria-hidden="true">↓</span>
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
                            Open this desk to retrieve the latest monitoring records.
                        </p>
                    </div>
                </div>
            </details>
        `;

        const details = root.querySelector("[data-shield-details]");

        details.addEventListener("toggle", function () {
            if (details.open && !state.loaded) {
                loadDashboard();
            }
        });
    };
})();
