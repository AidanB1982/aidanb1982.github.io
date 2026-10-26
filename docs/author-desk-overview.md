# Author Desk overview improvements

The 26 October 2026 update changes presentation and read-only navigation. It requires
no Supabase changes and makes no additional database calls beyond the existing desk's
records. `book_contributors` is fetched once and its IDs reused by the existing book
and production queries. No financial calculation, payment RPC or role check was changed.

`js/author-desk-insights.js` derives open actions, signature prompts, upcoming edition
dates and recent production history. Completed/cancelled actions are excluded from
priorities; completed timestamps also close actions. Signed documents and known
superseded versions do not trigger signature prompts. Publication dates come from
existing editions; future-dated history is not presented as a completed update.
Deadline day boundaries use Europe/London and whole-calendar-day arithmetic across DST.

The Books screen searches title, subtitle and internal reference and filters stages.
Book cards link to filtered Production or Documents & Rights. Production filters author
actions without removing the book's editions/history. Documents can show all records,
general author records or a selected book. Pending-document links open the existing
record, not a public Storage URL or a new signing service.

Desktop section buttons expose the active section to assistive technology. On small
screens a sticky section selector avoids scrolling back through the sidebar. Focus
moves to the destination heading/record; URL fragments remember the section without
storing private records in the browser. Staff-only Publishing Desk access is still
checked before allowing that section, including bookmarked links.

Existing Supabase RLS and server permissions remain essential; frontend record filtering
is not a replacement for them. Development fixtures do not prove live RLS. This update
neither queries other authors intentionally nor introduces privileged browser keys.

## Verification

- `node tests/author-desk-insights.cjs`: deadline/DST boundaries, closed actions,
  superseded signatures, upcoming editions, recent/scoped records and empty data.
- `node tests/author-desk-browser.cjs`: real page/scripts with mocked Supabase; overview,
  search/stage filters, per-book production/documents, active navigation, existing finance
  view, 1440/1024/768/390/320px layouts, sign-out and denied author access.
- Browser runner uses the same BASE_URL, CHROMIUM_PATH, READING_TEST_DIR and Playwright
  configuration as the other UI tests. Start a local static server for the checkout.

Tests do not connect to live private author records or create payment requests. The
shared Gantt planner, action writebacks, secure document viewing/signing and author launch
reporting remain in [the website to-do list](website-roadmap.md).
