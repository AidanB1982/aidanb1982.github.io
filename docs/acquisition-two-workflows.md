# Acquisitions and Author Onboarding — two Blackwood Publishing workflows

**Development foundation, 27 November 2026.** This specification is based on the owner's confidential House Manual (working draft 0.4) and Author Welcome Pack (v1.0), but does not commit those files or treat draft financial terms as signed terms.

## The three existing website pages

- Public Manuscript Submissions: `/pages/submissions.html`. Submissions are **closed**. There is no live form or manuscript upload. Future launch must meet the existing `docs/author-intake-readiness.md` checklist.
- Public Author Charter: `/pages/author-charter.html`. Explains Blackwood's no-pay-to-publish acquisition principles, author copyright and the intent to issue clear rights and financial contracts. The charter is **not a contract**.
- Authenticated existing Author Desk: `/pages/authordesk.html`. Existing author, book, production, rights, documents, statements and payments information; never grant access merely because someone submitted, received an offer or signed up for Sgeul.

## Workflow A: submitted manuscripts

A manuscript must enter through an **approved secure reading-window route** and be accompanied by the required contact, data-use notice, manuscript requirements and AI/authorship disclosures. Do not use the general contact form, public email or Sgeul induction as an intake workaround.

The owner's staged assessment follows the House Manual's acquisition pathway:

1. Securely received and acknowledged (not acceptance).
2. Submission eligibility and material checks.
3. Initial reading.
4. Internal acquisition note: why this book belongs on Blackwood's list.
5. Editorial discussion: professional editorial work and revision requirements.
6. Commercial and title P&L review (cash investment, capacity and business case).
7. Rights review (copyright/licence availability and potential conflicts).
8. Author-fit review.
9. Explicit acquisition decision: decline, request further information or proceed to offer-readiness review.

Every decision is made by a real authorised publishing representative. An applicant can be declined or withdraw at any time under the agreed retention and communication rules. An initial reading, positive score or internal note is not a contract. There must be an appeal/correction/withdrawal route defined in the future secure intake terms.

## Workflow B: publisher-led offer, contract and Author Desk introduction

This also accepts a direct publisher-initiated invitation. The absence of a prior public submission does **not** exempt the title from editorial, commercial, rights and author-fit review.

1. Offer-readiness review with the necessary editorial/commercial/rights/acquisition decision evidence.
2. Publisher authorises the offer.
3. Heads of Terms discussed (not a binding publication contract by itself).
4. Outline terms agreed in principle.
5. Title-specific agreement and rights schedule prepared and reviewed.
6. Exact publishing agreement version issued for signature.
7. Signed agreement and relevant evidence independently verified.
8. Existing Author Record created or matched with identity, named publishing contact and book-specific relationship verified.
9. Existing Book Record created or linked; contract rights/editions/dates populated from the signed instrument, not this draft.
10. Existing Author Desk identity and **per-book** author permissions independently tested. No automatic author account or reader/Sgeul role elevation.
11. Personalised Author Welcome Pack and private Author Desk introduction provided, with explanation of who to contact and the first author actions.
12. Editorial handover to the existing production system.

After the handover, the existing Author Desk's author-visible publishing lifecycle applies: Contracted; Editorial; Author revision; Beta and proof; Production; Pre-publication; Published; In print. Each stage needs responsible staff, next milestone and clear author action.

## What this PR actually implements

- A **side-effect-free** stage catalogue and permission-gate helper under `js/blackwood-acquisition-workflow.js`.
- A private process-reference panel inside the existing administrator-verified Blackwood Management Hub. It shows both pathways and their evidence expectations, linked to the three established site pages.
- An explanation of the acquisition and post-offer process on the *still closed* public Submissions page, with no submission input or fake application tracking.
- A plain-English author-facing introduction inside the existing Author Desk, visible only after normal desk authentication.
- Automated tests for transition gates, contract and access boundaries, closed intake, page links and script parsing.

**Important:** This PR does **not** create database case records, intake windows, a stage-change ledger, invitations, legally effective signatures, Author Desk entitlements, new publication rights, manuscripts, email or payment traffic. The process panel is marked reference-only; it does not pretend to be a working case tracker. Public submissions remain closed.

## Next implementation in the same Blackwood Publishing codebase

A. **Private stateful case ledger:** create an owner/admin-only acquisitions case, typed source `submission` or `direct_offer`, with immutable events, exact version/actor, authorised state transitions, recorded evidence references, withdrawal, decision, retention and audit. Introduce new Supabase SQL only in a separate reviewable PR with negative RLS tests; do not expose the cases to readers or unrelated authors.

B. **Secure application portal:** only after owner defines and approves a submission window, acceptable genres, materials, secure file/virus checking, privacy notice, retention/deletion, response times, capacity, abuse controls and review process. Do not accept manuscripts in this first PR.

C. **Contract-onboarding workflow:** create draft-only offer/contract packets with owner review. The actual signed agreement (not a toggle) controls creation/linking of Author and Book Records. Build an idempotent, narrowly scoped, separately authorised Author Desk invitation and onboarding checklist, with cross-author isolation tests.

D. **Author progress:** only expose the author-visible subset of case/contract milestones after identity and entitlement verification; keep internal acquisition notes and unpublished author material restricted. Do not conflate Sgeul author induction with Blackwood publisher acquisitions.

No production SQL migration, secret, customer email, AI manuscript upload or live submission activation is authorised by merging this branch. All commercial numbers must be derived from signed contracts or separately adopted policies; the House Manual's provisional rates must not be silently adopted.
