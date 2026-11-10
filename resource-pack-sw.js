// Replaces the normal resource-pack worker for this frozen encrypted publication only. Plaintext is never put in a
// Cache API store. A nonextractable CryptoKey stays in this browser's IndexedDB until expiry or an explicit lock.
const CONFIG = {"base":"/mc-web/","version":"396a5606a4c2","salt":"IW6qBXhSdkxQ6C8iUidawA==","iterations":600000,"sessionMs":43200000};
const enc = new TextEncoder(), dbName = "mc-web-protected:" + CONFIG.base;
let session = null, overrides = null;
function db() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(dbName, 1);
    r.onupgradeneeded = () => r.result.createObjectStore("session");
    r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error);
  });
}
async function stored(value, write = false) {
  const d = await db();
  try { return await new Promise((resolve, reject) => {
    const tx = d.transaction("session", write ? "readwrite" : "readonly"), store = tx.objectStore("session");
    const r = write ? value ? store.put(value, "key") : store.delete("key") : store.get("key");
    tx.oncomplete = () => resolve(r.result); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
  }); } finally { d.close(); }
}
async function open(bytes, key, label) {
  return crypto.subtle.decrypt({ name: "AES-GCM", iv: bytes.slice(0, 12), additionalData: enc.encode(label) }, key, bytes.slice(12));
}
const inflate = (bytes) => new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"))).arrayBuffer();
async function manifest(key) {
  const r = await fetch(CONFIG.base + "sealed/manifest.bin", { cache: "no-store" });
  if (!r.ok) throw Error("The preview files could not be loaded. Try again.");
  return JSON.parse(new TextDecoder().decode(await inflate(await open(await r.arrayBuffer(), key, "manifest"))));
}
async function restore() {
  const saved = await stored();
  if (!saved || saved.salt !== CONFIG.salt || saved.expires <= Date.now()) return null;
  return { ...saved, manifest: await manifest(saved.key) };
}
// A failed restore is not kept: another worker of this registration (the one being replaced by a new publication) may have
// stored the key since, and IndexedDB is read again on the next request.
async function current() {
  const pending = session ??= restore().catch(() => null), s = await pending;
  if (s && s.expires > Date.now()) return s;
  if (session === pending) session = null;
  return null;
}
async function unlock(passcode) {
  const material = await crypto.subtle.importKey("raw", enc.encode(String(passcode)), "PBKDF2", false, ["deriveKey"]);
  const key = await crypto.subtle.deriveKey({ name: "PBKDF2", hash: "SHA-256", iterations: CONFIG.iterations,
    salt: Uint8Array.from(atob(CONFIG.salt), c => c.charCodeAt(0)) }, material, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
  let data;
  try { data = await manifest(key); } catch (e) {
    if (e.name === "OperationError") throw Error("Incorrect passcode. Try again.");
    throw e;
  }
  const saved = { key, salt: CONFIG.salt, expires: Date.now() + CONFIG.sessionMs };
  await stored(saved, true);
  session = Promise.resolve({ ...saved, manifest: data });
}
// Same IndexedDB table/protocol as the game's ordinary resource-pack worker.
function packOverrides() {
  return overrides ??= new Promise(resolve => {
    const r = indexedDB.open("mc-web-resource-packs", 1);
    r.onupgradeneeded = () => { for (const s of ["packs", "overrides", "meta"]) r.result.createObjectStore(s); };
    r.onerror = () => resolve(new Map());
    r.onsuccess = () => {
      const d = r.result, tx = d.transaction("overrides"), store = tx.objectStore("overrides"), keys = store.getAllKeys(), values = store.getAll();
      tx.oncomplete = () => { d.close(); resolve(new Map(keys.result.map((k, i) => [k, values.result[i]]))); };
      tx.onerror = () => { d.close(); resolve(new Map()); };
    };
  });
}
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));
self.addEventListener("message", e => {
  e.waitUntil((async () => {
    try {
      if (e.data?.type === "refresh") { overrides = null; await packOverrides(); e.ports?.[0]?.postMessage("ready"); return; }
      if (e.data?.type === "unlock") await unlock(e.data.passcode);
      else if (e.data?.type === "lock") { session = null; await stored(null, true); }
      else if (e.data?.type !== "status") return;
      e.ports?.[0]?.postMessage({ ok: !!await current() });
    } catch (error) { e.ports?.[0]?.postMessage({ ok: false, error: error.message }); }
  })());
});
async function serve(request, url) {
  const s = await current();
  if (!s) return request.mode === "navigate" ? fetch(CONFIG.base + "unlock.html", { cache: "no-store" }) : new Response("Locked", { status: 401 });
  let rel;
  try { rel = decodeURIComponent(url.pathname.slice(CONFIG.base.length)); } catch { return new Response(null, { status: 400 }); }
  if (!rel) rel = "index.html";
  // A page load reads the manifest again, so a worker still running from before a republication (same salt, so the same
  // key) serves the newest build rather than the one it started with.
  if (request.mode === "navigate") s.manifest = await manifest(s.key).catch(() => s.manifest);
  if (rel.startsWith("media/1.7.10/") || rel.startsWith("audio/1.7.10")) {
    const hit = (await packOverrides()).get(decodeURIComponent(url.pathname));
    if (hit?.missing) return new Response(null, { status: 404 });
    if (hit) return new Response(hit.blob, { headers: { "Content-Type": hit.type, "Cache-Control": "no-store" } });
  }
  const entry = Object.hasOwn(s.manifest.files, rel) && s.manifest.files[rel];
  if (!entry) return new Response(null, { status: 404 });
  const response = await fetch(CONFIG.base + "sealed/" + entry.file + url.search,
    url.search ? { cache: "no-store" } : undefined);
  if (!response.ok) return new Response("Preview file unavailable", { status: 502 });
  let bytes = await open(await response.arrayBuffer(), s.key, rel);
  if (entry.gzip) bytes = await inflate(bytes);
  const headers = { "Content-Type": entry.type, "Cache-Control": "no-store", "Accept-Ranges": "bytes" };
  const range = request.headers.get("Range");
  if (range) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(range), size = bytes.byteLength;
    if (!m || (!m[1] && !m[2])) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    const start = m[1] ? +m[1] : Math.max(0, size - +m[2]), end = m[1] && m[2] ? Math.min(+m[2], size - 1) : size - 1;
    if (start >= size || start > end) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    return new Response(bytes.slice(start, end + 1), { status: 206, headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${size}` } });
  }
  return new Response(bytes, { headers });
}
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin || !url.pathname.startsWith(CONFIG.base) || e.request.method !== "GET") return;
  const rel = url.pathname.slice(CONFIG.base.length);
  if (rel === "unlock.html" || rel === "resource-pack-sw.js" || rel.startsWith("sealed/")) return;
  e.respondWith(serve(e.request, url).catch(() => new Response("Preview file unavailable", { status: 502 })));
});
