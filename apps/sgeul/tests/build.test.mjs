import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
const text = (file) => readFile(new URL("../" + file, import.meta.url), "utf8");
test("bundled reader has no remote code, website service worker, or digital checkout", async () => {
  const reader = await text("dist/reader.js"),
    html = await text("dist/pages/bp-reading.html");
  assert(!reader.includes("bp-reading-create-checkout"));
  assert(!reader.includes("bp-reading-reconcile-order"));
  assert(!reader.includes("serviceWorker.register"));
  assert(!html.match(/<script[^>]+src="https:/));
  assert(html.includes("/vendor/epub.js"));
  assert(html.includes("/reader.js"));
  assert(reader.includes("arc-assignment:"));
  assert(reader.includes("AES-GCM"));
  assert(reader.includes("bp_arc_reading_catalogue"));
});
test("physical bookshop excludes digital resources and retains the signed Gualachulain product", async () => {
  const books = JSON.parse(await text("dist/data/physical-books.json"));
  assert(books.length > 0);
  assert(
    !books.some((book) =>
      ["writer-resources", "editorial-services"].includes(book.category),
    ),
  );
  assert(books.some((book) => book.id === "16751387345241"));
});
test("native project packages local assets and disables Android backups", async () => {
  const config = JSON.parse(await text("capacitor.config.json"));
  assert.equal(config.appName, "Sgeul");
  assert.equal(config.appId, "uk.co.blackwoodpublishing.sgeul");
  assert.equal(config.server.url, undefined);
  assert.equal(config.server.androidScheme, "https");
  assert(
    (await text("android/app/src/main/AndroidManifest.xml")).includes(
      'android:allowBackup="false"',
    ),
  );
  await stat(new URL("../dist/assets/book7.png", import.meta.url));
});
