// =========================
// NO-JS FIX
// =========================
document.documentElement.classList.remove("no-js");


// =========================
// LOAD HEADER + FOOTER
// =========================
async function loadHeader(type = "hero") {
 
    const fileMap = {
        hero: "header.html",
        simple: "header-simple.html"
    };

    const file = fileMap[type] || "header.html";

    try {
        const base = "/";

        // HEADER
        const headerRes = await fetch(`${base}${file}`);
        if (!headerRes.ok) throw new Error(`Failed to load ${file}`); 

        const headerHTML = await headerRes.text();
        const headerContainer = document.getElementById("header-placeholder");

        if (headerContainer) {
            headerContainer.innerHTML = headerHTML;
            initBlackwoodDropdownNav(headerContainer);
        }

        // FOOTER
        const footerRes = await fetch(`${base}footer.html`);
        if (!footerRes.ok) throw new Error("Failed to load footer");

        const footerHTML = await footerRes.text();
        const footerContainer = document.getElementById("footer-placeholder");

        if (footerContainer) {
            footerContainer.innerHTML = footerHTML;
        }

        // INIT SYSTEMS
        initScrollFade();
        initEntity();
        initFadeIn();
        initSpotlight();
        initGlobalLighting();
        initQuotes();
        initReviewRotator();

    } catch (err) {
        console.error("Layout load failed:", err);
    }
}


// =========================
// BLACKWOOD DROPDOWN NAV
// Works for both header.html and header-simple.html
// =========================
function initBlackwoodDropdownNav(headerContainer) {

    if (!headerContainer) return;

    const existingNav =
        headerContainer.querySelector("nav") ||
        headerContainer.querySelector(".nav") ||
        headerContainer.querySelector(".main-nav") ||
        headerContainer.querySelector(".site-nav") ||
        headerContainer.querySelector(".hero-nav") ||
        headerContainer.querySelector(".simple-nav") ||
        headerContainer.querySelector(".header-nav") ||
        headerContainer.querySelector(".nav-links");

    if (!existingNav) {
        console.warn("Blackwood nav not found. Dropdown nav was not injected.");
        return;
    }

    existingNav.classList.add("blackwood-nav");
    existingNav.setAttribute("aria-label", "Main navigation");

    existingNav.innerHTML = `
        <a href="/" class="blackwood-nav-link">Home</a>

        <a href="/pages/start-here.html" class="blackwood-nav-link">Start Here</a>

        <div class="blackwood-nav-item has-dropdown">
            <button
                class="blackwood-nav-link blackwood-dropdown-toggle"
                type="button"
                aria-expanded="false"
                aria-haspopup="true"
            >
                The Works
                <span class="dropdown-mark" aria-hidden="true">▾</span>
            </button>

            <div class="blackwood-dropdown" role="menu">
                <a href="/pages/publications.html" role="menuitem">All Works</a>
                <a href="/pages/archive-files.html" role="menuitem">The Archive Files</a>
                <a href="/pages/cursed-bothies.html" role="menuitem">The Cursed Bothies</a>
                <a href="/pages/hard-silence.html" role="menuitem">Hard Silence</a>
                <a href="/pages/standalone.html" role="menuitem">Independent Works</a>
                <a href="/pages/LimitedEditions.html" role="menuitem">Limited Editions</a>
            </div>
        </div>

        <a href="/pages/holdfast.html" class="blackwood-nav-link">Holdfast</a>
        
        <a href="/pages/store.html" class="blackwood-nav-link">Direct Editions</a>

        <div class="blackwood-nav-item has-dropdown">
            <button
                class="blackwood-nav-link blackwood-dropdown-toggle"
                type="button"
                aria-expanded="false"
                aria-haspopup="true"
            >
                Reading
                <span class="dropdown-mark" aria-hidden="true">▾</span>
            </button>

            <div class="blackwood-dropdown" role="menu">
                <a href="/pages/reading-lists.html" role="menuitem">Reading Lists</a>
                <a href="/pages/editors-picks.html" role="menuitem">Marked for Record</a>
                <a href="/pages/recovered-files.html" role="menuitem">Recovered Files</a>
                <a href="/pages/reader-records.html" role="menuitem">Reader Records</a>
            </div>
        </div>

        <div class="blackwood-nav-item has-dropdown">
            <button
                class="blackwood-nav-link blackwood-dropdown-toggle"
                type="button"
                aria-expanded="false"
                aria-haspopup="true"
            >
                About
                <span class="dropdown-mark" aria-hidden="true">▾</span>
            </button>

            <div class="blackwood-dropdown" role="menu">
    <a href="/pages/author.html" role="menuitem">Aidan Blackwood</a>
    <a href="/pages/miren-vale.html" role="menuitem">Miren Vale</a>
    <a href="/pages/about.html" role="menuitem">About Blackwood</a>
    <a href="/pages/contact.html" role="menuitem">Contact</a>
</div>

        <a href="/pages/CommunitySpotlight.html" class="blackwood-nav-link">Community</a>
    `;

    const dropdownItems = existingNav.querySelectorAll(".has-dropdown");

    function closeAllDropdowns() {
        dropdownItems.forEach((item) => {
            const button = item.querySelector(".blackwood-dropdown-toggle");

            item.classList.remove("is-open");

            if (button) {
                button.setAttribute("aria-expanded", "false");
            }
        });
    }

    dropdownItems.forEach((item) => {

        const button = item.querySelector(".blackwood-dropdown-toggle");
        const dropdown = item.querySelector(".blackwood-dropdown");

        if (!button || !dropdown) return;

        button.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();

            const isOpen = item.classList.contains("is-open");

            closeAllDropdowns();

            item.classList.toggle("is-open", !isOpen);
            button.setAttribute("aria-expanded", String(!isOpen));
        });

        button.addEventListener("keydown", (event) => {

            if (event.key === "Escape") {
                item.classList.remove("is-open");
                button.setAttribute("aria-expanded", "false");
                button.focus();
            }

            if (event.key === "ArrowDown") {
                event.preventDefault();

                closeAllDropdowns();

                item.classList.add("is-open");
                button.setAttribute("aria-expanded", "true");

                const firstDropdownLink = dropdown.querySelector("a");

                if (firstDropdownLink) {
                    firstDropdownLink.focus();
                }
            }
        });

        dropdown.addEventListener("keydown", (event) => {

            if (event.key === "Escape") {
                item.classList.remove("is-open");
                button.setAttribute("aria-expanded", "false");
                button.focus();
            }
        });
    });

    document.addEventListener("click", closeAllDropdowns);

    existingNav.addEventListener("click", (event) => {
        event.stopPropagation();
    });
}
// =========================
// GLOBAL CURSOR LIGHTING
// =========================
function initGlobalLighting() {

    const root = document.documentElement;

    let mouseX = 50;
    let mouseY = 50;

    let currentX = 50;
    let currentY = 50;

    function updateMouse(e) {
        mouseX = (e.clientX / window.innerWidth) * 100;
        mouseY = (e.clientY / window.innerHeight) * 100;
    }

    function animate() {
        currentX += (mouseX - currentX) * 0.08;
        currentY += (mouseY - currentY) * 0.08;

        root.style.setProperty("--mouse-x", `${currentX}%`);
        root.style.setProperty("--mouse-y", `${currentY}%`);

        requestAnimationFrame(animate);
    }

    window.addEventListener("mousemove", updateMouse);
    animate();
}


// =========================
// SCROLL FADE SYSTEM
// =========================
function initScrollFade() {

    let ticking = false;

    function update() {

        const featured = document.querySelector(".featured");
        const hero = document.querySelector(".hero");
        const works = document.querySelector(".works");

        let progress = 0;

        if (featured) {
            const rect = featured.getBoundingClientRect();

            const start = window.innerHeight * 0.9;
            const end = window.innerHeight * 0.3;

            progress = (start - rect.top) / (start - end);
            progress = Math.max(0, Math.min(1, progress));

            featured.style.setProperty("--fadeIn", progress);
        }

        if (hero) {
            hero.style.setProperty("--fadeOut", progress * 0.8);
        }

        if (works) {
            const rect = works.getBoundingClientRect();

            const start = window.innerHeight * 1.1;
            const end = window.innerHeight * 0.5;

            let fade = (start - rect.top) / (start - end);
            fade = Math.max(0, Math.min(1, fade));

            works.style.setProperty("--sectionFade", fade);
        }

        ticking = false;
    }

    window.addEventListener("scroll", () => {
        if (!ticking) {
            requestAnimationFrame(update);
            ticking = true;
        }
    });

    update();
}


// =========================
// ENTITY REVEAL
// =========================
function initEntity() {

    const entity = document.querySelector(".entity");
    if (!entity) return;

    function triggerEntity() {

        const delay = Math.random() * 9000 + 3000;

        setTimeout(() => {

            entity.classList.add("active");

            const visibleTime = Math.random() * 3000 + 2000;

            setTimeout(() => {
                entity.classList.remove("active");
                triggerEntity();
            }, visibleTime);

        }, delay);
    }

    triggerEntity();
}


// =========================
// FADE-IN SYSTEM
// =========================
function initFadeIn() {

    const elements = document.querySelectorAll(".fade-in, .work");

    if (!elements.length) return;

    const observer = new IntersectionObserver((entries) => {

        entries.forEach((entry) => {

            if (entry.isIntersecting) {
                entry.target.classList.add("visible");
                observer.unobserve(entry.target);
            }
        });

    }, { threshold: 0.2 });

    elements.forEach((el, index) => {
        el.style.transitionDelay = `${index * 120}ms`;
        observer.observe(el);
    });
}


// =========================
// SPOTLIGHT SYSTEM
// =========================
function initSpotlight() {

    const works = document.querySelector(".works");
    if (!works) return;

    works.addEventListener("mousemove", (e) => {

        const rect = works.getBoundingClientRect();

        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;

        works.style.setProperty("--mouse-x", `${x}%`);
        works.style.setProperty("--mouse-y", `${y}%`);
    });
}


// =========================
// BACKGROUND QUOTES SYSTEM
// =========================
function initQuotes() {

    const quotes = [
        "Some places keep what they take.",
        "The sea went wrong. It looks back.",
        "The mirror watches.",
        "Do you remember me?",
        "Sleep meant forgetting.",
        "He is not alone.",
        "It looks back.",
        "That silence after a secret.",
        "It was never not empty."
    ];

    const fragments = [
        document.getElementById("q1"),
        document.getElementById("q2"),
        document.getElementById("q3"),
        document.getElementById("q4")
    ];

    const watcher = document.getElementById("quote-watcher");

    if (fragments.some(el => !el) || !watcher) return;

    function renderText(el, text) {

        el.innerHTML = "";

        const words = text.split(" ");

        words.forEach((word, i) => {

            const span = document.createElement("span");

            const clean = word.toLowerCase().replace(/[.?]/g, "");
            const emphasisWords = ["remember", "alone", "wrong", "watches", "empty", "back"];

            span.className = emphasisWords.includes(clean)
                ? "word emphasis"
                : "word";

            if (Math.random() < 0.35) {
                span.classList.add("distort");
            }

            span.textContent = word + " ";
            span.style.animationDelay = `${i * 0.2}s`;

            el.appendChild(span);
        });
    }

    let lastIndex = -1;

    function updateFragment() {

        let index;

        do {
            index = Math.floor(Math.random() * fragments.length);
        } while (index === lastIndex);

        lastIndex = index;

        const el = fragments[index];
        const quote = quotes[Math.floor(Math.random() * quotes.length)];

        const side = Math.random() < 0.5 ? "left" : "right";
        const top = Math.random() * 70 + 10;
        const offset = Math.random() * 10 + 5;

        if (side === "left") {
            el.style.left = `${offset}%`;
            el.style.right = "auto";
        } else {
            el.style.right = `${offset}%`;
            el.style.left = "auto";
        }

        el.style.top = `${top}%`;

        const rotation = (Math.random() - 0.5) * 6;
        el.style.setProperty("--rot", `${rotation}deg`);

        el.style.animationDuration =
            `${18 + Math.random() * 6}s, ${10 + Math.random() * 6}s`;

        renderText(el, quote);
    }

    function loopFragments() {
        updateFragment();

        const next = Math.random() * 2000 + 1500;
        setTimeout(loopFragments, next);
    }

    function triggerWatcher() {

        const text = quotes[Math.floor(Math.random() * quotes.length)];
        renderText(watcher, text);

        watcher.style.opacity = 1;

        function move(e) {
            const x = (e.clientX / window.innerWidth - 0.5) * 40;
            const y = (e.clientY / window.innerHeight - 0.5) * 40;

            watcher.style.transform =
                `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
        }

        document.addEventListener("mousemove", move);

        const glitchInterval = setInterval(() => {
            watcher.classList.add("glitch");

            setTimeout(() => {
                watcher.classList.remove("glitch");
            }, 120);

        }, Math.random() * 2000 + 1000);

        setTimeout(() => {
            watcher.classList.add("decay");

            setTimeout(() => {
                watcher.classList.remove("decay");
            }, 700);
        }, Math.random() * 2500 + 1500);

        setTimeout(() => {
            watcher.style.opacity = 0;
            document.removeEventListener("mousemove", move);
            clearInterval(glitchInterval);
        }, 4000);
    }

    updateFragment();
    updateFragment();

    loopFragments();

    setInterval(() => {
        if (Math.random() < 0.4) {
            triggerWatcher();
        }
    }, 6000);
}


// =========================
// REVIEW ROTATOR
// =========================
function initReviewRotator() {

    const containers = document.querySelectorAll(".review-snippet");
    if (!containers.length) return;

    const reviews = {

        corrour: [
            { text: "This book didn’t just tell a story. It gave me feelings I cannot shake.", source: "Reader Review" },
            { text: "Slow, insidious unraveling that never lets you feel safe.", source: "Reader Review" },
            { text: "The landscape feels alive. Watching. Waiting.", source: "Reader Review" },
            { text: "It gets into your bones like the cold.", source: "Reader Review" },
            { text: "An eerie, isolated nightmare that unsettles more with what it doesn’t explain.", source: "Reader Review" },
            { text: "Atmosphere so thick you feel trapped in the bothy with them.", source: "Reader Review" },
            { text: "Short, clipped tension that builds into something deeply unsettling.", source: "Reader Review" },
            { text: "A slow-burn horror where the setting becomes something far more sinister.", source: "Reader Review" },
            { text: "Relentless unease from the first page, never letting you fully relax.", source: "Reader Review" },
            { text: "Silence, isolation, and dread woven into every page.", source: "Reader Review" },
            { text: "Creeping terror that lingers long after the final twist.", source: "Reader Review" },
            { text: "An oppressive, desolate setting that makes escape feel impossible.", source: "Reader Review" },
            { text: "Disturbing, atmospheric horror that thrives on ambiguity.", source: "Reader Review" },
            { text: "A chilling premise elevated by tension, restraint, and a haunting finish.", source: "Reader Review" },
            { text: "Unnerving, immersive, and deeply claustrophobic.", source: "Reader Review" },
            { text: "A haunting, slow-build story where fear seeps in from every direction.", source: "Reader Review" }
        ],

        archive: [
            { text: "Creepy, atmospheric read. I finished one and started the next immediately.", source: "Reader Review" },
            { text: "It gets under your skin. No cheap scares, just a steady unraveling.", source: "Reader Review" },
            { text: "A gripping, slow-burn descent that’s impossible to put down.", source: "Reader Review" },
            { text: "Atmosphere so vivid it pulls you straight into the cold, silent landscape.", source: "Reader Review" },
            { text: "Creeping dread that builds quietly, then refuses to let go.", source: "Reader Review" },
            { text: "A haunting exploration of memory, loss, and things that shouldn’t be forgotten.", source: "Reader Review" },
            { text: "Unsettling, disorienting, and deeply immersive.", source: "Reader Review" },
            { text: "A tense, labyrinthine story that keeps circling back in unexpected ways.", source: "Reader Review" },
            { text: "Quiet horror that seeps in slowly and lingers long after.", source: "Reader Review" },
            { text: "An eerie, thought-provoking journey where nothing feels entirely real.", source: "Reader Review" },
            { text: "Claustrophobic, cold, and filled with a constant sense of being watched.", source: "Reader Review" },
            { text: "A chilling blend of psychological depth and creeping supernatural dread.", source: "Reader Review" },
            { text: "Unnerving and atmospheric, with tension that never fully releases.", source: "Reader Review" },
            { text: "A story that gets under your skin and stays there.", source: "Reader Review" },
            { text: "Bleak, beautiful, and quietly terrifying.", source: "Reader Review" },
            { text: "A compulsive read that pulls you deeper with every page.", source: "Reader Review" }
        ],

        "hard-silence": [
            { text: "A gripping thriller — raw, brutal and unflinching.", source: "Reader Review" },
            { text: "Very dark and menacing, but addictive in its own way.", source: "Reader Review" },
            { text: "A brutal, tension-filled thriller that grips from the first page to the last.", source: "Reader Review" },
            { text: "Dark, violent, and relentlessly suspenseful.", source: "Reader Review" },
            { text: "A raw and unflinching story of revenge that doesn’t pull its punches.", source: "Reader Review" },
            { text: "Gritty, intense, and emotionally charged.", source: "Reader Review" },
            { text: "A slow-burning descent into vengeance and isolation.", source: "Reader Review" },
            { text: "Uncompromising, menacing, and impossible to ignore.", source: "Reader Review" },
            { text: "A gripping, hard-hitting read that keeps the tension high throughout.", source: "Reader Review" },
            { text: "Violent, atmospheric, and deeply unsettling.", source: "Reader Review" },
            { text: "A bleak, addictive journey driven by pain, rage, and survival.", source: "Reader Review" },
            { text: "Sharp, unfiltered writing that brings every moment to life.", source: "Reader Review" },
            { text: "A dark psychological thriller that lingers long after the final page.", source: "Reader Review" },
            { text: "Relentless, gripping, and full of unexpected turns.", source: "Reader Review" },
            { text: "A haunting story of justice, control, and the cost of revenge.", source: "Reader Review" },
            { text: "Compulsive, brutal, and impossible to put down.", source: "Reader Review" }
        ],

        standalone: [
            { text: "Quietly unsettling and deeply personal.", source: "Reader Review" },
            { text: "Lingers long after the final page.", source: "Reader Review" },
            { text: "A haunting gothic nightmare where the house itself feels alive.", source: "Reader Review" },
            { text: "Slow-burning dread that builds into something truly disturbing.", source: "Reader Review" },
            { text: "A sinister, atmospheric tale that keeps you constantly on edge.", source: "Reader Review" },
            { text: "Classic gothic horror with a modern, brutal edge.", source: "Reader Review" },
            { text: "An intense, fast-paced descent into supernatural terror.", source: "Reader Review" },
            { text: "A chilling story where nothing is as simple as it first appears.", source: "Reader Review" },
            { text: "Creeping tension, eerie detail, and a deeply unsettling presence.", source: "Reader Review" },
            { text: "A dark, immersive read that lingers long after the final page.", source: "Reader Review" },
            { text: "A disturbing, claustrophobic horror driven by something watching from within.", source: "Reader Review" },
            { text: "An unforgettable ending that leaves you reeling.", source: "Reader Review" },
            { text: "A sinister house, a haunting past, and a relentless sense of dread.", source: "Reader Review" },
            { text: "Atmospheric, eerie, and packed with unsettling twists.", source: "Reader Review" }
        ]
    };

    containers.forEach(container => {

        if (container.classList.contains("static-review")) return;

        const book = container.dataset.book;

        const activeReviews = reviews[book] || [
            {
                text: "Each book feels like a place you shouldn’t have found.",
                source: "Reader Review"
            }
        ];

        let index = 0;

        function showReview(i) {

            const review = activeReviews[i];

            container.style.opacity = 0;

            setTimeout(() => {
                container.innerHTML = `
                    <p>"${review.text}"</p>
                    <span class="quote-source">— ${review.source}</span>
                `;
                container.style.opacity = 1;
            }, 300);
        }

        function rotate() {
            index = (index + 1) % activeReviews.length;
            showReview(index);
        }

        showReview(index);

        if (activeReviews.length > 1) {
            setInterval(rotate, 5000);
        }
    });
}
