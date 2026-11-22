import {test} from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const read = filename => fs.readFileSync(filename, "utf8");
const about = read("pages/about.html");
const globalNav = read("js/header.js");
const fallbackHeader = read("header.html");
const charter = read("pages/author-charter.html");
const submissions = read("pages/submissions.html");
const charterStyles = read("css/author-charter.css");
const submissionStyles = read("css/submissions.css");
const readinessDoc = read("docs/author-intake-readiness.md");
const limited = read("pages/LimitedEditions.html");
const home = read("index.html");
const publicFinder = read("pages/find-bookshops.html");
const finderScript = read("js/public-bookshops.js");
const footer = read("footer.html");
const resources = read("pages/resources.html");
const refunds = read("pages/refund-policy.html");
const terms = read("pages/terms-of-service.html");
const css = read("css/publisher-about.css");

function localLinks(content) {
  return [...content.matchAll(/href="(\/[^"]+)"/g)].map(match =>
    match[1].split(/[?#]/,1)[0]);
}

test("About Blackwood is an actual publishing-house page, not Limited Editions", () => {
  assert.notEqual(about, limited);
  assert.match(about, /<title>About Blackwood Publishing/);
  assert.match(about, /<h1>About Blackwood Publishing<\/h1>/);
  assert.doesNotMatch(about, /<h1>Objects from the Archive<\/h1>/);
  assert.match(about, /id="main-content"/);
  assert.match(about, /id="footer-placeholder"/);
  assert.match(about, /header\.js/);
  assert.equal((about.match(/<h1\b/g) || []).length,1);
});

test("About links to established authors, books and the contact page", () => {
  for (const destination of [
    "/pages/author.html", "/pages/miren-vale.html",
    "/pages/martin-hales.html", "/pages/publications.html",
    "/pages/store.html", "/pages/contact.html"
  ]) assert.ok(about.includes('href="' + destination + '"'),destination);
  assert.match(about, /bookshop trail is a discovery directory/);
  assert.match(about, /not automatically verified independents/);
});

test("New landing pages contain only valid existing local destinations and assets", () => {
  for (const [filename,content] of [
    ["pages/about.html",about],
    ["pages/author-charter.html",charter],
    ["pages/submissions.html",submissions],
    ["pages/resources.html",resources],
    ["pages/refund-policy.html",refunds],
    ["pages/terms-of-service.html",terms]
  ]) {
    for (const href of localLinks(content)) {
      assert.ok(fs.existsSync(href.slice(1)),
        filename + " has a missing local destination: " + href);
    }
  }
  for (const asset of ["assets/profile.jpg","assets/MirenVale.png",
    "assets/book18.jpg"]) assert.ok(fs.existsSync(asset),asset);
});

test("Resource link leads to meaningful reader and practical-guide destinations", () => {
  assert.match(footer, /href="\/pages\/resources\.html"/);
  assert.match(resources, /href="\/pages\/reading-lists\.html"/);
  assert.match(resources, /href="\/pages\/martin-hales\.html"/);
  assert.match(resources, /href="\/pages\/reading-preview\.html\?book=holdfast"/);
  assert.match(resources, /href="\/pages\/contact\.html"/);
});

test("Refund and terms routes use real published Blackwood Shopify policies", () => {
  const officialRefund =
    "https://checkout.shopify.com/102754976089/policies/63282741593.html?locale=en";
  const officialTerms =
    "https://checkout.shopify.com/102754976089/policies/63283003737.html?locale=en";
  assert.ok(refunds.includes(officialRefund));
  assert.ok(terms.includes(officialTerms));
  assert.ok(footer.includes(officialRefund));
  assert.ok(footer.includes(officialTerms));
  assert.match(footer, /aria-label="Refund policy on Shopify/);
  assert.match(footer, /aria-label="Terms of service on Shopify/);
  assert.doesNotMatch(refunds,/we (offer|guarantee) (all|any) refunds/i);
  assert.doesNotMatch(terms,/Blackwood (guarantees|requires) refunds/i);
});

test("Homepage now describes UK bookshop candidates without calling them verified", () => {
  assert.doesNotMatch(home,/Scotland-focused bookshop map/);
  assert.match(home,/Explore bookshops across the UK/);
  assert.match(home,/not verified independents or confirmed Blackwood stockists/);
});

test("Public finder and dynamic disclaimer match the current UK discovery data", () => {
  assert.match(publicFinder, /UK-wide bookshop discovery listings/);
  assert.match(publicFinder, /Coverage varies by region/);
  assert.match(publicFinder, /does not confirm independent ownership/);
  assert.doesNotMatch(publicFinder,/Scotland-focused for now/);
  assert.match(finderScript,/The UK bookshop discovery map covers the country/);
  assert.match(finderScript,/Inclusion does not confirm independence/);
});

test("About styling is scoped, responsive and avoids adding heavy forest imagery", () => {
  assert.match(css,/body\.publisher-about-page/);
  assert.match(css,/@media \(max-width: 600px\)/);
  assert.doesNotMatch(css,/forest\.png/);
});

test("No private outreach system or checkout data imported into public pages", () => {
  for (const content of [about,resources,refunds,terms]) {
    assert.doesNotMatch(content,/blackwood-bookshop-outreach-v1/);
    assert.doesNotMatch(content,/functions\.invoke|service_role|localStorage\./);
  }
  assert.ok(fs.existsSync("pages/bookshop-outreach.html"));
});


test("About leads with Blackwood's exact author-centred mission and motto", () => {
  assert.match(about, /Independent voices\. Extraordinary stories\./);
  assert.match(about, /To give independent voices the opportunity to be heard, stories the care they deserve, and readers new worlds to discover\./);
  const purposeAt = about.indexOf('id="publisher-mission-title"');
  const writersAt = about.indexOf('id="publisher-people-title"');
  assert.ok(purposeAt !== -1 && purposeAt < writersAt,
    "mission should appear before writer profiles");
  assert.match(about, /emerging, independent and overlooked authors/);
});

test("All five Blackwood values appear once and in the founding order", () => {
  const values = [
    "Every Voice Matters",
    "Fairness Without Compromise",
    "Stories Worth Telling",
    "Stronger Through Community",
    "Progress With Purpose"
  ];
  const positions = values.map(value => {
    assert.equal(about.split('<h3>' + value + '</h3>').length - 1, 1,
      "value heading should appear exactly once: " + value);
    return about.indexOf('<h3>' + value + '</h3>');
  });
  assert.deepEqual([...positions].sort((a, b) => a - b), positions);
  assert.match(about, /<ol class="publisher-values-grid">/);
  assert.equal((about.match(/class="publisher-value"/g) || []).length, 5);
  assert.match(about, /Technology should serve stories and people, never overshadow them\./);
});

test("Fairness and author rights are values, not undeveloped contractual claims", () => {
  assert.match(about, /fair rewards and control over their creative work/);
  assert.match(about, /Individual rights, royalties and publication terms must always be explained in a written agreement/);
  assert.match(about, /does not replace those terms or guarantee publication/);
  assert.doesNotMatch(about, /guaranteed royalties|guaranteed acceptance/i);
});

test("Core values render in a responsive, About-only section", () => {
  assert.match(about, /<section class="publisher-purpose" aria-labelledby="publisher-mission-title">/);
  assert.match(about, /<section class="publisher-values" aria-labelledby="publisher-values-title">/);
  assert.match(css, /body\.publisher-about-page \.publisher-values-grid/);
  assert.match(css, /@media \(max-width: 700px\)/);
  assert.match(css, /grid-template-columns: 1fr;/);
});


test("The Author Charter is visible from About, submissions and the footer", () => {
  assert.match(about, /href="\/pages\/author-charter\.html"/);
  assert.match(submissions, /href="\/pages\/author-charter\.html"/);
  assert.match(footer, /href="\/pages\/author-charter\.html"/);
  assert.match(charter, /<h1>Our Author Charter<\/h1>/);
  assert.match(charter, /href="\/pages\/submissions\.html"/);
  assert.match(charter, /href="\/pages\/about\.html"/);
  assert.match(charter, /id="main-content"/);
  assert.match(charter, /id="footer-placeholder"/);
  assert.equal((charter.match(/<h1\b/g) || []).length, 1);
});

test("Charter preserves the approved author mission and stated acquisition principles", () => {
  assert.match(charter, /Independent voices\. Extraordinary stories\./);
  assert.match(charter, /To give independent voices the opportunity to be heard, stories the care they deserve, and readers new worlds to discover\./);
  assert.match(charter, /do not charge authors a manuscript reading or consideration fee/);
  assert.match(charter, /The author retains copyright/);
  assert.match(charter, /publishing rights expressly agreed in a signed publishing agreement/);
  assert.match(charter, /house carries the ordinary financial and operational risk/);
  assert.match(charter, /funds the editorial, design, production and publishing work agreed/);
  assert.match(charter, /emerging, independent and overlooked authors/);
});

test("Charter distinguishes approved principles from unfinished author terms", () => {
  assert.match(charter, /The standards we are building/);
  assert.match(charter, /not claims that every system or term is already in place/);
  assert.match(charter, /royalties, calculation bases, deductions, reporting arrangements and payment terms/);
  assert.match(charter, /not a contract, an offer to publish or a statement of agreed royalty percentages/);
  assert.match(charter, /must be set out in an individual written agreement/);
  assert.doesNotMatch(charter, /guaranteed royalty|minimum earnings|guaranteed publication/i);
});

test("The submissions page honestly remains closed without obsolete opening promises", () => {
  assert.match(submissions, /Submissions are currently closed\./);
  assert.match(submissions, /Our next manuscript reading window has not yet been announced/);
  assert.match(submissions, /secure submission route/);
  assert.match(submissions, /Please do not send a manuscript through the general contact form/);
  assert.match(submissions, /Not yet announced/);
  assert.match(submissions, /emerging, independent and\s+overlooked authors/);
  assert.doesNotMatch(submissions, /Opening in November|Opening November 2026|will open its next manuscript\s+submission window in November/i);
});

test("Neither the charter nor submissions expose an unapproved upload or sign-up", () => {
  for (const page of [charter, submissions]) {
    assert.doesNotMatch(page, /<form\b/i);
    assert.doesNotMatch(page, /<input\b[^>]*type=["']?file/i);
    assert.doesNotMatch(page, /formspree\.io|supabase\.functions\.invoke|author_role|createAuthorProfile/i);
  }
  assert.match(charter, /There is no open application or manuscript upload route at present/);
  assert.match(readinessDoc, /Gate A — before announcing a manuscript reading window/);
  assert.match(readinessDoc, /Gate B — future Sgeul author induction/);
  assert.match(readinessDoc, /No automatic import, role upgrade, author payment or launch is in PR #16/);
});

test("Charter and submissions signpost styles are scoped and responsive", () => {
  assert.match(charterStyles, /body\.publisher-charter-page/);
  assert.match(charterStyles, /@media \(max-width: 620px\)/);
  assert.match(charterStyles, /grid-template-columns: 1fr/);
  assert.match(submissionStyles, /\.submissions-charter/);
  assert.match(submissionStyles, /@media \(max-width: 640px\)/);
  assert.match(charter, /rel="canonical"/);
  assert.match(charter, /og:description/);
});


test("Our Author Charter appears under About Blackwood in the shared About dropdown", () => {
  const aboutOpen = globalNav.indexOf('aria-label="About"');
  const nextMenu = globalNav.indexOf('aria-label="Community"', aboutOpen);
  assert.ok(aboutOpen >= 0 && nextMenu > aboutOpen);
  const aboutMenu = globalNav.slice(aboutOpen, nextMenu);
  const aboutPage = aboutMenu.indexOf('href="/pages/about.html"');
  const charterPage = aboutMenu.indexOf('href="/pages/author-charter.html"');
  const submissionsPage = aboutMenu.indexOf('href="/pages/submissions.html"');
  assert.ok(aboutPage >= 0 && charterPage > aboutPage && submissionsPage > charterPage,
    "About Blackwood → Our Author Charter → Submissions should be in order");
  assert.equal((aboutMenu.match(/href="\/pages\/author-charter\.html"/g) || []).length, 1);
  assert.match(aboutMenu, /href="\/pages\/author-charter\.html" role="menuitem"/);
  assert.ok(fallbackHeader.includes('href="/pages/author-charter.html"'));
});

test("Key entry pages refresh the shared navigation script version", () => {
  const expected = '/js/header.js?v=20261122-author-charter-nav';
  for (const [page, html] of [
    ["Homepage", home], ["About Blackwood", about],
    ["Author Charter", charter], ["Submissions", submissions]
  ]) {
    assert.ok(html.includes(expected), page + " should load refreshed navigation");
  }
});
