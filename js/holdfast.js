// /js/holdfast.js

window.addEventListener("load", async () => {
    try {
        if (typeof loadHeader === "function") {
            await loadHeader("simple");
        } else {
            console.warn("loadHeader function not found");
        }

        if (typeof initFadeIn === "function") {
            initFadeIn();
        }
    } catch (error) {
        console.error("Page initialisation error:", error);
    }
});

(function () {
    "use strict";

    const ACCESS_CODE = "Holdfast-04";
    const STORAGE_KEY = "blackwood_holdfast_access_granted";

    const form = document.getElementById("access-form");
    const input = document.getElementById("access-code");
    const message = document.getElementById("access-message");
    const status = document.getElementById("access-status");
    const transmissionPanel = document.getElementById("transmission-panel");
    const prologuePanel = document.getElementById("holdfast-prologue");
    const playButton = document.getElementById("play-button");
    const sealButton = document.getElementById("seal-button");
    const audio = document.getElementById("holdfast-audio");
    const soundwaveBox = document.getElementById("soundwave-box");
    const transmissionNote = document.getElementById("transmission-note");

    function cleanCode(value) {
        return String(value || "").trim();
    }

    function setMessage(text, type) {
        if (!message) return;

        message.textContent = text;
        message.classList.remove("is-error", "is-success");

        if (type) {
            message.classList.add(type);
        }
    }

    function revealPrologue() {
        if (!prologuePanel) return;

        prologuePanel.hidden = false;

        requestAnimationFrame(() => {
            prologuePanel.classList.add("is-visible");
        });
    }

    function grantAccess() {
        if (status) {
            status.textContent = "Access granted";
            status.classList.add("is-granted");
        }

        setMessage("File designation accepted. Transmission unlocked.", "is-success");

        if (transmissionPanel) {
            transmissionPanel.classList.add("is-visible");
        }

        revealPrologue();

        if (input) {
            input.setAttribute("disabled", "disabled");
        }

        if (form) {
            const submitButton = form.querySelector(".access-button");

            if (submitButton) {
                submitButton.setAttribute("disabled", "disabled");
                submitButton.textContent = "Designation Accepted";
            }
        }

        sessionStorage.setItem(STORAGE_KEY, "true");
    }

    function denyAccess() {
        setMessage(
            "Access denied. Check the file designation and enter it exactly as recorded.",
            "is-error"
        );

        if (input) {
            input.setAttribute("aria-invalid", "true");

            input.animate(
                [
                    { transform: "translateX(0)" },
                    { transform: "translateX(-7px)" },
                    { transform: "translateX(7px)" },
                    { transform: "translateX(0)" }
                ],
                {
                    duration: 240,
                    easing: "ease-out"
                }
            );
        }
    }

    function sealArchive() {
        sessionStorage.removeItem(STORAGE_KEY);

        if (audio) {
            audio.pause();
            audio.currentTime = 0;
        }

        if (prologuePanel) {
            prologuePanel.classList.remove("is-visible");
            prologuePanel.hidden = true;
        }

        location.reload();
    }

    if (sessionStorage.getItem(STORAGE_KEY) === "true") {
        grantAccess();
    }

    if (form && input) {
        form.addEventListener("submit", function (event) {
            event.preventDefault();

            const enteredCode = cleanCode(input.value);

            if (enteredCode === ACCESS_CODE) {
                input.removeAttribute("aria-invalid");
                grantAccess();
                return;
            }

            denyAccess();
        });

        input.addEventListener("input", function () {
            input.removeAttribute("aria-invalid");
            setMessage("Awaiting file designation.", "");
        });
    }

    if (playButton && audio && soundwaveBox && transmissionNote) {
        playButton.addEventListener("click", async function () {
            try {
                if (audio.paused) {
                    await audio.play();
                    playButton.textContent = "Pause Transmission";
                    soundwaveBox.classList.add("is-playing");
                    transmissionNote.textContent = "Transmission is playing.";
                } else {
                    audio.pause();
                    playButton.textContent = "Play Transmission";
                    soundwaveBox.classList.remove("is-playing");
                    transmissionNote.textContent = "Transmission paused.";
                }
            } catch (error) {
                console.error("Audio playback failed:", error);
                transmissionNote.textContent = "Playback could not begin. Check browser audio permissions.";
            }
        });

        audio.addEventListener("ended", function () {
            playButton.textContent = "Replay Transmission";
            soundwaveBox.classList.remove("is-playing");
            transmissionNote.textContent = "Transmission ended.";
        });

        audio.addEventListener("pause", function () {
            if (!audio.ended) {
                soundwaveBox.classList.remove("is-playing");
            }
        });

        audio.addEventListener("play", function () {
            soundwaveBox.classList.add("is-playing");
        });
    }

    if (sealButton) {
        sealButton.addEventListener("click", sealArchive);
    }
})();

// =========================
// LOCKED READING PROTECTION
// =========================

(function () {
    "use strict";

    function closestLockedReadingFromEvent(event) {
        if (!event || !event.target || typeof event.target.closest !== "function") {
            return null;
        }

        return event.target.closest(".locked-reading");
    }

    function selectionTouchesLockedReading() {
        const selection = window.getSelection();

        if (!selection || selection.rangeCount === 0) {
            return false;
        }

        const anchorNode = selection.anchorNode;
        const focusNode = selection.focusNode;

        const anchorElement = anchorNode && anchorNode.nodeType === Node.TEXT_NODE
            ? anchorNode.parentElement
            : anchorNode;

        const focusElement = focusNode && focusNode.nodeType === Node.TEXT_NODE
            ? focusNode.parentElement
            : focusNode;

        return Boolean(
            anchorElement &&
            typeof anchorElement.closest === "function" &&
            anchorElement.closest(".locked-reading")
        ) || Boolean(
            focusElement &&
            typeof focusElement.closest === "function" &&
            focusElement.closest(".locked-reading")
        );
    }

    function blockLockedReadingAction(event) {
        if (closestLockedReadingFromEvent(event) || selectionTouchesLockedReading()) {
            event.preventDefault();

            const selection = window.getSelection();

            if (selection) {
                selection.removeAllRanges();
            }
        }
    }

    document.addEventListener("contextmenu", blockLockedReadingAction);
    document.addEventListener("copy", blockLockedReadingAction);
    document.addEventListener("cut", blockLockedReadingAction);
    document.addEventListener("dragstart", blockLockedReadingAction);

    document.addEventListener("keydown", function (event) {
        const key = event.key.toLowerCase();
        const isCopy = (event.ctrlKey || event.metaKey) && key === "c";
        const isPrint = (event.ctrlKey || event.metaKey) && key === "p";

        if ((isCopy || isPrint) && selectionTouchesLockedReading()) {
            event.preventDefault();

            const selection = window.getSelection();

            if (selection) {
                selection.removeAllRanges();
            }
        }
    });

    document.addEventListener("selectionchange", function () {
        if (selectionTouchesLockedReading()) {
            const selection = window.getSelection();

            if (selection) {
                selection.removeAllRanges();
            }
        }
    });
})();
