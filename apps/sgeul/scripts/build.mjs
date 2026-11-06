import { build } from "esbuild";
import { readFile, writeFile, mkdir, rm, copyFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
  repo = path.resolve(app, "../.."),
  out = path.join(app, "dist");
await rm(out, { recursive: true, force: true });
await mkdir(path.join(out, "pages"), { recursive: true });
const read = (relative) => readFile(path.join(repo, relative), "utf8");
function required(source, from, to) {
  if (!source.includes(from))
    throw Error("Shared integration changed: " + from.slice(0, 70));
  return source.replace(from, to);
}
function useNativeConnectivity(source) {
  return source.includes("navigator.onLine")
    ? 'import {isOnline as sgeulOnline} from "sgeul-connectivity";\n' +
        source.replaceAll("navigator.onLine", "sgeulOnline()")
    : source;
}
function nativeReader(source) {
  const start = source.indexOf(
      "$('reading-reconcile-form').onsubmit=async event=>{",
    ),
    end = source.indexOf("setInterval(()=>{", start);
  if (start < 0 || end < 0) throw Error("Shared admin block changed");
  source = source.slice(0, start) + source.slice(end);
  source = source.replaceAll("'Subscribe to read'", "'Access required'");
  for (const id of [
    "check-reading-setup",
    "preview-reading-checkout",
    "reading-reconcile-form",
  ])
    source = required(
      source,
      `$("${id}").hidden = !user.isAdmin;`,
      `$("${id}").hidden = true;`,
    );
  return required(
    source,
    'checkoutController = initializeReadingCheckout(supabase,{button:$("subscribe-reading"),status:$("reading-payment-status"),retry:$("check-reading-payment")});',
    "checkoutController = null;",
  );
}
const plugin = {
  name: "sgeul-reader",
  setup(b) {
    b.onResolve({ filter: /^sgeul-connectivity$/ }, () => ({
      path: path.join(app, "src/connectivity.js"),
    }));
    b.onResolve({ filter: /^sgeul-shared-reader$/ }, () => ({
      path: path.join(repo, "js/BP-reading.js"),
    }));
    b.onResolve(
      { filter: /^https:\/\/esm.sh\/@supabase\/supabase-js/ },
      () => ({
        path: path.join(
          app,
          "node_modules/@supabase/supabase-js/dist/index.mjs",
        ),
      }),
    );
    b.onResolve({ filter: /BP-reading-checkout\.js/ }, () => ({
      path: "checkout-disabled",
      namespace: "sgeul",
    }));
    b.onLoad({ filter: /.*/, namespace: "sgeul" }, () => ({
      contents: "export function initializeReadingCheckout(){return null;}",
    }));
    b.onResolve({ filter: /^\/js\// }, (args) => ({
      path: path.join(repo, args.path.split("?")[0]),
    }));
    b.onResolve({ filter: /\.js\?v=/ }, (args) => ({
      path: path.resolve(args.resolveDir, args.path.split("?")[0]),
    }));
    b.onLoad({ filter: /\/js\/BP-reading\.js$/ }, async (args) => ({
      contents: useNativeConnectivity(
        nativeReader(await readFile(args.path, "utf8")),
      ),
      resolveDir: path.dirname(args.path),
      loader: "js",
    }));
    b.onLoad({ filter: /\/js\/BP-reading-offline\.js$/ }, async (args) => ({
      contents:
        (await readFile(args.path, "utf8")).split(
          "export async function prepareOfflineShell()",
        )[0] +
        `export async function prepareOfflineShell(){if(!window.__SGEUL_BUNDLED_READER__)throw Error('The bundled reader is unavailable.');}`,
      resolveDir: path.dirname(args.path),
      loader: "js",
    }));
    b.onLoad({ filter: /\/js\/BP-reading[^/]*\.js$/ }, async (args) => ({
      contents: useNativeConnectivity(await readFile(args.path, "utf8")),
      resolveDir: path.dirname(args.path),
      loader: "js",
    }));
  },
};
await build({
  entryPoints: {
    app: path.join(app, "src/app.js"),
    reader: path.join(app, "src/reader-entry.js"),
  },
  outdir: out,
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  plugins: [plugin],
});
await copyFile(path.join(app, "src/index.html"), path.join(out, "index.html"));
await copyFile(path.join(app, "src/sgeul.css"), path.join(out, "sgeul.css"));
await mkdir(path.join(out, "assets"), { recursive: true });
await copyFile(
  path.join(repo, "assets/Sgeul Icon Square.png"),
  path.join(out, "assets/sgeul-icon.png"),
);
let html = await read("pages/bp-reading.html");
html = html
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
  .replace(/<link[^>]*stylesheet[^>]*>/gi, "")
  .replace(
    "<title>BP Reading | Blackwood Publishing</title>",
    "<title>Sgeul · Your library</title>",
  );
html = html
  .replaceAll('href="/pages/members.html"', 'href="/index.html"')
  .replaceAll('href="/pages/publications.html"', 'href="/index.html"')
  .replace("BLACKWOOD</div>", "Sgeul</div>")
  .replace("Return to The Archivists", "Return to Sgeul");
html = html
  .replace(
    "</head>",
    '<link rel="stylesheet" href="/css/BP-Reading.css"><link rel="stylesheet" href="/sgeul.css"></head>',
  )
  .replace(/<div id="(?:header|footer)-placeholder"><\/div>/g, "")
  .replace(
    "</body>",
    '<script src="/vendor/epub.js"></script><script type="module" src="/reader.js"></script></body>',
  );
await writeFile(path.join(out, "pages/bp-reading.html"), html);
await mkdir(path.join(out, "vendor"), { recursive: true });
await build({
  entryPoints: [path.join(app, "src/epub-engine.js")],
  outfile: path.join(out, "vendor/epub.js"),
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "es2022",
});
const files = [
  "css/BP-Reading.css",
  "css/auth-loading.css",
  "data/book-discovery.json",
  "pages/the-third-night.html",
  "pages/gatestein-log.html",
];
const metadata = await read("data/book-discovery.json"),
  css = await read("css/BP-Reading.css"),
  store = await read("js/store.js"),
  literal = store.match(/const STORE_PRODUCTS = (\[[\s\S]*?\n    \]);/);
if (!literal) throw Error("Store product metadata changed");
const products = vm
  .runInNewContext("(" + literal[1] + ")")
  .filter(
    (item) =>
      !["writer-resources", "editorial-services"].includes(item.category),
  );
await mkdir(path.join(out, "data"), { recursive: true });
await writeFile(
  path.join(out, "data/physical-books.json"),
  JSON.stringify(products),
);
const paths = new Set(files);
for (const value of (metadata + css + JSON.stringify(products)).matchAll(
  /\/?assets\/[A-Za-z0-9_./ -]+\.(?:png|jpg|jpeg|webp|svg)/gi,
))
  paths.add(value[0].replace(/^\//, ""));
for (const relative of paths) {
  const target = path.join(out, relative);
  await mkdir(path.dirname(target), { recursive: true });
  await copyFile(path.join(repo, relative), target);
}
const reader = await readFile(path.join(out, "reader.js"), "utf8");
if (
  reader.includes("bp-reading-create-checkout") ||
  reader.includes("bp-reading-reconcile-order")
)
  throw Error("Digital checkout code entered the native build");
await writeFile(
  path.join(out, "build-info.json"),
  JSON.stringify({
    app: "Sgeul",
    version: JSON.parse(await readFile(path.join(app, "package.json"), "utf8"))
      .version,
    bundledReader: true,
    physicalShop: true,
  }),
);
console.log(
  "Built Sgeul: bundled protected reader, encrypted offline storage, physical-only bookshop.",
);
