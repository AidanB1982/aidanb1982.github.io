
import fs from "node:fs/promises";
import path from "node:path";

const OUTPUT = path.resolve("data/scotland-bookshops.json");

const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter"
];

const REGIONS = [
  {
    name: "Southern Scotland",
    bbox: [54.55, -5.25, 55.75, -1.7]
  },
  {
    name: "Central Scotland",
    bbox: [55.65, -5.8, 56.8, -2.1]
  },
  {
    name: "Northern Scotland",
    bbox: [56.7, -6.5, 58.15, -1.7]
  },
  {
    name: "Highlands and Islands",
    bbox: [57.7, -8.7, 60.9, -0.7]
  }
];

const REQUEST_TIMEOUT_MS = 45000;
const MAX_ATTEMPTS_PER_ENDPOINT = 2;
const PAUSE_BETWEEN_REQUESTS_MS = 2500;

const pause = ms =>
  new Promise(resolve => setTimeout(resolve, ms));

function getTag(tags, keys) {
  for (const key of keys) {
    const value = tags[key];

    if (
      typeof value === "string" &&
      value.trim()
    ) {
      return value.trim();
    }
  }

  return "";
}

function safeWebsite(value) {
  if (!value) return "";

  try {
    const candidate = /^https?:\/\//i.test(value)
      ? value
      : `https://${value}`;

    const url = new URL(candidate);

    return ["https:", "http:"].includes(url.protocol)
      ? url.href
      : "";
  } catch {
    return "";
  }
}

function parseShop(item) {
  const tags = item.tags || {};

  if (tags.shop !== "books") return null;

  if (
    tags.disused === "yes" ||
    tags.abandoned === "yes" ||
    tags["disused:shop"] ||
    tags["abandoned:shop"]
  ) {
    return null;
  }

  const name = getTag(tags, [
    "name",
    "name:en"
  ]);

  if (!name) return null;

  const lat = Number(
    item.lat ?? item.center?.lat
  );

  const lng = Number(
    item.lon ?? item.center?.lon
  );

  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return null;
  }

  const town = getTag(tags, [
    "addr:city",
    "addr:town",
    "addr:village",
    "addr:hamlet"
  ]);

  const street = [
    getTag(tags, ["addr:housenumber"]),
    getTag(tags, ["addr:street"])
  ].filter(Boolean).join(" ");

  const email = getTag(tags, [
    "email",
    "contact:email"
  ]);

  return {
    osmId: `${item.type}/${item.id}`,
    name,
    town,
    address: [street, town]
      .filter(Boolean)
      .join(", "),
    website: safeWebsite(
      getTag(tags, [
        "website",
        "contact:website",
        "website:official",
        "url"
      ])
    ),
    email:
      /^[^\s@;,]+@[^\s@;,]+\.[^\s@;,]+$/.test(email)
        ? email
        : "",
    lat,
    lng
  };
}

function makeQuery(bbox) {
  const bounds = bbox.join(",");

  return `
    [out:json][timeout:35];
    (
      node["shop"="books"](${bounds});
      way["shop"="books"](${bounds});
      relation["shop"="books"](${bounds});
    );
    out center;
  `;
}

function splitRegion(region) {
  const [south, west, north, east] = region.bbox;

  const middleLat = (south + north) / 2;
  const middleLng = (west + east) / 2;

  return [
    {
      name: `${region.name} — southwest`,
      bbox: [south, west, middleLat, middleLng]
    },
    {
      name: `${region.name} — southeast`,
      bbox: [south, middleLng, middleLat, east]
    },
    {
      name: `${region.name} — northwest`,
      bbox: [middleLat, west, north, middleLng]
    },
    {
      name: `${region.name} — northeast`,
      bbox: [middleLat, middleLng, north, east]
    }
  ];
}

async function requestEndpoint(endpoint, query) {
  const controller = new AbortController();

  const timer = setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT_MS
  );

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type":
          "application/x-www-form-urlencoded;charset=UTF-8",
        "User-Agent":
          "BlackwoodPublishing-BookshopDirectory/2.0"
      },
      body: new URLSearchParams({
        data: query
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    if (!Array.isArray(data.elements)) {
      throw new Error("Invalid Overpass response");
    }

    return data.elements;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchTile(tile) {
  const query = makeQuery(tile.bbox);

  for (const endpoint of ENDPOINTS) {
    for (
      let attempt = 1;
      attempt <= MAX_ATTEMPTS_PER_ENDPOINT;
      attempt++
    ) {
      try {
        console.log(
          `${tile.name}: ${endpoint}, attempt ${attempt}`
        );

        const elements = await requestEndpoint(
          endpoint,
          query
        );

        console.log(
          `${tile.name}: received ${elements.length} elements`
        );

        return elements;
      } catch (error) {
        console.warn(
          `${tile.name}: ${error.message}`
        );

        await pause(1500 * attempt);
      }
    }
  }

  throw new Error(
    `Unable to retrieve ${tile.name}`
  );
}

async function loadExistingData() {
  try {
    const content = await fs.readFile(
      OUTPUT,
      "utf8"
    );

    const data = JSON.parse(content);

    if (!Array.isArray(data.shops)) {
      throw new Error("Existing shops array is invalid");
    }

    return data;
  } catch (error) {
    if (error.code === "ENOENT") {
      return {
        source: "OpenStreetMap / Overpass",
        region: "Scotland",
        generatedAt: null,
        count: 0,
        shops: []
      };
    }

    throw error;
  }
}

function validExistingShop(shop) {
  return (
    shop &&
    typeof shop.osmId === "string" &&
    shop.osmId.length > 0 &&
    typeof shop.name === "string" &&
    shop.name.length > 0 &&
    Number.isFinite(Number(shop.lat)) &&
    Number.isFinite(Number(shop.lng))
  );
}

function insideBounds(shop, bbox) {
  const lat = Number(shop.lat);
  const lng = Number(shop.lng);

  return (
    lat >= bbox[0] &&
    lat <= bbox[2] &&
    lng >= bbox[1] &&
    lng <= bbox[3]
  );
}

function mergeSuccessfulTile(unique, bbox, elements) {
  // A successful tile is authoritative for its area.
  // Remove stale records there, but retain all records
  // outside it, including areas whose requests failed.
  for (const [id, shop] of unique) {
    if (insideBounds(shop, bbox)) {
      unique.delete(id);
    }
  }

  for (const item of elements) {
    const shop = parseShop(item);

    if (shop) {
      unique.set(shop.osmId, shop);
    }
  }
}

async function main() {
  const previous = await loadExistingData();
  const unique = new Map();

  for (const shop of previous.shops) {
    if (validExistingShop(shop)) {
      unique.set(shop.osmId, shop);
    }
  }

  console.log(
    `Loaded ${unique.size} existing bookshops.`
  );

  const tiles = REGIONS.flatMap(splitRegion);
  const succeeded = [];
  const failed = [];

  for (let index = 0; index < tiles.length; index++) {
    const tile = tiles[index];

    console.log(
      `\nTile ${index + 1}/${tiles.length}: ${tile.name}`
    );

    try {
      const elements = await fetchTile(tile);

      mergeSuccessfulTile(
        unique,
        tile.bbox,
        elements
      );

      succeeded.push(tile.name);
    } catch (error) {
      console.warn(
        `Preserving existing records for ${tile.name}: ${error.message}`
      );

      failed.push(tile.name);
    }

    if (index < tiles.length - 1) {
      await pause(PAUSE_BETWEEN_REQUESTS_MS);
    }
  }

  console.log(
    `Successful tiles: ${succeeded.length}/${tiles.length}`
  );

  console.log(
    `Failed tiles: ${failed.length}/${tiles.length}`
  );

  if (succeeded.length === 0) {
    throw new Error(
      "Every Overpass request failed. Existing dataset preserved."
    );
  }

  const shops = [...unique.values()].sort(
    (a, b) =>
      a.name.localeCompare(b.name, "en-GB") ||
      a.osmId.localeCompare(b.osmId)
  );

  if (shops.length === 0) {
    throw new Error(
      "No bookshops available. Existing dataset preserved."
    );
  }

  const output = {
    source: "OpenStreetMap / Overpass",
    region: "Scotland",
    generatedAt: new Date().toISOString(),
    count: shops.length,
    coverage: {
      totalTiles: tiles.length,
      successfulTiles: succeeded.length,
      failedTiles: failed.length,
      complete: failed.length === 0,
      succeeded,
      failed
    },
    shops
  };

  await fs.mkdir(
    path.dirname(OUTPUT),
    { recursive: true }
  );

  const temporaryOutput = `${OUTPUT}.tmp`;

  await fs.writeFile(
    temporaryOutput,
    JSON.stringify(output, null, 2) + "\n",
    "utf8"
  );

  await fs.rename(
    temporaryOutput,
    OUTPUT
  );

  console.log(
    `Saved ${shops.length} Scottish bookshops.`
  );

  if (failed.length > 0) {
    console.warn(
      "Dataset is partially refreshed. Failed areas retain existing records."
    );
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
