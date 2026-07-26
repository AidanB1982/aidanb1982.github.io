/* ======================================================
   BLACKWOOD STORE
   Direct Editions Desk
   Shopify Buy Button integration
====================================================== */

(function () {
    "use strict";

    const SHOPIFY_CONFIG = {
        domain: "vmbd0z-c6.myshopify.com",
        storefrontAccessToken: "aeb1f4c8b1902d50200b3f0dc8d8ee9b",
        moneyFormat: "%C2%A3%7B%7Bamount%7D%7D"
    };

    const SHOPIFY_SDK_URL = "https://sdks.shopifycdn.com/buy-button/latest/buy-button-storefront.min.js";

    const STORE_PRODUCTS = [
        {
            id: "16270731706713",
            slug: "the-black-bothy",
            title: "The Black Bothy",
            subtitle: "Book One of The Archive Files",
            category: "archive-files",
            categoryLabel: "The Archive Files",
            badge: "Direct Edition",
            image: "/assets/A8.png",
            description: "The first door into the Archive. Isolation, grief, and the thing waiting in the dark."
        },
        {
            id: "16446299242841",
            slug: "the-drowned-fjord",
            title: "The Drowned Fjord",
            subtitle: "Book Two of The Archive Files",
            category: "archive-files",
            categoryLabel: "The Archive Files",
            badge: "Direct Edition",
            image: "/assets/A7.png",
            description: "A cold coastal descent into memory, loss, and the things the water refuses to keep buried."
        },
        {
            id: "16446301143385",
            slug: "the-erased-archivist",
            title: "The Erased Archivist",
            subtitle: "Book Three of The Archive Files",
            category: "archive-files",
            categoryLabel: "The Archive Files",
            badge: "Direct Edition",
            image: "/assets/A6.png",
            description: "A record begins to vanish. Identity, obsession, and the archive turning against its keeper."
        },
        {
            id: "16396256477529",
            slug: "holdfast",
            title: "Holdfast",
            subtitle: "Book Four of The Archive Files",
            category: "archive-files",
            categoryLabel: "The Archive Files",
            badge: "Pre-order",
            image: "/assets/A5.png",
            description: "The fourth Archive File. A transmission, a locked record, and something that should not be opened."
        },
        {
            id: "16446303732057",
            slug: "dour-hill-house",
            title: "Dour Hill House",
            subtitle: "Independent Work",
            category: "standalone",
            categoryLabel: "Independent Works",
            badge: "Direct Edition",
            image: "/assets/book1.jpg",
            description: "A house marked by memory, grief, and the quiet pressure of what remains inside."
        },
        {
            id: "16446309794137",
            slug: "the-scheme",
            title: "The Scheme",
            subtitle: "Hard Silence",
            category: "hard-silence",
            categoryLabel: "Hard Silence",
            badge: "Direct Edition",
            image: "/assets/book9.png",
            description: "Urban pressure, damaged lives, and the kind of silence that does not stay buried."
        },
        {
            id: "16446312087897",
            slug: "red-streets",
            title: "Red Streets",
            subtitle: "Hard Silence",
            category: "hard-silence",
            categoryLabel: "Hard Silence",
            badge: "Direct Edition",
            image: "/assets/book10.jpg",
            description: "Blood, consequence, and lives moving through the city with nowhere clean to land."
        },
        {
            id: "16270738620761",
            slug: "corrour-bothy",
            title: "Corrour Bothy",
            subtitle: "The Cursed Bothies",
            category: "cursed-bothies",
            categoryLabel: "The Cursed Bothies",
            badge: "Direct Edition",
            image: "/assets/book2.jpg",
            description: "A remote bothy, a broken mind, and the wilderness pressing too close to the door."
        },
        {
            id: "16446308811097",
            slug: "love-abused",
            title: "Love, Abused",
            subtitle: "Independent Work",
            category: "standalone",
            categoryLabel: "Independent Works",
            badge: "Direct Edition",
            image: "/assets/book15.jpg",
            description: "A raw, intimate record of damage, survival, and the things people miss until it is too late."
        },
        {
            id: "16164737679705",
            slug: "corrour-foil-edition",
            title: "Corrour Foil Edition",
            subtitle: "Limited Edition",
            category: "limited",
            categoryLabel: "Limited Editions",
            badge: "Foil Edition",
            image: "/assets/book13.jpg",
            description: "A limited collector edition from the Cursed Bothies file. Available while stock remains."
        }
       {
    title: "Blackwood Manuscript Audit Workbook",
    slug: "blackwood-manuscript-audit-workbook",
    series: "Writer Resources",
    category: "Editorial Tools",
    image: "/assets/logo1.png",
    productId: "16452791796057",
    description: "A self-guided structural revision workbook for fiction writers who want to diagnose chapter function, pacing, escalation, character movement, motif use, continuity, and revision priorities before polishing."
},
{
    title: "Blackwood Structural Manuscript Audit",
    slug: "blackwood-structural-manuscript-audit",
    series: "Editorial Services",
    category: "Manuscript Audit",
    image: "/assets/logo1.png",
    productId: "16452814930265",
    description: "A completed structural audit service for fiction writers who need a clear chapter-by-chapter revision plan before line editing, copyediting, proofreading, formatting, or publication setup."
}
    ];

    const STORE_FILTERS = [
        {
            value: "all",
            label: "All Editions"
        },
        {
            value: "archive-files",
            label: "Archive Files"
        },
        {
            value: "cursed-bothies",
            label: "Cursed Bothies"
        },
        {
            value: "hard-silence",
            label: "Hard Silence"
        },
        {
            value: "standalone",
            label: "Independent Works"
        },
        {
            value: "limited",
            label: "Limited Editions"
        }
    ];

    const state = {
        activeFilter: "all",
        shopifyUi: null,
        buttonsReady: false
    };

    function initBlackwoodStore() {
        const grid = document.querySelector("#blackwood-store-grid");

        if (!grid) {
            return;
        }

        renderFilters();
        renderProducts(grid);
        updateStoreStatus();
        bindSearch();
        bindHashNavigation();
        openProductFromHash();

        loadShopifySdk()
            .then(initShopify)
            .then(createShopifyButtons)
            .catch(showStoreError);
    }

    function renderFilters() {
        const filterWrap = document.querySelector("#blackwood-store-filters");

        if (!filterWrap) {
            return;
        }

        filterWrap.innerHTML = "";

        STORE_FILTERS.forEach(filter => {
            const button = document.createElement("button");

            button.type = "button";
            button.className = "store-filter-button";
            button.dataset.storeFilter = filter.value;
            button.textContent = filter.label;

            if (filter.value === state.activeFilter) {
                button.classList.add("is-active");
                button.setAttribute("aria-pressed", "true");
            } else {
                button.setAttribute("aria-pressed", "false");
            }

            button.addEventListener("click", () => {
                state.activeFilter = filter.value;

                updateActiveFilterButtons();
                applyStoreFilters();
            });

            filterWrap.appendChild(button);
        });
    }

    function updateActiveFilterButtons() {
        const buttons = document.querySelectorAll("[data-store-filter]");

        buttons.forEach(button => {
            const isActive = button.dataset.storeFilter === state.activeFilter;

            button.classList.toggle("is-active", isActive);
            button.setAttribute("aria-pressed", String(isActive));
        });
    }

    function renderProducts(grid) {
        grid.innerHTML = "";

        STORE_PRODUCTS.forEach(product => {
            grid.appendChild(createProductCard(product));
        });
    }

    function createProductCard(product) {
        const card = document.createElement("article");

        card.id = product.slug;
        card.className = "store-product-card";
        card.tabIndex = -1;

        card.dataset.storeProduct = product.id;
        card.dataset.storeSlug = product.slug;
        card.dataset.storeCategory = product.category;
        card.dataset.storeTitle = product.title.toLowerCase();
        card.dataset.storeText = `${product.title} ${product.subtitle} ${product.categoryLabel} ${product.description}`.toLowerCase();

        const imageWrap = document.createElement("div");
        imageWrap.className = "store-product-image";

        const image = document.createElement("img");
        image.src = product.image;
        image.alt = `${product.title} cover`;
        image.loading = "lazy";

        imageWrap.appendChild(image);

        const content = document.createElement("div");
        content.className = "store-product-content";

        const badge = document.createElement("p");
        badge.className = "store-product-badge";
        badge.textContent = product.badge;

        const title = document.createElement("h2");
        title.textContent = product.title;

        const subtitle = document.createElement("p");
        subtitle.className = "store-product-subtitle";
        subtitle.textContent = product.subtitle;

        const category = document.createElement("p");
        category.className = "store-product-category";
        category.textContent = product.categoryLabel;

        const description = document.createElement("p");
        description.className = "store-product-description";
        description.textContent = product.description;

        const buttonMount = document.createElement("div");
        buttonMount.className = "store-product-buy";
        buttonMount.id = getProductMountId(product.id);

        content.appendChild(badge);
        content.appendChild(title);
        content.appendChild(subtitle);
        content.appendChild(category);
        content.appendChild(description);
        content.appendChild(buttonMount);

        card.appendChild(imageWrap);
        card.appendChild(content);

        return card;
    }

    function bindSearch() {
        const search = document.querySelector("#blackwood-store-search");

        if (!search) {
            return;
        }

        search.addEventListener("input", applyStoreFilters);
    }

    function bindHashNavigation() {
        window.addEventListener("hashchange", openProductFromHash);
    }

    function openProductFromHash() {
        const slug = getCurrentHashSlug();

        if (!slug) {
            return;
        }

        const productExists = STORE_PRODUCTS.some(product => product.slug === slug);

        if (!productExists) {
            return;
        }

        state.activeFilter = "all";
        updateActiveFilterButtons();

        const search = document.querySelector("#blackwood-store-search");

        if (search) {
            search.value = "";
        }

        applyStoreFilters();

        window.requestAnimationFrame(() => {
            const card = document.getElementById(slug);

            if (!card) {
                return;
            }

            card.scrollIntoView({
                behavior: "smooth",
                block: "center"
            });

            card.focus({
                preventScroll: true
            });

            card.classList.add("is-targeted");

            window.setTimeout(() => {
                card.classList.remove("is-targeted");
            }, 2200);
        });
    }

    function getCurrentHashSlug() {
        return decodeURIComponent(window.location.hash || "")
            .replace("#", "")
            .trim()
            .toLowerCase();
    }

    function applyStoreFilters() {
        const cards = Array.from(document.querySelectorAll(".store-product-card"));
        const search = document.querySelector("#blackwood-store-search");
        const searchValue = search ? search.value.trim().toLowerCase() : "";

        cards.forEach(card => {
            const categoryMatches =
                state.activeFilter === "all" ||
                card.dataset.storeCategory === state.activeFilter;

            const searchMatches =
                !searchValue ||
                String(card.dataset.storeText || "").includes(searchValue);

            const shouldShow = categoryMatches && searchMatches;

            card.hidden = !shouldShow;
            card.classList.toggle("is-hidden", !shouldShow);
        });

        updateStoreStatus();
    }

    function updateStoreStatus() {
        const status = document.querySelector("#blackwood-store-status");

        if (!status) {
            return;
        }

        const visibleProducts = Array.from(document.querySelectorAll(".store-product-card"))
            .filter(card => !card.hidden);

        const count = visibleProducts.length;

        status.textContent = `${count} ${count === 1 ? "edition" : "editions"} currently shown.`;
    }

    function loadShopifySdk() {
        return new Promise((resolve, reject) => {
            if (window.ShopifyBuy && window.ShopifyBuy.UI) {
                resolve();
                return;
            }

            const existingScript = document.querySelector(`script[src="${SHOPIFY_SDK_URL}"]`);

            if (existingScript) {
                existingScript.addEventListener("load", resolve);
                existingScript.addEventListener("error", reject);
                return;
            }

            const script = document.createElement("script");

            script.async = true;
            script.src = SHOPIFY_SDK_URL;
            script.onload = resolve;
            script.onerror = reject;

            document.head.appendChild(script);
        });
    }

    function initShopify() {
        return new Promise((resolve, reject) => {
            if (!window.ShopifyBuy || !window.ShopifyBuy.UI) {
                reject(new Error("Shopify Buy Button SDK was not available."));
                return;
            }

            const client = window.ShopifyBuy.buildClient({
                domain: SHOPIFY_CONFIG.domain,
                storefrontAccessToken: SHOPIFY_CONFIG.storefrontAccessToken
            });

            window.ShopifyBuy.UI.onReady(client)
                .then(ui => {
                    state.shopifyUi = ui;
                    resolve(ui);
                })
                .catch(reject);
        });
    }

    function createShopifyButtons() {
        if (!state.shopifyUi || state.buttonsReady) {
            return;
        }

        STORE_PRODUCTS.forEach(product => {
            const node = document.getElementById(getProductMountId(product.id));

            if (!node) {
                return;
            }

            state.shopifyUi.createComponent("product", {
                id: product.id,
                node,
                moneyFormat: SHOPIFY_CONFIG.moneyFormat,
                options: getShopifyButtonOptions()
            });
        });

        state.buttonsReady = true;
    }

    function getShopifyButtonOptions() {
        return {
            product: {
                contents: {
                    img: false,
                    title: false,
                    price: true,
                    options: true,
                    button: false,
                    buttonWithQuantity: true
                },
                styles: {
                    product: {
                        width: "100%",
                        "max-width": "100%",
                        "margin-left": "0",
                        "margin-bottom": "0",
                        "text-align": "left"
                    },
                    price: {
                        "font-family": "Arial, Helvetica, sans-serif",
                        "font-size": "13px",
                        "letter-spacing": "1.8px",
                        "text-transform": "uppercase",
                        color: "#d8c6ad"
                    },
                    compareAt: {
                        "font-family": "Arial, Helvetica, sans-serif",
                        "font-size": "12px",
                        color: "rgba(216, 198, 173, 0.55)"
                    },
                    button: {
                        "font-family": "Arial, Helvetica, sans-serif",
                        "font-size": "10px",
                        "font-weight": "700",
                        "letter-spacing": "2px",
                        "text-transform": "uppercase",
                        "padding-top": "13px",
                        "padding-bottom": "13px",
                        "padding-left": "24px",
                        "padding-right": "24px",
                        color: "#0b0b0b",
                        "background-color": "#b87333",
                        ":hover": {
                            color: "#0b0b0b",
                            "background-color": "#d08a43"
                        },
                        ":focus": {
                            "background-color": "#d08a43"
                        },
                        "border-radius": "0"
                    },
                    quantityInput: {
                        "font-family": "Arial, Helvetica, sans-serif",
                        "font-size": "13px",
                        "padding-top": "13px",
                        "padding-bottom": "13px",
                        color: "#f1ece4",
                        "background-color": "#080808",
                        "border-color": "rgba(184, 115, 51, 0.35)",
                        "border-radius": "0"
                    }
                },
                text: {
                    button: "Add to Cart",
                    outOfStock: "Out of Stock",
                    unavailable: "Unavailable"
                }
            },
            modalProduct: {
                contents: {
                    img: false,
                    imgWithCarousel: true,
                    button: false,
                    buttonWithQuantity: true
                },
                styles: {
                    product: {
                        "@media (min-width: 601px)": {
                            "max-width": "100%",
                            "margin-left": "0",
                            "margin-bottom": "0"
                        }
                    },
                    button: {
                        "font-family": "Arial, Helvetica, sans-serif",
                        "font-size": "10px",
                        "font-weight": "700",
                        "letter-spacing": "2px",
                        "text-transform": "uppercase",
                        color: "#0b0b0b",
                        "background-color": "#b87333",
                        ":hover": {
                            color: "#0b0b0b",
                            "background-color": "#d08a43"
                        },
                        ":focus": {
                            "background-color": "#d08a43"
                        },
                        "border-radius": "0"
                    }
                },
                text: {
                    button: "Add to Cart"
                }
            },
            option: {
                styles: {
                    label: {
                        "font-family": "Arial, Helvetica, sans-serif",
                        "font-size": "10px",
                        "letter-spacing": "1.8px",
                        "text-transform": "uppercase",
                        color: "#b87333"
                    },
                    select: {
                        "font-family": "Georgia, Times New Roman, serif",
                        color: "#f1ece4",
                        "background-color": "#080808",
                        "border-color": "rgba(184, 115, 51, 0.35)",
                        "border-radius": "0"
                    }
                }
            },
            cart: {
                styles: {
                    button: {
                        "font-family": "Arial, Helvetica, sans-serif",
                        "font-size": "10px",
                        "font-weight": "700",
                        "letter-spacing": "2px",
                        "text-transform": "uppercase",
                        "padding-top": "15px",
                        "padding-bottom": "15px",
                        color: "#0b0b0b",
                        "background-color": "#b87333",
                        ":hover": {
                            color: "#0b0b0b",
                            "background-color": "#d08a43"
                        },
                        ":focus": {
                            "background-color": "#d08a43"
                        },
                        "border-radius": "0"
                    },
                    footer: {
                        "background-color": "#050505"
                    },
                    header: {
                        "background-color": "#050505"
                    },
                    title: {
                        color: "#f1ece4"
                    },
                    close: {
                        color: "#f1ece4",
                        ":hover": {
                            color: "#b87333"
                        }
                    },
                    empty: {
                        color: "#d7d0c6"
                    },
                    noteDescription: {
                        color: "#d7d0c6"
                    },
                    subtotalText: {
                        color: "#d7d0c6"
                    },
                    subtotal: {
                        color: "#f1ece4"
                    },
                    notice: {
                        color: "#d7d0c6"
                    },
                    currency: {
                        color: "#d7d0c6"
                    }
                },
                text: {
                    title: "Archive Cart",
                    total: "Subtotal",
                    empty: "The cart is empty.",
                    notice: "Shipping and discount codes are added at checkout.",
                    button: "Checkout"
                }
            },
            toggle: {
                styles: {
                    toggle: {
                        "font-family": "Arial, Helvetica, sans-serif",
                        "background-color": "#b87333",
                        ":hover": {
                            "background-color": "#d08a43"
                        },
                        ":focus": {
                            "background-color": "#d08a43"
                        }
                    },
                    count: {
                        "font-size": "13px",
                        color: "#0b0b0b",
                        ":hover": {
                            color: "#0b0b0b"
                        }
                    },
                    iconPath: {
                        fill: "#0b0b0b"
                    }
                }
            }
        };
    }

    function getProductMountId(productId) {
        return `blackwood-shopify-product-${productId}`;
    }

    function showStoreError() {
        const status = document.querySelector("#blackwood-store-status");

        if (status) {
            status.textContent = "The Direct Editions Desk could not connect to checkout. Please refresh the page.";
            status.classList.add("is-error");
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initBlackwoodStore);
    } else {
        initBlackwoodStore();
    }
})();
