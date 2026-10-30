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

## Offline update for the existing pilot

Run [the offline SQL patch](../supabase/migrations/20261030170000_arc_reading_offline.sql), then replace the existing **bp-reading-arc** dashboard `index.ts` with [the updated combined file](../supabase/dashboard/bp-reading-arc.ts) and deploy. Keep legacy JWT verification OFF; fresh caller validation remains in the handler. No new secret or repeat of the original grant operation is needed.

Refresh the ARC room online, accept the current terms and choose **Save offline**. Wait for the saved confirmation before disconnecting. Reopen `/pages/bp-reading.html?arc=1` in the same browser/account. Copies are personalised, encrypted on the device and expire within seven days or at campaign close, whichever comes first. There is no EPUB export control. A disconnected device cannot receive immediate revocations; confirmed denial on reconnect removes the saved copy. Local notes/progress remain local; review filing requires connectivity.

Fully migrated readers with no remaining active legacy assignments no longer see the old ARC profile section. Legacy records and unmigrated readers retain their existing workflow.

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
- Explicit offline saves require current terms and a server-issued deadline. Paid and ARC
  device copies use separate keys. Without a saved valid copy, disconnecting closes
  the ARC reader. Online periodic checks and reconnect checks revalidate access.
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
- Save offline, disconnect and reload the ARC room; verify reading and local progress.
  Reconnect after revoking access and confirm the saved copy is removed. No EPUB
  export is offered; the member area opens the reader instead of legacy downloads.
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
bounded offline saves, inline/no-store personalised delivery and revalidation before bytes.
Browser tests use real EPUB.js with synthetic accounts and check the complete pilot
flow, revocation closure, reviews, member entry and mobile layouts. Live deployment
and owner acceptance are separate steps.

## Member bookshelf and tier display

The member bookshelf checks the caller-scoped ARC catalogue for ARC-flagged profiles.
Current readable assignments automatically create a missing shelf entry with ARC
provenance; Gualachulain maps to the existing `gualachulain-bothy` spine. Inserts ignore
concurrent duplicates. Existing entries receive only the ARC flag/timestamp update;
notes, owned/signed flags and selected reading stages are preserved. New entries start
in TBR, or Reading when the account's local ARC reader position has already started.

An active assigned ARC stays filed automatically; its metadata remains editable but
its provenance checkbox/removal control is locked while that assignment is readable.
Closed assignments retain existing shelf records, and do not recreate manually removed
closed records. Shelf badges are metadata and never grant book access. Reading links
continue through the protected ARC room. Failures leave the existing shelf usable.

Reader/ARC tier labels display **ARC Reader** when the profile's ARC flag is on. The
stored `member_tier`, paid membership, points and administrator permissions are not
rewritten. Other named tiers retain their existing display. This needs no new SQL or
Edge Function deployment beyond the existing ARC pilot.
