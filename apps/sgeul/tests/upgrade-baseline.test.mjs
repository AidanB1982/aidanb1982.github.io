import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = path => readFile(new URL("../" + path, import.meta.url), "utf8");

test("0.1.3 reader and shop baseline survives in the upgraded packaged UI", async () => {
  const html = await read("dist/index.html");
  // The uploaded 0.1.3 AAB contains these existing reader destinations.
  for (const id of [
    "login-form", "home", "arc-entry", "saved-books",
    "shop", "shop-products", "account", "sign-out",
  ]) {
    assert.match(html, new RegExp('id="' + id + '"'), "Missing 0.1.3 destination: " + id);
  }
  assert.match(html, /href="\/pages\/bp-reading\.html"/);
  assert.match(html, /href="\/pages\/bp-reading\.html\?arc=1"/);
  assert.match(html, /data-view="home"/);
  assert.match(html, /data-view="shop"/);
  assert.match(html, /data-view="account"/);
});

test("upgrade adds the promised client screens without opening author applications", async () => {
  const html = await read("dist/index.html");
  const app = await read("src/app.js");
  const induction = await read("src/author-induction.js");
  assert.match(html, /data-view="authors"/);
  assert.match(html, /id="author-induction-intro"/);
  assert.match(html, /class="publisher-socials"/);
  assert.match(html, /\/css\/BP-reading-atmosphere\.css/);
  assert.match(app, /clearReadingStateForUser\(localStorage, previous\)/);
  assert.match(app, /await offline\.clear\(previous\)/);
  assert.match(induction, /export const AUTHOR_INDUCTION_ENABLED = false;/);
  assert.match(html, /data-external="https:\/\/blackwoodpublishing\.co\.uk\/pages\/privacy-policy\.html"/);
});

test("upgraded reader remains a local bundled reading app", async () => {
  const html = await read("dist/pages/bp-reading.html");
  const config = JSON.parse(await read("capacitor.config.json"));
  assert.equal(config.appId, "uk.co.blackwoodpublishing.sgeul");
  assert.equal(config.server.url, undefined);
  assert.match(html, /\/reader\.js/);
  assert.match(html, /\/vendor\/epub\.js/);
});
