// ===== SHOPIFY BUY BUTTON =====
(function () {
  var scriptURL = 'https://sdks.shopifycdn.com/buy-button/latest/buy-button-storefront.min.js';

  function loadScript() {
    var script = document.createElement('script');
    script.async = true;
    script.src = scriptURL;
    document.head.appendChild(script);
    script.onload = ShopifyBuyInit;
  }

  function ShopifyBuyInit() {
    var client = ShopifyBuy.buildClient({
      domain: 'vmbd0z-c6.myshopify.com',
      storefrontAccessToken: 'aeb1f4c8b1902d50200b3f0dc8d8ee9b',
    });

    ShopifyBuy.UI.onReady(client).then(function (ui) {
      ui.createComponent('product', {
        id: '16164737679705',
        node: document.getElementById('product-component-1777208605383'),
        options: {

          product: {
            styles: {
              product: {
                "max-width": "100%",
                "margin-bottom": "20px"
              },
              button: {
                "font-family": "Garamond, serif",
                "font-size": "14px",
                "padding": "15px 35px",
                "color": "#e8e6e1",
                "background-color": "#5f7d76"
              }
            },
            text: {
              button: "Secure a copy"
            }
          },

          modalProduct: {
            contents: {
              img: false,
              imgWithCarousel: true,
              button: true,
              buttonWithQuantity: false
            },
            text: {
              button: "Secure a copy"
            }
          }

        }
      });
    });
  }

  if (window.ShopifyBuy) {
    if (window.ShopifyBuy.UI) {
      ShopifyBuyInit();
    } else {
      loadScript();
    }
  } else {
    loadScript();
  }
})();


// ===== LIVE INVENTORY =====
async function fetchInventory() {

  const query = `
  {
    product(id: "gid://shopify/Product/16164737679705") {
      variants(first: 1) {
        edges {
          node {
            quantityAvailable
          }
        }
      }
    }
  }`;

  try {
    const response = await fetch('https://vmbd0z-c6.myshopify.com/api/2023-10/graphql.json', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': 'aeb1f4c8b1902d50200b3f0dc8d8ee9b'
      },
      body: JSON.stringify({ query })
    });

    const data = await response.json();
    const qty = data.data.product.variants.edges[0].node.quantityAvailable;

    const el = document.getElementById("stock-count");
    if (!el) return;

    if (qty > 0) {
      el.innerText = qty + " copies remain.";

      // subtle emphasis if low
      if (qty <= 10) {
        el.style.opacity = "0.9";
      }

    } else {
      el.innerText = "No copies remain.";

      // disable button
      const btn = document.querySelector(".shopify-buy__btn");
      if (btn) {
        btn.innerText = "Unavailable";
        btn.style.opacity = "0.5";
        btn.style.pointerEvents = "none";
      }
    }

  } catch (err) {
    console.error("Inventory fetch failed:", err);
  }
}


// ===== INIT =====
window.addEventListener("load", () => {
  fetchInventory();
});
