# BP Reading: implementation and launch

## Product decisions

- £10.99 GBP per year for all available Blackwood reading editions, through an annual Shopify subscription.
- Each paid purchase/renewal starts its own 12-calendar-month access period at the verified payment timestamp (UTC). Leap-day anniversaries fall on 28 February the next year. Repeated delivery of the same payment does not extend access; out-of-order payments cannot shorten an existing paid period.
- £1.99 per book will provide permanent in-reader access even when membership expires. The schema supports this; individual-book Shopify products/checkouts still need configuring.
- No downloadable-file link or offline book cache. Browsers receive EPUB bytes to render them, so extraction and screenshots cannot be made impossible.
- Shopify membership product ID: `16729856016729`; variant: `60163522265433`; annual selling plan: `697040896345`. Product data supplied by the owner confirms £10.99, no shipping and a required selling plan.
- Membership product URL uses `blackwoodpublishing.myshopify.com`; the existing physical-store code uses `vmbd0z-c6.myshopify.com`. Confirm the canonical Shopify shop domain before issuing credentials or configuring webhooks; do not assume a Storefront token for one domain applies to another.

## Prepared locally; not deployed

The reader now supports multi-book metadata/series filtering, per-account and per-edition state, private highlights and notes, adaptive chapter-time estimates, and reader-reference watermarks. Authenticated nonmembers can see the catalogue and subscription route. Read buttons require an entitlement check (or verified administrator testing); EPUB delivery independently authorizes every request. A missing catalogue is not exposed through an administrator fallback to nonmembers. The subscription offer appears on `/pages/bp-reading.html` for signed-in non-admin readers. Verified Supabase `member_profiles.is_admin=true` administrators see the library without subscription prompts and retain the independent server-verified admin delivery path. Existing management-page gates are unchanged. The normal refund-request window is the first 7 days of purchase, displayed beside the offer. After that, membership payments are non-refundable, subject to statutory rights; reading the catalogue for 30 days does not qualify for a normal policy refund. Refund requests are reviewed/processed in Shopify; there is no automatic customer refund-request API yet. The webhook honours actual verified refunds regardless of when an administrator processes them, rather than retaining access after money has been returned. A link from the signed-in Archivists dashboard opens BP Reading.

The optional sync client has a persistent device outbox, optimistic revision checks and explicit recovery when another device has newer data. Missing migrations/network access leave a clearly labelled device-only mode. Appearance is currently per edition. Highlights use EPUB CFIs, so replacing an edition can require position migration. The notebook supports up to 500 entries, 4,000-character quotes and 6,000-character notes; the server snapshot limit is 400 KB. Oversized snapshots remain local and report sync failure.

The **Subscribe** button opens a separate browser popup (or tab on browsers that choose tabs), leaving BP Reading open. It never embeds Shopify in an iframe. Checkout is created for the verified Supabase user with the exact annual selling plan and £10.99 GBP subtotal; it has no one-time-purchase fallback. A server-generated checkout reference binds the purchase to the account. A popup closing, checkout return URL, email match, cart note alone or browser callback never grants access. Polling reads only the caller's checkout status; after five minutes a manual payment check remains available. A pending checkout can be reopened instead of creating another payment attempt.

## Database migrations

Apply in order, first in staging:

1. `supabase/migrations/20261025_bp_reading.sql`: stable titles, approved edition metadata, explicit private-file release approvals, memberships, permanent purchases and private reader snapshots. It seeds only the existing Gualachulain edition ID 2. No customer file releases or paid entitlements are seeded.
2. `supabase/migrations/20261026_bp_reading_checkout.sql`: server-owned checkout intents, idempotent payment receipts, private status polling, calendar-year grants and full-refund recalculation. The browser cannot call payment-grant/revocation functions or directly modify receipts or access dates.

3. `supabase/migrations/20261027_bp_reading_member_profiles.sql`: links all reader/account ownership fields to the existing `public.member_profiles.id`. Existing reading state and payment records are preserved. The migration stops if a record has no member profile; link that profile before retrying rather than deleting reader data. The existing site already uses `member_profiles.id = auth.uid()`; signed JWTs still determine ownership, and `is_admin` still controls the admin bypass. No profile or admin flag is automatically created.

These are one-time transactional migrations, not scripts to rerun over already-created tables. Existing publishing tables are not altered. Permanent purchases belong to a stable book ID, so replacement EPUB editions can retain access. Snapshots remain edition-specific.

## Edge Functions

- `bp-reading-deliver-epub`: preserves the supplied administrator path and private `bp-reading-editions` bucket/`bp_reading_files` registry/`book_editions` checks. Customers require both a caller-JWT entitlement and an enabled `bp_reading_releases` approval matching the exact registry path. The existing registry's known `admin_testing` value is preserved; it does not alone release files to customers. No public or signed file URL is returned. Responses are private/no-store and protected against MIME sniffing.
- `bp-reading-create-checkout`: validates the account, creates a bound intent, creates the Shopify Storefront cart with variant and annual plan, verifies the returned allocation and GBP subtotal, and records the cart before returning its checkout URL.
- `bp-reading-shopify-webhook`: verifies Shopify's HMAC over the unchanged request body and expected shop domain. For `orders/paid`, it re-queries the order/transactions through the Admin API, verifies the single membership line, annual plan and paid GBP offer, resolves the checkout reference, and uses a successful sale/capture's processed timestamp for the access period. For a verified full refund, it revokes that receipt and recalculates access without removing another valid paid period. Partial refunds are logged for manual review; they do not automatically rewrite the membership period.

`supabase/config.toml` disables platform JWT checking **only** for the Shopify webhook: Shopify authenticates with its raw-body signature. All user-facing functions retain normal JWT verification. The webhook has three editor files: `index.ts`, `handler.ts`, and `shopify-auth.ts`. Keep all three together when deploying. The token helper caches tokens only until shortly before expiry and retries an unauthorized order lookup once with a fresh token. These changes do not change Storefront checkout token requirements. Function handlers have dependency-injected tests; their Deno/Shopify adapters still require live staging validation.

## Runtime configuration (server-side only)

The supplied Supabase function already uses runtime `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY`. Preserve these; never put the service-role key in website files or chat.

Configure securely in Supabase function secrets:

| Name | Purpose |
|---|---|
| `SHOPIFY_STORE_DOMAIN` | Verified canonical `*.myshopify.com` shop. Must match the signed webhook's shop header. |
| `SHOPIFY_STOREFRONT_TOKEN` | Token for that shop with the supported product, selling-plan and cart permissions. |
| `SHOPIFY_CLIENT_ID` | Client ID of the installed, own-store Dev Dashboard app. |
| `SHOPIFY_CLIENT_SECRET` | Server-only Client Secret for that app. The webhook exchanges these through the client-credentials grant and refreshes expiring Admin API tokens automatically. The app and store must meet Shopify’s own-organization eligibility rules. |
| `SHOPIFY_ADMIN_ACCESS_TOKEN` | Optional legacy fallback if client credentials are not configured. Do not rely on manually pasted short-lived tokens for production. |
| `SHOPIFY_WEBHOOK_SECRET` | Signing secret belonging to the configured Shopify webhook integration. |
| `SHOPIFY_READING_SELLING_PLAN_ID` | Optional override; default is `gid://shopify/SellingPlan/697040896345`. |
| `BP_READING_CUSTOMER_ACCESS` | Keep unset/false until protected delivery and entitlements pass staging tests. |
| `BP_READING_CHECKOUT_ENABLED` | Keep unset/false until webhook processing passes staging tests. Checkout requires both launch flags. |
| `BP_READING_ALLOWED_ORIGINS` | Optional additional HTTPS origins for delivery. Defaults include the production/www/GitHub Pages origins. |

No credential values are saved in this repository. These are Edge Function settings, not GitHub Pages environment variables.

## Shopify configuration and live acceptance

1. Keep the annual product non-shipping, subscription-only and £10.99 GBP with the confirmed yearly plan. Do not attach downloadable files or fulfil it through a digital-download app.
2. Configure the supported Storefront access/app for the canonical shop and verify that its cart API returns the correct annual allocation. The physical-store Buy Button is not used for this checkout.
3. Deploy the webhook and subscribe it to `orders/paid` and `refunds/create` at `https://bmnlynjldlnxfvunqbqq.supabase.co/functions/v1/bp-reading-shopify-webhook`. Use the actual signing secret for those webhook subscriptions.
4. Verify Admin GraphQL API version `2026-10`, permissions, line selling-plan IDs, successful transaction timestamps and checkout attributes against real test orders. The adapter fails closed if it cannot verify these fields. A captured payment must be confirmed; authorization alone grants nothing.
5. Test both the initial purchase and a renewal using the chosen Shopify Subscriptions setup. The renewal must preserve a verifiable checkout/account reference. If that app does not retain the reference in order/line custom attributes, implement its supported subscription-contract mapping before launch. Do not substitute email matching.
6. Test duplicate/out-of-order webhook deliveries, popup closure/blocked popups, delayed payment, invalid signature, wrong shop/variant/plan/currency, failed payment, full and partial refunds, cancellation, an expired reader, a permanent book purchaser, and cross-account status/notes. Cancellation stops future billing while the paid period remains valid. Review the partial-refund workflow before launch.
7. Explicitly approve each customer file through an enabled server-only release row matching its private registry bucket/path after rights and file QA. Keep the bucket private. Never put private paths in browser metadata.
8. Once the matching backend and real-order tests pass, set both launch flags to `true`, publish the website, and verify an actual protected book as a non-admin reader. No live credentials, function deployments, paid test orders or webhooks have been verified in this workspace.

Current blockers to live activation are the migrations/function deployment, canonical-shop credentials/webhook configuration, approved file releases and real Shopify initial/renewal acceptance tests. The prepared code and local tests do not establish that customers can pay and gain access in production.

## Tests

See `tests/README.md`. Browser tests use the actual EPUB.js renderer and a generated, copyright-free book, with Supabase mocked. Embedded PostgreSQL tests exercise the actual migrations, RLS, expiry, permanent purchases, calendar-year grants, idempotency, renewals and full-refund recalculation. Handler tests cover delivery, cart creation, webhook HMAC/offer verification and popup confirmation. None touches the live Supabase or Shopify account.

## Read-only setup diagnostic

Deploy `bp-reading-setup-check` with its `index.ts` and `handler.ts`, retaining JWT
verification. Signed-in Supabase administrators can then use **Check Shopify
setup** on BP Reading. The function independently checks the administrator flag,
table availability without reading customer rows, app client-credentials access,
Admin API scopes/schema, Storefront visibility of the exact membership variant
and annual plan, and signing-secret presence. It returns no credential values.
It creates no carts, payments, refunds or database rows. A green report is not a
billing test or proof of webhook/renewal delivery; retain both launch flags as
false until the full acceptance tests pass.

The existing website's public Storefront token is in `js/store.js` under
`storefrontAccessToken`. It can be tried first as SHOPIFY_STOREFRONT_TOKEN because
both Shopify domains have been confirmed to belong to the same store. Its
subscription scopes and product publication still require the live diagnostic;
do not assume a Buy Button token has every required permission.
