# Reader discovery, account and revenue journeys

Prepared 26 October 2026 (UK). These changes use existing services and do not change
subscription pricing, grant entitlements or enable public BP Reading access.

## Website features

- `/pages/discover.html`: curated public catalogue; title/author search, genre, mood,
  series, author, saved-book and sample filters; series order and title sorting.
  Query parameters can link directly to a filtered collection. Series positions
  come from existing public pages; mood tags are editorial navigation, not reviews.
- Saved discovery books and followed authors are **device-only shortcuts**, labelled
  as such. They do not overwrite the existing account bookshelf or subscribe anyone
  to an alert. Storage failures are reported; the page still works for that visit.
- `/pages/reading-preview.html?book=holdfast`: only the prologue already public at
  `/pages/holdfast.html#holdfast-prologue`. Fetches that public page and inserts its
  paragraph text using `textContent`. It never requests a private EPUB, creates a
  signed URL or bypasses membership checks. White/Off-white/Dark, font family and
  text-size controls are separate from saved protected-reader preferences.
- `/pages/newsletter.html`: the existing MailerLite form, explicit email consent,
  clear account-versus-newsletter wording, unsubscribe help and links to discovery.
  Neither a timeout nor a cross-origin iframe load is treated as subscription proof.
- `/pages/gifts.html`: series suggestions and signed/personalised-copy enquiries.
  Customers use the existing store for individual editions. No invented bundle
  discount, stock promise, gift voucher or paid gift membership is sold.
- Member dashboard: read-only reading-account section using existing Supabase tables.
  It verifies the current Auth user, scopes private reads to that user, shows the
  recorded access date, unrevoked permanent purchases, and a saved unfinished book
  when current membership/purchase access exists. Unknown data stays unknown;
  missing tables never become “no purchases” or a prompt to pay again.
- Shopify account link is the existing store's account route. It is not a custom
  subscription portal or an assertion that a Supabase user is signed into Shopify.
  Checkout and account email addresses may differ. Support remains available.
- BP Reading already had book search. It now labels chapter matches, reports search
  progress and offers Stop search without moving the displayed book. Results are
  limited to 100 passages; stale or cancelled searches cannot append newer results.
- Reader settings include keyboard/zoom guidance. Existing themes, progress, notes,
  book-delivery checks and optimistic sync conflict handling are retained.

## Analytics and reports

The previous eager Google tag snippets are replaced by `analytics-consent.js`.

- No Google Analytics request until an affirmative choice; defaults to essential only.
- Consent is local to this browser and expires after 180 days. Privacy choices remain
  available in the footer. Withdrawal disables the integration and attempts to clear
  its first-party `_ga` cookies; granting again works without another script load.
- Only an explicit list of public page paths may load analytics. Account, admin, ARC
  and protected-reader pages are excluded even if consent was granted elsewhere.
- Page location omits query strings and fragments; referrer is blanked. Events are
  allowlisted; book identifiers are allowlisted. Search terms, account IDs, notes,
  email addresses and payment details are never supplied by this integration.
- Prepared events: `catalogue_visit`, `public_sample_open`, `store_visit`,
  `gift_visit`, `book_store_click`, `newsletter_request`.
- **Interest signals are not conversions.** A newsletter request is not a confirmed
  subscriber; a store click is not a paid order. No fake purchase event is emitted.
- Behind the Files links to Google Analytics and Shopify reports with this distinction.
- This is an analytics choice mechanism, not a claim to control all third-party embeds
  and cookies across the site. Review widgets, ecommerce and other embeds separately.

In Google Analytics, check property access, retention and Enhanced Measurement settings.
Disable automatic site-search/form/outbound tracking if it would bypass the curated
measurement plan. Confirm no extra Google Tag Manager/marketing tags are installed.
Verify behaviour in the production property; local tests stub provider scripts and do
not prove the live provider's settings or report arrival. Do not call a browser click
a verified payment or send customer identity into analytics.

## Remaining setup: MailerLite

1. Confirm the existing form/group is the intended marketing audience, and check
   consent records, sender verification and any double-opt-in behaviour.
2. Build an approved welcome automation triggered by **confirmed subscription**.
   Suggested message: welcome, Start Here link, public prologue and how to unsubscribe.
3. Schedule the monthly newsletter in MailerLite or implement a consent-aware delivery
   worker. The website form does not itself schedule or send the monthly campaign.
4. Create actual provider custom fields/groups before collecting genre preferences.
   No unsupported field names are posted by this release. ARC status is not consent.
5. Book/author release alerts need server-stored follows, channel consent, opt-out,
   recipient scoping and an idempotent notification queue before automatic delivery.
   Local follows are intentionally not presented as working notifications.

## Remaining setup: gift memberships and bundles

- Create a **one-time** Shopify gift-membership product, with its own price/variant.
  Do not reuse the auto-renewing annual selling plan as a gift purchase.
- Define whether the year begins on redemption, an expiry period for unused gifts,
  refund terms, transfer rules and delivery to the purchaser versus recipient.
- Implement signed paid-order verification, single-use high-entropy redemption codes,
  caller-authenticated redemption, transactional replay protection and an audit trail.
- Decide how redemption interacts with an existing membership and refunds. A gift must
  not replace a paid entitlement or create automatic renewal without agreement.
- Configure actual bundle products/prices/stock in Shopify before advertising discounts.
- No retail files are released and the public reader navigation remains hidden pending
  rights/KDP clearance. Only the pre-existing public prologue is reused here.

## Validation and limits

`tests/reader-services.cjs` covers discovery filters/order/persistence/storage failure,
public-only sample delivery and three themes, required newsletter consent without
sending real email, optional analytics and withdrawal, query redaction, mobile/tablet
layouts, caller-scoped account lookups, mismatched Auth identity and missing tables.
Existing reader sync tests cover separate-device state, stale-write conflicts and
outbox persistence. Real EPUB/browser tests cover prose, page turns, search, themes,
bookmarks, notes and sign-out using local EPUBs and mocked authentication.

No live database migration, real payment, external post or marketing email is performed
by these tests. Real-device Safari/Android, live MailerLite confirmation, Shopify
subscription management and live analytics reporting require service/device checks.

## Member visibility paused — 27 October 2026

At the owner's request, `BLACKWOOD_MEMBERS_CONFIG.showBpReading` is `false`. The
member dashboard does not render its Reading Room CTA or reading-account section,
and it does not initialise that section's queries. All implementation code remains
for later restoration. ARC access, the account bookshelf and other member features
are unchanged. This does not disable the direct reader URL or alter server access.
