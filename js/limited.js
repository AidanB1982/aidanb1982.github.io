// ===== CONFIG =====
const SHOP_DOMAIN = 'vmbd0z-c6.myshopify.com';
const STOREFRONT_TOKEN = 'aeb1f4c8b1902d50200b3f0dc8d8ee9b';
const PRODUCT_ID = '16164737679705';
const PRODUCT_GID = `gid://shopify/Product/${PRODUCT_ID}`;
const NODE_ID = 'product-component-1777208605383';


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
    const client = ShopifyBuy.buildClient({
      domain: SHOP_DOMAIN,
      storefrontAccessToken: STOREFRONT_TOKEN,
    });

    ShopifyBuy.UI.onReady(client).then(function (ui) {
      ui.createComponent('product', {
        id: PRODUCT_ID,
        node: document.getElementById(NODE_ID),
        options: {
          product: {
            styles: {
              product: {
                maxWidth: "100%",
                marginBottom: "20px"
              },
              button: {
                fontFamily: "Garamond, serif",
                fontSize: "14px",
                padding: "15px 35px",
                color: "#e8e6e1",
                backgroundColor: "#5f7d76"
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

      // Ensure inventory runs AFTER button exists
      setTimeout(fetchInventory, 800);
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


// ===== FETCH INVENTORY =====
async function fetchInventory() {

  const query = `
  {
    product(id: "${PRODUCT_GID}") {
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
    const response = await fetch(`https://${SHOP_DOMAIN}/api/2023-10/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': STOREFRONT_TOKEN
      },
      body: JSON.stringify({ query })
    });

    const data = await response.json();
    const qty = data.data.product.variants.edges[0].node.quantityAvailable;

    const el = document.getElementById("stock-count");
    if (!el) return;

    // ===== DISPLAY =====
    if (qty > 0) {
      el.innerText = `${qty} copies remain.`;

      if (qty <= 10) {
        el.style.opacity = "0.9";
      }

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
  const btn = document.querySelector(".shopify-buy__btn");

  if (!btn) return;

  btn.innerText = "Unavailable";
  btn.style.opacity = "0.5";
  btn.style.pointerEvents = "none";
}


// ===== OPTIONAL: AUTO REFRESH =====
setInterval(fetchInventory, 30000);
