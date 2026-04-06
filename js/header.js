// =========================
// HEADER + HERO SYSTEM
// =========================

async function loadHeader(type = "hero") {

    let file = "/header.html";
    if (type === "simple") file = "/header-simple.html";

    try {
        const res = await fetch(file);
        const html = await res.text();

        const container = document.getElementById("header-placeholder");
        container.innerHTML = html;

        requestAnimationFrame(() => {
            container.classList.add("loaded");
        });

        initHeader();

    } catch (err) {
        console.error("Header load failed:", err);
    }
}

// =========================
// HERO INTERACTIONS
// =========================

function initHeader() {

    const hero = document.querySelector('.hero');
    if (!hero) return;

    const inner = hero.querySelector('.hero-inner');
    const featuredSection = document.querySelector('.featured');
    const featuredInner = document.querySelector('.featured-inner');
    const book = document.querySelector('.featured-image');
    const entity = document.querySelector('.entity');

    let targetX = 50, targetY = 50;
    let currentX = 50, currentY = 50;

    let driftTime = 0;

    // =========================
    // MOUSE PARALLAX
    // =========================
    hero.addEventListener('mousemove', (e) => {

        const rect = hero.getBoundingClientRect();

        const x = (e.clientX - rect.left) / rect.width;
        const y = (e.clientY - rect.top) / rect.height;

        targetX = x * 100;
        targetY = y * 100;

        if (inner) {
            inner.style.transform = `
                translate(${(x - 0.5) * 12}px, ${(y - 0.5) * 12}px)
                scale(1.02)
            `;
        }
    });

    hero.addEventListener('mouseleave', () => {
        if (inner) {
            inner.style.transform = `translate(0,0) scale(1)`;
        }
    });

    // =========================
    // LIGHT FOLLOW
    // =========================
    function animateLight() {
        currentX += (targetX - currentX) * 0.05;
        currentY += (targetY - currentY) * 0.05;

        hero.style.setProperty('--mx', currentX + '%');
        hero.style.setProperty('--my', currentY + '%');

        requestAnimationFrame(animateLight);
    }

    // =========================
    // CAMERA DRIFT
    // =========================
    function cameraDrift() {
        driftTime += 0.002;

        const driftX = Math.sin(driftTime) * 0.5;
        const driftY = Math.cos(driftTime * 0.8) * 0.5;

        hero.style.setProperty('--driftX', driftX + '%');
        hero.style.setProperty('--driftY', driftY + '%');

        requestAnimationFrame(cameraDrift);
    }

    // =========================
    // SCROLL SYSTEM
    // =========================
    let ticking = false;

    window.addEventListener('scroll', () => {

        if (!ticking) {

            requestAnimationFrame(() => {

                const scrollY = window.scrollY;

                let fadeProgress = 0;

                // =========================
                // FEATURED FADE
                // =========================
                if (featuredSection) {
                    const rect = featuredSection.getBoundingClientRect();

                    const start = window.innerHeight * 0.8;
                    const end = window.innerHeight * 0.2;

                    fadeProgress = (start - rect.top) / (start - end);
                    fadeProgress = Math.max(0, Math.min(1, fadeProgress));

                    if (fadeProgress > 0.95) fadeProgress = 1;

                    featuredSection.style.setProperty('--fadeIn', fadeProgress);
                }

                // HERO fade
                hero.style.setProperty('--fadeOut', fadeProgress);

                // =========================
                // BACKGROUND PARALLAX
                // =========================
                hero.style.setProperty('--scrollY', scrollY * 0.15 + 'px');
                hero.style.setProperty('--zoom', scrollY * 0.0002);
                hero.style.setProperty('--depth', scrollY * 0.02 + 'px');

                // =========================
                // HERO CONTENT
                // =========================
                if (inner) {
                    const mouseX = (targetX - 50) * 0.24;
                    const mouseY = (targetY - 50) * 0.24;

                    inner.style.transform = `
                        translate3d(${mouseX}px, ${mouseY + scrollY * 0.02}px, 0)
                        scale(1.02)
                    `;
                }

                // =========================
                // FEATURED PARALLAX
                // =========================
                if (featuredInner) {
                    featuredInner.style.setProperty('--featuredY', scrollY * -0.03 + 'px');
                }

                if (book) {
                    const offset = Math.min(scrollY * 0.02, 40);
                    book.style.setProperty('--bookY', -offset + 'px');
                }

                // =========================
                // ENTITY (SCROLL CONTROLLED 😈)
                // =========================
                if (entity) {
                    const triggerStart = window.innerHeight * 0.3;
                    const triggerEnd = window.innerHeight * 0.9;

                    let progress = (scrollY - triggerStart) / (triggerEnd - triggerStart);
                    progress = Math.max(0, Math.min(1, progress));

                    // fade in/out curve
                    const opacity = progress < 0.5
                        ? progress * 2
                        : (1 - progress) * 2;

                    entity.style.setProperty('--entityOpacity', opacity);

                    // subtle float upward
                    entity.style.setProperty('--entityY', `${-progress * 40}px`);
                }

                ticking = false;

            });

            ticking = true;
        }

    });

    animateLight();
    cameraDrift();
}

// =========================
// AUTO INIT
// =========================
document.addEventListener("DOMContentLoaded", () => {
    if (!document.getElementById("header-placeholder")) {
        initHeader();
    }
});
