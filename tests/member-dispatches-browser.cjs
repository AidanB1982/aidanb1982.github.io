const { chromium } = require("playwright"),
  assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH,
    args: ["--no-sandbox"],
  });
  try {
    for (const mode of ["database", "empty", "missing", "failure"]) {
      const context = await browser.newContext({
          viewport: { width: 390, height: 900 },
          reducedMotion: "reduce",
        }),
        page = await context.newPage(),
        errors = [];
      let legacyFetches = 0;
      page.on("pageerror", (e) => errors.push(e.message));
      await context.route("https://**/*", (r) => r.abort());
      await context.route("**/js/*", (r) =>
        /\/js\/(members|arc-campaign-summary|dispatches)\.js/.test(
          r.request().url()
        )
          ? r.continue()
          : r.abort()
      );
      await context.route("**/data/BFA.json*", (r) => {
        legacyFetches++;
        return r.fulfill({
          contentType: "application/json",
          body: JSON.stringify({
            posts: [
              {
                id: "legacy-file",
                title: "Legacy archive update",
                body: "An old archive body.",
                published: true,
                publishedAt: "2026-09-06",
              },
            ],
          }),
        });
      });
      await context.addInitScript(
        ({ mode }) => {
          const user = {
              id: "00000000-0000-0000-0000-000000000123",
              email: "reader@example.test",
              user_metadata: {},
            },
            session = { access_token: "fixture-not-real", user };
          const data = [
            {
              id: "private",
              title: "Member update",
              category: "Private notes",
              body: "Members body.\n\n<script>window.dispatchXss=true</script>",
              excerpt: "For members",
              image_url: "/assets/ArchiveFilesBG.png",
              audience: "members",
              published: true,
              pinned: true,
              published_at: "2026-11-01T00:00:00Z",
              revision: 1,
            },
            {
              id: "public",
              title: "Public update",
              category: "News",
              body: "A public body",
              excerpt: "For everyone",
              image_url: "/assets/ArchiveFilesBG.png",
              audience: "public",
              published: true,
              pinned: false,
              published_at: "2026-11-07T00:00:00Z",
              revision: 1,
            },
            {
              id: "draft",
              title: "Hidden draft",
              body: "Unpublished body",
              audience: "members",
              published: false,
              published_at: "2026-01-01",
              revision: 1,
            },
          ];
          const client = {
            auth: {
              getSession: async () => ({ data: { session }, error: null }),
              getUser: async () => ({ data: { user }, error: null }),
              onAuthStateChange() {
                return { data: { subscription: { unsubscribe() {} } } };
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
                maybeSingle() {
                  return this;
                },
                then(resolve, reject) {
                  let result = { data: [], error: null };
                  if (table === "member_profiles")
                    result.data = {
                      id: user.id,
                      email: user.email,
                      display_name: "Fixture Reader",
                      reader_name: "Fixture Reader",
                      member_status: "active",
                      member_tier: "Reader",
                      points_total: 0,
                      is_admin: false,
                      is_arc_member: false,
                    };
                  if (table === "member_posts")
                    result.data = [
                      {
                        id: "old-db-file",
                        title: "Old SQL archive",
                        body: "Legacy body",
                        published_at: "2026-01-01",
                      },
                    ];
                  if (table === "bp_dispatches") {
                    if (mode === "missing")
                      result.error = {
                        code: "PGRST205",
                        message: "missingtable",
                      };
                    else if (mode === "failure")
                      result.error = {
                        code: "08006",
                        message: "backend unavailable",
                      };
                    else result.data = mode === "empty" ? [] : data;
                  }
                  return Promise.resolve(result).then(resolve, reject);
                },
              };
            },
            rpc: async () => ({ data: [], error: null }),
          };
          window.supabase = { createClient: () => client };
        },
        { mode }
      );
      await page.goto(process.env.BASE_URL + "/pages/members.html");
      await page.waitForSelector("#circle-dashboard");
      await page.waitForFunction(
        () => document.getElementById("circle-auth-loading").hidden
      );
      assert.equal(
        await page
          .locator(".circle-dashboard-hero")
          .evaluate((el) => el.nextElementSibling.id),
        "circle-panel-behindFiles",
        "dispatches first below welcome"
      );
      assert.equal(await page.locator("#circle-panel-behindFiles").count(), 1);
      const panel = page.locator("#circle-panel-behindFiles");
      if (mode === "database") {
        assert.match(
          await panel.textContent(),
          /2 dispatches.*Latest 07 Nov 2026/
        );
        assert.equal(
          await page.locator("#circle-bfa-title").textContent(),
          "Member update"
        );
        assert.equal(
          await page.locator("#circle-bfa-audience").textContent(),
          "Members only"
        );
        assert.doesNotMatch(await panel.textContent(), /Hidden draft/);
        await page.locator("#circle-bfa-read").click();
        assert.match(
          await page.locator("#circle-bfa-modal-body").textContent(),
          /<script>/
        );
        assert.equal(await page.evaluate(() => window.dispatchXss), undefined);
        await page.locator("[data-bfa-modal-close]").click();
        await page.locator("#circle-bfa-next").click();
        assert.equal(
          await page.locator("#circle-bfa-title").textContent(),
          "Public update"
        );
        assert.equal(
          await page.locator("#circle-bfa-audience").textContent(),
          "Public update"
        );
        assert.equal(legacyFetches, 0);
        await page.screenshot({
          path: "/workspace/scratch/member-dispatches-mobile.png",
          fullPage: true,
        });
      } else if (mode === "missing") {
        assert.match(await panel.textContent(), /Legacy archive update/);
        assert.equal(legacyFetches, 1);
      } else {
        assert.doesNotMatch(
          await panel.textContent(),
          /Old SQL archive|Legacy archive update/
        );
        assert.equal(
          legacyFetches,
          0,
          "empty/error DB feed must not resurrect legacyposts"
        );
        if (mode === "failure")
          assert.match(await panel.textContent(), /could not be checked/);
      }
      assert.deepEqual(errors, []);
      await context.close();
    }
    console.log(
      "PASS member dispatches: feed first, public+member labels, current latestdate, safe body, drafts hidden, authoritative empty/error feeds and migration fallback only for missing table. No live auth/datawrites."
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
