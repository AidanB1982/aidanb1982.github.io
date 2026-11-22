"use strict";

/*
 * Public, read-only bookshop finder.
 * It loads only data/public-bookshops.json, never Supabase, localStorage
 * or the private Bookshop Outreach application.
 */
(function () {
  const DATA_URL = "/data/public-bookshops.json";
  const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
  const MAX_CARDS = 36;
  const state = { shops: [], results: [], map: null, markers: null, searchId: 0 };
  const el = id => document.getElementById(id);

  function textElement(tag, text, className) {
    const node = document.createElement(tag);
    node.textContent = text;
    if (className) node.className = className;
    return node;
  }

  function safeWebsite(value) {
    if (typeof value !== "string" || !value.trim()) return null;
    try {
      const url = new URL(value);
      return ["https:", "http:"].includes(url.protocol) ? url.href : null;
    } catch {
      return null;
    }
  }

  function validShop(shop) {
    return shop &&
      typeof shop.name === "string" &&
      shop.name.trim().length > 0 &&
      Number.isFinite(shop.lat) && Number.isFinite(shop.lng) &&
      shop.lat >= 49 && shop.lat <= 61.5 &&
      shop.lng >= -9 && shop.lng <= 2.5;
  }

  function distanceMetres(a, b, lat, lng) {
    const rad = value => value * Math.PI / 180;
    const dLat = rad(lat - a);
    const dLng = rad(lng - b);
    const h = Math.sin(dLat / 2) ** 2 +
      Math.cos(rad(a)) * Math.cos(rad(lat)) * Math.sin(dLng / 2) ** 2;
    return 12742000 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
  }

  function createMap() {
    if (!window.L) {
      el("pb-map").textContent = "The map could not load. The bookshop directory remains available.";
      return;
    }
    state.map = L.map("pb-map", { scrollWheelZoom: false }).setView([56.2, -4.2], 6);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution: "&copy; OpenStreetMap contributors"
    }).addTo(state.map);
    state.markers = L.featureGroup().addTo(state.map);
    requestAnimationFrame(() => state.map.invalidateSize());
  }

  function makeWebsiteLink(shop) {
    const url = safeWebsite(shop.website);
    if (!url) return null;
    const link = textElement("a", "Visit bookshop website");
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    return link;
  }

  function makePopup(shop) {
    const box = textElement("div", "", "pb-popup");
    box.replaceChildren(textElement("strong", shop.name));
    if (shop.address || shop.town) box.append(textElement("p", shop.address || shop.town));
    const link = makeWebsiteLink(shop);
    if (link) box.append(link);
    return box;
  }

  function renderMarkers(results) {
    if (!state.map || !state.markers) return;
    state.markers.clearLayers();
    results.forEach(shop => {
      const marker = L.circleMarker([shop.lat, shop.lng], {
        radius: 7, weight: 2, color: "#f6e8cf",
        fillColor: "#b87333", fillOpacity: 0.9
      }).bindPopup(makePopup(shop));
      state.markers.addLayer(marker);
    });
    if (results.length) {
      state.map.fitBounds(state.markers.getBounds().pad(0.12), { maxZoom: 13 });
    } else {
      state.map.setView([56.2, -4.2], 6);
    }
  }

  function renderCards(results) {
    const wrap = el("pb-results");
    wrap.replaceChildren();
    el("pb-count").textContent = results.length
      ? results.length + " bookshop " + (results.length === 1 ? "listing" : "listings") +
        (results.length > MAX_CARDS ? " · showing the first " + MAX_CARDS : "")
      : "No matching bookshops found.";

    results.slice(0, MAX_CARDS).forEach(shop => {
      const card = textElement("article", "", "pb-card");
      card.replaceChildren(textElement("h3", shop.name));
      if (shop.address || shop.town) {
        card.append(textElement("p", shop.address || shop.town));
      }
      const actions = textElement("div", "", "pb-card-actions");
      const website = makeWebsiteLink(shop);
      if (website) actions.append(website);
      const view = textElement("button", "Show on map", "pb-card-map");
      view.type = "button";
      view.addEventListener("click", () => {
        if (!state.map || !state.markers) return;
        state.map.setView([shop.lat, shop.lng], 15);
        state.markers.eachLayer(layer => {
          const ll = layer.getLatLng();
          if (ll.lat === shop.lat && ll.lng === shop.lng) layer.openPopup();
        });
        el("pb-map").scrollIntoView({ behavior: "smooth", block: "center" });
      });
      actions.append(view);
      card.append(actions);
      wrap.append(card);
    });
  }

  function update(results, message) {
    state.results = results;
    renderCards(results);
    renderMarkers(results);
    el("pb-status").textContent = message;
  }

  function normalise(value) {
    return String(value || "").toLocaleLowerCase("en-GB").trim();
  }

  async function geocodeTown(query) {
    const url = new URL(NOMINATIM_URL);
    url.search = new URLSearchParams({
      q: query, format: "jsonv2", limit: "1", countrycodes: "gb",
      addressdetails: "0"
    }).toString();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) throw new Error("Place lookup unavailable");
      const data = await response.json();
      const first = Array.isArray(data) ? data[0] : null;
      if (!first) return null;
      const lat = Number(first.lat), lng = Number(first.lon);
      return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
    } finally {
      clearTimeout(timeout);
    }
  }

  async function search(event) {
    event.preventDefault();
    const query = el("pb-search").value.trim().slice(0, 120);
    const radius = Number(el("pb-radius").value);
    if (!query) {
      update(state.shops, "Showing all available bookshop listings in the Scotland-focused dataset.");
      return;
    }
    if (![10000, 25000, 50000].includes(radius)) return;
    const searchId = ++state.searchId;
    const lowered = normalise(query);
    const byName = state.shops.filter(shop => normalise(shop.name).includes(lowered));
    if (byName.length) {
      update(byName, "Found bookshops matching “" + query + "”.");
      return;
    }

    const submit = el("pb-search-form").querySelector('button[type="submit"]');
    submit.disabled = true;
    el("pb-status").textContent = "Searching near " + query + "…";
    let place = null;
    try {
      place = await geocodeTown(query);
    } catch (error) {
      console.warn("Public bookshop place lookup:", error);
    } finally {
      submit.disabled = false;
    }
    if (searchId !== state.searchId) return;
    if (place) {
      const nearby = state.shops.map(shop => ({
        shop, metres: distanceMetres(place.lat, place.lng, shop.lat, shop.lng)
      })).filter(item => item.metres <= radius).sort((a, b) => a.metres - b.metres)
        .map(item => item.shop);
      update(nearby, nearby.length
        ? "Bookshops within " + (radius / 1000) + " km of " + query + ". Please verify details before visiting."
        : "No cached bookshops found within " + (radius / 1000) + " km of " + query +
          ". Scotland-focused coverage is incomplete.");
      return;
    }
    const textMatches = state.shops.filter(shop =>
      normalise(shop.town + " " + shop.address).includes(lowered));
    update(textMatches, textMatches.length
      ? "Matches from the cached directory; place lookup was unavailable."
      : "No matching bookshops found. Try a nearby town or a larger search area.");
  }

  async function init() {
    el("pb-search-form").addEventListener("submit", search);
    el("pb-reset").addEventListener("click", () => {
      ++state.searchId;
      el("pb-search").value = "";
      update(state.shops, "Showing all available bookshop listings in the Scotland-focused dataset.");
    });
    createMap();
    try {
      const response = await fetch(DATA_URL, { cache: "no-cache" });
      if (!response.ok) throw new Error("The public bookshop directory is unavailable.");
      const data = await response.json();
      if (!Array.isArray(data.shops)) throw new Error("Invalid bookshop data.");
      state.shops = data.shops.filter(validShop);
      update(state.shops,
        state.shops.length + " bookshop listings in the Scotland-focused dataset loaded. This is a discovery guide, not a verified list of independent shops.");
    } catch (error) {
      el("pb-status").textContent = "We could not load the directory right now. Please try again later.";
      console.error("Public bookshop finder:", error);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
