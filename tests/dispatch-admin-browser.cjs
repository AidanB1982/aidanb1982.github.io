const { chromium } = require("playwright"),
  assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH,
    args: ["--no-sandbox"],
  });
  try {
    const context = await browser.newContext({
        viewport: { width: 1280, height: 900 },
      }),
      page = await context.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await context.route("https://**/*", (r) => r.abort());
    await context.route("**/js/*", (r) =>
      r.request().url().includes("/js/behind-files-admin.js")
        ? r.continue()
        : r.abort()
    );
    await context.addInitScript(() => {
      const user = { id: "00000000-0000-0000-0000-000000000123" };
      window.fixture = {
        user,
        admin: true,
        rows: [],
        saves: [],
        callbacks: [],
        mode: "",
        missing: false,
        resolve: null,
      };
      const state = window.fixture;
      const client = {
        auth: {
          async getUser() {
            return { data: { user: state.user }, error: null };
          },
          onAuthStateChange(fn) {
            state.callbacks.push(fn);
          },
        },
        from(table) {
          return {
            select() {
              return this;
            },
            eq() {
              return this;
            },
            order() {
              return this;
            },
            async maybeSingle() {
              return { data: { is_admin: state.admin }, error: null };
            },
            async limit() {
              return state.missing
                ? { error: { code: "42P01" } }
                : { data: structuredClone(state.rows), error: null };
            },
          };
        },
        async rpc(name, args) {
          state.saves.push({ name, args: structuredClone(args) });
          if (state.mode === "hold")
            await new Promise((resolve) => (state.resolve = resolve));
          if (state.mode === "conflict") return { error: { code: "40001" } };
          if (state.mode === "missing") return { error: { code: "PGRST202" } };
          const old = state.rows.find((x) => x.id === args.p_payload.id),
            row = { ...args.p_payload, revision: old ? old.revision + 1 : 1 };
          state.rows = state.rows.filter((x) => x.id !== row.id);
          state.rows.push(row);
          return { data: structuredClone(row), error: null };
        },
      };
      window.supabase = {
        createClient() {
          return client;
        },
      };
      window.BlackwoodPlanner = { activate() {}, lock() {} };
      window.BlackwoodOperations = { activate() {}, lock() {}, suspend() {} };
    });
    await page.goto(process.env.BASE_URL + "/pages/behind-files-admin.html");
    await page.waitForFunction(
      () =>
        !document.getElementById("bfa-admin-content").hidden &&
        !document.getElementById("bfa-save").disabled
    );
    assert.equal(await page.locator("#bfa-audience").inputValue(), "members");
    assert.equal(await page.locator("#bfa-published").isChecked(), false);
    assert.equal(
      await page.locator("#bfa-json-output,#bfa-generate,#bfa-copy").count(),
      0,
      "private body has no public JSON export"
    );
    await page.locator("#bfa-post-title").fill("Members preview");
    await page
      .locator("#bfa-body")
      .fill('Private body\n\n<img src=x onerror="window.xss=true">');
    assert.equal(
      await page.locator("#bfa-preview-body img").count(),
      0,
      "preview treats body as plain text"
    );
    await page.locator("#bfa-save").click();
    await page.waitForFunction(() =>
      document.getElementById("bfa-status").textContent.includes("Draft saved")
    );
    assert.equal(await page.evaluate(() => fixture.saves.length), 1);
    assert.equal(
      await page.evaluate(() => fixture.rows[0].audience),
      "members"
    );
    assert.equal(await page.evaluate(() => fixture.rows[0].published), false);
    await page.locator("#bfa-existing-list button").click();
    await page.locator("#bfa-audience").selectOption("public");
    await page.locator("#bfa-published").check();
    await page.locator("#bfa-save").click();
    await page.waitForFunction(() =>
      document.getElementById("bfa-status").textContent.includes("homepage")
    );
    assert.equal(
      await page.evaluate(() => fixture.saves[1].args.p_expected_revision),
      1
    );
    assert.equal(
      await page.evaluate(() => fixture.rows.length),
      1,
      "edits preserve stable ID"
    );
    await page.locator("#bfa-published").uncheck();
    await page.locator("#bfa-save").click();
    await page.waitForFunction(() =>
      document.getElementById("bfa-status").textContent.includes("Draft saved")
    );
    assert.equal(
      await page.evaluate(() => fixture.rows[0].published),
      false,
      "unpublish remains an explicit save"
    );
    await page.locator("#bfa-post-title").fill("Unsent retained edit");
    await page.evaluate(() => (fixture.mode = "conflict"));
    await page.locator("#bfa-save").click();
    await page.waitForFunction(() =>
      document
        .getElementById("bfa-status")
        .textContent.includes("changed elsewhere")
    );
    assert.equal(
      await page.locator("#bfa-post-title").inputValue(),
      "Unsent retained edit"
    );
    assert.equal(await page.locator("#bfa-save").isEnabled(), true);
    await page.evaluate(() => {
      fixture.mode = "missing";
    });
    await page.locator("#bfa-save").click();
    await page.waitForFunction(() =>
      document.getElementById("bfa-status").textContent.includes("migration")
    );
    assert.equal(
      await page.locator("#bfa-body").inputValue(),
      'Private body\n\n<img src=x onerror="window.xss=true">'
    );
    await page.evaluate(() => {
      fixture.mode = "";
      fixture.callbacks.forEach((fn) => fn("TOKEN_REFRESHED"));
    });
    await page.waitForFunction(
      () =>
        !document.getElementById("bfa-admin-content").hidden &&
        !document.getElementById("bfa-save").disabled
    );
    assert.equal(
      await page.locator("#bfa-post-title").inputValue(),
      "Unsent retained edit",
      "auth recheck keeps open draft"
    );
    await page.locator("#bfa-image").fill("javascript:alert(1)");
    const count = await page.evaluate(() => fixture.saves.length);
    await page.locator("#bfa-save").click();
    assert.equal(
      await page.evaluate(() => fixture.saves.length),
      count,
      "invalid image URL denied"
    );
    await page.locator("#bfa-image").fill("/assets/ArchiveFilesBG.png");
    await page.evaluate(() => {
      fixture.missing = true;
      fixture.callbacks.forEach((fn) => fn("TOKEN_REFRESHED"));
    });
    await page.waitForFunction(() =>
      document
        .getElementById("bfa-existing-list")
        .textContent.includes("Legacy public-file archive")
    );
    assert.equal(
      await page.locator("#bfa-existing-list button").count(),
      0,
      "legacy file records are not edited or exported as private backend entries"
    );
    assert.equal(
      await page.locator("#bfa-post-title").inputValue(),
      "Unsent retained edit"
    );
    await page.evaluate(() => (fixture.missing = false));
    await page.locator("#bfa-refresh").click();
    await page.waitForFunction(() =>
      document.querySelector("#bfa-existing-list button")
    );
    assert.match(await page.locator("#bfa-status").textContent(), /ready/);
    await page.locator("#bfa-form").scrollIntoViewIfNeeded();
    await page.screenshot({
      path: "/workspace/scratch/dispatch-admin-desktop.png",
    });
    for (const width of [320, 390, 768]) {
      await page.setViewportSize({ width, height: 900 });
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1
        ),
        true,
        "editor fits " + width
      );
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator("#bfa-form").scrollIntoViewIfNeeded();
    await page.screenshot({
      path: "/workspace/scratch/dispatch-admin-mobile.png",
    });
    await page.evaluate(() => (fixture.mode = "hold"));
    await page.locator("#bfa-save").click();
    await page.waitForFunction(() => !!fixture.resolve);
    assert.equal(
      await page.locator("#bfa-reset").isDisabled(),
      true,
      "new draft is blocked during save"
    );
    await page
      .locator("#bfa-form")
      .evaluate((form) =>
        form.dispatchEvent(
          new Event("submit", { bubbles: true, cancelable: true })
        )
      );
    assert.equal(
      await page.evaluate(() => fixture.saves.length),
      count + 1,
      "duplicate save suppressed"
    );
    await page.evaluate(() => {
      fixture.user = null;
      fixture.callbacks.forEach((fn) => fn("SIGNED_OUT"));
      fixture.resolve();
    });
    await page.waitForFunction(
      () => document.getElementById("bfa-admin-content").hidden
    );
    await page.waitForFunction(
      () => document.getElementById("bfa-body").value === ""
    );
    assert.equal(await page.locator("#bfa-save").isDisabled(), true);
    assert.deepEqual(errors, []);
    console.log(
      "PASS protected dispatch editor: audience/drafts, safe preview, save/edit/unpublish, revision errors, setup failure retention, auth refresh, URL validation, responsive layout and sign-out/late-save denial. All API calls mocked."
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
