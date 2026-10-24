
"use strict";

import {
  createClient
} from "https://esm.sh/@supabase/supabase-js@2";

/* =====================================================
   BLACKWOOD PUBLISHING — BP READING
   Administrator testing edition
   EPUB.js reader with interactive page turning
   ===================================================== */

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

const PAGE_TURN_DURATION = 900;
const TOUCH_EDGE_FRACTION = 0.22;
const MOUSE_EDGE_FRACTION = 0.18;
const DRAG_START_DISTANCE = 9;
const DRAG_COMPLETE_FRACTION = 0.42;
const FLICK_VELOCITY = 0.55;

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

const reducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)"
);

function loadSavedState() {
  try {
    const value = JSON.parse(
      localStorage.getItem(STORAGE_KEY)
    );

    return value && typeof value === "object"
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

  fontSize: Number.isFinite(saved.fontSize)
    ? Math.max(15, Math.min(30, saved.fontSize))
    : 19,

  position:
    typeof saved.position === "string" &&
    saved.position.startsWith("epubcfi(")
      ? saved.position
      : null,

  progress: Number.isFinite(saved.progress)
    ? Math.max(0, Math.min(100, saved.progress))
    : 0,

  bookmarks: Array.isArray(saved.bookmarks)
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
  openingId: 0,

  gesture: null,
  suppressClickUntil: 0,
  turnSequence: 0
};

/* =====================================================
   GENERAL HELPERS
   ===================================================== */

function clamp(value, minimum, maximum) {
  return Math.max(
    minimum,
    Math.min(maximum, value)
  );
}

function delay(milliseconds) {
  return new Promise(resolve => {
    window.setTimeout(resolve, milliseconds);
  });
}

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

/* =====================================================
   LIBRARY
   ===================================================== */

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

  button.addEventListener(
    "click",
    () => void openBook()
  );

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

/* =====================================================
   ADMIN AUTHENTICATION
   ===================================================== */

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

/* =====================================================
   PROTECTED EPUB DELIVERY
   ===================================================== */

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
      // Keep generic error.
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

/* =====================================================
   READING THEMES
   ===================================================== */

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

/* =====================================================
   BOOKMARKS
   ===================================================== */

function getCurrentCfi() {
  return state.currentLocation?.start?.cfi ||
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

/* =====================================================
   READING PROGRESS
   ===================================================== */

function updateReaderProgress() {
  const location = state.currentLocation;

  if (!location) {
    $("reader-progress").textContent =
      "Preparing…";

    for (const id of [
      "previous",
      "next",
      "page-arrow-left",
      "page-arrow-right"
    ]) {
      $(id).disabled = true;
    }

    updateBookmarkButton();
    return;
  }

  const start = location.start || {};
  const displayed = start.displayed || {};

  const page = Number.isFinite(displayed.page)
    ? displayed.page
    : null;

  const total = Number.isFinite(displayed.total)
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
      state.progress = clamp(
        Math.round(fraction * 100),
        0,
        100
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

/* =====================================================
   PAGE-TURN VISUAL ENGINE

   Uses the existing decorative page-turn overlay.
   A finger drag controls the sheet rotation.
   EPUB navigation occurs only after commitment.
   ===================================================== */

function getPageTurnElements() {
  return {
    overlay: $("page-turn-overlay"),
    sheet: $("page-turn-sheet")
  };
}

function resetPageTurn() {
  const { overlay, sheet } =
    getPageTurnElements();

  overlay.hidden = true;

  overlay.classList.remove(
    "turn-next",
    "turn-prev",
    "turn-dragging"
  );

  sheet.style.transition = "";
  sheet.style.transform = "";
  sheet.style.opacity = "";
  sheet.style.transformOrigin = "";

  state.gesture = null;
}

function prepareTurnSheet(direction) {
  const { overlay, sheet } =
    getPageTurnElements();

  overlay.hidden = false;

  overlay.classList.remove(
    "turn-next",
    "turn-prev",
    "turn-dragging"
  );

  overlay.classList.add("turn-dragging");

  sheet.style.transition = "none";

  sheet.style.transformOrigin =
    direction > 0
      ? "left center"
      : "right center";

  sheet.style.transform = "rotateY(0deg)";
  sheet.style.opacity = "0.95";
}

function setTurnProgress(direction, progress) {
  const { sheet } = getPageTurnElements();

  const fraction = clamp(progress, 0, 1);

  const angle =
    (direction > 0 ? -180 : 180) * fraction;

  sheet.style.transform =
    `rotateY(${angle}deg)`;

  sheet.style.opacity = String(
    0.95 - fraction * 0.95
  );
}

async function settleTurnSheet(
  direction,
  startProgress,
  complete
) {
  if (reducedMotion.matches) {
    return;
  }

  const { sheet } = getPageTurnElements();

  const destination = complete ? 1 : 0;

  const remaining = Math.abs(
    destination - startProgress
  );

  const duration = clamp(
    Math.round(PAGE_TURN_DURATION * remaining),
    180,
    PAGE_TURN_DURATION
  );

  sheet.style.transition =
    `transform ${duration}ms cubic-bezier(.22,.7,.2,1), ` +
    `opacity ${duration}ms ease`;

  // Allow the browser to register the starting transform.
  void sheet.offsetWidth;

  setTurnProgress(direction, destination);

  await delay(duration + 30);
}

async function playPageTurn(direction) {
  if (reducedMotion.matches) {
    return;
  }

  prepareTurnSheet(direction);

  await settleTurnSheet(
    direction,
    0,
    true
  );
}

/* =====================================================
   PAGE NAVIGATION
   ===================================================== */

function canTurn(direction) {
  if (
    !state.rendition ||
    !state.isOpen ||
    state.isLoading ||
    state.isNavigating ||
    !state.currentLocation
  ) {
    return false;
  }

  if (
    direction > 0 &&
    state.currentLocation.atEnd === true
  ) {
    return false;
  }

  if (
    direction < 0 &&
    state.currentLocation.atStart === true
  ) {
    return false;
  }

  return true;
}

async function changePage(
  direction,
  options = {}
) {
  if (!canTurn(direction)) {
    resetPageTurn();
    return;
  }

  const openingId = state.openingId;
  const turnSequence = ++state.turnSequence;

  state.isNavigating = true;
  updateReaderProgress();

  const isCurrentTurn = () =>
    state.isOpen &&
    openingId === state.openingId &&
    turnSequence === state.turnSequence;

  try {
    if (options.fromGesture) {
      const progress = clamp(
        options.progress || 0,
        0,
        1
      );

      await settleTurnSheet(
        direction,
        progress,
        true
      );
    } else {
      await playPageTurn(direction);
    }

    if (!isCurrentTurn()) {
      return;
    }

    // The actual EPUB page advances only after
    // the visual turning sheet has completed.
    if (direction > 0) {
      await state.rendition.next();
    } else {
      await state.rendition.prev();
    }
  } catch (error) {
    if (isCurrentTurn()) {
      console.error(
        "Page navigation failed:",
        error
      );

      showStatus(
        "Unable to turn the page."
      );
    }
  } finally {
    if (isCurrentTurn()) {
      resetPageTurn();

      state.isNavigating = false;
      updateReaderProgress();
    }
  }
}

/* =====================================================
   TOUCH GESTURES

   The reader content is inside an EPUB.js iframe.
   We register handlers on each EPUB document.

   Only gestures starting near the page edges
   begin a physical page turn.

   Central text selection and ordinary links
   are left alone.
   ===================================================== */

function getReadingWidth() {
  return Math.max(
    1,
    $("epub-viewer").getBoundingClientRect().width
  );
}

function getPageDirection(
  x,
  width,
  pointerType
) {
  const fraction =
    pointerType === "mouse"
      ? MOUSE_EDGE_FRACTION
      : TOUCH_EDGE_FRACTION;

  if (x <= width * fraction) {
    return -1;
  }

  if (x >= width * (1 - fraction)) {
    return 1;
  }

  return 0;
}

function isInteractiveTarget(target) {
  if (!(target instanceof Element)) {
    return false;
  }

  return Boolean(
    target.closest(
      "a, button, input, textarea, select, " +
      "[contenteditable='true']"
    )
  );
}

function registerPageGestures(contents) {
  const doc = contents.document;

  if (!doc || doc.__bpReadingGesturesInstalled) {
    return;
  }

  doc.__bpReadingGesturesInstalled = true;

 
  const getCoordinates = event => {
    const width = Math.max(
      1,
      doc.documentElement.clientWidth ||
      doc.body?.clientWidth ||
      getReadingWidth()
    );
  
    return {
      x: event.clientX,
      y: event.clientY,
      width
    };
  };


  const begin = event => {
    if (
      !state.isOpen ||
      state.isLoading ||
      state.isNavigating ||
      state.gesture ||
      event.isPrimary === false ||
      (event.pointerType === "mouse" &&
        event.button !== 0)
    ) {
      return;
    }

    if (isInteractiveTarget(event.target)) {
      return;
    }

    const point = getCoordinates(event);

    const direction = getPageDirection(
      point.x,
      point.width,
      event.pointerType
    );

    if (!direction || !canTurn(direction)) {
      return;
    }

    // Mouse users click to turn pages.
    // Touch users drag the page.
    if (event.pointerType === "mouse") {
      return;
    }

    state.gesture = {
      pointerId: event.pointerId,
      direction,
      startX: point.x,
      startY: point.y,
      lastX: point.x,
      lastTime: performance.now(),
      velocity: 0,
      progress: 0,
      active: false,
      cancelled: false,
      width: point.width
    };
  };

  const move = event => {
    const gesture = state.gesture;

    if (
      !gesture ||
      event.pointerId !== gesture.pointerId
    ) {
      return;
    }

    const point = getCoordinates(event);

    const dx = point.x - gesture.startX;
    const dy = point.y - gesture.startY;

    const towardTurn =
      gesture.direction > 0
        ? -dx
        : dx;

    if (!gesture.active) {
      if (
        Math.abs(dx) < DRAG_START_DISTANCE &&
        Math.abs(dy) < DRAG_START_DISTANCE
      ) {
        return;
      }

      // Do not hijack predominantly vertical
      // movements or drags away from the page.
      if (
        Math.abs(dy) > Math.abs(dx) ||
        towardTurn <= 0
      ) {
        state.gesture = null;
        return;
      }

      gesture.active = true;

      prepareTurnSheet(
        gesture.direction
      );
    }

    if (event.cancelable) {
      event.preventDefault();
    }

    const now = performance.now();
    const elapsed = Math.max(
      1,
      now - gesture.lastTime
    );

    const movement =
      point.x - gesture.lastX;

    const signedMovement =
      gesture.direction > 0
        ? -movement
        : movement;

    const instantVelocity =
      signedMovement / elapsed;

    gesture.velocity =
      gesture.velocity * 0.65 +
      instantVelocity * 0.35;

    gesture.lastX = point.x;
    gesture.lastTime = now;

    gesture.progress = clamp(
      towardTurn / (gesture.width * 0.8),
      0,
      1
    );

    setTurnProgress(
      gesture.direction,
      gesture.progress
    );
  };

  const finish = async (
    event,
    cancelled = false
  ) => {
    const gesture = state.gesture;

    if (
      !gesture ||
      event.pointerId !== gesture.pointerId
    ) {
      return;
    }

    state.gesture = null;

    if (!gesture.active) {
      return;
    }

    state.suppressClickUntil =
      performance.now() + 500;

    const shouldComplete =
      !cancelled &&
      (
        gesture.progress >=
          DRAG_COMPLETE_FRACTION ||
        (
          gesture.progress >= 0.08 &&
          gesture.velocity >= FLICK_VELOCITY
        )
      );

    if (shouldComplete) {
      // The gesture no longer owns the pointer.
      // Navigation now owns the animation.
      await changePage(
        gesture.direction,
        {
          fromGesture: true,
          progress: gesture.progress
        }
      );
    } else {
      // Cancelled or insufficient drag:
      // gently return the sheet to its edge.
      state.isNavigating = true;
      updateReaderProgress();

      const openingId = state.openingId;
      const turnSequence = ++state.turnSequence;

      try {
        await settleTurnSheet(
          gesture.direction,
          gesture.progress,
          false
        );
      } finally {
        if (
          openingId === state.openingId &&
          turnSequence === state.turnSequence
        ) {
          resetPageTurn();

          state.isNavigating = false;
          updateReaderProgress();
        }
      }
    }
  };

  const click = event => {
    if (
      performance.now() <
      state.suppressClickUntil
    ) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if (
      !state.isOpen ||
      state.isNavigating ||
      isInteractiveTarget(event.target)
    ) {
      return;
    }

    // On laptops, clicking either edge turns
    // the page using the 900 ms animation.
    if (
      !window.matchMedia(
        "(hover: hover) and (pointer: fine)"
      ).matches
    ) {
      return;
    }

    const point = getCoordinates(event);

    const direction = getPageDirection(
      point.x,
      point.width,
      "mouse"
    );

    if (!direction || !canTurn(direction)) {
      return;
    }

    const selection =
      doc.getSelection?.()?.toString() || "";

    if (selection.trim()) {
      return;
    }

    event.preventDefault();

    void changePage(direction);
  };

  doc.addEventListener(
    "pointerdown",
    begin,
    { passive: true }
  );

  doc.addEventListener(
    "pointermove",
    move,
    { passive: false }
  );

  doc.addEventListener(
    "pointerup",
    event => {
      void finish(event);
    }
  );

  doc.addEventListener(
    "pointercancel",
    event => {
      void finish(event, true);
    }
  );

  doc.addEventListener(
    "click",
    click,
    true
  );

  doc.addEventListener(
    "keydown",
    event => {
      if (event.key === "Escape") {
        event.preventDefault();

        if (!$("reader-controls").hidden) {
          setControlsVisible(false);
        } else {
          closeBook();
        }
      }
    }
  );
}

/* =====================================================
   OPEN BOOK
   ===================================================== */

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

    // Register for each EPUB document as it loads.
    rendition.hooks.content.register(
      contents => {
        registerPageGestures(contents);
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

/* =====================================================
   CLOSE BOOK
   ===================================================== */

function closeBook() {
  ++state.openingId;
  ++state.turnSequence;

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

/* =====================================================
   BUTTON EVENTS
   ===================================================== */

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

/* =====================================================
   KEYBOARD
   ===================================================== */

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

/* =====================================================
   ADMIN GATE
   ===================================================== */

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
