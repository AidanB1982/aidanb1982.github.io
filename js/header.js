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
            // =========================
            // CINEMATIC TRANSITION
            // =========================
            
            const fadeStart = window.innerHeight * 0.2;
            const fadeEnd = window.innerHeight * 0.9;
            
            let progress = (scrollY - fadeStart) / (fadeEnd - fadeStart);
            progress = Math.max(0, Math.min(1, progress));
            
            // HERO fades OUT
            hero.style.setProperty('--fadeOut', progress);
            
            // FEATURED fades IN
            const featuredSection = document.querySelector('.featured');
            if (featuredSection) {
                featuredSection.style.setProperty('--fadeIn', progress);
            }
            // BACKGROUND
            hero.style.setProperty('--scrollY', scrollY * 0.15 + 'px');
            hero.style.setProperty('--zoom', scrollY * 0.0002);

            // HERO CONTENT
            if (inner) {
                const mouseX = (targetX - 50) * 0.24;
                const mouseY = (targetY - 50) * 0.24;
                
                inner.style.transform = `
                    translate(${mouseX}px, ${mouseY + scrollY * 0.02}px)
                    scale(1.02)
                `;
            }

            // FEATURED + BOOK DEPTH
            const featured = document.querySelector('.featured-inner');
            const book = document.querySelector('.featured-image');
            
            if (featured) {
                featured.style.setProperty('--featuredY', scrollY * -0.03 + 'px');
            }
            
            if (book) {
                const offset = Math.min(scrollY * 0.02, 40);
                book.style.setProperty('--bookY', -offset + 'px');
            }

            // FOG LAYERS
            const fogBack = document.querySelector('.fog-back');
            const fogMid = document.querySelector('.fog-mid');
            const fogFront = document.querySelector('.fog-front');

            if (fogBack) fogBack.style.transform = `translateX(${scrollY * -0.02}px)`;
            if (fogMid) fogMid.style.transform = `translateX(${scrollY * -0.05}px)`;
            if (fogFront) fogFront.style.transform = `translateX(${scrollY * -0.08}px)`;

            ticking = false;

        });

        ticking = true;
    }

});
    

// =========================
// AUTO INIT (SAFETY)
// =========================
document.addEventListener("DOMContentLoaded", () => {

    // If header isn't dynamically loaded, still run
    if (!document.getElementById("header-placeholder")) {
        initHeader();
    }
});
