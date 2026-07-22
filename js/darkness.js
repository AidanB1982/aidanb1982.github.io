/* ======================================================
   CHOOSE YOUR DARKNESS
   The Blackwood Mood Map
====================================================== */

(function () {
    "use strict";

    const darknessMap = {
        "isolated-grief": {
            mood: "Isolated Grief",
            copy: "Remote silence, loss, and places that feel empty until they don’t.",
            primary: "The Black Bothy",
            books: [
                {
                    title: "The Black Bothy",
                    label: "Recommended Door",
                    image: "/assets/A8.png",
                    link: "/pages/store.html#the-black-bothy",
                    button: "Begin The Black Bothy",
                    external: false,
                    copy: "For readers who want silence, loss, bad weather, final recordings, and the feeling that somewhere empty has been waiting for them."
                },
                {
                    title: "The Drowned Fjord",
                    label: "Also Opens",
                    image: "/assets/A7.png",
                    link: "/pages/store.html#the-drowned-fjord",
                    button: "Continue to The Drowned Fjord",
                    external: false,
                    copy: "Cold water, buried history, grief, and the sense that something vast is waiting offshore."
                },
                {
                    title: "Dour Hill House",
                    label: "Also Opens",
                    image: "/assets/book1.jpg",
                    link: "/pages/store.html#dour-hill-house",
                    button: "Read Dour Hill House",
                    external: false,
                    copy: "A house full of pressure, old rooms, quiet dread, and something unresolved still moving through the walls."
                }
            ]
        },

        "uncanny-obsession": {
            mood: "Uncanny Obsession",
            copy: "Objects, desire, fixation, and the feeling of being chosen by something you do not understand.",
            primary: "The Red-Clad Collector",
            books: [
                {
                    title: "The Red-Clad Collector",
                    label: "Recommended Door",
                    image: "/assets/book11.png",
                    link: "https://www.amazon.co.uk/dp/B0G76MRK8R",
                    button: "Begin The Red-Clad Collector",
                    external: true,
                    copy: "For readers who want something strange, watchful, and quietly wrong. A story of collecting, wanting, taking, and the uneasy feeling that once something has noticed you, it does not easily let go."
                },
                {
                    title: "The Erased Archivist",
                    label: "Also Opens",
                    image: "/assets/A6.png",
                    link: "/pages/store.html#the-erased-archivist",
                    button: "Begin The Erased Archivist",
                    external: false,
                    copy: "Missing names, impossible records, fractured identity, and the horror of finding yourself rewritten."
                },
                {
                    title: "Holdfast",
                    label: "Also Opens",
                    image: "/assets/A5.png",
                    link: "/pages/holdfast.html",
                    button: "Unlock Holdfast File",
                    external: false,
                    copy: "Impossible broadcasts, altered memory, dead voices, and an Archive that remembers differently each time."
                }
            ]
        },

        "dark-and-twisted": {
            mood: "Dark and Twisted",
            copy: "Cruel turns, disturbed choices, and stories that go somewhere ugly.",
            primary: "Corrour Bothy",
            books: [
                {
                    title: "Corrour Bothy",
                    label: "Recommended Door",
                    image: "/assets/book2.jpg",
                    link: "/pages/store.html#corrour-bothy",
                    button: "Begin Corrour Bothy",
                    external: false,
                    copy: "For readers who want a bothy story with teeth. Harsher, stranger, and more disturbed."
                },
                {
                    title: "Red Streets",
                    label: "Also Opens",
                    image: "/assets/book10.jpg",
                    link: "/pages/store.html#red-streets",
                    button: "Begin Red Streets",
                    external: false,
                    copy: "Street-level violence, consequence, brutality, and no clean escape."
                },
                {
                    title: "The Scheme",
                    label: "Also Opens",
                    image: "/assets/book9.png",
                    link: "/pages/store.html#the-scheme",
                    button: "Begin The Scheme",
                    external: false,
                    copy: "Tension, survival, moral collapse, and lives forced against the wall."
                }
            ]
        },

        "bleak-coastal-dread": {
            mood: "Bleak Coastal Dread",
            copy: "Cold water, old secrets, grief, and landscapes that do not forgive.",
            primary: "The Drowned Fjord",
            books: [
                {
                    title: "The Drowned Fjord",
                    label: "Recommended Door",
                    image: "/assets/A7.png",
                    link: "/pages/store.html#the-drowned-fjord",
                    button: "Begin The Drowned Fjord",
                    external: false,
                    copy: "For readers who want cold water, buried history, grief, and the sense that something vast is waiting offshore."
                },
                {
                    title: "The Black Bothy",
                    label: "Also Opens",
                    image: "/assets/A8.png",
                    link: "/pages/store.html#the-black-bothy",
                    button: "Begin The Black Bothy",
                    external: false,
                    copy: "Remote silence, loss, bad weather, final recordings, and somewhere empty waiting."
                },
                {
                    title: "Holdfast",
                    label: "Also Opens",
                    image: "/assets/A5.png",
                    link: "/pages/holdfast.html",
                    button: "Unlock Holdfast File",
                    external: false,
                    copy: "Dead voices, altered memory, repetition, and the past refusing to stay buried."
                }
            ]
        },

        "identity-collapse": {
            mood: "Identity Collapse",
            copy: "Names, records, memories, and the terror of becoming uncertain to yourself.",
            primary: "The Erased Archivist",
            books: [
                {
                    title: "The Erased Archivist",
                    label: "Recommended Door",
                    image: "/assets/A6.png",
                    link: "/pages/store.html#the-erased-archivist",
                    button: "Begin The Erased Archivist",
                    external: false,
                    copy: "For readers who want missing names, impossible records, fractured identity, and the horror of finding yourself rewritten."
                },
                {
                    title: "Holdfast",
                    label: "Also Opens",
                    image: "/assets/A5.png",
                    link: "/pages/holdfast.html",
                    button: "Unlock Holdfast File",
                    external: false,
                    copy: "Records change. Memory no longer holds. The archive has begun to open."
                },
                {
                    title: "The Red-Clad Collector",
                    label: "Also Opens",
                    image: "/assets/book11.png",
                    link: "https://www.amazon.co.uk/dp/B0G76MRK8R",
                    button: "Begin The Red-Clad Collector",
                    external: true,
                    copy: "Something strange, watchful, and quietly wrong."
                }
            ]
        },

        "haunted-memory": {
            mood: "Haunted Memory",
            copy: "Dead voices, altered timelines, repetition, and the past refusing to stay buried.",
            primary: "Holdfast",
            books: [
                {
                    title: "Holdfast",
                    label: "Recommended Door",
                    image: "/assets/A5.png",
                    link: "/pages/holdfast.html",
                    button: "Unlock Holdfast File",
                    external: false,
                    copy: "For readers who want impossible broadcasts, altered memory, dead voices, and an Archive that remembers differently each time."
                },
                {
                    title: "The Erased Archivist",
                    label: "Also Opens",
                    image: "/assets/A6.png",
                    link: "/pages/store.html#the-erased-archivist",
                    button: "Begin The Erased Archivist",
                    external: false,
                    copy: "Impossible records, fractured identity, and the horror of finding yourself rewritten."
                },
                {
                    title: "The Black Bothy",
                    label: "Also Opens",
                    image: "/assets/A8.png",
                    link: "/pages/store.html#the-black-bothy",
                    button: "Begin The Black Bothy",
                    external: false,
                    copy: "Final recordings, remote silence, and the feeling that the land remembers."
                }
            ]
        },

        "domestic-haunting": {
            mood: "Domestic Haunting",
            copy: "Houses, families, pressure, damage, and rooms that remember too much.",
            primary: "Dour Hill House",
            books: [
                {
                    title: "Dour Hill House",
                    label: "Recommended Door",
                    image: "/assets/book1.jpg",
                    link: "/pages/store.html#dour-hill-house",
                    button: "Begin Dour Hill House",
                    external: false,
                    copy: "For readers who want a house full of pressure, old rooms, quiet dread, and something unresolved still moving through the walls."
                },
                {
                    title: "The Black Bothy",
                    label: "Also Opens",
                    image: "/assets/A8.png",
                    link: "/pages/store.html#the-black-bothy",
                    button: "Begin The Black Bothy",
                    external: false,
                    copy: "Remote shelter, bad weather, and somewhere that should have been empty."
                },
                {
                    title: "Love, Abused",
                    label: "Also Opens",
                    image: "/assets/book15.jpg",
                    link: "/pages/store.html#love-abused",
                    button: "Begin Love, Abused",
                    external: false,
                    copy: "Trauma, control, survival, and the human cost of being broken by someone else."
                }
            ]
        },

        "urban-pressure": {
            mood: "Urban Pressure",
            copy: "Tension, survival, moral collapse, and lives forced against the wall.",
            primary: "The Scheme",
            books: [
                {
                    title: "The Scheme",
                    label: "Recommended Door",
                    image: "/assets/book9.png",
                    link: "/pages/store.html#the-scheme",
                    button: "Begin The Scheme",
                    external: false,
                    copy: "For readers who want something sharper, street-level, tense, and close to real-world violence."
                },
                {
                    title: "Red Streets",
                    label: "Also Opens",
                    image: "/assets/book10.jpg",
                    link: "/pages/store.html#red-streets",
                    button: "Begin Red Streets",
                    external: false,
                    copy: "Violence, consequence, survival, and streets that do not forgive."
                },
                {
                    title: "Love, Abused",
                    label: "Also Opens",
                    image: "/assets/book15.jpg",
                    link: "/pages/store.html#love-abused",
                    button: "Begin Love, Abused",
                    external: false,
                    copy: "Pain, control, survival, and the human cost of abuse."
                }
            ]
        },

        "emotional-damage": {
            mood: "Emotional Damage",
            copy: "Trauma, control, survival, and the human cost of being broken by someone else.",
            primary: "Love, Abused",
            books: [
                {
                    title: "Love, Abused",
                    label: "Recommended Door",
                    image: "/assets/book15.jpg",
                    link: "/pages/store.html#love-abused",
                    button: "Begin Love, Abused",
                    external: false,
                    copy: "For readers who want dark fiction rooted in pain, control, survival, and the human cost of abuse."
                },
                {
                    title: "Dour Hill House",
                    label: "Also Opens",
                    image: "/assets/book1.jpg",
                    link: "/pages/store.html#dour-hill-house",
                    button: "Begin Dour Hill House",
                    external: false,
                    copy: "A house full of pressure, family damage, and something unresolved still moving through the walls."
                },
                {
                    title: "The Scheme",
                    label: "Also Opens",
                    image: "/assets/book9.png",
                    link: "/pages/store.html#the-scheme",
                    button: "Begin The Scheme",
                    external: false,
                    copy: "Survival, silence, control, and moral lines under pressure."
                }
            ]
        },

        "blood-on-the-pavement": {
            mood: "Blood on the Pavement",
            copy: "Street-level violence, consequence, brutality, and no clean escape.",
            primary: "Red Streets",
            books: [
                {
                    title: "Red Streets",
                    label: "Recommended Door",
                    image: "/assets/book10.jpg",
                    link: "/pages/store.html#red-streets",
                    button: "Begin Red Streets",
                    external: false,
                    copy: "For readers who want the darker edge of the city: violence, consequence, survival, and streets that do not forgive."
                },
                {
                    title: "The Scheme",
                    label: "Also Opens",
                    image: "/assets/book9.png",
                    link: "/pages/store.html#the-scheme",
                    button: "Begin The Scheme",
                    external: false,
                    copy: "Tension, survival, moral collapse, and lives forced against the wall."
                },
                {
                    title: "Corrour Bothy",
                    label: "Also Opens",
                    image: "/assets/book2.jpg",
                    link: "/pages/store.html#corrour-bothy",
                    button: "Begin Corrour Bothy",
                    external: false,
                    copy: "A harsher, stranger, more disturbed bothy story with teeth."
                }
            ]
        }
    };

    function initDarknessMap() {
        const map = document.querySelector("[data-darkness-map]");
        if (!map) return;

        const select = map.querySelector("[data-darkness-select]");
        const reveal = map.querySelector(".darkness-reveal");
        const revealMood = map.querySelector("[data-darkness-mood]");
        const revealPrimaryTitle = map.querySelector("[data-darkness-primary-title]");
        const revealCopy = map.querySelector("[data-darkness-copy]");
        const results = map.querySelector("[data-darkness-results]");

        if (!select || !reveal || !revealMood || !revealPrimaryTitle || !revealCopy || !results) {
            return;
        }

        const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

        function buildBookCard(book) {
            const article = document.createElement("article");
            article.className = "darkness-book-card";

            const target = book.external ? ' target="_blank"' : "";
            const rel = book.external ? ' rel="noopener noreferrer sponsored"' : "";

            article.innerHTML = `
                <div class="darkness-book-cover">
                    <img src="${book.image}" alt="${book.title} cover" loading="lazy">
                </div>

                <div class="darkness-book-copy">
                    <p class="darkness-book-label">${book.label}</p>
                    <h4>${book.title}</h4>
                    <p>${book.copy}</p>

                    <a href="${book.link}" class="button copper"${target}${rel}>
                        ${book.button}
                    </a>
                </div>
            `;

            return article;
        }

        function updateReveal(key) {
            const moodData = darknessMap[key];
            if (!moodData) return;

            const applyUpdate = () => {
                revealMood.textContent = moodData.mood;
                revealPrimaryTitle.textContent = moodData.primary;
                revealCopy.textContent = moodData.copy;

                results.innerHTML = "";

                moodData.books.forEach(book => {
                    results.appendChild(buildBookCard(book));
                });

                reveal.hidden = false;
                reveal.classList.remove("is-changing");
                reveal.classList.add("is-visible");
            };

            if (prefersReducedMotion) {
                applyUpdate();
                return;
            }

            reveal.classList.add("is-changing");

            window.setTimeout(applyUpdate, 170);
        }

        select.addEventListener("change", () => {
            updateReveal(select.value);

            window.setTimeout(() => {
                reveal.scrollIntoView({
                    behavior: prefersReducedMotion ? "auto" : "smooth",
                    block: "start"
                });
            }, 240);
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initDarknessMap);
    } else {
        initDarknessMap();
    }
})();
