Production planner browser smoke test

Serve the repository root with `python3 -m http.server 8000 --bind 127.0.0.1`.
With Playwright available to Node, run `node tests/production-planner.cjs`.
Set CHROMIUM_PATH to use an existing Chromium executable; BASE_URL defaults to
http://127.0.0.1:8000. The test uses fresh browser storage, blocks external
requests, and isolates the planner from authentication. It does not validate
live Supabase permissions or Author Desk integration. Backup output is written
to /tmp/planner-backup.json. No production data is read or changed.

BP Reading browser smoke test

This test uses the actual EPUB.js renderer with a generated two-chapter EPUB.
Supabase authentication and EPUB delivery are mocked; no live accounts or
protected books are accessed. It covers chapter navigation and return, typography,
themes, bookmarks, keyboard turns, search, saved-state reload, mobile width, and
sign-out. It records screenshots and reports uncaught browser errors.

With the same local server and Playwright prerequisites as above:

```sh
python3 tests/reading-fixture.py
curl -fL https://cdn.jsdelivr.net/npm/epubjs@0.3.93/dist/epub.min.js -o /tmp/blackwood-reading-test/epub.min.js
curl -fL https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js -o /tmp/blackwood-reading-test/jszip.min.js
node tests/bp-reading.cjs
```

CHROMIUM_PATH and BASE_URL work as above. READING_TEST_DIR changes the fixture,
dependency, and screenshot directory (default /tmp/blackwood-reading-test).
Live protected-book delivery and real-device touch gestures still need acceptance
testing in a signed-in account. This test mocks an administrator account and uses a generated book; it does not
establish live customer access.

BP Reading service foundations

- `node tests/reading-account.mjs` checks the sync client's persistent outbox,
  conflict detection, explicit server reload, device-only fallback and in-flight edits.
- With `@electric-sql/pglite` available to Node, `node tests/reading-schema.cjs`
  executes the SQL migration in an isolated embedded PostgreSQL instance. It tests
  subscription expiry, title purchases across replacement editions, revocation,
  denied self-grants, private state RLS, concurrency and payload limits. Supabase
  Auth is represented by a minimal test schema. No real project is accessed.
- The browser smoke test also checks device-only notes and personal watermarks.

Deployment prerequisites and remaining service work are in
`docs/bp-reading-service.md`. These foundations do not activate paid access.
- `node tests/reading-library.cjs` uses the same EPUB/dependency fixtures and
  Playwright settings. It tests a two-book catalogue, author filtering, edition
  switching, cloud snapshot writes, restoring notes after clearing the device
  cache, and notebook isolation between editions. Its Supabase server is mocked;
  this is not a live-project test.

- `node tests/reading-delivery.mjs` exercises the TypeScript delivery handler with
  Node 24's built-in type stripping and mocked Supabase clients. It verifies the
  legacy admin path, disabled customer gate, caller-JWT entitlement checks,
  explicit exact-file release approvals, malformed requests, CORS, no-store
  headers, and denial before Storage access. It does not deploy the Deno entry
  point or contact the real project.

Membership popup and payment foundations

- `node tests/reading-create-checkout.mjs`: exact annual plan and fixed variant,
  GBP price checks, authenticated checkout binding and both disabled launch gates.
- `node tests/reading-popup.mjs`: popup failures, retained website, no access from
  closing the window, server-confirmed status and refund handling.
- `node tests/reading-shopify-webhook.mjs`: raw-body signatures, expected shop,
  authoritative order facts, offer checks, verified timestamps and refund routing.
- The embedded PostgreSQL test also applies the second migration and exercises
  server-only grants, private checkout polling, leap days, duplicate notifications,
  renewal dates, refunds and replay after refunds.
- Set READING_CUSTOMER_TEST=1 when running reading-library.cjs to exercise a
  non-admin paid reader. READING_LOCKED_TEST=1 tests a signed-in nonmember whose
  protected books remain locked. These use mocked entitlement responses.

The Deno entry points and real Shopify GraphQL responses require staging checks;
these local tests do not establish that payment credentials or webhooks are live.
- `node tests/reading-shopify-auth.mjs` tests server-side app authentication,
  expiry refresh, concurrent requests, forced refresh and credential rotation
  using mocked OAuth responses. Live app eligibility and permissions still need
  verification after secure Supabase configuration.
- `node tests/reading-setup-check.mjs` verifies that the admin-only live setup
  diagnostic performs read-only checks, denies non-admins and returns no secret
  values. Shopify responses are mocked; the deployed diagnostic performs the
  real read-only checks while launch flags remain disabled.

The checkout handler test additionally checks that the explicit admin preview
works with both launch flags disabled, non-admin previews are denied before any
cart/intent is created, and the ordinary customer checkout remains disabled.

Controlled payment tests use an exact server-configured test profile while both
public launch flags stay false. Checkout tests cover that user's exception and
other users' continued denial. Delivery tests require the tester's normal paid
entitlement and approved file. Webhook tests ensure simulated orders are ignored
without explicit test-account approval and retain test receipt provenance.
Generated dashboard bundles can be checked with
`python3 scripts/bundle-edge-functions.py --check`; they use the same tested
handlers and require only one index.ts paste per function.

- `node tests/reading-reconcile-order.mjs` exercises authenticated admin recovery
  against the same payment verifier as signed webhooks. It checks denied
  non-admins, exact order-name lookup, unpaid/zero-value orders, missing checkout
  bindings, test-account restrictions and ignored browser entitlement assertions.
  Real Shopify order lookup remains a deployed acceptance test.

Membership presentation is covered by reading-library.cjs: the active subscriber
mode hides the annual offer and shows the paid-through date; individual-book
owners retain the offer; expired/revoked modes show locked books and the offer;
administrators have no subscription requirement. Use READING_PURCHASE_TEST=1,
READING_EXPIRED_TEST=1 or READING_REVOKED_TEST=1 for those cases. The browser test
also checks the compact headline size and exercises actual EPUB rendering.

Blank-page regression coverage: `tests/reading-fixture.py <folder>
--publisher-colours` generates a book whose publisher CSS makes text match the
parchment background. With the same pinned JS libraries in that folder, run the
reader library browser test against it; it asserts visible prose and the chosen
reader font/colour. Reader tests also check that the entire subscription-offer
node is absent for active members, restored on revocation, and removed again on
reactivation. The headline is capped at 28px. The full reader smoke test covers
selection, themes, resized pages, navigation, search and saved-position reload.


Visual polish checks

`node tests/site-polish.cjs` uses the same BASE_URL, CHROMIUM_PATH and
READING_TEST_DIR settings as the reader tests. It checks shared stylesheet loading,
page overflow and mobile account navigation on nine representative pages at
1440px and 390px widths, and saves screenshots. External services are blocked;
it does not submit forms, place orders or verify live payment behaviour.

The reader smoke test also checks idle controls, waking controls with pointer
movement, visual theme selection, the live appearance preview and reopening a
book from Continue reading. Its repeated forward/backward turns check visible
prose and stable pagination across chapter boundaries. The library test checks
membership inclusion, verified ownership and completed-book badges, and excludes
completed books from the resume feature. These run against mocked Supabase data.
