
"use strict";

const STORAGE_KEY = "blackwood-bookshop-outreach-v1";

const STATUSES = {
  prospect: "Prospect",
  contacted: "Contacted",
  interested: "Interested",
  stockist: "Confirmed stockist",
  "opted-out": "Do not contact"
};

const NOMINATIM_URL =
  "https://nominatim.openstreetmap.org/search";

const OVERPASS_ENDPOINTS = [
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass-api.de/api/interpreter"
];

const MAX_RESULTS = 60;
const REQUEST_TIMEOUT_MS = 25000;

const $ = id => document.getElementById(id);

let shops = loadShops();
let discoveredShops = [];
let editingId = null;
let searching = false;
let lastSearchStarted = 0;

let map = null;
let savedMarkers = null;
let discoveredMarkers = null;

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
  node.textContent = message;
  node.className = `feedback ${type}`.trim();
}

function loadShops() {
  try {
    const data = JSON.parse(
      localStorage.getItem(STORAGE_KEY) || "[]"
    );

    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error("Unable to load bookshops:", error);
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
    console.error("Unable to save bookshops:", error);

    feedback(
      "saveFeedback",
      "Unable to save. Please export a backup.",
      "error"
    );

    return false;
  }
}

function normalise(value) {
  return String(value || "")
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
    const url = new URL(value);

    return ["http:", "https:"].includes(url.protocol)
      ? url.href
      : "";
  } catch {
    return "";
  }
}

function isDuplicate(candidate, excludeId = null) {
  return shops.some(shop => {
    if (shop.id === excludeId) return false;

    if (
      candidate.osmId &&
      shop.osmId &&
      candidate.osmId === shop.osmId
    ) {
      return true;
    }

    return (
      normalise(shop.name) === normalise(candidate.name) &&
      normalise(shop.town) === normalise(candidate.town)
    );
  });
}

function makeButton(label, action, secondary = false) {
  const button = element(
    "button",
    label,
    `btn small${secondary ? " secondary" : ""}`
  );

  button.type = "button";
  button.addEventListener("click", action);

  return button;
}

function initMap() {
  if (typeof L === "undefined") {
    $("map").textContent =
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
      attribution: "&copy; OpenStreetMap contributors"
    }
  ).addTo(map);

  savedMarkers = L.featureGroup().addTo(map);
  discoveredMarkers = L.featureGroup().addTo(map);

  requestAnimationFrame(() => {
    map.invalidateSize({ pan: false });
  });

  if ("ResizeObserver" in window) {
    const observer = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        map.invalidateSize({ pan: false });
      });
    });

    observer.observe($("map"));
  }

  window.addEventListener("resize", () => {
    map.invalidateSize({ pan: false });
  });
}

function fitMap(preferDiscovered = false) {
  if (!map) return;

  const discovered = discoveredMarkers.getLayers();

  const layers =
    preferDiscovered && discovered.length
      ? discovered
      : [
          ...savedMarkers.getLayers(),
          ...discovered
        ];

  if (!layers.length) return;

  map.fitBounds(
    L.featureGroup(layers).getBounds().pad(0.15),
    { maxZoom: 13 }
  );
}

function filteredShops() {
  const query = normalise($("search").value);
  const status = $("statusFilter").value;

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
  }

  for (const shop of results) {
    const card = element("article", undefined, "shop");

    card.append(
      element("h3", shop.name),
      element("p", shop.town),
      element(
        "p",
        `Status: ${STATUSES[shop.status] || "Prospect"}`
      )
    );

    if (shop.email) {
      card.append(
        element("p", `Email: ${shop.email}`)
      );
    }

    if (shop.notes) {
      card.append(element("p", shop.notes));
    }

    const actions = element(
      "div",
      undefined,
      "shop-actions"
    );

    actions.append(
      makeButton("Edit", () => editShop(shop.id), true)
    );

    const website = safeWebsite(shop.website);

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

    card.append(actions);
    list.append(card);

    if (savedMarkers && validCoordinates(shop)) {
      const marker = L.circleMarker(
        [shop.lat, shop.lng],
        {
          radius: 8,
          color: "#f1d0a2",
          weight: 2,
          fillColor: "#b87333",
          fillOpacity: .95
        }
      );

      marker.bindPopup(
        element("strong", `${shop.name} — ${shop.town}`)
      );

      savedMarkers.addLayer(marker);
    }
  }
}

function renderDiscovered() {
  const container = $("discoveryResults");
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
      element("p", shop.address || shop.town)
    );

    if (shop.website) {
      card.append(
        element("p", `Website: ${shop.website}`)
      );
    }

    if (shop.email) {
      card.append(
        element("p", `Public email: ${shop.email}`)
      );
    }

    const actions = element(
      "div",
      undefined,
      "result-actions"
    );

    const duplicate = isDuplicate(shop);

    const addButton = makeButton(
      duplicate ? "Already saved" : "Add to directory",
      () => addDiscovered(shop)
    );

    addButton.disabled = duplicate;
    actions.append(addButton);

    if (shop.website) {
      actions.append(
        makeButton(
          "Visit website",
          () => window.open(
            shop.website,
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

          map.setView([shop.lat, shop.lng], 16);

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

    if (discoveredMarkers && validCoordinates(shop)) {
      const marker = L.circleMarker(
        [shop.lat, shop.lng],
        {
          radius: 7,
          color: "#d5f4f5",
          weight: 2,
          fillColor: "#4aabb0",
          fillOpacity: .9
        }
      );

      marker.bindPopup(
        element("strong", shop.name)
      );

      discoveredMarkers.addLayer(marker);
    }
  }
}

function render() {
  renderSaved();
  renderDiscovered();
}

function resetForm() {
  editingId = null;
  $("shopForm").reset();
  $("formHeading").textContent = "Add a bookshop";
  feedback("saveFeedback", "");
}

function editShop(id) {
  const shop = shops.find(item => item.id === id);

  if (!shop) return;

  editingId = id;

  $("name").value = shop.name;
  $("town").value = shop.town;
  $("email").value = shop.email || "";
  $("website").value = shop.website || "";
  $("lat").value = shop.lat ?? "";
  $("lng").value = shop.lng ?? "";
  $("status").value = shop.status;
  $("notes").value = shop.notes || "";

  $("formHeading").textContent = "Edit bookshop";

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
    id: crypto.randomUUID(),
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
      `Address: ${shop.address || "Not supplied"}`,
      "Independent status and trading status unverified.",
      "Contact details and stocking policy require review."
    ].join("\n")
  };

  if (!saveShops([...shops, record])) return;

  render();

  feedback(
    "finderFeedback",
    `${shop.name} added as an unverified prospect.`,
    "success"
  );
}

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

function extractEmail(tags) {
  const email = getTag(tags, [
    "email",
    "contact:email"
  ]);

  return /^[^\s@;,]+@[^\s@;,]+\.[^\s@;,]+$/.test(email)
    ? email
    : "";
}

function extractAddress(tags, fallbackTown) {
  const street = [
    getTag(tags, ["addr:housenumber"]),
    getTag(tags, ["addr:street"])
  ].filter(Boolean).join(" ");

  const town = getTag(tags, [
    "addr:city",
    "addr:town",
    "addr:village"
  ]) || fallbackTown;

  return [street, town].filter(Boolean).join(", ");
}

function parseBookshop(item, fallbackTown) {
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

  const name = getTag(tags, ["name", "name:en"]);

  if (!name) return null;

  const lat = Number(item.lat ?? item.center?.lat);
  const lng = Number(item.lon ?? item.center?.lon);

  const website = safeWebsite(
    getTag(tags, [
      "website",
      "contact:website",
      "website:official",
      "url"
    ])
  );

  const shop = {
    osmId: `${item.type}/${item.id}`,
    name,
    town: getTag(tags, [
      "addr:city",
      "addr:town",
      "addr:village"
    ]) || fallbackTown,
    address: extractAddress(tags, fallbackTown),
    website,
    email: extractEmail(tags),
    lat,
    lng
  };

  return validCoordinates(shop) ? shop : null;
}

async function fetchJSON(url, options = {}) {
  const controller = new AbortController();

  const timer = setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT_MS
  );

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(
        `Search service returned HTTP ${response.status}.`
      );
    }

    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

async function geocodeTown(town) {
  const params = new URLSearchParams({
    q: `${town}, United Kingdom`,
    format: "jsonv2",
    limit: "5",
    addressdetails: "1"
  });

  const results = await fetchJSON(
    `${NOMINATIM_URL}?${params}`
  );

  if (!Array.isArray(results) || !results.length) {
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

async function queryOverpass(lat, lng, radius) {
  const query = `
    [out:json][timeout:20];
    (
      node["shop"="books"](around:${radius},${lat},${lng});
      way["shop"="books"](around:${radius},${lat},${lng});
      relation["shop"="books"](around:${radius},${lat},${lng});
    );
    out center;
  `;

  let lastError = null;

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const result = await fetchJSON(endpoint, {
        method: "POST",
        headers: {
          "Content-Type":
            "application/x-www-form-urlencoded;charset=UTF-8"
        },
        body: new URLSearchParams({ data: query })
      });

      if (!Array.isArray(result.elements)) {
        throw new Error(
          "Unexpected response from bookshop search."
        );
      }

      return result.elements;
    } catch (error) {
      lastError = error;
      console.warn(
        "Overpass endpoint unavailable:",
        endpoint,
        error
      );
    }
  }

  throw lastError || new Error(
    "Bookshop search is unavailable."
  );
}

async function findBookshops(event) {
  event.preventDefault();

  if (searching) return;

  const town = $("finderTown").value.trim();
  const radius = Number($("finderRadius").value);

  if (town.length < 2) {
    feedback(
      "finderFeedback",
      "Please enter a town or city.",
      "error"
    );
    return;
  }

  if (![3000, 5000, 10000, 20000].includes(radius)) {
    return;
  }

  const now = Date.now();

  if (now - lastSearchStarted < 1500) {
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

  discoveredShops = [];
  renderDiscovered();

  feedback(
    "finderFeedback",
    `Locating ${town}…`
  );

  try {
    const location = await geocodeTown(town);

    if (map) {
      map.setView(
        [location.lat, location.lng],
        11
      );
    }

    feedback(
      "finderFeedback",
      `Finding bookshops near ${town}…`
    );

    const results = await queryOverpass(
      location.lat,
      location.lng,
      radius
    );

    const unique = new Map();

    for (const item of results) {
      const shop = parseBookshop(item, town);

      if (!shop) continue;

      const key = normalise(
        `${shop.name}|${shop.town}|${shop.address}`
      );

      if (!unique.has(key)) {
        unique.set(key, shop);
      }
    }

    discoveredShops = [...unique.values()]
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, MAX_RESULTS);

    renderDiscovered();

    if (discoveredShops.length) {
      fitMap(true);

      feedback(
        "finderFeedback",
        `Found ${discoveredShops.length} mapped bookshop(s). Review before saving.`,
        "success"
      );
    } else {
      feedback(
        "finderFeedback",
        "No mapped bookshops found. Try a larger radius."
      );
    }
  } catch (error) {
    console.error("Bookshop search error:", error);

    feedback(
      "finderFeedback",
      `${error.message} The public map service may be busy.`,
      "error"
    );
  } finally {
    searching = false;
    button.disabled = false;
    button.textContent = "Find bookshops";
  }
}

function saveForm(event) {
  event.preventDefault();

  const latText = $("lat").value.trim();
  const lngText = $("lng").value.trim();

  if ((latText === "") !== (lngText === "")) {
    feedback(
      "saveFeedback",
      "Enter both coordinates or leave both blank.",
      "error"
    );
    return;
  }

  const previous = editingId
    ? shops.find(shop => shop.id === editingId)
    : null;

  const record = {
    id: editingId || crypto.randomUUID(),
    osmId: previous?.osmId || "",
    name: $("name").value.trim(),
    town: $("town").value.trim(),
    email: $("email").value.trim(),
    website: safeWebsite($("website").value.trim()),
    lat: latText === "" ? null : Number(latText),
    lng: lngText === "" ? null : Number(lngText),
    status: $("status").value,
    notes: $("notes").value.trim()
  };

  if (!record.name || !record.town) return;

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

  if (isDuplicate(record, record.id)) {
    feedback(
      "saveFeedback",
      "That bookshop is already saved.",
      "error"
    );
    return;
  }

  const nextShops = editingId
    ? shops.map(shop =>
        shop.id === editingId ? record : shop
      )
    : [...shops, record];

  if (!saveShops(nextShops)) return;

  resetForm();
  render();

  feedback(
    "saveFeedback",
    `${record.name} saved successfully.`,
    "success"
  );
}

function exportJSON() {
  const blob = new Blob(
    [JSON.stringify(shops, null, 2)],
    { type: "application/json" }
  );

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "blackwood-bookshop-outreach.json";

  document.body.append(link);
  link.click();
  link.remove();

  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}

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
