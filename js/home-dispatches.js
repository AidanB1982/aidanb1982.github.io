/* Homepage dispatches stay public, even when this browser has an admin session. */
(() => {
  "use strict";
  const section = document.getElementById("home-dispatches");
  if (!section) return;
  const grid = section.querySelector("[data-dispatch-grid]");
  const status = section.querySelector("[data-dispatch-status]");
  const summary = section.querySelector("[data-dispatch-summary]");
  const count = section.querySelector("[data-dispatch-count]");
  const toggle = section.querySelector("[data-dispatch-toggle]");
  const content = document.getElementById("home-dispatch-content");
  const retry = section.querySelector("[data-dispatch-retry]");
  const dialog = document.getElementById("home-dispatch-dialog");
  const heading = dialog.querySelector("[data-dispatch-title]");
  const meta = dialog.querySelector("[data-dispatch-meta]");
  const body = dialog.querySelector("[data-dispatch-body]");
  let request,
    requestNumber = 0,
    returnFocus;

  const text = (tag, value, className) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    node.textContent = value;
    return node;
  };
  function date(value) {
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "Europe/London",
    }).format(new Date(value));
  }
  function imagePath(value) {
    try {
      const url = new URL(String(value || ""), location.origin);
      const firstParty =
        url.origin === location.origin ||
        [
          "https://blackwoodpublishing.co.uk",
          "https://www.blackwoodpublishing.co.uk",
        ].includes(url.origin);
      if (
        firstParty &&
        url.pathname.startsWith("/assets/") &&
        !url.username &&
        !url.password
      )
        return url.href;
    } catch {
      /* Use the existing local archive artwork. */
    }
    return "/assets/ArchiveFilesBG.png";
  }
  function open(post, trigger) {
    returnFocus = trigger;
    heading.textContent = post.title;
    meta.textContent = [post.category, date(post.publishedAt), "Public update"]
      .filter(Boolean)
      .join(" · ");
    body.replaceChildren();
    for (const paragraph of String(post.body || post.excerpt || "").split(
      /\n\s*\n/
    )) {
      if (paragraph.trim()) body.append(text("p", paragraph.trim()));
    }
    dialog.showModal();
    dialog.querySelector("[data-dispatch-close]").focus();
  }
  function carousel(posts) {
    let index = 0;
    const article = document.createElement("article");
    article.className = "home-dispatch-carousel";
    const artwork = document.createElement("div");
    artwork.className = "home-dispatch-carousel__image";
    const image = document.createElement("img");
    image.width = 880;
    image.height = 640;
    image.alt = "";
    image.loading = "lazy";
    image.addEventListener("error", () => {
      image.hidden = true;
    });
    artwork.append(image);
    const copy = document.createElement("div");
    copy.className = "home-dispatch-carousel__copy";
    const metadata = document.createElement("div");
    metadata.className = "home-dispatch-carousel__meta";
    const category = text("span", ""),
      time = text("time", ""),
      audience = text("span", "Public update"),
      pinned = text("span", "Pinned");
    pinned.dataset.dispatchPinned = "";
    metadata.append(category, time, audience, pinned);
    const title = text("h3", ""),
      excerpt = text("p", "", "home-dispatch-carousel__excerpt");
    const controls = document.createElement("div");
    controls.className = "home-dispatch-carousel__controls";
    const previous = text("button", "<", "home-dispatch-carousel__control");
    const action = text("button", "Read File", "home-dispatch-carousel__read");
    const next = text("button", ">", "home-dispatch-carousel__control");
    previous.setAttribute("aria-label", "Previous public update");
    next.setAttribute("aria-label", "Next public update");
    for (const button of [previous, action, next]) button.type = "button";
    previous.disabled = next.disabled = posts.length < 2;
    const position = text("p", "", "home-dispatch-carousel__position");
    position.setAttribute("role", "status");
    position.setAttribute("aria-live", "polite");
    position.setAttribute("aria-atomic", "true");
    controls.append(previous, action, next);
    copy.append(metadata, title, excerpt, controls, position);
    article.append(artwork, copy);
    function render() {
      const post = posts[index];
      image.hidden = false;
      image.src = imagePath(post.image);
      category.textContent = post.category || "Blackwood Update";
      time.dateTime = post.publishedAt;
      time.textContent = date(post.publishedAt);
      pinned.hidden = !post.pinned;
      title.textContent = post.title;
      excerpt.textContent =
        post.excerpt || "Open this file to read the full update.";
      action.setAttribute("aria-label", "Read File: " + post.title);
      position.textContent = index + 1 + " of " + posts.length;
    }
    previous.addEventListener("click", () => {
      index = (index - 1 + posts.length) % posts.length;
      render();
    });
    next.addEventListener("click", () => {
      index = (index + 1) % posts.length;
      render();
    });
    action.addEventListener("click", () => open(posts[index], action));
    render();
    return article;
  }
  async function load() {
    const current = ++requestNumber;
    request?.abort();
    request = new AbortController();
    const active = request;
    const timeout = setTimeout(() => active.abort(), 15000);
    grid.setAttribute("aria-busy", "true");
    retry.hidden = true;
    summary.textContent = "Checking the latest public updates…";
    count.textContent = "…";
    status.textContent = "Checking the latest public updates…";
    try {
      if (typeof window.BlackwoodDispatches?.loadPublic !== "function")
        throw Error("Updates unavailable");
      const rows = await window.BlackwoodDispatches.loadPublic({
        signal: active.signal,
      });
      if (current !== requestNumber) return;
      const posts = (Array.isArray(rows) ? rows : [])
        .filter(
          (post) =>
            post &&
            post.audience === "public" &&
            post.published === true &&
            Number.isFinite(Date.parse(post.publishedAt)) &&
            Date.parse(post.publishedAt) <= Date.now()
        )
        .slice(0, 3);
      grid.replaceChildren(...(posts.length ? [carousel(posts)] : []));
      count.textContent = posts.length + " filed";
      if (posts.length) {
        summary.textContent =
          posts.length +
          " public dispatch" +
          (posts.length === 1 ? "" : "es") +
          " · Latest " +
          date(Math.max(...posts.map((post) => Date.parse(post.publishedAt))));
        status.textContent = "";
      } else {
        summary.textContent = "Public news from Blackwood Publishing";
        status.textContent =
          "Public updates will appear here as they are published. Members can find their dispatches in the Archivists area.";
      }
    } catch {
      if (current !== requestNumber) return;
      grid.replaceChildren();
      summary.textContent = "Public news from Blackwood Publishing";
      count.textContent = "—";
      status.textContent =
        "Public updates could not be loaded just now. Please try again.";
      retry.hidden = false;
    } finally {
      clearTimeout(timeout);
      if (current === requestNumber) grid.removeAttribute("aria-busy");
    }
  }
  toggle.addEventListener("click", () => {
    const expanded = toggle.getAttribute("aria-expanded") !== "true";
    toggle.setAttribute("aria-expanded", String(expanded));
    section.classList.toggle("is-open", expanded);
    content.hidden = !expanded;
  });
  retry.addEventListener("click", () => void load());
  dialog
    .querySelector("[data-dispatch-close]")
    .addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", () => {
    if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
  });
  dialog.addEventListener("click", (event) => {
    const rect = dialog.getBoundingClientRect();
    if (
      event.target === dialog &&
      (event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom)
    )
      dialog.close();
  });
  window.addEventListener("pagehide", () => {
    requestNumber++;
    request?.abort();
  });
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) void load();
  });
  void load();
})();
