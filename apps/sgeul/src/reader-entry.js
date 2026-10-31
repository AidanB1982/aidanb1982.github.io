import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { initialiseConnectivity } from "./connectivity.js";
await initialiseConnectivity();
window.__SGEUL_BUNDLED_READER__ = true;
const bar = document.createElement("nav");
bar.className = "sgeul-reader-bar";
bar.setAttribute("aria-label", "Sgeul");
bar.innerHTML =
  '<a href="/index.html">← Sgeul</a><span>Every Story Begins Somewhere</span>';
document.body.prepend(bar);
document.body.classList.add("sgeul-reader-page");
if (Capacitor.isNativePlatform())
  App.addListener("backButton", () => {
    const reader = document.getElementById("reader");
    if (reader && !reader.hidden)
      document.getElementById("back-to-library").click();
    else location.href = "/index.html";
  });
await import("sgeul-shared-reader");
