/* =========================================
   EDITOR PICKS — FULL UPGRADE (ARCHIVE STYLE)
   ========================================= */


/* ===== MAIN CONTAINER ===== */

.editor-inner {
  display: grid;
  grid-template-columns: 1.3fr 1fr 1fr;
  gap: 50px;

  max-width: 1100px;
  margin: 80px auto;
  padding: 50px 40px;

  background: rgba(255,255,255,0.02);
}


/* ===== BASE CARD ===== */

.pick {
  text-align: center;

  opacity: 0;
  transform: translateY(12px);
  transition: all 0.5s ease;
}


/* FADE-IN */
.pick.fade-in.visible {
  opacity: 1;
  transform: translateY(0);
}


/* ===== IMAGE ===== */

.pick img {
  width: 100%;
  max-width: 210px;
  height: 300px;
  object-fit: contain;

  display: block;
  margin: 0 auto 18px;

  transition: transform 0.3s ease, opacity 0.3s ease;
}


/* SUBTLE HOVER (ON BRAND — NOT LOUD) */
.pick:hover img {
  transform: translateY(-4px);
  opacity: 0.95;
}


/* ===== TITLE ===== */

.pick h3 {
  font-size: 15px;
  margin-bottom: 3px;
  color: #F1F1F1;
  letter-spacing: 0.2px;
}


/* ===== AUTHOR ===== */

.pick-author {
  font-size: 12px;
  opacity: 0.6;
  margin-bottom: 10px;
}


/* ===== NOTE ===== */

.pick-note {
  font-size: 13px;
  line-height: 1.65;
  opacity: 0.75;
  margin-bottom: 14px;

  max-width: 320px;
  margin-left: auto;
  margin-right: auto;
}


/* ===== BUTTON (UNCHANGED STYLE, JUST SPACING) ===== */

.button.copper {
  display: inline-block;
  margin-top: 6px;
}


/* ===== SUBTEXT ===== */

.affiliate-subtle {
  display: block;
  margin-top: 6px;
  font-size: 11px;
  opacity: 0.35;
}


/* =========================================
   FEATURED PICK (ANCHOR ELEMENT)
   ========================================= */

.featured-pick {
  position: relative;
}


/* FEATURED IMAGE */
.featured-pick img {
  max-width: 260px;
  height: 360px;
}


/* FEATURED TITLE */
.featured-pick h3 {
  font-size: 18px;
}


/* FEATURED NOTE */
.featured-pick .pick-note {
  font-size: 14px;
  opacity: 0.9;
}


/* SUBTLE LEFT EMPHASIS LINE */
.featured-pick::before {
  content: "";
  position: absolute;
  left: -20px;
  top: 20px;
  bottom: 20px;
  width: 1px;
  background: rgba(255,255,255,0.06);
}


/* =========================================
   TRANSITION STATE
   ========================================= */

.editor-inner.fading {
  opacity: 0;
  transform: translateY(10px);
  transition: all 0.4s ease;
}


/* =========================================
   RESPONSIVE
   ========================================= */

@media (max-width: 900px) {

  .editor-inner {
    grid-template-columns: 1fr;
    gap: 60px;
    padding: 30px 20px;
  }

  .featured-pick::before {
    display: none;
  }

  .featured-pick img {
    max-width: 240px;
    height: 330px;
  }
}
