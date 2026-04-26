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

```
const client = ShopifyBuy.buildClient({
  domain: SHOP_DOMAIN,
  storefrontAccessToken: STOREFRONT_TOKEN,
});

ShopifyBuy.UI.onReady(client).then(function (ui) {

  ui.createComponent('product', {
    id: PRODUCT_ID,
    node: document.getElementById(NODE_ID),

    moneyFormat: '£{{amount}}',

    options: {
      product: {
        contents: {
          img: false,
          title: false,
          price: true
        },
        text: {
          button: "Secure a copy"
        }
      }
    }
  });

  // delay ensures Shopify DOM exists
  setTimeout(fetchInventory, 800);
});
```

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

```
const response = await fetch(`https://${SHOP_DOMAIN}/api/2023-10/graphql.json`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Shopify-Storefront-Access-Token': STOREFRONT_TOKEN
  },
  body: JSON.stringify({ query })
});

const data = await response.json();

console.log("Shopify inventory data:", data); // 👈 DEBUG

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

// ===== DISPLAY LOGIC =====
if (totalQty > 0) {
  el.innerText = `${totalQty} copies remain.`;
} else if (available) {
  // fallback when Shopify hides quantity
  el.innerText = "Limited copies remain.";
} else {
  el.innerText = "No copies remain.";
  disableButton();
}
```

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

// ===== REFRESH =====
setInterval(fetchInventory, 30000);
