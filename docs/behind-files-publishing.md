# Behind the Files: public and member updates

Prepared **7 November 2026**. The existing management page remains
https://blackwoodpublishing.co.uk/pages/behind-files-admin.html.

## One editor, two audiences

- **Public** and **Published**: the update can be read by everyone, appears in the
  homepage's latest public updates and in the members' Behind the Files feed.
- **Members only** and **Published**: the update is readable by confirmed, active,
  non-banned Blackwood members, in the members area only.
- **Unpublished**: a draft, visible only in the administrator editor. Changing the
  audience of a published update changes who can read it after saving.

Members-only is the default for new drafts. The homepage uses an anonymous,
explicitly public query even if the browser has an administrator signed in.
Database row policies enforce visibility. Hiding a card with JavaScript is not
used as the privacy boundary. Bodies are plain text; readers render them safely.

The members carousel now sits directly after its welcome heading, above account
summaries, ARC/bookshelf and rewards. The homepage shows up to three public
updates, with a link to the member feed. Counts and dates come from actual posts.

## Owner setup in the correct project

This workspace does not have a live Supabase admin connection. Repository pushes
do not apply migrations or import posts. No new Edge Function or Android bundle
is required for these website changes.

1. Open **Blackwood Publishing Members Access / main** (`bmnlynjldlnxfvunqbqq`).
2. Run the entire `supabase/migrations/20261107140000_dispatch_audiences.sql` in
   SQL Editor. It creates the dispatch table, read policies and administrator save
   function. It does not change member roles or reading/ARC rights.
3. Run the privately prepared `import-existing-dispatches.sql` supplied alongside
   this work, outside the public repository. It imports the existing five posts
   with their original IDs, dates, text and pinned/published state, with audience
   **members**. Reruns preserve existing rows rather than overwrite edits.
4. Check that five rows are returned and review their audience. If any same-ID
   rows existed beforehand, check their content/audience individually.
5. Reload the management page. Choose an existing update or **New draft**. Set
   audience, date, content and the Published checkbox, then **Save update**.
6. Test a newly published Public update in a signed-out/incognito homepage and in
   a signed-in member account. Test a Members-only update in the member account;
   an anonymous query must not return its title, excerpt or body.

The save function checks the current administrator identity and revision. If a
post changed elsewhere, reload before editing; the draft is retained after a
failed save. A completed RPC response confirms the database save. A network
failure may leave the outcome uncertain; refresh the list before resubmitting.

## Retiring the old public JSON archive

The previous implementation stored complete “private” dispatches in the publicly
served `/data/BFA.json`. A sign-in screen did not make that file private. The new
members-only database rows have actual server-side access rules.

During setup, the members page retains the old archive only while the new table
is unavailable. Once the table responds, its result is authoritative, including
an empty feed or an intentionally unpublished post. The homepage never reads the
legacy JSON. New members-only drafts cannot be exported into that public file.

After the owner confirms import and member reading work, remove the five bodies
from the current public JSON (retain an empty `posts` array or remove the legacy
route and fallback together). Keep the private backup outside Git. Do not empty
the old file before checking the import. Previously public material may remain
in Git history or caches; migrating it does not retroactively make old copies
private. Future member-only updates should use the protected editor exclusively.

## Existing reactions

The import preserves the five stable post IDs so existing reaction references are
retained. Existing reaction/points database functions remain separate and are not
rewritten by this migration. Verify reactions with a member test account after
setup, particularly for newly created dispatch IDs, before promising new points.

## Checks

- `NODE_PATH=<pglite-dependencies> node tests/dispatch-schema.cjs`: real PostgreSQL
  policies for public/member/draft rows, write denial, admin saves and revisions.
- Browser checks cover homepage public-only results, safe modal rendering,
  signed-in member ordering/visibility and the administrator editor.
- Existing members login/loading/recovery checks still apply. Tests use synthetic
  services and do not send email, publish posts or change the live database.
