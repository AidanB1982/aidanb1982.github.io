# Blackwood website: upgrade priorities

Reviewed **7 November 2026** (Europe/London). This is a proposal, not an
implementation record. Evidence comes from the current repository and a local
Chromium preview at 390px and 1280px. Live analytics, external checkout, email
delivery and production Core Web Vitals were not measured.

## First pass: clear content and faster loading

| Priority | Finding                                                                                                                                                                                     | Recommended work                                                                                                                                                                                             |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| First    | `pages/about.html` is byte-for-byte identical to `pages/LimitedEditions.html`; the About link renders “Objects from the Archive”.                                                           | Restore a proper About Blackwood page using verified publisher information and the existing Aidan Blackwood, Miren Vale and Martin Hales profiles. Keep the actual Limited Editions page.                    |
| First    | Footer Resources, Refunds and Terms point to `pages/resources.html`, `pages/refund-policy.html` and `pages/terms-of-service.html`, which are absent from this checkout.                     | Restore the intended pages or point to the appropriate approved destinations. Verify the live destinations before treating source absence as a confirmed production HTTP error.                              |
| First    | Hero `forest.png` is approximately 11.3 MB; shared `stone.png` is 3.44 MB; `entity.png` is 1.35 MB while displayed much smaller.                                                            | Prepare suitably sized modern image variants, retaining source artwork. Measure the result on a mobile connection. File sizes establish an optimisation opportunity, not a measured live loading-time claim. |
| Next     | The full-height homepage opening puts its main headline below the first viewport in the preview; its main content has no direct Sgeul card. The shared Reading menu already links to Sgeul. | Keep the atmospheric identity, with clearer first-screen actions: Buy books, Read online with Sgeul, Join the Archivists. Review the opening's height and spacing on phones.                                 |
| Next     | The homepage mostly features Aidan and The Archive Files, while Miren and Martin already have real author pages.                                                                            | Add a compact author/collection spotlight linking to their existing profiles and books. Help readers distinguish fiction from Martin's practical guides.                                                     |

## Animation and visual polish

Fog, entity drift, fades and cover hover effects already exist. Refine these
before layering more effects onto the homepage.

- Restrict pointer-follow lighting to suitable desktop input and avoid scheduling
  work when it has no visible effect. The current shared lighting code runs a
  continuous animation-frame loop even when the pointer is stationary.
- Make JavaScript animation/timers respect reduced motion and page visibility.
  The existing CSS reduced-motion treatment is a useful foundation.
- Consider a short, on-demand sample/file-opening transition and restrained cover
  interactions. Keep navigation, text and controls immediately available.
- An author/featured-book spotlight can add variety; provide manual controls and
  a static reduced-motion presentation.
- Retain the original art direction while improving load weight and legibility.

The global quote helper requires nodes absent from the homepage; its presence in
`header.js` does not establish that those particular quote effects are active.
The separate Sgeul ghost quotes are already implemented in the reader/app.

## Reader journeys and discoverability

- Add a visible Sgeul homepage feature with the online reader and beta application
  routes. Reuse the existing reader and access checks.
- Clarify beta onboarding: application, acceptance, one confirmed Archivists
  account, correct Google Play opt-in and activation of accepted reading access.
- Complete attribution for the Holdfast review quote; its source span is empty.
  The Black Bothy already links to a real review. Use a verified source.
- Surface suitable published news/releases on the homepage and reuse that source
  in Sgeul later. Keep it distinct from private member/ARC dispatches.
- Improve link previews with canonical URLs, OpenGraph cover images and accurate
  book/author metadata. Martin Hales's page already demonstrates the pattern.
- Review sitemap/robots configuration; neither file is present in this checkout.
  This does not imply that search engines cannot currently index the website.

## Maintenance and verification

- Reserve space for images and the asynchronously inserted shared header; measure
  layout movement before claiming a production CLS failure.
- Consolidate duplicated CSS in the 9,882-line shared stylesheet during a scoped
  cleanup. Image weight is the more immediate payload opportunity.
- Update `tests/site-polish.cjs`'s old expectation that BP Reading is absent from
  the header. The owner approved its public Reading-menu entry on 7 November.
- The sampled homepage, Start Here, About, Publications and Discover pages fit
  the tested widths without horizontal overflow. Continue device/keyboard checks
  as changes are implemented; this was not an exhaustive accessibility audit.

Sources: [homepage](../index.html), [shared header](../js/header.js),
[header styles](../css/header.css), [shared styles](../css/styles.css),
[finishing layer](../css/site-polish.css), [footer](../footer.html),
[About page](../pages/about.html), [Limited Editions](../pages/LimitedEditions.html),
[Martin Hales](../pages/martin-hales.html), and
[Sgeul future work](sgeul-next-update.md).
