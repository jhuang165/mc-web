// In-place resource refresh (the Minecraft.refreshResources analogue): after the resource pack selection changes the game
// re-reads every pack-dependent resource without reloading the page, so the world keeps running.
//   - Every THREE.TextureLoader texture of /media/1.7.10/** is registered (weakly) as it is created; a refresh re-requests the
//     image under a versioned url (media-version.js, the service worker ignores the query) and swaps it into the texture.
//   - Stylesheet rules and <img>/inline-style urls get the same version query so CSS sprites reload (and, with 3D Anaglyph on, their converted copies).
//   - Modules with their own image caches subscribe with onResourcesRefreshed(fn); fn(generation) may return a promise.
// This module must be imported before any texture is created (main.js imports it first).
import * as THREE from "three";
import { bumpMediaGeneration, versioned, unversioned } from "./media-version.js";
import { rewriteGuiText, refreshGuiNodes, prepareGuiImages, commitGuiAnaglyph, wantsGuiAnaglyph, convertExact, refreshIcons } from "./gui-anaglyph.js"; // the same rewrite swaps in converted copies while 3D Anaglyph is on

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
  // 3D Anaglyph: the exact converted pixels of every registered texture are ready before its image is swapped in, so the GL upload hook
  // uses them (straight alpha) instead of a canvas read.
  if (wantsGuiAnaglyph()) await Promise.all([...new Set([...textures].map((e) => e.ref.deref() && !e.ref.deref().userData?.packStrip ? e.url : null).filter(Boolean))].map((u) => convertExact(u)));
  for (const entry of [...textures]) {
    const texture = entry.ref.deref();
    if (!texture) { textures.delete(entry); continue; }
    if (texture.userData?.packStrip) continue; // strips re-read themselves (scene.js strip.load) because their frame count can change
    jobs.push(loadImage(versioned(entry.url, gen)).then((img) => { texture.image = img; texture.dispose(); texture.needsUpdate = true; }, () => {}));
  }
  await Promise.all(jobs);
  return jobs.length;
}

// Stylesheet rules, <img> and inline-style urls get the generation query (and, while 3D Anaglyph is on, their converted copy: gui-anaglyph.js).
export const rewriteCssText = rewriteGuiText;

// Browsers keep decoded CSS images under their resolved url, so the rewritten url forces a fresh request through the service worker.
export function refreshStyles(gen, doc = document) { refreshGuiNodes(gen, doc); }

let overlay = null;
// Native Minecraft.refreshResources (bao.c, bytecode-read, batch 18) draws nothing: it rebuilds the pack list, runs
// SimpleReloadableResourceManager.reloadResources (brg.a, logs "Reloading ResourceManager: ...") and the reload listeners
// synchronously, reloads the language and RenderGlobal.loadRenderers, with no Display.update or splash call (the Mojang logo
// splash is drawn only while the game starts). GuiScreenResourcePacks then shows its parent screen. So no overlay or note is shown
// by default; the browser reload is asynchronous, so the frame keeps rendering instead of freezing. `label` is an opt-in note.
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
export function refreshResources({ label = null } = {}) {
  if (running) { return running.then(() => refreshResources({ label })); } // a toggle during a refresh gets its own pass
  running = (async () => {
    const gen = bumpMediaGeneration();
    if (label) showNotice(label);
    try {
      // 3D Anaglyph: every GUI png and texture is converted first; the GUI keeps its old state until commitGuiAnaglyph flips it, so the
      // synchronous rewrite below finds everything ready (native refreshResources converts before the next frame).
      await prepareGuiImages(gen);
      await refreshTextures(gen);
      await prepareGuiImages(gen); // images or sheets the texture reload added
      commitGuiAnaglyph();
      refreshStyles(gen);
      const results = await Promise.allSettled([...hooks].map((fn) => fn(gen)));
      for (const r of results) if (r.status === "rejected") console.warn("resource refresh hook failed", r.reason);
      refreshIcons(); // after the atlas hook: tagged item icons are rebuilt from the current (converted or raw) atlas
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
