/* Short published excerpts only. No private EPUB content or account data is used. */
export const READING_GHOST_QUOTES = Object.freeze([
  {
    text: "Not everything that comes back from the hills is meant to.",
    book: "The Third Night",
    source: "/pages/the-third-night.html",
  },
  {
    text: "No official record exists of the ship’s return.",
    book: "The Gåtestein Log",
    source: "/pages/gatestein-log.html",
  },
  {
    text: "The loch lay below them, dark and still, its surface barely disturbed.",
    book: "The Third Night",
    source: "/pages/the-third-night.html",
  },
  {
    text: "The fog came in before dawn and did not lift.",
    book: "The Gåtestein Log",
    source: "/pages/gatestein-log.html",
  },
]);

export function startAtmosphere(container) {
  if (!container || container.querySelector("[data-reading-atmosphere]"))
    return { refresh() {}, destroy() {} };
  const layer = document.createElement("div");
  layer.className = "reading-atmosphere";
  layer.dataset.readingAtmosphere = "";
  layer.setAttribute("aria-hidden", "true");
  const text = document.createElement("p"),
    source = document.createElement("span");
  text.className = "reading-atmosphere__quote";
  source.className = "reading-atmosphere__source";
  layer.append(text, source);
  container.classList.add("has-reading-atmosphere");
  container.prepend(layer);

  let index = 0,
    timer,
    changeTimer,
    intersecting = true,
    destroyed = false,
    paused = false;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  function showQuote() {
    text.textContent = "“" + READING_GHOST_QUOTES[index].text + "”";
    source.textContent = "— " + READING_GHOST_QUOTES[index].book;
  }
  function visible() {
    if (
      destroyed ||
      paused ||
      !container.isConnected ||
      document.hidden ||
      !intersecting
    )
      return false;
    for (let node = container; node; node = node.parentElement) {
      if (node.hidden || node.inert) return false;
    }
    return true;
  }
  function stop() {
    clearTimeout(timer);
    clearTimeout(changeTimer);
    timer = changeTimer = undefined;
    layer.classList.remove("is-changing");
  }
  function schedule() {
    if (timer || changeTimer || !visible() || reduced.matches) return;
    timer = setTimeout(() => {
      timer = undefined;
      if (!visible() || reduced.matches) return refresh();
      layer.classList.add("is-changing");
      changeTimer = setTimeout(() => {
        changeTimer = undefined;
        if (!visible() || reduced.matches) return refresh();
        index = (index + 1) % READING_GHOST_QUOTES.length;
        showQuote();
        layer.classList.remove("is-changing");
        schedule();
      }, 450);
    }, 12000);
  }
  function refresh() {
    const onScreen = visible();
    layer.hidden = !onScreen;
    if (!onScreen || reduced.matches) stop();
    else schedule();
  }
  const observer = new MutationObserver(refresh);
  function watch() {
    for (let node = container; node; node = node.parentElement) {
      observer.observe(node, {
        attributes: true,
        attributeFilter: ["hidden", "inert"],
      });
    }
    intersection?.observe(container);
  }
  const intersection =
    typeof IntersectionObserver === "function"
      ? new IntersectionObserver((entries) => {
          intersecting = entries[0]?.isIntersecting === true;
          refresh();
        })
      : null;
  function pausePage() {
    paused = true;
    stop();
    layer.hidden = true;
    observer.disconnect();
    intersection?.disconnect();
  }
  function resumePage() {
    if (destroyed) return;
    paused = false;
    watch();
    refresh();
  }
  watch();
  window.addEventListener("pagehide", pausePage);
  window.addEventListener("pageshow", resumePage);
  document.addEventListener("visibilitychange", refresh);
  reduced.addEventListener("change", refresh);
  showQuote();
  refresh();
  return {
    refresh,
    destroy() {
      destroyed = true;
      stop();
      observer.disconnect();
      intersection?.disconnect();
      window.removeEventListener("pagehide", pausePage);
      window.removeEventListener("pageshow", resumePage);
      document.removeEventListener("visibilitychange", refresh);
      reduced.removeEventListener("change", refresh);
      container.classList.remove("has-reading-atmosphere");
      layer.remove();
    },
  };
}
