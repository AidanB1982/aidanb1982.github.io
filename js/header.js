// =========================
// LOAD HEADER
// =========================

async function loadHeader(type = "hero") {

    let file = "header.html";

    if (type === "simple") {
        file = "header-simple.html";
    }

    try {
        const res = await fetch(file);
        const html = await res.text();

        const container = document.getElementById("header-placeholder");

        if (container) {
            container.innerHTML = html;
        }

        // ✅ AFTER HEADER LOAD → INIT SCROLL
        initScrollFade();
        initEntity(); 

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

                const scrollY = window.scrollY;

                const featured = document.querySelector('.featured');
                const hero = document.querySelector('.hero');

                let progress = 0;

                if (featured) {
                    const rect = featured.getBoundingClientRect();

                    const start = window.innerHeight * 0.9;
                    const end = window.innerHeight * 0.3;

                    progress = (start - rect.top) / (start - end);
                    progress = Math.max(0, Math.min(1, progress));

                    featured.style.setProperty('--fadeIn', progress);
                }

                if (hero) {
                    hero.style.setProperty('--fadeOut', progress * 0.8);
                }

                ticking = false;

            });

            ticking = true;
        }

    });

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
        entries.forEach((entry, index) => {
            if (entry.isIntersecting) {

                setTimeout(() => {
                    entry.target.classList.add('visible');
                }, index * 120);

                observer.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.2
    });

    elements.forEach(el => observer.observe(el));
}
