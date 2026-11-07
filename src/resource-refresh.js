// In-place resource refresh (the Minecraft.refreshResources analogue): after the resource pack selection changes the game
// re-reads every pack-dependent resource without reloading the page, so the world keeps running.
//   - Every THREE.TextureLoader texture of /media/1.7.10/** is registered (weakly) as it is created; a refresh re-requests the
//     image under a versioned url (media-version.js, the service worker ignores the query) and swaps it into the texture.
//   - Stylesheet rules and <img>/inline-style urls get the same version query so CSS sprites reload.
//   - Modules with their own image caches subscribe with onResourcesRefreshed(fn); fn(generation) may return a promise.
// This module must be imported before any texture is created (main.js imports it first).
import * as THREE from "three";
import { bumpMediaGeneration, versioned, unversioned } from "./media-version.js";

const MEDIA = "/media/1.7.10/";
const textures = new Set();
const hooks = new Set();

const originalLoad = THREE.TextureLoader.prototype.load;
THREE.TextureLoader.prototype.load = function (url, ...rest) {
  const texture = originalLoad.call(this, url, ...rest);
  if (typeof url === "string" && url.includes(MEDIA)) { urlOf.set(texture, unversioned(url)); textures.add({ ref: new WeakRef(texture), url: unversioned(url) }); }
  return texture;
};

// Texture.clone() shares the source image (end sky/portal layers, beacon beam, experience orbs): a clone of a registered texture is
// registered under the same url so the refresh reaches it too.
const urlOf = new WeakMap();
const originalClone = THREE.Texture.prototype.clone;
THREE.Texture.prototype.clone = function (...args) {
  const copy = originalClone.apply(this, args), url = urlOf.get(this);
  if (url) { urlOf.set(copy, url); textures.add({ ref: new WeakRef(copy), url }); }
  return copy;
};

export function onResourcesRefreshed(fn) { hooks.add(fn); return () => hooks.delete(fn); }

function loadImage(url) {
  return new Promise((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = url; });
}

export async function refreshTextures(gen) {
  const jobs = [];
  for (const entry of [...textures]) {
    const texture = entry.ref.deref();
    if (!texture) { textures.delete(entry); continue; }
    if (texture.userData?.packStrip) continue; // strips re-read themselves (scene.js strip.load) because their frame count can change
    jobs.push(loadImage(versioned(entry.url, gen)).then((img) => { texture.image = img; texture.dispose(); texture.needsUpdate = true; }, () => {}));
  }
  await Promise.all(jobs);
  return jobs.length;
}

const URL_IN_CSS = /(\/media\/1\.7\.10\/[^"')\s?]+?\.png)(\?r=\d+)?/g;
export function rewriteCssText(text, gen) { return text.replace(URL_IN_CSS, (_m, path) => versioned(path, gen)); }

function rewriteRule(rule, gen) {
  if (rule.cssRules) for (const r of rule.cssRules) rewriteRule(r, gen);
  const style = rule.style;
  if (!style) return;
  for (let i = 0; i < style.length; i++) {
    const name = style[i], value = style.getPropertyValue(name);
    if (value.includes(MEDIA)) style.setProperty(name, rewriteCssText(value, gen), style.getPropertyPriority(name));
  }
}

// Browsers keep decoded CSS images under their resolved url, so the rewritten url forces a fresh request through the service worker.
export function refreshStyles(gen, doc = document) {
  for (const sheet of doc.styleSheets) {
    let rules;
    try { rules = sheet.cssRules; } catch { continue; }
    for (const rule of rules) rewriteRule(rule, gen);
  }
  for (const img of doc.querySelectorAll(`img[src*="${MEDIA}"]`)) img.src = rewriteCssText(img.getAttribute("src"), gen);
  for (const el of doc.querySelectorAll(`[style*="${MEDIA}"]`)) el.setAttribute("style", rewriteCssText(el.getAttribute("style"), gen));
}

let overlay = null;
// Whether native refreshResources draws a loading overlay in 1.7.10 was not verified (neither read from bytecode nor probed). The game
// here keeps rendering while the textures reload and shows a small "Reloading resources..." note until it finishes.
function showNotice(text) {
  if (typeof document === "undefined") return;
  overlay = document.createElement("div");
  overlay.className = "resource-refresh-note";
  overlay.textContent = text;
  overlay.style.cssText = "position:fixed;left:50%;top:8px;transform:translateX(-50%);padding:4px 10px;background:rgba(0,0,0,.7);color:#fff;font:14px monospace;z-index:99999;pointer-events:none";
  document.body.appendChild(overlay);
}
function hideNotice() { overlay?.remove(); overlay = null; }

let running = null;
export function refreshResources({ label = "Reloading resources..." } = {}) {
  if (running) return running;
  running = (async () => {
    const gen = bumpMediaGeneration();
    showNotice(label);
    try {
      await refreshTextures(gen);
      refreshStyles(gen);
      const results = await Promise.allSettled([...hooks].map((fn) => fn(gen)));
      for (const r of results) if (r.status === "rejected") console.warn("resource refresh hook failed", r.reason);
      if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("mcweb:resources-refreshed", { detail: { generation: gen } }));
      return gen;
    } finally { hideNotice(); running = null; }
  })();
  return running;
}

export const registeredTextureCount = () => { let n = 0; for (const e of textures) if (e.ref.deref()) n++; return n; };
// Unversioned urls of the live registered textures (diagnostics and tests).
export const registeredTextureUrls = () => { const out = new Set(); for (const e of textures) if (e.ref.deref()) out.add(e.url); return [...out].sort(); };
export const registeredTextureImage = (url) => { for (const e of textures) { const t = e.ref.deref(); if (t && e.url === url) return t.image; } return null; };
