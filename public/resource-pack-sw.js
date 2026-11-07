// Serves the selected resource packs' files (src/resource-packs.js writes the table to IndexedDB "mc-web-resource-packs",
// store "overrides": url path -> { blob, type }) in place of the bundled 1.7.10 media and sounds. Anything not overridden
// goes to the network unchanged.
let table = null;
function load() {
  return (table ??= new Promise((resolve) => {
    const open = indexedDB.open("mc-web-resource-packs", 1);
    open.onupgradeneeded = () => { for (const s of ["packs", "overrides", "meta"]) open.result.createObjectStore(s); };
    open.onerror = () => resolve(new Map());
    open.onsuccess = () => {
      const tx = open.result.transaction("overrides", "readonly"), s = tx.objectStore("overrides"), keys = s.getAllKeys(), values = s.getAll();
      tx.oncomplete = () => resolve(new Map(keys.result.map((k, i) => [k, values.result[i]])));
      tx.onerror = () => resolve(new Map());
    };
  }));
}
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("message", (e) => {
  if (e.data?.type !== "refresh") return;
  table = null;
  // Reload the table now and answer once it is ready, so the page can refresh its resources in place afterwards.
  e.waitUntil(load().then(() => e.ports?.[0]?.postMessage("ready")));
});
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || event.request.method !== "GET") return;
  if (!url.pathname.startsWith("/media/1.7.10/") && !url.pathname.startsWith("/audio/1.7.10")) return;
  event.respondWith(load().then((t) => {
    const hit = t.get(decodeURIComponent(url.pathname));
    // An mcmeta the packs hide (a pack png without its own mcmeta) answers 404, as the missing resource does natively.
    if (hit?.missing) return new Response(null, { status: 404 });
    return hit ? new Response(hit.blob, { headers: { "Content-Type": hit.type, "Cache-Control": "no-store" } }) : fetch(event.request);
  }));
});
