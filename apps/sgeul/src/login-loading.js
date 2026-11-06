/* A visual wait state; dismissing it never cancels or repeats an Auth request. */
export function createLoginLoading(root, backgrounds) {
  const title = root.querySelector("[data-loading-title]");
  const detail = root.querySelector("[data-loading-detail]");
  const action = root.querySelector("[data-loading-dismiss]");
  let active = false,
    timer,
    previousFocus,
    previousBodyClass = false,
    priorStates = [];
  function dismiss() {
    if (root.hidden) return;
    root.hidden = true;
    for (const { element, inert, busy } of priorStates) {
      element.inert = inert;
      if (busy === null) element.removeAttribute("aria-busy");
      else element.setAttribute("aria-busy", busy);
    }
    priorStates = [];
    if (!previousBodyClass) document.body.classList.remove("auth-loading-open");
    if (
      previousFocus?.isConnected &&
      !previousFocus.closest("[hidden]") &&
      !previousFocus.disabled
    )
      previousFocus.focus({ preventScroll: true });
    else
      document
        .querySelector("#home:not([hidden]) h2, #sign-in:not([hidden]) input")
        ?.focus({ preventScroll: true });
  }
  action.addEventListener("click", dismiss);
  root.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !action.hidden) dismiss();
    // Until the escape action appears the dialog itself is the only focus target.
    if (event.key === "Tab") {
      event.preventDefault();
      (action.hidden ? root : action).focus();
    }
  });
  return {
    start(message, explanation) {
      if (active) return;
      active = true;
      previousFocus = document.activeElement;
      previousBodyClass = document.body.classList.contains("auth-loading-open");
      priorStates = backgrounds.map((element) => ({
        element,
        inert: element.inert,
        busy: element.getAttribute("aria-busy"),
      }));
      for (const element of backgrounds) {
        element.inert = true;
        element.setAttribute("aria-busy", "true");
      }
      title.textContent = message;
      detail.textContent = explanation;
      action.hidden = true;
      root.hidden = false;
      document.body.classList.add("auth-loading-open");
      root.focus({ preventScroll: true });
      timer = setTimeout(() => {
        if (!active) return;
        detail.textContent =
          "This is taking a little longer. You can continue browsing while we finish checking your account.";
        action.hidden = false;
      }, 8000);
    },
    update(message, explanation) {
      if (!active || root.hidden || !action.hidden) return;
      title.textContent = message;
      detail.textContent = explanation;
    },
    finish() {
      clearTimeout(timer);
      active = false;
      dismiss();
    },
  };
}
