// =========================
// BLACKWOOD CIRCLE ACCESS
// Adds top-right member access link across the site
// =========================

document.addEventListener("DOMContentLoaded", () => {
    initBlackwoodCircleAccess();
});

function initBlackwoodCircleAccess() {
    if (document.querySelector(".blackwood-circle-access")) {
        return;
    }

    const circleLink = document.createElement("a");
    circleLink.className = "blackwood-circle-access";
    circleLink.href = "/pages/members.html";
    circleLink.setAttribute("aria-label", "Open The Blackwood Circle member area");

    circleLink.innerHTML = `
        <span class="blackwood-circle-access-mark" aria-hidden="true">◎</span>
        <span class="blackwood-circle-access-text">The Circle</span>
    `;

    document.body.appendChild(circleLink);
}
