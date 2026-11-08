// 3D Anaglyph for the DOM GUI. Natively every GUI texture (container backgrounds, widgets, icons, items, the HUD) is uploaded through
// TextureUtil.anaglyphColor like any other texture (bqi.b, read from GameSettings.anaglyph), so the GUI is drawn from converted pixels
// and is not eye-masked (only the 3D world pass is). The port draws that GUI as DOM, which no GL upload hook can reach, so while the
// option is on every PNG the DOM shows is replaced by a converted copy, cached per source:
//   - stylesheet rules, inline styles and <img>/<style>/<link> nodes under /media/1.7.10/ (the CSS sprites of every screen and the HUD),
//   - data-URL <img> icons (block icons, animated item frames) which are also GL textures elsewhere, so they are converted at the DOM sink,
//   - Image objects the canvas screens draw from (loadGuiImage), and the extra WebGL contexts (paperdoll, horse, book, panorama), which
//     share this module's `guiAnaglyph` object as the upload-hook state.
// The conversion is exact: the PNG is decoded without a canvas (png-codec.js; getImageData would round translucent pixels through
// premultiplied alpha), run through anaglyphRgba and re-encoded. A converted CSS url carries "#mcag=<source path>" so the original can be
// restored when the option is turned off (a data-URL fragment is ignored when the image is decoded). Toggling goes through
// refreshResources like GameSettings.setOptionValue (bao.c()), which calls prepareGuiImages and refreshStyles below.
import { anaglyphRgba } from "./anaglyph.js";
import { decodePng, encodePng, setExactPixels, clearExactPixels } from "./png-codec.js";
import { versioned, unversioned, mediaGeneration } from "./media-version.js";

export const guiAnaglyph = { on: false };
const PNG_DATA = "data:image/png;base64,", TAG = "#mcag", MEDIA = "/media/1.7.10/";
const TRANSPARENT = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";
// An optional absolute-url origin is kept in the capture so CSSOM serialisations (which may be absolute) round-trip.
const MEDIA_IN_TEXT = /(https?:\/\/[^/"')\s]+)?(\/media\/1\.7\.10\/[^"')\s?]+?\.png)(\?r=\d+)?/g;
const TAGGED_IN_TEXT = /data:image\/png;base64,[A-Za-z0-9+/=]*#mcag=([^"')\s]+)/g;

// ---- conversion ------------------------------------------------------------------------------------------------------
const base64 = (bytes) => { let s = ""; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s); };
const unbase64 = (text) => { const bin = atob(text), out = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out; };

// Fallback for PNG variants the exact decoder refuses (16-bit, interlaced, colour keys): the canvas path, with its premultiplied rounding.
async function canvasConvert(bytes) {
  if (typeof createImageBitmap !== "function" || typeof document === "undefined") return null;
  const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width; canvas.height = bitmap.height;
  const g = canvas.getContext("2d", { willReadFrequently: true });
  g.drawImage(bitmap, 0, 0);
  const image = g.getImageData(0, 0, canvas.width, canvas.height);
  anaglyphRgba(image.data);
  return encodePng(canvas.width, canvas.height, new Uint8Array(image.data.buffer));
}
// PNG bytes in, converted PNG bytes out (null when the file cannot be read).
export async function convertPngBytes(bytes) {
  const png = await decodePng(bytes);
  if (png) { anaglyphRgba(png.data); return encodePng(png.width, png.height, png.data); }
  return canvasConvert(bytes);
}

// One cache per media generation (a resource pack change bumps it): source -> Promise, and the resolved values for synchronous use.
let store = { gen: -1, promises: new Map(), done: new Map() };
const current = () => { const gen = mediaGeneration(); if (store.gen !== gen || store.promises.size > 4000) { store = { gen, promises: new Map(), done: new Map() }; clearExactPixels(); } return store; };
const keyOf = (raw) => (raw.startsWith("data:") ? raw.replace(/#.*$/, "") : unversioned(raw));

async function sourceBytes(key, gen) {
  if (key.startsWith(PNG_DATA)) return unbase64(key.slice(PNG_DATA.length));
  const response = await fetch(versioned(key, gen));
  if (!response.ok) throw new Error(String(response.status));
  return new Uint8Array(await response.arrayBuffer());
}
// A canvas the GUI drew from texture pixels (the profile screen skin preview): converted in place while the option is on (the canvas path,
// so translucent edge pixels round through premultiplied alpha; skins are normally opaque or fully transparent).
export function convertGuiCanvas(canvas) {
  if (!guiAnaglyph.on || !canvas?.width || !canvas.height) return canvas;
  const g = canvas.getContext("2d", { willReadFrequently: true }), image = g.getImageData(0, 0, canvas.width, canvas.height);
  anaglyphRgba(image.data);
  g.putImageData(image, 0, 0);
  return canvas;
}

// Converted PNGs persist across page loads in the Cache API, keyed by the SHA-1 of the source bytes (so a changed resource pack or file can
// never serve a stale copy; the key needs no generation) and the codec version in the cache name. Missing APIs (tests, http) skip it.
const CACHE_NAME = "mcag-1", CACHE_LIMIT = 1500;
let cachePromise = null;
const openCache = () => cachePromise ??= (typeof caches === "undefined" ? Promise.resolve(null) : caches.open(CACHE_NAME).then(async (c) => { if ((await c.keys()).length > CACHE_LIMIT) { await caches.delete(CACHE_NAME); return caches.open(CACHE_NAME); } return c; }).catch(() => null));
async function sha1(bytes) {
  if (typeof crypto === "undefined" || !crypto.subtle) return null;
  return [...new Uint8Array(await crypto.subtle.digest("SHA-1", bytes))].map((b) => b.toString(16).padStart(2, "0")).join("");
}
export const cacheStats = { hits: 0, misses: 0 };
async function convertCached(bytes) {
  const cache = await openCache(), hash = cache ? await sha1(bytes) : null;
  if (!hash) return convertPngBytes(bytes);
  const request = new Request(`https://mcag.invalid/${hash}`), hit = await cache.match(request).catch(() => null);
  if (hit) { cacheStats.hits++; return new Uint8Array(await hit.arrayBuffer()); }
  cacheStats.misses++;
  const out = await convertPngBytes(bytes);
  if (out) cache.put(request, new Response(out, { headers: { "content-type": "image/png" } })).catch(() => {});
  return out;
}
// The exact converted pixels of a /media path for the GL upload hook (png-codec.js getExactPixels), registered before an image is uploaded.
export async function convertExact(raw) {
  const c = current(), key = keyOf(raw);
  if (key.startsWith("data:")) return false;
  try {
    const png = await decodePng(await sourceBytes(key, c.gen));
    if (!png) return false;
    anaglyphRgba(png.data);
    if (current() === c) setExactPixels(key, png.width, png.height, png.data);
    return true;
  } catch { return false; }
}

// Converted data URL of a /media path or a data:image/png url (null when it cannot be converted). Cached per source.
export function convertUrl(raw) {
  const c = current(), key = keyOf(raw);
  let p = c.promises.get(key);
  if (!p) {
    p = (async () => {
      try {
        const bytes = await sourceBytes(key, c.gen), out = key.startsWith("data:") ? await convertPngBytes(bytes) : await convertCached(bytes);
        return out ? PNG_DATA + base64(out) + (key.startsWith("data:") ? TAG : `${TAG}=${encodeURIComponent(key)}`) : null;
      } catch { return null; }
    })().then((v) => { c.done.set(key, v); return v; });
    c.promises.set(key, p);
  }
  return p;
}
export const convertedUrl = (raw) => current().done.get(keyOf(raw)) ?? null;

// ---- text (stylesheets, inline styles) --------------------------------------------------------------------------------
export function pathsIn(text) {
  const out = new Set();
  if (text.includes(TAG)) text.replace(TAGGED_IN_TEXT, (m, enc) => { out.add(decodeURIComponent(enc)); return m; });
  text.replace(MEDIA_IN_TEXT, (m, _o, path) => { out.add(path); return m; });
  return out;
}
// The css text with every /media/1.7.10 png at the url the GUI should use now: the converted copy while anaglyph is on and ready, else
// the (versioned) original. Tagged converted urls are restored first, so rewriting is idempotent in both directions.
// `hidePending` (inline styles first seen while the option is on) shows a transparent pixel for a path whose conversion is still running,
// so the raw colours are never drawn.
export function rewriteGuiText(text, gen, hidePending = false) {
  if (text.includes(TAG)) text = text.replace(TAGGED_IN_TEXT, (_m, enc) => decodeURIComponent(enc));
  return text.replace(MEDIA_IN_TEXT, (_m, origin, path) => (guiAnaglyph.on && (convertedUrl(path) || (hidePending && TRANSPARENT))) || (origin ?? "") + versioned(path, gen));
}
export function rewriteRule(rule, gen) {
  if (rule.cssRules) for (const r of rule.cssRules) rewriteRule(r, gen);
  const style = rule.style;
  if (!style) return;
  // A shorthand that holds var() reports empty longhands, so walk the declarations as written (cssText), not style[i].
  const text = style.cssText;
  if (!text.includes(MEDIA) && !text.includes(TAG)) return;
  for (const decl of text.split(/;(?![^(]*\))/)) {
    if (!decl.includes(MEDIA) && !decl.includes(TAG)) continue;
    const colon = decl.indexOf(":");
    if (colon < 0) continue;
    const name = decl.slice(0, colon).trim();
    let value = decl.slice(colon + 1).trim(), priority = "";
    if (/\s*!important$/.test(value)) { value = value.replace(/\s*!important$/, ""); priority = "important"; }
    style.setProperty(name, rewriteGuiText(value, gen), priority);
  }
}
function sheetText(sheet) {
  let rules;
  try { rules = sheet.cssRules; } catch { return ""; }
  let text = "";
  for (const rule of rules) text += rule.cssText + "\n";
  return text;
}
const sheetsOf = (doc) => [...doc.styleSheets];

// ---- <img> -------------------------------------------------------------------------------------------------------------
// A data url tagged ':ag' (block-textures.js icon from the converted atlas) is already converted.
const isGuiSrc = (s) => (s.startsWith(PNG_DATA) && !/#mcicon=[^#]*:ag$/.test(s)) || (new RegExp(`^(https?://[^/]+)?${MEDIA.replace(/\./g, "\\.")}.+\\.png`).test(s));
const lastSet = new WeakMap(); // img -> the src attribute this module wrote, so its own mutation records are skipped
export const rawImgSrc = (img) => img.dataset?.rawSrc ?? img.getAttribute("src");
function setSrc(img, value) { lastSet.set(img, value); img.setAttribute("src", value); }

// Brings one <img> to the state the option asks for. `dataset.rawSrc` holds the source as the page wrote it while this module manages the
// image; a src that differs from what was last written here is a fresh value from other code. While a conversion is pending the image
// shows nothing rather than the raw colours.
export function applyImg(img, gen = mediaGeneration()) {
  const attr = img.getAttribute("src");
  if (!attr) return;
  const own = img.dataset.rawSrc !== undefined && lastSet.get(img) === attr, raw = own ? img.dataset.rawSrc : attr;
  if (!isGuiSrc(raw)) { delete img.dataset.rawSrc; return; }
  if (!guiAnaglyph.on) {
    delete img.dataset.rawSrc;
    const next = rewriteGuiText(raw, gen);
    if (next !== attr) setSrc(img, next);
    return;
  }
  img.dataset.rawSrc = raw;
  const ready = convertedUrl(raw);
  if (ready) { if (attr !== ready) setSrc(img, ready); return; }
  if (attr !== TRANSPARENT) setSrc(img, TRANSPARENT);
  track(convertUrl(raw)).then((value) => {
    if (!guiAnaglyph.on || img.dataset.rawSrc !== raw || img.getAttribute("src") !== TRANSPARENT) return; // changed meanwhile
    setSrc(img, value ?? rewriteGuiText(raw, mediaGeneration()));
  });
}

// ---- element and sheet adoption (observer and refresh) -----------------------------------------------------------------
let inFlight = 0; // conversions the observer started (the startup hold waits for them)
const track = (p) => { inFlight++; const done = () => { inFlight--; }; p.then(done, done); return p; };
const pendingStyle = new WeakMap(), pendingEls = new Set(); // el -> { raw, hidden }: an inline style waiting for conversions, shown without its images meanwhile
function applyStyleAttr(el, gen) {
  const attr = el.getAttribute("style");
  if (!attr || !(attr.includes(MEDIA) || attr.includes(TAG))) return;
  const held = pendingStyle.get(el), text = held && held.hidden === attr ? held.raw : attr;
  if (guiAnaglyph.on) {
    const missing = [...pathsIn(text)].filter((p) => !convertedUrl(p));
    if (missing.length) {
      const hidden = rewriteGuiText(text, gen, true);
      pendingStyle.set(el, { raw: text, hidden }); pendingEls.add(el);
      if (hidden !== attr) el.setAttribute("style", hidden);
      track(Promise.all(missing.map(convertUrl))).then(() => { if (guiAnaglyph.on && el.getAttribute("style") === hidden) { pendingStyle.delete(el); pendingEls.delete(el); el.setAttribute("style", text); applyStyleAttr(el, mediaGeneration()); } });
      return;
    }
  }
  pendingStyle.delete(el); pendingEls.delete(el);
  const next = rewriteGuiText(text, gen);
  if (next !== attr) el.setAttribute("style", next);
}
function applySheet(sheet, gen) {
  if (!sheet) return;
  const text = sheetText(sheet);
  if (!text.includes(MEDIA) && !text.includes(TAG)) return;
  if (guiAnaglyph.on) {
    const missing = [...pathsIn(text)].filter((p) => !convertedUrl(p));
    if (missing.length) { track(Promise.all(missing.map(convertUrl))).then(() => { if (guiAnaglyph.on) applySheet(sheet, mediaGeneration()); }); return; }
  }
  let rules;
  try { rules = sheet.cssRules; } catch { return; }
  for (const rule of rules) rewriteRule(rule, gen);
}
const adoptNode = (el, gen) => {
  if (el.tagName === "IMG") applyImg(el, gen);
  else if (el.tagName === "STYLE") applySheet(el.sheet, gen);
  else if (el.tagName === "LINK" && el.rel === "stylesheet") { if (el.sheet) applySheet(el.sheet, gen); else el.addEventListener("load", () => applySheet(el.sheet, mediaGeneration()), { once: true }); }
  if (el.hasAttribute?.("style")) applyStyleAttr(el, gen);
};

let observer = null;
function startObserver(doc = globalThis.document) {
  if (observer || !doc || typeof MutationObserver === "undefined") return;
  observer = new MutationObserver((records) => {
    const gen = mediaGeneration(), seen = new Set();
    const visit = (el) => { if (!seen.has(el)) { seen.add(el); adoptNode(el, gen); } };
    for (const r of records) {
      if (r.type === "attributes") {
        const el = r.target;
        if (r.attributeName === "src" ? el.getAttribute("src") !== lastSet.get(el) : (el.getAttribute("style") ?? "").includes(MEDIA)) visit(el);
      } else {
        for (const n of r.addedNodes) {
          if (n.nodeType !== 1) { if (n.parentNode?.tagName === "STYLE") visit(n.parentNode); continue; }
          visit(n);
          for (const d of n.querySelectorAll(`img,style,link[rel=stylesheet],[style*="${MEDIA}"]`)) visit(d);
        }
        if (r.target.tagName === "STYLE") visit(r.target);
      }
    }
  });
  observer.observe(doc.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["src", "style"] });
}
function stopObserver() { observer?.disconnect(); observer = null; }

// The option state has two parts, so a toggle never shows a half-converted GUI (natively refreshResources converts every texture before
// the next frame): `wanted` is the option as asked for, `guiAnaglyph.on` is what the GUI shows. requestGuiAnaglyph starts converting
// ahead; refreshResources commits (commitGuiAnaglyph) once every PNG the stylesheets, inline styles and images reference is ready, and
// the old state stays on screen until then. setGuiAnaglyph requests and commits at once (tests, pages without a refresh).
let wanted = false;
export const wantsGuiAnaglyph = () => wanted;
export function requestGuiAnaglyph(on) {
  wanted = !!on;
  if (wanted) prepareGuiImages(mediaGeneration()).catch(() => {});
}
export function commitGuiAnaglyph() {
  const on = wanted;
  if (guiAnaglyph.on === on) return;
  guiAnaglyph.on = on;
  if (on) startObserver();
  else {
    stopObserver();
    for (const el of pendingEls) { const held = pendingStyle.get(el); if (held && el.getAttribute("style") === held.hidden) el.setAttribute("style", held.raw); }
    pendingEls.clear();
  }
}
export function setGuiAnaglyph(on) { wanted = !!on; commitGuiAnaglyph(); }

// Before the commit: converts every /media png the stylesheets, inline styles and images mention, so the synchronous rewrite finds them.
// The path list is remembered (localStorage) so the next page load can convert them before the first frame (startGuiAnaglyph).
const MANIFEST = "mcag.manifest";
export async function prepareGuiImages(gen, doc = globalThis.document) {
  if (!wanted || !doc) return 0;
  const wantedPaths = new Set();
  for (const sheet of sheetsOf(doc)) for (const p of pathsIn(sheetText(sheet))) wantedPaths.add(p);
  for (const el of doc.querySelectorAll(`[style*="${MEDIA}"],[style*="${TAG}"]`)) for (const p of pathsIn(el.getAttribute("style"))) wantedPaths.add(p);
  for (const img of doc.querySelectorAll("img")) { const raw = rawImgSrc(img); if (raw && isGuiSrc(raw)) wantedPaths.add(raw); }
  await Promise.all([...wantedPaths].map(convertUrl));
  try { const known = [...wantedPaths].filter((p) => p.startsWith(MEDIA)); if (known.length) localStorage.setItem(MANIFEST, JSON.stringify(known.slice(0, 600))); } catch {}
  return wantedPaths.size;
}

// Page load with the option stored on: the paths of the last session are converted (from the Cache API: no decode or encode) while the
// page is held invisible, then the GUI commits, so the first visible frame is already converted. The hold is capped at 1.5 s.
function storedOption() {
  try {
    const json = localStorage.getItem("blockworld.settings");
    if (json) return !!JSON.parse(json).anaglyph;
    return /^anaglyph3d:true$/m.test(localStorage.getItem("blockworld.options.txt") ?? "");
  } catch { return false; }
}
export function startGuiAnaglyph() {
  if (typeof document === "undefined" || typeof localStorage === "undefined" || !storedOption()) return null;
  wanted = true;
  const hold = document.createElement("style");
  hold.id = "mcag-hold";
  hold.textContent = "body{visibility:hidden !important}";
  (document.head ?? document.documentElement).append(hold);
  let paths = [];
  try { paths = JSON.parse(localStorage.getItem(MANIFEST) ?? "[]"); } catch {}
  const release = () => { clearTimeout(timer); clearTimeout(poll); hold.remove(); };
  const timer = setTimeout(release, 1500);
  let poll = 0;
  const idle = () => { if (inFlight === 0 && document.readyState === "complete") release(); else poll = setTimeout(idle, 40); };
  return Promise.all(paths.map((p) => convertUrl(p))).then(() => { commitGuiAnaglyph(); refreshGuiNodes(mediaGeneration()); idle(); }).catch(release);
}

// Item icons (block-textures.js icon) are tagged "#mcicon=<id>:<damage>"; after a refresh rebuilt the atlas the live <img> icons are
// replaced by the current atlas version (converted from the converted atlas, or raw), so toggling the option never leaves a stale icon.
let iconResolver = null;
export const setIconResolver = (fn) => { iconResolver = fn; };
export function refreshIcons(doc = globalThis.document) {
  if (!doc || !iconResolver) return 0;
  let n = 0;
  for (const img of doc.querySelectorAll('img[src*="#mcicon="],img[data-raw-src*="#mcicon="]')) {
    const tag = /#mcicon=(-?\d+):(-?\d+)(:ag)?$/.exec(rawImgSrc(img) ?? "");
    if (!tag) continue;
    delete img.dataset.rawSrc;
    const next = iconResolver(+tag[1], +tag[2]);
    lastSet.delete(img);
    img.setAttribute("src", next);
    applyImg(img);
    n++;
  }
  return n;
}

// refreshStyles (resource-refresh.js): sheets, images and inline styles to the state the option asks for under generation `gen`.
export function refreshGuiNodes(gen, doc = globalThis.document) {
  if (!doc) return;
  for (const sheet of sheetsOf(doc)) {
    let rules;
    try { rules = sheet.cssRules; } catch { continue; }
    for (const rule of rules) rewriteRule(rule, gen);
  }
  for (const img of doc.querySelectorAll("img")) applyImg(img, gen);
  for (const el of doc.querySelectorAll(`[style*="${MEDIA}"],[style*="${TAG}"]`)) applyStyleAttr(el, gen);
}

// An Image for a canvas screen: converted while the option is on. Until the conversion is ready it reports complete = false (an <img>
// without a src is "complete", and the screens draw only complete images).
export function loadGuiImage(src) {
  const img = new Image(), raw = versioned(src);
  if (!guiAnaglyph.on) { img.src = raw; return img; }
  const complete = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "complete").get;
  let ready = false;
  Object.defineProperty(img, "complete", { configurable: true, get: () => ready && complete.call(img) });
  convertUrl(src).then((value) => { ready = true; img.src = value ?? raw; });
  return img;
}

startGuiAnaglyph();
