// Batch 72 spcapes: a single-player cape. Single player has no accounts, so the cape is a 64 x 32 PNG the player chooses; it is kept in
// this browser (localStorage, base64) and drawn on the local third-person body through PlayerRenderer.setCape. No Mojang cape ships.
// Validation is the server's (skin.js capePngError). In multiplayer the account's cape wins (main.js only calls applyLocalCape offline).
import * as THREE from "three";
import { capePngError, capeCanvas } from "./skin.js";

export const SP_CAPE_KEY = "blockworld.cape";

const toBase64 = (bytes) => { let s = ""; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(s); };
const fromBase64 = (text) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));

export class SpCapeStore {
  constructor(storage, key = SP_CAPE_KEY) { this.storage = storage; this.key = key; this.version = 0; this.cache = undefined; }
  // The stored PNG bytes, or null. A stored value that no longer validates is ignored.
  get() {
    if (this.cache !== undefined) return this.cache;
    let bytes = null;
    try { const text = this.storage?.getItem(this.key); if (text) { const b = fromBase64(text); if (!capePngError(b)) bytes = b; } } catch { bytes = null; }
    return (this.cache = bytes);
  }
  // Validate then store. Throws Error(message) on a bad file or when the browser refuses to store it.
  set(bytes) {
    const bad = capePngError(bytes);
    if (bad) throw new Error(bad.message);
    try { this.storage.setItem(this.key, toBase64(bytes)); } catch { throw new Error("The browser could not store the cape."); }
    this.cache = Uint8Array.from(bytes); this.version++;
  }
  clear() { try { this.storage?.removeItem(this.key); } catch {} this.cache = null; this.version++; }
  // Renderer key: null without a cape, else changes whenever the cape changes.
  get tag() { return this.get() ? `local:${this.version}` : null; }
}

// Offline only: put the stored cape on `renderer` (a PlayerRenderer). `load(bytes)` resolves a texture (browser: capeTexture) or null.
export function applyLocalCape(renderer, store, load) {
  if (!renderer) return;
  const tag = store.tag;
  if ((renderer.capeHash ?? null) === tag) return;
  renderer.capeHash = tag;
  if (!tag) { renderer.setCape(null); return; }
  void Promise.resolve(load(store.get())).then((texture) => { if (renderer.capeHash === tag && texture) renderer.setCape(texture); }, () => {});
}

// Browser only: decode stored PNG bytes into a nearest-filtered cape texture.
export async function capeTexture(bytes) {
  const texture = new THREE.CanvasTexture(await capeCanvas(new Blob([bytes], { type: "image/png" })));
  texture.magFilter = texture.minFilter = THREE.NearestFilter; texture.generateMipmaps = false;
  return texture;
}

// Browser only: file picker for the cape; resolves a status line for the menu.
export function chooseCapeFile(store) {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file"; input.accept = "image/png";
    input.oncancel = () => resolve("");
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) { resolve(""); return; }
      try { store.set(new Uint8Array(await file.arrayBuffer())); resolve("Cape saved on this device."); }
      catch (e) { resolve(String(e.message).slice(0, 60)); }
    };
    input.click();
  });
}
