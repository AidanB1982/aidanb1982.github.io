// =========================
// BLACKWOOD ARC TEAM FORM
// Native form POST version
// =========================

const BLACKWOOD_ARC_TEAM_ENDPOINT = "https://script.google.com/macros/s/AKfycbyhg5jKRLFSn0UehYkBoibsiIosT71kLWMvsQmJYckGsuMj2fX5k6o9Z4cotR2ChwBu/exec";

document.addEventListener("DOMContentLoaded", () => {
    initArcTeamForm();
});

function initArcTeamForm() {
    const form = document.getElementById("arc-team-form");
    const submitButton = document.getElementById("arc-team-submit");
    const status = document.getElementById("arc-team-status");

    if (!form || !submitButton || !status) return;

    if (form.dataset.arcInitialised === "true") return;
    form.dataset.arcInitialised = "true";

    form.action = BLACKWOOD_ARC_TEAM_ENDPOINT;
    form.method = "post";
    form.target = "arc-team-frame";
    form.acceptCharset = "UTF-8";

    const iframe = ensureArcIframe();

    let hasSubmitted = false;
    let fallbackTimer = null;
    let resetTimer = null;

    form.addEventListener("submit", event => {
        setArcStatus(status, "", "");

        const validationMessage = validateArcTeamForm(form);

        if (validationMessage) {
            event.preventDefault();
            setArcStatus(status, validationMessage, "is-error");
            return;
        }

        clearBotField(form);

        hasSubmitted = true;

        submitButton.disabled = true;
        submitButton.textContent = "Filing application...";

        setArcStatus(status, "Filing your ARC application...", "is-loading");

        window.clearTimeout(fallbackTimer);

        fallbackTimer = window.setTimeout(() => {
            finishArcSubmission(form, submitButton, status);
            hasSubmitted = false;
        }, 3500);

        /*
            Do not call preventDefault here.
            The form submits normally to Google Apps Script through the hidden iframe.
        */
    });

    iframe.addEventListener("load", () => {
        if (!hasSubmitted) return;

        hasSubmitted = false;

        window.clearTimeout(fallbackTimer);

        finishArcSubmission(form, submitButton, status);
    });

    function finishArcSubmission(activeForm, activeButton, activeStatus) {
        activeForm.reset();

        setArcStatus(
            activeStatus,
            "Thank you — your ARC Team application has been filed.",
            "is-success"
        );

        activeButton.textContent = "Application Filed";

        window.clearTimeout(resetTimer);

        resetTimer = window.setTimeout(() => {
            activeButton.disabled = false;
            activeButton.textContent = "Apply to Join the ARC Team";

            setArcStatus(
                activeStatus,
                "Required fields are marked with an asterisk.",
                ""
            );
        }, 6000);
    }
}

function ensureArcIframe() {
    let iframe = document.getElementById("arc-team-frame");

    if (!iframe) {
        iframe = document.createElement("iframe");
        iframe.id = "arc-team-frame";
        iframe.name = "arc-team-frame";
        iframe.title = "ARC Team submission";
        iframe.style.display = "none";
        document.body.appendChild(iframe);
    }

    return iframe;
}

function validateArcTeamForm(form) {
    const name = getFormValue(form, "name");
    const email = getFormValue(form, "email");
    const consent = form.elements.consentToBeContacted;
    const privacy = form.elements.privacyAgreement;

    if (!name) {
        focusField(form, "name");
        return "Please enter your name.";
    }

    if (!isValidEmail(email)) {
        focusField(form, "email");
        return "Please enter a valid email address.";
    }

    if (!consent || !consent.checked) {
        focusField(form, "consentToBeContacted");
        return "Please confirm that Blackwood Publishing may contact you about ARC opportunities.";
    }

    if (!privacy || !privacy.checked) {
        focusField(form, "privacyAgreement");
        return "Please confirm the privacy agreement before submitting.";
    }

    return "";
}

function clearBotField(form) {
    const botField = form.elements.website;

    if (botField) {
        botField.value = "";
    }
}

function getFormValue(form, name) {
    const field = form.elements[name];

    if (!field) return "";

    return String(field.value || "").trim();
}

function focusField(form, name) {
    const field = form.elements[name];

    if (field && typeof field.focus === "function") {
        field.focus();
    }
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
}

function setArcStatus(status, message, className) {
    status.textContent = message;

    status.classList.remove("is-success", "is-error", "is-loading");

    if (className) {
        status.classList.add(className);
    }
}
