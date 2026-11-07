const { chromium } = require("playwright");
const assert = require("node:assert/strict");

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH,
    args: ["--no-sandbox"],
  });
  try {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      reducedMotion: "reduce",
    });
    await context.addInitScript(() =>
      localStorage.setItem(
        "sb-bmnlynjldlnxfvunqbqq-auth-token",
        JSON.stringify({
          access_token: "fixture-admin-token-must-not-be-sent",
          user: { id: "fixture-admin" },
        })
      )
    );
    const page = await context.newPage();
    const errors = [],
      requests = [];
    let mode = "posts",
      legacyReads = 0;
    const item = (id, extra = {}) => ({
      id,
      title: "Public " + id,
      category: "Publishing News",
      excerpt: "A short public update.",
      body: 'First public paragraph.\n\n<img src=x onerror="window.dispatchXss=true">',
      image_url: "/assets/book7.png",
      audience: "public",
      published: true,
      pinned: false,
      published_at: "2026-11-06T12:00:00Z",
      revision: 1,
      ...extra,
    });
    const rows = [
      item("news-one", { pinned: true }),
      item("members-secret", {
        title: "Private title must never appear",
        audience: "members",
      }),
      item("draft", {
        title: "Draft title must never appear",
        published: false,
      }),
      item("future", {
        title: "Future title must never appear",
        published_at: "2099-01-01T00:00:00Z",
      }),
      item("news-two", { image_url: "https://unverified.example/image.png" }),
    ];
    page.on("pageerror", (error) => errors.push(error.message));
    await context.route("**/data/BFA.json*", (route) => {
      legacyReads++;
      return route.abort();
    });
    await context.route("https://**/*", async (route) => {
      const request = route.request(),
        url = new URL(request.url());
      if (
        url.hostname === "bmnlynjldlnxfvunqbqq.supabase.co" &&
        url.pathname === "/rest/v1/bp_dispatches"
      ) {
        assert.equal(request.method(), "GET");
        assert.equal(url.searchParams.get("audience"), "eq.public");
        assert.equal(url.searchParams.get("published"), "eq.true");
        assert.equal(url.searchParams.get("limit"), "3");
        assert(!url.searchParams.get("select").includes("created_by"));
        assert.equal(
          request.headers().authorization,
          undefined,
          "homepage never sends the cached admin token"
        );
        assert(
          !JSON.stringify(request.headers()).includes("fixture-admin-token")
        );
        requests.push(request.url());
        return route.fulfill({
          status: mode === "error" ? 503 : mode === "setup" ? 404 : 200,
          contentType: "application/json",
          headers: { "Access-Control-Allow-Origin": "*" },
          body: JSON.stringify(
            mode === "setup"
              ? { code: "PGRST205" }
              : mode === "single"
              ? [rows[0]]
              : mode === "empty"
              ? []
              : rows
          ),
        });
      }
      return route.abort();
    });
    const base = process.env.BASE_URL;
    await page.goto(base + "/");
    const section = page.locator("#home-dispatches");
    await section.locator(".home-dispatch-carousel").first().waitFor();
    assert.equal(await section.locator(".home-dispatch-carousel").count(), 1);
    assert.match(
      await section.locator("[data-dispatch-summary]").textContent(),
      /2 public dispatches/
    );
    assert.equal(
      await section.locator(".home-dispatch-carousel__position").textContent(),
      "1 of 2"
    );
    assert.equal(
      await section.locator("[data-dispatch-pinned]").isVisible(),
      true
    );
    const toggle = section.getByRole("button", {
      name: "Behind the Files",
      exact: true,
    });
    await toggle.press("Enter");
    assert.equal(await toggle.getAttribute("aria-expanded"), "false");
    assert.equal(
      await section.locator("#home-dispatch-content").isHidden(),
      true
    );
    await toggle.press("Space");
    assert.equal(await toggle.getAttribute("aria-expanded"), "true");
    const next = section.getByRole("button", {
      name: "Next public update",
      exact: true,
    });
    const previous = section.getByRole("button", {
      name: "Previous public update",
      exact: true,
    });
    await next.focus();
    await page.keyboard.press("Enter");
    assert.equal(await section.locator("h3").textContent(), "Public news-two");
    assert.equal(
      await section.locator(".home-dispatch-carousel__position").textContent(),
      "2 of 2"
    );
    assert.equal(
      await next.evaluate((el) => document.activeElement === el),
      true,
      "carousel navigation preserves focus"
    );
    assert.equal(
      await section.locator("[data-dispatch-pinned]").isHidden(),
      true
    );
    assert.equal(
      legacyReads,
      0,
      "homepage never requests the old mixed-audience JSON"
    );
    assert(
      !/Private title|Draft title|Future title/.test(
        await section.textContent()
      )
    );
    assert.equal(
      await section
        .getByRole("link", { name: "Read member dispatches" })
        .getAttribute("href"),
      "/pages/members.html#circle-panel-behindFiles"
    );
    assert.equal(
      await section
        .locator(".home-dispatch-carousel img")
        .first()
        .getAttribute("src"),
      "/assets/ArchiveFilesBG.png",
      "unverified external image is not requested"
    );
    assert.equal(
      await page.evaluate(
        () => document.querySelector("#main-content").firstElementChild.id
      ),
      "home-dispatches"
    );
    await previous.click();
    assert.equal(await section.locator("h3").textContent(), "Public news-one");
    await previous.click();
    assert.equal(
      await section.locator("h3").textContent(),
      "Public news-two",
      "previous wraps around"
    );
    await next.click();
    assert.equal(
      await section.locator("h3").textContent(),
      "Public news-one",
      "next wraps around"
    );
    const open = section.getByRole("button", {
      name: "Read File: Public news-one",
      exact: true,
    });
    await open.click();
    const dialog = page.getByRole("dialog", {
      name: "Public news-one",
      exact: true,
    });
    assert.equal(await dialog.isVisible(), true);
    assert.match(
      await dialog.locator("[data-dispatch-body]").textContent(),
      /<img src=x/
    );
    assert.equal(await dialog.locator("[data-dispatch-body] img").count(), 0);
    assert.equal(await page.evaluate(() => window.dispatchXss), undefined);
    await page.keyboard.press("Tab");
    assert.equal(
      await page.evaluate(
        () =>
          document.querySelector("#home-dispatch-dialog").matches(":modal") &&
          !document.activeElement.closest("#home-dispatches")
      ),
      true
    );
    await page.keyboard.press("Escape");
    assert.equal(await dialog.isVisible(), false);
    assert.equal(
      await open.evaluate((el) => document.activeElement === el),
      true,
      "closing restores focus to the opened update"
    );
    for (const width of [320, 390, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1
        ),
        true,
        "homepage fits " + width
      );
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await section.screenshot({
      path: "/workspace/scratch/home-dispatches-mobile.png",
    });
    await page.setViewportSize({ width: 1280, height: 900 });
    await section.screenshot({
      path: "/workspace/scratch/home-dispatches-desktop.png",
    });
    mode = "single";
    await page.reload();
    await section.locator(".home-dispatch-carousel").waitFor();
    assert.equal(
      await section
        .getByRole("button", { name: "Next public update", exact: true })
        .isDisabled(),
      true
    );
    assert.equal(
      await section
        .getByRole("button", { name: "Previous public update", exact: true })
        .isDisabled(),
      true
    );
    assert.equal(
      await section.locator(".home-dispatch-carousel__position").textContent(),
      "1 of 1"
    );
    mode = "empty";
    await page.reload();
    await page.waitForFunction(() =>
      document
        .querySelector("[data-dispatch-status]")
        .textContent.includes("Public updates will appear")
    );
    assert.equal(await section.locator(".home-dispatch-carousel").count(), 0);
    assert.equal(
      await section.locator("[data-dispatch-retry]").isHidden(),
      true
    );
    mode = "setup";
    await page.reload();
    await page.waitForFunction(() =>
      document
        .querySelector("[data-dispatch-status]")
        .textContent.includes("Public updates will appear")
    );
    assert.equal(
      await section.locator("[data-dispatch-retry]").isHidden(),
      true,
      "setup pending uses calm empty state"
    );
    mode = "error";
    await page.reload();
    await section.getByRole("button", { name: "Try updates again" }).waitFor();
    assert.equal(await section.locator(".home-dispatch-carousel").count(), 0);
    assert(!/Supabase|SQL|apikey|503/.test(await section.textContent()));
    mode = "posts";
    await section.getByRole("button", { name: "Try updates again" }).click();
    await section.locator(".home-dispatch-carousel").first().waitFor();
    assert.equal(requests.length, 6);
    assert.deepEqual(errors, []);
    console.log(
      "PASS homepage dispatches: public-only anonymous request despite admin cache, no legacy/private/draft/future rendering, safe modal/focus, first-party images, carousel navigation/collapse, single/empty/retry states and mobile/desktop layouts. No live API writes or emails."
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
