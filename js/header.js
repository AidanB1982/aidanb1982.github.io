// =========================
// BLACKWOOD GLOBAL HEADER JS
// Loads shared header/footer, dropdown nav, page effects,
// footer signup, and Blackwood Circle access.
// =========================

(function () {
    "use strict";

    // =========================
    // NO-JS FIX
    // =========================

    document.documentElement.classList.remove("no-js");

    // =========================
    // AUTO START
    // =========================

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initialiseBlackwoodLayout);
    } else {
        initialiseBlackwoodLayout();
    }

    async function initialiseBlackwoodLayout() {
        const hasHeaderPlaceholder = document.getElementById("header-placeholder");
        const hasFooterPlaceholder = document.getElementById("footer-placeholder");

        if (hasHeaderPlaceholder || hasFooterPlaceholder) {
            const headerType = getHeaderTypeForCurrentPage();
            await loadHeader(headerType);
        } else {
            safeInit(initBlackwoodCircleAccess, "Blackwood Circle access");
            safeInit(initScrollFade, "scroll fade");
            safeInit(initEntity, "entity");
            safeInit(initFadeIn, "fade in");
            safeInit(initSpotlight, "spotlight");
            safeInit(initGlobalLighting, "global lighting");
            safeInit(initQuotes, "quotes");
            safeInit(initReviewRotator, "review rotator");
        }
    }

    function getHeaderTypeForCurrentPage() {
        const path = window.location.pathname.toLowerCase();

        if (
            path === "/" ||
            path.endsWith("/index.html")
        ) {
            return "hero";
        }

        return "simple";
    }

    function safeInit(callback, label) {
        try {
            callback();
        } catch (error) {
            console.warn(`Blackwood ${label} failed:`, error);
        }
    }

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
            const headerContainer = document.getElementById("header-placeholder");
            const footerContainer = document.getElementById("footer-placeholder");

            if (headerContainer) {
                const headerHTML = await fetchSharedHtml(`/${file}`);
                headerContainer.innerHTML = headerHTML;
                initBlackwoodDropdownNav(headerContainer);
            }

            if (footerContainer) {
                const footerHTML = await fetchSharedHtml("/footer.html");
                footerContainer.innerHTML = footerHTML;
                initFooterArchiveSignup(footerContainer);
            }

            safeInit(initBlackwoodCircleAccess, "Blackwood Circle access");
            safeInit(initScrollFade, "scroll fade");
            safeInit(initEntity, "entity");
            safeInit(initFadeIn, "fade in");
            safeInit(initSpotlight, "spotlight");
            safeInit(initGlobalLighting, "global lighting");
            safeInit(initQuotes, "quotes");
            safeInit(initReviewRotator, "review rotator");

        } catch (error) {
            console.error("Layout load failed:", error);

            safeInit(initBlackwoodCircleAccess, "Blackwood Circle access");
            safeInit(initFadeIn, "fade in fallback");
        }
    }

    async function fetchSharedHtml(filePath) {
        const response = await fetch(filePath, {
            cache: "no-store"
        });

        if (!response.ok) {
            throw new Error(`Failed to load ${filePath}`);
        }

        return response.text();
    }

    // =========================
    // FOOTER ARCHIVE SIGNUP
    // =========================

    function initFooterArchiveSignup(footerContainer) {
        if (!footerContainer) return;

        const form = footerContainer.querySelector(".footer-ml-form");

        if (!form || form.dataset.initialised === "true") return;

        form.dataset.initialised = "true";

        const emailInput = form.querySelector("input[type='email']");
        const submitButton = form.querySelector("button[type='submit']");

        let status = footerContainer.querySelector("#footer-archive-status");

        if (!status) {
            status = footerContainer.querySelector(".footer-archive-note");
        }

        if (!status) {
            status = document.createElement("p");
            status.className = "footer-archive-note";
            form.insertAdjacentElement("afterend", status);
        }

        status.setAttribute("aria-live", "polite");

        let iframe = footerContainer.querySelector('iframe[name="footer-mailerlite-frame"]');

        if (!iframe) {
            iframe = document.createElement("iframe");
            iframe.name = "footer-mailerlite-frame";
            iframe.title = "Mailing list signup";
            iframe.style.display = "none";
            form.insertAdjacentElement("afterend", iframe);
        }

        form.setAttribute("target", "footer-mailerlite-frame");
        form.setAttribute("method", "post");
        form.setAttribute("accept-charset", "utf-8");

        ensureHiddenInput(form, "ml-submit", "1");
        ensureHiddenInput(form, "anticsrf", "true");

        const originalButtonText = submitButton
            ? submitButton.textContent.trim()
            : "Join the Archive";

        let hasSubmitted = false;
        let fallbackTimer = null;
        let resetButtonTimer = null;

        function setStatus(message, type) {
            status.textContent = message;
            status.classList.remove("is-success", "is-error", "is-loading");

            if (type) {
                status.classList.add(type);
            }
        }

        function resetButtonSoon() {
            if (!submitButton) return;

            window.clearTimeout(resetButtonTimer);

            resetButtonTimer = window.setTimeout(() => {
                submitButton.disabled = false;
                submitButton.textContent = originalButtonText;
            }, 2600);
        }

        function finishSignup() {
            if (!hasSubmitted) return;

            hasSubmitted = false;

            window.clearTimeout(fallbackTimer);

            setStatus(
                "Thank you. Check your inbox to confirm your place in the Archive.",
                "is-success"
            );

            form.reset();

            if (submitButton) {
                submitButton.textContent = "Filed";
            }

            resetButtonSoon();
        }

        form.addEventListener("submit", event => {
            if (!emailInput || !emailInput.checkValidity()) {
                event.preventDefault();

                setStatus("Please enter a valid email address.", "is-error");

                if (emailInput) {
                    emailInput.focus();
                }

                return;
            }

            hasSubmitted = true;

            setStatus("Filing your request...", "is-loading");

            if (submitButton) {
                submitButton.disabled = true;
                submitButton.textContent = "Filing...";
            }

            window.clearTimeout(fallbackTimer);

            fallbackTimer = window.setTimeout(() => {
                finishSignup();
            }, 3200);
        });

        iframe.addEventListener("load", () => {
            if (!hasSubmitted) return;

            finishSignup();
        });
    }

    function ensureHiddenInput(form, name, value) {
        let input = form.querySelector(`input[name="${name}"]`);

        if (!input) {
            input = document.createElement("input");
            input.type = "hidden";
            input.name = name;
            form.appendChild(input);
        }

        input.value = value;
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
                    class="blackwood-nav-link blackwood-nav-button blackwood-dropdown-toggle"
                    type="button"
                    aria-expanded="false"
                    aria-haspopup="true"
                >
                    New Releases
                    <span class="dropdown-mark" aria-hidden="true">▾</span>
                </button>

                <div class="blackwood-dropdown blackwood-dropdown-releases" role="menu" aria-label="New releases">
                    <a
                        href="/pages/holdfast.html"
                        role="menuitem"
                        class="blackwood-dropdown-feature"
                        aria-label="Holdfast, Book Four of The Archive Files"
                    >
                        <span class="blackwood-dropdown-title">HOLDFAST</span>
                        <span class="blackwood-dropdown-subtitle">Book Four of The Archive Files</span>
                    </a>

                    <a
                        href="/pages/miren-vale.html"
                        role="menuitem"
                        class="blackwood-dropdown-feature"
                        aria-label="The Crossing, a dark literary fantasy by Miren Vale"
                    >
                        <span class="blackwood-dropdown-title">THE CROSSING</span>
                        <span class="blackwood-dropdown-subtitle">A dark literary fantasy by Miren Vale</span>
                    </a>
                </div>
            </div>

            <div class="blackwood-nav-item has-dropdown">
                <button
                    class="blackwood-nav-link blackwood-nav-button blackwood-dropdown-toggle"
                    type="button"
                    aria-expanded="false"
                    aria-haspopup="true"
                >
                    The Books
                    <span class="dropdown-mark" aria-hidden="true">▾</span>
                </button>

                <div class="blackwood-dropdown" role="menu" aria-label="The Books">
                    <a href="/pages/publications.html" role="menuitem">All Publications</a>
                    <a href="/pages/archive-files.html" role="menuitem">The Archive Files</a>
                    <a href="/pages/cursed-bothies.html" role="menuitem">The Cursed Bothies</a>
                    <a href="/pages/hard-silence.html" role="menuitem">Hard Silence</a>
                    <a href="/pages/standalone.html" role="menuitem">Independent Works</a>
                    <a href="/pages/LimitedEditions.html" role="menuitem">Limited Editions</a>
                </div>
            </div>

            <a href="/pages/store.html" class="blackwood-nav-link">Store</a>

            <div class="blackwood-nav-item has-dropdown">
                <button
                    class="blackwood-nav-link blackwood-nav-button blackwood-dropdown-toggle"
                    type="button"
                    aria-expanded="false"
                    aria-haspopup="true"
                >
                    Reading
                    <span class="dropdown-mark" aria-hidden="true">▾</span>
                </button>

                <div class="blackwood-dropdown" role="menu" aria-label="Reading">
                    <a href="/pages/reading-lists.html" role="menuitem">Recommended Reads</a>
                    <a href="/pages/editors-picks.html" role="menuitem">Editor Picks</a>
                    <a href="/pages/recovered-files.html" role="menuitem">Short Reads</a>
                    <a href="/pages/reader-records.html" role="menuitem">Reader Records</a>
                </div>
            </div>

            <div class="blackwood-nav-item has-dropdown">
                <button
                    class="blackwood-nav-link blackwood-nav-button blackwood-dropdown-toggle"
                    type="button"
                    aria-expanded="false"
                    aria-haspopup="true"
                >
                    About
                    <span class="dropdown-mark" aria-hidden="true">▾</span>
                </button>

                <div class="blackwood-dropdown" role="menu" aria-label="About">
                    <a href="/pages/author.html" role="menuitem">Aidan Blackwood</a>
                    <a href="/pages/miren-vale.html" role="menuitem">Miren Vale</a>
                    <a href="/pages/appearances.html" role="menuitem">Appearances</a>
                    <a href="/pages/about.html" role="menuitem">About Blackwood</a>
                    <a href="/pages/contact.html" role="menuitem">Contact</a>
                </div>
            </div>

            <div class="blackwood-nav-item has-dropdown">
                <button
                    class="blackwood-nav-link blackwood-nav-button blackwood-dropdown-toggle"
                    type="button"
                    aria-expanded="false"
                    aria-haspopup="true"
                >
                    Community
                    <span class="dropdown-mark" aria-hidden="true">▾</span>
                </button>

                <div class="blackwood-dropdown" role="menu" aria-label="Community">
                    <a href="/pages/arc-team.html" role="menuitem">ARC Team</a>
                    <a href="/pages/CommunitySpotlight.html" role="menuitem">Community Spotlight</a>
                    <a href="/pages/members.html" role="menuitem">The Blackwood Circle</a>
                </div>
            </div>
        `;

        const dropdownItems = existingNav.querySelectorAll(".has-dropdown");

        function closeAllDropdowns() {
            dropdownItems.forEach(item => {
                const button = item.querySelector(".blackwood-dropdown-toggle");

                item.classList.remove("is-open");

                if (button) {
                    button.setAttribute("aria-expanded", "false");
                }
            });
        }

        dropdownItems.forEach(item => {
            const button = item.querySelector(".blackwood-dropdown-toggle");
            const dropdown = item.querySelector(".blackwood-dropdown");

            if (!button || !dropdown) return;

            button.addEventListener("click", event => {
                event.preventDefault();
                event.stopPropagation();

                const isOpen = item.classList.contains("is-open");

                closeAllDropdowns();

                item.classList.toggle("is-open", !isOpen);
                button.setAttribute("aria-expanded", String(!isOpen));
            });

            button.addEventListener("keydown", event => {
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

            dropdown.addEventListener("keydown", event => {
                if (event.key === "Escape") {
                    item.classList.remove("is-open");
                    button.setAttribute("aria-expanded", "false");
                    button.focus();
                }
            });
        });

        document.addEventListener("click", closeAllDropdowns);

        existingNav.addEventListener("click", event => {
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

        function updateMouse(event) {
            mouseX = (event.clientX / window.innerWidth) * 100;
            mouseY = (event.clientY / window.innerHeight) * 100;
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

        const observer = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add("visible");
                    observer.unobserve(entry.target);
                }
            });
        }, {
            threshold: 0.2
        });

        elements.forEach((element, index) => {
            element.style.transitionDelay = `${index * 120}ms`;
            observer.observe(element);
        });
    }

    // =========================
    // SPOTLIGHT SYSTEM
    // =========================

    function initSpotlight() {
        const works = document.querySelector(".works");

        if (!works) return;

        works.addEventListener("mousemove", event => {
            const rect = works.getBoundingClientRect();

            const x = ((event.clientX - rect.left) / rect.width) * 100;
            const y = ((event.clientY - rect.top) / rect.height) * 100;

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

        if (fragments.some(element => !element) || !watcher) return;

        function renderText(element, text) {
            element.innerHTML = "";

            const words = text.split(" ");

            words.forEach((word, index) => {
                const span = document.createElement("span");

                const clean = word.toLowerCase().replace(/[.?]/g, "");
                const emphasisWords = ["remember", "alone", "wrong", "watches", "empty", "back"];

                span.className = emphasisWords.includes(clean)
                    ? "word emphasis"
                    : "word";

                if (Math.random() < 0.35) {
                    span.classList.add("distort");
                }

                span.textContent = `${word} `;
                span.style.animationDelay = `${index * 0.2}s`;

                element.appendChild(span);
            });
        }

        let lastIndex = -1;

        function updateFragment() {
            let index;

            do {
                index = Math.floor(Math.random() * fragments.length);
            } while (index === lastIndex);

            lastIndex = index;

            const element = fragments[index];
            const quote = quotes[Math.floor(Math.random() * quotes.length)];

            const side = Math.random() < 0.5 ? "left" : "right";
            const top = Math.random() * 70 + 10;
            const offset = Math.random() * 10 + 5;

            if (side === "left") {
                element.style.left = `${offset}%`;
                element.style.right = "auto";
            } else {
                element.style.right = `${offset}%`;
                element.style.left = "auto";
            }

            element.style.top = `${top}%`;

            const rotation = (Math.random() - 0.5) * 6;
            element.style.setProperty("--rot", `${rotation}deg`);

            element.style.animationDuration =
                `${18 + Math.random() * 6}s, ${10 + Math.random() * 6}s`;

            renderText(element, quote);
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

            function move(event) {
                const x = (event.clientX / window.innerWidth - 0.5) * 40;
                const y = (event.clientY / window.innerHeight - 0.5) * 40;

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
                { text: "It gets into your bones like the cold.", source: "Reader Review" }
            ],

            archive: [
                { text: "Creepy, atmospheric read. I finished one and started the next immediately.", source: "Reader Review" },
                { text: "It gets under your skin. No cheap scares, just a steady unraveling.", source: "Reader Review" },
                { text: "A gripping, slow-burn descent that’s impossible to put down.", source: "Reader Review" },
                { text: "Atmosphere so vivid it pulls you straight into the cold, silent landscape.", source: "Reader Review" }
            ],

            "hard-silence": [
                { text: "A gripping thriller — raw, brutal and unflinching.", source: "Reader Review" },
                { text: "Very dark and menacing, but addictive in its own way.", source: "Reader Review" },
                { text: "A brutal, tension-filled thriller that grips from the first page to the last.", source: "Reader Review" },
                { text: "Dark, violent, and relentlessly suspenseful.", source: "Reader Review" }
            ],

            standalone: [
                { text: "Quietly unsettling and deeply personal.", source: "Reader Review" },
                { text: "Lingers long after the final page.", source: "Reader Review" },
                { text: "A haunting gothic nightmare where the house itself feels alive.", source: "Reader Review" },
                { text: "Slow-burning dread that builds into something truly disturbing.", source: "Reader Review" }
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

            function showReview(reviewIndex) {
                const review = activeReviews[reviewIndex];

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

    // =========================
    // BLACKWOOD CIRCLE ACCESS
    // Smart top-right member access link
    // Signed out: The Circle
    // Signed in: My Circle · points
    // =========================

    const CIRCLE_ACCESS_CONFIG = {
        supabaseUrl: "https://bmnlynjldlnxfvunqbqq.supabase.co",
        supabaseKey: "sb_publishable_eL7qdDe_6XWGhzmdsql_7w_7dg6psC0",
        membersPageUrl: "/pages/members.html",
        supabaseCdn: "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"
    };

    let circleClient = null;
    let circleRefreshId = 0;
    let circleAccessStarted = false;

    function initBlackwoodCircleAccess() {
        if (circleAccessStarted) return;

        circleAccessStarted = true;

        const circleLink = getOrCreateCircleAccessLink();

        renderCircleSignedOut(circleLink);
        startCircleSessionWatcher(circleLink);
    }

    function getOrCreateCircleAccessLink() {
        const existingLink = document.querySelector(".blackwood-circle-access");

        if (existingLink) {
            return existingLink;
        }

        const circleLink = document.createElement("a");
        circleLink.className = "blackwood-circle-access";
        circleLink.href = CIRCLE_ACCESS_CONFIG.membersPageUrl;
        circleLink.setAttribute("aria-label", "Open The Blackwood Circle member area");

        document.body.appendChild(circleLink);

        return circleLink;
    }

    async function startCircleSessionWatcher(circleLink) {
        try {
            await loadCircleSupabaseLibrary();

            circleClient = window.supabase.createClient(
                CIRCLE_ACCESS_CONFIG.supabaseUrl,
                CIRCLE_ACCESS_CONFIG.supabaseKey,
                {
                    auth: {
                        persistSession: true,
                        autoRefreshToken: true,
                        detectSessionInUrl: true
                    }
                }
            );

            const { data, error } = await circleClient.auth.getSession();

            if (error) {
                throw error;
            }

            await updateCircleAccessFromSession(circleLink, data.session || null);

            circleClient.auth.onAuthStateChange((_event, session) => {
                updateCircleAccessFromSession(circleLink, session || null);
            });

            window.addEventListener("focus", () => {
                refreshCircleAccess(circleLink);
            });

        } catch (error) {
            console.warn("Blackwood Circle access could not check member session:", error);
            renderCircleSignedOut(circleLink);
        }
    }

    async function refreshCircleAccess(circleLink) {
        if (!circleClient) return;

        try {
            const { data, error } = await circleClient.auth.getSession();

            if (error) {
                throw error;
            }

            await updateCircleAccessFromSession(circleLink, data.session || null);

        } catch (error) {
            console.warn("Blackwood Circle access refresh failed:", error);
        }
    }

    async function updateCircleAccessFromSession(circleLink, session) {
        const currentRefreshId = ++circleRefreshId;

        if (!session || !session.user) {
            renderCircleSignedOut(circleLink);
            return;
        }

        renderCircleLoading(circleLink);

        try {
            const { data, error } = await circleClient
                .from("member_profiles")
                .select("display_name, reader_name, points_total, member_tier")
                .eq("id", session.user.id)
                .maybeSingle();

            if (currentRefreshId !== circleRefreshId) {
                return;
            }

            if (error) {
                throw error;
            }

            renderCircleSignedIn(circleLink, data || {});

        } catch (error) {
            console.warn("Blackwood Circle profile check failed:", error);

            if (currentRefreshId === circleRefreshId) {
                renderCircleSignedIn(circleLink, {});
            }
        }
    }

    function renderCircleSignedOut(circleLink) {
        circleLink.classList.remove("is-signed-in", "is-loading");
        circleLink.href = CIRCLE_ACCESS_CONFIG.membersPageUrl;
        circleLink.setAttribute("aria-label", "Open The Blackwood Circle member area");
        circleLink.title = "The Blackwood Circle";

        circleLink.innerHTML = `
            <span class="blackwood-circle-access-mark" aria-hidden="true">◎</span>
            <span class="blackwood-circle-access-text">The Circle</span>
        `;
    }

    function renderCircleLoading(circleLink) {
        circleLink.classList.add("is-loading");
        circleLink.href = CIRCLE_ACCESS_CONFIG.membersPageUrl;
        circleLink.setAttribute("aria-label", "Opening your Blackwood Circle member record");

        circleLink.innerHTML = `
            <span class="blackwood-circle-access-mark" aria-hidden="true">◎</span>
            <span class="blackwood-circle-access-text">Checking...</span>
        `;
    }

    function renderCircleSignedIn(circleLink, profile) {
        const points = Number(profile.points_total || 0);
        const pointsLabel = points === 1 ? "1 pt" : `${points} pts`;

        circleLink.classList.remove("is-loading");
        circleLink.classList.add("is-signed-in");
        circleLink.href = CIRCLE_ACCESS_CONFIG.membersPageUrl;
        circleLink.setAttribute("aria-label", `Open your Blackwood Circle member area. ${pointsLabel}.`);
        circleLink.title = `My Circle · ${pointsLabel}`;

        circleLink.innerHTML = `
            <span class="blackwood-circle-access-mark" aria-hidden="true">◎</span>
            <span class="blackwood-circle-access-text">My Circle</span>
            <span class="blackwood-circle-access-points">${pointsLabel}</span>
        `;
    }

    function loadCircleSupabaseLibrary() {
        return new Promise((resolve, reject) => {
            if (window.supabase && typeof window.supabase.createClient === "function") {
                resolve();
                return;
            }

            const existingScript = document.querySelector("script[data-blackwood-supabase]");

            if (existingScript) {
                existingScript.addEventListener("load", () => resolve(), { once: true });
                existingScript.addEventListener("error", () => reject(new Error("Supabase could not be loaded.")), { once: true });
                return;
            }

            const script = document.createElement("script");
            script.src = CIRCLE_ACCESS_CONFIG.supabaseCdn;
            script.async = true;
            script.defer = true;
            script.dataset.blackwoodSupabase = "true";

            script.onload = () => {
                if (window.supabase && typeof window.supabase.createClient === "function") {
                    resolve();
                } else {
                    reject(new Error("Supabase loaded, but createClient was unavailable."));
                }
            };

            script.onerror = () => {
                reject(new Error("Supabase could not be loaded."));
            };

            document.head.appendChild(script);
        });
    }
})();
