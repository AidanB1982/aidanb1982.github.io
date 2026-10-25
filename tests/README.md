Production planner browser smoke test

Serve the repository root with `python3 -m http.server 8000 --bind 127.0.0.1`.
With Playwright available to Node, run `node tests/production-planner.cjs`.
Set CHROMIUM_PATH to use an existing Chromium executable; BASE_URL defaults to
http://127.0.0.1:8000. The test uses fresh browser storage, blocks external
requests, and isolates the planner from authentication. It does not validate
live Supabase permissions or Author Desk integration. Backup output is written
to /tmp/planner-backup.json. No production data is read or changed.
