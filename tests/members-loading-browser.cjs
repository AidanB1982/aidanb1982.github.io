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
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await context.route("https://**/*", (route) => route.abort());
    await context.route("**/js/*", (route) =>
      /\/js\/(members|arc-campaign-summary)\.js/.test(route.request().url())
        ? route.continue()
        : route.abort()
    );
    await context.route("**/data/BFA.json*", (route) =>
      route.fulfill({ contentType: "application/json", body: '{"posts":[]}' })
    );
    await context.addInitScript(() => {
      const user = {
        id: "00000000-0000-0000-0000-000000000123",
        email: "reader@example.test",
        user_metadata: { display_name: "Fixture Reader" },
      };
      const session = { access_token: "fixture-not-a-real-token", user };
      window.testAuth = {
        calls: 0,
        profiles: 0,
        session,
        callback: null,
        resolve: null,
        dashboardError: false,
      };
      const client = {
        auth: {
          onAuthStateChange(callback) {
            window.testAuth.callback = callback;
            return { data: { subscription: { unsubscribe() {} } } };
          },
          async getSession() {
            if (location.search.includes("test-init=1"))
              return new Promise(
                (resolve) => (window.testAuth.resolveInitial = resolve)
              );
            return { data: { session: null }, error: null };
          },
          async signInWithPassword() {
            window.testAuth.calls++;
            const result = await new Promise(
              (resolve) => (window.testAuth.resolve = resolve)
            );
            if (!result.error)
              window.testAuth.callback("SIGNED_IN", result.data.session);
            return result;
          },
          async resetPasswordForEmail() {
            return { data: {}, error: null };
          },
          async updateUser() {
            return { data: { user }, error: null };
          },
          async signOut() {
            window.testAuth.callback("SIGNED_OUT", null);
            return { error: null };
          },
        },
        from(table) {
          const builder = {
            select() {
              return this;
            },
            eq() {
              return this;
            },
            order() {
              return this;
            },
            maybeSingle() {
              return this;
            },
            then(resolve, reject) {
              if (table === "member_profiles") window.testAuth.profiles++;
              const profile = {
                id: user.id,
                email: user.email,
                display_name: "Fixture Reader",
                reader_name: "Fixture Reader",
                member_status: "active",
                member_tier: "Reader",
                points_total: 25,
                is_admin: false,
                is_arc_member: false,
              };
              const result =
                table === "member_profiles"
                  ? {
                      data: profile,
                      error: window.testAuth.dashboardError
                        ? { message: "Fixture dashboard failure" }
                        : null,
                    }
                  : {
                      data: table === "author_records" ? null : [],
                      error: null,
                    };
              if (table === "member_profiles" && window.testAuth.holdProfile)
                return new Promise(
                  (done) =>
                    (window.testAuth.resolveProfile = () => done(result))
                ).then(resolve, reject);
              return Promise.resolve(result).then(resolve, reject);
            },
          };
          return builder;
        },
        async rpc() {
          return { data: [], error: null };
        },
      };
      window.supabase = {
        createClient() {
          return client;
        },
      };
    });
    const base = process.env.BASE_URL;
    await page.goto(base + "/pages/members.html?test-init=1");
    await page.waitForFunction(
      () =>
        window.testAuth.resolveInitial &&
        !document.getElementById("circle-auth-loading").hidden
    );
    assert.equal(
      await page.locator("#blackwood-circle-app").getAttribute("aria-busy"),
      "true"
    );
    await page.evaluate(() =>
      window.testAuth.resolveInitial({ data: { session: null }, error: null })
    );
    await page.waitForFunction(() =>
      document.getElementById("circle-sign-in-form")
    );
    const overlay = page.locator("#circle-auth-loading");
    await page.waitForFunction(
      () => document.getElementById("circle-auth-loading").hidden
    );
    assert.equal(
      await page.locator("#blackwood-circle-app").getAttribute("aria-busy"),
      null
    );
    await page.locator("#circle-sign-in-form button[type=submit]").click();
    assert.equal(
      await page.evaluate(() => window.testAuth.calls),
      0,
      "invalid credentials do not show loading or send auth"
    );
    await page.locator("#circle-sign-in-email").fill("reader@example.test");
    await page.locator("#circle-sign-in-password").fill("not-a-real-password");
    await page.clock.install();
    const signIn = page.locator("#circle-sign-in-form button[type=submit]");
    await signIn.click();
    await page.waitForFunction(() => window.testAuth.resolve);
    assert.equal(await overlay.isVisible(), true);
    assert.equal(
      await page.locator("#blackwood-circle-app").evaluate((el) => el.inert),
      true
    );
    assert.equal(await signIn.isDisabled(), true);
    await page
      .locator("#circle-sign-in-form")
      .evaluate((form) =>
        form.dispatchEvent(
          new Event("submit", { cancelable: true, bubbles: true })
        )
      );
    assert.equal(
      await page.evaluate(() => window.testAuth.calls),
      1,
      "repeated submit cannot duplicate auth"
    );
    await page.clock.fastForward(8100);
    assert.equal(
      await overlay
        .getByRole("button", { name: "Continue browsing" })
        .isVisible(),
      true
    );
    await overlay.getByRole("button", { name: "Continue browsing" }).click();
    assert.equal(await overlay.isHidden(), true);
    assert.equal(
      await page.locator("#blackwood-circle-app").evaluate((el) => el.inert),
      false
    );
    assert.equal(
      await signIn.isDisabled(),
      true,
      "dismissal does not pretend auth was cancelled"
    );
    await page.evaluate(() =>
      window.testAuth.resolve({
        data: { session: null },
        error: { message: "Invalid login credentials" },
      })
    );
    await page.waitForFunction(
      () =>
        !document.querySelector("#circle-sign-in-form button[type=submit]")
          .disabled
    );
    assert.match(
      await page.locator("#circle-auth-status").textContent(),
      /Invalid|incorrect|password|not recognised/i
    );
    assert.equal(
      await page.locator("#circle-sign-in-password").inputValue(),
      "not-a-real-password"
    );
    await signIn.click();
    await page.waitForFunction(
      () => !document.getElementById("circle-auth-loading").hidden
    );
    await overlay.evaluate((el) =>
      el.getAnimations().forEach((animation) => {
        if (Number.isFinite(animation.effect.getComputedTiming().endTime))
          animation.finish();
      })
    );
    assert.equal(
      await overlay.evaluate((el) => getComputedStyle(el).opacity),
      "1"
    );
    await page.screenshot({
      path: "/workspace/scratch/members-login-loading-mobile.png",
    });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.screenshot({
      path: "/workspace/scratch/members-login-loading-desktop.png",
    });
    await page.emulateMedia({ reducedMotion: "reduce" });
    assert.equal(
      await overlay
        .locator("img")
        .evaluate((el) => getComputedStyle(el).animationName),
      "none"
    );
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.evaluate(() =>
      window.testAuth.resolve({
        data: { session: window.testAuth.session },
        error: null,
      })
    );
    await page.waitForFunction(() =>
      document.getElementById("circle-dashboard")
    );
    await page.waitForFunction(
      () => document.getElementById("circle-auth-loading").hidden
    );
    assert.equal(
      await page.evaluate(() => window.testAuth.profiles),
      1,
      "sign-in callback and explicit load share one dashboard operation"
    );
    assert.equal(
      await page.locator("#blackwood-circle-app").evaluate((el) => el.inert),
      false
    );
    assert.equal(
      await page.locator("#blackwood-circle-app").getAttribute("aria-busy"),
      null
    );
    assert.match(
      await page.locator("#circle-dashboard").textContent(),
      /Fixture Reader/
    );
    // A recovery event must stay usable even when a previous dashboard fetch is slow.
    await page.goto(base + "/pages/members.html");
    await page.waitForFunction(() =>
      document.getElementById("circle-sign-in-form")
    );
    await page.locator("#circle-sign-in-email").fill("reader@example.test");
    await page.locator("#circle-sign-in-password").fill("not-a-real-password");
    await page.evaluate(() => (window.testAuth.holdProfile = true));
    await page.locator("#circle-sign-in-form button[type=submit]").click();
    await page.evaluate(() =>
      window.testAuth.resolve({
        data: { session: window.testAuth.session },
        error: null,
      })
    );
    await page.waitForFunction(() => window.testAuth.resolveProfile);
    await page.evaluate(() =>
      window.testAuth.callback("PASSWORD_RECOVERY", window.testAuth.session)
    );
    assert.equal(
      await page.locator("#circle-password-update-form").isVisible(),
      true
    );
    assert.equal(
      await page.locator("#blackwood-circle-app").getAttribute("aria-busy"),
      null
    );
    await page.evaluate(() => window.testAuth.resolveProfile());
    await page.waitForFunction(
      () => document.getElementById("circle-auth-loading").hidden
    );
    assert.equal(
      await page.locator("#circle-password-update-form").isVisible(),
      true
    );
    assert.equal(
      await page.locator("#circle-dashboard").count(),
      0,
      "late dashboard does not overwrite password recovery"
    );

    await page.goto(base + "/pages/members.html");
    await page.waitForFunction(() =>
      document.getElementById("circle-sign-in-form")
    );
    await page.locator("#circle-sign-in-email").fill("reader@example.test");
    await page.locator("#circle-sign-in-password").fill("not-a-real-password");
    await page.evaluate(() => (window.testAuth.dashboardError = true));
    await page.locator("#circle-sign-in-form button[type=submit]").click();
    await page.evaluate(() =>
      window.testAuth.resolve({
        data: { session: window.testAuth.session },
        error: null,
      })
    );
    await page.waitForFunction(() =>
      document.getElementById("circle-reload-page")
    );
    assert.equal(
      await overlay.isHidden(),
      true,
      "dashboard errors clear fullscreen loading"
    );
    assert.equal(
      await page.locator("#blackwood-circle-app").evaluate((el) => el.inert),
      false
    );

    await page.goto(base + "/pages/members.html");
    await page.waitForFunction(() =>
      document.getElementById("circle-sign-in-form")
    );
    await page.locator("#circle-sign-in-email").fill("reader@example.test");
    await page.locator("#circle-sign-in-password").fill("not-a-real-password");
    await page.locator("#circle-sign-in-form button[type=submit]").click();
    await page.evaluate(() =>
      window.testAuth.resolve({
        data: { session: null },
        error: { message: "Invalid login credentials" },
      })
    );
    await page.waitForFunction(
      () =>
        !document.querySelector("#circle-sign-in-form button[type=submit]")
          .disabled
    );
    assert.equal(
      await page
        .locator("#circle-sign-in-form button[type=submit]")
        .evaluate((el) => document.activeElement === el),
      true,
      "failed sign-in restores submit focus"
    );

    await page.goto(base + "/pages/members.html?reset-password=1");
    await page.waitForFunction(() =>
      document.getElementById("circle-sign-in-form")
    );
    await page.locator("#circle-sign-in-email").fill("reader@example.test");
    await page.locator("#circle-sign-in-password").fill("not-a-real-password");
    await page.locator("#circle-sign-in-form button[type=submit]").click();
    await page.evaluate(() =>
      window.testAuth.resolve({
        data: { session: window.testAuth.session },
        error: null,
      })
    );
    await page.waitForFunction(() =>
      document.getElementById("circle-password-update-form")
    );
    assert.equal(
      await overlay.isHidden(),
      true,
      "recovery form is not covered by loader"
    );
    assert.equal(
      await page.locator("#blackwood-circle-app").evaluate((el) => el.inert),
      false
    );
    for (const width of [320, 390, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1
        ),
        true,
        "page fits " + width
      );
    }
    assert.deepEqual(errors, []);
    console.log(
      "PASS members login loader: actual init, delayed sign-in, duplicate denial, slow-screen dismissal, error recovery, dashboard success/coalescing, recovery route and responsive widths. No live auth or email."
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
