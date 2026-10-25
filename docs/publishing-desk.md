# Publishing Operations setup

The tools are on the existing `/pages/behind-files-admin.html#publishing-operations`
page. They use the existing Supabase `member_profiles.is_admin` permission.

## What is included

- ARC campaign selection and active, approved ARC-member selection.
- Explicitly assigning a campaign to selected readers, with a new review due date.
  Existing assignments, downloads, filed reviews and application references remain intact.
- A per-recipient preview and separate available/reminder notices from
  `aidan@blackwoodpublishing.co.uk`, sent individually through Microsoft Graph.
- A server-side notification ledger, separate from download counts. Only readers
  with a current assignment, no download and no filed review receive these notices.
- An AI drafting assistant using supplied, approved book facts. TikTok drafts can
  include a hook, script and shot list. Drafts are reviewed before use.
- A Supabase-backed planning calendar for Facebook, Instagram, TikTok, Email and
  Behind the Files; draft/approved/scheduled/published-manually states; UTC calendar
  export; optimistic editing conflict checks; and a monthly newsletter template.
- Monthly newsletter slots are unique by planned month in Europe/London. Preparing
  the next month retains an original end-of-month day across shorter months.
- The ARC profile's current-book display now uses Supabase assignments. Application
  sheet details are retained in a labelled historical section. The assignment monitor
  can filter by book and links to the new launch tools.

A downloaded count of zero does not mean an email was sent. An assignment also does
not automatically give every other ARC member that book. The launch tool makes both
steps explicit.

## 1. Supabase database

Run `supabase/diagnostics/publishing-desk-preflight.sql` in the SQL Editor first.
It reads schema metadata only. Check that the existing ARC IDs are numeric, member IDs
are UUIDs and the listed fields exist. The existing `application_id` is copied from
that reader's most recent assignment when a new assignment is created. If an ARC
reader has no prior assignment and your live schema requires an application reference,
that application must be linked before assigning; the transaction will fail instead
of partially assigning a team.

Then run `supabase/migrations/20261028_publishing_desk.sql` once. It adds new tables and
functions without deleting or replacing existing ARC files or reviews. It does not
send mail, assign anyone or publish content merely by being applied.

## 2. Supabase function

Create **bp-publishing-desk**. Paste the entire generated file
`supabase/dashboard/bp-publishing-desk.ts` into its `index.ts`, then deploy.
Do not paste only the small source index without its imported modules.

Keep JWT verification **on**. The handler additionally verifies the user with Supabase
Auth and checks `member_profiles.is_admin` server-side. The Supabase URL, anon key and
service-role key use the normal built-in Edge Function environment bindings.

No API credential is put into the website JavaScript.

## 3. Connect Outlook

The connection is for a Microsoft 365 work/school mailbox, using app-only Microsoft
Graph authentication. It does not use an Outlook password or SMTP basic authentication.

In the Microsoft Entra admin centre:

1. Register a single-tenant server application. Client credentials do not require a
   browser redirect URL for this implementation.
2. Add the Microsoft Graph **application** permission `Mail.Send` and obtain tenant
   administrator consent.
3. Restrict that application's mail access to `aidan@blackwoodpublishing.co.uk` using
   an Exchange Online application access policy. If your tenant uses Application RBAC,
   configure the equivalent scoped role without a parallel unscoped permission grant.
   Your Microsoft 365 administrator should verify both allowed and denied mailboxes.
4. Create a client secret and record its expiry for rotation.

Add these values in **Supabase → Edge Functions → Secrets**:

- `MICROSOFT_TENANT_ID`: directory/tenant ID.
- `MICROSOFT_CLIENT_ID`: application/client ID.
- `MICROSOFT_CLIENT_SECRET`: client-secret value.

Enter secrets there, never in chat or repository files. The sender is fixed server-side
to the requested mailbox. Each message has one recipient and is saved to Sent Items.
The function requests no contact-reading or calendar-writing permission.

Microsoft Graph returns **202 Accepted** for submission, not proof of delivery. The
UI therefore says “submitted to Outlook”. Check Sent Items and mailbox delivery
reports for a real test. If this address is not hosted in Microsoft 365, this app-only
connection needs to be replaced with the mailbox's actual supported sending mechanism.

## 4. Connect the AI assistant

Add `OPENAI_API_KEY` as another Supabase secret. Optionally set
`OPENAI_MARKETING_MODEL`; the default is `gpt-4.1-mini`.

Only the book title, author, chosen channel, drafting instruction and manually supplied
facts are sent to OpenAI. The ARC roster is never automatically included. Do not put
reader contact details in a factual brief. Responses are text drafts; there is no model
access to email sending, assignment changes or publishing tools. A database-backed
limit allows 30 draft requests per administrator per hour. The provider account needs
its own billing/usage limits. Planning and manual drafting work without an AI key.

## Launch Gualachulain to the ARC team

1. Choose **Gualachulain** in the ARC launch desk. Verify its campaign is active and
   that the download window is open.
2. Select the intended active ARC team members and a review due date. Click
   **Assign selected readers**. Existing rows are retained rather than reset.
3. Start with one test reader you control. Click **Preview email recipients** and
   check their exact address, title and message. This step sends nothing.
4. Click **Send these ARC notices**. Confirm the message arrives and the protected
   profile shows Gualachulain. Its existing copyright acceptance and personalised
   download service remain authoritative.
5. Repeat the preview/send for the intended team after the test succeeds. The browser
   submits small batches so large sends do not exceed an Edge Function execution window.

Replaying the same notification does not send again. A separate reminder is a deliberate
follow-up for readers who still have no download/review. Transport timeouts, ambiguous
provider responses or an interrupted database update are never automatically resent.
They remain “unconfirmed” or “sending / check before retrying”; check Outlook before
manual reconciliation. A definitely rejected request may be retried from a **fresh**
preview after correcting its cause. The same batch never loops failed recipients.

These are assignment-specific ARC notices, not a subscription to general marketing mail.

## Social publishing and the monthly mailing list

The scheduler currently stores plans and editorial states. It does **not** automatically
post to Facebook, Instagram or TikTok, or send the monthly newsletter. “Published
manually” is recorded only when an administrator explicitly chooses it and saves.
Exported calendar slots are reminders, not social API jobs. Monthly preparation creates
an unsaved draft for review; it is not an automatic recurring send.

Automatic publication is a separate connection step requiring the actual accounts,
permissions and assets: a Facebook Page, the associated Instagram professional account,
authorised TikTok Content Posting access and video assets, plus the mailing platform.
The site already has a MailerLite signup form. Keep the newsletter's subscribed audience
and unsubscribe footer in that platform; do not substitute the ARC reader roster.

Public BP Reading navigation and its checkout/customer launch flags remain unchanged.
KDP term dates do not trigger publication or assignment automatically.

## Validation and limits

- `node tests/publishing-desk.mjs`: real handler and Outlook transport with mocks;
  authentication, campaign/release checks, private previews, replay protection,
  changed recipients, ambiguous delivery and current-campaign selection.
- `node tests/publishing-desk-schema.cjs`: actual migration in PGlite; RLS, SQL
  permissions, duplicate assignment protection, retained reviews, monthly slots,
  optimistic editing, notice claims and AI rate limits.
- `node tests/publishing-desk-browser.cjs`: actual admin-auth integration and UI with
  mocked Supabase/provider responses; assign/preview/send, AI-to-calendar, monthly
  preparation, calendar export, mobile layout and session lifecycle.
- `node tests/arc-profile-current.cjs`: actual ARC-profile UI with mocked services;
  current Supabase campaign, retained history and admin book filtering.
- `python3 scripts/bundle-edge-functions.py --check`: generated dashboard source.

Use the existing local server and Playwright settings from `tests/README.md`.
PGlite is an optional test dependency (`@electric-sql/pglite@0.3.14`); install it in an
external scratch directory rather than adding runtime dependencies to this static site.

These tests do not connect to the live Supabase project, Microsoft mailbox, OpenAI
account, social accounts or MailerLite. Live setup, actual delivery and channel
permissions must be verified after configuration. No existing reader has been assigned
or emailed by these development tests.

### If assigning readers appears to do nothing

The selection count and assignment result are displayed above the reader table beside
**Assign selected readers**. Selecting the team ticks boxes; the separate assignment
action writes the new book assignments. A review due date is required. A confirmed
result shows new and retained record counts, followed by a refreshed list.

If the function rejects the request, the same area shows its error. Redeploy the
updated generated `bp-publishing-desk.ts` bundle to receive specific assignment
errors, including a missing application reference, conflicting legacy constraint,
missing database function or service-role execute permission. Raw database row details
are not returned to the browser. No SQL or mailbox permission change is required
merely to deploy these diagnostic messages.

`supabase/diagnostics/arc-assignment-readiness.sql` is a read-only aggregate check for
the Gualachulain campaign, active ARC team, existing assignments and missing application
references. It does not assign anyone, send mail or expose recipient addresses.
A missing application reference can abort the existing transaction; it is not evidence
that selection failed. Link the legitimate application reference before retrying.
