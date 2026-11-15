
"use strict";

/*
 * BLACKWOOD PUBLISHING
 * Bookshop Outreach — GitHub Pages edition
 *
 * Discovery:
 * - Loads cached OpenStreetMap bookshop data
 * - Searches by distance from a UK town or city
 * - Uses Nominatim for town coordinates
 *
 * Management:
 * - Browser-local saved directory
 * - Expandable bookshop cards
 * - Leaflet map markers
 * - Add/edit records
 * - Search and status filtering
 * - JSON export
 * - Manual email drafts
 *
 * No emails are sent automatically.
 * No bookshops are published automatically.
 */

const STORAGE_KEY =
  "blackwood-bookshop-outreach-v1";

const BOOKSHOP_DATA_URL =
  "/data/scotland-bookshops.json";

const NOMINATIM_URL =
  "https://nominatim.openstreetmap.org/search";

const MAX_RESULTS = 60;
const REQUEST_TIMEOUT_MS = 15000;

const STATUSES = {
  prospect: "Prospect",
  contacted: "Contacted",
  interested: "Interested",
  stockist: "Confirmed stockist",
  "opted-out": "Do not contact"
};

const $ = id => document.getElementById(id);

let shops = loadShops();
let discoveredShops = [];
let bookshopDataset = null;

let editingId = null;
let searching = false;
let lastSearchStarted = 0;

let map = null;
let savedMarkers = null;
let discoveredMarkers = null;

/* =========================================
   HELPERS
========================================= */

function element(tag, text, className) {
  const node = document.createElement(tag);

  if (text !== undefined) {
    node.textContent = text;
  }

  if (className) {
    node.className = className;
  }

  return node;
}

function feedback(id, message, type = "") {
  const node = $(id);

  if (!node) return;

  node.textContent = message;
  node.className = `feedback ${type}`.trim();
}

function normalise(value) {
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase("en-GB")
    .replace(/\s+/g, " ");
}

function validCoordinates(shop) {
  return (
    typeof shop.lat === "number" &&
    typeof shop.lng === "number" &&
    Number.isFinite(shop.lat) &&
    Number.isFinite(shop.lng) &&
    shop.lat >= -90 &&
    shop.lat <= 90 &&
    shop.lng >= -180 &&
    shop.lng <= 180
  );
}

function safeWebsite(value) {
  if (!value) return "";

  try {
    const raw = String(value).trim();

    const candidate = /^https?:\/\//i.test(raw)
      ? raw
      : `https://${raw}`;

    const url = new URL(candidate);

    return ["http:", "https:"].includes(
      url.protocol
    )
      ? url.href
      : "";
  } catch {
    return "";
  }
}

function makeButton(
  label,
  action,
  secondary = false
) {
  const button = element(
    "button",
    label,
    `btn small${secondary ? " secondary" : ""}`
  );

  button.type = "button";
  button.addEventListener("click", action);

  return button;
}

function newId() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return (
    Date.now().toString(36) +
    "-" +
    Math.random().toString(36).slice(2)
  );
}

/* =========================================
   LOCAL STORAGE
========================================= */

function loadShops() {
  try {
    const data = JSON.parse(
      localStorage.getItem(STORAGE_KEY) || "[]"
    );

    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error(
      "Unable to load bookshops:",
      error
    );

    return [];
  }
}

function saveShops(nextShops) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(nextShops)
    );

    shops = nextShops;

    return true;
  } catch (error) {
    console.error(
      "Unable to save bookshops:",
      error
    );

    feedback(
      "saveFeedback",
      "Unable to save. Please export a backup.",
      "error"
    );

    return false;
  }
}

function isDuplicate(
  candidate,
  excludeId = null
) {
  return shops.some(shop => {
    if (shop.id === excludeId) {
      return false;
    }

    if (
      candidate.osmId &&
      shop.osmId &&
      candidate.osmId === shop.osmId
    ) {
      return true;
    }

    return (
      normalise(shop.name) ===
        normalise(candidate.name) &&
      normalise(shop.town) ===
        normalise(candidate.town)
    );
  });
}

/* =========================================
   LEAFLET MAP
========================================= */

function initMap() {
  const mapElement = $("map");

  if (!mapElement) return;

  if (typeof L === "undefined") {
    mapElement.textContent =
      "Map unavailable. Check your internet connection.";

    return;
  }

  map = L.map("map", {
    zoomControl: true,
    scrollWheelZoom: false
  }).setView([56.4, -4.2], 6);

  L.tileLayer(
    "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
      maxZoom: 19,
      attribution:
        "&copy; OpenStreetMap contributors"
    }
  ).addTo(map);

  savedMarkers = L.featureGroup().addTo(map);
  discoveredMarkers = L.featureGroup().addTo(map);

  requestAnimationFrame(() => {
    map.invalidateSize({
      pan: false
    });
  });

  if ("ResizeObserver" in window) {
    const observer = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        map.invalidateSize({
          pan: false
        });
      });
    });

    observer.observe(mapElement);
  }

  window.addEventListener("resize", () => {
    map.invalidateSize({
      pan: false
    });
  });
}

function fitMap(preferDiscovered = false) {
  if (!map) return;

  const discovered =
    discoveredMarkers.getLayers();

  const layers =
    preferDiscovered && discovered.length
      ? discovered
      : [
          ...savedMarkers.getLayers(),
          ...discovered
        ];

  if (!layers.length) return;

  const bounds = L.featureGroup(layers)
    .getBounds()
    .pad(0.15);

  map.fitBounds(bounds, {
    maxZoom: 13
  });
}

/* =========================================
   SAVED DIRECTORY
========================================= */

function filteredShops() {
  const query = normalise(
    $("search").value
  );

  const status =
    $("statusFilter").value;

  return shops.filter(shop => {
    const searchable = normalise(
      `${shop.name} ${shop.town}`
    );

    return (
      searchable.includes(query) &&
      (!status || shop.status === status)
    );
  });
}

function renderSaved() {
  const list = $("shopList");
  const results = filteredShops();

  list.replaceChildren();

  if (savedMarkers) {
    savedMarkers.clearLayers();
  }

  if (!results.length) {
    list.append(
      element(
        "p",
        "No saved bookshops match your search.",
        "empty"
      )
    );

    return;
  }

  for (const shop of results) {
    const card = element(
      "article",
      undefined,
      "shop"
    );

    const details =
      document.createElement("details");

    details.className =
      "shop-details";

    const summary =
      document.createElement("summary");

    summary.className =
      "shop-summary";

    const name = element(
      "strong",
      shop.name
    );

    const town = element(
      "span",
      shop.town,
      "shop-town"
    );

    summary.append(name, town);

    const content = element(
      "div",
      undefined,
      "shop-expanded"
    );

    if (shop.notes) {
      const blurb = String(shop.notes)
        .replace(/\s+/g, " ")
        .trim();

      const shortBlurb =
        blurb.length > 240
          ? `${blurb.slice(0, 237).trimEnd()}…`
          : blurb;

      content.append(
        element(
          "p",
          shortBlurb,
          "shop-blurb"
        )
      );
    } else {
      content.append(
        element(
          "p",
          "More details to be added.",
          "shop-blurb"
        )
      );
    }

    content.append(
      element(
        "p",
        `Outreach: ${
          STATUSES[shop.status] || "Prospect"
        }`
      )
    );

    if (shop.email) {
      content.append(
        element(
          "p",
          `Email: ${shop.email}`
        )
      );
    }

    const actions = element(
      "div",
      undefined,
      "shop-actions"
    );

    actions.append(
      makeButton(
        "Edit details",
        () => editShop(shop.id),
        true
      )
    );

    const website = safeWebsite(
      shop.website
    );

    if (website) {
      actions.append(
        makeButton(
          "Website",
          () => window.open(
            website,
            "_blank",
            "noopener,noreferrer"
          ),
          true
        )
      );
    }

    if (
      shop.email &&
      shop.status !== "opted-out"
    ) {
      actions.append(
        makeButton(
          "Draft email",
          () => draftEmail(shop)
        )
      );
    }

    content.append(actions);
    details.append(summary, content);
    card.append(details);
    list.append(card);

    if (
      savedMarkers &&
      validCoordinates(shop)
    ) {
      const marker = L.circleMarker(
        [shop.lat, shop.lng],
        {
          radius: 8,
          color: "#f1d0a2",
          weight: 2,
          fillColor: "#b87333",
          fillOpacity: 0.95
        }
      );

      marker.bindPopup(
        element(
          "strong",
          `${shop.name} — ${shop.town}`
        )
      );

      savedMarkers.addLayer(marker);
    }
  }
}

/* =========================================
   DISCOVERY RESULTS
========================================= */

function renderDiscovered() {
  const container =
    $("discoveryResults");

  container.replaceChildren();

  if (discoveredMarkers) {
    discoveredMarkers.clearLayers();
  }

  for (const shop of discoveredShops) {
    const card = element(
      "article",
      undefined,
      "discovery-card"
    );

    card.append(
      element(
        "span",
        "OPENSTREETMAP RESULT · UNVERIFIED",
        "result-meta"
      ),
      element("h3", shop.name),
      element(
        "p",
        shop.address || shop.town
      )
    );

    if (shop.website) {
      card.append(
        element(
          "p",
          `Website: ${shop.website}`
        )
      );
    }

    if (shop.email) {
      card.append(
        element(
          "p",
          `Public email: ${shop.email}`
        )
      );
    }

    const actions = element(
      "div",
      undefined,
      "result-actions"
    );

    const duplicate = isDuplicate(shop);

    const addButton = makeButton(
      duplicate
        ? "Already saved"
        : "Add to directory",
      () => addDiscovered(shop)
    );

    addButton.disabled = duplicate;

    actions.append(addButton);

    const website = safeWebsite(
      shop.website
    );

    if (website) {
      actions.append(
        makeButton(
          "Visit website",
          () => window.open(
            website,
            "_blank",
            "noopener,noreferrer"
          ),
          true
        )
      );
    }

    actions.append(
      makeButton(
        "View on map",
        () => {
          if (!map) return;

          map.setView(
            [shop.lat, shop.lng],
            16
          );

          $("map").scrollIntoView({
            behavior: "smooth",
            block: "center"
          });
        },
        true
      )
    );

    card.append(actions);
    container.append(card);

    if (
      discoveredMarkers &&
      validCoordinates(shop)
    ) {
      const marker = L.circleMarker(
        [shop.lat, shop.lng],
        {
          radius: 7,
          color: "#d5f4f5",
          weight: 2,
          fillColor: "#4aabb0",
          fillOpacity: 0.9
        }
      );

      marker.bindPopup(
        element(
          "strong",
          shop.name
        )
      );

      discoveredMarkers.addLayer(marker);
    }
  }
}

function render() {
  renderSaved();
  renderDiscovered();
}

/* =========================================
   ADD AND EDIT BOOKSHOPS
========================================= */

function resetForm() {
  editingId = null;

  $("shopForm").reset();

  $("formHeading").textContent =
    "Add a bookshop";

  feedback(
    "saveFeedback",
    ""
  );
}

function editShop(id) {
  const shop = shops.find(
    item => item.id === id
  );

  if (!shop) return;

  editingId = id;

  $("name").value = shop.name;
  $("town").value = shop.town;
  $("email").value =
    shop.email || "";

  $("website").value =
    shop.website || "";

  $("lat").value =
    shop.lat ?? "";

  $("lng").value =
    shop.lng ?? "";

  $("status").value =
    shop.status || "prospect";

  $("notes").value =
    shop.notes || "";

  $("formHeading").textContent =
    "Edit bookshop";

  $("editor").scrollIntoView({
    behavior: "smooth"
  });
}

function addDiscovered(shop) {
  if (isDuplicate(shop)) {
    feedback(
      "finderFeedback",
      "This bookshop is already saved.",
      "error"
    );

    return;
  }

  const record = {
    id: newId(),
    osmId: shop.osmId,
    name: shop.name,
    town: shop.town,
    email: shop.email,
    website: shop.website,
    lat: shop.lat,
    lng: shop.lng,
    status: "prospect",
    notes: [
      "Discovered using OpenStreetMap.",
      `OSM reference: ${shop.osmId}`,
      `Address: ${
        shop.address || "Not supplied"
      }`,
      "Independent status and trading status unverified.",
      "Contact details and stocking policy require review."
    ].join("\n")
  };

  if (!saveShops([...shops, record])) {
    return;
  }

  render();

  feedback(
    "finderFeedback",
    `${shop.name} added as an unverified prospect.`,
    "success"
  );
}

function saveForm(event) {
  event.preventDefault();

  const latText =
    $("lat").value.trim();

  const lngText =
    $("lng").value.trim();

  if (
    (latText === "") !==
    (lngText === "")
  ) {
    feedback(
      "saveFeedback",
      "Enter both coordinates or leave both blank.",
      "error"
    );

    return;
  }

  const previous = editingId
    ? shops.find(
        shop => shop.id === editingId
      )
    : null;

  const record = {
    id: editingId || newId(),
    osmId: previous?.osmId || "",
    name: $("name").value.trim(),
    town: $("town").value.trim(),
    email: $("email").value.trim(),
    website: safeWebsite(
      $("website").value.trim()
    ),
    lat:
      latText === ""
        ? null
        : Number(latText),
    lng:
      lngText === ""
        ? null
        : Number(lngText),
    status: $("status").value,
    notes: $("notes").value.trim()
  };

  if (
    !record.name ||
    !record.town
  ) {
    feedback(
      "saveFeedback",
      "Please enter a bookshop name and town.",
      "error"
    );

    return;
  }

  if (
    latText !== "" &&
    !validCoordinates(record)
  ) {
    feedback(
      "saveFeedback",
      "Invalid map coordinates.",
      "error"
    );

    return;
  }

  if (
    isDuplicate(
      record,
      record.id
    )
  ) {
    feedback(
      "saveFeedback",
      "That bookshop is already saved.",
      "error"
    );

    return;
  }

  const nextShops = editingId
    ? shops.map(shop =>
        shop.id === editingId
          ? record
          : shop
      )
    : [
        ...shops,
        record
      ];

  if (!saveShops(nextShops)) {
    return;
  }

  resetForm();
  render();

  feedback(
    "saveFeedback",
    `${record.name} saved successfully.`,
    "success"
  );
}

/* =========================================
   MANUAL EMAIL DRAFTS
========================================= */

function draftEmail(shop) {
  if (
    !shop.email ||
    shop.status === "opted-out"
  ) {
    return;
  }

  const subject =
    "Blackwood Publishing — paperback stocking enquiry";

  const body = [
    "Hello,",
    "",
    "I'm getting in touch from Blackwood Publishing, an independent Scottish publishing imprint.",
    "",
    "We're introducing our paperback catalogue to independent bookshops and wondered whether you might consider selected titles.",
    "",
    "Our IngramSpark catalogue includes:",
    "Gualachulain Bothy: The Second Silence — 9781919555560",
    "Holdfast — 9781919555522",
    "Love, Abused — 9781919555539",
    "The Black Bothy — 9781919555584",
    "Corrour: The First Summoning — 9781919555508",
    "",
    "We can provide current ordering and trade information on request.",
    "",
    "Would you be happy for us to send over further details?",
    "",
    "Kind regards,",
    "Blackwood Publishing",
    "https://blackwoodpublishing.co.uk",
    "",
    "If you'd prefer not to receive further trade enquiries, please let us know."
  ].join("\n");

  window.location.href =
    `mailto:${encodeURIComponent(shop.email)}` +
    `?subject=${encodeURIComponent(subject)}` +
    `&body=${encodeURIComponent(body)}`;
}

/* =========================================
   NETWORK REQUESTS
========================================= */

async function fetchJSON(
  url,
  options = {}
) {
  const controller =
    new AbortController();

  const timer = setTimeout(() => {
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(
      url,
      {
        ...options,
        signal: controller.signal
      }
    );

    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status} while loading ${url}`
      );
    }

    return await response.json();

  } catch (error) {
    if (
      error.name === "AbortError"
    ) {
      throw new Error(
        "The request timed out."
      );
    }

    throw error;

  } finally {
    clearTimeout(timer);
  }
}

/* =========================================
   UK TOWN LOOKUP
========================================= */

async function geocodeTown(town) {
  const params =
    new URLSearchParams({
      q: `${town}, United Kingdom`,
      format: "jsonv2",
      limit: "5",
      addressdetails: "1"
    });

  const results = await fetchJSON(
    `${NOMINATIM_URL}?${params}`
  );

  if (
    !Array.isArray(results) ||
    !results.length
  ) {
    throw new Error(
      `No location found for "${town}".`
    );
  }

  const match = results.find(item =>
    item.address?.country_code === "gb" &&
    Number.isFinite(Number(item.lat)) &&
    Number.isFinite(Number(item.lon))
  );

  if (!match) {
    throw new Error(
      "Could not verify that location in the UK."
    );
  }

  return {
    lat: Number(match.lat),
    lng: Number(match.lon)
  };
}

/* =========================================
   GITHUB PAGES DATASET
========================================= */

async function loadBookshopDataset() {
  if (bookshopDataset) {
    return bookshopDataset;
  }

  const data = await fetchJSON(
    BOOKSHOP_DATA_URL,
    {
      cache: "no-cache"
    }
  );

  if (!Array.isArray(data.shops)) {
    throw new Error(
      "The bookshop dataset has an invalid format."
    );
  }

  bookshopDataset = data;

  return data;
}

function distanceMetres(
  lat1,
  lng1,
  lat2,
  lng2
) {
  const toRadians = degrees =>
    degrees * Math.PI / 180;

  const earthRadius = 6371000;

  const dLat =
    toRadians(lat2 - lat1);

  const dLng =
    toRadians(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
    Math.cos(toRadians(lat2)) *
    Math.sin(dLng / 2) ** 2;

  return (
    2 *
    earthRadius *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(
        Math.max(0, 1 - a)
      )
    )
  );
}

async function searchCachedBookshops(
  lat,
  lng,
  radius
) {
  const dataset =
    await loadBookshopDataset();

  return dataset.shops
    .filter(shop => {
      const shopLat =
        Number(shop.lat);

      const shopLng =
        Number(shop.lng);

      if (
        !Number.isFinite(shopLat) ||
        !Number.isFinite(shopLng)
      ) {
        return false;
      }

      return distanceMetres(
        lat,
        lng,
        shopLat,
        shopLng
      ) <= radius;
    })
    .map(shop => ({
      osmId: String(shop.osmId || ""),
      name: String(shop.name || ""),
      town: String(shop.town || ""),
      address: String(shop.address || ""),
      website: safeWebsite(
        shop.website
      ),
      email: String(shop.email || ""),
      lat: Number(shop.lat),
      lng: Number(shop.lng)
    }));
}

/* =========================================
   BOOKSHOP DISCOVERY
========================================= */

async function findBookshops(event) {
  event.preventDefault();

  if (searching) return;

  const town =
    $("finderTown").value.trim();

  const radius = Number(
    $("finderRadius").value
  );

  if (town.length < 2) {
    feedback(
      "finderFeedback",
      "Please enter a town or city.",
      "error"
    );

    return;
  }

  if (
    ![3000, 5000, 10000, 20000].includes(
      radius
    )
  ) {
    feedback(
      "finderFeedback",
      "Invalid search radius.",
      "error"
    );

    return;
  }

  const now = Date.now();

  if (
    now - lastSearchStarted < 1500
  ) {
    feedback(
      "finderFeedback",
      "Please wait before searching again.",
      "error"
    );

    return;
  }

  lastSearchStarted = now;
  searching = true;

  const button = $("findBtn");

  button.disabled = true;
  button.textContent = "Searching…";

  feedback(
    "finderFeedback",
    `Locating ${town}…`
  );

  try {
    const location =
      await geocodeTown(town);

    if (map) {
      map.setView(
        [
          location.lat,
          location.lng
        ],
        11
      );
    }

    feedback(
      "finderFeedback",
      `Searching the Blackwood bookshop dataset near ${town}…`
    );

    const results =
      await searchCachedBookshops(
        location.lat,
        location.lng,
        radius
      );

    const unique = new Map();

    for (const item of results) {
      if (
        !item.name ||
        !validCoordinates(item)
      ) {
        continue;
      }

      const shop = {
        ...item,
        town:
          item.town || town,
        address:
          item.address ||
          item.town ||
          town
      };

      const key =
        shop.osmId ||
        normalise(
          `${shop.name}|${shop.town}|${shop.address}`
        );

      if (!unique.has(key)) {
        unique.set(key, shop);
      }
    }

    discoveredShops = [
      ...unique.values()
    ]
      .sort((a, b) =>
        a.name.localeCompare(
          b.name,
          "en-GB"
        )
      )
      .slice(0, MAX_RESULTS);

    renderDiscovered();

    if (discoveredShops.length) {
      fitMap(true);

      feedback(
        "finderFeedback",
        `Found ${discoveredShops.length} mapped bookshop(s) near ${town}. Review before saving.`,
        "success"
      );
    } else {
      feedback(
        "finderFeedback",
        "No bookshops found in the cached dataset for this radius. Try a larger radius."
      );
    }

  } catch (error) {
    console.error(
      "Bookshop discovery error:",
      error
    );

    feedback(
      "finderFeedback",
      error.message,
      "error"
    );

  } finally {
    searching = false;

    button.disabled = false;
    button.textContent =
      "Find bookshops";
  }
}

/* =========================================
   JSON EXPORT
========================================= */

function exportJSON() {
  const blob = new Blob(
    [
      JSON.stringify(
        shops,
        null,
        2
      )
    ],
    {
      type: "application/json"
    }
  );

  const url =
    URL.createObjectURL(blob);

  const link =
    document.createElement("a");

  link.href = url;

  link.download =
    "blackwood-bookshop-outreach.json";

  document.body.append(link);
  link.click();
  link.remove();

  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}

/* =========================================
   EVENT LISTENERS
========================================= */

function initialise() {
  $("finderForm").addEventListener(
    "submit",
    findBookshops
  );

  $("shopForm").addEventListener(
    "submit",
    saveForm
  );

  $("clearResultsBtn").addEventListener(
    "click",
    () => {
      discoveredShops = [];
      renderDiscovered();

      feedback(
        "finderFeedback",
        "Search results cleared."
      );

      fitMap();
    }
  );

  $("search").addEventListener(
    "input",
    renderSaved
  );

  $("statusFilter").addEventListener(
    "change",
    renderSaved
  );

  $("resetBtn").addEventListener(
    "click",
    resetForm
  );

  $("exportBtn").addEventListener(
    "click",
    exportJSON
  );

  initMap();
  render();
}

if (
  document.readyState === "loading"
) {
  document.addEventListener(
    "DOMContentLoaded",
    initialise,
    { once: true }
  );
} else {
  initialise();
}
