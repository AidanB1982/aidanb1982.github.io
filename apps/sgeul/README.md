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
platform 36/build-tools 35.0.0, and Android Studio or equivalent command-line tools.

```sh
cd apps/sgeul
npm ci
npm run icons        # regenerate launcher/splash assets from the approved square artwork
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

- The approved `assets/Sgeul Icon Square.png` now supplies launcher/adaptive icons,
  branded splash assets and the welcome-screen mark. `npm run icons` regenerates
  native sizes using Capacitor Assets; the source artwork is retained unchanged.
- Verify adaptive masks on real phones. A separate transparent foreground/monochrome
  export can refine themed-icon support before the store release.
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
`tests/sgeul-login-loading.cjs` uses the same bundled app and synthetic HTTP
fixtures to check delayed sign-in, failures, focus restoration, reduced motion,
responsive layouts and dismissal of slow loading screens without duplicate auth.
`tests/members-loading-browser.cjs` checks the website's matching login and recovery
flows against a local repository-root server with a mocked Auth client.
`tests/reading-swipes.cjs` checks real Chromium touch input against an EPUB;
`tests/reading-turns.cjs` retains page-curl, queue and pagination regression checks.
`tests/reading-atmosphere.cjs` checks quote provenance, rotation and accessibility
behaviour. The catalogue and ARC browser tests include the collapsed shelves.
Browser tests model unavailable external network while allowing packaged localhost
assets. They do not replace real Android airplane-mode and device lifecycle tests.

## Prototype update 0.1.1

Android connection status now comes from Capacitor Network, including an initial
check before auth/library startup and a fresh check when the app resumes. The local
WebView's `navigator.onLine` is not authoritative for native reading. Native events
feed the same reader expiry/revocation and offline handling; browser previews retain
the browser's network signal. A home-screen **Saved on this device** list links each
valid copy to its Library or ARC room, without mixing their access or storage keys.
Install this update over 0.1.0 using the same package ID and debug signing key: do not
uninstall or clear storage when testing an existing saved copy. No Supabase changes
are required for this client-side update. Verify real-phone airplane mode after
restart and after switching the radios while the app is running.

## First Google Play internal bundle · 0.1.2 (version code 3)

The Android target/compile SDK is now 36, using Android Gradle Plugin 8.9.2.
The first Play upload is a release-signed `.aab`, not the debug APK. Run
`npm run android:bundle` with the four upload-signing environment variables in
[the signing guide](signing/README.md). The build fails rather than silently
creating an unsigned release. The public upload certificate is committed; the
private upload key and its backup remain outside the public repository.

Upload `Sgeul-0.1.2-internal.aab` to the internal testing release, name it
`0.1.2 — First internal test`, and use `downloads/Sgeul-0.1.2-release-notes.txt`
for the en-GB release notes. Use Google Play App Signing for distribution.
The store listing, data disclosures, account deletion and required closed test
remain separate launch work. Do not treat a successful internal upload as approval
for production. The owner completes the Play Console preview/confirm step.

## Play automatic-protection compatibility · 0.1.3 (version code 4)

The first 0.1.2 upload was rejected because Play automatic protection requires
minimum API 24. The replacement 0.1.3 bundle raises minSdkVersion to 24, keeps
target/compile API 36 and uses the same upload key. Upload the replacement before
reviewing empty-release/upgrade errors. Sgeul has no advertising integration and
does not request `com.google.android.gms.permission.AD_ID`; answer No to the
advertising ID declaration for this build. This does not replace the separate
Data safety and privacy declarations.

## Animated sign-in screen · 0.1.4 (version code 5)

A branded loading screen now accompanies sign-in and reading-room preparation.
Its animation follows the device's reduced-motion preference. The loader does not
change authentication, library entitlements, ARC grants or offline-copy deadlines.

Upload `downloads/Sgeul-0.1.4-internal.aab` as a new release on the chosen Play testing
track, with `downloads/Sgeul-0.1.4-release-notes.txt` for en-GB. It uses the existing
upload key, package ID, minimum API 24 and target/compile API 36. An AAB upload does
not publish a release automatically; finish the Console review/publishing steps.
Existing website and server-side changes do not update an installed native app:
testers receive this screen after installing the updated Play build.

## Reader and atmosphere update · 0.2.0 (version code 6)

This larger beta update adds page-turn swipes, expandable series groups, a cleaner
reading-room interface, atmospheric backgrounds and quotations, and Blackwood
Publishing social links. The existing animated sign-in screen is retained.

Upload `downloads/Sgeul-0.2.0-internal.aab` to the chosen Play testing track and use
`downloads/Sgeul-0.2.0-release-notes.txt` for en-GB. It keeps the same package ID and
upload key, minimum API 24 and target/compile API 36. Complete the Console release
review and publishing steps; preparing or uploading the bundle does not publish it.

On a real phone, check forward/back swipes inside a book, text selection and reader
controls, expanding a series and opening a title, and reopening saved books in
airplane mode. Check reduced-motion presentation and social links opening in the
external browser. Account entitlements and existing offline-copy deadlines remain
server-controlled.
