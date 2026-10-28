# BP Reading offline copies

Prepared 28 October 2026. This covers BP Reading, not the ARC Vault's existing
personalised EPUB/download workflow.

## Deployment and use

1. Publish the website changes, including root `bp-reading-sw.js` and
   `js/BP-reading-offline.js`. The custom domain must use HTTPS.
2. Update **the existing** Supabase function `bp-reading-deliver-epub` with the
   repository's current `handler.ts` (keep its existing `index.ts` import/wiring).
   Preserve its current JWT verification, launch gates and secrets. No new secret,
   migration, bucket or public Storage policy is needed. Do not disable auth.
3. Sign in online and choose **Save offline** beside a readable book. Wait for the
   saved confirmation. The action caches the public reader shell and stores an
   encrypted account-specific copy in IndexedDB. There is no EPUB export/download
   control or public file URL. Public recovered texts use their existing builder.
4. While offline, reopen the same BP Reading URL in the same browser/profile.
   Only saved, unexpired books are shown. Place, preferences and notes continue to
   save locally. Reconnect and refresh the library to verify access and use the
   existing account sync/outbox; concurrent device edits may require choosing a copy.
5. **Remove offline** deletes that copy. Signing out or switching accounts removes
   the previous account's copies. Browser/site-data cleanup also removes them.

The website refuses to save protected books until the delivery function returns
`X-BP-Offline-Until`. An older function continues to serve normal online reading;
its missing header produces an actionable offline-save error instead of guessing
an entitlement. Complete an owner acceptance test after the function deployment.

## Access and storage boundaries

- Offline saving is explicit, not an automatic download of every opened book.
- Each protected save repeats existing server auth, entitlement, launch gate, exact
  release/file and numeric ebook checks. The server supplies a maximum seven-day
  window. Membership-only saves expire sooner if the recorded membership ends.
  Verified permanent purchases and administrators receive a seven-day window.
- An expired or revoked membership cannot receive a new offline copy. A successful
  online library reload removes saved books that are now denied or no longer released. Temporary verification errors do not erase otherwise valid saves.
- Revocations cannot reach a disconnected device immediately. Existing offline
  copies remain usable until their window ends or the next successful online check.
  This is an unavoidable tradeoff of offline reading, not instant remote revocation.
- The saved file is AES-GCM ciphertext using a browser-generated non-exportable
  CryptoKey. Identity is bound into authenticated encryption. Offline records contain
  no JWT, private Storage path, signed URL or administrator flag. Normal Supabase
  session storage remains managed by its SDK; offline account identity must match it.
- IndexedDB encryption and local expiry checks are **not DRM**. A determined user,
  compromised same-origin script or modified browser can extract rendered/decrypted
  content. Do not promise that offline content can never be copied. There is no
  standalone EPUB export feature, but offline reading necessarily stores content.
- CacheStorage contains public reader HTML/CSS/JS, public artwork and pinned reader
  dependencies only. Private EPUB delivery stays POST/no-store and is never cached
  by the worker. No auth/API response is cached. Worker scope is the reading URL.
- Private browsing, limited storage, disabled service workers, blocked dependencies
  or storage eviction can prevent offline use. Wait for the saved confirmation;
  retain an internet connection for the first save. Each book is limited to 100 MiB.
  External resources referenced by an EPUB may still need a connection; use complete
  EPUBs with embedded text/artwork for dependable offline use.

## Validation

`tests/reading-offline.cjs` uses a real service worker, IndexedDB, Web Crypto and
EPUB.js with synthetic account/delivery fixtures. It covers explicit save, encryption,
non-exportable key, account isolation, expiry/clock rollback, shell cache exclusion,
a complete offline reload and real EPUB rendering, removal and signout cleanup.
`tests/reading-delivery.mjs` covers server expiry/purchase/revocation policy in addition
to the established delivery checks. These do not deploy Supabase or certify live books.
