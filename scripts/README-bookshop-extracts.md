# Blackwood bookshop discovery: Geofabrik snapshots

The public bookshop finder is a **candidate discovery directory**, not a list of verified operating independent shops or Blackwood stockists. Its published JSON never contains outreach status, emails, private notes, or customer information.

## Sources and coverage

- **Scottish cache:** `https://download.geofabrik.de/europe/united-kingdom/scotland-latest.osm.pbf`
- **UK cache:** `https://download.geofabrik.de/europe/united-kingdom-latest.osm.pbf` (includes England, Scotland, Wales and Northern Ireland)
- Both sources are OpenStreetMap data distributed by Geofabrik. See the site’s OpenStreetMap contributor attribution and ODbL information.
- The UK extract also contains Scottish bookshops. Existing OSM IDs and conservative name-and-location matching remove repeats from the public feed.
- An extract is a snapshot of **mapped** places; it is not proof a bookshop is independent, open, correctly classified or stocking Blackwood titles.

## GitHub Actions

`.github/workflows/bookshop-discovery.yml` is the **only** scheduler and data writer.

- Sunday 05:23 UTC: Scotland snapshot
- Wednesday 04:11 UTC: complete UK snapshot (includes Northern Ireland)
- Manual `Run workflow`: choose `scotland`, `rest_uk` or `both`. `rest_uk` means the full UK extract is processed to populate the UK cache, alongside the separately maintained Scottish cache.
- No workflow is started automatically by changing code or merging a PR.

The workflow installs `osmium-tool` on the runner, downloads the snapshot to temporary storage, and runs `osmium tags-filter` and `osmium export --attributes=type,id --output-format=geojsonseq`. The raw (multi-GB) files are removed and **never committed**.

### Safeguards

- Download failures return code 2, annotate a GitHub Actions warning and keep the previous cache. Other processing errors fail the job.
- The builder rejects empty, obviously truncated and dramatically reduced exports instead of erasing existing records.
- Public-safe generation merges cached and curated data and strips any emails. Its separate validation step asserts the exact permitted JSON fields.
- The final push refuses to overwrite newer commits on `main`; no force-pushes.
- The workflow may run for a while because the full UK OSM file is approximately 2 GB. GitHub runner storage, available download bandwidth and Geofabrik uptime still matter.
- Successful GitHub Actions completion **does not guarantee** a newly populated UK cache: check the workflow warning messages and `data/uk-bookshops.json` `count`/`generatedAt` fields.
- Existing private outreach data remains separate and is never modified by this workflow.

## Testing

`bookshop-extract-checks.yml` runs offline integration tests on pull requests using a small OSM XML fixture that includes a node, a polygon shop and a non-bookshop. The real nationwide download is **not** part of the PR test suite.

To run locally on Linux with Node.js 22 and `osmium-tool`:

```sh
node --test scripts/test-geofabrik-bookshops.mjs scripts/test-bookshop-pipeline.mjs
```

Do not run the live refresh locally without copying the `data/*.json` caches to a safe backup location first.
