# Sgeul Android beta: owner setup

Public application: https://blackwoodpublishing.co.uk/pages/sgeul-beta.html

Private feedback: https://blackwoodpublishing.co.uk/pages/sgeul-feedback.html

Recruit up to 100 adult Android readers. Applications are reviewed manually; submitting a form does not reserve a place, create an account, send a Play invitation or grant a book.

## Before sharing

Both forms use the website's existing Formspree contact inbox (`mbdpplkw`). Check the owner's Formspree quota can handle 100 applications plus ongoing feedback, review spam settings, and submit one real application and feedback report yourself to confirm delivery. Automated tests mock the provider and do not send messages. No automated mailing list or newsletter subscription is created.

Use the Google Play **closed testing** track for the production-access test. Internal testing is useful for initial checks but does not replace the closed test shown in your Console. The current Console requires at least 12 opted-in testers for 14 consecutive days. Keep testers opted in throughout; follow the live Console requirements if they change. Joining instructions need the closed track's own opt-in link, not the previous internal-test link.

## Prepare one-year full-library access

The offer is now one year of complimentary access to every released book in the Sgeul reading library, including new library releases during that year. Access starts on activation. Physical books and ARC invitations are separate. Applying does not automatically grant access.

Use the same complimentary-membership setup prepared for the five trusted readers:

1. Accept the applicant and confirm their own active, email-confirmed Blackwood account and exact UUID/email in **Blackwood Publishing Members Access / main** (`bmnlynjldlnxfvunqbqq`). Their Google Play email may differ.
2. Grant a one-year complimentary `bp_reading_memberships` record with no payment reference, using an owner-reviewed transaction that checks their exact identity. Preserve longer existing complimentary access; review any revoked or payment-linked membership individually. Do not create purchases, change admin flags or assign ARC books.
3. Add the accepted reader's UUID to `BP_READING_TEST_USER_IDS`, preserving all existing entries. Keep public customer access closed. The existing delivery function must support the plural secret; if needed deploy the complete current `supabase/dashboard/bp-reading-deliver-epub.ts`, preserving its JWT settings and allowed native origin `https://localhost`.
4. Add their actual Google Play email to the closed-track tester list and send the opt-in link yourself.
5. Test sign-in, opening released library books, saving offline and reopening in airplane mode. No new Android bundle is needed. An offline lease lasts at most seven days and never beyond membership expiry.

The earlier `enable-sgeul-beta-testers.sql` operation grants only 45 days for The Black Bothy and **does not fulfil this revised offer**. Do not use it for new full-library invitations. Its edition-scoped grants remain separate from membership; existing recipients need an individually checked membership upgrade to receive the new offer. No live access is changed by this documentation or by the public page.

## Accepting and tracking readers

Use the Formspree inbox to review applications. Keep a private tracker with contact email, Google Play email, Blackwood member ID/email, invitation date, opt-in confirmation, access expiry and feedback status. Never put applicant details or passwords in this public repository. Confirm selected readers have joined the closed test; an invitation alone is not an opt-in.

Suggested check-ins: joining/sign-in on day 1, reading and offline feedback around day 7, and final feedback around day 14. Ask about navigation, text size, bookmarks, airplane-mode reopening and reconnecting. Honest problems are useful; never require a positive store review. Existing app Help opens the contact page, which now links to beta feedback.

## Revoking access

Review the exact account and entitlement before revoking. A complimentary full-library membership is separate from any earlier one-book beta grant, purchase or ARC assignment. Revoke the intended complimentary membership only; do not overwrite paid records. New server deliveries are denied when no independent right remains. A disconnected saved copy can remain readable until its issued offline lease expires.

Leaving the Play test does not automatically revoke Blackwood access or delete a member account. Follow the site's published privacy and retention terms when handling applications and feedback.

## Recruitment copy

> Help shape Sgeul, Blackwood Publishing's Android reading app. We're looking for up to 100 readers aged 18+ to try the app and share honest feedback over a 14-day test. Accepted testers receive one year of free access to all released books in the Sgeul reading library, including new library releases during their year, starting when access is activated. You'll need an Android phone and a Google Play account. No purchase or positive review is required. Apply at https://blackwoodpublishing.co.uk/pages/sgeul-beta.html — places are offered after review.

## Verification

- `node tests/reading-delivery.mjs`
- `NODE_PATH=<pglite-dependency-directory> node tests/sgeul-beta-sql.cjs`
- Serve the repository locally and run `tests/sgeul-beta-browser.cjs` with `BASE_URL`, Playwright and `CHROMIUM_PATH`. All external form requests are mocked; never use a live inbox for automated tests.
- `python3 scripts/bundle-edge-functions.py --check`
