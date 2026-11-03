# Sgeul Android beta: owner setup

Public application: https://blackwoodpublishing.co.uk/pages/sgeul-beta.html

Private feedback: https://blackwoodpublishing.co.uk/pages/sgeul-feedback.html

Recruit up to 100 adult Android readers. Applications are reviewed manually; submitting a form does not reserve a place, create an account, send a Play invitation or grant a book.

## Before sharing

Both forms use the website's existing Formspree contact inbox (`mbdpplkw`). Check the owner's Formspree quota can handle 100 applications plus ongoing feedback, review spam settings, and submit one real application and feedback report yourself to confirm delivery. Automated tests mock the provider and do not send messages. No automated mailing list or newsletter subscription is created.

Use the Google Play **closed testing** track for the production-access test. Internal testing is useful for initial checks but does not replace the closed test shown in your Console. The current Console requires at least 12 opted-in testers for 14 consecutive days. Keep testers opted in throughout; follow the live Console requirements if they change. Joining instructions need the closed track's own opt-in link, not the previous internal-test link.

## Prepare temporary book access

These changes must be applied manually to the **Blackwood Publishing Members Access / main** Supabase project (`bmnlynjldlnxfvunqbqq`), not Business Checker. Repository changes alone do not deploy SQL or Edge functions.

1. Run the entire `supabase/migrations/20261103120000_sgeul_beta_reading.sql` in the Blackwood SQL editor.
2. Deploy the updated existing `bp-reading-deliver-epub` function using the complete `supabase/dashboard/bp-reading-deliver-epub.ts` bundle. Preserve the existing JWT/auth configuration, `BP_READING_ALLOWED_ORIGINS` (including native `https://localhost`), and reviewer/test-user secrets. Keep public customer access closed. The beta helper admits only the granted edition; it does not open general customer access.
3. Accept one or two applicants first. Add their **Google Play account emails** to the closed-track testers list and send the opt-in link yourself.
4. Ask them to register and confirm their own Blackwood member account through the normal website. Do not request or share their password. Their Blackwood email may differ from their Google Play email.
5. Copy the entire `supabase/operations/enable-sgeul-beta-testers.sql`. Replace the placeholder row with accepted testers' **Blackwood sign-in emails**, one quoted row per email, comma-separated. Run the complete transaction in the same Blackwood project. The placeholder deliberately refuses to run.
6. Check the resulting users, title and expiry. Test sign-in, opening The Black Bothy, saving offline and reopening in airplane mode before inviting the rest.

Each accepted account receives 45 days of access to The Black Bothy (edition 10, book 4), starting when the operation runs. An offline lease lasts at most seven days and never beyond the grant's expiry. Rerunning an accepted email extends its expiry to at least 45 days from that run. The operation caps active cohort users at 100 and refuses to overwrite revoked grants. It creates no purchase, subscription, payment, ARC assignment or admin privilege. Existing paid and reviewer rights remain independent.

The migration and current server function support the existing Android reader; this change does not require a new Android bundle. Availability still depends on the existing private Black Bothy release remaining enabled.

## Accepting and tracking readers

Use the Formspree inbox to review applications. Keep a private tracker with contact email, Google Play email, Blackwood member ID/email, invitation date, opt-in confirmation, access expiry and feedback status. Never put applicant details or passwords in this public repository. Confirm selected readers have joined the closed test; an invitation alone is not an opt-in.

Suggested check-ins: joining/sign-in on day 1, reading and offline feedback around day 7, and final feedback around day 14. Ask about navigation, text size, bookmarks, airplane-mode reopening and reconnecting. Honest problems are useful; never require a positive store review. Existing app Help opens the contact page, which now links to beta feedback.

## Revoking access

In the correct Blackwood project, identify the exact member first and run a narrowly scoped update, replacing the placeholder UUID:

```sql
update public.bp_reading_beta_grants
set revoked_at = now(), updated_at = now()
where user_id = 'REPLACE-WITH-CONFIRMED-MEMBER-UUID'::uuid
  and edition_id = 10
  and cohort = 'sgeul-android-2026-beta';
```

New server deliveries are denied after revocation. An already saved copy on a disconnected device can remain readable until its issued offline lease expires. Revoking this grant does not remove independent paid or ARC rights. Leaving the Play test does not automatically revoke the Blackwood grant or delete a member account; manage these separately. Follow the site's published privacy and retention terms when handling applications and feedback.

## Recruitment copy

> Help shape Sgeul, Blackwood Publishing's Android reading app. We're looking for up to 100 readers aged 18+ to try the app, read The Black Bothy with temporary beta access, and share honest feedback over a 14-day test. You'll need an Android phone and a Google Play account. No purchase or positive review is required. Apply at https://blackwoodpublishing.co.uk/pages/sgeul-beta.html — places are offered after review.

## Verification

- `node tests/reading-delivery.mjs`
- `NODE_PATH=<pglite-dependency-directory> node tests/sgeul-beta-sql.cjs`
- Serve the repository locally and run `tests/sgeul-beta-browser.cjs` with `BASE_URL`, Playwright and `CHROMIUM_PATH`. All external form requests are mocked; never use a live inbox for automated tests.
- `python3 scripts/bundle-edge-functions.py --check`
