
"use strict";

import {
  createClient
} from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL =
  "https://bmnlynjldlnxfvunqbqq.supabase.co";

const SUPABASE_ANON_KEY =
  "sb_publishable_eL7qdDe_6XWGhzmdsql_7w_7dg6psC0";

const EDITION_ID = 2;

const BOOK = {
  id: "BLACKWOOD-BOOK-001-EPUB",
  title: "Gualachulain",
  description:
    "Blackwood Publishing — administrator reading edition."
};

const STORAGE_KEY =
  "bp-reading-gualachulain-v1";

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

const $ = id => document.getElementById(id);

const allowedThemes = [
  "parchment",
  "day",
  "night"
];

const PAGE_TURN_DURATION = 520;

function loadSavedState() {
  try {
    const value = JSON.parse(
      localStorage.getItem(STORAGE_KEY)
    );

    return value &&
      typeof value === "object"
      ? value
      : {};
  } catch {
    return {};
  }
}

const saved = loadSavedState();

const state = {
  theme: allowedThemes.includes(saved.theme)
    ? saved.theme
    : "parchment",

  fontSize:
    Number.isFinite(saved.fontSize)
      ? Math.max(15, Math.min(30, saved.fontSize))
      : 19,

  position:
    typeof saved.position === "string" &&
    saved.position.startsWith("epubcfi(")
      ? saved.position
      : null,

  progress:
    Number.isFinite(saved.progress)
      ? Math.max(0, Math.min(100, saved.progress))
      : 0,

  bookmarks:
    Array.isArray(saved.bookmarks)
      ? saved.bookmarks.filter(
          value =>
            typeof value === "string" &&
            value.startsWith("epubcfi(")
        )
      : [],

  hasStarted: saved.hasStarted === true,

  isOpen: false,
  isLoading: false,
  isNavigating: false,

  book: null,
  rendition: null,
  currentCfi: null,
  currentLocation: null,
  locationsReady: false,
  openingId: 0
};

function saveState() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        theme: state.theme,
        fontSize: state.fontSize,
        position: state.position,
        progress: state.progress,
        bookmarks: state.bookmarks,
        hasStarted: state.hasStarted
      })
    );
  } catch {
    showStatus(
      "Unable to save reading progress on this device."
    );
  }
}

function showStatus(message) {
  $("reader-status").textContent = message;
}

function setControlsVisible(visible) {
  $("reader-controls").hidden = !visible;
  $("reader-bottom").hidden = !visible;

  $("reader-menu-toggle").setAttribute(
    "aria-expanded",
    String(visible)
  );
}

function showLibraryError(message) {
  const element = $("library-error");
  element.textContent = message;
  element.hidden = !message;
}

function renderLibrary() {
  const grid = $("book-grid");
  grid.replaceChildren();

  const card = document.createElement("article");
  card.className = "book-card";

  const cover = document.createElement("div");
  cover.className = "book-cover";

  const coverImage = document.createElement("img");
  coverImage.src = "/assets/book7.png";
  coverImage.alt = "Gualachulain book cover";
  coverImage.loading = "lazy";

  cover.appendChild(coverImage);

  const heading = document.createElement("h2");
  heading.textContent = BOOK.title;

  const description = document.createElement("p");
  description.className = "book-description";
  description.textContent = BOOK.description;

  const progressLabel = document.createElement("p");
  progressLabel.className = "progress-label";

  progressLabel.textContent = state.hasStarted
    ? `${state.progress}% complete`
    : "Not started";

  const track = document.createElement("div");
  track.className = "progress-track";

  const fill = document.createElement("div");
  fill.className = "progress-fill";
  fill.style.width = `${state.progress}%`;

  track.appendChild(fill);

  const button = document.createElement("button");
  button.type = "button";
  button.className = "open-book";

  button.textContent = state.isLoading
    ? "Opening…"
    : state.hasStarted
      ? "Continue Reading"
      : "Read Book";

  button.disabled = state.isLoading;

  button.addEventListener("click", openBook);

  card.append(
    cover,
    heading,
    description,
    progressLabel,
    track,
    button
  );

  grid.appendChild(card);
}

/* ADMIN AUTHENTICATION */

async function verifyBPReadingAdmin() {
  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("Authentication required");
  }

  const {
    data: profile,
    error: profileError
  } = await supabase
    .from("member_profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (
    profileError ||
    profile?.is_admin !== true
  ) {
    throw new Error(
      "Administrator access required"
    );
  }

  return user;
}

/* PROTECTED EPUB DELIVERY */

async function fetchProtectedEpub() {
  const {
    data: { session },
    error: sessionError
  } = await supabase.auth.getSession();

  if (
    sessionError ||
    !session?.access_token
  ) {
    throw new Error(
      "Your session has expired. Please sign in again."
    );
  }

  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/bp-reading-deliver-epub`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization":
          `Bearer ${session.access_token}`,
        "apikey": SUPABASE_ANON_KEY
      },
      body: JSON.stringify({
        editionId: EDITION_ID
      }),
      cache: "no-store"
    }
  );

  if (!response.ok) {
    let message =
      "The reading edition could not be loaded.";

    try {
      const payload = await response.json();

      if (typeof payload.error === "string") {
        message = payload.error;
      }
    } catch {
      // Preserve generic message.
    }

    throw new Error(message);
  }

  const contentType =
    response.headers.get("Content-Type") || "";

  if (
    !contentType.includes("application/epub+zip")
  ) {
    throw new Error(
      "The server returned an unexpected file type."
    );
  }

  const bytes = await response.arrayBuffer();

  const signature = new Uint8Array(
    bytes,
    0,
    Math.min(4, bytes.byteLength)
  );

  const validZip =
    signature.length === 4 &&
    signature[0] === 0x50 &&
    signature[1] === 0x4b &&
    signature[2] === 0x03 &&
    signature[3] === 0x04;

  if (!validZip) {
    throw new Error(
      "The returned file is not a valid EPUB archive."
    );
  }

  return bytes;
}

/* READING THEMES */

function registerThemes(rendition) {
  rendition.themes.register(
    "parchment",
    {
      body: {
        background: "#eee0c5 !important",
        color: "#30271f !important",
        "font-family":
          "Georgia, 'Times New Roman', serif !important",
        "line-height": "1.85 !important"
      }
    }
  );

  rendition.themes.register(
    "day",
    {
      body: {
        background: "#fffdf7 !important",
        color: "#242424 !important",
        "font-family":
          "Georgia, 'Times New Roman', serif !important",
        "line-height": "1.85 !important"
      }
    }
  );

  rendition.themes.register(
    "night",
    {
      body: {
        background: "#201c1a !important",
        color: "#e9dfd2 !important",
        "font-family":
          "Georgia, 'Times New Roman', serif !important",
        "line-height": "1.85 !important"
      }
    }
  );
}

function applyReaderPreferences() {
  $("reader").dataset.theme = state.theme;
  $("reading-theme").value = state.theme;

  if (!state.rendition) {
    return;
  }

  state.rendition.themes.select(state.theme);

  state.rendition.themes.fontSize(
    `${Math.round(
      state.fontSize / 19 * 100
    )}%`
  );
}

/* BOOKMARKS */

function getCurrentCfi() {
  const location = state.currentLocation;

  return location?.start?.cfi ||
    state.currentCfi ||
    null;
}

function updateBookmarkButton() {
  const current = getCurrentCfi();

  const bookmarked =
    current !== null &&
    state.bookmarks.includes(current);

  $("bookmark").textContent = bookmarked
    ? "★ Bookmarked"
    : "☆ Bookmark";

  $("bookmark").setAttribute(
    "aria-pressed",
    String(bookmarked)
  );

  $("bookmark").disabled = !current;
}

/* READING PROGRESS */

function updateReaderProgress() {
  const location = state.currentLocation;

  if (!location) {
    $("reader-progress").textContent =
      "Preparing…";

    $("previous").disabled = true;
    $("next").disabled = true;
    $("page-arrow-left").disabled = true;
    $("page-arrow-right").disabled = true;

    updateBookmarkButton();
    return;
  }

  const start = location.start || {};
  const displayed = start.displayed || {};

  const page =
    Number.isFinite(displayed.page)
      ? displayed.page
      : null;

  const total =
    Number.isFinite(displayed.total)
      ? displayed.total
      : null;

  let label = "";

  if (
    state.locationsReady &&
    state.book &&
    typeof start.cfi === "string"
  ) {
    const fraction =
      state.book.locations.percentageFromCfi(
        start.cfi
      );

    if (Number.isFinite(fraction)) {
      state.progress = Math.max(
        0,
        Math.min(
          100,
          Math.round(fraction * 100)
        )
      );
    }

    label = `${state.progress}% complete`;
  } else if (
    page !== null &&
    total !== null
  ) {
    label = `Page ${page} of ${total}`;
  } else {
    label = "Reading";
  }

  $("reader-progress").textContent = label;

  const previousDisabled =
    state.isNavigating ||
    location.atStart === true;

  const nextDisabled =
    state.isNavigating ||
    location.atEnd === true;

  $("previous").disabled = previousDisabled;
  $("next").disabled = nextDisabled;

  $("page-arrow-left").disabled =
    previousDisabled;

  $("page-arrow-right").disabled =
    nextDisabled;

  updateBookmarkButton();
}

function handleRelocation(location) {
  if (!state.isOpen) {
    return;
  }

  const cfi = location?.start?.cfi;

  if (
    typeof cfi !== "string" ||
    !cfi.startsWith("epubcfi(")
  ) {
    return;
  }

  state.currentLocation = location;
  state.currentCfi = cfi;
  state.position = cfi;
  state.hasStarted = true;

  updateReaderProgress();
  saveState();
}

async function prepareLocations(book, openingId) {
  try {
    await book.locations.generate(1024);

    if (
      openingId !== state.openingId ||
      !state.isOpen ||
      state.book !== book
    ) {
      return;
    }

    state.locationsReady = true;

    updateReaderProgress();
    saveState();
    renderLibrary();
  } catch (error) {
    console.warn(
      "EPUB percentage calculation unavailable:",
      error
    );
  }
}

/* PAGE-TURN ANIMATION */

function playPageTurn(direction) {
  const overlay = $("page-turn-overlay");

  if (
    window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches
  ) {
    return Promise.resolve();
  }

  overlay.classList.remove(
    "turn-next",
    "turn-prev"
  );

  overlay.hidden = false;

  // Force reflow so consecutive animations restart.
  void overlay.offsetWidth;

  overlay.classList.add(
    direction > 0
      ? "turn-next"
      : "turn-prev"
  );

  return new Promise(resolve => {
    window.setTimeout(() => {
      overlay.classList.remove(
        "turn-next",
        "turn-prev"
      );

      overlay.hidden = true;
      resolve();
    }, PAGE_TURN_DURATION);
  });
}

function resetPageTurn() {
  const overlay = $("page-turn-overlay");

  overlay.classList.remove(
    "turn-next",
    "turn-prev"
  );

  overlay.hidden = true;
}

/* OPEN BOOK */

async function openBook() {
  if (
    state.isLoading ||
    state.isOpen
  ) {
    return;
  }

  if (
    typeof window.ePub !== "function" ||
    typeof window.JSZip === "undefined"
  ) {
    showLibraryError(
      "The EPUB reading library could not load. " +
      "Please refresh the page and try again."
    );
    return;
  }

  state.isLoading = true;
  state.isOpen = true;
  state.locationsReady = false;
  state.currentLocation = null;
  state.currentCfi = null;

  const openingId = ++state.openingId;

  showLibraryError("");
  renderLibrary();

  $("library").hidden = true;
  $("reader").hidden = false;

  $("reader-loading").hidden = false;
  $("reader-loading").textContent =
    "Preparing your book…";

  $("epub-viewer").hidden = true;
  $("reader-page-arrows").hidden = true;
  $("reader-menu-toggle").hidden = true;

  resetPageTurn();
  setControlsVisible(false);
  showStatus("");

  try {
    const bytes = await fetchProtectedEpub();

    if (openingId !== state.openingId) {
      return;
    }

    $("reader-loading").textContent =
      "Opening Gualachulain…";

    const book = window.ePub(bytes);
    state.book = book;

    await book.ready;

    if (openingId !== state.openingId) {
      return;
    }

    $("epub-viewer").hidden = false;

    const rendition = book.renderTo(
      "epub-viewer",
      {
        width: "100%",
        height: "100%",
        manager: "default",
        flow: "paginated",
        spread: "none"
      }
    );

    state.rendition = rendition;

    registerThemes(rendition);
    applyReaderPreferences();

    rendition.on(
      "relocated",
      handleRelocation
    );

    rendition.on(
      "displayError",
      error => {
        console.error(
          "EPUB display error:",
          error
        );

        showStatus(
          "A book page could not be displayed."
        );
      }
    );

    rendition.hooks.content.register(
      contents => {
        contents.document.addEventListener(
          "keydown",
          event => {
            if (event.key === "Escape") {
              event.preventDefault();

              if (
                !$("reader-controls").hidden
              ) {
                setControlsVisible(false);
              } else {
                closeBook();
              }
            }
          }
        );
      }
    );

    const savedPosition = state.position;

    try {
      await rendition.display(
        savedPosition || undefined
      );
    } catch (error) {
      if (!savedPosition) {
        throw error;
      }

      console.warn(
        "Saved position unavailable; opening start:",
        error
      );

      state.position = null;
      await rendition.display();
    }

    if (openingId !== state.openingId) {
      return;
    }

    $("reader-loading").hidden = true;

    state.isLoading = false;
    state.hasStarted = true;

    $("reader-page-arrows").hidden = false;
    $("reader-menu-toggle").hidden = false;

    updateReaderProgress();
    saveState();
    renderLibrary();

    void prepareLocations(
      book,
      openingId
    );
  } catch (error) {
    if (openingId !== state.openingId) {
      return;
    }

    console.error(
      "BP Reading failed to open EPUB:",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : "An unexpected reading error occurred.";

    closeBook();

    showLibraryError(
      `Unable to open Gualachulain: ${message}`
    );
  } finally {
    if (openingId === state.openingId) {
      state.isLoading = false;
      renderLibrary();
    }
  }
}

/* CLOSE BOOK */

function closeBook() {
  ++state.openingId;

  state.isOpen = false;
  state.isLoading = false;
  state.isNavigating = false;
  state.locationsReady = false;
  state.currentLocation = null;
  state.currentCfi = null;

  resetPageTurn();

  if (state.rendition) {
    try {
      state.rendition.destroy();
    } catch (error) {
      console.warn(
        "Reader cleanup warning:",
        error
      );
    }
  }

  state.rendition = null;

  if (state.book) {
    try {
      state.book.destroy();
    } catch (error) {
      console.warn(
        "EPUB cleanup warning:",
        error
      );
    }
  }

  state.book = null;

  $("epub-viewer").replaceChildren();
  $("epub-viewer").hidden = true;

  $("reader-page-arrows").hidden = true;
  $("reader-menu-toggle").hidden = true;

  $("reader").hidden = true;
  $("library").hidden = false;

  setControlsVisible(false);
  showStatus("");

  saveState();
  renderLibrary();
}

/* PAGE NAVIGATION */

async function changePage(direction) {
  if (
    !state.rendition ||
    state.isNavigating ||
    state.isLoading ||
    !state.isOpen
  ) {
    return;
  }

  const location = state.currentLocation;

  if (
    (direction > 0 && location?.atEnd) ||
    (direction < 0 && location?.atStart)
  ) {
    return;
  }

  state.isNavigating = true;
  updateReaderProgress();

  try {
    // Animate and navigate together.
    await Promise.all([
      playPageTurn(direction),

      direction > 0
        ? state.rendition.next()
        : state.rendition.prev()
    ]);
  } catch (error) {
    console.error(
      "Page navigation failed:",
      error
    );

    showStatus(
      "Unable to turn the page."
    );
  } finally {
    resetPageTurn();

    state.isNavigating = false;
    updateReaderProgress();
  }
}

/* BUTTON EVENTS */

$("back-to-library").addEventListener(
  "click",
  closeBook
);

$("previous").addEventListener(
  "click",
  () => void changePage(-1)
);

$("next").addEventListener(
  "click",
  () => void changePage(1)
);

$("page-arrow-left").addEventListener(
  "click",
  () => void changePage(-1)
);

$("page-arrow-right").addEventListener(
  "click",
  () => void changePage(1)
);

$("reader-menu-toggle").addEventListener(
  "click",
  () => {
    setControlsVisible(
      $("reader-controls").hidden
    );
  }
);

$("font-smaller").addEventListener(
  "click",
  () => {
    state.fontSize = Math.max(
      15,
      state.fontSize - 1
    );

    saveState();
    applyReaderPreferences();

    showStatus(
      `Text size: ${state.fontSize}px`
    );
  }
);

$("font-larger").addEventListener(
  "click",
  () => {
    state.fontSize = Math.min(
      30,
      state.fontSize + 1
    );

    saveState();
    applyReaderPreferences();

    showStatus(
      `Text size: ${state.fontSize}px`
    );
  }
);

$("reading-theme").addEventListener(
  "change",
  event => {
    const requested = event.target.value;

    if (!allowedThemes.includes(requested)) {
      return;
    }

    state.theme = requested;

    saveState();
    applyReaderPreferences();

    showStatus(
      `Theme: ${requested}`
    );
  }
);

$("bookmark").addEventListener(
  "click",
  () => {
    const cfi = getCurrentCfi();

    if (!cfi) {
      showStatus(
        "Reading position is not ready."
      );
      return;
    }

    const existing =
      state.bookmarks.indexOf(cfi);

    if (existing >= 0) {
      state.bookmarks.splice(
        existing,
        1
      );

      showStatus(
        "Bookmark removed."
      );
    } else {
      state.bookmarks.push(cfi);

      showStatus(
        "Page bookmarked."
      );
    }

    saveState();
    updateBookmarkButton();
  }
);

/* KEYBOARD */

document.addEventListener(
  "keydown",
  event => {
    if (!state.isOpen) {
      return;
    }

    if (event.key === "Escape") {
      if (!$("reader-controls").hidden) {
        setControlsVisible(false);
      } else {
        closeBook();
      }
    }
  }
);

/* ADMIN GATE */

async function initialise() {
  renderLibrary();

  try {
    await verifyBPReadingAdmin();

    document.documentElement.classList.add(
      "bp-admin-verified"
    );
  } catch (error) {
    console.warn(
      "BP Reading access denied:",
      error.message
    );

    window.location.replace(
      "/pages/members.html"
    );
  }
}

await initialise();
