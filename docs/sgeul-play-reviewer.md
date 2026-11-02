# Sgeul Google Play reviewer account

Use a dedicated owner-created, email-confirmed Supabase email/password account.
Reviewers should not receive the publisher's own credentials, administrator roles,
one-time email challenges or a requirement to buy access. Keep the password in
Play Console's App access fields, not Git, SQL scripts or app source.

## Owner setup

1. Create and confirm the account in Supabase Authentication. Retain the UUID.
2. Run [enable-play-reviewer.sql](../supabase/operations/enable-play-reviewer.sql),
   replacing its UUID and email placeholders, or use the privately prepared copy.
   This creates a missing normal Reader profile, enables the profile's ARC flag,
   grants a one-year complimentary reading membership with **no payment reference**,
   and assigns the existing protected Gualachulain ARC (campaign 3 / edition 2).
   It checks the exact confirmed Auth identity, pinned private files and resulting
   rights, rejects conflicting/revoked/admin state, and preserves unrelated accounts.
3. Replace the entire existing `bp-reading-deliver-epub` dashboard `index.ts` with
   [the current combined file](../supabase/dashboard/bp-reading-deliver-epub.ts),
   then deploy, preserving its current JWT/authentication configuration.
4. Add the reviewer UUID to Edge Function secret `BP_READING_TEST_USER_IDS` (comma
   separated; retain existing entries). The earlier single `BP_READING_TEST_USER_ID`
   remains supported. This allows an additional authorised tester without opening
   `BP_READING_CUSTOMER_ACCESS` globally. Caller identity, entitlement, private file
   and release checks still apply; the allowlist alone grants no book rights.
5. Test the account on a fresh browser/device profile or in the app before submitting
   its credentials. Check both Library and ARC room. No new Android bundle is needed
   for this server-side setup.

No campaigns, other profiles, paid orders, existing review links, downloads, RLS or
bucket visibility are changed. The shared Gualachulain mapping must already be
ready/open; the operation does not reopen closed campaigns. Reviewers accept their
own current ARC terms. The complimentary membership is not a verified payment or
Shopify subscription. Retain access throughout review and future updates; renew it
before expiry and keep the ARC campaign/grant available for reviewers as needed.

## Suggested Play Console access instructions

Sign in using the dedicated email and password provided in these access fields.
Email is already confirmed; no OTP, payment or subscription purchase is required.

- Home → Library: open The Black Bothy to test protected library reading.
- Home → ARC reading room: open the assigned Gualachulain copy after accepting the
  three copyright terms.
- Choose Save offline and wait for the saved confirmation. In airplane mode, reopen
  Sgeul and use Saved on this device to access the saved copy before its displayed
  expiry date. Reconnect to verify/refresh access.
- Reading menu provides contents, bookmarks, saved places, appearance and notebook.
- Bookshop lists physical products; purchases are optional and are not necessary to
  inspect or use the reading features. Do not place an order as part of access setup.

Unreleased catalogue titles remain unavailable to all normal readers. Website and
Google Play sign-in accounts are separate: use the Blackwood login supplied here.
