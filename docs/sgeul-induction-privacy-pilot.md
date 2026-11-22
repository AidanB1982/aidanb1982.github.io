# Sgeul author induction — privacy and pilot sign-off

**Draft for Blackwood owner review — 22 November 2026.** The author
induction service remains **OFF** in Sgeul. This is a proposed operating
plan, not an approved or automatically enforced retention policy.

## Processing covered

Induction records in the existing Blackwood Supabase project contain:
- the signed-in account identifier (and indirectly its account email);
- selected publishing/pen name, biography, genres, optional HTTPS website;
- a short explanation for joining Sgeul;
- Charter and privacy-policy acknowledgements;
- submitted/approved/declined/suspended status, timestamp of request
  and a reviewed date/administrator identifier.

Approved writers may make a *private* profile draft with their pen name,
biography, genres and optional website. The profile is not published to
readers. No manuscript, photograph, passport, bank details, royalties,
ISBN rights or public publication entitlements are collected in this
induction workflow.

The controller and contact point are named in the existing Blackwood
Privacy Policy. The new section
\`/pages/privacy-policy.html#sgeul-author-induction-privacy\` explains
purpose, who can read information, the private/public distinction and
how to ask for withdrawal.

## Required owner decisions before enabling the feature

- [ ] **Eligibility:** minimum age, territories/languages and what
      counts as an author induction applicant; clear distinction from
      the closed manuscript submissions desk.
- [ ] **Review capacity:** named reviewer/back-up, maximum applications,
      expectations for when decisions will be made, and appeal/review
      contact method. Do not publish a response-time guarantee yet.
- [ ] **Lawful basis:** confirm which UK GDPR lawful basis applies to
      application assessment, private profile operation and necessary
      record-keeping. The UI currently records *acknowledgement*, not
      marketing consent or legal assent to a publishing agreement.
- [ ] **Retention rule:** agree and document a measurable period for
      pending and declined applications, active approved private drafts,
      suspended records, withdrawal requests and audit/decision records.
      The old general retention criteria alone are not a substitute for
      an implementable schedule when this programme launches.
- [ ] **Deletion/withdrawal operations:** agree who processes a request,
      how identity is checked and how partial deletion, legal retention
      and account continuity are handled. There is **no automated
      deletion button** or scheduled retention purge in PR #19.
- [ ] **Approvals:** who may approve and suspend, how errors are
      corrected and what applicants are told. Induction approval does
      not activate a Blackwood Author Desk account or grant publishing
      rights.
- [ ] **Moderation and external sites:** vet public profile fields and
      allowed links before the *later* public-author feature. Private
      drafts may still contain unsafe links; the admin console must
      avoid injecting author-controlled HTML.
- [ ] **Publication:** review this exact privacy notice with the
      responsible operator before announcing induction availability,
      and update it when a retention schedule is formally set.

### Optional retention starting point for discussion — NOT policy

The owner may consider a simple case-based approach such as reviewing
declined requests for deletion after six months, pending requests after
three months without a decision, and private profiles when the writer
withdraws or their induction ends, subject to any necessary legal
record-keeping. **No values above are approved or implemented.** Do not
publish numeric promises or schedule deletion jobs until the
appropriate obligations, appeal needs and technical effects have been
reviewed.

## Controlled test accounts

Create or choose **dedicated** verified test identities, never an
ordinary customer's account:

| Actor | Required state | Expected result |
| --- | --- | --- |
| Reader A | Active Blackwood test account, no author role | Own pending request only |
| Reader B | Different active test account | Cannot view A's request |
| Admin C | Explicit active \`member_profiles.is_admin\` test account | Can read/review requests |
| Approved A | A's request has been approved by C | Can create/edit only their private profile |
| Suspended A | C suspended A's approval | Cannot read/edit their profile draft |
| Anonymous | No Supabase session | Cannot access either table |

**Test A → B → A account switches**, offline startup, expired session,
misleading self-approval payloads, duplicate submissions, and stale
responses; verify sign-out clears current author UI. Confirm Sgeul's
reading library, purchases, ARC terms/revocation and saved EPUB
behaviour separately on a real Android handset.

Before using a live project, repeat the RLS test with controlled test
identities in a development project. If live testing is ever needed,
record the exact test UUIDs privately; the process must avoid changing
existing author, reader or ARC entitlements. Do not put test passwords,
JWTs or personal applicant data in GitHub, logs or screenshots.

## Release sequence

1. Approve eligibility, privacy notice, lawful basis, retention and
   withdrawal runbook.
2. Confirm migration installed (it is), execute the **read-only**
   \`supabase/diagnostics/sgeul-author-induction-preflight.sql\` and
   audit current security adviser warnings; all new Sgeul checks must
   pass.
3. Complete staging role tests with real Supabase Auth test sessions
   and real device smoke tests while application gate is still OFF.
4. Prepare an **opt-in limited pilot** via a separate explicitly
   approved change setting \`AUTHOR_INDUCTION_ENABLED=true\`, include a
   new version code, verify on phone and publish through the
   intended Google Play testing track.
5. Monitor intake, support and retention obligations before opening to
   wider public applicants.

Merging a GitHub PR is not equivalent to installing a production
migration, issuing an Android app bundle, publishing to Google Play
or announcing an author programme.
