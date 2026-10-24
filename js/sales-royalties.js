
"use strict";

// ==========================================
// BLACKWOOD PUBLISHING
// DEPARTMENT 03 — SALES & ROYALTIES
// ==========================================

(function () {
    const URL = "https://bmnlynjldlnxfvunqbqq.supabase.co";
    const KEY = "sb_publishable_eL7qdDe_6XWGhzmdsql_7w_7dg6psC0";
    const CDN = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";

    const CATEGORIES = [
        "cover_design", "editing", "proofreading", "formatting",
        "isbn", "printing", "postage", "advertising", "marketing",
        "software", "subscriptions", "website",
        "professional_fees", "other"
    ];

    const CURRENCIES = [
        "GBP", "USD", "EUR", "CAD", "AUD", "INR", "SEK"
    ];

    const MONTHS = [
        "Apr", "May", "Jun", "Jul", "Aug", "Sep",
        "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"
    ];

    let db = null;
    let accessVersion = 0;
    let loaded = false;

    const data = {
        titles: [],
        editions: [],
        royalties: [],
        pages: [],
        batches: [],
        lines: [],
        links: [],
        expenses: [],
        budgets: [],
        targets: []
    };

    const $ = id => document.getElementById(id);

    const number = value => Number(value) || 0;

    function escapeHtml(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function money(value, currency = "GBP") {
        return new Intl.NumberFormat("en-GB", {
            style: "currency",
            currency,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(number(value));
    }

    function integer(value) {
        return new Intl.NumberFormat("en-GB", {
            maximumFractionDigits: 0
        }).format(number(value));
    }

    function decimal(value) {
        return new Intl.NumberFormat("en-GB", {
            maximumFractionDigits: 2
        }).format(number(value));
    }

    function dateOnly(date) {
        return [
            date.getFullYear(),
            String(date.getMonth() + 1).padStart(2, "0"),
            String(date.getDate()).padStart(2, "0")
        ].join("-");
    }

    function fyStart(dateString) {
        const year = Number(dateString.slice(0, 4));
        const month = Number(dateString.slice(5, 7));
        return month >= 4 ? year : year - 1;
    }

    function fyRange(startYear) {
        return {
            start: `${startYear}-04-01`,
            end: `${startYear + 1}-03-31`
        };
    }

    function labelFY(startYear) {
        return `${startYear}/${String(startYear + 1).slice(-2)}`;
    }

    function selectedRange() {
        const year = Number($("sr-year").value);
        const month = $("sr-month").value;

        if (month === "all") {
            return fyRange(year);
        }

        const monthNumber = Number(month);
        const calendarYear = monthNumber >= 4 ? year : year + 1;
        const start = `${calendarYear}-${String(monthNumber).padStart(2, "0")}-01`;
        const endDate = new Date(calendarYear, monthNumber, 0);

        return { start, end: dateOnly(endDate) };
    }

    function inRange(date, range) {
        return Boolean(
            date && date >= range.start && date <= range.end
        );
    }

    function overlaps(start, end, range) {
        return Boolean(
            start && end &&
            start <= range.end &&
            end >= range.start
        );
    }

    function currency() {
        return $("sr-currency").value;
    }

    function selectedTitle() {
        return $("sr-title-filter").value;
    }

    function selectedFormat() {
        return $("sr-format").value;
    }

    function sum(rows, key) {
        return rows.reduce((total, row) => total + number(row[key]), 0);
    }

    function titleMap() {
        return new Map(data.titles.map(row => [row.id, row]));
    }

    function editionMap() {
        return new Map(data.editions.map(row => [row.id, row]));
    }

    function titleName(id) {
        if (!id) return "Business-wide";
        return titleMap().get(id)?.title || "Unknown book";
    }

    function royaltyTitle(row) {
        return editionMap().get(row.edition_id)?.title_id || null;
    }

    function matchesRoyaltyScope(row) {
        const title = selectedTitle();
        const format = selectedFormat();

        if (title !== "all" && royaltyTitle(row) !== title) {
            return false;
        }

        if (format !== "all" && row.format !== format) {
            return false;
        }

        return true;
    }

    function matchesPageScope(row) {
        const title = selectedTitle();
        const edition = editionMap().get(row.edition_id);

        if (title !== "all" && edition?.title_id !== title) {
            return false;
        }

        return selectedFormat() === "all" ||
            selectedFormat() === "ebook";
    }

    function matchesExpenseScope(row) {
        const title = selectedTitle();

        if (title !== "all" && row.title_id !== title) {
            return false;
        }

        // Business-wide costs are not attributed to a specific format.
        return selectedFormat() === "all";
    }

    function status(message) {
        $("sr-status").textContent = message;
    }

    function lock() {
        $("sr-admin-content").hidden = true;
        $("sr-access-screen").hidden = false;
        loaded = false;
    }

    function unlock() {
        $("sr-admin-content").hidden = false;
        $("sr-access-screen").hidden = true;
    }

    function accessMessage(message) {
        $("sr-access-message").textContent = message;
    }

    async function loadLibrary() {
        if (window.supabase?.createClient) return;

        await new Promise((resolve, reject) => {
            const script = document.createElement("script");
            script.src = CDN;
            script.onload = resolve;
            script.onerror = () => reject(
                new Error("Supabase library could not be loaded.")
            );
            document.head.appendChild(script);
        });
    }

    async function verifyAccess() {
        const version = ++accessVersion;
        lock();
        accessMessage("Checking administrator permissions...");

        try {
            const userResult = await db.auth.getUser();

            if (version !== accessVersion) return;

            if (userResult.error || !userResult.data.user) {
                accessMessage("Please sign in through The Archivists.");
                return;
            }

            const profile = await db
                .from("member_profiles")
                .select("is_admin")
                .eq("id", userResult.data.user.id)
                .maybeSingle();

            if (version !== accessVersion) return;
            if (profile.error) throw profile.error;

            const isAdmin =
                profile.data?.is_admin === true ||
                String(profile.data?.is_admin).toLowerCase() === "true";

            if (!isAdmin) {
                accessMessage(
                    "Access denied. Blackwood management only."
                );
                return;
            }

            unlock();
            await refresh(version);

        } catch (error) {
            if (version !== accessVersion) return;
            console.error("Department 03 access error:", error);
            lock();
            accessMessage("Unable to verify management access.");
        }
    }

    // Fetch every page rather than silently stopping
    // at Supabase's default 1,000-row response limit.
    async function fetchAll(table, columns, version) {
        const results = [];
        const pageSize = 500;
        let offset = 0;

        while (true) {
            if (version !== accessVersion) {
                throw new Error("Access changed while loading.");
            }

            const response = await db
                .from(table)
                .select(columns)
                .order("id", { ascending: true })
                .range(offset, offset + pageSize - 1);

            if (response.error) throw response.error;

            const rows = response.data || [];
            results.push(...rows);

            if (rows.length < pageSize) break;

            offset += pageSize;
        }

        return results;
    }

    async function refresh(version = accessVersion) {
        status("Loading live Blackwood financial records...");

        try {
            const specs = [
                ["titles", "publishing_titles", "id,title,author_name"],
                ["editions", "publishing_editions", "id,title_id,format,isbn,asin"],
                ["royalties", "publishing_kdp_royalties",
                    "id,edition_id,format,royalty_month,units_sold,units_refunded,net_units_sold,royalty_amount,currency"],
                ["pages", "publishing_kdp_page_reads",
                    "id,edition_id,reading_month,pages_read,pages_listened,total_pages,estimated_royalty_gbp"],
                ["batches", "sales_report_batches",
                    "id,platform,report_name,period_start,period_end,currency"],
                ["lines", "sales_report_lines",
                    "id,batch_id,reporting_month,net_quantity,gross_quantity,returned_quantity,reversed_quantity,orders_count,net_compensation,payment_received_date,payment_amount,order_date,product_title"],
                ["links", "sales_product_links",
                    "id,sales_line_id,edition_id,title_id"],
                ["expenses", "publishing_expenses",
                    "id,expense_date,category,description,amount,currency,title_id,edition_id,supplier,notes,created_at"],
                ["budgets", "publishing_budgets",
                    "id,period_start,period_end,category,budget_amount,currency,title_id,notes,created_at"],
                ["targets", "publishing_targets",
                    "id,period_start,period_end,metric,target_value,currency,title_id,format,notes,created_at"]
            ];

            // Sequential loading keeps error messages specific
            // and avoids unnecessary simultaneous database requests.
            for (const [key, table, columns] of specs) {
                data[key] = await fetchAll(table, columns, version);
            }

            if (version !== accessVersion) return;

            loaded = true;
            populateFilters();
            render();

            status(
                `Live data loaded: ${integer(data.royalties.length)} ` +
                `KDP royalty rows, ${integer(data.pages.length)} ` +
                `Kindle+ rows and ${integer(data.expenses.length)} expenses.`
            );

        } catch (error) {
    if (version !== accessVersion) return;

    console.error("Department 03 load error:", error);

    loaded = false;

    const details = [
        error?.message,
        error?.details,
        error?.hint,
        error?.code
    ].filter(Boolean).join(" | ");

    status(
        "Financial data loading error: " +
        (details || "Unknown error. Check the browser console.")
    );

    clearOutputs();
}
    }

    function clearOutputs() {
        document.querySelectorAll(
            '[id^="sr-kpi-"]'
        ).forEach(element => {
            element.textContent = "—";
        });

        [
            "sr-monthly-chart", "sr-format-chart",
            "sr-top-books", "sr-platform-summary",
            "sr-financial-years", "sr-expense-list",
            "sr-budget-list", "sr-target-list",
            "sr-profit-list"
        ].forEach(id => {
            $(id).replaceChildren();
        });
    }

    function populateFilters() {
        const yearSelect = $("sr-year");
        const current = yearSelect.value;
        const now = new Date();
        const thisFY = fyStart(dateOnly(now));

        const dates = [
            ...data.royalties.map(row => row.royalty_month),
            ...data.pages.map(row => row.reading_month),
            ...data.lines.map(row => row.reporting_month),
            ...data.expenses.map(row => row.expense_date)
        ].filter(Boolean);

        const earliest = dates.length
            ? Math.min(...dates.map(fyStart))
            : thisFY;

        const latest = Math.max(
            thisFY,
            ...dates.map(fyStart)
        );

        yearSelect.replaceChildren();

        for (let year = latest; year >= earliest; year--) {
            const option = new Option(labelFY(year), String(year));
            yearSelect.add(option);
        }

        yearSelect.value = [...yearSelect.options]
            .some(option => option.value === current)
            ? current
            : String(latest);

        const currencies = new Set([
            ...CURRENCIES,
            ...data.royalties.map(row => row.currency),
            ...data.batches.map(row => row.currency),
            ...data.expenses.map(row => row.currency)
        ]);

        const currencySelect = $("sr-currency");
        const previousCurrency = currencySelect.value || "GBP";

        currencySelect.replaceChildren();

        [...currencies].sort().forEach(code => {
            currencySelect.add(new Option(code, code));
        });

        currencySelect.value = currencies.has(previousCurrency)
            ? previousCurrency
            : "GBP";

        const titleSelect = $("sr-title-filter");
        const oldTitle = titleSelect.value || "all";

        titleSelect.replaceChildren(new Option("All books", "all"));

        [...data.titles]
            .sort((a, b) => a.title.localeCompare(b.title))
            .forEach(book => {
                titleSelect.add(new Option(book.title, book.id));
            });

        titleSelect.value = [...titleSelect.options]
            .some(option => option.value === oldTitle)
            ? oldTitle
            : "all";

        ["sr-expense-title", "sr-budget-title", "sr-target-title"]
            .forEach(id => {
                const select = $(id);
                const oldValue = select.value;

                while (select.options.length > 1) {
                    select.remove(1);
                }

                [...data.titles]
                    .sort((a, b) => a.title.localeCompare(b.title))
                    .forEach(book => {
                        select.add(new Option(book.title, book.id));
                    });

                if ([...select.options]
                    .some(option => option.value === oldValue)) {
                    select.value = oldValue;
                }
            });
    }

    function filteredRoyalties(range = selectedRange()) {
        return data.royalties.filter(row =>
            row.currency === currency() &&
            inRange(row.royalty_month, range) &&
            matchesRoyaltyScope(row)
        );
    }

    function filteredPages(range = selectedRange()) {
        // Estimated royalty is GBP only.
        return data.pages.filter(row =>
            inRange(row.reading_month, range) &&
            matchesPageScope(row)
        );
    }

    function filteredExpenses(range = selectedRange()) {
        return data.expenses.filter(row =>
            row.currency === currency() &&
            inRange(row.expense_date, range) &&
            matchesExpenseScope(row)
        );
    }

    function monthKey(date) {
        return date?.slice(0, 7) || "";
    }

    function previousMonth(key) {
        const [year, month] = key.split("-").map(Number);
        const date = new Date(year, month - 2, 1);
        return `${date.getFullYear()}-${String(
            date.getMonth() + 1
        ).padStart(2, "0")}`;
    }

    function renderKPIs() {
        const rows = filteredRoyalties();
        const pages = filteredPages();
        const expenses = filteredExpenses();

        $("sr-kpi-royalties").textContent =
            money(sum(rows, "royalty_amount"), currency());

        $("sr-kpi-copies").textContent =
            integer(sum(rows, "net_units_sold"));

        $("sr-kpi-copy-detail").textContent =
            `${integer(sum(rows, "units_sold"))} sold · ` +
            `${integer(sum(rows, "units_refunded"))} refunded`;

        $("sr-kpi-ku").textContent = currency() === "GBP"
            ? money(sum(pages, "estimated_royalty_gbp"))
            : "GBP only";

        $("sr-kpi-expenses").textContent =
            money(sum(expenses, "amount"), currency());

        const months = [...new Set(rows.map(row =>
            monthKey(row.royalty_month)
        ))].filter(Boolean).sort();

        if (!months.length) {
            $("sr-kpi-previous").textContent = "—";
            $("sr-kpi-growth").textContent = "—";
            return;
        }

        const latest = months[months.length - 1];
        const prior = previousMonth(latest);

        const currentTotal = sum(
            rows.filter(row => monthKey(row.royalty_month) === latest),
            "royalty_amount"
        );

        const previousTotal = sum(
            rows.filter(row => monthKey(row.royalty_month) === prior),
            "royalty_amount"
        );

        $("sr-kpi-previous").textContent =
            money(previousTotal, currency());

        $("sr-kpi-growth").textContent =
            previousTotal > 0
                ? `${decimal(
                    (currentTotal - previousTotal) /
                    previousTotal * 100
                )}%`
                : "N/A";
    }

    function barRow(label, value, maximum, display) {
        const width = maximum > 0
            ? Math.max(0, Math.min(100, value / maximum * 100))
            : 0;

        return `
            <div class="sr-bar-row">
                <span class="sr-bar-label">${escapeHtml(label)}</span>
                <span class="sr-bar-track">
                    <span class="sr-bar-fill"
                          style="width:${width}%"></span>
                </span>
                <span class="sr-bar-value">${escapeHtml(display)}</span>
            </div>
        `;
    }

    function renderMonthly() {
        const year = Number($("sr-year").value);
        const rows = filteredRoyalties(fyRange(year));
        const monthFilter = $("sr-month").value;

        const monthly = [];

        for (let index = 0; index < 12; index++) {
            const calendarMonth = ((index + 3) % 12) + 1;
            const calendarYear = index < 9 ? year : year + 1;
            const key = `${calendarYear}-${String(
                calendarMonth
            ).padStart(2, "0")}`;

            if (monthFilter !== "all" &&
                Number(monthFilter) !== calendarMonth) {
                continue;
            }

            monthly.push({
                label: MONTHS[index],
                value: sum(
                    rows.filter(row =>
                        monthKey(row.royalty_month) === key
                    ),
                    "royalty_amount"
                )
            });
        }

        const max = Math.max(
            0,
            ...monthly.map(item => Math.max(0, item.value))
        );

        $("sr-monthly-chart").innerHTML = monthly.map(item =>
            barRow(
                item.label,
                Math.max(0, item.value),
                max,
                money(item.value, currency())
            )
        ).join("");
    }

    function renderFormats() {
        const rows = filteredRoyalties();
        const formats = ["ebook", "paperback", "hardcover"];

        const values = formats.map(format => ({
            label: format === "ebook"
                ? "eBook"
                : format[0].toUpperCase() + format.slice(1),
            value: sum(
                rows.filter(row => row.format === format),
                "net_units_sold"
            )
        }));

        const max = Math.max(
            0,
            ...values.map(item => Math.max(0, item.value))
        );

        $("sr-format-chart").innerHTML = values.map(item =>
            barRow(
                item.label,
                Math.max(0, item.value),
                max,
                integer(item.value)
            )
        ).join("");
    }

    function renderTopBooks() {
        const totals = new Map();

        filteredRoyalties().forEach(row => {
            const id = royaltyTitle(row);
            if (!id) return;

            if (!totals.has(id)) {
                totals.set(id, { copies: 0, royalties: 0 });
            }

            const item = totals.get(id);
            item.copies += number(row.net_units_sold);
            item.royalties += number(row.royalty_amount);
        });

        const sorted = [...totals.entries()]
            .sort((a, b) => b[1].copies - a[1].copies)
            .slice(0, 15);

        $("sr-top-books").innerHTML = sorted.length
            ? sorted.map(([id, item]) => `
                <tr>
                    <td>${escapeHtml(titleName(id))}</td>
                    <td class="sr-number">${integer(item.copies)}</td>
                    <td class="sr-number">
                        ${money(item.royalties, currency())}
                    </td>
                </tr>
            `).join("")
            : '<tr><td colspan="3">No KDP sales in this period.</td></tr>';
    }

    function reportLineTitleId(line) {
        const link = data.links.find(item =>
            item.sales_line_id === line.id
        );

        if (!link) return null;

        return link.title_id ||
            editionMap().get(link.edition_id)?.title_id ||
            null;
    }

    function renderPlatforms() {
        const range = selectedRange();
        const selectedCurrency = currency();
        const title = selectedTitle();
        const format = selectedFormat();

        const batchMap = new Map(
            data.batches.map(row => [row.id, row])
        );

        const lines = data.lines.filter(line => {
            const batch = batchMap.get(line.batch_id);
            if (!batch || batch.currency !== selectedCurrency) {
                return false;
            }

            if (title !== "all" && reportLineTitleId(line) !== title) {
                return false;
            }

            if (format !== "all") {
                const link = data.links.find(item =>
                    item.sales_line_id === line.id
                );

                if (!link?.edition_id ||
                    editionMap().get(link.edition_id)?.format !== format) {
                    return false;
                }
            }

            const effectiveDate =
                batch.platform === "tide"
                    ? line.payment_received_date
                    : line.reporting_month;

            return inRange(effectiveDate, range);
        });

        const kdp = sum(filteredRoyalties(), "royalty_amount");

        const ingram = sum(
            lines.filter(line =>
                batchMap.get(line.batch_id)?.platform === "ingramspark"
            ),
            "net_compensation"
        );

        const tide = sum(
            lines.filter(line =>
                batchMap.get(line.batch_id)?.platform === "tide"
            ),
            "payment_amount"
        );

        const shopify = lines.filter(line =>
            batchMap.get(line.batch_id)?.platform === "shopify"
        );

        const shopifyUnits = sum(shopify, "net_quantity");

        $("sr-platform-summary").innerHTML = `
            <div class="sr-record-list">
                <div class="sr-record">
                    <strong>Amazon KDP</strong>
                    <p>${money(kdp, selectedCurrency)} royalties</p>
                </div>
                <div class="sr-record">
                    <strong>IngramSpark</strong>
                    <p>${money(ingram, selectedCurrency)}
                       reported compensation</p>
                </div>
                <div class="sr-record">
                    <strong>Shopify</strong>
                    <p>${integer(shopifyUnits)} net product units</p>
                    <p>Revenue not calculated from average order value.</p>
                </div>
                <div class="sr-record">
                    <strong>Tide</strong>
                    <p>${money(tide, selectedCurrency)}
                       customer payments</p>
                </div>
            </div>
        `;

        const missingDates = data.lines.filter(line => {
            const batch = batchMap.get(line.batch_id);
            return batch?.currency === selectedCurrency &&
                batch.platform === "ingramspark" &&
                !line.reporting_month;
        }).length;

        if (missingDates) {
            $("sr-platform-summary").insertAdjacentHTML(
                "beforeend",
                `<p class="sr-muted">
                    ${integer(missingDates)} IngramSpark report lines
                    have no reporting month and are excluded
                    from date-filtered totals.
                </p>`
            );
        }
    }

    function renderFinancialYears() {
        const years = [...$("sr-year").options]
            .map(option => Number(option.value));

        const html = years.map(year => {
            const range = fyRange(year);
            const royalties = filteredRoyalties(range);
            const pages = filteredPages(range);
            const expenses = filteredExpenses(range);

            return `
                <tr>
                    <td>${labelFY(year)}</td>
                    <td class="sr-number">
                        ${integer(sum(royalties, "net_units_sold"))}
                    </td>
                    <td class="sr-number">
                        ${money(sum(royalties, "royalty_amount"), currency())}
                    </td>
                    <td class="sr-number">
                        ${currency() === "GBP"
                            ? money(sum(pages, "estimated_royalty_gbp"))
                            : "GBP only"}
                    </td>
                    <td class="sr-number">
                        ${money(sum(expenses, "amount"), currency())}
                    </td>
                </tr>
            `;
        }).join("");

        $("sr-financial-years").innerHTML = html;
    }

    function renderExpenses() {
        const rows = [...filteredExpenses()]
            .sort((a, b) =>
                b.expense_date.localeCompare(a.expense_date)
            );

        $("sr-expense-list").innerHTML = rows.length
            ? rows.map(row => `
                <tr>
                    <td>${escapeHtml(row.expense_date)}</td>
                    <td>${escapeHtml(
                        row.category.replace(/_/g, " ")
                    )}</td>
                    <td>${escapeHtml(row.description)}</td>
                    <td>${escapeHtml(titleName(row.title_id))}</td>
                    <td class="sr-number">
                        ${money(row.amount, row.currency)}
                    </td>
                    <td>
                        <button class="sr-delete"
                                type="button"
                                data-delete-table="publishing_expenses"
                                data-delete-id="${escapeHtml(row.id)}">
                            Delete
                        </button>
                    </td>
                </tr>
            `).join("")
            : '<tr><td colspan="6">No recorded expenses for these filters.</td></tr>';
    }

    function renderBudgets() {
        const range = selectedRange();

        const rows = data.budgets.filter(row =>
            row.currency === currency() &&
            overlaps(row.period_start, row.period_end, range) &&
            (selectedTitle() === "all" ||
                row.title_id === selectedTitle())
        );

        $("sr-budget-list").innerHTML = rows.length
            ? rows.map(row => {
                const matchingExpenses = data.expenses.filter(expense =>
                    expense.currency === row.currency &&
                    expense.category === row.category &&
                    inRange(expense.expense_date, {
                        start: row.period_start,
                        end: row.period_end
                    }) &&
                    (row.title_id
                        ? expense.title_id === row.title_id
                        : !expense.title_id)
                );

                const spent = sum(matchingExpenses, "amount");
                const percent = number(row.budget_amount) > 0
                    ? spent / number(row.budget_amount) * 100
                    : 0;

                return `
                    <article class="sr-record">
                        <div class="sr-record-top">
                            <strong>${escapeHtml(
                                row.category.replace(/_/g, " ")
                            )}</strong>
                            <button class="sr-delete" type="button"
                                    data-delete-table="publishing_budgets"
                                    data-delete-id="${escapeHtml(row.id)}">
                                Delete
                            </button>
                        </div>
                        <p>${escapeHtml(titleName(row.title_id))}</p>
                        <p>${escapeHtml(row.period_start)}
                           to ${escapeHtml(row.period_end)}</p>
                        <p>
                            ${money(spent, row.currency)} recorded /
                            ${money(row.budget_amount, row.currency)} budgeted
                        </p>
                        <div class="sr-progress">
                            <span style="width:${
                                Math.min(100, Math.max(0, percent))
                            }%"></span>
                        </div>
                        <p>${decimal(percent)}% of budget recorded</p>
                    </article>
                `;
            }).join("")
            : '<p class="sr-muted">No budgets for this selection.</p>';
    }

    function actualForTarget(row) {
        const range = {
            start: row.period_start,
            end: row.period_end
        };

        const royaltyRows = data.royalties.filter(item => {
            if (!inRange(item.royalty_month, range)) return false;
            if (row.title_id && royaltyTitle(item) !== row.title_id) {
                return false;
            }
            if (row.format && item.format !== row.format) {
                return false;
            }
            return row.metric === "net_copies" ||
                item.currency === row.currency;
        });

        if (row.metric === "net_copies") {
            return sum(royaltyRows, "net_units_sold");
        }

        if (row.metric === "royalties") {
            return sum(royaltyRows, "royalty_amount");
        }

        if (row.metric === "kindle_pages") {
            if (row.format && row.format !== "ebook") return 0;

            return sum(data.pages.filter(item =>
                inRange(item.reading_month, range) &&
                (!row.title_id ||
                    editionMap().get(item.edition_id)?.title_id ===
                    row.title_id)
            ), "total_pages");
        }

        if (row.metric === "direct_receipts") {
            if (row.format) return null;

            const batches = new Map(
                data.batches.map(item => [item.id, item])
            );

            return sum(data.lines.filter(line => {
                const batch = batches.get(line.batch_id);
                return batch?.platform === "tide" &&
                    batch.currency === row.currency &&
                    inRange(line.payment_received_date, range) &&
                    (!row.title_id ||
                        reportLineTitleId(line) === row.title_id);
            }), "payment_amount");
        }

        // Profit is deliberately unavailable until
        // complete financial accounting inputs exist.
        return null;
    }

    function renderTargets() {
        const range = selectedRange();

        const rows = data.targets.filter(row =>
            row.currency === currency() &&
            overlaps(row.period_start, row.period_end, range) &&
            (selectedTitle() === "all" ||
                row.title_id === selectedTitle()) &&
            (selectedFormat() === "all" ||
                row.format === selectedFormat())
        );

        $("sr-target-list").innerHTML = rows.length
            ? rows.map(row => {
                const actual = actualForTarget(row);
                const percent = actual !== null &&
                    number(row.target_value) > 0
                    ? actual / number(row.target_value) * 100
                    : 0;

                const isMoney = [
                    "royalties", "direct_receipts", "profit"
                ].includes(row.metric);

                const display = value => isMoney
                    ? money(value, row.currency)
                    : integer(value);

                return `
                    <article class="sr-record">
                        <div class="sr-record-top">
                            <strong>${escapeHtml(
                                row.metric.replace(/_/g, " ")
                            )}</strong>
                            <button class="sr-delete" type="button"
                                    data-delete-table="publishing_targets"
                                    data-delete-id="${escapeHtml(row.id)}">
                                Delete
                            </button>
                        </div>
                        <p>${escapeHtml(titleName(row.title_id))}
                           · ${escapeHtml(row.format || "All formats")}</p>
                        <p>${escapeHtml(row.period_start)}
                           to ${escapeHtml(row.period_end)}</p>
                        <p>${actual === null
                            ? "Actual result not yet available"
                            : `${display(actual)} / ${
                                display(row.target_value)
                            } target`}</p>
                        <div class="sr-progress">
                            <span style="width:${
                                Math.min(100, Math.max(0, percent))
                            }%"></span>
                        </div>
                        <p>${actual === null
                            ? "Pending"
                            : `${decimal(percent)}% achieved`}</p>
                    </article>
                `;
            }).join("")
            : '<p class="sr-muted">No targets for this selection.</p>';
    }

    function renderProfitability() {
        const royalties = filteredRoyalties();
        const expenses = data.expenses.filter(row =>
            row.currency === currency() &&
            inRange(row.expense_date, selectedRange())
        );

        const ids = selectedTitle() === "all"
            ? data.titles.map(book => book.id)
            : [selectedTitle()];

        const rows = ids.map(id => {
            const earned = sum(
                royalties.filter(row => royaltyTitle(row) === id),
                "royalty_amount"
            );

            const costs = sum(
                expenses.filter(row => {
                    if (row.title_id === id) return true;

                    return row.edition_id &&
                        editionMap().get(row.edition_id)?.title_id === id;
                }),
                "amount"
            );

            return { id, earned, costs };
        }).filter(item => item.earned || item.costs)
          .sort((a, b) => b.earned - a.earned);

        $("sr-profit-list").innerHTML = rows.length
            ? rows.map(row => `
                <tr>
                    <td>${escapeHtml(titleName(row.id))}</td>
                    <td class="sr-number">
                        ${money(row.earned, currency())}
                    </td>
                    <td class="sr-number">
                        ${money(row.costs, currency())}
                    </td>
                    <td class="sr-number">
                        ${money(row.earned - row.costs, currency())}
                    </td>
                </tr>
            `).join("")
            : '<tr><td colspan="4">No book-level records for this selection.</td></tr>';
    }

    function render() {
        if (!loaded) return;

        const range = selectedRange();

        $("sr-period-label").textContent =
            `Showing ${range.start} to ${range.end} · ` +
            `${currency()} · ${selectedFormat() === "all"
                ? "All formats"
                : selectedFormat()}`;

        renderKPIs();
        renderMonthly();
        renderFormats();
        renderTopBooks();
        renderPlatforms();
        renderFinancialYears();
        renderExpenses();
        renderBudgets();
        renderTargets();
        renderProfitability();
    }

    function populateCategorySelects() {
        [
            "sr-expense-category",
            "sr-budget-category"
        ].forEach(id => {
            const select = $(id);
            select.replaceChildren();

            CATEGORIES.forEach(category => {
                const label = category
                    .replace(/_/g, " ")
                    .replace(/\b\w/g, character =>
                        character.toUpperCase()
                    );

                select.add(new Option(label, category));
            });
        });

        [
            "sr-expense-currency",
            "sr-budget-currency",
            "sr-target-currency"
        ].forEach(id => {
            const select = $(id);
            select.replaceChildren();

            CURRENCIES.forEach(code => {
                select.add(new Option(code, code));
            });

            select.value = "GBP";
        });
    }

    function setFormDates() {
        const today = dateOnly(new Date());
        const range = fyRange(fyStart(today));

        $("sr-expense-date").value = today;

        ["budget", "target"].forEach(type => {
            $(`sr-${type}-start`).value = range.start;
            $(`sr-${type}-end`).value = range.end;
        });
    }

    async function insertRecord(table, record, messageId, form) {
        const message = $(messageId);
        const button = form.querySelector('[type="submit"]');

        button.disabled = true;
        message.textContent = "Saving...";

        try {
            const response = await db.from(table).insert(record);

            if (response.error) throw response.error;

            message.textContent = "Saved successfully.";
            await refresh();

        } catch (error) {
            console.error("Financial record save error:", error);
            message.textContent =
                "Unable to save: " + error.message;
        } finally {
            button.disabled = false;
        }
    }

    function bindForms() {
        $("sr-expense-form").addEventListener("submit", async event => {
            event.preventDefault();
            if (!loaded) return;

            const form = event.currentTarget;

            await insertRecord("publishing_expenses", {
                expense_date: $("sr-expense-date").value,
                category: $("sr-expense-category").value,
                description: $("sr-expense-description").value.trim(),
                amount: Number($("sr-expense-amount").value),
                currency: $("sr-expense-currency").value,
                title_id: $("sr-expense-title").value || null,
                supplier: $("sr-expense-supplier").value.trim() || null,
                notes: $("sr-expense-notes").value.trim() || null
            }, "sr-expense-message", form);
        });

        $("sr-budget-form").addEventListener("submit", async event => {
            event.preventDefault();
            if (!loaded) return;

            const form = event.currentTarget;
            const start = $("sr-budget-start").value;
            const end = $("sr-budget-end").value;

            if (end < start) {
                $("sr-budget-message").textContent =
                    "End date must not precede start date.";
                return;
            }

            await insertRecord("publishing_budgets", {
                period_start: start,
                period_end: end,
                category: $("sr-budget-category").value,
                budget_amount: Number($("sr-budget-amount").value),
                currency: $("sr-budget-currency").value,
                title_id: $("sr-budget-title").value || null
            }, "sr-budget-message", form);
        });

        $("sr-target-form").addEventListener("submit", async event => {
            event.preventDefault();
            if (!loaded) return;

            const form = event.currentTarget;
            const start = $("sr-target-start").value;
            const end = $("sr-target-end").value;

            if (end < start) {
                $("sr-target-message").textContent =
                    "End date must not precede start date.";
                return;
            }

            await insertRecord("publishing_targets", {
                period_start: start,
                period_end: end,
                metric: $("sr-target-metric").value,
                target_value: Number($("sr-target-value").value),
                currency: $("sr-target-currency").value,
                title_id: $("sr-target-title").value || null,
                format: $("sr-target-format").value || null
            }, "sr-target-message", form);
        });
    }

    async function deleteRecord(table, id) {
        if (!loaded) return;

        const allowed = new Set([
            "publishing_expenses",
            "publishing_budgets",
            "publishing_targets"
        ]);

        if (!allowed.has(table)) return;

        if (!window.confirm(
            "Permanently delete this financial record?"
        )) return;

        try {
            const response = await db
                .from(table)
                .delete()
                .eq("id", id)
                .select("id");

            if (response.error) throw response.error;

            if (!response.data?.length) {
                throw new Error(
                    "No record was deleted. Check administrator access."
                );
            }

            await refresh();

        } catch (error) {
            console.error("Delete failed:", error);
            window.alert("Delete failed: " + error.message);
        }
    }

    function bindEvents() {
        [
            "sr-year",
            "sr-month",
            "sr-currency",
            "sr-title-filter",
            "sr-format"
        ].forEach(id => {
            $(id).addEventListener("change", render);
        });

        $("sr-refresh").addEventListener("click", () => {
            if (db) verifyAccess();
        });

        document.addEventListener("click", event => {
            const button = event.target.closest(
                "[data-delete-table][data-delete-id]"
            );

            if (!button) return;

            deleteRecord(
                button.dataset.deleteTable,
                button.dataset.deleteId
            );
        });

        bindForms();
    }

    async function initialize() {
        if (!$("sr-access-screen") || !$("sr-admin-content")) {
            console.error("Department 03 page elements missing.");
            return;
        }

        lock();
        populateCategorySelects();
        setFormDates();
        bindEvents();

        try {
            if (typeof loadHeader === "function") {
                await loadHeader("simple");
            }
        } catch (error) {
            console.warn("Header could not load:", error);
        }

        try {
            await loadLibrary();

            db = window.supabase.createClient(URL, KEY, {
                auth: {
                    persistSession: true,
                    autoRefreshToken: true,
                    detectSessionInUrl: true
                }
            });

            db.auth.onAuthStateChange(event => {
                if (event === "SIGNED_OUT") {
                    ++accessVersion;
                    lock();
                    accessMessage(
                        "Your session has ended. Please sign in again."
                    );
                }

                if ([
                    "SIGNED_IN",
                    "TOKEN_REFRESHED",
                    "USER_UPDATED"
                ].includes(event)) {
                    window.setTimeout(verifyAccess, 0);
                }
            });

            await verifyAccess();

        } catch (error) {
            console.error("Department 03 startup error:", error);
            lock();
            accessMessage(
                "Unable to initialise the financial dashboard."
            );
        }
    }

    window.addEventListener("load", initialize);
})();
