
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

let STORAGE_KEY = "bp-reading-gualachulain-v1";

const PAGE_TURN_DURATION = 180;
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

const saved = {};

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
        appearance,
        bookmarkDetails,
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

let statusTimer;
function showStatus(message) {
  clearTimeout(statusTimer);
  $("reader-status").textContent = message;
  if (message) statusTimer = setTimeout(() => {$("reader-status").textContent = "";}, 6000);
}

function setControlsVisible(visible) {
  $("reading-scrubber").hidden = !visible;
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

  const details = document.createElement("div");
  details.className = "book-details";
  const eyebrow = document.createElement("p");
  eyebrow.className = "eyebrow";
  eyebrow.textContent = state.hasStarted ? "PICK UP WHERE YOU LEFT OFF" : "YOUR NEXT CHAPTER AWAITS";
  details.append(eyebrow, heading, description, progressLabel, track, button);
  card.append(cover, details);

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

  document.querySelector('.reading-column').style.maxWidth = appearance.width + 'px';
  state.rendition.themes.select(state.theme);
  state.rendition.themes.override('font-family', fontFamilies[appearance.font], true);
  state.rendition.themes.override('line-height', appearance.spacing, true);
  state.rendition.themes.override('text-align', appearance.alignment, true);

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

    label = `${state.progress}% complete${page && total ? ` · ${page}/${total} in chapter` : ""}`;
  } else if (
    page !== null &&
    total !== null
  ) {
    label = `Page ${page} of ${total}`;
  } else {
    label = "Reading";
  }

  $("reader-progress").textContent = label;
  $("quiet-percent").textContent = state.locationsReady ? `${state.progress}% complete` : label;
  $("quiet-chapter").textContent = chapterName(start.href);
  $("reader-seek").disabled = !state.locationsReady;
  $("reader-seek").value = state.progress;
  $("seek-value").value = state.progress + '%';

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
    if (appearance.motion === "instant" || reducedMotion.matches) {
      resetPageTurn();
    } else if (options.fromGesture) {
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

  // Browser deterrents only: screenshots and deliberate extraction cannot be blocked.
  // Scope to EPUB documents; library/search/settings keep normal clipboard access.
  for (const type of ["copy", "cut", "paste", "contextmenu"]) {
    doc.addEventListener(type, event => {
      event.preventDefault();
      showStatus("Copying from this reading edition is disabled.");
    }, true);
  }


 
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

    const selection = doc.getSelection?.()?.toString() || "";
    if (selection.trim()) return;
    const point = getCoordinates(event);

    const direction = getPageDirection(
      point.x,
      point.width,
      "mouse"
    );

    if (!direction) { setControlsVisible($("reader-controls").hidden); return; }
    if (!canTurn(direction)) return;

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
      handleReadingKeys(event);
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

    if (typeof window.ePub !== "function" || !window.JSZip) throw new Error("The reading engine could not load. Check your connection and reload this page.");
    const book = window.ePub(bytes);
    state.book = book;

    await book.ready;
    await book.loaded.navigation;
    if (openingId === state.openingId) renderContents();

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
  closePanel();
  if (document.fullscreenElement === $('reader')) void document.exitFullscreen().catch(() => {});
  ++searchVersion;
  $('search-results').replaceChildren();
  $('book-search-form').reset();
  $('search-status').textContent = '';
  previousPlace = null;
  $("return-position").hidden = true;
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

/* Reader workspace: device-local preferences and navigation. */
const fontFamilies = {
  literary: "Georgia, 'Times New Roman', serif",
  classic: "Palatino, 'Palatino Linotype', 'Book Antiqua', serif",
  clean: "Arial, Helvetica, sans-serif"
};
const appearance = {font: 'literary', spacing: '1.7', width: '760', alignment: 'left', motion: 'gentle'};
let bookmarkDetails = {};
let previousPlace = null;
let panelTrigger = null;
let chapterItems = [];
let searchVersion = 0;
function restorePreferences(stored) {
  state.theme = allowedThemes.includes(stored.theme) ? stored.theme : 'parchment';
  state.fontSize = Number.isFinite(stored.fontSize) ? clamp(stored.fontSize, 15, 30) : 19;
  state.position = typeof stored.position === 'string' && stored.position.startsWith('epubcfi(') ? stored.position : null;
  state.progress = Number.isFinite(stored.progress) ? clamp(stored.progress, 0, 100) : 0;
  state.bookmarks = Array.isArray(stored.bookmarks) ? stored.bookmarks.filter(c => typeof c === 'string' && c.startsWith('epubcfi(')) : [];
  state.hasStarted = stored.hasStarted === true;
  const options = {font: Object.keys(fontFamilies), spacing: ['1.5','1.7','1.9'], width: ['620','760','920'], alignment: ['left','justify'], motion: ['gentle','instant']};
  for (const key of Object.keys(options)) {
    if (options[key].includes(stored.appearance?.[key])) appearance[key] = stored.appearance[key];
  }
  bookmarkDetails = stored.bookmarkDetails && typeof stored.bookmarkDetails === 'object' && !Array.isArray(stored.bookmarkDetails) ? stored.bookmarkDetails : {};
  for (const [key, id] of Object.entries({font:'reader-font',spacing:'reader-spacing',width:'reader-width',alignment:'reader-alignment',motion:'reader-motion'})) $(id).value = appearance[key];
}
function chapterName(href = state.currentLocation?.start?.href) {
  const path = String(href || '').split('#')[0];
  return chapterItems.find(c => c.href.split('#')[0] === path)?.label || BOOK.title;
}
function closePanel() {
  if ($('reader-panel').open) {
    $('reader-panel').close();
    panelTrigger?.focus();
  }
}
function openPanel(kind, trigger) {
  if (!state.isOpen || state.isLoading) return;
  panelTrigger = trigger;
  for (const name of ['appearance','contents','bookmarks','search']) $('panel-' + name).hidden = name !== kind;
  $('reader-panel-title').textContent = {appearance:'Your perfect page',contents:'Inside this book',bookmarks:'Saved places',search:'Between the lines'}[kind];
  if (kind === 'bookmarks') renderBookmarks();
  if (kind === 'contents') {
    const current = String(state.currentLocation?.start?.href || '').split('#')[0];
    $('chapter-list').querySelectorAll('button').forEach((button, i) => {
      if (chapterItems[i]?.href.split('#')[0] === current) button.setAttribute('aria-current', 'location');
      else button.removeAttribute('aria-current');
    });
  }
  $('reader-panel').showModal();
  $('close-panel').focus();
}
function renderContents() {
  chapterItems = [];
  const list = $('chapter-list'); list.replaceChildren();
  function walk(items, depth = 0) {
    for (const item of items || []) {
      if (typeof item.href !== 'string') continue;
      const label = String(item.label || 'Untitled chapter').trim();
      chapterItems.push({href:item.href, label});
      const button = document.createElement('button'); button.type = 'button'; button.className = 'chapter-link'; button.textContent = label;
      button.style.paddingLeft = (16 + Math.min(depth, 5) * 16) + 'px';
      button.onclick = () => void jumpTo(item.href);
      list.append(button); walk(item.subitems, depth + 1);
    }
  }
  walk(state.book?.navigation?.toc);
  if (!chapterItems.length) list.textContent = 'This edition does not include a chapter list.';
}
async function jumpTo(target, remember = true) {
  if (!state.rendition || state.isNavigating || state.isLoading) return;
  const current = getCurrentCfi();
  const opening = state.openingId;
  state.isNavigating = true; updateReaderProgress();
  try {
    await state.rendition.display(target);
    if (opening !== state.openingId) return;
    if (remember && current) { previousPlace = current; $('return-position').hidden = false; }
    closePanel();
  } catch { showStatus('That place could not be opened. Your reading position has been kept.'); }
  finally { if (opening === state.openingId) {state.isNavigating = false; updateReaderProgress();} }
}
function renderBookmarks() {
  const list = $('bookmark-list'); list.replaceChildren();
  if (!state.bookmarks.length) {list.textContent = 'No saved places yet. Tap Bookmark while reading to keep a page here.'; return;}
  state.bookmarks.forEach((cfi, i) => {
    const row = document.createElement('div'); row.className = 'saved-place';
    const jump = document.createElement('button'); jump.type = 'button'; jump.className = 'chapter-link';
    const detail = bookmarkDetails[cfi];
    jump.textContent = typeof detail?.label === 'string' ? detail.label : `Saved place ${i + 1}`;
    const sub = document.createElement('small'); sub.textContent = typeof detail?.progress === 'number' ? `${detail.progress}% through the book` : 'Open this page'; jump.append(sub);
    jump.onclick = () => void jumpTo(cfi);
    const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'control'; remove.textContent = 'Remove'; remove.setAttribute('aria-label', 'Remove ' + jump.textContent);
    remove.onclick = () => {state.bookmarks = state.bookmarks.filter(c => c !== cfi); delete bookmarkDetails[cfi]; saveState(); updateBookmarkButton(); renderBookmarks();};
    row.append(jump, remove); list.append(row);
  });
}
function handleReadingKeys(event) {
  if (!state.isOpen || $('reader-panel').open || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || event.target?.closest?.('input,select,textarea,[contenteditable]')) return;
  if (['ArrowRight','PageDown','ArrowLeft','PageUp'].includes(event.key)) {
    event.preventDefault(); void changePage(['ArrowRight','PageDown'].includes(event.key) ? 1 : -1);
  }
}
for (const name of ['contents','appearance','bookmarks','search']) $('open-' + name).onclick = event => openPanel(name, event.currentTarget);
$('close-panel').onclick = closePanel;
$('reader-panel').addEventListener('click', event => {if (event.target === $('reader-panel')) {const r = event.target.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) closePanel();}});
for (const [key, id] of Object.entries({font:'reader-font',spacing:'reader-spacing',width:'reader-width',alignment:'reader-alignment',motion:'reader-motion'})) {
  $(id).onchange = () => {
    appearance[key] = $(id).value;
    applyReaderPreferences();
    if (key === 'width') state.rendition?.resize();
    saveState();
  };
}
$('book-search-form').onsubmit = async event => {
  event.preventDefault();
  const query = $('book-search').value.trim();
  if (query.length < 2 || !state.book || state.isLoading) return;
  const version = ++searchVersion;
  const book = state.book;
  const output = $('search-results'); output.replaceChildren();
  $('search-status').textContent = 'Searching your book…';
  let count = 0;
  try {
    // Search an independently loaded XML document without unloading visible content.
    for (const section of book.spine.spineItems) {
      if (version !== searchVersion || book !== state.book) return;
      const response = await book.load(section.url);
      if (version !== searchVersion || book !== state.book) return;
      const original = section.document;
      const originalContents = section.contents;
      let found;
      try {
        section.document = response;
        section.contents = response.documentElement;
        found = section.find(query);
      } finally {
        section.document = original;
        section.contents = originalContents;
      }
      for (const result of found) {
        if (count >= 100) break;
        const button = document.createElement('button'); button.type = 'button'; button.className = 'chapter-link';
        button.textContent = result.excerpt;
        button.onclick = () => void jumpTo(result.cfi);
        output.append(button); count++;
      }
      if (count >= 100) break;
    }
    if (version === searchVersion) $('search-status').textContent = count ? `${count === 100 ? 'First ' : ''}${count} matching passages` : 'No matching passages. Try another word or phrase.';
  } catch {
    if (version === searchVersion) $('search-status').textContent = 'Search could not finish. Please try again.';
  }
};
$('reader-fullscreen').onclick = async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if ($('reader').requestFullscreen) await $('reader').requestFullscreen();
    else showStatus('Full screen is not supported by this browser. The reader already fills your window.');
  } catch {showStatus('Full screen is unavailable in this browser.');}
};
document.addEventListener('fullscreenchange', () => {$('reader-fullscreen').textContent = document.fullscreenElement ? 'Exit full screen' : 'Full screen'; state.rendition?.resize();});
$('reader-seek').oninput = () => {$('seek-value').value = $('reader-seek').value + '%';};
$('reader-seek').onchange = () => {
  if (!state.locationsReady || !state.book) return;
  const target = state.book.locations.cfiFromPercentage(Number($('reader-seek').value) / 100);
  if (target) void jumpTo(target);
};
$('return-position').onclick = async () => {if (previousPlace) {await jumpTo(previousPlace, false); previousPlace = null; $('return-position').hidden = true;}};
$('bookmark').addEventListener('click', () => {
  const cfi = getCurrentCfi();
  if (cfi) {bookmarkDetails[cfi] = {label:chapterName(),progress:state.progress}; saveState();}
});
supabase.auth.onAuthStateChange(event => {
  if (event === 'SIGNED_OUT') {
    closeBook(); $('library').hidden = true; $('reader-access').hidden = false;
    $('access-message').textContent = 'Your session has ended. Sign in through The Archivists to continue.';
    state.bookmarks = []; bookmarkDetails = {}; $('chapter-list').replaceChildren(); $('bookmark-list').replaceChildren();
  }
});

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
    if (event.key === "Escape" && $("reader-panel").open) {
      event.preventDefault();
      closePanel();
      return;
    }
    handleReadingKeys(event);
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
    const user = await verifyBPReadingAdmin();
    STORAGE_KEY = `bp-reading:${user.id}:edition:${EDITION_ID}:v2`;
    const stored = loadSavedState();
    restorePreferences(stored);
    renderLibrary();
    $("reader-access").hidden = true;
    $("library").hidden = false;

    document.documentElement.classList.add(
      "bp-admin-verified"
    );
  } catch (error) {
    console.warn(
      "BP Reading access denied:",
      error.message
    );

    $("access-message").textContent = "Your library could not be opened. Sign in through The Archivists with an administrator account, then try again.";
  }
}

await initialise();
