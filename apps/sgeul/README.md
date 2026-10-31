# Sgeul · Android prototype

**Every Story Begins Somewhere** · By Blackwood Publishing

A local Capacitor Android app, not a remote website wrapper. Package ID:
`uk.co.blackwoodpublishing.sgeul`. Confirm this before the first Play upload; Play
package IDs cannot be changed for an existing listing.

## Included

- Existing-account email/password sign-in using the existing Supabase project.
- Library and private ARC room using the shared BP Reading reader and server checks.
- Bundled EPUB engine, public texts, cover images and reader interface: no CDN or
  website service worker is required to open the native reader offline.
- Explicit encrypted device copies with existing account isolation, server-issued
  expiry, current ARC copyright acceptance and reconnect revocation checks.
- Bookmarks, notes and place through the existing reader. ARC state remains local;
  normal protected reading keeps its existing cloud-sync rules.
- Physical-only bookshop: website product metadata, Shopify live prices/stock and
  `requiresShipping` verification. Checkout opens Shopify in the system browser.
  Digital workbooks, services, digital checkout and subscription purchase UI are
  excluded from the native package.
- Device sign-out cleanup and disabled Android backup for saved/session data.

This is a test prototype, not a Play-ready release. It does not yet include the
interactive member bookshelf, push notifications or in-app account deletion.

## Build

Requirements: Node 22+, Java **JDK** 21 (a JRE alone is insufficient), Android SDK
platform 35/build-tools 35.0.0, and Android Studio or equivalent command-line tools.

```sh
cd apps/sgeul
npm ci
npm run android:sync
npm test
npm run android:open
# Or build a debug APK from the command line:
npm run android:debug
```

Set `ANDROID_HOME`, or use an untracked `android/local.properties` containing
`sdk.dir=/your/android/sdk`. The APK is produced at
`android/app/build/outputs/apk/debug/app-debug.apk`.

Shared website sources are bundled at build time; changing the reader requires a
new app build. `scripts/build.mjs` fails if its integration anchors no longer match,
or digital checkout code enters the reader bundle. No protected EPUB or private
Storage path is packaged. Only the existing public Supabase and Storefront keys
are included. Never add service-role keys, Meta tokens or Shopify Admin credentials.
The XML parser override patches the EPUB engine dependency; the app bundles from
source rather than using the engine's precompiled legacy distribution.

## Supabase setup before testing real accounts

The Android app uses `https://localhost` as its **local native origin**. It does not
use `server.url` or allow arbitrary remote pages to run as the app.

1. In Edge Function Secrets, add `https://localhost` to `BP_READING_ALLOWED_ORIGINS`.
   Preserve any existing values, separated by commas.
2. Redeploy the existing `bp-reading-arc` using
   [the combined index.ts](../../supabase/dashboard/bp-reading-arc.ts). Keep legacy
   JWT verification OFF: fresh caller validation remains in its handler.
3. The existing `bp-reading-deliver-epub` supports that same setting. If it is not on
   the repository's current code, deploy [its combined index.ts](../../supabase/dashboard/bp-reading-deliver-epub.ts), preserving its existing authentication settings.

No new SQL, role upgrades, paid entitlements, campaign activation or public bucket
is needed. CORS configuration never grants access; requests still need a verified
Supabase JWT and the existing exact book/assignment entitlement. Website origins
remain permitted. Web-browser development origins are not automatically trusted.

## Device acceptance

1. Install the debug APK on an Android test phone and sign in using the basic ARC
   test account. Confirm its assigned Gualachulain appears in the ARC room.
2. Accept terms, open, turn pages, save a bookmark/note, and choose Save offline.
3. Enable airplane mode, fully close/reopen Sgeul, open the ARC room and read the
   saved book. Repeat after the short online JWT has expired but before the saved
   deadline. An offline lease is not an extension of account entitlement online.
4. Reconnect after revoking the test grant: the open ARC should close and its saved
   copy be removed on a confirmed denial. Restore only the intended test grant.
   A disconnected device cannot receive immediate revocations; expiry still applies.
5. Test an ordinary account with no paid/ARC grant: it must not open protected books.
   Verify an entitled subscriber and an individual-book purchase separately.
6. Sign out: saved copies and that account's local reading data must be removed.
7. Check physical product variants, prices, sold-out state and Shopify checkout on
   the device. Tests do not place orders or verify live Shopify publication settings.
8. Test Android back navigation, keyboard, rotation, background/resume, large text,
   device storage pressure and phone-specific icon masks.

## Before Play submission

- Supply the approved Sgeul foreground transparent PNG and square blue artwork as
  source files. The prototype retains the framework's temporary launcher/splash
  artwork; no recreation of the approved logo is being passed off as final branding.
- Add adaptive/monochrome icons and branded splash assets with mask-safe padding.
- Implement account deletion and its web request route; review privacy/support and
  Google Play Data safety declarations against actual SDK/data use.
- Add the member bookshelf and notifications only after their native flows are tested.
- Confirm the target Android API required by Play Console, supported device testing,
  closed-testing requirements for the account, and current payments rules.
- Use an owner-controlled release/upload signing key and Play App Signing. The test
  APK uses a debug key and must not be submitted as the production release.
- Verify current digital publishing/KDP rights and paid-access lifecycle before
  widening the audience. No digital purchasing is implemented in this prototype.

## Validation

`npm run build && npm test` checks the package boundaries, bundled assets,
physical-only product metadata and native backup configuration.
`tests/sgeul-browser.cjs` (from the repository root) exercises the actual bundled
Supabase SDK with synthetic HTTP fixtures, real EPUB rendering, paid-access denial,
ARC terms/save/offline reload with an expired online session, reconnect revocation,
physical variant filtering/live-price display and sign-out cleanup. Run against an
HTTP server rooted at `apps/sgeul/dist`, with `BASE_URL`, `CHROMIUM_PATH`,
`READING_TEST_DIR` (real EPUB fixture) and Playwright's `NODE_PATH` configured.
Browser tests model unavailable external network while allowing packaged localhost
assets. They do not replace real Android airplane-mode and device lifecycle tests.
