import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { AUTHOR_INDUCTION_ENABLED, validateAuthorFields } from "../src/author-induction.js";

const valid = {
  publishing_name: "Miren Vale",
  biography: "An author exploring unusual stories, quiet landscapes and the spaces between familiar worlds.",
  genres: "Dark fantasy, folk horror",
  website_url: "https://example.org/books",
  motivation: "I would like to share my writing and find readers through Sgeul.",
  charter_acknowledged: true,
  privacy_acknowledged: true
};

test("Induction remains launch-gated until owner migration and privacy review", () => {
  assert.equal(AUTHOR_INDUCTION_ENABLED, false);
  const html = readFileSync(new URL("../src/index.html", import.meta.url), "utf8");
  assert.match(html, /id="authors"/);
  assert.match(html, /id="author-induction-form" hidden/);
  assert.match(html, /id="author-profile-form" hidden/);
  assert.match(html, /Induction is not a manuscript submission/);
  assert.match(html, /not published to readers/);
  const app = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
  assert.match(app, /createAuthorInduction/);
  assert.match(app, /showView\("authors"\)/);
  assert.match(app, /authorInduction\.clear\(\)/);
});

test("Application validation accepts a controlled, acknowledged request", () => {
  const result = validateAuthorFields(valid, true);
  assert.deepEqual(result, valid);
  assert.equal(result.charter_acknowledged, true);
  assert.equal(result.privacy_acknowledged, true);
});

test("Submitting requires both Charter and privacy acknowledgement", () => {
  for (const name of ["charter_acknowledged", "privacy_acknowledged"]) {
    assert.throws(() => validateAuthorFields({ ...valid, [name]: false }, true));
  }
});

test("Rejects empty, oversized or inappropriate author profile fields", () => {
  for (const sample of [
    { publishing_name: "x" },
    { publishing_name: "x".repeat(101) },
    { biography: "Short" },
    { biography: "x".repeat(1201) },
    { genres: "x".repeat(181) },
    { website_url: "http://example.com" },
    { website_url: "https://user:pass@example.com" },
    { website_url: "javascript:alert(1)" },
    { website_url: "https://example.org/this has spaces" },
    { website_url: "https://a".repeat(100) }
  ]) assert.throws(() => validateAuthorFields({ ...valid, ...sample }));
});

test("Application requires a meaningful motivation, draft profile does not", () => {
  assert.throws(() => validateAuthorFields({ ...valid, motivation: "Hi" }, true));
  assert.ok(!("motivation" in validateAuthorFields(valid, false)));
  assert.deepEqual(Object.keys(validateAuthorFields(valid,false)).sort(),
    ["biography","genres","publishing_name","website_url"].sort());
});

test("Profile inputs are not an author permission, publication or book entitlement", () => {
  const js = readFileSync(new URL("../src/author-induction.js", import.meta.url), "utf8");
  assert.doesNotMatch(js, /\.from\(["']author_records["']\)|\.from\(["']bp_reading_memberships["']\)|\.from\(["']bp_reading_purchases["']/);
  assert.doesNotMatch(js, /service_role|is_admin\s*[:=]\s*true|desk_access_enabled\s*[:=]\s*true/);
  assert.doesNotMatch(js, /storage\.from|\.upload\(/);
});
