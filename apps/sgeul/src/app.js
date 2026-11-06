import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { client } from "./client.js";
import { createLoginLoading } from "./login-loading.js";
import { startAtmosphere } from "../../../js/BP-reading-atmosphere.js";
import { OfflineLibrary } from "../../../js/BP-reading-offline.js";
import { loadShop } from "./shop.js";
import { isOnline, initialiseConnectivity } from "./connectivity.js";
const $ = (id) => document.getElementById(id),
  offline = new OfflineLibrary();
const loginLoading = createLoginLoading($("auth-loading"), [
  $("app"),
  document.querySelector(".app-nav"),
]);
const atmosphere = startAtmosphere($("home"));
window.addEventListener("pagehide", (event) => {
  if (!event.persisted) atmosphere.destroy();
});
let connectivityReady = false;
let user = null,
  view = "home",
  busy = false,
  epoch = 0;
export async function openExternal(value) {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    ![
      "blackwoodpublishing.co.uk",
      "vmbd0z-c6.myshopify.com",
      "www.facebook.com",
      "www.instagram.com",
      "www.tiktok.com",
    ].includes(url.hostname)
  )
    throw Error("This link is unavailable.");
  if (Capacitor.isNativePlatform()) await Browser.open({ url: url.href });
  else window.open(url.href, "_blank", "noopener,noreferrer");
}
function showView(next) {
  view = next;
  for (const name of ["home", "shop", "account"])
    $(name).hidden = !user || name !== next;
  $("sign-in").hidden = Boolean(user);
  document.querySelectorAll("[data-view]").forEach((button) => {
    if (button.dataset.view === next)
      button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  if (user && next === "shop") void loadShop(openExternal);
}
function connection() {
  $("connection").hidden = isOnline();
}
async function loadAccount() {
  if (!connectivityReady) return;
  const current = ++epoch;
  if (isOnline()) {
    const { data, error } = await client.auth.getSession();
    if (current !== epoch) return;
    if (error) throw error;
    user = data.session?.user || null;
  } else {
    // An expired online JWT must not prevent opening an unexpired device copy.
    // This identity is for local navigation only; the reader checks its own saved lease.
    try {
      const cached = JSON.parse(
        localStorage.getItem("sb-bmnlynjldlnxfvunqbqq-auth-token") || "null",
      );
      user =
        cached?.user?.id ===
        localStorage.getItem("bp-reading-offline-account-v1")
          ? cached.user
          : null;
    } catch {
      user = null;
    }
  }
  $("startup-status").hidden = true;
  if (!user) {
    showView("home");
    return;
  }
  $("account-email").textContent = user.email || "";
  $("reader-name").textContent = "";
  showView(view);
  if (busy)
    loginLoading.update(
      "Opening your reading room",
      "Preparing your library and assigned stories.",
    );
  $("arc-entry").hidden = true;
  const saved = await offline.list(user.id).catch(() => []);
  if (current !== epoch) return;
  renderSavedBooks(saved);
  if (!isOnline()) {
    const count = saved.filter((row) => row.book.arcAssignmentId).length;
    $("arc-entry").hidden = !count;
    $("arc-summary").textContent =
      count + " saved ARC " + (count === 1 ? "copy" : "copies");
    $("home-status").textContent =
      "Open the library to read copies saved on this device.";
    return;
  }
  try {
    const { data: rows, error } = await client.rpc("bp_arc_reading_catalogue");
    if (current !== epoch) return;
    if (error) throw error;
    $("arc-entry").hidden = !rows?.length;
    $("arc-summary").textContent =
      (rows || []).filter((row) => row.can_read).length +
      " assigned " +
      ((rows || []).filter((row) => row.can_read).length === 1
        ? "book"
        : "books") +
      " ready to read.";
    $("home-status").textContent =
      "Your library checks access when you open it.";
  } catch {
    if (current === epoch)
      $("home-status").textContent =
        "ARC assignments could not be checked. Reconnect and try again.";
  }
}
function renderSavedBooks(rows) {
  const section = $("saved-books"),
    list = $("saved-book-list");
  list.replaceChildren();
  section.hidden = !rows.length;
  for (const row of rows) {
    const link = document.createElement("a");
    link.className = "saved-book";
    link.href =
      "/pages/bp-reading.html" + (row.book.arcAssignmentId ? "?arc=1" : "");
    const title = document.createElement("strong"),
      detail = document.createElement("span");
    title.textContent = row.book.title;
    detail.textContent =
      (row.book.arcAssignmentId ? "ARC room" : "Library") +
      " · saved until " +
      new Date(row.expiresAt).toLocaleDateString("en-GB");
    link.append(title, detail);
    list.append(link);
  }
}
$("login-form").onsubmit = async (event) => {
  event.preventDefault();
  if (busy) return;
  if (!isOnline()) {
    $("login-status").textContent = "Connect to the internet to sign in.";
    return;
  }
  busy = true;
  $("login-button").disabled = true;
  $("login-status").textContent = "Signing in…";
  loginLoading.start("Signing you in", "Checking your Blackwood account.");
  try {
    const form = new FormData(event.currentTarget);
    const { error } = await client.auth.signInWithPassword({
      email: String(form.get("email")).trim(),
      password: String(form.get("password")),
    });
    if (error) throw error;
    event.target.reset();
    $("login-status").textContent = "";
    await loadAccount();
  } catch {
    $("login-status").textContent =
      "Sign-in failed. Check your email and password, then try again.";
  } finally {
    busy = false;
    $("login-button").disabled = false;
    loginLoading.finish();
  }
};
$("sign-out").onclick = async () => {
  if (busy || !user) return;
  busy = true;
  $("sign-out").disabled = true;
  const previous = user.id;
  try {
    await offline.clear(previous);
    for (const key of Object.keys(localStorage))
      if (key.startsWith("bp-reading:" + previous + ":"))
        localStorage.removeItem(key);
    localStorage.removeItem("bp-reading-offline-account-v1");
    if (!isOnline()) {
      client.auth.stopAutoRefresh();
      localStorage.removeItem("sb-bmnlynjldlnxfvunqbqq-auth-token");
      location.replace("/index.html");
      return;
    }
    const { error } = await client.auth.signOut({ scope: "local" });
    if (error) throw error;
    user = null;
    await loadAccount();
  } catch {
    $("account-status").textContent =
      "Could not finish signing out. Please try again.";
  } finally {
    busy = false;
    $("sign-out").disabled = false;
  }
};
$("password-help").onclick = () => {
  void openExternal(
    "https://blackwoodpublishing.co.uk/pages/members.html?reset-password=1",
  );
};
document
  .querySelectorAll("[data-view]")
  .forEach((button) => (button.onclick = () => showView(button.dataset.view)));
document
  .querySelectorAll("[data-external]")
  .forEach(
    (button) =>
      (button.onclick = () => void openExternal(button.dataset.external)),
  );
window.addEventListener("offline", () => {
  connection();
  if (!busy) refreshAccount();
});
window.addEventListener("online", () => {
  connection();
  if (!busy) refreshAccount();
});
function refreshAccount() {
  void loadAccount().catch(() => {
    $("home-status").textContent =
      "Your account could not be refreshed. Reconnect and try again.";
  });
}
client.auth.onAuthStateChange(() => {
  // Explicit sign-in/startup already owns its account load and loading screen.
  if (busy || !connectivityReady) return;
  setTimeout(refreshAccount, 0);
});
if (Capacitor.isNativePlatform())
  App.addListener("backButton", () => {
    if (view !== "home") showView("home");
    else void App.minimizeApp();
  });
showView("home");
busy = true;
$("login-button").disabled = true;
loginLoading.start("Opening Sgeul", "Preparing your reading room.");
try {
  await initialiseConnectivity();
  connectivityReady = true;
  connection();
  await loadAccount();
} catch {
  $("startup-status").hidden = false;
  $("startup-status").textContent =
    "Your reading room could not finish loading. Check your connection and try signing in.";
  showView("home");
} finally {
  busy = false;
  $("login-button").disabled = false;
  loginLoading.finish();
}
