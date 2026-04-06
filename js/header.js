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

        // Fade-in effect
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

    // =========================
    // PERFORMANCE: REDUCE MOTION
    // =========================
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // =========================
    // MOUSE + PARALLAX COMBINED
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
    // SMOOTH LIGHT FOLLOW
    // =========================
    function animateLight() {

        currentX += (targetX - currentX) * 0.05;
        currentY += (targetY - currentY) * 0.05;

        hero.style.setProperty('--mx', currentX + '%');
        hero.style.setProperty('--my', currentY + '%');

        requestAnimationFrame(animateLight);
    }

    // =========================
    // CAMERA DRIFT (SUBTLE AUTO MOTION)
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
    // SCROLL PARALLAX
    // =========================
    let ticking = false;

window.addEventListener('scroll', () => {

    if (!ticking) {

        window.requestAnimationFrame(() => {

            const scrollY = window.scrollY;

            // Background movement
            hero.style.setProperty('--scrollY', scrollY * 0.15 + 'px');

            // Hero content
            if (inner) {
                inner.style.transform = `translateY(${scrollY * 0.02}px)`;
            }

            // Featured section
            const featured = document.querySelector('.featured-inner');
            if (featured) {
                featured.style.transform = `translateY(${scrollY * -0.03}px)`;
            }

            ticking = false;

        });

        ticking = true;
    }

});
    // =========================
    // START ANIMATIONS
    // =========================
    if (!reduceMotion) {
        animateLight();
        cameraDrift();
    }
}

// =========================
// AUTO INIT (SAFETY)
// =========================
document.addEventListener("DOMContentLoaded", () => {

    // If header isn't dynamically loaded, still run
    if (!document.getElementById("header-placeholder")) {
        initHeader();
    }
});
