
import fs from "node:fs/promises";
import path from "node:path";

const OUTPUT = path.resolve(
  "data/scotland-bookshops.json"
);

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
    [out:json][timeout:90];
    (
      node["shop"="books"](${bounds});
      way["shop"="books"](${bounds});
      relation["shop"="books"](${bounds});
    );
    out center;
  `;
}

async function requestEndpoint(endpoint, query) {
  const controller = new AbortController();

  const timer = setTimeout(
    () => controller.abort(),
    110000
  );

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type":
          "application/x-www-form-urlencoded;charset=UTF-8",
        "User-Agent":
          "BlackwoodPublishing-BookshopDirectory/1.0"
      },
      body: new URLSearchParams({
        data: query
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status}`
      );
    }

    const data = await response.json();

    if (!Array.isArray(data.elements)) {
      throw new Error(
        "Invalid Overpass response"
      );
    }

    return data.elements;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchRegion(region) {
  const query = makeQuery(region.bbox);

  for (const endpoint of ENDPOINTS) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        console.log(
          `${region.name}: ${endpoint}, attempt ${attempt}`
        );

        const elements = await requestEndpoint(
          endpoint,
          query
        );

        console.log(
          `${region.name}: received ${elements.length} elements`
        );

        return elements;
      } catch (error) {
        console.warn(
          `${region.name}: ${error.message}`
        );

        await pause(3000 * attempt);
      }
    }
  }

  throw new Error(
    `Unable to retrieve ${region.name}`
  );
}

async function main() {
  const unique = new Map();

  for (const region of REGIONS) {
    const elements = await fetchRegion(region);

    for (const item of elements) {
      const shop = parseShop(item);

      if (shop) {
        unique.set(shop.osmId, shop);
      }
    }

    await pause(5000);
  }

  const shops = [...unique.values()]
    .sort((a, b) =>
      a.name.localeCompare(
        b.name,
        "en-GB"
      )
    );

  if (shops.length === 0) {
    throw new Error(
      "No bookshops returned. Existing data preserved."
    );
  }

  const output = {
    source: "OpenStreetMap / Overpass",
    region: "Scotland",
    generatedAt: new Date().toISOString(),
    count: shops.length,
    shops
  };

  await fs.mkdir(
    path.dirname(OUTPUT),
    { recursive: true }
  );

  await fs.writeFile(
    OUTPUT,
    JSON.stringify(output, null, 2) + "\n",
    "utf8"
  );

  console.log(
    `Saved ${shops.length} Scottish bookshops.`
  );
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
