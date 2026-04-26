// ===== CONFIG =====
const SHOP_DOMAIN = 'vmbd0z-c6.myshopify.com';
const STOREFRONT_TOKEN = 'aeb1f4c8b1902d50200b3f0dc8d8ee9b';

// ALL PRODUCTS
const PRODUCTS = [
  {
    id: '16164737679705',
    node: 'product-1',
    stock: 'stock-1'
  },
  {
    id: '16270731706713',
    node: 'product-2',
    stock: 'stock-2'
  },
  {
    id: '16270738620761',
    node: 'product-3',
    stock: 'stock-3'
  }
];


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

      PRODUCTS.forEach(p => {

        const node = document.getElementById(p.node);
        if (!node) return;

        ui.createComponent('product', {
          id: p.id,
          node: node,

          moneyFormat: '£{{amount}}',

          options: {
            product: {
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
                  }
                },
                price: {
                  "color": "#E6E6E6",
                  "opacity": "0.85",
                  "margin": "6px 0"
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

      });

      // load stock after UI renders
      setTimeout(fetchAllInventory, 1200);

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


// ===== INVENTORY (ALL PRODUCTS) =====
async function fetchAllInventory() {

  for (let p of PRODUCTS) {
    await fetchInventory(p);
  }

}


async function fetchInventory(product) {

  const PRODUCT_GID = `gid://shopify/Product/${product.id}`;

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

    const el = document.getElementById(product.stock);
    if (!el) return;

    // DISPLAY
    if (totalQty > 0) {
      el.innerText = `${totalQty} copies remain.`;
    } else if (available) {
      el.innerText = "Limited copies remain.";
    } else {
      el.innerText = "No copies remain.";
      disableButton(product.node);
    }

  } catch (err) {
    console.error("Inventory fetch failed:", err);
  }
}


// ===== DISABLE BUTTON =====
function disableButton(nodeId) {

  const btn = document.querySelector(`#${nodeId} .shopify-buy__btn`);
  if (!btn) return;

  btn.innerText = "Unavailable";
  btn.style.opacity = "0.5";
  btn.style.pointerEvents = "none";
}


// ===== AUTO REFRESH =====
setInterval(fetchAllInventory, 30000);
