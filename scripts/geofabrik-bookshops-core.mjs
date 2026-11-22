/*
 * Pure parsing and validation for Geofabrik -> osmium GeoJSONSeq results.
 * This module never reads the private outreach system or writes public feeds.
 */

function tag(properties, keys) {
  for (const key of keys) {
    const value = properties?.[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function safeWebsite(value) {
  if (!value) return "";
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : "https://" + value);
    return ["https:", "http:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function boundsOfCoordinates(geometry) {
  let minLat = Infinity, maxLat = -Infinity;
  let minLng = Infinity, maxLng = -Infinity;
  let points = 0;
  function traverse(value) {
    if (!Array.isArray(value)) return;
    if (value.length >= 2 && typeof value[0] === "number" &&
        typeof value[1] === "number") {
      minLng = Math.min(minLng, value[0]);
      maxLng = Math.max(maxLng, value[0]);
      minLat = Math.min(minLat, value[1]);
      maxLat = Math.max(maxLat, value[1]);
      points += 1;
      return;
    }
    value.forEach(traverse);
  }
  if (!geometry || !Array.isArray(geometry.coordinates)) return null;
  traverse(geometry.coordinates);
  if (!points) return null;
  const lat = (minLat + maxLat) / 2;
  const lng = (minLng + maxLng) / 2;
  if (!Number.isFinite(lat) || !Number.isFinite(lng) ||
      lat < 49 || lat > 61.5 || lng < -9 || lng > 2.5) return null;
  return {lat, lng};
}

export function featureToShop(feature, includeEmail = false) {
  const props = feature?.properties || {};
  if (props.shop !== "books" ||
      props.disused === "yes" || props.abandoned === "yes" ||
      props["disused:shop"] || props["abandoned:shop"]) return null;

  const name = tag(props, ["name", "name:en"]);
  const type = String(props["@type"] || "");
  const id = String(props["@id"] ?? "");
  if (!name || !["node", "way", "relation"].includes(type) ||
      !/^\d+$/.test(id)) return null;

  const location = boundsOfCoordinates(feature.geometry);
  if (!location) return null;

  const town = tag(props, ["addr:city", "addr:town", "addr:village", "addr:hamlet"]);
  const street = [
    tag(props, ["addr:housenumber"]),
    tag(props, ["addr:street"])
  ].filter(Boolean).join(" ");

  const result = {
    osmId: type + "/" + id,
    name,
    town,
    address: [street, town].filter(Boolean).join(", "),
    website: safeWebsite(tag(props, [
      "website", "contact:website", "website:official", "url"
    ])),
    lat: location.lat,
    lng: location.lng
  };

  if (includeEmail) {
    const email = tag(props, ["email", "contact:email"]);
    result.email = /^[^\s@;,]+@[^\s@;,]+\.[^\s@;,]+$/.test(email) ? email : "";
  }
  return result;
}

export function buildExtractDataset({
  features, previous = {shops:[]}, mode, sourceUrl,
  generatedAt = new Date().toISOString(), minimumCount = 20
}) {
  if (!["scotland", "uk"].includes(mode)) throw new Error("Unknown extract mode");
  if (!Array.isArray(previous.shops)) throw new Error("Invalid previous cache");
  const unique = new Map();
  const oldById = new Map(previous.shops.map(shop => [shop.osmId, shop]));
  let parsedFeatures = 0;

  for (const feature of features) {
    const shop = featureToShop(feature, mode === "scotland");
    if (!shop) continue;
    parsedFeatures += 1;
    const old = oldById.get(shop.osmId);
    if (old) {
      if (!shop.website && typeof old.website === "string") shop.website = old.website;
      if (!shop.town && typeof old.town === "string") shop.town = old.town;
      if (!shop.address && typeof old.address === "string") shop.address = old.address;
      if (mode === "scotland" && !shop.email &&
          typeof old.email === "string") shop.email = old.email;
    }
    const existing = unique.get(shop.osmId);
    if (!existing || (!existing.website && shop.website)) {
      unique.set(shop.osmId, shop);
    }
  }

  const shops = [...unique.values()].sort((a, b) =>
    a.name.localeCompare(b.name, "en-GB") ||
    a.osmId.localeCompare(b.osmId)
  );
  if (shops.length < minimumCount) {
    throw new Error("Geofabrik extract produced only " + shops.length +
      " bookshops; previous dataset retained.");
  }
  if (previous.shops.length >= 50 &&
      shops.length < previous.shops.length * 0.68) {
    throw new Error("Geofabrik extract unexpectedly shrank to " +
      shops.length + " from " + previous.shops.length +
      "; previous dataset retained.");
  }
  return {
    source: "OpenStreetMap / Geofabrik",
    region: mode === "scotland" ? "Scotland" : "United Kingdom",
    generatedAt,
    count: shops.length,
    coverage: {
      totalTiles: 1,
      successfulTiles: 1,
      failedTiles: 0,
      complete: true,
      method: "geofabrik-pbf",
      succeeded: ["Geofabrik " + mode + " extract"],
      failed: []
    },
    provenance: {
      extractUrl: sourceUrl,
      method: "osmium tags-filter + GeoJSONSeq",
      note: "OSM bookshops are candidate listings, not independently verified stockists."
    },
    parsedFeatures,
    shops
  };
}
