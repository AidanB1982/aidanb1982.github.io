const { chromium } = require("playwright"),
  assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH,
    args: ["--no-sandbox"],
  });
  try {
    const context = await browser.newContext(),
      page = await context.newPage();
    let posts = [],
      fail = false;
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await context.route("https://**/*", async (route) => {
      if (route.request().url().includes("formspree.io")) {
        posts.push(route.request().postData());
        return route.fulfill({
          status: fail ? 500 : 200,
          contentType: "application/json",
          headers: { "Access-Control-Allow-Origin": "*" },
          body: JSON.stringify({ ok: !fail }),
        });
      }
      return route.abort();
    });
    await page.goto(process.env.BASE_URL + "/pages/sgeul-beta.html");
    await page.locator("[data-beta-form] button[type=submit]").click();
    assert.equal(posts.length, 0);
    const fill = async () => {
      for (const [name, value] of Object.entries({
        name: "Test Reader",
        email: "contact@example.test",
        google_play_email: "google@example.test",
        member_email: "member@example.test",
        phone_model: "Pixel",
        android_version: "14",
      }))
        await page.locator(`[data-beta-form] [name="${name}"]`).fill(value);
      for (const checkbox of await page
        .locator("[data-beta-form] input[type=checkbox][required]")
        .all())
        await checkbox.check();
    };
    await fill();
    fail = true;
    await page.locator("[data-beta-form] button[type=submit]").click();
    await page.waitForFunction(() =>
      document
        .querySelector("[data-form-status]")
        .textContent.includes("couldn’t")
    );
    assert.equal(
      await page.locator("[data-beta-form] [name=email]").inputValue(),
      "contact@example.test"
    );
    assert.equal(
      await page.locator("[data-beta-form] button[type=submit]").isEnabled(),
      true
    );
    fail = false;
    await page.locator("[data-beta-form] button[type=submit]").click();
    await page.waitForFunction(() =>
      document
        .querySelector("[data-form-status]")
        .textContent.includes("place is offered")
    );
    assert.match(posts[1], /google@example.test/);
    assert.match(posts[1], /member@example.test/);
    assert.equal(
      await page.locator("[data-beta-form] [name=email]").inputValue(),
      ""
    );
    await fill();
    await page.evaluate(() =>
      Object.defineProperty(navigator, "onLine", {
        configurable: true,
        value: false,
      })
    );
    await page.locator("[data-beta-form] button[type=submit]").click();
    assert.equal(posts.length, 2);
    assert.match(
      await page.locator("[data-beta-form] [data-form-status]").textContent(),
      /internet/
    );
    await page.evaluate(() =>
      Object.defineProperty(navigator, "onLine", {
        configurable: true,
        value: true,
      })
    );
    await page
      .locator("[data-beta-form] [name=_gotcha]")
      .evaluate((el) => (el.value = "spam"));
    await page.locator("[data-beta-form] button[type=submit]").click();
    assert.equal(posts.length, 2);
    for (const path of ["sgeul-beta", "sgeul-feedback"]) {
      await page.goto(process.env.BASE_URL + "/pages/" + path + ".html");
      for (const width of [320, 390, 768, 1280]) {
        await page.setViewportSize({ width, height: 900 });
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth
          ),
          true,
          path + " overflow " + width
        );
      }
      await page.screenshot({
        path: "/workspace/scratch/" + path + ".png",
        fullPage: true,
      });
    }
    for (const input of await page
      .locator("[data-beta-form] input[required]:not([type=checkbox])")
      .all())
      await input.fill("Android 14 / Sgeul 0.1.3");
    for (const select of await page
      .locator("[data-beta-form] select[required]")
      .all())
      await select.selectOption({ index: 1 });
    for (const area of await page
      .locator("[data-beta-form] textarea[required]")
      .all())
      await area.fill(
        "The reader stopped responding after opening a saved book."
      );
    for (const checkbox of await page
      .locator("[data-beta-form] input[type=checkbox][required]")
      .all())
      await checkbox.check();
    await page.locator("[data-beta-form] button[type=submit]").click();
    await page.waitForFunction(() =>
      document
        .querySelector("[data-form-status]")
        .textContent.includes("sent privately")
    );
    assert.equal(posts.length, 3);
    assert.match(posts[2], /sgeul_beta_feedback/);
    assert.deepEqual(errors, []);
    console.log(
      "PASS beta browser: required consent, distinct emails, failed submission retains entries, success reset, offline/honeypot denial, private feedback and responsive widths. All external submissions mocked."
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
