/* Cache only the public reader shell. Auth/API/private EPUB responses never enter CacheStorage. */
const CACHE='bp-reader-shell-v1';
const SHELL='/pages/bp-reading.html';
const CORE=[SHELL,'/css/header.css?v=20261115','/css/styles.css?v=20260913','/css/site-polish.css?v=20261120','/css/BP-Reading.css?v=20261127','/js/BP-reading.js?v=20261130','/js/BP-reading-offline.js?v=20261130','/js/BP-reading-catalogue.js?v=20261124','/js/BP-reading-public.js?v=20261122','/js/BP-reading-account.js?v=20261127','/js/BP-reading-checkout.js?v=20261118','/js/header.js?v=20261116','/js/analytics-consent.js?v=20261116','/header-simple.html','/footer.html','/data/book-discovery.json?v=20261124','https://esm.sh/@supabase/supabase-js@2','https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js','https://cdn.jsdelivr.net/npm/epubjs@0.3.93/dist/epub.min.js'];
const moduleHost=url=>url.origin==='https://esm.sh';
function allowed(url) {
  if(url.origin===self.location.origin)return url.pathname===SHELL||url.pathname==='/header-simple.html'||url.pathname==='/footer.html'||/^\/(js|css|assets)\//.test(url.pathname)||url.pathname==='/data/book-discovery.json';
  return moduleHost(url)||(url.origin==='https://cdn.jsdelivr.net'&&/^\/npm\/(jszip@3\.10\.1|epubjs@0\.3\.93)\//.test(url.pathname));
}
async function prepare() {
  const cache=await caches.open(CACHE),seen=new Set();
  async function save(path) {
    const url=new URL(path,self.location.origin);if(seen.has(url.href))return;
    if(!allowed(url)||seen.size>=100)throw Error('An unsupported reader dependency prevented offline preparation.');seen.add(url.href);
    let response;
    const label=url.origin===self.location.origin?url.pathname:url.origin+url.pathname;
    try{response=await fetch(url.href,{cache:'reload',credentials:url.origin===self.location.origin?'same-origin':'omit',mode:'cors',signal:AbortSignal.timeout(15000)});}
    catch{throw Error('Offline reader could not fetch '+label+'. Check the connection or content blocker.');}
    if(!response.ok||response.type==='opaque')throw Error('Offline reader could not cache '+label+' (HTTP '+response.status+').');
    await cache.put(url.href,response.clone());
    if(moduleHost(url)) {
      const code=await response.text();
      // Only eager static imports/re-exports are needed to start the offline reader.
      // Optional dynamic imports (e.g. Supabase tracing) are not valid relative CDN paths.
      for(const match of code.matchAll(/(?:\bfrom\s*|\bimport\s*)["']([^"']+)["']/g)) {
        const dependency=new URL(match[1],url);if(!moduleHost(dependency))throw Error('Unexpected module host');await save(dependency.href);
      }
    }
  }
  for(const path of CORE)await save(path);
}
self.addEventListener('install',event=>{event.waitUntil(self.skipWaiting());});
self.addEventListener('activate',event=>{event.waitUntil(self.clients.claim());});
self.addEventListener('message',event=>{if(event.data?.type==='PREPARE_READER')event.waitUntil(prepare().then(()=>event.ports[0]?.postMessage({ok:true,revision:4})).catch(error=>event.ports[0]?.postMessage({ok:false,revision:4,error:error.message})));});
self.addEventListener('fetch',event=>{
  const {request}=event,url=new URL(request.url);
  if(request.method!=='GET'||!allowed(url)||(request.mode==='navigate'&&url.pathname!==SHELL))return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    try {const response=await fetch(request);if(response.ok&&response.type!=='opaque')await cache.put(request,response.clone());return response;}
    catch {const cached=await cache.match(request,{ignoreSearch:true});if(cached)return cached;throw Error('Not available offline');}
  })());
});
