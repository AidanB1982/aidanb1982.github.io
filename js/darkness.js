/* ======================================================
   DARKNESS DROPDOWN VERSION
====================================================== */

.darkness-select-panel {
    position: relative;
    z-index: 2;

    max-width: 680px;
    margin: 0 auto 42px;
    text-align: center;
}

.darkness-select-label {
    display: block;

    margin: 0 0 16px;

    font-family: Arial, Helvetica, sans-serif;
    font-size: 11px;
    letter-spacing: 2.8px;
    line-height: 1.6;
    text-transform: uppercase;

    color: rgba(184, 115, 51, 0.95);
}

.darkness-select-wrap {
    position: relative;
}

.darkness-select-wrap::after {
    content: "⌄";
    position: absolute;
    top: 50%;
    right: 20px;

    transform: translateY(-54%);

    color: #b87333;
    font-size: 20px;
    line-height: 1;

    pointer-events: none;
}

.darkness-select {
    appearance: none;
    -webkit-appearance: none;

    width: 100%;

    padding: 18px 54px 18px 20px;

    border: 1px solid rgba(184, 115, 51, 0.34);
    border-radius: 0;

    background:
        linear-gradient(145deg, rgba(18, 18, 18, 0.98), rgba(5, 5, 5, 0.99));

    color: #f1ece4;

    font-family: Georgia, "Times New Roman", serif;
    font-size: 18px;
    line-height: 1.4;

    cursor: pointer;

    box-shadow:
        0 22px 58px rgba(0, 0, 0, 0.58),
        inset 0 0 0 1px rgba(255, 255, 255, 0.025);
}

.darkness-select:focus {
    outline: none;
    border-color: rgba(184, 115, 51, 0.72);
    box-shadow:
        0 26px 70px rgba(0, 0, 0, 0.68),
        0 0 34px rgba(184, 115, 51, 0.12),
        inset 0 0 0 1px rgba(184, 115, 51, 0.08);
}

.darkness-select option {
    background: #090909;
    color: #f1ece4;
}

.darkness-reveal[hidden] {
    display: none !important;
}

.darkness-reveal.is-visible {
    animation: darknessRevealIn 0.45s ease both;
}

@keyframes darknessRevealIn {
    from {
        opacity: 0;
        transform: translateY(14px);
    }

    to {
        opacity: 1;
        transform: translateY(0);
    }
}

@media (max-width: 680px) {
    .darkness-select-panel {
        margin-bottom: 32px;
    }

    .darkness-select {
        font-size: 16px;
        padding: 16px 48px 16px 16px;
    }
}
