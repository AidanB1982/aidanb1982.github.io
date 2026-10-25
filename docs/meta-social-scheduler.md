# Facebook and Instagram scheduling

Write posts in Behind the Files; no AI subscription or model is required. The code
supports Facebook text/single-image posts and Instagram single-image posts. It is not
connected to live Meta accounts until the owner completes this setup. No deployment
or database migration sends anything by itself; the worker defaults to paused.

## 1. Existing Meta app and account access

Use the existing Blackwood Publishing app in Meta for Developers. This integration
uses **Facebook Login / Instagram API with Facebook Login**, a Facebook Page access
token and the Instagram professional account linked to that Page. It does not use an
Instagram Login token or an app access token. Facebook Page admin access alone is not
an API token.

The Page access token needs publishing permissions for the owner-managed assets:
`pages_manage_posts`, `pages_read_engagement`, `instagram_basic` and
`instagram_content_publish`. `pages_show_list` is used when obtaining the token and
identifying the Page. App/use-case setup, advanced access and review requirements
depend on the app and assets. Confirm these in the app dashboard. Development-mode
tests must use authorised app roles/assets. Do not assume read access proves publish
permission.

Meta's Graph API Explorer can request the app's user permissions and list the managed
Pages via `me/accounts?fields=id,name,access_token,instagram_business_account{id,username}`.
Choose the Blackwood Page and save **that Page's** ID and access token in Supabase
Secrets. Do not paste the response or token into chat, a public repository, or a
browser script. Use a token with suitable longevity for unattended work; temporary
Explorer tokens are for connection tests. Tokens can expire or be revoked and need
replacement; this first version has no OAuth refresh flow.

Required server secrets:

| Name | Value |
| --- | --- |
| `META_PAGE_ID` | Numeric Blackwood Facebook Page ID |
| `META_PAGE_ACCESS_TOKEN` | That Page's authorised access token |
| `BP_SOCIAL_CRON_SECRET` | Unique random secret, at least 32 characters |
| `BP_SOCIAL_PUBLISHING_ENABLED` | Keep `false` until the connection and schedule are verified |
| `META_GRAPH_VERSION` | Optional supported Graph API version; default `v24.0` |

Never put any of these secret values in the HTML or JavaScript. The UI connection
check returns the Page name and linked Instagram username only. It performs GET
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
