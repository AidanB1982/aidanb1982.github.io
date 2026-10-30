# Assignment-based ARC reader pilot

Owner agreed 30 October 2026: test with an existing active basic-member account,
using Gualachulain as the initial book. Keep its Reader tier and non-admin status;
ARC eligibility is an additional flag, not a paid membership or administrator role.

## Current state

The protected ARC layer has not been deployed. The existing ARC Vault download
workflow remains unchanged while we inspect its actual schema and issuance function.
Do not enable team-wide access or remove download delivery before the pilot passes.

Run [the read-only preflight](../supabase/diagnostics/arc-reading-preflight.sql), replacing
its one all-zero UUID with the intended test member ID. Return `arc_reading_preflight`.
The report includes only target profile flags, paid-access booleans, assignment metadata,
the Gualachulain campaign/reading IDs, ARC column/constraint metadata and relevant
function definitions. It does not change profiles/assignments, return contacts or
private file paths, or expose reader issuance codes.

This account may retain an earlier test-payment grant despite its profile tier saying
Reader. Verify that before drawing conclusions about ARC-only access. Do not revoke
paid membership/purchase history to make a test pass. If needed use a fresh account,
or explicitly isolate the assignment-based ARC delivery path in its own tests.

## Implementation requirements after preflight

- Pilot-scoped rollout; exact mapping between an ARC campaign and a real protected
  ebook edition. ARC status alone must not unlock unassigned books.
- Fresh server-side account/assignment/campaign/release-window checks on every open;
  review due dates are not automatically access-expiry dates.
- Accepted copyright terms recorded server-side; preserve existing issuance/reference
  history through the verified legacy function rather than inventing a second code.
- No paid membership or customer-launch flag required for the authorised ARC path.
  Paid-reading rules remain intact for the normal catalogue.
- Protected in-reader entry point from ARC Vault, replacing standalone EPUB downloads
  only for campaigns/readers explicitly migrated. Preserve reviews and old records.
- Online-only ARC reading initially; no offline save or export controls for ARC grants.
- Verify unassigned/other-user, unopened/closed/revoked campaign, missing terms and
  expired session cases fail. Test a genuine non-admin user, not just administrator bypass.
- In-reader controls cannot guarantee determined users cannot extract rendered content.
