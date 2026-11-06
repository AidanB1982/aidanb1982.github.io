const { chromium } = require("playwright"),
  assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH,
    args: ["--no-sandbox"],
  });
  try {
    const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
      }),
      page = await context.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    let mode = "fail",
      resolveToken,
      tokenRequests = 0;
    const gate = () => new Promise((r) => (resolveToken = r));
    const user = {
      id: "00000000-0000-0000-0000-000000000123",
      aud: "authenticated",
      role: "authenticated",
      email: "reader@example.invalid",
      app_metadata: { provider: "email" },
      user_metadata: {},
      created_at: new Date().toISOString(),
    };
    const part = (x) => Buffer.from(JSON.stringify(x)).toString("base64url"),
      token =
        part({ alg: "HS256", typ: "JWT" }) +
        "." +
        part({
          sub: user.id,
          exp: Math.floor(Date.now() / 1000) + 3600,
          aud: "authenticated",
        }) +
        ".fixture",
      session = {
        access_token: token,
        refresh_token: "fixture",
        token_type: "bearer",
        expires_in: 3600,
        user,
      };
    await context.route("https://**/*", async (route) => {
      const url = route.request().url(),
        headers = {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "*",
        };
      const json = (value, status = 200) =>
        route.fulfill({
          status,
          headers,
          contentType: "application/json",
          body: JSON.stringify(value),
        });
      if (route.request().method() === "OPTIONS")
        return route.fulfill({ status: 204, headers });
      if (url.includes("/auth/v1/token")) {
        tokenRequests++;
        await gate();
        return mode === "fail"
          ? json(
              {
                error: "invalid_grant",
                error_description: "Invalid login credentials",
              },
              400,
            )
          : json(session);
      }
      if (url.includes("/auth/v1/user")) return json(user);
      if (url.includes("/rpc/bp_arc_reading_catalogue")) return json([]);
      if (url.includes("/rest/v1/")) return json([]);
      return route.abort();
    });
    await page.goto(process.env.BASE_URL);
    await page.waitForFunction(
      () =>
        document.getElementById("auth-loading").hidden &&
        !document.getElementById("sign-in").hidden,
    );
    await page.locator("[name=email]").fill(user.email);
    await page.locator("[name=password]").fill("fixture-not-a-real-password");
    await page.locator("#login-button").click();
    await page.waitForFunction(
      () => !document.getElementById("auth-loading").hidden,
    );
    assert.equal(await page.locator("#app").evaluate((el) => el.inert), true);
    assert.equal(await page.locator("#login-button").isDisabled(), true);
    assert.equal(
      await page.locator("#auth-loading").getAttribute("role"),
      "dialog",
    );
    await page.waitForFunction(
      () =>
        getComputedStyle(document.getElementById("auth-loading")).opacity ===
        "1",
    );
    await page.screenshot({
      path: "/workspace/scratch/sgeul-login-loading-mobile.png",
    });
    for (const width of [320, 390, 768, 1280]) {
      await page.setViewportSize({ width, height: 844 });
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
      );
    }
    await page.screenshot({
      path: "/workspace/scratch/sgeul-login-loading-desktop.png",
    });
    assert.equal(tokenRequests, 1);
    resolveToken();
    await page.waitForFunction(
      () =>
        document.getElementById("auth-loading").hidden &&
        document
          .getElementById("login-status")
          .textContent.includes("Sign-in failed"),
    );
    assert.equal(await page.locator("#app").evaluate((el) => el.inert), false);
    assert.equal(await page.locator("[name=email]").inputValue(), user.email);
    assert.equal(await page.locator("#login-button").isEnabled(), true);
    assert.equal(
      await page.evaluate(() => document.activeElement.id),
      "login-button",
    );
    mode = "success";
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.locator("#login-button").click();
    await page.waitForFunction(
      () => !document.getElementById("auth-loading").hidden,
    );
    assert.equal(
      await page
        .locator(".auth-loading__mark img")
        .evaluate((el) => getComputedStyle(el).animationName),
      "none",
    );
    await page.waitForFunction(
      () => !document.querySelector("[data-loading-dismiss]").hidden,
      {},
      { timeout: 12000 },
    );
    await page.getByRole("button", { name: "Continue browsing" }).click();
    assert.equal(await page.locator("#auth-loading").isHidden(), true);
    assert.equal(await page.locator("#app").evaluate((el) => el.inert), false);
    assert.equal(
      await page.locator("#login-button").isDisabled(),
      true,
      "dismiss does not start a second sign-in or pretend to cancel",
    );
    assert.equal(tokenRequests, 2);
    resolveToken();
    await page.waitForFunction(
      () =>
        !document.getElementById("home").hidden &&
        !document.getElementById("login-button").disabled,
    );
    assert.equal(await page.locator("#auth-loading").isHidden(), true);
    assert.equal(await page.locator("#app").getAttribute("aria-busy"), null);
    assert.deepEqual(errors, []);
    console.log(
      "PASS login loader: real SDK delayed sign-in, busy/inert/focus, error recovery, responsive widths, reduced motion, slow dismissal without duplicate requests, eventual successful login.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
