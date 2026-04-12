// =========================
// LOAD HEADER
// =========================

async function loadHeader(type = "hero") {

    const fileMap = {
        hero: "header.html",
        simple: "header-simple.html"
    };

    const file = fileMap[type] || "header.html";

    try {
        // LOAD HEADER
        const headerRes = await fetch(`/${file}`);
        if (!headerRes.ok) throw new Error(`Failed to load ${file}`);

        const headerHTML = await headerRes.text();
        const headerContainer = document.getElementById("header-placeholder");

        if (headerContainer) {
            headerContainer.innerHTML = headerHTML;
        }

        // LOAD FOOTER
        const footerRes = await fetch(`/footer.html`);
        if (!footerRes.ok) throw new Error("Failed to load footer.html");

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

    } catch (err) {
        console.error("Layout load failed:", err);
    }
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

        const featured = document.querySelector('.featured');
        const hero = document.querySelector('.hero');
        const works = document.querySelector('.works');

        let progress = 0;

        // FEATURED FADE
        if (featured) {
            const rect = featured.getBoundingClientRect();

            const start = window.innerHeight * 0.9;
            const end = window.innerHeight * 0.3;

            progress = (start - rect.top) / (start - end);
            progress = Math.max(0, Math.min(1, progress));

            featured.style.setProperty('--fadeIn', progress);
        }

        // HERO FADE
        if (hero) {
            hero.style.setProperty('--fadeOut', progress * 0.8);
        }

        // WORKS FADE
        if (works) {
            const rect = works.getBoundingClientRect();

            const start = window.innerHeight * 1.1;
            const end = window.innerHeight * 0.5;

            let fade = (start - rect.top) / (start - end);
            fade = Math.max(0, Math.min(1, fade));

            works.style.setProperty('--sectionFade', fade);
        }

        ticking = false;
    }

    window.addEventListener('scroll', () => {
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

    const entity = document.querySelector('.entity');
    if (!entity) return;

    function triggerEntity() {

        const delay = Math.random() * 9000 + 3000;

        setTimeout(() => {

            entity.classList.add('active');

            const visibleTime = Math.random() * 3000 + 2000;

            setTimeout(() => {
                entity.classList.remove('active');
                triggerEntity();
            }, visibleTime);

        }, delay);
    }

    triggerEntity();
}

// =========================
// FADE-IN (INTERSECTION OBSERVER)
// =========================

function initFadeIn() {

    const elements = document.querySelectorAll('.fade-in, .work');

    const observer = new IntersectionObserver((entries) => {

        entries.forEach((entry) => {

            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });

    }, {
        threshold: 0.2
    });

    elements.forEach((el, index) => {
        el.style.transitionDelay = `${index * 120}ms`;
        observer.observe(el);
    });
}

// =========================
// SPOTLIGHT (WORKS SECTION)
// =========================

function initSpotlight() {

    const works = document.querySelector('.works');
    if (!works) return;

    works.addEventListener('mousemove', (e) => {

        const rect = works.getBoundingClientRect();

        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;

        works.style.setProperty('--mouse-x', `${x}%`);
        works.style.setProperty('--mouse-y', `${y}%`);
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

            const emphasisWords = ["remember", "alone", "wrong", "watches", "empty", "back"];

            span.className = emphasisWords.includes(
                word.toLowerCase().replace(/[.?]/g, "")
            ) ? "word emphasis" : "word";

            // RANDOM DISTORTION
            if (Math.random() < 0.1) {
                span.classList.add("distort");
            }

            span.textContent = word + " ";
            span.style.animationDelay = `${i * 0.25}s`;

            el.appendChild(span);
        });
    }

    function updateFragments() {

        fragments.forEach(el => {

            const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];

            const rotation = (Math.random() - 0.5) * 4;

            el.style.transform = `rotate(${rotation}deg)`;

            renderText(el, randomQuote);
        });
    }

    function triggerWatcher() {

        const text = quotes[Math.floor(Math.random() * quotes.length)];

        renderText(watcher, text);

        watcher.style.opacity = 1;

        // FOLLOW MOUSE (slow, unsettling)
        function move(e) {
            const x = (e.clientX / window.innerWidth - 0.5) * 40;
            const y = (e.clientY / window.innerHeight - 0.5) * 40;

            watcher.style.transform =
                `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
        }

        document.addEventListener("mousemove", move);

        // RANDOM GLITCH DURING DISPLAY
        const glitchInterval = setInterval(() => {
            watcher.classList.add("glitch");

            setTimeout(() => {
                watcher.classList.remove("glitch");
            }, 150);
        }, Math.random() * 2000 + 1000);

        // RANDOM DECAY MOMENT
        setTimeout(() => {
            watcher.classList.add("decay");

            setTimeout(() => {
                watcher.classList.remove("decay");
            }, 800);
        }, Math.random() * 3000 + 2000);

        // DISAPPEAR
        setTimeout(() => {
            watcher.style.opacity = 0;
            document.removeEventListener("mousemove", move);
            clearInterval(glitchInterval);
        }, 4000);
    }

    // INITIAL
    updateFragments();

    // LOOP FRAGMENTS
    setInterval(() => {
        updateFragments();
    }, 8000);

    // RANDOM WATCHER TRIGGER
    setInterval(() => {
        if (Math.random() < 0.4) {
            triggerWatcher();
        }
    }, 6000);
}
