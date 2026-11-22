# Sgeul Author Induction — foundation (PR #18)

**Status: staged / not launched.** Design reviewed against the actual Sgeul
0.2.0 source and live Blackwood Publishing Members Access schema on
22 November 2026. The supplied Android App Bundle was 0.1.3, an older build.
Nothing in this PR is a signed Android release or a live Supabase migration.

## The two separate author journeys

1. **Sgeul induction:** an existing, signed-in Blackwood reader may eventually
   request a private Sgeul author identity. Submission only creates an induction
   request. Blackwood administrators review it inside **Behind the Files →
   Blackwood Management Hub → Author Induction Review**. Approval allows the
   person to create/edit a PRIVATE author-profile draft.
2. **Blackwood publishing acquisition:** manuscript submissions, contractual
   rights, book records, the existing Author Desk and finance remain separate.
   The current Submissions desk is closed, and induction is **not** a back door
   to manuscript submissions, book uploads, catalogue inclusion, royalty
   entitlements or a publishing contract.

A reader may apply for induction without receiving Author Desk access. A
signed-in applicant may only access their own request. The applicant can never
approve themself or set \`author_records.desk_access_enabled\`. Admin approval
only changes the induction status; it does not insert \`author_records\`,
\`book_records\` or membership/ARC records.

## Staged components

- \`supabase/migrations/20261122165000_sgeul_author_induction.sql\`: proposed
  schema with \`sgeul_author_inductions\` and \`sgeul_author_profiles\`,
  both default-deny to anonymous users and protected by owner/admin RLS.
  Decision statuses: submitted, approved, declined and suspended; submitted
  applicants can be approved or declined, approved inductions suspended, and
  suspended inductions restored by an active administrator.
- \`apps/sgeul/src/author-induction.js\`: validated app-side input, induction
  status, applicant submission and approved author profile editing. The feature
  is **OFF** behind \`AUTHOR_INDUCTION_ENABLED = false\`.
- \`apps/sgeul/src/index.html\`: "Authors" tab and link from Account. The
  disabled gate is honest and no form is usable until deliberately enabled.
- \`pages/behind-files-admin.html\` and
  \`js/sgeul-author-induction-admin.js\`: review queue inside the existing Hub,
  activated only after the established administrator verification. Supabase RLS,
  not UI state, is the permission boundary.
- \`apps/sgeul/tests/author-induction.test.mjs\` and
  \`tests/sgeul-author-induction-sql.cjs\`: app validation, consent, role
  separation, ownership, approval, suspension and negative RLS checks.

## Go-live gates (must all be fulfilled)

1. **Author intake rules:** choose applicant eligibility and application
   volume/capacity, expected review response, rejection/appeal/withdrawal
   handling and an accessible support contact.
2. **Privacy:** approve the precise author-induction privacy notice,
   retention period, deletion and withdrawal routes, data-subject requests
   and moderation policy. The existing general privacy page must be checked
   and updated if it does not cover this new processing. Avoid collecting
   unnecessary legal/bank/payment identity in the induction form.
3. **Review the SQL migration:** use a safe development/test database first;
   test real user JWTs for applicant A, applicant B, approved author and
   administrator. Confirm RLS and grant behaviour against your Supabase
   project settings (including the Data API). Check advisors. Review the
   existing security-adviser findings about EXECUTE on legacy SECURITY
   DEFINER functions separately—this PR introduces no callable privileged
   RPC.
4. **Apply migration manually** only after backup and owner approval, through
   the documented Supabase deployment process. A GitHub merge does NOT
   apply SQL to production. Verify the exact two new tables, grants,
   constraints, triggers, statuses and lack of public SELECT on profiles.
5. **Admin dry-run:** verify an existing approved administrator can view a
   synthetic application and approve/decline/suspend; confirm an ordinary
   member cannot access others' details or make decisions. Make sure the
   current Management Hub and ARC tools work unchanged.
6. **Enable author applications:** after the previous gates, explicitly
   change \`AUTHOR_INDUCTION_ENABLED\` to \`true\` in a separate reviewed commit.
   Build a *new* Sgeul Android bundle (increment the app version code for
   Play), test sign-in, account switching, offline access, author forms,
   permission-denied paths and ordinary reader/ARC flows on physical devices.
   Publish only through the intended Play testing track.
7. **Pilot privately first:** start with a small invited cohort. No general
   public announcement until privacy, support, monitoring and approval
   arrangements are working.

## Profile semantics and next stage

The initial profile is a **PRIVATE DRAFT**, viewable by the approved author and
authorised Blackwood management. It stores a pen name, biography, interests and
an optional HTTPS website. It is deliberately not a public author directory,
and no uploaded avatar, manuscript file or external ISBN/edition entitlement
is supported. Photos and links may require moderation and separate storage
policies before public profile release.

A later PR can design public discoverability and book-to-profile links with
approved publishing rights and moderation. The existing reader catalogue
stores author names as free text; matching a name does **not** prove
ownership. Build an explicit, reviewed linkage when ready.

This release does not collect payments, calculate royalties, change legal
agreements, accept manuscripts or reassign Sgeul reader/ARC access.
