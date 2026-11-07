# Sgeul: next larger update

Updated **7 November 2026** (Europe/London). Baseline: **0.1.4, version code 5**.
The owner reports that the 0.1.4 update workflow worked. The first feedback batch
is now recorded below. This work list distinguishes reported behaviour, requested
refinements and features still planned for later; device acceptance remains separate.

## Selected scope: 0.2.0, version code 6

The owner requested these changes as the next larger update:

- **SG-001 — Swipes:** natural left/right swipes should turn the page from the
  middle of the page as well as the edges. The earlier implementation required an
  edge start and tied direction to that edge. Protect vertical scrolling, links,
  long-press selection and zoom. Verify forward/back and chapter boundaries.
- **Series menus:** show each collection/series as a collapsed disclosure, keeping
  the chosen open state across refreshes and revealing search/filter matches.
- **Cleaner shelf:** remove the two requested explanatory blocks and routine
  synced-status banner. Keep actual errors, save results and offline notices.
- **Atmosphere:** subtle interchangeable background quotes, sourced from short
  passages already published on the website. Keep them decorative, behind the
  shelf, paused when hidden, static for reduced motion and absent while reading
  the actual book.
- **Socials:** add the existing Blackwood Facebook, Instagram and TikTok links in
  the app, opened through the external browser.

The items below remain the wider backlog. Do not add unrelated features to this
release unless the owner expands its scope. Keep collecting feedback during the
closed test; a confirmed sign-in or reading blocker should receive prompt attention.

## Checks completed for the prepared 0.2.0 build

- Real EPUB with Chromium touch input: centre/side swipes in both directions;
  cancelled, vertical, long-press, selected-text, link and multi-touch gestures.
- Existing page-turn regression: page-curl snapshots, queued turns, stable
  pagination, edge gestures and reduced-motion/instant modes.
- Collapsed shelf keyboard/toggle state, search/filter results, missing catalogue
  data and responsive layouts.
- Native bundled-app sign-in, social destinations, ARC terms, encrypted offline
  reopening, reconnect revocation and sign-out cleanup.
- Public quote provenance, rotation/pause, reduced motion and pointer independence.
- Web reader shell revision 8 and private reading-account sync regression.

These are automated browser/build checks. Confirm the swipe behaviour and layout
on the actual Android phone after installing the new Play test build. The signed
bundle is prepared for the existing Alpha track; it is not published by a Git push.

## Improvements grounded in the current app

| Priority | Work item                    | Current behaviour                                                                                                                                                          | Acceptance for the update                                                                                                                                                                                                                                             |
| -------- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| First    | Password help                | Opens the members reset URL, which shows normal sign-in when no recovery session exists.                                                                                   | Open the reset-request form directly; a genuine recovery link must still open the new-password form. Verify the email arrives and the new password works in Sgeul.                                                                                                    |
| First    | Sign-in error messages       | Network/server failures share the same “check your email and password” message as failed credentials.                                                                      | Give useful messages for offline, timeout/service failure and rejected credentials, with a safe retry. Preserve duplicate-submit protection and the new loader.                                                                                                       |
| First    | Clear beta onboarding        | Applicants may provide separate contact and Google Play emails, with no Blackwood account yet. Joining, registration and entitlement activation are separate manual steps. | Give one clear joining guide: use the approved Google account for Play, create and confirm one Archivists account, then activate accepted beta access. Applying alone grants no rights.                                                                               |
| First    | Account access summary       | Native Account shows email and device-copy help, with no membership summary. Website membership wording assumes annual access.                                             | Show one-year beta expiry, lifetime library access, and separate assigned ARC books accurately. Display “Lifetime” for the existing lifetime marker rather than year 9999. Reuse caller-scoped records; keep admin rights separate.                                   |
| First    | Privacy and account deletion | Account links to the existing security-policy page and generic support. A dedicated app deletion/request flow is unfinished.                                               | Link to the appropriate app privacy information and complete the in-app/web account-deletion request route, explaining any retained records. Check the Play disclosures against actual data use before public launch.                                                 |
| Next     | Open the selected saved book | Saved cards currently open the generic library or ARC room.                                                                                                                | Open the selected edition/assignment directly while preserving entitlement checks, accepted ARC terms and the saved copy's lease. Give a clear expired-copy message.                                                                                                  |
| Next     | Continue reading             | Home has Library, ARC and Saved sections, with no direct current-book continuation.                                                                                        | Resume the chosen book at its saved place, including offline where a valid device copy exists. Keep paid-library and ARC state separate.                                                                                                                              |
| Next     | Direct feedback button       | App Help opens Contact; that page links onward to the feedback form.                                                                                                       | Add “Report a problem” in the app. Offer app version, device/OS and connection context without passwords, tokens or book passages. Keep feedback submission explicit.                                                                                                 |
| Next     | Website news in the app      | News was requested; the native app has no news section.                                                                                                                    | Reuse the new public `bp_dispatches` feed once its owner setup is complete; honour audience/visibility rules and provide an offline/last-updated state. The web feed is prepared; native news remains future work. Do not expose admin drafts or private ARC content. |

Source pointers: [native app](../apps/sgeul/src/app.js),
[Account/Home markup](../apps/sgeul/src/index.html),
[members sign-in/recovery](../js/members.js),
[shared reader](../js/BP-reading.js),
[reading account summary](../js/member-reading-centre.js), and
[app setup/device acceptance](../apps/sgeul/README.md).

The SMTP settings were corrected during support and the reset request then
completed without its earlier HTTP 504. Email arrival and a completed password
change still need confirmation; a success message alone is not delivery proof.

## Device checks during beta

These are checks to carry out, not confirmed defects. Existing browser tests use
synthetic services and do not establish every real-phone behaviour.

- Sign in, close/reopen, background/resume and recover a password.
- Save several books; restart in airplane mode after the online session expires;
  open a still-valid saved copy and check a genuinely expired copy.
- Reconnect after an access change and verify the relevant entitlement again.
- Save progress, a bookmark and a note; reopen and check reconnect/sync behaviour.
  ARC notes currently remain local; do not promise cross-device ARC sync.
- Exercise existing swipe/edge-tap page turns, ordinary text selection, links,
  chapter changes and Android Back. Swipes already exist in the shared reader.
- Test large text, reduced motion, screen reader/focus, keyboard and rotation on
  the phones testers actually use. Include a slower device and connection.
- Check sign-out clears that account's device copies and that another account
  cannot open them. Check update installation preserves existing local data.

## Later reading and engagement features

Keep these visible on the roadmap without committing them all to the next build.

| Feature                                | Initial scope and dependencies                                                                                                                                                                                                                                                                                                                                                                                |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Optional book translation              | Wishlist idea agreed 7 November, outside the current release: pilot Spanish on one public story, then consider French. Keep English easy to restore, label machine translation, preserve character/Gaelic place names and obtain fluent-reader feedback on voice and meaning. Check page turns, bookmarks, layout and provider cost before widening access. No provider selected or implementation scheduled. |
| Digital access for Shopify book buyers | Future proposal: qualifying paid historical and future book orders, including physical editions, grant permanent access to their matching released digital titles. Requires product/variant-to-title mapping, confirmed-account matching, verified claims for different emails, refund handling and a reviewable historical backfill. No access is granted by this wishlist entry.                            |
| Dictionary and place-name lookup       | Look up a selected word or curated place, with pronunciation/Gaelic notes where supplied. Choose a legitimate source and define offline behaviour; avoid sending surrounding protected text to an external service.                                                                                                                                                                                           |
| After the Last Page                    | Author-approved character and place profiles, unlocked after completion or an explicit spoiler choice. Scope spoilers by book/series position. Do not infer biographies from unreviewed generated text.                                                                                                                                                                                                       |
| In-app notifications                   | An account-scoped inbox for new news, assigned ARC availability and book notes. Retain notices for readers who do not want push.                                                                                                                                                                                                                                                                              |
| Optional push alerts                   | Add only after the inbox/event rules exist. Explicit permission and topic preferences; exact-account ARC targeting; token cleanup on sign-out/deletion. Measure actual delivery separately from queued sends.                                                                                                                                                                                                 |
| Fuller personal bookshelf              | Bring appropriate existing website reading-stage/owned-book features into the app, preserving the existing records and account boundaries.                                                                                                                                                                                                                                                                    |

## Feedback tracker

Feedback is currently stored by the existing Formspree form `mbdpplkw`; the owner
reviews it in Formspree. This workspace has no connected inbox for automatically
pulling reports. Do not copy reader email addresses or account IDs into this
public document. Keep personal support details in the private inbox/tracker.

For each item record:

- Issue/reference and date, app version, phone/Android version, online/offline.
- What the reader did, expected result and actual result.
- Reproduction status, impact, owner and target build.
- Fix/verification result and whether the reporter confirmed it.

Current reported issue: **SG-001**, ordinary page swipes do not turn the page.
The implementation was limited to edge-start gestures; the new behaviour needs
real-phone acceptance after the updated build is installed. The other selected
items are interface requests. Add later reports using non-personal references;
use “needs reproduction” until investigated.

## Release check

Before publishing the larger update: choose the scope, finish the changes, run
checks for the affected flows, complete a real-phone acceptance pass, retain the
existing signing identity, and prepare one new version/code with release notes.
Upload it to the existing closed-testing track and verify availability for an
opted-in tester. The active rollout, Play disclosures and production-access
criteria are checked in Console; a successful local build is not publication.
