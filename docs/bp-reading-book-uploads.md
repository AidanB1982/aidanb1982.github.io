# Adding books to BP Reading gradually

Updated 27 October 2026. The full on-site Blackwood collection is displayed using
`data/book-discovery.json`. Protected titles require an approved Supabase edition;
the two explicitly allowed public recovered stories can also be opened. This update does not upload files, grant memberships or enable releases.

## What readers see

- Existing approved editions keep their real edition IDs and access checks.
- Other catalogue titles show **Coming soon**, with no invented edition ID, percentage
  or working book-opening action. Membership and administrator status do not unlock
  these placeholders.
- If availability cannot be verified, the page says so rather than asserting a new
  release. Display-metadata failure does not remove independently approved editions.
- The availability filter separates the full collection, listed reading editions and
  forthcoming editions. Search and series order work across the whole collection.
- Approving a reading edition replaces its matching placeholder on the next library
  load. Metadata matching is presentation only; it never grants reading access.

The reading catalogue includes novels, practical guides and the two Recovered Files.
The Manuscript Audit Workbook is hidden from BP Reading at the owner’s request and
remains in the public bookshop/discovery catalogue. Alternate physical editions of one book are not duplicated;
editorial services and other publishers' recommended books are not included.
Sanare Per Mortem currently uses book12.jpg (Cover Coming Soon) because no front-cover assignment
was confirmed in the existing catalogue. Supply its proper cover when preparing it.

## For each upload

1. Find or create the **actual** book edition in the publishing inventory. Use the real
   numeric `book_editions.id`, and confirm its format is `ebook`. Never use list position,
   an ISBN, a Shopify product ID or the existing Gualachulain edition ID for another book.
2. Prepare a valid EPUB. The current protected reader serves EPUBs, not arbitrary PDFs
   or Word documents. A guide/workbook needs a suitable EPUB edition before activation.
3. Upload to the private `bp-reading-editions` bucket. Do not make it public or add a
   public download/signed file URL to the website metadata.
4. Register that actual edition in the existing `bp_reading_files` registry with the
   exact bucket/path, `file_format='epub'` and the existing supported `admin_testing`
   access state. Keep other file records and existing issuance/history intact.
5. Add/reuse the real stable `bp_reading_titles.book_id` and corresponding
   `bp_reading_catalog` row. Use the same edition ID and book ID throughout; include
   title, author, cover URL, description, series and series order. An existing book ID
   must not be renamed just to match a website slug.
6. Before making a catalogue entry available, verify the file is present and the rights
   allow its intended use. `available=true` lists the approved edition; it is not itself
   permission to release a book to customers. Keep customer-launch flags and current
   test-account restrictions as intended while KDP obligations remain outstanding.
7. Customer delivery additionally requires a `bp_reading_releases` approval pinned to
   the exact registered bucket/path. Enable it only when rights, file and customer
   access are ready. Server entitlement and release checks remain authoritative.
8. Test opening the correct title, chapter text, contents, page turns, cover and saved
   place with an authorised account. Then reload the library to check the placeholder
   was replaced once, with the correct book title and cover.

Only metadata is needed to keep a future title on the shelf. Do **not** bulk-enable all
catalogue rows or create fake ebook editions just to populate the page. A private file
upload alone does not create the required registry, catalogue and release records.

## Matching titles

The merge first matches the real catalogue book ID against the metadata slug/aliases;
otherwise it matches title plus author (ignoring case, punctuation and accents).
Approved rows not yet present in the website list also appear automatically. Distinct
authors with the same title are not merged just because the title matches.

Known Gualachulain aliases include `gualachulain` and `gualachulain-bothy`. Sanare's
previous account-bookshelf slug `sanae-per-mortem` is retained as a display alias.
These are not instructions to change your actual database keys.

No new migration or function deployment is required to display the coming-soon shelf.
Existing BP Reading visibility remains paused in the member dashboard and public nav.

## Public recovered files and collections — 27 October

The Third Night and The Gåtestein Log now read inside the full BP Reading interface
from their already-public HTML manuscripts. They do not need a private EPUB upload,
a fabricated Supabase edition ID or a paid membership. BP Reading itself retains its
existing sign-in screen. Only these two hard-coded public source paths can use this
route; other titles still require protected delivery and existing server checks.

The browser prepares their existing prose, copyright, notes and closing line for the
EPUB rendering engine, stripping scripts, handlers, embedded content and promotional
links. No downloadable EPUB asset or export button is added. Places, preferences,
bookmarks and notes use account-scoped **device storage**, separate from real numeric
Supabase editions. They do not claim cross-device sync; the sync button is disabled
for these public files. Keep their source manuscripts stable to preserve CFI positions.

There are now 24 visible reading titles in eight collection groups. The collection
filter and headings follow the Publications page and the supplied series information:
Archive Files, Recovered Files, Threshold Records, The Hollowing Veil, Hard Silence,
Independent Works, The Cursed Bothies and Practical Guides. Only known book numbers
are shown. Titles without a confirmed series stay in the independent collection;
Threshold Records is Miren's existing imprint/collection grouping, not an invented
sequel order. Sorting is within collection.

New owner-supplied titles: Introduction to Accounts (Martin Hales), Staying: An Account,
The Salt Widow, The Orphan and the Hollow Tree (Miren Vale), and Before the House Closed
(Aidan Blackwood). These remain coming soon until their actual reading editions are
uploaded and approved. Unconfirmed covers now use book12.jpg (Cover Coming Soon). The two existing
UK accounting guides are also credited to Martin Hales, as their public pages state.

## Confirmed flat-cover mapping

The owner's `book1`–`book20` filenames are front-facing covers specifically for BP Reading.
Dedicated `readingCover` fields take precedence over older Supabase artwork without
changing public discovery/bookshop covers. Where `readingCoverPending=true`, a real
Supabase `cover_url` takes precedence over book12.jpg.
This keeps unknown covers replaceable without showing the wrong book's cover.

The Money Reset by Martin Hales has been added to Practical Guides with book17.png,
as a coming-soon reading title. Introduction to Accounts uses book18.jpg; UK Landlords
uses book19.jpg; Before the House Closed uses book20.png. The existing UK Sole Traders
guide uses book14.jpg. Sanare and the three additional Miren Vale titles await their
confirmed covers and use book12.jpg.

Corrour Bothy's standard reading cover is book2.jpg. Book13.jpg is the separate black
and copper limited physical edition, not a second reading title. The Manuscript Audit
Workbook stays hidden from BP Reading and keeps its shop artwork.

## Owner-approved uploads — 27 October 2026

The owner approved both The Black Bothy and The Crossing for BP Reading release.
Their object paths (inside the existing private bucket) are:

- `The_Black_Bothy/The Black Bothy.epub`
- `The_Crossing/The Crossing.epub`

The supplied live lookup confirms **The Black Bothy: book record 4, ebook edition 10**.
Run [the tested Black Bothy release script](../supabase/operations/release-black-bothy.sql)
in Supabase SQL Editor as administrator. It checks the real edition/parent/format,
private bucket and exact object; preserves an existing reading identity; registers
the file and catalogue row; and pins an enabled release to the exact object. It rolls
back if validation fails and can be rerun without duplicate rows. Unexpected extra
mandatory registry fields stop the script rather than receive invented values.

This script is prepared and tested locally; a GitHub push does not run it in Supabase.
After a successful run, refresh BP Reading and test the actual uploaded EPUB with an
authorised account. Existing entitlement checks and customer-launch settings remain
in force. The page stays hidden from member and public navigation.

The first exact-title lookup did not return The Crossing. Run
[the read-only Crossing lookup](../supabase/operations/find-crossing-edition.sql) and
return its `crossing_lookup` value. It searches title/edition-name variations and
Miren's author identity without exposing contact details. If no edition exists, create
its real book/ebook records with the appropriate author relationship before registering
the upload. Do not reuse edition 10, Gualachulain's edition 2, or an ID from the separate
`publishing_editions` inventory table.
