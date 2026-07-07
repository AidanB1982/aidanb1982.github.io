/* ======================================================
   CHOOSE YOUR DARKNESS
   The Blackwood Mood Map
====================================================== */

(function () {
    "use strict";

    function initDarknessMap() {
        const map = document.querySelector("[data-darkness-map]");

        if (!map) return;

        const cards = Array.from(map.querySelectorAll("[data-darkness-choice]"));

        const reveal = map.querySelector(".darkness-reveal");
        const revealImage = map.querySelector("[data-darkness-image]");
        const revealMood = map.querySelector("[data-darkness-mood]");
        const revealTitle = map.querySelector("[data-darkness-title]");
        const revealCopy = map.querySelector("[data-darkness-copy]");
        const revealPrimaryLink = map.querySelector("[data-darkness-primary-link]");

        if (
            !cards.length ||
            !reveal ||
            !revealImage ||
            !revealMood ||
            !revealTitle ||
            !revealCopy ||
            !revealPrimaryLink
        ) {
            return;
        }

        const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

        function getCardData(card) {
            return {
                mood: card.dataset.mood || "",
                title: card.dataset.title || "",
                image: card.dataset.image || "",
                link: card.dataset.link || "#",
                button: card.dataset.button || "Begin Reading",
                copy: card.dataset.copy || "",
                external: card.dataset.external === "true"
            };
        }

        function setActiveCard(activeCard) {
            cards.forEach(card => {
                const isActive = card === activeCard;

                card.classList.toggle("is-active", isActive);
                card.setAttribute("aria-pressed", isActive ? "true" : "false");
            });
        }

        function updatePrimaryLink(data) {
            revealPrimaryLink.href = data.link;
            revealPrimaryLink.textContent = data.button;

            if (data.external) {
                revealPrimaryLink.setAttribute("target", "_blank");
                revealPrimaryLink.setAttribute("rel", "noopener noreferrer sponsored");
            } else {
                revealPrimaryLink.removeAttribute("target");
                revealPrimaryLink.removeAttribute("rel");
            }
        }

        function updateReveal(card) {
            const data = getCardData(card);

            setActiveCard(card);

            const applyUpdate = () => {
                revealMood.textContent = data.mood;
                revealTitle.textContent = data.title;
                revealCopy.textContent = data.copy;

                revealImage.src = data.image;
                revealImage.alt = `${data.title} cover`;

                updatePrimaryLink(data);

                reveal.classList.remove("is-changing");
            };

            if (prefersReducedMotion) {
                applyUpdate();
                return;
            }

            reveal.classList.add("is-changing");

            window.setTimeout(applyUpdate, 170);
        }

        cards.forEach(card => {
            card.setAttribute("aria-pressed", card.classList.contains("is-active") ? "true" : "false");

            card.addEventListener("click", () => {
                updateReveal(card);

                if (window.innerWidth <= 760) {
                    window.setTimeout(() => {
                        reveal.scrollIntoView({
                            behavior: prefersReducedMotion ? "auto" : "smooth",
                            block: "start"
                        });
                    }, 220);
                }
            });
        });

        const initialCard = cards.find(card => card.classList.contains("is-active")) || cards[0];

        if (initialCard) {
            updateReveal(initialCard);
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initDarknessMap);
    } else {
        initDarknessMap();
    }
})();
