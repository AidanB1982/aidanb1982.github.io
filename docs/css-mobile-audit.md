# Shared CSS and mobile audit

**26 October 2026 · Blackwood Publishing**

This pass standardises the shared presentation layer and fixes measured tablet/phone
layout defects. No Supabase migration, secret or Edge Function deployment is needed.
The atmospheric public site, light Author Desk and chosen EPUB page colours retain
their individual themes.

## Findings and changes

| Finding | Change |
| --- | --- |
| Desktop navigation overflowed at 768px on 23 sampled routes | Compact navigation now covers widths through 1024px, with CSS and JavaScript using the same breakpoint |
| Recovered Files, Independent Works and Appearances overflowed at 320px | Hero containers can shrink; specialised headings use the shared fluid scale |
| Form text below 16px on tablet/phone | Native fields use at least 16px through 1024px, including newsletter, contact, account and store search controls |
| Small store/member/community actions | Primary controls have at least 44px touch height; footer links have more touch space |
| Old hover rules expanded button letter spacing | Shared button tracking stays stable; touch hover does not move cards/buttons |
| Stacked book buttons inherited a 160px vertical flex basis | Mobile book actions use their natural height and full available width |
| Standard 3D cover mockups looked tiny in portrait frames | Mark the known padded landscape mockups and fit them to their frame; ordinary flat artwork stays contained |
| Reveal animations could leave content hidden or delayed | Content is visible before JavaScript. Phone/tablet/touch/reduced-motion views do not wait for reveals. Optional desktop reveals trigger for tall sections and cap stagger delay at 120ms |
| Community Spotlight contained two nested HTML documents | Keep one complete page, one shared header/footer/embed and one working hashtag copy handler |
| Keyboard focus was suppressed by some older component rules | Consistent visible outlines, with a darker focus colour on the light Author Desk |
| Native reader settings were cramped on phones | Increase settings-control text and touch height without changing EPUB typography or page colours |

Shared assets and their page references were cache-versioned together. Typography,
controls, corner treatment and layout gutters use the existing finishing layer rather
than adding another stylesheet. Store SDK changes are confined to presentation options;
product IDs, prices, cart behaviour and checkout logic are unchanged.

## Measured layout results

24 public routes were inspected at four widths: **96 page/viewport combinations**.

| Width | Routes | Horizontal overflow before | After |
| --- | ---: | ---: | ---: |
| 1440px | 24 | 0 | 0 |
| 768px | 24 | 23 | 0 |
| 390px | 24 | 0 | 0 |
| 320px | 24 | 3 | 0 |

The sampled tablet/phone forms have no text fields/selects below 16px after the change.
The sampled primary buttons have no rendered touch heights below 43px (the configured
minimum is 44px; the audit allows a pixel for rounding). Inline prose links are not
expanded into button-sized boxes. No horizontal overflow was hidden to achieve these
results; the affected containers and navigation layouts were corrected.

The route sample covers home, catalogue, store, about, contact, reading routes, both
author pages, series/book pages, submissions, ARC recruitment, the signed-out members
page, privacy, appearances, community and limited editions. Private author/customer
records are covered separately with fixtures, not by accessing live accounts.

## Verification

- `tests/css-layout-audit.cjs`: repeatable 96-combination layout/font/touch diagnostic,
  with JSON output in AUDIT_OUTPUT (default `/tmp/blackwood-css-layout-audit.json`).
- `tests/site-polish.cjs`: 17 routes at five widths (1440, 1024, 768, 390, 320px),
  shared navigation/footer, mobile menus, field/control sizes, visible content and
  Community clipboard feedback. Additional touch checks use 390×844 portrait and
  844×390 landscape; content is also checked with the shared script blocked.
- `tests/site-motion.cjs`: a deliberately tall desktop section reveals when it enters
  the viewport, with brief transitions instead of accumulating seconds of delay.
- `tests/author-desk-browser.cjs`: existing private portal navigation and responsive
  read-only flows, including its Finance view and access denial (mock Supabase).
- `tests/publishing-desk-browser.cjs`: ARC/admin/calendar controls and mobile layout
  with mocked backend services.
- `tests/bp-reading.cjs`: real EPUB rendering, page turns/progress, saved settings,
  search/bookmarks, phone layout and recovery using a fixture EPUB and mock delivery.
- Manual screenshot review of mobile book cards and the contact form.
- JavaScript syntax and diff-whitespace checks; Shopify source comparison confirms
  changes are confined to the SDK presentation-options function.

Browser checks use local Chromium. They do not prove real Safari/iOS behaviour,
third-party widget rendering, payment processing or live Supabase permissions. External
services are blocked or mocked; no contact form, email, purchase or social post is sent.
The Shopify SDK's live iframe and checkout need their own controlled live check; the
host-page controls and its presentation configuration were checked here.

## Remaining performance work

1. **Optimise original image delivery.** Several backgrounds are roughly 11–22 MB.
   These CSS improvements do not reduce those bytes. Add visually verified modern-format
   responsive derivatives and retain originals; this pass does not alter the artwork.
2. **Consolidate legacy CSS carefully.** `styles.css` is approximately 9,900 lines. A
   simple selector/declaration scan found 123 repeated blocks. Context, media queries
   and source order matter, so blindly deleting duplicates could change the cascade.
3. **Test real devices and real networks.** Check Safari/iPhone and Android, keyboard
   opening, browser text scaling, portrait/landscape, larger accessibility text and
   actual loading speed. No Lighthouse score is claimed from these local checks.
4. **Continue contrast and third-party accessibility review.** Brand imagery, embedded
   services and intentionally muted editorial text need contextual checks; geometric
   layout tests alone are not a complete accessibility certification.

These follow-ups are also recorded in [the website to-do list](website-roadmap.md).
