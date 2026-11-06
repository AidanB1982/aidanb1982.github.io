const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH,
    args: ["--no-sandbox"],
  });
  try {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage(),
      errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await context.route("https://**/*", (route) => route.abort());
    await context.route("**/__atmosphere_test", (route) =>
      route.fulfill({
        contentType: "text/html",
        body: `<!doctype html><html><head><link rel="stylesheet" href="/css/BP-reading-atmosphere.css"><style>body{margin:0;color:#fbeed1;background:#101820;font-family:Georgia}main{min-height:100vh;padding:40px 24px;box-sizing:border-box}button{font-size:18px;padding:16px}h1{font-weight:normal;font-size:32px}.panel{margin-top:60px;padding:24px;background:#172732;border:1px solid #40505a;border-radius:14px}</style></head><body><main id="shelf"><h1>Your reading room</h1><div class="panel"><h2>The Archive Files</h2><button id="browse">Browse books</button></div></main><script type="module">import {READING_GHOST_QUOTES,startAtmosphere} from '/js/BP-reading-atmosphere.js';window.quotes=READING_GHOST_QUOTES;window.startAtmosphere=startAtmosphere;window.atmosphere=startAtmosphere(document.getElementById('shelf'));window.ready=true;</script></body></html>`,
      }),
    );
    await page.clock.install();
    await page.goto(process.env.BASE_URL + "/__atmosphere_test");
    await page.waitForFunction(
      () =>
        window.ready &&
        !document.querySelector("[data-reading-atmosphere]").hidden,
    );
    const layer = page.locator("[data-reading-atmosphere]"),
      quote = page.locator(".reading-atmosphere__quote");
    await page.evaluate(() => {
      window.startAtmosphere(null).destroy();
      window.startAtmosphere(document.getElementById("shelf")).destroy();
    });
    assert.equal(
      await layer.count(),
      1,
      "duplicate/missing starts have safe no-op cleanup",
    );
    assert.equal(await layer.getAttribute("aria-hidden"), "true");
    assert.equal(
      await layer.evaluate((el) => getComputedStyle(el).pointerEvents),
      "none",
    );
    const quotes = await page.evaluate(() => window.quotes);
    for (const q of quotes) {
      const file = path.join(process.cwd(), q.source);
      const text = fs
        .readFileSync(file, "utf8")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ");
      assert(
        text.includes(q.text),
        "Published source contains exact quote: " + q.book,
      );
    }
    const first = await quote.textContent();
    await page.clock.runFor(12500);
    assert.notEqual(
      await quote.textContent(),
      first,
      "visible shelf rotates published quotes",
    );
    await page.screenshot({
      path: "/workspace/scratch/reading-atmosphere-mobile.png",
    });
    const current = await quote.textContent();
    await page.locator("#shelf").evaluate((el) => (el.hidden = true));
    await page.waitForFunction(
      () => document.querySelector("[data-reading-atmosphere]").hidden,
    );
    await page.clock.fastForward(60000);
    assert.equal(
      await quote.textContent(),
      current,
      "hidden shelf does not rotate",
    );
    await page.locator("#shelf").evaluate((el) => (el.hidden = false));
    await page.waitForFunction(
      () => !document.querySelector("[data-reading-atmosphere]").hidden,
    );
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.waitForFunction(
      () => matchMedia("(prefers-reduced-motion: reduce)").matches,
    );
    const reduced = await quote.textContent();
    await page.clock.fastForward(60000);
    assert.equal(
      await quote.textContent(),
      reduced,
      "reduced motion shows a static quote",
    );
    await page.evaluate(() =>
      window.dispatchEvent(new PageTransitionEvent("pagehide")),
    );
    assert.equal(await layer.isHidden(), true);
    await page.clock.fastForward(60000);
    assert.equal(await quote.textContent(), reduced);
    await page.evaluate(() =>
      window.dispatchEvent(new PageTransitionEvent("pageshow")),
    );
    await page.waitForFunction(
      () => !document.querySelector("[data-reading-atmosphere]").hidden,
    );
    await page.locator("#browse").click();
    assert.equal(
      await page.evaluate(() => document.activeElement.id),
      "browse",
      "ghost text never intercepts foreground controls",
    );
    await page.evaluate(() => window.atmosphere.destroy());
    assert.equal(await layer.count(), 0);
    assert.deepEqual(errors, []);
    const app = fs.readFileSync("apps/sgeul/src/index.html", "utf8");
    for (const social of ["Facebook", "Instagram", "TikTok"])
      assert(
        app.includes(">" + social + "<") ||
          new RegExp(">\\s*" + social + "\\s*<").test(app),
        "App Account contains " + social,
      );
    console.log(
      "PASS ghost atmosphere: exact published provenance, rotation, hidden/reduced-motion/page lifecycle pause, decorative semantics, clickable controls, cleanup and labelled social destinations.",
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
