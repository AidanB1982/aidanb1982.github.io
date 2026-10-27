# Adding books to BP Reading gradually

Updated 27 October 2026. The full on-site Blackwood collection is displayed using
`data/book-discovery.json`; only approved Supabase reading editions have a reading
button. This update does not upload files, grant memberships or enable releases.

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

The catalogue includes novels, practical guides, the two Recovered Files and the
Manuscript Audit Workbook. Alternate physical editions of one book are not duplicated;
editorial services and other publishers' recommended books are not included.
Sanare Per Mortem currently uses the imprint mark because no front-cover assignment
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
