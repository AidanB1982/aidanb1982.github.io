# Blackwood Publishing stays at Blackwood Publishing

**Owner decision, 27 November 2026:** Extend the existing publishing platform at **blackwoodpublishing.co.uk**. Do not recreate or relocate the Author Desk, Book Records, rights, royalty accounting, ARC systems or the Publishing Desk inside My Business Checker (MBC).

This is a **non-operational architecture note**. It authorises neither a production deployment nor a database migration, email, payment, source request, model call or customer/author contact.

## Confirmed existing implementation in this repository

| Publishing capability | Existing home | Relevant code/docs |
| --- | --- | --- |
| Contracted author's private desk | `pages/authordesk.html`, `js/authordesk.js` | `docs/author-desk-overview.md`, `js/author-desk-insights.js`, `tests/author-desk-browser.cjs` |
| Book, production, documents and rights views | Existing Author Desk | Author Desk overview and author-scoped records |
| Statements, payments and payment requests | Existing Author Desk | Author Desk finance panels; **live RLS and payment authority require separate verification** |
| Internal publishing operations | Behind the Files management area | `pages/behind-files-admin.html`, `js/publishing-desk.js`, `docs/publishing-desk.md` |
| ARC assignments and protected reading | Blackwood reader/ARC infrastructure | `supabase/functions/bp-reading-arc`, `docs/publishing-desk.md`, ARC-related tests |
| Author induction | Sgeul / existing management hub | `docs/sgeul-author-induction.md`, `apps/sgeul/src/author-induction.js` |
| Submission intake | Blackwood public submissions page | `docs/author-intake-readiness.md`; **submissions remain closed** |
| Publisher/author standards | Owner-supplied confidential house documents | Author Welcome Pack v1.0 and House Manual working draft 0.4; **not committed** |

These references prove repository implementation and documentation, **not** that every live Supabase migration, Edge Function or payment capability is activated. Verify each before making operational claims.

## Ownership and single source of truth

**Blackwood Publishing** remains authoritative for acquired authors, acquired books, signed publishing contracts, rights/licence schedules, manuscripts, editorial work, ISBN/editions, ARC, channel sales and royalty liabilities. Its existing Supabase project and permission model are the starting point, subject to an explicit read-only schema and RLS audit.

**My Business Checker** remains authoritative for its own member accounts, UK business calculators, and its separately built private paid-services / opportunity operator. A freelancer hired for editing or writing is a **client** under a service agreement, not an acquired publishing **author**. MBC subscriptions, freelance invoices and publisher royalties are separate ledgers.

**Sgeul / reader membership** remains distinct from contractual author access. Approving an author's Sgeul induction is not a publishing acquisition, a signed rights licence, an Author Desk grant or a royalty entitlement.

Do **not** copy publishing tables into MBC, reuse authentication sessions, publish manuscript data, share service-role secrets, or create a two-way generic database link. If a later integration is needed, use an independently audited, narrowly scoped, signed and least-privileged read-only summary endpoint or event feed with only approved metadata and explicit purpose. Default: **no integration and no data shared**.

## What to improve here, without rebuilding

1. **House Command Centre** within the *existing* Behind the Files / Publishing Desk. Derive priorities from current author/book/production/rights/finance records instead of building another private operator application. Treat missing data as unknown; never invent publication status, income or contract rights.
2. **Book Record evidence and deadlines.** Improve next action, actor, stage history, rights expiry and signed-agreement reference using existing structures where possible. Start with read-only checks; do not infer that a proposed reversion threshold is binding.
3. **Publishing production intelligence.** Extend real editorial milestones and author-visible tasks; distinguish professional editorial work, alpha, beta, proof and ARC. Check manuscript confidentiality and consent before any third-party AI access.
4. **Royalty and advance assurance.** Keep reported sales, received/cleared income, available payable royalties, payments reserved for transfer and confirmed payments as distinct states. Test overpayment/double-reservation, advance earn-out, distributor corrections and per-contract terms before introducing changes. Never treat a draft House Manual percentage as adopted.
5. **Author and staff UX.** Improve the current Author Desk rather than creating a parallel author portal. Preserve existing book-scoped visibility, signed-document access, responsive layout and reader-portal isolation.
6. **Independent service workflows.** If shared business insights are ever requested across Blackwood Publishing and MBC, provide only owner-approved aggregate status (for example, counts of due tasks) with no author/customer personal details or document access.

## Safeguards from the supplied house framework

- Acquired authors do **not** pay publication-package fees. Copyright remains with the author; only expressly granted, signed rights may be exploited.
- The signed author publishing agreement controls its title-specific royalties, term, territories, permitted deductions, reversion and payment procedure. Working House Manual rates and thresholds are provisional or preferred, **not software defaults**.
- The Author Desk only presents cleared, reconciled, payable author royalties as available; an approved payment is reserved, not immediately recorded as paid. Formal royalty statements are distinct from early payment requests.
- Unpublished manuscripts cannot be sent to external generative AI or substantively rewritten without appropriate author consent, contractual authority and privacy/confidentiality safeguards.
- Submissions stay closed until the publisher separately approves a defined intake window and its editorial, privacy, contract and security requirements.
- Keep existing Microsoft Graph ARC mail configuration separate from MBC's proposed outbound application/mailbox scope. No shared or expanded tenant-wide Mail.Send.

## The next safe work package

**First:** run a read-only publishing-specific inventory of existing database tables, RLS, Edge Functions and open roadmap items, without fetching authors' manuscripts, personal payment details or private records. Confirm which author/book/royalty functions are already active.

**Second:** develop a small, owner-only, read-only *House Command Centre* inside the existing Blackwood Publishing management hub. Use already authorised records only; no new credentials, new cloud service, duplicate tables or cross-project synchronisation. Add browser, source-data and access-isolation tests.

**Third:** only after reviewing isolated test results and the adopted contract/policy references, consider additional workflows or a separately approved migration.

Changes should be proposed **in this Blackwood Publishing repository**, not as a replacement Author Desk in `AidanB1982/my-business-checker`. The confidential source documents remain outside GitHub. Their principles are summarised only to identify implementation boundaries.
