// =========================
// HEADER INTERACTIONS
// =========================

function initHeader() {

    const hero = document.querySelector('.hero');
    if (!hero) return; // safety (important for multi-page use)

    let targetX = 50, targetY = 50;
    let currentX = 50, currentY = 50;

    // =========================
    // LIGHT FOLLOW (MOUSE)
    // =========================
    hero.addEventListener('mousemove', (e) => {
        const rect = hero.getBoundingClientRect();

        targetX = ((e.clientX - rect.left) / rect.width) * 100;
        targetY = ((e.clientY - rect.top) / rect.height) * 100;
    });

    // =========================
    // SMOOTH INTERPOLATION (CINEMATIC)
    // =========================
    function animateLight() {
        currentX += (targetX - currentX) * 0.05;
        currentY += (targetY - currentY) * 0.05;

        hero.style.setProperty('--mx', currentX + '%');
        hero.style.setProperty('--my', currentY + '%');

        requestAnimationFrame(animateLight);
    }

    animateLight();

    // =========================
    // SUBTLE CAMERA DRIFT (AUTO)
    // =========================
    let driftTime = 0;

    function cameraDrift() {
        driftTime += 0.002;

        const driftX = Math.sin(driftTime) * 0.5;
        const driftY = Math.cos(driftTime * 0.8) * 0.5;

        hero.style.setProperty('--driftX', driftX + '%');
        hero.style.setProperty('--driftY', driftY + '%');

        requestAnimationFrame(cameraDrift);
    }

    cameraDrift();

    // =========================
    // PARALLAX CONTENT (LOGO + TEXT)
    // =========================
    const inner = hero.querySelector('.hero-inner');

    if (inner) {

        hero.addEventListener('mousemove', (e) => {
            const rect = hero.getBoundingClientRect();

            const x = (e.clientX - rect.left) / rect.width - 0.5;
            const y = (e.clientY - rect.top) / rect.height - 0.5;

            inner.style.transform = `
                translate(${x * 12}px, ${y * 12}px)
                scale(1.02)
            `;
        });

        hero.addEventListener('mouseleave', () => {
            inner.style.transform = `translate(0,0) scale(1)`;
        });
    }

}

// =========================
// INIT (IMPORTANT FOR FETCH LOAD)
// =========================
document.addEventListener('DOMContentLoaded', initHeader);
