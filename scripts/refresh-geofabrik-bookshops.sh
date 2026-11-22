#!/usr/bin/env bash
set -Eeuo pipefail

mode="${1:-}"
case "$mode" in
  scotland)
    url="https://download.geofabrik.de/europe/united-kingdom/scotland-latest.osm.pbf"
    ;;
  uk)
    # UK extract includes Northern Ireland; Great Britain extract does not.
    url="https://download.geofabrik.de/europe/united-kingdom-latest.osm.pbf"
    ;;
  *)
    echo "::error::Expected scotland or uk" >&2
    exit 1
    ;;
esac

command -v osmium >/dev/null || { echo "::error::osmium-tool is required" >&2; exit 1; }
command -v curl >/dev/null || { echo "::error::curl is required" >&2; exit 1; }
tempdir="$(mktemp -d)"
trap 'rm -rf "$tempdir"' EXIT
pbf="$tempdir/extract.osm.pbf"
filtered="$tempdir/bookshops.osm.pbf"
geojson="$tempdir/bookshops.geojsonseq"

echo "Downloading Geofabrik ${mode} extract; it may be large."
# Geofabrik serves daily extracts. The limit protects runner storage from
# incorrect downloads and upstream responses; never cache raw PBF in git.
if ! curl --fail --location --retry 2 --retry-delay 15 \
    --connect-timeout 30 --max-time 2100 --max-filesize 3500000000 \
    --silent --show-error --output "$pbf" "$url"; then
  echo "::warning::Geofabrik download unavailable. Existing ${mode} cache preserved."
  exit 2
fi

# Corrupt or unsupported source files are rejected; never publish
# partially processed or empty bookshop datasets.
osmium fileinfo "$pbf" >/dev/null || {
  echo "::error::Geofabrik file is invalid; existing cache preserved" >&2
  exit 1
}

# Keep referenced nodes and relations so shop-way geometry is complete.
# Do not use -R (omit references); it would lose the shop polygon geometry.
osmium tags-filter "$pbf" nwr/shop=books -o "$filtered"
rm -f "$pbf"
# Explicit attributes are essential for stable node/way/relation OSM IDs.
osmium export --attributes=type,id --output-format=geojsonseq \
  "$filtered" -o "$geojson"
rm -f "$filtered"
node scripts/build-geofabrik-bookshops.mjs "$mode" "$geojson"
echo "Geofabrik ${mode} refresh completed safely."
