// Animated item textures from ".png.mcmeta" (the items atlas is a TextureMap, so TextureAtlasSprite.updateAnimation runs for every
// item sprite in 1.7.10; clock and compass are the special TextureClock / TextureCompass and stay on their own logic). The frame
// rule is texture-animation.js (probed against the original classes). Item icons here are plain <img>/THREE textures, so an
// animated strip is cut into square frames (data URLs) and the current frame's url is what itemTexture() hands out. The DOM icons
// are swapped on each client tick (tickItemAnimations, called from MapsClock.tick), the first-person item is rebuilt through
// the frame tag in its cache key. Dropped items, item frames and third-person held items pick the frame current when they are built.
import { resolveAnimation, fetchMcmeta } from "./texture-animation.js";
import { versioned, unversioned, mediaGeneration } from "./media-version.js";
import { onResourcesRefreshed } from "./resource-refresh.js";

const ITEM_URL = /\/media\/1\.7\.10\/items\/[^/]+\.png$/;
const SPECIAL = /\/items\/(clock|compass)\.png$/;
const entries = new Map(); // unversioned url -> { state: "loading" | "none" | "anim", anim, urls: [], gen }
const byData = new Map(); // frame data url -> entry
let readyHook = null, dirty = false;

// fn(urls) runs when an animated item's frame urls exist (first-person.js preloads their textures so a frame switch never blanks).
export function onItemFramesReady(fn) { readyHook = fn; }

function load(base, entry) {
  const gen = mediaGeneration(), img = new Image();
  img.onload = async () => {
    const text = await fetchMcmeta(base);
    if (entry.gen !== gen) return;
    const w = img.naturalWidth, h = img.naturalHeight;
    const anim = resolveAnimation(text, w, h);
    if (anim.count <= 1 && w === h) { entry.state = "none"; return; }
    entry.anim = anim;
    entry.urls = [];
    for (let i = 0; i < anim.count; i++) {
      const c = document.createElement("canvas");
      c.width = c.height = w;
      c.getContext("2d").drawImage(img, 0, i * w, w, w, 0, 0, w, w);
      const url = c.toDataURL("image/png");
      entry.urls.push(url);
      byData.set(url, entry);
    }
    entry.state = "anim";
    dirty = true;
    readyHook?.(entry.urls);
  };
  img.onerror = () => { entry.state = "none"; };
  img.src = versioned(base, gen);
}

function lookup(url) {
  if (typeof Image === "undefined" || typeof document === "undefined") return null;
  const base = unversioned(url);
  if (!ITEM_URL.test(base) || SPECIAL.test(base)) return null;
  let entry = entries.get(base);
  if (!entry) { entry = { state: "loading", anim: null, urls: [], gen: mediaGeneration() }; entries.set(base, entry); load(base, entry); }
  return entry;
}

const currentUrl = (entry) => entry.urls[entry.anim.frame] ?? entry.urls[0];

// The url to draw for an item sprite: the current frame of an animated strip, else `url` itself (also while it is still loading).
export function animatedItemUrl(url) {
  const entry = lookup(url);
  return entry?.state === "anim" ? currentUrl(entry) : url;
}
// Frame index of a url handed out by animatedItemUrl (0 for anything else): part of the held item's cache key.
export const itemFrameTag = (url) => byData.get(url)?.anim.frame ?? 0;

function swapIcons() {
  for (const img of document.querySelectorAll("img.vanilla-item-icon")) {
    const src = img.getAttribute("src");
    const entry = byData.get(src) ?? (src && entries.get(unversioned(src)));
    if (entry?.state !== "anim") continue;
    const want = currentUrl(entry);
    if (src !== want) img.setAttribute("src", want);
  }
}

// One client tick (TextureManager.tick -> every sprite's updateAnimation). Returns whether any shown frame changed.
export function tickItemAnimations() {
  let changed = dirty;
  dirty = false;
  for (const entry of entries.values()) if (entry.state === "anim" && entry.anim.step()) changed = true;
  if (changed && byData.size) swapIcons();
  return changed;
}

// Pack change: forget every cut frame; the next itemTexture() call reloads under the new generation.
export function resetItemAnimations() { entries.clear(); byData.clear(); dirty = false; }
onResourcesRefreshed(() => { resetItemAnimations(); });
