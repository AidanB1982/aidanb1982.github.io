import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const file = name => readFile(new URL("../" + name, import.meta.url), "utf8");
test("approved 0.2.1/code 7 metadata and closed induction gate", async () => {
  const pkg = JSON.parse(await file("package.json"));
  const lock = JSON.parse(await file("package-lock.json"));
  const gradle = await file("android/app/build.gradle");
  const induction = await file("src/author-induction.js");
  assert.equal(pkg.version, "0.2.1");
  assert.equal(lock.version, "0.2.1");
  assert.equal(lock.packages[""].version, "0.2.1");
  assert.match(gradle, /versionCode\s+7\b/);
  assert.match(gradle, /versionName\s+"0\.2\.1"/);
  assert.match(induction, /AUTHOR_INDUCTION_ENABLED\s*=\s*false/);
});
test("Account Privacy information points to Privacy Policy", async () => {
  const html = await file("src/index.html");
  assert.match(html, /data-external="https:\/\/blackwoodpublishing\.co\.uk\/pages\/privacy-policy\.html"/);
});
