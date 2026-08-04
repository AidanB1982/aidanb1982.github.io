// =========================
// BLACKWOOD ARC TEAM FORM
// =========================

const BLACKWOOD_ARC_TEAM_ENDPOINT = "https://script.google.com/macros/s/AKfycbwz1pbfH-ukGcclkfzmlvDtlXlll47Pda-C3U1zZAK0lcP_xv9f79HKF6HKN0JECo0l/exec";

document.addEventListener("DOMContentLoaded", () => {
    initArcTeamForm();
});

function initArcTeamForm() {
    const form = document.getElementById("arc-team-form");
    const submitButton = document.getElementById("arc-team-submit");
    const status = document.getElementById("arc-team-status");

    if (!form || !submitButton || !status) return;

    form.addEventListener("submit", async event => {
        event.preventDefault();

        status.classList.remove("is-success", "is-error", "is-loading");

        const validationMessage = validateArcTeamForm(form);

        if (validationMessage) {
            setArcStatus(status, validationMessage, "is-error");
            return;
        }

        const payload = buildArcPayload(form);

        submitButton.disabled = true;
        submitButton.textContent = "Filing application...";
        setArcStatus(status, "Filing your ARC application...", "is-loading");

        try {
            await fetch(BLACKWOOD_ARC_TEAM_ENDPOINT, {
                method: "POST",
                mode: "no-cors",
                headers: {
                    "Content-Type": "text/plain;charset=utf-8"
                },
                body: JSON.stringify(payload)
            });

            form.reset();

            setArcStatus(
                status,
                "Thank you — your ARC Team application has been filed.",
                "is-success"
            );

            submitButton.textContent = "Application Filed";

            window.setTimeout(() => {
                submitButton.disabled = false;
                submitButton.textContent = "Apply to Join the ARC Team";
                setArcStatus(
                    status,
                    "Required fields are marked with an asterisk.",
                    ""
                );
            }, 6000);

        } catch (error) {
            console.error("ARC Team submission failed:", error);

            setArcStatus(
                status,
                "Something went wrong. Please try again in a moment.",
                "is-error"
            );

            submitButton.disabled = false;
            submitButton.textContent = "Apply to Join the ARC Team";
        }
    });
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

function buildArcPayload(form) {
    return {
        website: getFormValue(form, "website"),
        name: getFormValue(form, "name"),
        email: getFormValue(form, "email"),
        country: getFormValue(form, "country"),
        preferredFormat: getFormValue(form, "preferredFormat"),
        preferredGenres: getFormValue(form, "preferredGenres"),
        blackwoodInterests: getFormValue(form, "blackwoodInterests"),
        reviewPlatforms: getFormValue(form, "reviewPlatforms"),
        amazonProfile: getFormValue(form, "amazonProfile"),
        goodreadsProfile: getFormValue(form, "goodreadsProfile"),
        storyGraphProfile: getFormValue(form, "storyGraphProfile"),
        instagram: getFormValue(form, "instagram"),
        tiktok: getFormValue(form, "tiktok"),
        blogWebsite: getFormValue(form, "blogWebsite"),
        previousArcExperience: getFormValue(form, "previousArcExperience"),
        canReviewByDeadline: getFormValue(form, "canReviewByDeadline"),
        reviewTimeframe: getFormValue(form, "reviewTimeframe"),
        interestedIn: getFormValue(form, "interestedIn"),
        whyJoinArcTeam: getFormValue(form, "whyJoinArcTeam"),
        consentToBeContacted: isChecked(form, "consentToBeContacted") ? "Yes" : "No",
        privacyAgreement: isChecked(form, "privacyAgreement") ? "Yes" : "No",
        sourcePage: getFormValue(form, "sourcePage") || "ARC Team Page"
    };
}

function getFormValue(form, name) {
    const field = form.elements[name];

    if (!field) return "";

    return String(field.value || "").trim();
}

function isChecked(form, name) {
    const field = form.elements[name];

    return Boolean(field && field.checked);
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
