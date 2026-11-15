
"use strict";

/*
 * BLACKWOOD PUBLISHING
 * Bookshop Outreach — GitHub Pages edition
 *
 * Discovery:
 * - Cached OpenStreetMap bookshop data
 * - Blackwood-curated bookshop data
 * - Distance search from a UK town or city
 * - Nominatim town lookup
 * - Optional major-chain filtering
 *
 * Management:
 * - Browser-local saved directory
 * - Expandable bookshop cards
 * - Leaflet map markers
 * - Add/edit records
 * - Search and status filtering
 * - JSON export
 * - Editable manual email drafts
 *
 * No emails are sent automatically.
 * No bookshops are published automatically.
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

const EMAIL_SUBJECT =
  "Blackwood Publishing — bookshop stocking enquiry";

const EMAIL_TEMPLATE = [
  "Hello,",
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
  "Kind regards,",
  "Blackwood Publishing",
  "https://blackwoodpublishing.co.uk",
  "",
  "If you'd prefer not to receive further trade enquiries, please let us know."
].join("\n");

const $ = id => document.getElementById(id);

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
let emailSubjectInput = null;
let emailBodyInput = null;
let emailFeedback = null;
let activeEmailShopId = null;

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

  const visible = visibleDiscoveredShops();

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

  const visible = visibleDiscoveredShops();

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
      shop.source === "curated"
        ? "Discovered in the Blackwood curated bookshop list."
        : "Discovered using OpenStreetMap.",
      shop.osmId
        ? `OSM reference: ${shop.osmId}`
        : "",
      `Address: ${
        shop.address || "Not supplied"
      }`,
      "Independent status and trading status require review.",
      "Contact details and stocking policy require review."
    ]
      .filter(Boolean)
      .join("\n")
  };

  if (!saveShops([...shops, record])) {
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
   EDITABLE EMAIL COMPOSER
========================================= */

function createEmailComposer() {
  const dialog = document.createElement("dialog");

  dialog.id = "blackwoodEmailDialog";

  Object.assign(dialog.style, {
    width: "min(720px, calc(100vw - 32px))",
    maxHeight: "calc(100vh - 32px)",
    overflowY: "auto",
    padding: "24px",
    border: "1px solid #8b693d",
    borderRadius: "12px",
    background: "#171c19",
    color: "#f5ead5",
    boxSizing: "border-box"
  });

  const heading = element(
    "h2",
    "Contact bookshop"
  );

  heading.id = "blackwoodEmailHeading";
  heading.style.marginTop = "0";

  dialog.setAttribute(
    "aria-labelledby",
    heading.id
  );

  const description = element(
    "p",
    "Edit your message below. Opening the draft does not send the email."
  );

  const form = document.createElement("form");
  form.method = "dialog";

  Object.assign(form.style, {
    display: "grid",
    gap: "14px"
  });

  function createField(labelText, control) {
    const label = document.createElement("label");

    Object.assign(label.style, {
      display: "grid",
      gap: "6px"
    });

    const caption = element(
      "span",
      labelText
    );

    label.append(caption, control);

    return label;
  }

  function styleControl(control) {
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

  emailRecipient = document.createElement("input");
  emailRecipient.type = "email";
  emailRecipient.readOnly = true;
  styleControl(emailRecipient);

  emailSubjectInput = document.createElement("input");
  emailSubjectInput.type = "text";
  emailSubjectInput.required = true;
  emailSubjectInput.maxLength = 200;
  styleControl(emailSubjectInput);

  emailBodyInput = document.createElement("textarea");
  emailBodyInput.required = true;
  emailBodyInput.rows = 16;
  styleControl(emailBodyInput);

  emailBodyInput.style.resize = "vertical";
  emailBodyInput.style.minHeight = "240px";

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

  Object.assign(actions.style, {
    display: "flex",
    flexWrap: "wrap",
    gap: "10px"
  });

  const openButton = makeButton(
    "Open email draft",
    () => openPreparedEmail()
  );

  const copyButton = makeButton(
    "Copy message",
    () => copyPreparedEmail(),
    true
  );

  const cancelButton = makeButton(
    "Cancel",
    () => dialog.close(),
    true
  );

  actions.append(
    openButton,
    copyButton,
    cancelButton
  );

  form.append(
    createField("To", emailRecipient),
    createField("Subject", emailSubjectInput),
    createField("Message", emailBodyInput),
    emailFeedback,
    actions
  );

  dialog.append(
    heading,
    description,
    form
  );

  document.body.append(dialog);

  dialog.addEventListener("click", event => {
    if (event.target === dialog) {
      dialog.close();
    }
  });

  dialog.addEventListener("close", () => {
    activeEmailShopId = null;
  });

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

  activeEmailShopId = shop.id;

  emailRecipient.value =
    String(shop.email).trim();

  emailSubjectInput.value =
    EMAIL_SUBJECT;

  emailBodyInput.value =
    EMAIL_TEMPLATE;

  emailFeedback.textContent = "";

  emailDialog.showModal();

  emailSubjectInput.focus();
}

function getPreparedEmail() {
  if (!activeEmailShopId) {
    return null;
  }

  const shop = shops.find(
    item => item.id === activeEmailShopId
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
    email: String(shop.email).trim(),
    subject,
    body
  };
}

function openPreparedEmail() {
  const prepared = getPreparedEmail();

  if (!prepared) return;

  const mailto =
    `mailto:${encodeURIComponent(prepared.email)}` +
    `?subject=${encodeURIComponent(prepared.subject)}` +
    `&body=${encodeURIComponent(prepared.body)}`;

  /*
   * Mailto opens the user's configured email
   * application. It does not send the email.
   */
  window.location.href = mailto;

  emailFeedback.textContent =
    "Email draft requested. Review the message in your email application before sending.";
}

async function copyPreparedEmail() {
  const prepared = getPreparedEmail();

  if (!prepared) return;

  const text = [
    `To: ${prepared.email}`,
    `Subject: ${prepared.subject}`,
    "",
    prepared.body
  ].join("\n");

  try {
    await navigator.clipboard.writeText(text);

    emailFeedback.textContent =
      "Message copied to clipboard.";
  } catch {
    /*
     * Fallback for browsers where clipboard
     * permissions are unavailable.
     */
    emailBodyInput.focus();
    emailBodyInput.select();

    emailFeedback.textContent =
      "Clipboard access unavailable. The message has been selected so you can copy it manually.";
  }
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
  const params = new URLSearchParams({
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
   DISCOVERY DATASETS
========================================= */

function normaliseDatasetShop(shop, source) {
  const lat = Number(shop.lat);
  const lng = Number(shop.lng);

  return {
    osmId: String(shop.osmId || ""),
    name: String(shop.name || "").trim(),
    town: String(shop.town || "").trim(),
    address: String(shop.address || "").trim(),
    website: safeWebsite(shop.website),
    email: String(shop.email || "").trim(),
    lat,
    lng,
    source
  };
}

async function loadBookshopDataset() {
  if (bookshopDataset) {
    return bookshopDataset;
  }

  /*
   * Both files are loaded independently.
   * A failure in one source does not prevent
   * the other source from being searched.
   */
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

  const outcomes = await Promise.allSettled(
    sources.map(async entry => {
      const data = await fetchJSON(
        entry.url,
        { cache: "no-cache" }
      );

      if (!Array.isArray(data.shops)) {
        throw new Error(
          `Invalid bookshop data in ${entry.url}`
        );
      }

      return data.shops.map(shop =>
        normaliseDatasetShop(
          shop,
          entry.source
        )
      );
    })
  );

  const combined = [];
  const failures = [];

  outcomes.forEach((outcome, index) => {
    if (outcome.status === "fulfilled") {
      combined.push(...outcome.value);
    } else {
      failures.push(
        sources[index].url
      );

      console.error(
        `Unable to load ${sources[index].url}:`,
        outcome.reason
      );
    }
  });

  if (failures.length === sources.length) {
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
    partial: failures.length > 0
  };

  return bookshopDataset;
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

  return dataset.shops.filter(shop => {
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
  });
}

function mergeDiscoveredResults(results, fallbackTown) {
  /*
   * Curated entries take priority over
   * matching OpenStreetMap entries.
   */
  const ordered = [...results].sort((a, b) => {
    if (a.source === b.source) return 0;

    return a.source === "curated" ? -1 : 1;
  });

  const unique = [];

  for (const item of ordered) {
    const shop = {
      ...item,
      town: item.town || fallbackTown,
      address:
        item.address ||
        item.town ||
        fallbackTown
    };

    const existing = unique.find(other =>
      sameBookshop(other, shop)
    );

    if (!existing) {
      unique.push(shop);
      continue;
    }

    /*
     * Keep useful contact details when the
     * preferred record is missing them.
     */
    if (!existing.website && shop.website) {
      existing.website = shop.website;
    }

    if (!existing.email && shop.email) {
      existing.email = shop.email;
    }

    if (!existing.osmId && shop.osmId) {
      existing.osmId = shop.osmId;
    }
  }

  return unique.sort((a, b) =>
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
        [location.lat, location.lng],
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

    lastSearchTown = town;

    renderDiscovered();

    if (visibleDiscoveredShops().length) {
      fitMap(true);
    }

    updateDiscoveryFeedback();

    if (bookshopDataset?.partial) {
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

      if (visibleDiscoveredShops().length) {
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
