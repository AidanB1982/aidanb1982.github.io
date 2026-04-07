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

    } catch (err) {
        console.error("Header load failed:", err);
    }
}

// =========================
// SCROLL FADE SYSTEM
// =========================

function initScrollFade() {

    let ticking = false;

    window.addEventListener('scroll', () => {

        if (!ticking) {

            requestAnimationFrame(() => {

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

            });

            ticking = true;
        }

    });
    window.dispatchEvent(new Event('scroll'));
}

// =========================
// ENTITY REVEAL
// =========================
function initEntity() {

    const entity = document.querySelector('.entity');
    if (!entity) return;

    function triggerEntity() {

        // random delay (3s → 12s)
        const delay = Math.random() * 9000 + 3000;

        setTimeout(() => {

            entity.classList.add('active');

            // visible duration (2–5s)
            const visibleTime = Math.random() * 3000 + 2000;

            setTimeout(() => {
                entity.classList.remove('active');

                // trigger again
                triggerEntity();

            }, visibleTime);

        }, delay);
    }

    triggerEntity();
}
function initFadeIn() {

    const elements = document.querySelectorAll('.fade-in');

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
