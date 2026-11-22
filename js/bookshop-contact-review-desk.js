"use strict";
/*
 * Business contact review is inert until the existing administrator-approved
 * outreach application calls initialise. Data remains in its browser-local
 * saved records and JSON export; no external contact request is made.
 */
(function (root) {
  const $ = id => document.getElementById(id);
  const node = (tag, text, className) => {
    const item = document.createElement(tag);
    if (text !== undefined) item.textContent = text;
    if (className) item.className = className;
    return item;
  };
  let api = null;
  let dialog = null;

  function field(labelText, control) {
    const label = node("label");
    label.append(node("span", labelText), control);
    return label;
  }

  function createDialog() {
    dialog = node("dialog", undefined, "review-modal");
    dialog.setAttribute("aria-label", "Review public business contact evidence");
    const title = node("h2", "Public business contact");
    title.id = "bc-title";
    const context = node("p");
    context.id = "bc-context";
    const form = node("form");
    form.className = "review-form";

    const email = node("input");
    email.id = "bc-email";
    email.type = "email";
    email.required = true;
    email.maxLength = 254;
    email.placeholder = "shop@example.org";

    const source = node("input");
    source.id = "bc-source";
    source.type = "url";
    source.required = true;
    source.maxLength = 1000;
    source.placeholder = "https://bookshop.example/contact";

    const notes = node("textarea");
    notes.id = "bc-notes";
    notes.rows = 4;
    notes.maxLength = 2000;
    notes.placeholder = "Public trade-contact context and any contact restrictions";

    const approval = node("input");
    approval.id = "bc-approved";
    approval.type = "checkbox";
    approval.style.width = "auto";
    approval.style.minHeight = "auto";
    approval.style.justifySelf = "start";

    const result = node("p");
    result.id = "bc-result";
    result.setAttribute("role", "status");
    const actions = node("div", undefined, "review-dialog-actions");
    const save = node("button", "Save contact evidence", "btn");
    save.type = "submit";
    const cancel = node("button", "Cancel", "btn secondary");
    cancel.type = "button";
    cancel.addEventListener("click", () => dialog.close());
    actions.append(save, cancel);

    form.append(
      field("Publicly listed business email (not a private personal address)", email),
      field("Public webpage showing this address (required)", source),
      field("Notes, trade enquiry context or opt-out restrictions", notes),
      field("I personally checked whether an individual trade enquiry is appropriate, including any opt-out. This is not blanket consent.", approval),
      result, actions
    );

    form.addEventListener("submit", event => {
      event.preventDefault();
      const shop = api.getShops().find(item => item.id === dialog.dataset.shopId);
      if (!shop) {
        result.textContent = "The saved bookshop could not be found.";
        return;
      }
      try {
        const review = root.BlackwoodContactReview.createReview({
          email: email.value,
          sourceUrl: source.value,
          notes: notes.value,
          approved: approval.checked
        }, shop, api.localDate());

        if (!api.updateShopRecord(shop.id, {
          email: review.email,
          contactReview: review
        })) {
          result.textContent = "Unable to save contact evidence. Export a backup.";
          return;
        }
        dialog.close();
        api.render();
      } catch (error) {
        result.textContent = error.message;
      }
    });

    dialog.append(title, context, form);
    document.body.append(dialog);
  }

  function openReview(shop) {
    if (!api || !root.BlackwoodContactReview || !shop ||
        shop.reviewOrigin !== "public-directory") return;
    if (!dialog) createDialog();
    const review = shop.contactReview || {};
    $("bc-title").textContent = "Business contact · " + shop.name;
    $("bc-context").textContent =
      "This records a human-checked business contact, not consent or stockist status. " +
      "Outreach remains one message at a time through the existing explicit controls.";
    $("bc-email").value = shop.email || review.email || "";
    $("bc-source").value = review.sourceUrl || "";
    $("bc-notes").value = review.notes || "";
    $("bc-approved").checked = review.approved === true &&
      root.BlackwoodContactReview.businessEmail(shop.email) ===
      root.BlackwoodContactReview.businessEmail(review.email);
    $("bc-result").textContent = "";
    dialog.dataset.shopId = shop.id;
    dialog.showModal();
  }

  function initialise(adapter) {
    if (!root.BlackwoodContactReview) return;
    api = adapter;
  }

  root.BlackwoodContactDesk = Object.freeze({initialise, openReview});
})(window);
