
import fs from "node:fs/promises";
import path from "node:path";

const OUTPUT = path.resolve("data/uk-bookshops.json");

const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter"
];

const REGIONS = [
  {
    "name": "North West England",
    "bbox": [
      53.4,
      -3.5,
      55.8,
      -1.9
    ]
  },
  {
    "name": "North East England",
    "bbox": [
      53.4,
      -2.2,
      55.85,
      -0.45
    ]
  },
  {
    "name": "Yorkshire and Humber",
    "bbox": [
      53.1,
      -2.85,
      54.65,
      0.35
    ]
  },
  {
    "name": "West Midlands",
    "bbox": [
      51.95,
      -3.35,
      53.4,
      -1.05
    ]
  },
  {
    "name": "East Midlands",
    "bbox": [
      52.1,
      -2.05,
      53.7,
      0.1
    ]
  },
  {
    "name": "East of England",
    "bbox": [
      51.7,
      -0.75,
      53.25,
      1.9
    ]
  },
  {
    "name": "Greater London",
    "bbox": [
      51.25,
      -0.55,
      51.75,
      0.35
    ]
  },
  {
    "name": "South East England",
    "bbox": [
      50.55,
      -1.95,
      52.15,
      1.85
    ]
  },
  {
    "name": "South West England",
    "bbox": [
      49.8,
      -6.55,
      52.25,
      -1.4
    ]
  },
  {
    "name": "North Wales",
    "bbox": [
      52.2,
      -5.75,
      53.5,
      -2.4
    ]
  },
  {
    "name": "South Wales",
    "bbox": [
      51.2,
      -5.75,
      52.55,
      -2.35
    ]
  },
  {
    "name": "Northern Ireland",
    "bbox": [
      54,
      -8.35,
      55.45,
      -5.3
    ]
  }
];

const REQUEST_TIMEOUT_MS = 25000;
const MAX_ATTEMPTS_PER_ENDPOINT = 1;
const PAUSE_BETWEEN_REQUESTS_MS = 1750;
const MAX_CONSECUTIVE_TILE_FAILURES = 6;

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
          "BlackwoodPublishing-UKBookshops/1.0"
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
        region: "England, Wales and Northern Ireland",
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
  // Only trust an apparently complete response. Do not let a sudden
  // anomalous empty/thin response destroy previously discovered shops.
  const existing = [...unique.values()]
    .filter(shop => insideBounds(shop, bbox));
  const parsed = elements.map(parseShop).filter(Boolean);

  if (existing.length > 0 && parsed.length === 0) {
    throw new Error("Suspicious empty tile; existing bookshops retained.");
  }
  if (existing.length >= 5 && parsed.length < existing.length * 0.2) {
    throw new Error("Suspiciously reduced tile; existing bookshops retained.");
  }

  for (const [id, shop] of unique) {
    if (insideBounds(shop, bbox)) unique.delete(id);
  }
  for (const shop of parsed) unique.set(shop.osmId, shop);
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
  let consecutiveFailures = 0;

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
      consecutiveFailures = 0;
    } catch (error) {
      console.warn(
        `Preserving existing records for ${tile.name}: ${error.message}`
      );

      failed.push(tile.name);
      consecutiveFailures += 1;
    }

    if (consecutiveFailures >= MAX_CONSECUTIVE_TILE_FAILURES) {
      console.warn("Overpass unavailable for multiple consecutive tiles; stopping early.");
      failed.push(...tiles.slice(index + 1).map(entry => entry.name + " (not queried)"));
      break;
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
    region: "England, Wales and Northern Ireland",
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
    `Saved ${shops.length} England/Wales/Northern Ireland discovery records.`
  );

  if (failed.length > 0) {
    console.warn(
      "Dataset is partially refreshed. Failed areas retain existing records."
    );
  }
}

main().catch(error => {
  console.error(error);
  if (error?.message ===
      "Every Overpass request failed. Existing dataset preserved.") {
    // Dedicated outage code: scheduler can report a visible warning,
    // retain the cached dataset and still regenerate the public feed.
    process.exitCode = 2;
  } else {
    // Any other error (invalid data, filesystem, programming) is fatal.
    process.exitCode = 1;
  }
});
