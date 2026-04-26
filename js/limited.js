<!DOCTYPE html>
<html lang="en" class="no-js">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">

<title>Objects from the Archive | Blackwood Publishing</title>

<link rel="stylesheet" href="/css/header.css">
<link rel="stylesheet" href="/css/styles.css">

<style>

/* ===== STRUCTURE ===== */

.limited-intro,
.edition-block,
.limited-note,
.limited-exit {
  max-width: 760px;
  margin: 80px auto;
  text-align: center;
  padding: 0 20px;
}

.limited-intro {
  margin-top: 120px;
  margin-bottom: 60px;
}

.edition-block {
  margin-top: 60px;
  margin-bottom: 80px;
}

.limited-intro h1 {
  font-size: 36px;
  margin-bottom: 16px;
}

.edition-block h2 {
  font-size: 28px;
  margin-bottom: 16px;
}

.edition-block p {
  margin: 10px 0;
}

.edition-block img {
  margin: 30px auto 20px;
  display: block;
  max-width: 280px;
}

.stock-line {
  margin-top: 20px;
  font-size: 14px;
  opacity: 0.7;
}

.final-line {
  font-size: 13px;
  opacity: 0.5;
  margin-top: 6px;
}

.limited-note {
  opacity: 0.6;
  font-style: italic;
  margin-top: 60px;
}

.limited-exit {
  margin-top: 80px;
  margin-bottom: 120px;
}

.limited-exit a {
  display: inline-block;
  margin-top: 20px;
  color: #e8e6e1;
  text-decoration: none;
  border-bottom: 1px solid #e8e6e1;
}

.shopify-buy__cart-toggle {
  display: none !important;
}

</style>

</head>

<body class="sub-page limited-page">

<!-- HEADER -->
<div id="header-placeholder"></div>

<!-- INTRO -->
<section class="limited-intro fade-in">
  <h1>Objects from the Archive</h1>

  <p>
    Some editions are released in limited form.<br>
    Signed. Numbered. Not always available.
  </p>

  <p>Not all copies remain.</p>
</section>

<!-- EDITION -->
<section class="edition-block fade-in">

  <h2>Corrour Bothy — The First Summoning</h2>

  <p>A small number of copies were marked by hand.</p>

  <p>
    Each one carries a record of its own.<br>
    No two are identical.
  </p>

  <img src="/assets/a1.png" alt="Corrour Bothy Signed Edition">

  <p id="stock-count" class="stock-line">
    Checking availability...
  </p>

  <p class="final-line">
    Once they are gone, they are not replaced.
  </p>

  <!-- SHOPIFY BUTTON TARGET -->
  <div id="product-component-1777209632096"></div>

</section>

<!-- WORLD DETAIL -->
<section class="limited-note fade-in">
  <p>Some copies appear where they should not.</p>
</section>

<!-- EXIT -->
<section class="limited-exit fade-in">
  <p>Once they are gone, they are not replaced.</p>
  <a href="/pages/archive.html">Return to the archive</a>
</section>

<!-- FOOTER -->
<div id="footer-placeholder"></div>

<!-- JS -->
<script src="/js/header.js?v=20260408" defer></script>
<script src="/js/limited.js" defer></script>

<script>
window.addEventListener("load", async () => {

    if (typeof loadHeader === "function") {
        await loadHeader("simple");
    }

    if (typeof initFadeIn === "function") {
        initFadeIn();
    }

});
</script>

</body>
</html>
