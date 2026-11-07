/* Browser regression using fictional reporting data and mocked read-only services. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { chromium } = require("playwright");

const base = process.env.BASE_URL || "http://127.0.0.1:8000";
const output = process.env.SHOPIFY_TEST_DIR || "/tmp/blackwood-shopify-test";

async function main() {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ["--no-sandbox"],
  });

  async function open(mode = "ready") {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 900 },
      reducedMotion: "reduce",
    });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("https://**/*", (route) => route.abort());
    await page.addInitScript(
      ({ mode }) => {
        const titles = [
          {
            id: "test-title-north",
            title: "Test Book North",
            author_name: "Example Author",
          },
          {
            id: "test-title-south",
            title: "Test Book South",
            author_name: "Example Author",
          },
          {
            id: "test-title-west",
            title: "Test Book West",
            author_name: "Example Author",
          },
        ];
        const editions = titles.map((title, index) => ({
          id: `test-edition-${index}`,
          title_id: title.id,
          format: "paperback",
          asin: null,
          isbn: null,
        }));
        const product = (id, date, title, amount, batch = "shopify-gbp") => ({
          id,
          batch_id: batch,
          reporting_month: date,
          product_title: title,
          gross_sales: amount,
          gross_sales_source:
            amount === null ? null : "Fictional gross-sales test report",
          gross_quantity: null,
          returned_quantity: null,
          net_quantity: null,
          reversed_quantity: 0,
          orders_count: null,
          net_compensation: null,
          payment_received_date: null,
          payment_amount: null,
          order_date: null,
        });
        const lines = [
          ...titles.map((title, index) =>
            product(`october-${index}`, "2026-10-01", title.title, "7.5000")
          ),
          product("october-placeholder", "2026-10-01", null, null),
          product(
            "july-comparison",
            "2026-07-01",
            "Fictional July product",
            "120.00"
          ),
          product(
            "august-unknown",
            "2026-08-01",
            "Fictional unpriced product",
            null
          ),
          product(
            "september-unknown",
            "2026-09-01",
            "Fictional older product",
            null
          ),
          product(
            "december-zero",
            "2026-12-01",
            "Fictional zero report",
            "0.0000"
          ),
          product(
            "october-usd",
            "2026-10-01",
            "Foreign-currency fixture",
            "900.00",
            "shopify-usd"
          ),
        ];
        const tables = {
          publishing_titles: titles,
          publishing_editions: editions,
          publishing_kdp_royalties_gbp: [
            {
              id: "test-kdp-row",
              edition_id: editions[0].id,
              format: "paperback",
              royalty_month: "2026-10-01",
              units_sold: 10,
              units_refunded: 0,
              net_units_sold: 10,
              original_currency: "GBP",
              average_offer_price_gbp: 10,
              average_manufacturing_cost_gbp: 2,
              average_delivery_cost_gbp: 0,
              royalty_amount_gbp: 50,
              retail_sales_gbp: 100,
              manufacturing_total_gbp: 20,
              delivery_total_gbp: 0,
              estimated_amazon_retained_gbp: 30,
            },
          ],
          publishing_kdp_page_reads: [
            {
              id: "test-pages",
              edition_id: editions[0].id,
              reading_month: "2026-10-01",
              pages_read: 2000,
              pages_listened: 0,
              total_pages: 2000,
              estimated_royalty_gbp: 8,
            },
          ],
          publishing_kdp_monthly_ku_gbp: [
            {
              royalty_month: "2026-10-01",
              estimated_gbp: 8,
              confirmed_uk_ku_gbp: 0,
              adjustment_gbp: 0,
              reported_ku_gbp: 8,
              reporting_status: "estimated_worldwide",
            },
          ],
          publishing_kdp_monthly_adjustments: [
            {
              royalty_month: "2026-10-01",
              adjustment_gbp: 2,
              target_total_gbp: 60,
              notes: "Fictional management estimate",
            },
          ],
          sales_report_batches: [
            {
              id: "shopify-gbp",
              platform: "shopify",
              currency: "GBP",
              report_name: "Fictional GBP report",
              period_start: "2026-04-01",
              period_end: "2026-12-31",
            },
            {
              id: "shopify-usd",
              platform: "shopify",
              currency: "USD",
              report_name: "Fictional USD report",
              period_start: "2026-10-01",
              period_end: "2026-10-31",
            },
          ],
          sales_report_lines: lines,
          sales_product_links: titles.map((title, index) => ({
            id: `test-link-${index}`,
            sales_line_id: `october-${index}`,
            edition_id: null,
            title_id: title.id,
          })),
          publishing_expenses: [],
          publishing_budgets: [],
          publishing_targets: [],
        };
        window.shopifyFixture = {
          mode,
          calls: [],
          mutations: [],
          callbacks: [],
        };
        const fixture = window.shopifyFixture;
        const client = {
          auth: {
            async getUser() {
              return {
                data: {
                  user:
                    mode === "anonymous" ? null : { id: "test-administrator" },
                },
              };
            },
            async getSession() {
              return { data: { session: null } };
            },
            onAuthStateChange(callback) {
              fixture.callbacks.push(callback);
              return { data: { subscription: { unsubscribe() {} } } };
            },
          },
          from(table) {
            let columns = "*";
            const query = {
              select(value) {
                columns = value;
                return query;
              },
              eq() {
                return query;
              },
              order() {
                return query;
              },
              async maybeSingle() {
                return { data: { is_admin: mode !== "nonadmin" } };
              },
              async range(start, end) {
                fixture.calls.push({ table, columns, start, end });
                const requested = columns.split(",");
                const hasGross =
                  requested.includes("gross_sales") ||
                  requested.includes("gross_sales_source");
                if (
                  table === "sales_report_lines" &&
                  hasGross &&
                  mode.startsWith("missing")
                ) {
                  const code = mode === "missing42703" ? "42703" : "PGRST204";
                  return {
                    error: {
                      code,
                      message:
                        "column sales_report_lines.gross_sales does not exist",
                    },
                  };
                }
                if (
                  table === "sales_report_lines" &&
                  mode === "unrelated-error"
                ) {
                  return {
                    error: {
                      code: "42501",
                      message: "Fictional reporting access failure",
                    },
                  };
                }
                const rows = (tables[table] || []).slice(start, end + 1);
                return {
                  data: rows.map((row) =>
                    Object.fromEntries(
                      requested.map((key) => [key, row[key] ?? null])
                    )
                  ),
                };
              },
            };
            for (const verb of ["insert", "update", "delete", "upsert"]) {
              query[verb] = () => {
                fixture.mutations.push({ table, verb });
                throw new Error("Unexpected browser write");
              };
            }
            return query;
          },
        };
        window.supabase = { createClient: () => client };
      },
      { mode }
    );
    await page.goto(`${base}/pages/sales-royalties.html`);
    if (mode === "anonymous" || mode === "nonadmin") {
      await page.waitForFunction(() =>
        /Please sign in|Access denied/.test(
          document.getElementById("sr-access-message").textContent
        )
      );
    } else if (mode === "unrelated-error") {
      await page.waitForFunction(() =>
        document
          .getElementById("sr-status")
          .textContent.includes("Department 03 error:")
      );
    } else {
      await page.waitForFunction(() =>
        document
          .getElementById("sr-status")
          .textContent.includes("Dashboard loaded successfully.")
      );
      await page.selectOption("#sr-year", "2026");
    }
    return { page, errors };
  }

  const shopify = (page) =>
    page
      .locator("#sr-platform-summary .sr-record")
      .filter({ has: page.getByText("Shopify", { exact: true }) });
  const kdp = (page) =>
    page
      .locator("#sr-platform-summary .sr-record")
      .filter({ has: page.getByText("Amazon KDP", { exact: true }) });
  const { page, errors } = await open();
  assert.match(
    await shopify(page).innerText(),
    /£142\.50 recorded gross product sales/
  );
  assert.match(
    await shopify(page).innerText(),
    /Gross sales recorded for 5 of 7 product records\./
  );
  await page.selectOption("#sr-month", "10");
  assert.match(await shopify(page).innerText(), /£22\.50 gross product sales/);
  assert.doesNotMatch(
    await shopify(page).innerText(),
    /partial|recorded for|£120|£900|£0\.00/
  );
  assert.match(
    await shopify(page).innerText(),
    /Net product units not supplied\./
  );
  assert.match(await kdp(page).innerText(), /£60\.00\s+combined KDP royalties/);
  assert.equal(
    await page.locator("#sr-amazon-combined").innerText(),
    "£60.00",
    "Shopify gross sales must not enter KDP royalties"
  );

  await page.selectOption("#sr-title-filter", "test-title-north");
  assert.match(await shopify(page).innerText(), /£7\.50 gross product sales/);
  await page.selectOption("#sr-format", "paperback");
  assert.match(
    await shopify(page).innerText(),
    /Gross sales not recorded for this selection\./,
    "Title-only product links do not invent an edition format"
  );
  await page.selectOption("#sr-format", "all");
  await page.selectOption("#sr-title-filter", "all");
  await page.selectOption("#sr-month", "8");
  assert.match(
    await shopify(page).innerText(),
    /Gross sales not recorded for this selection\./
  );
  assert.doesNotMatch(
    await shopify(page).innerText(),
    /£0\.00/,
    "Missing gross sales must not become zero"
  );
  await page.selectOption("#sr-month", "12");
  assert.match(
    await shopify(page).innerText(),
    /£0\.00 gross product sales/,
    "A reported zero must remain distinct from missing data"
  );
  await page.selectOption("#sr-month", "7");
  assert.match(await shopify(page).innerText(), /£120\.00 gross product sales/);
  await page.selectOption("#sr-month", "10");
  await page
    .locator("#sr-platform-summary")
    .screenshot({ path: `${output}/shopify-platforms-desktop.png` });
  await page.setViewportSize({ width: 390, height: 844 });
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1
    )
  );
  await page
    .locator("#sr-platform-summary")
    .screenshot({ path: `${output}/shopify-platforms-mobile.png` });
  assert.deepEqual(errors, []);
  assert.deepEqual(
    await page.evaluate(() => window.shopifyFixture.mutations),
    []
  );
  await page.close();

  for (const mode of ["missing42703", "missingPGRST204"]) {
    const { page, errors } = await open(mode);
    await page.selectOption("#sr-month", "10");
    assert.match(
      await shopify(page).innerText(),
      /Gross sales not recorded for this selection\./
    );
    assert.match(
      await kdp(page).innerText(),
      /£60\.00\s+combined KDP royalties/
    );
    const queries = await page.evaluate(() =>
      window.shopifyFixture.calls.filter(
        (call) => call.table === "sales_report_lines"
      )
    );
    assert.equal(
      queries.length,
      2,
      "Missing gross columns trigger one targeted fallback"
    );
    assert(queries[0].columns.includes("gross_sales"));
    assert(!queries[1].columns.includes("gross_sales"));
    assert.deepEqual(errors, []);
    assert.deepEqual(
      await page.evaluate(() => window.shopifyFixture.mutations),
      []
    );
    await page.close();
  }

  {
    const { page, errors } = await open("unrelated-error");
    assert.match(
      await page.locator("#sr-status").innerText(),
      /Fictional reporting access failure/
    );
    assert.equal(
      await page.locator("#sr-platform-summary .sr-record").count(),
      0
    );
    const queries = await page.evaluate(() =>
      window.shopifyFixture.calls.filter(
        (call) => call.table === "sales_report_lines"
      )
    );
    assert.equal(
      queries.length,
      1,
      "Unrelated errors must not be swallowed as a missing-column fallback"
    );
    assert.deepEqual(errors, []);
    await page.close();
  }

  for (const mode of ["anonymous", "nonadmin"]) {
    const { page, errors } = await open(mode);
    assert(await page.locator("#sr-admin-content").isHidden());
    assert.equal(
      await page.evaluate(() => window.shopifyFixture.calls.length),
      0,
      "Denied readers must not query financial records"
    );
    assert.deepEqual(errors, []);
    await page.close();
  }
  await browser.close();
  console.log(
    "PASS Shopify gross sales: reporting periods, book/format/GBP filters, partial coverage, null versus zero, independent KDP totals, targeted migration fallback, real error visibility, admin access and mobile layout. Fictional fixtures only; no live API writes or emails."
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
