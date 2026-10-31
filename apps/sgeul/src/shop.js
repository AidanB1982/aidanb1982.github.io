let loading = false;
const $ = (id) => document.getElementById(id);
export async function loadShop(openExternal) {
  if (loading) return;
  loading = true;
  $("shop-products").replaceChildren();
  $("shop-status").textContent = navigator.onLine
    ? "Checking available editions…"
    : "Reconnect to check prices and availability.";
  try {
    if (!navigator.onLine) return;
    const metadata = await fetch("/data/physical-books.json").then((r) =>
      r.json(),
    );
    const response = await fetch(
      "https://vmbd0z-c6.myshopify.com/api/2026-07/graphql.json",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Storefront-Access-Token":
            "aeb1f4c8b1902d50200b3f0dc8d8ee9b",
        },
        body: JSON.stringify({
          query:
            "query PhysicalBooks($ids:[ID!]!){nodes(ids:$ids){... on Product{id title variants(first:50){nodes{id title availableForSale requiresShipping price{amount currencyCode}}}}}}",
          variables: {
            ids: metadata.map((item) => "gid://shopify/Product/" + item.id),
          },
        }),
        signal: AbortSignal.timeout(15000),
      },
    );
    if (!response.ok) throw Error();
    const result = await response.json();
    if (result.errors || !Array.isArray(result.data?.nodes)) throw Error();
    let count = 0;
    for (const product of result.data.nodes) {
      if (!product) continue;
      const item = metadata.find(
          (item) => "gid://shopify/Product/" + item.id === product.id,
        ),
        variants = product.variants.nodes.filter(
          (v) => v.requiresShipping === true,
        );
      if (!item || !variants.length) continue;
      count++;
      const card = document.createElement("article");
      card.className = "panel shop-book";
      const image = document.createElement("img");
      image.src = item.image;
      image.alt = item.title + " cover";
      image.loading = "lazy";
      const details = document.createElement("div"),
        title = document.createElement("h3"),
        description = document.createElement("p"),
        price = document.createElement("p"),
        select = document.createElement("select"),
        button = document.createElement("button");
      title.textContent = item.title;
      description.textContent = item.description;
      price.className = "price";
      select.setAttribute("aria-label", item.title + " edition");
      for (const v of variants) {
        const option = document.createElement("option");
        option.value = v.id;
        option.textContent =
          (v.title === "Default Title" ? "Physical edition" : v.title) +
          (v.availableForSale ? "" : " · Sold out");
        select.append(option);
      }
      select.hidden = variants.length === 1;
      const update = () => {
        const v = variants.find((v) => v.id === select.value);
        price.textContent = new Intl.NumberFormat("en-GB", {
          style: "currency",
          currency: v.price.currencyCode,
        }).format(Number(v.price.amount));
        button.disabled = !navigator.onLine || !v.availableForSale;
        button.textContent = v.availableForSale
          ? "Buy physical copy"
          : "Sold out";
      };
      select.onchange = update;
      button.onclick = async () => {
        const v = variants.find((v) => v.id === select.value);
        if (!navigator.onLine || !v?.requiresShipping || !v.availableForSale)
          return;
        const id = v.id.match(/^gid:\/\/shopify\/ProductVariant\/(\d+)$/)?.[1];
        if (!id) return;
        try {
          await openExternal(
            "https://vmbd0z-c6.myshopify.com/cart/" + id + ":1",
          );
        } catch {
          $("shop-status").textContent =
            "Checkout could not open. Please try again.";
        }
      };
      update();
      details.append(title, description, price, select, button);
      card.append(image, details);
      $("shop-products").append(card);
    }
    $("shop-status").textContent = count
      ? "Prices and stock are checked online. Shopify confirms the total at checkout."
      : "No physical editions are available right now.";
  } catch {
    $("shop-status").textContent =
      "The bookshop could not connect. Please try again online.";
  } finally {
    loading = false;
  }
}
