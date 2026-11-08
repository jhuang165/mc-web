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
import { decodePng, encodePng } from "./png-codec.js";
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
const current = () => { const gen = mediaGeneration(); if (store.gen !== gen || store.promises.size > 4000) store = { gen, promises: new Map(), done: new Map() }; return store; };
const keyOf = (raw) => (raw.startsWith("data:") ? raw.replace(/#.*$/, "") : unversioned(raw));

async function sourceBytes(key, gen) {
  if (key.startsWith(PNG_DATA)) return unbase64(key.slice(PNG_DATA.length));
  const response = await fetch(versioned(key, gen));
  if (!response.ok) throw new Error(String(response.status));
  return new Uint8Array(await response.arrayBuffer());
}
// Converted data URL of a /media path or a data:image/png url (null when it cannot be converted). Cached per source.
export function convertUrl(raw) {
  const c = current(), key = keyOf(raw);
  let p = c.promises.get(key);
  if (!p) {
    p = (async () => {
      try {
        const out = await convertPngBytes(await sourceBytes(key, c.gen));
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
export function rewriteGuiText(text, gen) {
  if (text.includes(TAG)) text = text.replace(TAGGED_IN_TEXT, (_m, enc) => decodeURIComponent(enc));
  return text.replace(MEDIA_IN_TEXT, (_m, origin, path) => (guiAnaglyph.on && convertedUrl(path)) || (origin ?? "") + versioned(path, gen));
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
const isGuiSrc = (s) => s.startsWith(PNG_DATA) || (new RegExp(`^(https?://[^/]+)?${MEDIA.replace(/\./g, "\\.")}.+\\.png`).test(s));
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
  convertUrl(raw).then((value) => {
    if (!guiAnaglyph.on || img.dataset.rawSrc !== raw || img.getAttribute("src") !== TRANSPARENT) return; // changed meanwhile
    setSrc(img, value ?? rewriteGuiText(raw, mediaGeneration()));
  });
}

// ---- element and sheet adoption (observer and refresh) -----------------------------------------------------------------
function applyStyleAttr(el, gen) {
  const text = el.getAttribute("style");
  if (!text || !(text.includes(MEDIA) || text.includes(TAG))) return;
  if (guiAnaglyph.on) {
    const missing = [...pathsIn(text)].filter((p) => !convertedUrl(p));
    if (missing.length) { Promise.all(missing.map(convertUrl)).then(() => { if (guiAnaglyph.on && el.getAttribute("style") === text) applyStyleAttr(el, mediaGeneration()); }); return; }
  }
  const next = rewriteGuiText(text, gen);
  if (next !== text) el.setAttribute("style", next);
}
function applySheet(sheet, gen) {
  if (!sheet) return;
  const text = sheetText(sheet);
  if (!text.includes(MEDIA) && !text.includes(TAG)) return;
  if (guiAnaglyph.on) {
    const missing = [...pathsIn(text)].filter((p) => !convertedUrl(p));
    if (missing.length) { Promise.all(missing.map(convertUrl)).then(() => { if (guiAnaglyph.on) applySheet(sheet, mediaGeneration()); }); return; }
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

// The option state. Turning it on starts the observer immediately; refreshResources (prepare + refreshStyles) converts what already exists.
export function setGuiAnaglyph(on) {
  on = !!on;
  if (guiAnaglyph.on === on) return;
  guiAnaglyph.on = on;
  if (on) startObserver(); else stopObserver();
}

// Before refreshStyles: converts every /media png the stylesheets, inline styles and images mention, so the synchronous rewrite finds them.
export async function prepareGuiImages(gen, doc = globalThis.document) {
  if (!guiAnaglyph.on || !doc) return 0;
  const wanted = new Set();
  for (const sheet of sheetsOf(doc)) for (const p of pathsIn(sheetText(sheet))) wanted.add(p);
  for (const el of doc.querySelectorAll(`[style*="${MEDIA}"],[style*="${TAG}"]`)) for (const p of pathsIn(el.getAttribute("style"))) wanted.add(p);
  for (const img of doc.querySelectorAll("img")) { const raw = rawImgSrc(img); if (raw && isGuiSrc(raw)) wanted.add(raw); }
  await Promise.all([...wanted].map(convertUrl));
  return wanted.size;
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
