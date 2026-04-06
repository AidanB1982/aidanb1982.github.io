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

    let targetX = 50, targetY = 50;
    let currentX = 50, currentY = 50;

    let driftTime = 0;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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
    // SCROLL SYSTEM (FIXED)
    // =========================
    let ticking = false;

    window.addEventListener('scroll', () => {

        if (!ticking) {

            requestAnimationFrame(() => {

                const scrollY = window.scrollY;

                const featuredSection = document.querySelector('.featured');

                let progress = 0;

                if (featuredSection) {
                    const rect = featuredSection.getBoundingClientRect(); 

                    const start = window.innerHeight * 0.8;
                    const end = window.innerHeight * 0.2;

                    progress = (start - rect.top) / (start - end);
                    progress = Math.max(0, Math.min(1, progress));

                    // snap clean at end
                    if (progress > 0.95) progress = 1;

                    featuredSection.style.setProperty('--fadeIn', progress);
                }

                // HERO fade
                hero.style.setProperty('--fadeOut', progress);

                // BACKGROUND
                hero.style.setProperty('--scrollY', scrollY * 0.15 + 'px');
                hero.style.setProperty('--zoom', scrollY * 0.0002);
                hero.style.setProperty('--depth', scrollY * 0.02 + 'px');

                // HERO CONTENT
                if (inner) {
                    const mouseX = (targetX - 50) * 0.24;
                    const mouseY = (targetY - 50) * 0.24;

                    inner.style.transform = `
                    translate3d(${mouseX}px, ${mouseY + scrollY * 0.02}px, 0)
                    scale(1.02)
                `;
                }

                // FEATURED PARALLAX
                const featured = document.querySelector('.featured-inner');
                const book = document.querySelector('.featured-image');

                if (featured) {
                    featured.style.setProperty('--featuredY', scrollY * -0.03 + 'px');
                }

                if (book) {
                    const offset = Math.min(scrollY * 0.02, 40);
                    book.style.setProperty('--bookY', -offset + 'px');
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
