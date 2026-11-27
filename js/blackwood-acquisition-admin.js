"use strict";
/* Administrator-only PROCESS REFERENCE, not an intake or saved case tracker.
 * The parent Management Hub authenticates administrators before activation.
 * This script makes no network requests, changes no records and sends no messages.
 */
(function () {
  const $ = id => document.getElementById(id);
  const root = $("acquisition-workflow-reference");
  const list = $("acquisition-workflow-steps");
  const guide = $("acquisition-workflow-selected");
  const select = $("acquisition-workflow-journey");
  const status = $("acquisition-workflow-status");
  const model = window.BlackwoodAcquisitionWorkflow;
  if (!root || !list || !guide || !select || !status || !model) return;
  let authorised = false;
  const prettify = key => String(key).replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, c => c.toUpperCase());
  function render() {
    if (!authorised) return;
    const journey = select.value === "offer" ? "offer" : "submission";
    const steps = model.stages(journey);
    const heading = document.createElement("h3");
    heading.textContent = journey === "submission"
      ? "Journey 1: submitted manuscript — editorial acquisition"
      : "Journey 2: publisher offer — contract and Author Desk introduction";
    list.replaceChildren(heading);
    const ol = document.createElement("ol");
    ol.className = "acquisition-step-list";
    steps.forEach(([code,title,purpose]) => {
      const li = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.className = "bfa-button";
      button.textContent = title;
      button.setAttribute("aria-label","Review required evidence for " + title);
      button.addEventListener("click", () => showStage(journey,code));
      const description = document.createElement("p");
      description.className = "bfa-muted";
      description.textContent = purpose;
      li.append(button,description);
      ol.append(li);
    });
    list.append(ol);
    showStage(journey,steps[0][0]);
    status.textContent = "Reference only — no application, agreement, stage change, author invitation or access grant has been recorded.";
  }
  function showStage(journey,code) {
    if (!authorised) return;
    const step = model.stages(journey).find(item => item[0] === code);
    if (!step) return;
    const h = document.createElement("h4");
    h.textContent = step[1];
    const p = document.createElement("p");
    p.textContent = step[2];
    const gates = model.requirements(code);
    const next = model.next(journey,code);
    const requirement = document.createElement("p");
    requirement.textContent = gates.length
      ? "Evidence checks (publisher verification required): " + gates.map(prettify).join(" · ")
      : "No additional software gate at this reference stage. The owner still controls all decisions.";
    const follow = document.createElement("p");
    follow.textContent = next.length
      ? "Permitted next reference: " + next.map(id =>
        model.stages(journey).find(s => s[0] === id)?.[1] || id.replace(/_/g," ")).join(" · ")
      : "Final reference stage for this journey.";
    guide.replaceChildren(h,p,requirement,follow);
  }
  function activate() {
    authorised = true;
    root.hidden = false;
    render();
  }
  function suspend() {
    authorised = false;
    root.hidden = true;
    list.replaceChildren();
    guide.replaceChildren();
    status.textContent = "Blackwood management access is required.";
  }
  select.addEventListener("change",render);
  suspend();
  window.BlackwoodAcquisitionGuide = Object.freeze({activate,suspend,lock:suspend});
})();
