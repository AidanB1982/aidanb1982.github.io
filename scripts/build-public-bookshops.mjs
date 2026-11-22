import fs from "node:fs/promises";
import path from "node:path";

// This is the ONLY producer of the public directory. Do not copy email,
// notes, contact history, outreach status or private administrator records.
const ROOT = path.resolve("data");
const SCOTLAND = path.join(ROOT, "scotland-bookshops.json");
const UK = path.join(ROOT, "uk-bookshops.json");
const CURATED = path.join(ROOT, "blackwood-bookshops.json");
const OUTPUT = path.join(ROOT, "public-bookshops.json");

const majorChains = /^(?:waterstones|waterstone s|wh smith|whsmith|the bookshop by whsmith|the works|blackwell s|blackwells|blackwell|t g jones|tg jones|foyles|oxfam)(?:\b|$)/;

function normalise(value) {
  return String(value || "").toLowerCase().normalize("NFKD")
    .replace(/[^a-z0-9]+/g, " ").trim();
}

function website(value) {
  if (typeof value !== "string" || !value.trim()) return "";
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function publicShop(shop, source) {
  const name = typeof shop.name === "string" ? shop.name.trim() : "";
  const lat = Number(shop.lat), lng = Number(shop.lng);
  if (!name || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < 49 || lat > 61.5 || lng < -9 || lng > 2.5) return null;
  if (majorChains.test(normalise(name))) return null;

  return {
    name,
    town: String(shop.town || "").trim(),
    address: String(shop.address || "").trim(),
    website: website(shop.website),
    lat,
    lng,
    source
  };
}

async function load(file) {
  const body = JSON.parse(await fs.readFile(file, "utf8"));
  if (!Array.isArray(body.shops)) throw new Error("Invalid bookshop source: " + file);
  return body;
}

function samePublicBookshop(existing, incoming) {
  // Keep branches at different addresses distinct even when they have
  // the same shop name and are located on the same high street.
  const latDifference = Math.abs(existing.lat - incoming.lat);
  const lngDifference = Math.abs(existing.lng - incoming.lng);
  if (latDifference >= 0.003 || lngDifference >= 0.005) return false;

  const existingAddress = normalise(existing.address);
  const incomingAddress = normalise(incoming.address);
  if (existingAddress && incomingAddress &&
      existingAddress !== incomingAddress) return false;

  const matchingWebsite = existing.website && incoming.website &&
    existing.website === incoming.website;
  const matchingAddress = existingAddress && incomingAddress &&
    existingAddress === incomingAddress;
  const practicallySameLocation =
    latDifference < 0.0005 && lngDifference < 0.0007;

  return Boolean(matchingWebsite || matchingAddress || practicallySameLocation);
}

function mergeSources(sources) {
  const shops = [];
  const byName = new Map();
  const byOsmId = new Map();
  const quality = {
    excludedMajorChains: 0,
    mergedDuplicates: 0,
    possibleDuplicatesForReview: 0,
    invalidRecords: 0
  };

  for (const {data, source} of sources) {
    for (const candidate of data.shops) {
      const name = normalise(candidate?.name);
      if (majorChains.test(name)) {
        quality.excludedMajorChains += 1;
        continue;
      }
      const shop = publicShop(candidate, source);
      if (!shop) {
        quality.invalidRecords += 1;
        continue;
      }

      const osmId = String(candidate.osmId || "").trim();
      const key = normalise(shop.name);
      const similarlyNamed = byName.get(key) || [];
      const matchingOsmId = osmId ? byOsmId.get(osmId) : null;
      const match = matchingOsmId ||
        similarlyNamed.find(previous => samePublicBookshop(previous, shop));

      if (match) {
        // Preserve curated priority, fill missing public fields only.
        if (!match.website && shop.website) match.website = shop.website;
        if (!match.town && shop.town) match.town = shop.town;
        if (!match.address && shop.address) match.address = shop.address;
        quality.mergedDuplicates += 1;
      } else {
        shops.push(shop);
        similarlyNamed.push(shop);
        byName.set(key, similarlyNamed);

        if (similarlyNamed.length > 1 &&
            similarlyNamed.some(previous => previous !== shop &&
              Math.abs(previous.lat - shop.lat) < 0.003 &&
              Math.abs(previous.lng - shop.lng) < 0.005)) {
          quality.possibleDuplicatesForReview += 1;
        }
      }
      if (osmId) byOsmId.set(osmId, match || shop);
    }
  }

  shops.sort((a, b) => a.name.localeCompare(b.name, "en-GB"));
  quality.withoutWebsite = shops.filter(shop => !shop.website).length;
  quality.withoutTown = shops.filter(shop => !shop.town).length;
  return {shops, quality};
}

async function main() {
  const [scotland, uk, curated] = await Promise.all([
    load(SCOTLAND), load(UK), load(CURATED)
  ]);
  const {shops, quality} = mergeSources([
    {data:curated, source:"curated"},
    {data:scotland, source:"openstreetmap"},
    {data:uk, source:"openstreetmap"}
  ]);

  // A failed or truncated source must not overwrite the existing public list.
  if (!shops.length) throw new Error("Empty public directory; previous version preserved.");
  let previous = null;
  try {
    previous = await load(OUTPUT);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  if (previous?.shops?.length >= 50 &&
      shops.length < previous.shops.length * 0.85 &&
      !(scotland.coverage?.complete && uk.coverage?.complete)) {
    throw new Error("Public directory shrank unexpectedly during incomplete coverage; previous version preserved.");
  }

  const ukCount = uk.shops.length;
  const countriesCovered = ukCount > 0
    ? "UK-wide discovery in progress; coverage varies by region"
    : "Scotland-focused, including some nearby border towns; not UK-wide";
  const output = {
    title: "Blackwood Independent Bookshop Finder — Public Discovery Data",
    scope: countriesCovered,
    source: "OpenStreetMap (Geofabrik extracts and historical Overpass caches) and Blackwood curated public listings",
    sourceGeneratedAt: [scotland.generatedAt, uk.generatedAt]
      .filter(Boolean).sort().at(-1) || null,
    coverageComplete: Boolean(scotland.coverage?.complete && uk.coverage?.complete),
    coverageFailedTiles:
      (scotland.coverage?.failedTiles || 0) + (uk.coverage?.failedTiles || 0),
    verification: "Bookshop listings are not independently verified as open, independent or stocking Blackwood titles.",
    ukCount,
    scotlandCount: scotland.shops.length,
    quality,
    count: shops.length,
    shops
  };

  await fs.mkdir(ROOT, {recursive:true});
  const temporary = OUTPUT + ".tmp";
  await fs.writeFile(temporary, JSON.stringify(output, null, 2) + "\n", "utf8");
  await fs.rename(temporary, OUTPUT);
  console.log("Public-safe discovery feed updated: " + shops.length + " listings; " +
    ukCount + " UK-cache candidates before filtering. Quality: " + JSON.stringify(quality));
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
