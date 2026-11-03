/* Public beta applications and feedback use the site's existing Formspree inbox.
   No passwords, account creation, marketing subscription or book grants happen here. */
(() => {
  "use strict";
  for (const form of document.querySelectorAll("[data-beta-form]")) {
    const status = form.querySelector("[data-form-status]"),
      button = form.querySelector("button[type=submit]");
    let busy = false;
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (busy || !form.reportValidity()) return;
      if (!navigator.onLine) {
        status.textContent =
          "Connect to the internet to send this form. Your entries are still here.";
        return;
      }
      if (form.elements._gotcha?.value) {
        status.textContent = "This submission could not be sent.";
        return;
      }
      const body = new FormData(form);
      busy = true;
      button.disabled = true;
      status.textContent = "Sending…";
      try {
        const response = await fetch(form.action, {
          method: "POST",
          headers: { Accept: "application/json" },
          body,
          signal: AbortSignal.timeout(20000),
        });
        if (!response.ok) throw Error();
        const result = await response.json();
        if (result.ok !== true) throw Error();
        const feedback = body.get("form_type") === "sgeul_beta_feedback";
        form.reset();
        status.textContent = feedback
          ? "Thank you. Your feedback has been sent privately to Blackwood Publishing."
          : "Thank you. Your application has been sent. We’ll email joining instructions if a beta place is offered.";
      } catch {
        status.textContent =
          "We couldn’t confirm your submission. Your entries are still here. Please try again online, or email aidan@blackwoodpublishing.co.uk.";
      } finally {
        busy = false;
        button.disabled = false;
      }
    });
  }
})();
