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
testing in a signed-in account. Reading data remains device-local and the library
remains the existing administrator-only Gualachulain edition.
