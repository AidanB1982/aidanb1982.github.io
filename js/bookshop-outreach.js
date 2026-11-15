
"use strict";

/*
 * BLACKWOOD PUBLISHING
 * BOOKSHOP OUTREACH
 *
 * Independent bookshop discovery and relationship management.
 *
 * Features:
 * - OpenStreetMap and Blackwood-curated discovery
 * - UK town and city searches
 * - Optional major-chain filtering
 * - Browser-local saved bookshop directory
 * - Expandable directory cards
 * - Leaflet map with bookshop markers
 * - Add and edit bookshops
 * - Outreach status tracking
 * - Contact activity history
 * - Follow-up reminders
 * - Editable introduction and follow-up email templates
 * - JSON backup export
 *
 * Emails are NEVER sent automatically.
 * Opening a mailto draft NEVER marks an email as sent.
 *
 * Existing localStorage records are preserved.
 */

const STORAGE_KEY =
  "blackwood-bookshop-outreach-v1";

const BOOKSHOP_DATA_URL =
  "/data/scotland-bookshops.json";

const CURATED_DATA_URL =
  "/data/blackwood-bookshops.json";

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

const CONTACT_TYPES = {
  "email-sent": "Email sent",
  "reply-received": "Reply received",
  "phone-call": "Telephone call",
  visit: "Bookshop visit",
  note: "General note"
};

const MAJOR_CHAINS = new Set([
  "waterstones",
  "the works",
  "whsmith",
  "wh smith",
  "the bookshop by whsmith",
  "blackwell's",
  "blackwells",
  "blackwell's university bookshop",
  "tgjones",
  "tg jones",
  "foyles"
]);

const EMAIL_TEMPLATES = {
  introduction: {
    label: "Initial introduction",
    subject:
      "Blackwood Publishing — independent bookshop enquiry",
    body: [
      "Hello {bookshop},",
      "",
      "I'm getting in touch from Blackwood Publishing, an independent Scottish publishing imprint.",
      "",
      "We're introducing our paperback catalogue to independent bookshops and wondered whether selected titles might be suitable for your shelves.",
      "",
      "Our titles are available through IngramSpark, including:",
      "",
      "Gualachulain Bothy: The Second Silence — 9781919555560",
      "Holdfast — 9781919555522",
      "Love, Abused — 9781919555539",
      "The Black Bothy — 9781919555584",
      "Corrour: The First Summoning — 9781919555508",
      "",
      "We'd be happy to provide further information about our books, ordering and trade availability.",
      "",
      "Would you be interested in receiving our catalogue details?",
      "",
      "Thank you for your time and for supporting readers in your local community.",
      "",
      "Kind regards,",
      "Aidan Blackwood",
      "Blackwood Publishing",
      "https://blackwoodpublishing.co.uk",
      "",
      "If you'd prefer not to receive further trade enquiries, please let us know."
    ].join("\n")
  },

  followup: {
    label: "Friendly follow-up",
    subject:
      "Following up — Blackwood Publishing bookshop enquiry",
    body: [
      "Hello {bookshop},",
      "",
      "I hope you're well.",
      "",
      "I wanted to follow up on my earlier message introducing Blackwood Publishing and our paperback catalogue.",
      "",
      "I appreciate how busy independent bookshops are, so there's absolutely no pressure. I simply wanted to ask whether you might be interested in reviewing our catalogue or discussing potential stocking arrangements.",
      "",
      "Our titles are available through IngramSpark, and we'd be happy to share further book information and ordering details.",
      "",
      "Thank you again for your time.",
      "",
      "Kind regards,",
      "Aidan Blackwood",
      "Blackwood Publishing",
      "https://blackwoodpublishing.co.uk",
      "",
      "If you'd prefer not to receive further trade enquiries, please let us know."
    ].join("\n")
  }
};

const $ = id =>
  document.getElementById(id);

let shops = loadShops();
let discoveredShops = [];
let bookshopDataset = null;

let editingId = null;
let searching = false;
let lastSearchStarted = 0;
let lastSearchTown = "";

let map = null;
let savedMarkers = null;
let discoveredMarkers = null;

let emailDialog = null;
let emailRecipient = null;
let emailTemplateSelect = null;
let emailSubjectInput = null;
let emailBodyInput = null;
let emailFeedback = null;
let activeEmailShopId = null;

let contactDialog = null;
let contactTypeSelect = null;
let contactDateInput = null;
let contactNotesInput = null;
let contactFollowUpInput = null;
let contactStatusSelect = null;
let contactFeedback = null;
let activeContactShopId = null;

/* =========================================
   GENERAL HELPERS
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
  node.className =
    `feedback ${type}`.trim();
}

function normalise(value) {
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase("en-GB")
    .replace(/\s+/g, " ");
}

function normaliseName(value) {
  return normalise(value)
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
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

function localDate() {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(
    now.getMonth() + 1
  ).padStart(2, "0");

  const day = String(
    now.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function validDate(value) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return false;
  }

  const date = new Date(
    `${value}T12:00:00`
  );

  return (
    !Number.isNaN(date.getTime()) &&
    date.getFullYear() ===
      Number(value.slice(0, 4)) &&
    date.getMonth() + 1 ===
      Number(value.slice(5, 7)) &&
    date.getDate() ===
      Number(value.slice(8, 10))
  );
}

function formatDate(value) {
  if (!validDate(value)) {
    return "Date not recorded";
  }

  return new Date(
    `${value}T12:00:00`
  ).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

function activityHistory(shop) {
  return Array.isArray(shop.contactHistory)
    ? shop.contactHistory
    : [];
}

function isMajorChain(shop) {
  const name = normalise(shop.name)
    .replace(/[’‘]/g, "'");

  return MAJOR_CHAINS.has(name);
}

function visibleDiscoveredShops() {
  const hideChains =
    $("hideChains")?.checked ?? false;

  return discoveredShops
    .filter(shop =>
      !hideChains || !isMajorChain(shop)
    )
    .slice(0, MAX_RESULTS);
}

function updateDiscoveryFeedback() {
  if (!lastSearchTown) return;

  const visible =
    visibleDiscoveredShops();

  const hidden = discoveredShops.filter(
    isMajorChain
  ).length;

  if (!visible.length) {
    feedback(
      "finderFeedback",
      discoveredShops.length
        ? "No bookshops match the current chain filter. Untick the checkbox to see all results."
        : "No bookshops found in the cached datasets for this radius. Try a larger radius."
    );

    return;
  }

  const hiddenText =
    $("hideChains")?.checked && hidden
      ? ` ${hidden} major-chain result(s) hidden.`
      : "";

  feedback(
    "finderFeedback",
    `Showing ${visible.length} bookshop(s) near ${lastSearchTown}.${hiddenText} Review before saving.`,
    "success"
  );
}

/* =========================================
   LOCAL STORAGE
========================================= */

function loadShops() {
  try {
    const data = JSON.parse(
      localStorage.getItem(STORAGE_KEY) ||
      "[]"
    );

    return Array.isArray(data)
      ? data
      : [];

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

function updateShopRecord(id, changes) {
  const existing = shops.find(
    shop => shop.id === id
  );

  if (!existing) {
    return false;
  }

  const updated = {
    ...existing,
    ...changes
  };

  return saveShops(
    shops.map(shop =>
      shop.id === id
        ? updated
        : shop
    )
  );
}

function sameBookshop(a, b) {
  if (
    a.osmId &&
    b.osmId &&
    a.osmId === b.osmId
  ) {
    return true;
  }

  if (
    normaliseName(a.name) !==
    normaliseName(b.name)
  ) {
    return false;
  }

  if (
    validCoordinates(a) &&
    validCoordinates(b)
  ) {
    return distanceMetres(
      a.lat,
      a.lng,
      b.lat,
      b.lng
    ) <= 500;
  }

  return (
    normalise(a.town) ===
    normalise(b.town)
  );
}

function isDuplicate(
  candidate,
  excludeId = null
) {
  return shops.some(shop => {
    if (shop.id === excludeId) {
      return false;
    }

    return sameBookshop(
      candidate,
      shop
    );
  });
}

/* =========================================
   LEAFLET MAP
========================================= */

function bookshopIcon(type = "found") {
  const saved =
    type === "saved";

  return L.divIcon({
    className:
      "blackwood-book-marker",

    html: `
      <span
        style="
          display:flex;
          align-items:center;
          justify-content:center;
          width:36px;
          height:36px;
          border-radius:50%;
          background:${
            saved
              ? "#b87333"
              : "#4aabb0"
          };
          border:2px solid #f5ead5;
          box-shadow:0 3px 10px rgba(0,0,0,.35);
          font-size:20px;
          line-height:1;
        "
        aria-hidden="true"
      >📚</span>
    `,

    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -20]
  });
}

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

  savedMarkers =
    L.featureGroup().addTo(map);

  discoveredMarkers =
    L.featureGroup().addTo(map);

  requestAnimationFrame(() => {
    map.invalidateSize({
      pan: false
    });
  });

  if ("ResizeObserver" in window) {
    const observer =
      new ResizeObserver(() => {
        requestAnimationFrame(() => {
          map.invalidateSize({
            pan: false
          });
        });
      });

    observer.observe(mapElement);
  }

  window.addEventListener(
    "resize",
    () => {
      map.invalidateSize({
        pan: false
      });
    }
  );
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

  const bounds =
    L.featureGroup(layers)
      .getBounds()
      .pad(0.15);

  map.fitBounds(bounds, {
    maxZoom: 13
  });
}

/* =========================================
   CONTACT TRACKING OVERVIEW
========================================= */

function ensureContactOverview() {
  let overview =
    $("bookshopContactOverview");

  if (overview) return overview;

  const toolbar =
    document.querySelector(
      "#bookshop-admin-content .toolbar"
    );

  if (!toolbar) return null;

  overview = element(
    "section",
    undefined,
    "bookshop-contact-overview"
  );

  overview.id =
    "bookshopContactOverview";

  overview.setAttribute(
    "aria-label",
    "Bookshop outreach overview"
  );

  Object.assign(overview.style, {
    display: "flex",
    flexWrap: "wrap",
    gap: "10px",
    margin: "0 0 22px"
  });

  toolbar.insertAdjacentElement(
    "afterend",
    overview
  );

  return overview;
}

function renderContactOverview() {
  const overview =
    ensureContactOverview();

  if (!overview) return;

  const counts = {
    prospect: 0,
    contacted: 0,
    interested: 0,
    stockist: 0,
    due: 0
  };

  const today = localDate();

  for (const shop of shops) {
    if (
      Object.prototype.hasOwnProperty.call(
        counts,
        shop.status
      )
    ) {
      counts[shop.status] += 1;
    }

    if (
      shop.status !== "opted-out" &&
      shop.status !== "stockist" &&
      validDate(shop.followUpDate) &&
      shop.followUpDate <= today
    ) {
      counts.due += 1;
    }
  }

  const items = [
    ["Saved bookshops", shops.length],
    ["Prospects", counts.prospect],
    ["Contacted", counts.contacted],
    ["Interested", counts.interested],
    ["Stockists", counts.stockist],
    ["Follow-ups due", counts.due]
  ];

  overview.replaceChildren();

  for (const [label, count] of items) {
    const card = element(
      "div",
      undefined,
      "bookshop-overview-stat"
    );

    Object.assign(card.style, {
      flex: "1 1 135px",
      padding: "15px",
      background: "#1c231f",
      border: "1px solid #544332",
      borderRadius: "8px"
    });

    const number = element(
      "strong",
      String(count)
    );

    Object.assign(number.style, {
      display: "block",
      color: "#e7bd83",
      fontSize: "25px",
      fontWeight: "400",
      marginBottom: "5px"
    });

    const caption = element(
      "span",
      label
    );

    Object.assign(caption.style, {
      font: "12px/1.5 Arial, sans-serif",
      color: "#c9c7bd"
    });

    card.append(
      number,
      caption
    );

    overview.append(card);
  }
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

  renderContactOverview();

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
          STATUSES[shop.status] ||
          "Prospect"
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

    const history =
      activityHistory(shop);

    if (history.length) {
      const latest = [...history]
        .sort((a, b) =>
          String(b.date || "")
            .localeCompare(
              String(a.date || "")
            )
        )[0];

      content.append(
        element(
          "p",
          `Last activity: ${
            CONTACT_TYPES[latest.type] ||
            "Contact note"
          } · ${formatDate(latest.date)}`
        )
      );
    }

    if (validDate(shop.followUpDate)) {
      const due =
        shop.followUpDate <= localDate() &&
        shop.status !== "opted-out" &&
        shop.status !== "stockist";

      const reminder = element(
        "p",
        `${
          due
            ? "Follow-up due"
            : "Next follow-up"
        }: ${formatDate(shop.followUpDate)}`
      );

      if (due) {
        reminder.style.color =
          "#e7bd83";

        reminder.style.fontWeight =
          "bold";
      }

      content.append(reminder);
    }

    if (history.length) {
      const historyHeading = element(
        "h4",
        "Contact history"
      );

      historyHeading.style.margin =
        "20px 0 10px";

      historyHeading.style.color =
        "#e7bd83";

      content.append(
        historyHeading
      );

      const historyList =
        document.createElement("ul");

      Object.assign(
        historyList.style,
        {
          paddingLeft: "20px",
          margin: "0 0 15px"
        }
      );

      const sorted = [...history]
        .sort((a, b) =>
          String(b.date || "")
            .localeCompare(
              String(a.date || "")
            )
        );

      for (const entry of sorted) {
        const item =
          document.createElement("li");

        item.style.marginBottom =
          "10px";

        const label = element(
          "strong",
          `${
            CONTACT_TYPES[entry.type] ||
            "Contact note"
          } — ${formatDate(entry.date)}`
        );

        item.append(label);

        if (entry.notes) {
          item.append(
            element(
              "p",
              entry.notes
            )
          );
        }

        historyList.append(item);
      }

      content.append(historyList);
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

    actions.append(
      makeButton(
        "Record contact",
        () => openContactDialog(shop)
      )
    );

    const website =
      safeWebsite(shop.website);

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
          "Contact bookshop",
          () => openEmailComposer(shop)
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
      const marker = L.marker(
        [shop.lat, shop.lng],
        {
          icon: bookshopIcon("saved"),
          title:
            `${shop.name} — ${shop.town}`
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

  const visible =
    visibleDiscoveredShops();

  for (const shop of visible) {
    const card = element(
      "article",
      undefined,
      "discovery-card"
    );

    const sourceLabel =
      shop.source === "curated"
        ? "BLACKWOOD CURATED · REVIEW BEFORE CONTACT"
        : "OPENSTREETMAP RESULT · UNVERIFIED";

    card.append(
      element(
        "span",
        sourceLabel,
        "result-meta"
      ),
      element(
        "h3",
        shop.name
      ),
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

    const duplicate =
      isDuplicate(shop);

    const addButton = makeButton(
      duplicate
        ? "Already saved"
        : "Add to directory",
      () => addDiscovered(shop)
    );

    addButton.disabled =
      duplicate;

    actions.append(addButton);

    const website =
      safeWebsite(shop.website);

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
          if (
            !map ||
            !validCoordinates(shop)
          ) {
            return;
          }

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
      const marker = L.marker(
        [shop.lat, shop.lng],
        {
          icon: bookshopIcon("found"),
          title: shop.name
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

  $("name").value =
    shop.name;

  $("town").value =
    shop.town;

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

    contactHistory: [],
    followUpDate: "",

    notes: [
      shop.source === "curated"
        ? "Discovered in the Blackwood curated bookshop list."
        : "Discovered using OpenStreetMap.",
      shop.osmId
        ? `OSM reference: ${shop.osmId}`
        : "",
      `Address: ${
        shop.address ||
        "Not supplied"
      }`,
      "Independent status and trading status require review.",
      "Contact details and stocking policy require review."
    ]
      .filter(Boolean)
      .join("\n")
  };

  if (!saveShops([
    ...shops,
    record
  ])) {
    return;
  }

  render();

  feedback(
    "finderFeedback",
    `${shop.name} added as a prospect.`,
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
    /*
     * Preserve every existing property,
     * including contact history and future
     * tracking fields.
     */
    ...(previous || {}),

    id: editingId || newId(),

    osmId:
      previous?.osmId || "",

    name:
      $("name").value.trim(),

    town:
      $("town").value.trim(),

    email:
      $("email").value.trim(),

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

    status:
      $("status").value,

    notes:
      $("notes").value.trim(),

    contactHistory:
      activityHistory(
        previous || {}
      ),

    followUpDate:
      previous?.followUpDate || ""
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
   SHARED DIALOG HELPERS
========================================= */

function styleDialog(dialog) {
  Object.assign(dialog.style, {
    width:
      "min(720px, calc(100vw - 32px))",
    maxHeight:
      "calc(100vh - 32px)",
    overflowY: "auto",
    padding: "24px",
    border: "1px solid #8b693d",
    borderRadius: "12px",
    background: "#171c19",
    color: "#f5ead5",
    boxSizing: "border-box"
  });
}

function styleDialogControl(control) {
  Object.assign(control.style, {
    width: "100%",
    boxSizing: "border-box",
    padding: "10px 12px",
    borderRadius: "6px",
    border: "1px solid #806344",
    background: "#202923",
    color: "#fff",
    font: "inherit"
  });
}

function dialogField(labelText, control) {
  const label =
    document.createElement("label");

  Object.assign(label.style, {
    display: "grid",
    gap: "6px"
  });

  label.append(
    element(
      "span",
      labelText
    ),
    control
  );

  return label;
}

function dialogForm() {
  const form =
    document.createElement("form");

  form.method = "dialog";

  Object.assign(form.style, {
    display: "grid",
    gap: "14px"
  });

  return form;
}

/* =========================================
   EMAIL TEMPLATES
========================================= */

function personaliseTemplate(
  template,
  shop
) {
  return template.replaceAll(
    "{bookshop}",
    shop.name
  );
}

function applyEmailTemplate() {
  const shop = shops.find(
    item =>
      item.id === activeEmailShopId
  );

  if (!shop) return;

  const template =
    EMAIL_TEMPLATES[
      emailTemplateSelect.value
    ];

  if (!template) return;

  emailSubjectInput.value =
    template.subject;

  emailBodyInput.value =
    personaliseTemplate(
      template.body,
      shop
    );

  emailFeedback.textContent = "";
}

/* =========================================
   EDITABLE EMAIL COMPOSER
========================================= */

function createEmailComposer() {
  const dialog =
    document.createElement("dialog");

  dialog.id =
    "blackwoodEmailDialog";

  styleDialog(dialog);

  const heading = element(
    "h2",
    "Contact bookshop"
  );

  heading.id =
    "blackwoodEmailHeading";

  heading.style.marginTop =
    "0";

  dialog.setAttribute(
    "aria-labelledby",
    heading.id
  );

  const description = element(
    "p",
    "Choose a template, personalise your message and open it in your email application. Nothing is sent automatically."
  );

  const form =
    dialogForm();

  emailRecipient =
    document.createElement("input");

  emailRecipient.type =
    "email";

  emailRecipient.readOnly =
    true;

  styleDialogControl(
    emailRecipient
  );

  emailTemplateSelect =
    document.createElement("select");

  styleDialogControl(
    emailTemplateSelect
  );

  for (
    const [key, template]
    of Object.entries(
      EMAIL_TEMPLATES
    )
  ) {
    emailTemplateSelect.add(
      new Option(
        template.label,
        key
      )
    );
  }

  emailTemplateSelect.addEventListener(
    "change",
    applyEmailTemplate
  );

  emailSubjectInput =
    document.createElement("input");

  emailSubjectInput.type =
    "text";

  emailSubjectInput.required =
    true;

  emailSubjectInput.maxLength =
    200;

  styleDialogControl(
    emailSubjectInput
  );

  emailBodyInput =
    document.createElement("textarea");

  emailBodyInput.required =
    true;

  emailBodyInput.rows =
    16;

  styleDialogControl(
    emailBodyInput
  );

  emailBodyInput.style.resize =
    "vertical";

  emailBodyInput.style.minHeight =
    "240px";

  emailFeedback = element(
    "p",
    "",
    "feedback"
  );

  emailFeedback.setAttribute(
    "role",
    "status"
  );

  const actions = element(
    "div",
    undefined,
    "form-actions"
  );

  const openButton = makeButton(
    "Open email draft",
    openPreparedEmail
  );

  const copyButton = makeButton(
    "Copy message",
    copyPreparedEmail,
    true
  );

  const recordButton = makeButton(
    "Record sent email",
    () => {
      const shop = shops.find(
        item =>
          item.id === activeEmailShopId
      );

      if (!shop) return;

      dialog.close();

      openContactDialog(
        shop,
        "email-sent"
      );
    },
    true
  );

  const cancelButton = makeButton(
    "Close",
    () => dialog.close(),
    true
  );

  actions.append(
    openButton,
    copyButton,
    recordButton,
    cancelButton
  );

  form.append(
    dialogField(
      "To",
      emailRecipient
    ),

    dialogField(
      "Email template",
      emailTemplateSelect
    ),

    dialogField(
      "Subject",
      emailSubjectInput
    ),

    dialogField(
      "Message",
      emailBodyInput
    ),

    emailFeedback,
    actions
  );

  dialog.append(
    heading,
    description,
    form
  );

  document.body.append(
    dialog
  );

  dialog.addEventListener(
    "click",
    event => {
      if (event.target === dialog) {
        dialog.close();
      }
    }
  );

  dialog.addEventListener(
    "close",
    () => {
      activeEmailShopId = null;
    }
  );

  emailDialog = dialog;
}

function openEmailComposer(shop) {
  if (
    !shop.email ||
    shop.status === "opted-out"
  ) {
    return;
  }

  if (!emailDialog) {
    createEmailComposer();
  }

  activeEmailShopId =
    shop.id;

  emailRecipient.value =
    String(shop.email).trim();

  const hasContact =
    activityHistory(shop).some(
      entry =>
        entry.type === "email-sent"
    );

  emailTemplateSelect.value =
    hasContact
      ? "followup"
      : "introduction";

  applyEmailTemplate();

  emailFeedback.textContent =
    "";

  emailDialog.showModal();

  emailSubjectInput.focus();
}

function getPreparedEmail() {
  if (!activeEmailShopId) {
    return null;
  }

  const shop = shops.find(
    item =>
      item.id === activeEmailShopId
  );

  if (
    !shop ||
    !shop.email ||
    shop.status === "opted-out"
  ) {
    emailFeedback.textContent =
      "This bookshop is no longer available for contact.";

    return null;
  }

  const subject =
    emailSubjectInput.value.trim();

  const body =
    emailBodyInput.value.trim();

  if (!subject || !body) {
    emailFeedback.textContent =
      "Please enter a subject and message.";

    return null;
  }

  return {
    email:
      String(shop.email).trim(),

    subject,
    body
  };
}

function openPreparedEmail() {
  const prepared =
    getPreparedEmail();

  if (!prepared) return;

  const mailto =
    `mailto:${
      encodeURIComponent(
        prepared.email
      )
    }` +
    `?subject=${
      encodeURIComponent(
        prepared.subject
      )
    }` +
    `&body=${
      encodeURIComponent(
        prepared.body
      )
    }`;

  /*
   * This opens a draft only.
   * It does not send the message or
   * change the bookshop's status.
   */
  window.location.href =
    mailto;

  emailFeedback.textContent =
    "Email draft requested. Review and send it in your email application. Afterwards, use Record sent email to update your contact history.";
}

async function copyPreparedEmail() {
  const prepared =
    getPreparedEmail();

  if (!prepared) return;

  const text = [
    `To: ${prepared.email}`,
    `Subject: ${prepared.subject}`,
    "",
    prepared.body
  ].join("\n");

  try {
    await navigator.clipboard.writeText(
      text
    );

    emailFeedback.textContent =
      "Message copied to clipboard.";

  } catch {
    emailBodyInput.focus();
    emailBodyInput.select();

    emailFeedback.textContent =
      "Clipboard access unavailable. The message has been selected so you can copy it manually.";
  }
}

/* =========================================
   CONTACT ACTIVITY DIALOG
========================================= */

function createContactDialog() {
  const dialog =
    document.createElement("dialog");

  dialog.id =
    "blackwoodContactDialog";

  styleDialog(dialog);

  const heading = element(
    "h2",
    "Record bookshop contact"
  );

  heading.id =
    "blackwoodContactHeading";

  heading.style.marginTop =
    "0";

  dialog.setAttribute(
    "aria-labelledby",
    heading.id
  );

  const description = element(
    "p",
    "Record an action that has actually happened. Set a follow-up date if needed."
  );

  const form =
    dialogForm();

  contactTypeSelect =
    document.createElement("select");

  styleDialogControl(
    contactTypeSelect
  );

  for (
    const [key, label]
    of Object.entries(
      CONTACT_TYPES
    )
  ) {
    contactTypeSelect.add(
      new Option(
        label,
        key
      )
    );
  }

  contactDateInput =
    document.createElement("input");

  contactDateInput.type =
    "date";

  contactDateInput.required =
    true;

  styleDialogControl(
    contactDateInput
  );

  contactNotesInput =
    document.createElement("textarea");

  contactNotesInput.rows =
    5;

  contactNotesInput.maxLength =
    5000;

  contactNotesInput.placeholder =
    "What happened? Who did you speak to? What was agreed?";

  styleDialogControl(
    contactNotesInput
  );

  contactNotesInput.style.resize =
    "vertical";

  contactFollowUpInput =
    document.createElement("input");

  contactFollowUpInput.type =
    "date";

  styleDialogControl(
    contactFollowUpInput
  );

  contactStatusSelect =
    document.createElement("select");

  styleDialogControl(
    contactStatusSelect
  );

  for (
    const [key, label]
    of Object.entries(
      STATUSES
    )
  ) {
    contactStatusSelect.add(
      new Option(
        label,
        key
      )
    );
  }

  contactFeedback = element(
    "p",
    "",
    "feedback"
  );

  contactFeedback.setAttribute(
    "role",
    "status"
  );

  const actions = element(
    "div",
    undefined,
    "form-actions"
  );

  const saveButton = makeButton(
    "Save contact record",
    saveContactActivity
  );

  const cancelButton = makeButton(
    "Cancel",
    () => dialog.close(),
    true
  );

  actions.append(
    saveButton,
    cancelButton
  );

  form.append(
    dialogField(
      "Contact type",
      contactTypeSelect
    ),

    dialogField(
      "Date of activity",
      contactDateInput
    ),

    dialogField(
      "Notes",
      contactNotesInput
    ),

    dialogField(
      "Next follow-up date (optional)",
      contactFollowUpInput
    ),

    dialogField(
      "Outreach status",
      contactStatusSelect
    ),

    contactFeedback,
    actions
  );

  dialog.append(
    heading,
    description,
    form
  );

  document.body.append(
    dialog
  );

  dialog.addEventListener(
    "click",
    event => {
      if (event.target === dialog) {
        dialog.close();
      }
    }
  );

  dialog.addEventListener(
    "close",
    () => {
      activeContactShopId = null;
    }
  );

  contactDialog = dialog;
}

function openContactDialog(
  shop,
  initialType = "note"
) {
  if (!contactDialog) {
    createContactDialog();
  }

  const current = shops.find(
    item => item.id === shop.id
  );

  if (!current) return;

  activeContactShopId =
    current.id;

  contactTypeSelect.value =
    initialType;

  contactDateInput.value =
    localDate();

  contactNotesInput.value =
    "";

  contactFollowUpInput.value =
    current.followUpDate || "";

  contactStatusSelect.value =
    initialType === "email-sent" &&
    current.status === "prospect"
      ? "contacted"
      : current.status || "prospect";

  contactFeedback.textContent =
    "";

  contactDialog.showModal();
}

function saveContactActivity() {
  const shop = shops.find(
    item =>
      item.id === activeContactShopId
  );

  if (!shop) {
    contactFeedback.textContent =
      "The selected bookshop could not be found.";

    return;
  }

  const type =
    contactTypeSelect.value;

  const date =
    contactDateInput.value;

  const notes =
    contactNotesInput.value.trim();

  const followUpDate =
    contactFollowUpInput.value;

  const status =
    contactStatusSelect.value;

  if (
    !Object.prototype.hasOwnProperty.call(
      CONTACT_TYPES,
      type
    )
  ) {
    contactFeedback.textContent =
      "Choose a valid contact type.";

    return;
  }

  if (!validDate(date)) {
    contactFeedback.textContent =
      "Choose a valid activity date.";

    return;
  }

  if (
    followUpDate &&
    !validDate(followUpDate)
  ) {
    contactFeedback.textContent =
      "Choose a valid follow-up date.";

    return;
  }

  if (
    !Object.prototype.hasOwnProperty.call(
      STATUSES,
      status
    )
  ) {
    contactFeedback.textContent =
      "Choose a valid outreach status.";

    return;
  }

  const activity = {
    id: newId(),
    type,
    date,
    notes,
    recordedAt:
      new Date().toISOString()
  };

  const updatedHistory = [
    ...activityHistory(shop),
    activity
  ];

  const success =
    updateShopRecord(
      shop.id,
      {
        contactHistory:
          updatedHistory,

        followUpDate,

        status
      }
    );

  if (!success) {
    contactFeedback.textContent =
      "Unable to save contact history. Please export a backup and try again.";

    return;
  }

  contactDialog.close();

  render();

  feedback(
    "saveFeedback",
    `Contact activity recorded for ${shop.name}.`,
    "success"
  );
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

  const timer = setTimeout(
    () => {
      controller.abort();
    },
    REQUEST_TIMEOUT_MS
  );

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
    if (error.name === "AbortError") {
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

  const match = results.find(
    item =>
      item.address?.country_code === "gb" &&
      Number.isFinite(
        Number(item.lat)
      ) &&
      Number.isFinite(
        Number(item.lon)
      )
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
   DISCOVERY DATASETS
========================================= */

function normaliseDatasetShop(
  shop,
  source
) {
  return {
    osmId:
      String(shop.osmId || ""),

    name:
      String(shop.name || "").trim(),

    town:
      String(shop.town || "").trim(),

    address:
      String(shop.address || "").trim(),

    website:
      safeWebsite(shop.website),

    email:
      String(shop.email || "").trim(),

    lat:
      Number(shop.lat),

    lng:
      Number(shop.lng),

    source
  };
}

async function loadBookshopDataset() {
  if (bookshopDataset) {
    return bookshopDataset;
  }

  const sources = [
    {
      url: BOOKSHOP_DATA_URL,
      source: "openstreetmap"
    },
    {
      url: CURATED_DATA_URL,
      source: "curated"
    }
  ];

  const outcomes =
    await Promise.allSettled(
      sources.map(
        async entry => {
          const data =
            await fetchJSON(
              entry.url,
              {
                cache: "no-cache"
              }
            );

          if (
            !Array.isArray(
              data.shops
            )
          ) {
            throw new Error(
              `Invalid bookshop data in ${entry.url}`
            );
          }

          return data.shops.map(
            shop =>
              normaliseDatasetShop(
                shop,
                entry.source
              )
          );
        }
      )
    );

  const combined = [];
  const failures = [];

  outcomes.forEach(
    (outcome, index) => {
      if (
        outcome.status === "fulfilled"
      ) {
        combined.push(
          ...outcome.value
        );
      } else {
        failures.push(
          sources[index].url
        );

        console.error(
          `Unable to load ${sources[index].url}:`,
          outcome.reason
        );
      }
    }
  );

  if (
    failures.length ===
    sources.length
  ) {
    throw new Error(
      "Neither bookshop dataset could be loaded. Please try again later."
    );
  }

  if (failures.length) {
    console.warn(
      "Some discovery data is unavailable:",
      failures.join(", ")
    );
  }

  bookshopDataset = {
    shops: combined,
    partial:
      failures.length > 0
  };

  return bookshopDataset;
}

function distanceMetres(
  lat1,
  lng1,
  lat2,
  lng2
) {
  const toRadians =
    degrees =>
      degrees * Math.PI / 180;

  const earthRadius =
    6371000;

  const dLat =
    toRadians(lat2 - lat1);

  const dLng =
    toRadians(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(
      toRadians(lat1)
    ) *
    Math.cos(
      toRadians(lat2)
    ) *
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

  return dataset.shops.filter(
    shop => {
      if (
        !shop.name ||
        !validCoordinates(shop)
      ) {
        return false;
      }

      return distanceMetres(
        lat,
        lng,
        shop.lat,
        shop.lng
      ) <= radius;
    }
  );
}

function mergeDiscoveredResults(
  results,
  fallbackTown
) {
  const ordered = [
    ...results
  ].sort(
    (a, b) => {
      if (
        a.source === b.source
      ) {
        return 0;
      }

      return a.source === "curated"
        ? -1
        : 1;
    }
  );

  const unique = [];

  for (const item of ordered) {
    const shop = {
      ...item,

      town:
        item.town ||
        fallbackTown,

      address:
        item.address ||
        item.town ||
        fallbackTown
    };

    const existing =
      unique.find(
        other =>
          sameBookshop(
            other,
            shop
          )
      );

    if (!existing) {
      unique.push(shop);
      continue;
    }

    if (
      !existing.website &&
      shop.website
    ) {
      existing.website =
        shop.website;
    }

    if (
      !existing.email &&
      shop.email
    ) {
      existing.email =
        shop.email;
    }

    if (
      !existing.osmId &&
      shop.osmId
    ) {
      existing.osmId =
        shop.osmId;
    }
  }

  return unique.sort(
    (a, b) =>
      a.name.localeCompare(
        b.name,
        "en-GB"
      )
  );
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
    ![
      3000,
      5000,
      10000,
      20000
    ].includes(radius)
  ) {
    feedback(
      "finderFeedback",
      "Invalid search radius.",
      "error"
    );

    return;
  }

  const now =
    Date.now();

  if (
    now - lastSearchStarted <
    1500
  ) {
    feedback(
      "finderFeedback",
      "Please wait before searching again.",
      "error"
    );

    return;
  }

  lastSearchStarted =
    now;

  searching =
    true;

  const button =
    $("findBtn");

  button.disabled =
    true;

  button.textContent =
    "Searching…";

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
      `Searching Blackwood's bookshop datasets near ${town}…`
    );

    const results =
      await searchCachedBookshops(
        location.lat,
        location.lng,
        radius
      );

    discoveredShops =
      mergeDiscoveredResults(
        results,
        town
      );

    lastSearchTown =
      town;

    renderDiscovered();

    if (
      visibleDiscoveredShops().length
    ) {
      fitMap(true);
    }

    updateDiscoveryFeedback();

    if (
      bookshopDataset?.partial
    ) {
      const current =
        $("finderFeedback").textContent;

      feedback(
        "finderFeedback",
        `${current} Note: one discovery dataset could not be loaded.`,
        "error"
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
    searching =
      false;

    button.disabled =
      false;

    button.textContent =
      "Find bookshops";
  }
}

/* =========================================
   JSON EXPORT
========================================= */

function exportJSON() {
  const blob =
    new Blob(
      [
        JSON.stringify(
          shops,
          null,
          2
        )
      ],
      {
        type:
          "application/json"
      }
    );

  const url =
    URL.createObjectURL(blob);

  const link =
    document.createElement("a");

  link.href =
    url;

  link.download =
    "blackwood-bookshop-outreach.json";

  document.body.append(
    link
  );

  link.click();
  link.remove();

  setTimeout(
    () => {
      URL.revokeObjectURL(
        url
      );
    },
    1000
  );
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
      lastSearchTown = "";

      renderDiscovered();

      feedback(
        "finderFeedback",
        "Search results cleared."
      );

      fitMap();
    }
  );

  $("hideChains")?.addEventListener(
    "change",
    () => {
      renderDiscovered();
      updateDiscoveryFeedback();

      if (
        visibleDiscoveredShops().length
      ) {
        fitMap(true);
      } else {
        fitMap();
      }
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
  document.readyState ===
  "loading"
) {
  document.addEventListener(
    "DOMContentLoaded",
    initialise,
    {
      once: true
    }
  );
} else {
  initialise();
}
