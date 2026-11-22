"use strict";

/*
 * Lightweight, dependency-free map clustering for the public bookshop finder.
 * Grouping uses Leaflet's world-pixel coordinates at the current zoom, not
 * viewport pixels: dragging the map does not move listings between clusters.
 * No private outreach fields are read or transmitted.
 */
(function (root) {
  function groupShops(shops, project, zoom, options) {
    const cellSize = Number(options?.cellSize) || 76;
    const revealZoom = Number(options?.revealZoom) || 15;
    if (!Array.isArray(shops) || !shops.length) return [];

    // Individual shops become directly clickable at street-level zoom.
    if (zoom >= revealZoom) {
      return shops.map(shop => ({
        shops: [shop], count: 1, lat: shop.lat, lng: shop.lng
      }));
    }

    const cells = new Map();
    for (const shop of shops) {
      const point = project(shop.lat, shop.lng, zoom);
      if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) continue;

      const key = Math.floor(point.x / cellSize) + ":" +
        Math.floor(point.y / cellSize);
      let cell = cells.get(key);
      if (!cell) {
        cell = {shops: [], sumLat: 0, sumLng: 0};
        cells.set(key, cell);
      }
      cell.shops.push(shop);
      cell.sumLat += shop.lat;
      cell.sumLng += shop.lng;
    }

    return Array.from(cells.values(), cell => ({
      shops: cell.shops,
      count: cell.shops.length,
      lat: cell.sumLat / cell.shops.length,
      lng: cell.sumLng / cell.shops.length
    }));
  }

  if (root) root.BlackwoodBookshopGrid = Object.freeze({groupShops});
})(typeof window === "undefined" ? null : window);
