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
        const res = await fetch(`./${file}`);

        if (!res.ok) {
            throw new Error(`Failed to load ${file}`);
        }

        const html = await res.text();

        const container = document.getElementById("header-placeholder");

        if (container) {
            container.innerHTML = html;
        }

        initScrollFade();
        initEntity();
        initFadeIn();
        initSpotlight();
        initGlobalLighting(); // ✅ NEW

    } catch (err) {
        console.error("Header load failed:", err);
    }
}

// =========================
// GLOBAL CURSOR LIGHTING (FINAL BOSS)
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
// FADE-IN (STAGGER FIXED)
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
// SPOTLIGHT (ENHANCED)
// =========================

function initSpotlight() {

    const works = document.querySelector('.works');
    if (!works) return;

    works.addEventListener('mousemove', (e) => {

        const rect = works.getBoundingClientRect();

        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;

        // LOCAL (stronger effect inside works)
        works.style.setProperty('--mouse-x', `${x}%`);
        works.style.setProperty('--mouse-y', `${y}%`);
    });
}
