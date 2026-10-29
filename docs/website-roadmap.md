# Blackwood website to-do list

Updated **29 October 2026** (UK). This separates published website work from features
that still need live configuration, database changes or app-store setup.

## Catalogue reconciliation — owner confirmed live

- [x] Review the supplied catalogue/schema report and test reconciliation against it.
- [x] Prepare `supabase/operations/reconcile-reading-catalogue.sql`: reuse existing
  identities, create missing works/ebooks, preserve separate Corrour records and
  release only the approved Black Bothy and Crossing uploads.
- [x] Verify atomic failure, rerun safety, private crosswalk and author identity rules.
- [x] Repair imported identity sequences behind existing IDs; test the reported edition-ID collision.
- [x] Owner ran reconciliation successfully; all 26 linked works were returned.
- [x] Owner confirmed Black Bothy and Crossing working; subsequently uploaded and confirmed Drowned Fjord, Erased Archivist and Holdfast.
- [ ] Add remaining EPUB files and approve each release separately over coming days.

BP Reading navigation/member links remain hidden. No missing author accounts are
created by this operation; new preparation records carry no invented contract dates.

## Offline BP Reading — owner confirmed working

- [x] Add opt-in encrypted device copies, refresh/remove controls and offline reader shell.
- [x] Keep EPUB export/public file URLs out of the offline interface.
- [x] Prepare seven-day server-issued offline windows bounded by membership expiry,
  preserving existing payment/release/auth checks. No new database migration/secrets.
- [x] Owner deployed the updated delivery function: paste the whole
  `supabase/dashboard/bp-reading-deliver-epub.ts` bundle into dashboard `index.ts`.
- [x] Improve offline error visibility and prevent disconnected books from showing
  Subscribe to read; await worker updates and report failed reader dependencies.
- [x] Address the owner-reported old generic worker message with versioned worker
  registration, explicit update/cache bypass and protocol checks.
- [x] Reproduce the Supabase tracing HTTP 404 caused by import examples inside
  quoted warnings. Replace regex scanning with a pinned module parser that ignores
  strings/comments and optional dynamic imports; retain actual static dependencies.
- [x] Owner confirmed saving and offline reading work after the parser correction.
- [ ] Finish live checks for offline notes/progress sync after reconnection, expiry and
  removal, plus iPhone/Safari and Android coverage. ARC Vault remains unchanged.

See [offline setup and limitations](bp-reading-offline.md), including storage eviction,
reconnection, delayed revocation and the distinction between encryption and DRM.

## Compact mobile reading shelf

- [x] Use a two-column mobile shelf with smaller covers, tighter card spacing and
  narrower buttons. Stack covers above details on phones; preserve 44px touch targets.
- [x] Omit repeated eyebrows/synopses and duplicate Coming soon text on mobile,
  retaining complete titles, reading progress and 44px reading buttons.
- [x] Keep desktop descriptions and the approved reading order. No Supabase change.

## BP Reading chronology

- [x] Group The Third Night, The Black Bothy, The Gåtestein Log, The Drowned Fjord,
  The Erased Archivist and Holdfast under The Archive Files, in that reading order.
  Keep published novel numbers and public discovery metadata unchanged. No SQL needed.

## Completed: Author Desk improvements, 26 October

- [x] Put open author actions and overdue deadlines on the overview.
- [x] Show author-visible documents marked as requiring a signature; omit signed and
  visibly superseded documents from the pending list.
- [x] Show upcoming recorded edition publication dates and recent production updates.
- [x] Show each book's next recorded author action, without inventing a next stage or
  completion percentage.
- [x] Add direct navigation to the relevant production action or document record.
- [x] Add book search by title, subtitle and internal reference, plus stage filtering.
- [x] Filter Production by book and all/open/overdue/completed author actions.
- [x] Filter Documents & Rights by book or general publishing records.
- [x] Add mobile section navigation, accessible active-section/focus handling, and
  section links that can be bookmarked.
- [x] Improve responsive card layouts, empty states, deadline badges and print layout.
- [x] Reuse one author/book lookup instead of repeating it during page opening.
- [x] Check the read-only projections, UK date boundaries, author-scoped fixtures,
  navigation and mobile layout. Financial processing functions were not changed.

**No Supabase migration, new secret or Edge Function deployment is required for this
batch.** Existing records, queries and permissions remain the data source. Seeing a
document record is not an online signing or file-delivery workflow.

## Completed: shared CSS and mobile audit, 26 October

- [x] Standardise public hero typography, button treatment and keyboard focus.
- [x] Keep mobile content visible immediately; remove multi-second reveal delays and oversized stacked book buttons.
- [x] Improve the display size of known padded 3D book mockups without editing their artwork.
- [x] Fix tablet navigation overflow; use the compact menu through 1024px.
- [x] Fix narrow-phone hero overflow on Recovered Files, Independent Works and Appearances.
- [x] Use readable 16px tablet/phone form fields and at least 44px primary controls.
- [x] Improve store filters and embedded Shopify button presentation without changing checkout logic.
- [x] Keep touch hover effects from shifting cards/buttons, and keep home navigation accessible in landscape.
- [x] Repair Community Spotlight's duplicated document and its hashtag copy handler.
- [x] Preserve EPUB colours, accessibility zoom and protected reading/navigation boundaries.
- [x] Check public layouts, touch navigation, Author Desk, publishing tools and real EPUB rendering.

See [the CSS audit](css-mobile-audit.md) for measured results and limits. No Supabase
changes are required. Large image downloads remain a separate performance task below.

## Completed: reader journeys, 26 October

- [x] Add public catalogue filters for genre, mood, series, author and reading order.
- [x] Add clearly labelled device-only saved books and author shortcuts, preserving the
  separate account bookshelf and making no email-alert promise.
- [x] Add adjustable White/Off-white/Dark reading of the existing public Holdfast
  prologue; do not extract samples from protected EPUBs or expose new retail content.
- [x] Add a member reading-account section for recorded access dates, permanent purchases,
  an eligible unfinished book, Shopify-account management and support.
- [x] Add a dedicated newsletter page and explicit mailing consent; remove timed fake
  subscription-success messages from the footer.
- [x] Add gift-reading suggestions and signed-copy enquiries using existing store routes.
- [x] Make the Google analytics integration opt-in, limit it to public pages and add
  private/account/reader exclusions, clean URLs and curated interest events.
- [x] Add reporting links and distinguish clicks/signup requests from confirmed sales
  and subscribers.
- [x] Improve existing book search with progress, chapter labels and cancellation;
  retain reading place and add keyboard/zoom guidance.
- [x] Prepare the remaining email, gift-redemption and reporting configuration checklist.

See [reader journeys](reader-journeys.md). No Supabase migration is required for the
published features. The owner changed Shopify membership pricing to £20 on 27 October.
Website copy and checkout/payment validation now match £20; deploy the three updated
reading payment Edge Functions as recorded below.

## Completed: ARC profile tidy, 27 October

- [x] Collapse the full ARC profile by default while keeping its current book/review
  summary visible in the heading.
- [x] Give each assigned book its own keyboard-accessible drawer for terms, downloads
  and review controls, retaining closed-campaign records and existing access checks.
- [x] Move the welcome poster and historical application details below the vault in
  separate collapsed sections; preserve the current book as the primary information.
- [x] Improve phone spacing, checkbox targets, buttons, due-date presentation and labels.
- [x] Preserve expanded book drawers when vault records refresh; folding does not accept
  terms or change assignments, reviews or recorded dates.

No Supabase or email configuration changes are required for this layout update.

## Membership price update: 27 October

- [x] Match reader copy, subscription buttons and administrator previews to £20/year.
- [x] Require the verified annual £20 GBP amount in checkout creation, signed payment
  verification and administrator order recovery; keep exact variant/plan/auth checks.
- [x] Rebuild the three single-file Supabase deployment bundles and test price mismatches.
- [x] Owner confirmed deployment of `bp-reading-create-checkout`, `bp-reading-shopify-webhook` and
  `bp-reading-reconcile-order` from the updated dashboard files. A GitHub push does
  not deploy Supabase Edge Functions.
- [ ] Verify a newly created Shopify checkout displays £20, annual billing and no shipping.
- [ ] Review any existing £10.99 subscription contracts separately before renewal.
  Shopify product-price changes do not rewrite existing contracts; the new verifier
  accepts £20 only. Existing membership dates/receipts are not rewritten or revoked.

## BP Reading member visibility paused: 27 October

- [x] Hide the Reading Room link and reading-account/continue-reading section in the
  member dashboard for all users, including administrators.
- [x] Retain their code and prevent the hidden account section from fetching records.
  Restore later using `BLACKWOOD_MEMBERS_CONFIG.showBpReading` in `js/members.js`.
- [x] Keep ARC, the account bookshelf, reviews and rewards available.

This is a presentation switch, not a change to protected delivery, existing paid
access or direct reader-page permissions. Public reader navigation remains hidden.

## Completed: shared footer tidy, 27 October

- [x] Replace uneven navigation and duplicate account/ARC links with three balanced groups.
- [x] Align the brand at the top and consolidate legal links into one readable bottom row.
- [x] Simplify newsletter presentation while preserving explicit consent and provider handling.
- [x] Use two-column phone navigation, a full-width phone signup, readable text and 44px controls.
- [x] Keep BP Reading hidden and retain privacy-choice controls.

## Completed: full BP Reading collection, 27 October

- [x] List the 19 Blackwood titles/workbooks/fragments documented on the site, excluding
  other publishers' recommendations, duplicate physical formats and editorial services.
- [x] Keep missing reading editions as disabled Coming soon cards, including for admins.
- [x] Add availability filtering and catalogue counts without invented IDs or progress.
- [x] Replace matching placeholders with approved Supabase editions without duplicate cards.
- [x] Preserve entitlement, private-file delivery, per-edition state and hidden navigation.
- [x] Prepare [the gradual-upload checklist](bp-reading-book-uploads.md).
- [ ] Upload, register, approve and test each actual EPUB edition as rights permit.
- [ ] Confirm a front cover for Sanare Per Mortem; the imprint mark is used for now.

No new Supabase migration or function deployment is needed for the shelf display.

## Completed: recovered stories and collection groups, 27 October

- [x] Hide the Manuscript Audit Workbook from BP Reading while retaining its shop listing.
- [x] Make The Third Night and The Gåtestein Log readable in BP Reading from their
  existing public manuscripts, with original prose/copyright and no private-file bypass.
- [x] Keep public-story places/notebooks device-local with no invented Supabase IDs.
- [x] Add collection headings/filtering and sort within the eight collection groups.
- [x] Add Martin's Introduction to Accounts; Miren's Staying: An Account, The Salt Widow
  and The Orphan and the Hollow Tree; and Aidan's Before the House Closed.
- [x] Credit Martin Hales on the existing UK Sole Traders and UK Landlords guides.
- [ ] Supply confirmed front covers and private EPUB editions for the new coming-soon titles.

The reading catalogue now shows 23 titles. The member/public navigation remains hidden;
no Supabase change is needed for the two already-public recovered stories.

## Completed: owner-confirmed flat covers, 27 October

- [x] Apply the supplied book1–book20 flat-cover map specifically to BP Reading.
- [x] Add The Money Reset by Martin Hales to Practical Guides, with book17.png.
- [x] Use book12.jpg for covers awaiting confirmation; keep actual uploaded artwork
  available as a replacement for those pending covers.
- [x] Prefer confirmed flat covers over older server/mockup artwork in reading cards.
- [x] Preserve Corrour's normal book2 cover and its separate book13 limited shop edition.

The catalogue has 24 visible reading titles; the hidden workbook remains in the shop.
Dedicated `readingCover` fields preserve the discovery and bookshop presentation.
No Supabase changes are required for these display mappings.

## Owner-approved EPUB uploads: 27 October

- [x] Owner approved The Black Bothy and The Crossing for BP Reading release.
- [x] Confirm The Black Bothy uses book record 4 and ebook edition 10.
- [x] Prepare/test its atomic, rerunnable [registration script](../supabase/operations/release-black-bothy.sql).
- [x] Owner released and confirmed Black Bothy working through catalogue reconciliation.
- [x] Owner confirmed The Crossing released and working: book 20 / ebook edition 39.

A GitHub push does not run these SQL operations. No member grants, payment records,
RLS, bucket privacy, launch flags or navigation visibility are changed by this release.

## Whole-catalogue database reconciliation

- [x] Owner authorised reusing existing records and creating missing book/ebook records.
- [x] Prepare/test [a non-mutating catalogue/schema report](../supabase/operations/inspect-reading-catalogue.sql) across reader/Author Desk and Publishing Inventory tables.
- [x] Owner supplied the live `catalogue_report`.
- [x] Prepare/test and owner-run duplicate-safe reconciliation; 26 works linked.
- [x] Link the approved Crossing upload to real book 20 / ebook edition 39.
- [x] Keep unuploaded editions planned/Coming soon; only explicitly approved uploads released.

## Existing foundations already in place

- [x] Author Desk book/production records, documents/rights, statements, payments and
  payment-request interfaces. Extend this system rather than create another desk.
- [x] Protected BP Reading with saved reading settings, progress and bookmarks.
- [x] White, Off-white and Dark reading backgrounds; browser “dark pages” can override
  their appearance when that device setting is enabled.
- [x] ARC assignment and Outlook-notice tooling in Behind the Files. Existing ARC
  delivery still produces personalised downloadable copies; the in-reader replacement
  below has not been built.
- [x] Publishing department card layout tidied for desktop and mobile.
- [x] AI assistant hidden at the owner's request; manual content authoring retained.
- [x] Facebook/Instagram worker, explicit automatic scheduling and connection-check
  code prepared. Live connection remains a separate, unfinished setup task.

## Next: owner configuration and backend work

### 1. Finish Meta connection and verify the scheduler

- [ ] Confirm the social scheduler SQL has been applied to the live Supabase project.
- [ ] Deploy the updated `bp-publishing-desk` and new `bp-social-publish` functions.
- [ ] Use the existing Meta app to obtain the Blackwood Page ID and appropriate Page
  access token, with access to its linked Instagram professional account.
- [ ] Save server secrets, configure the Vault/cron request, and verify the read-only
  connection while automatic publication remains paused.
- [ ] Run one deliberately scheduled Facebook test and one Instagram image test.
- [ ] Confirm delivery receipts and background execution, then enable regular posting.

Instructions: [Meta scheduler setup](meta-social-scheduler.md). Never put tokens in
chat or frontend files. Existing manual plans do not become automatic by deployment.
TikTok, videos/Reels, carousels and monthly email delivery remain manual plans.

### 2. Connect production planning to the existing Author Desk

- [ ] Move/share the browser-only Gantt plans through properly scoped Supabase storage.
- [ ] Map projects to actual author and book records, with author-visible milestones.
- [ ] Keep current production records/history authoritative; define how planner updates
  should change them before adding write operations.
- [ ] Add confirmed next-stage dates once that shared workflow exists.

The current Author Desk improvements show existing production records; they do not
silently import the separate browser-local planner or imply that it is shared.

### 3. Author approvals and documents

- [ ] Add secure document viewing/delivery for the existing document registry.
- [ ] Define and implement author proof/cover approvals and completion of author actions.
- [ ] Add online agreement signing only after choosing its signing/audit workflow.
- [ ] Confirm server-side permissions, immutable history and notifications for writes.
- [ ] Add a book launch view after author-visible marketing/ARC reporting is defined.
  The current marketing calendar is admin-only and should not be exposed wholesale.

### 4. Protected ARC reading and notifications

- [ ] Replace ARC EPUB download delivery with protected reading inside BP Reading/app.
- [ ] Preserve existing issuance history; create/reuse the personalised reference on
  first opening and keep personalised watermarks.
- [ ] Track meaningful reading activity separately from file-download counters.
- [ ] Add an in-account notifications inbox and book-specific links.
- [ ] Add permission-based app push notifications to assigned readers when an ARC is ready.
- [ ] Retain a visible in-account notice for readers who decline push notifications.

This is a planned replacement, not a description of the current downloadable ARC flow.

### 5. Android and iPhone app

- [ ] Enrol in Google Play Console and Apple Developer Program; choose the correct
  individual/organisation identity and complete required verification.
- [ ] Confirm branding, privacy/support details and the first-release specification.
- [ ] Build a shared reader app: existing-account sign-in, members area, Blackwood
  bookshelf, protected reading, bookmarks and synced progress.
- [ ] Keep purchases on the website; check current reader-app rules for each store and
  region before including purchase links or prompts. No in-app checkout is planned.
- [ ] Add on-device imports for personal EPUB/PDF files, separate from protected
  Blackwood/ARC titles. Start with local personal files rather than automatic uploads.
- [ ] Add push registration and release/ARC notices after the notification backend exists.
- [ ] Test real Android/iPhone devices, accessibility and store submission requirements.

### 6. Reading launch and payments

- [ ] Confirm outstanding KDP exclusivity/withdrawal obligations before enabling public
  Blackwood reading access or restoring the public navigation link.
- [ ] Verify live initial payments, renewals, refunds, expiry and permanent book access.
- [ ] Confirm test-mode settings and launch flags are appropriate before public launch.
- [ ] Finish the £1.99 permanent in-reader purchase journey and its live payment tests
  where outstanding. Administrator access remains based on existing Supabase grants.

## Further improvements to review

- [ ] Review existing book pages and public author pages before redesigning or duplicating
  them; strengthen samples, series order, genuine reviews and clear reading/buying routes.
- [ ] Attach verified cover artwork to Author Desk books using an agreed catalogue source.
- [x] Add a reading-account overview and eligible continue-reading summary to the existing members dashboard.
- [ ] Add server-scoped book/author follows and consent-aware release notifications; device shortcuts do not deliver alerts.
- [x] Add editorial genre/mood/series discovery from existing public metadata.
- [ ] Connect TikTok posting through its own approved integration.
- [ ] Verify MailerLite confirmation/consent and configure welcome automation, real genre
  preference fields and monthly campaign delivery; ARC assignment is not newsletter consent.
- [ ] Configure one-time gift-membership products and verified, single-use redemption.
- [ ] Configure priced/stocked Shopify bundle products before advertising bundle savings.
- [ ] Validate analytics property settings and live reporting; connect verified paid-order
  reporting before calculating membership conversion or customer lifetime value.
- [ ] Review submissions, rights enquiries and trade information for completeness.
- [ ] Optimise large original background images for delivery: add verified modern-format
  responsive derivatives while retaining the original artwork. Several files exceed 10 MB.
- [ ] Consolidate legacy CSS gradually after checking cascade order; do not blindly delete
  duplicate rules across media queries.
- [ ] Check physical iPhone/Safari and Android devices and profile real-network performance.
- [ ] Continue mobile accessibility, performance and end-to-end permission checks.
- [ ] Revisit AI drafting only if the owner chooses a provider and billing/data approach.
