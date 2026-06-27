/* =========================
   EDITOR PICKS ALIGNMENT FIX
========================= */

.editor-inner.multi {
    display: grid;
    grid-template-columns: repeat(3, minmax(220px, 1fr));
    gap: 56px;
    align-items: start;
    justify-items: center;
}

.editor-inner.single {
    display: flex;
    justify-content: center;
}

.editor-inner.multi .pick {
    width: 100%;
    max-width: 320px;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
}

/* Reset featured styling when there are multiple books */
.editor-inner.multi .featured-pick,
.editor-inner.multi .active-pick {
    transform: none;
    grid-column: auto;
    width: 100%;
    max-width: 320px;
}

/* Fixed cover area so all images line up */
.pick-image-wrap {
    width: 100%;
    height: 390px;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    margin-bottom: 28px;
}

.pick-image-wrap img {
    width: auto;
    height: 100%;
    max-width: 100%;
    object-fit: contain;
    display: block;
    box-shadow: 0 18px 42px rgba(0, 0, 0, 0.45);
}

/* Keep text aligned neatly */
.pick h3 {
    margin-top: 0;
}

.pick-author {
    margin-top: 8px;
}

.pick-note {
    max-width: 320px;
    margin-left: auto;
    margin-right: auto;
}

/* Single-book months can stay larger and centred */
.editor-inner.single .pick {
    max-width: 520px;
    text-align: center;
}

.editor-inner.single .pick-image-wrap {
    height: 430px;
}

/* Tablet */
@media (max-width: 980px) {
    .editor-inner.multi {
        grid-template-columns: repeat(2, minmax(220px, 1fr));
        gap: 50px;
    }

    .pick-image-wrap {
        height: 360px;
    }
}

/* Mobile */
@media (max-width: 640px) {
    .editor-inner.multi {
        grid-template-columns: 1fr;
        gap: 48px;
    }

    .editor-inner.multi .pick {
        max-width: 300px;
    }

    .pick-image-wrap {
        height: 340px;
    }

    .editor-inner.single .pick-image-wrap {
        height: 360px;
    }
}
