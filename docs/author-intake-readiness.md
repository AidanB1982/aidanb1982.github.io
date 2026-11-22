# Blackwood author intake — launch readiness and Sgeul handoff

Prepared 22 November 2026. This is an operational checklist, **not** proof of
a live author submission programme and **not** an approved publishing contract.

## Current public position

- \`pages/submissions.html\`: **closed** until the owner chooses a reading
  window and confirms the required intake protections and editorial capacity.
- \`pages/author-charter.html\`: public principles, existing acquisitions
  statements and developing standards. The charter is not an agreement.
- \`pages/about.html\`: mission and five founding values.
- The general contact form and reader/member sign-up are **not** submission
  routes. The public site does not currently collect manuscripts.
- No automatic author status, book publication, Sgeul profile, royalty rate or
  Sgeul distribution right is granted by reading the charter.

## Gate A — before announcing a manuscript reading window

The owner should decide and document:

1. **Capacity:** which editor is accountable; manageable number of submissions;
   reading period; realistic response timeframe; process for closing intake.
2. **Scope:** eligible genres and book forms; whether unpublished, previously
   self-published and agented work are eligible; geographic/language eligibility;
   what Blackwood will not consider in that window.
3. **Submission requirements:** allowed file formats, file size, synopsis,
   sample/full manuscript request, and authorship/AI-use disclosure rules.
4. **Submission rules:** simultaneous submissions, multiple manuscripts,
   resubmission policy, age/eligibility, acknowledgements, withdrawal and
   how authors can correct contact details.
5. **Privacy and retention:** valid privacy notice, retention/deletion schedule,
   access controls, restricted manuscript storage, secure transmission,
   abuse/spam handling, appropriate backups and incident response.
6. **Communication:** named contact route for accessibility alternatives,
   automatic receipt **only after reliable secure intake is deployed**, stages
   and decisions the author can expect, no implied acceptance.
7. **Contracts:** legal/editorial review of offer templates; rights granted by
   format, territory and term; payment/royalty definitions, statements, payment
   cadence, reversion, approvals, termination and disputes. These must be clear
   before an offer—not improvised on the public About page.
8. **Testing:** full sample submission in staging, error recovery, author
   confirmation, upload limits/malware protections, duplicate handling,
   administrator review/permissions, deletion/withdrawal and mobile/keyboard UX.

Only when those are ready: choose dates, publish complete window guidelines,
publish the approved method and expected response period, and then open intake.
Do not expose a partially configured upload, mailto shortcut or generic
contact form as the submission channel.

## Gate B — future Sgeul author induction (after app walkthrough)

The owner will share the app after PR #16. Inspect Sgeul's real identity,
membership, publishing, entitlement, data and payment models *before* designing
or implementing the induction path. Proposed concepts for discussion:

- Applicant chooses an **author induction**, separate from manuscript submission
  and separate from existing reader/beta access.
- Identity is verified; any author role requires an owner/admin approval process,
  not a client-side toggle or self-granted database permission.
- Profile creation should support a public pen name, biography, approved image,
  permitted links, discoverability and moderation; private account details must
  never appear on the public profile.
- Upload/publishing rights, books, ISBN/edition details, copyright/license
  declarations, territory/term permissions, sales reporting and payment details
  require separate reviewed workflows. A profile is not a publishing agreement.
- Author should be able to preview/edit their profile; publication, suspension,
  withdrawal and removal require an explicit accountable process.
- Record granular consent, accessible terms and a privacy notice; determine
  eligibility, retention, author support, payout provider and dispute handling
  before enabling public sign-ups.
- Protect existing readers, reviewers, ARC files, permissions and paid orders.
  No automatic import, role upgrade, author payment or launch is in PR #16.

**Next project after PR #16:** review the actual Sgeul app, make a system-design
proposal and get the author's induction/publishing rules approved before touching
production accounts or adding a signup form.
