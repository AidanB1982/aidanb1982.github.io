# Facebook and Instagram scheduling

Write posts in Behind the Files; no AI subscription or model is required. The code
supports Facebook text/single-image posts and Instagram single-image posts. It is not
connected to live Meta accounts until the owner completes this setup. No deployment
or database migration sends anything by itself; the worker defaults to paused.

## 1. Existing Meta app and account access

The existing Facebook connection uses a **Facebook Page access token**. The owner
verified Blackwood Publishing Page `1236290872910367`; Graph API Explorer was using
`v26.0`, so that version is explicitly saved in `META_GRAPH_VERSION` for this setup.
Page admin access alone is not an API token.

There are two supported Instagram credential routes:

- Existing Facebook-login apps may return the linked professional Instagram account
  in `instagram_business_account` using an appropriately authorised Page token.
- The owner's newer app displays **Instagram API with Unified Login**, a configuration
  with Instagram assets, `instagram_basic` / `instagram_content_publish`, and a
  system-user access token. Configure its numeric Instagram account ID and token
  separately in the two optional Instagram secrets below. Facebook retains its own
  Page token. These credentials use `graph.facebook.com`, not the different standalone
  Instagram Login API/token type.

For Facebook, request `pages_manage_posts`, `pages_read_engagement` and
`pages_show_list` as needed during authorisation/discovery. Instagram publishing
needs `instagram_basic` and `instagram_content_publish` for this app's displayed
Unified Login flow. Ads, messages and comment management are not used by our scheduler;
remove those optional permissions through **Edit permissions** where possible.

For the current Unified Login dashboard:

1. Select the Instagram configuration. The owner created configuration
   `1433285518283606`; **this is not the Instagram account ID**.
2. Under **Generate access tokens**, use **Add Instagram account** / the token-generation
   controls. Follow the dashboard's requirement to assign the Instagram Tester role
   and accept its invitation in Instagram. The account must be professional.
3. Save the generated account token and numeric Instagram account ID in Supabase,
   not chat or frontend files. If the dashboard requires a redirect URL to proceed,
   stop and inspect that flow: the website does not currently implement Meta OAuth
   start/callback/token exchange. Do not register a fictional `/auth/callback` URL.
4. Deploy the regenerated desk and worker bundles below. The read-only check verifies
   the direct Instagram ID with its own token. It reports an Instagram-specific
   failure without discarding a working Facebook connection. Partial/invalid explicit
   Instagram configuration never silently falls back to a different linked account.

The dashboard says direct developers working only with their own Instagram businesses
may skip App Review; access for clients/other businesses has different requirements.
Use the actual app's roles, assets, permission and review requirements. A read-only
connection result does not establish permission to publish or prove cron health.

For the older Page-linked route, Graph API Explorer may list the managed Pages via
`me/accounts?fields=id,name,access_token,instagram_business_account{id,username}`.
Save **the Page's** token, not the Explorer's user token. Temporary Explorer tokens
are for tests; obtain suitable longevity before unattended work. Even a token labelled
“never expires” can be revoked by Meta or account/asset changes. No OAuth refresh flow
is implemented in this version.

Required server secrets:

| Name | Value |
| --- | --- |
| `META_PAGE_ID` | Numeric Blackwood Facebook Page ID |
| `META_PAGE_ACCESS_TOKEN` | That Page's authorised access token |
| `META_INSTAGRAM_ACCOUNT_ID` | Optional pair: numeric Instagram account ID from Unified Login |
| `META_INSTAGRAM_ACCESS_TOKEN` | Optional pair: that account's authorised Unified Login token |
| `BP_SOCIAL_CRON_SECRET` | Unique random secret, at least 32 characters |
| `BP_SOCIAL_PUBLISHING_ENABLED` | Keep `false` until the connection and schedule are verified |
| `META_GRAPH_VERSION` | Optional supported Graph API version; default `v24.0` |

Never put any of these secret values in the HTML or JavaScript. The UI connection
check returns the Page name, verified Instagram username and a safe Instagram error if needed. It performs GET
requests and never creates posts; it cannot prove all publishing scopes or cron health.

## 2. Database and Edge Functions

After the existing publishing-desk migrations, run
`supabase/migrations/20261031_social_scheduler.sql` in the SQL Editor. It adds delivery
metadata without changing existing plans from manual to automatic. Re-running this
migration is unnecessary. The UI detects whether the new column exists and leaves
automatic delivery unavailable until the migration and updated desk are present.

Deploy both generated, self-contained dashboard files:

- `supabase/dashboard/bp-publishing-desk.ts` → existing **bp-publishing-desk**.
  Retain its existing signed-in administrator checks/JWT configuration.
- `supabase/dashboard/bp-social-publish.ts` → new **bp-social-publish**.
  Turn platform JWT verification **off** for this worker: it authenticates each POST
  using `x-bp-social-secret` and refuses to run without the matching strong secret.

These are TypeScript Edge Function files, not SQL. Regenerate them after source changes
with `python3 scripts/bundle-edge-functions.py`. `supabase/config.toml` captures the
worker's JWT setting for CLI deployments; dashboard deployments need the manual setting.

Refresh the site and click **Check Facebook & Instagram connection**. Confirm the
correct Page and Instagram account. Keep the publishing switch off during setup.

## 3. Run while the browser is closed

Enable `pg_cron` and `pg_net` in Supabase Database Extensions. In **Supabase Vault**, add
`bp_social_cron_secret` with the **same value** as Edge secret `BP_SOCIAL_CRON_SECRET`.
These are separate secret stores. Then run `supabase/schedules/bp-social-publish.sql`.
It checks Vault and registers one named cron job. Re-registering the same name updates
that job. The project URL is the site's existing Supabase project; adjust it if deploying
elsewhere.

The cron request uses the server-held Vault secret, never an admin's browser session.
It runs every minute and publishes at most one due item per invocation. Busy queues
can take longer; this is not second-accurate posting. Times are saved in UTC from the
local planning timezone shown in the desk. The worker remains paused until the Edge
secret `BP_SOCIAL_PUBLISHING_ENABLED` is exactly `true`.

Cron setup needs a live check in Supabase (`cron.job`, `cron.job_run_details`, and
`net._http_response` / worker logs). The UI's configuration banner does not claim the
cron job is installed or healthy.

## 4. Controlled first publication

First verify the read-only connection, background schedule and intended accounts.
Prepare one clearly labelled test, choose **Publish automatically**, set its channel,
caption and a time a few minutes ahead, choose **Scheduled**, then save. For Instagram,
use a publicly reachable JPEG with Meta-compatible dimensions/aspect ratio; for
Facebook an image is optional. Instagram captions have a 2,200-character limit.
This version accepts a public URL, not a file upload; it does not publish videos,
carousels, Stories or Reels. Unsupported channels stay manual.

Only when ready for that explicit test, switch `BP_SOCIAL_PUBLISHING_ENABLED` to
`true`. Confirm the post appears in the intended account and the desk records
**Automatic · published** with a platform ID. Test Facebook and Instagram separately.
These development tests have not published anything to the real accounts.

Automatic scheduled items can be edited/rescheduled or returned to Draft before a
worker claims them. Once processing starts, editing is locked. Published automatic
items are immutable in this first version; changing the local record cannot edit or
delete a platform post. Manual plans retain the existing copy/mark-published workflow.

## Failures and pausing

- **Failed:** Meta definitively rejected the request, or Instagram was not ready and
  no publish request was made. Fix the cause and explicitly reschedule at a future
  time. No background retries happen automatically.
- **Unknown:** A timeout, server failure, missing publication ID or lost worker could
  mean the post exists. Check the actual account first. The record stays locked;
  do not duplicate or reset it blindly. A database administrator can reconcile it
  using the verified platform ID/outcome. There is no one-click retry for uncertainty.
- **Processing:** A claimed job. If a worker disappears, after ten minutes a later
  worker run quarantines it as unknown, never silently resending.
- **Pause:** Set `BP_SOCIAL_PUBLISHING_ENABLED=false` to prevent new claims. A request
  already in flight may finish. To stop the cron itself, use Supabase Cron to disable
  the named `bp-social-publish` job.

The platform post ID is the acknowledgement of publication. A scheduled timestamp
or closed browser alone is not evidence of delivery. Lost acknowledgements are
quarantined rather than claiming exactly-once delivery across two services.

TikTok and newsletter auto-delivery are separate future integrations. Monthly email
needs the actual subscribed mailing list and its unsubscribe handling; ARC assignments
are not newsletter consent. The AI panel is currently hidden by request.

## Connection button gives no feedback

The connection button now shows a checking message immediately, reports deployment
and Meta errors beside the button, and times out after 25 seconds while releasing
the controls. This timeout applies only to the read-only social check, not ARC sends.
If the deployed desk predates Meta support, replace its dashboard `index.ts` with the
whole `supabase/dashboard/bp-publishing-desk.ts` bundle and redeploy. Do not paste SQL
or a partial handler into it. Preserve its existing authenticated-admin/JWT setup.
Keep `BP_SOCIAL_PUBLISHING_ENABLED=false`; checking the connection makes no posts.
