// ===== CONFIG =====
const SHOP_DOMAIN = 'vmbd0z-c6.myshopify.com';
const STOREFRONT_TOKEN = 'aeb1f4c8b1902d50200b3f0dc8d8ee9b';
const PRODUCT_ID = '16164737679705';

const NODE_ID = 'product-component-1777209632096';
const PRODUCT_GID = `gid://shopify/Product/${PRODUCT_ID}`;


// ===== LOAD SHOPIFY =====
(function () {

  const scriptURL = 'https://sdks.shopifycdn.com/buy-button/latest/buy-button-storefront.min.js';

  function loadScript() {
    const script = document.createElement('script');
    script.async = true;
    script.src = scriptURL;
    document.head.appendChild(script);
    script.onload = initShopify;
  }

  function initShopify() {

    const node = document.getElementById(NODE_ID);

    // Prevent silent failure
    if (!node) {
      console.error("Shopify node not found:", NODE_ID);
      return;
    }

    const client = ShopifyBuy.buildClient({
      domain: SHOP_DOMAIN,
      storefrontAccessToken: STOREFRONT_TOKEN,
    });

    ShopifyBuy.UI.onReady(client).then(function (ui) {

      ui.createComponent('product', {
        id: PRODUCT_ID,
        node: node,

        // £ formatting
        moneyFormat: '£{{amount}}',

        options: {
          product: {

            // 🔥 THIS FIXES THE LEFT OFFSET
            styles: {
              product: {
                "max-width": "100%",
                "margin": "0 auto",
                "text-align": "center"
              },

              button: {
                "font-family": "Source Serif Pro, Georgia, serif",
                "font-size": "14px",
                "padding": "14px 30px",
                "color": "#F1F1F1",
                "background-color": "#5F7D76",
                ":hover": {
                  "background-color": "#56716a"
                },
                ":focus": {
                  "background-color": "#56716a"
                }
              },

              price: {
                "color": "#E6E6E6",
                "opacity": "0.8",
                "margin": "8px 0"
              }
            },

            contents: {
              img: false,
              title: false,
              price: true,
              button: true
            },

            text: {
              button: "Secure a copy"
            }
          }
        }
      });

      // Wait for Shopify DOM
      setTimeout(fetchInventory, 1200);
    });
  }

  if (window.ShopifyBuy) {
    if (window.ShopifyBuy.UI) {
      initShopify();
    } else {
      loadScript();
    }
  } else {
    loadScript();
  }

})();


// ===== INVENTORY =====
async function fetchInventory() {

  const query = `
  {
    product(id: "${PRODUCT_GID}") {
      variants(first: 10) {
        edges {
          node {
            quantityAvailable
            availableForSale
          }
        }
      }
    }
  }`;

  try {

    const response = await fetch(`https://${SHOP_DOMAIN}/api/2023-10/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': STOREFRONT_TOKEN
      },
      body: JSON.stringify({ query })
    });

    const data = await response.json();

    const variants = data?.data?.product?.variants?.edges || [];

    let totalQty = 0;
    let available = false;

    variants.forEach(v => {
      const qty = v.node.quantityAvailable;

      if (typeof qty === "number") {
        totalQty += qty;
      }

      if (v.node.availableForSale) {
        available = true;
      }
    });

    const el = document.getElementById("stock-count");
    if (!el) return;

    // DISPLAY
    if (totalQty > 0) {
      el.innerText = `${totalQty} copies remain.`;
    } else if (available) {
      el.innerText = "Limited copies remain.";
    } else {
      el.innerText = "No copies remain.";
      disableButton();
    }

  } catch (err) {
    console.error("Inventory fetch failed:", err);
  }
}


// ===== DISABLE BUTTON =====
function disableButton() {

  const btn = document.querySelector(`#${NODE_ID} .shopify-buy__btn`);

  if (!btn) return;

  btn.innerText = "Unavailable";
  btn.style.opacity = "0.5";
  btn.style.pointerEvents = "none";
}


// ===== AUTO REFRESH =====
setInterval(fetchInventory, 30000);
