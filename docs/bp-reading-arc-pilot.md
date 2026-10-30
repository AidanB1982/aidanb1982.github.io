# Assignment-based ARC reader pilot

Prepared/tested 30 October 2026. The owner selected an existing active basic-member
account and Gualachulain (campaign 3, book 1, protected ebook edition 2). The corrected
preflight confirms the account also retains an earlier paid membership. **That paid
grant stays unchanged**; the new ARC route never consults paid entitlement or admin bypass.

## Deploy this pilot

1. In Supabase SQL Editor run the whole
   [ARC pilot migration](../supabase/migrations/20261030160000_arc_reading_pilot.sql)
   once. This creates pilot/grant/mapping, terms and activity storage plus restricted
   RPCs. Existing paid-reading functions, grants and tables are not replaced.
2. Create Edge Function **bp-reading-arc**. Replace all of its dashboard `index.ts`
   with [the combined file](../supabase/dashboard/bp-reading-arc.ts), then deploy.
   Set **Verify JWT with legacy secret OFF for this new function**: its handler
   requires the caller's JWT and validates it freshly using `auth.getUser`. This
   supports the project's ES256 sessions; no new secret or public bucket is needed.
3. Run the whole [one-account grant operation](../supabase/operations/enable-arc-reading-pilot.sql),
   replacing its single all-zero UUID with the chosen member ID. An account-specific
   copy can be provided privately without publishing that ID in GitHub. This operation
   is rerunnable and aborts on an ambiguous/closed assignment, mismatched campaign/
   edition, missing private file or unexpected other legacy grants.
4. The operation adds `is_arc_member=true`, an explicit pilot/grant and one
   `reader_active` assignment. It preserves tier, non-admin status, points, paid
   memberships/purchases and review history. No review deadline is invented.
5. Sign in as the test account. In the members area, use **Your ARC reading room**;
   direct URL: `/pages/bp-reading.html?arc=1`. Accept the three current copyright terms
   and open Gualachulain. This is the ARC route even for an existing paid subscriber.

GitHub publication does **not** execute SQL or deploy Edge Functions. The public
reading navigation remains hidden. Other ARC readers/campaigns stay on their current
workflow until this pilot is accepted and individually migrated.

## Access and delivery

- The ARC shelf returns only the caller's explicitly migrated assignments. ARC status
  alone, paid membership, an admin flag or a forged browser assignment/member ID does
  not grant access. Privileged grant records pin assignment/member/campaign/edition.
- New opens require an active ARC profile, enabled pilot/grant/mapping, matching
  reader-only assignment, exact pinned private file, active campaign and open release window, private EPUB
  registry and non-withdrawn ebook. Due dates are review targets, not access expiry.
- The service records current terms acceptance, then creates/reuses the existing
  `create_arc_issuance` reference with server-derived identities. Its execution is
  restricted to service_role; the old delivery services also use that role.
- Personalised reference text is embedded into each HTML/XHTML body of the reading
  EPUB in memory. The browser receives an inline/no-store response and a visible
  reference, not a signed Storage URL or download link. The old download counters,
  personalised paths and issuance download metadata are not rewritten.
- Reading deliveries are tracked separately in `bp_arc_reading_activity`; an open
  count is not evidence of completing the book. The ARC reader stores place/notes
  separately on the device, not the paid-reader cloud-sync namespace.
- ARC offline saving is disabled and disconnecting closes the ARC reader. A periodic
  check (60 seconds and on returning to the tab) closes it when server access fails.
- Review links are saved on the retained assignment, including after the campaign
  closes. Legacy Apps Script records/points automation are not silently rewritten.
- The old personalised EPUB endpoint checks `status='active'`; a migrated
  `reader_active` assignment does not meet that gate. Its Vault download entry is
  excluded by the same existing filter; the new member entry opens the reader.
  Confirm the live legacy EPUB **and PDF** services reject this migrated assignment
  before rolling the change out to the team; current PDF source was not supplied.
- A guard prevents authenticated clients changing protected fields/status on a migrated
  assignment. Revocation should disable its server-only grant or pilot; those flags
  cannot be restored by a reader through legacy review update policies.
- Existing previously downloaded files/signed links cannot be recalled by this
  change. A browser reader is not DRM: determined users can extract delivered content.

## Pilot acceptance

- Test without an admin session. Only the assigned ARC appears and opens after terms;
  a paid entitlement never substitutes for an absent ARC grant.
- Check personal reference, page turns, local progress/notes and review-link filing.
- Confirm the new ARC screen offers no offline/save/export controls and the member
  area offers a reader entry instead of a legacy download for this assignment.
- Confirm direct legacy EPUB/PDF requests for the migrated assignment are rejected.
- Temporarily disable `bp_arc_reading_grants.enabled` for the assignment: opening must
  fail and an open reader must close on its next check. Restore only for the pilot.
- Test another account, wrong assignment, unopened/closed campaign, inactive/revoked
  profile and unaccepted terms. Historical records and old download counts must remain.
- Verify public navigation remains hidden and paid/offline reading still behaves normally.

To pause the pilot, set its `bp_arc_reading_pilots.enabled=false` (or grant enabled=false).
Do not restore the legacy `active` assignment status as a casual rollback: that would
re-enable the old download path. Retain the records/reference for review.

## Validation

The SQL tests cover a paid member with isolated ARC grants, scope and window checks,
terms/reference reuse, guarded assignment changes, review filing, private tables,
sequence repair and rerun safety. A private local run also used the supplied ARC column
constraints and existing issuance function; the uploaded report is not committed.
Handler/personalisation tests verify fresh auth, server-only grants, no spoofed user,
no offline action, inline/no-store personalised delivery and revalidation before bytes.
Browser tests use real EPUB.js with synthetic accounts and check the complete pilot
flow, revocation closure, reviews, member entry and mobile layouts. Live deployment
and owner acceptance are separate steps.
