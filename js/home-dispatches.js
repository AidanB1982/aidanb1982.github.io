/* Homepage dispatches are always public, even when this browser has an admin session. */
(() => {
  "use strict";
  const section = document.getElementById("home-dispatches");
  if (!section) return;
  const grid = section.querySelector("[data-dispatch-grid]");
  const status = section.querySelector("[data-dispatch-status]");
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
      day: "numeric",
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
    meta.textContent = [post.category, date(post.publishedAt)]
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
  function card(post) {
    const article = document.createElement("article");
    article.className = "home-dispatch-card";
    const image = document.createElement("img");
    image.src = imagePath(post.image);
    image.alt = "";
    image.width = 640;
    image.height = 360;
    image.loading = "lazy";
    image.addEventListener(
      "error",
      () => {
        image.hidden = true;
      },
      { once: true }
    );
    const copy = document.createElement("div");
    copy.className = "home-dispatch-card__copy";
    const info = text(
      "p",
      post.category || "Blackwood Update",
      "home-dispatch-card__category"
    );
    const time = document.createElement("time");
    time.dateTime = post.publishedAt;
    time.textContent = date(post.publishedAt);
    info.append(document.createTextNode(" · "), time);
    const action = text("button", "Read update", "button");
    action.type = "button";
    action.setAttribute("aria-label", "Read update: " + post.title);
    action.addEventListener("click", () => open(post, action));
    copy.append(
      info,
      text("h3", post.title),
      text(
        "p",
        post.excerpt || "Open this update to read more.",
        "home-dispatch-card__excerpt"
      ),
      action
    );
    article.append(image, copy);
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
    status.textContent = "Checking the latest public updates…";
    try {
      if (typeof window.BlackwoodDispatches?.loadPublic !== "function")
        throw Error("Updates unavailable");
      const rows = await window.BlackwoodDispatches.loadPublic({
        signal: active.signal,
      });
      if (current !== requestNumber) return;
      // Keep this presentation public even if a future helper/provider returns extra rows.
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
      grid.replaceChildren(...posts.map(card));
      if (posts.length) {
        const latest = Math.max(
          ...posts.map((post) => Date.parse(post.publishedAt))
        );
        status.textContent = "Latest public update · " + date(latest);
      } else
        status.textContent =
          "Public updates will appear here as they are published. Members can find their dispatches in the Archivists area.";
    } catch {
      if (current !== requestNumber) return;
      grid.replaceChildren();
      status.textContent =
        "Public updates could not be loaded just now. Please try again.";
      retry.hidden = false;
    } finally {
      clearTimeout(timeout);
      if (current === requestNumber) grid.removeAttribute("aria-busy");
    }
  }
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
