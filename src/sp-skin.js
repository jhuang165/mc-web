// Batch 73 skins73: a single-player skin. 1.7.10 has no skin screen (the skin comes from the account's profile textures, and an offline player is
// Steve), so this is a port addition like sp-cape.js: a PNG the player chooses, kept in this browser (localStorage, base64). The browser cleans the
// file up like ImageBufferDownload.parseUserSkin (skin.js skinCanvas / userSkinPixels) before it is stored, so the store only ever holds a 64 x 32 PNG.
// It is drawn on the local body, the first-person arm and SkullOwner heads of the player's own name; in multiplayer the account's skin wins.
import * as THREE from "three";
import { skinPngError, skinCanvas, canvasPng } from "./skin.js";

export const SP_SKIN_KEY = "blockworld.skin";

const toBase64 = (bytes) => { let s = ""; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(s); };
const fromBase64 = (text) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));

export class SpSkinStore {
  constructor(storage, key = SP_SKIN_KEY) { this.storage = storage; this.key = key; this.version = 0; this.cache = undefined; }
  get() {
    if (this.cache !== undefined) return this.cache;
    let bytes = null;
    try { const text = this.storage?.getItem(this.key); if (text) { const b = fromBase64(text); if (!skinPngError(b)) bytes = b; } } catch { bytes = null; }
    return (this.cache = bytes);
  }
  // Validate then store. Throws Error(message) on a bad file or when the browser refuses to store it.
  set(bytes) {
    const bad = skinPngError(bytes);
    if (bad) throw new Error(bad.message);
    try { this.storage.setItem(this.key, toBase64(bytes)); } catch { throw new Error("The browser could not store the skin."); }
    this.cache = Uint8Array.from(bytes); this.version++;
  }
  clear() { try { this.storage?.removeItem(this.key); } catch {} this.cache = null; this.version++; }
  // Renderer key: null without a skin, else changes whenever the skin changes.
  get tag() { return this.get() ? `local:${this.version}` : null; }
}

// Offline only: put the stored skin on `renderer` (a PlayerRenderer). `load(bytes)` resolves a texture (browser: skinTexture) or null.
// No skin means Steve (1.7.10 has no other default model). hasSkin gates the deadmau5 ears and SkullOwner lookups, as in presence.js applySkin.
export function applyLocalSkin(renderer, store, load) {
  if (!renderer) return;
  const tag = store.tag;
  if ((renderer.skinHash ?? null) === tag) return;
  renderer.skinHash = tag;
  const uniform = renderer.base.uniforms.map;
  renderer.steveMap ??= uniform.value;
  renderer.hasSkin = false;
  if (!tag) { uniform.value = renderer.steveMap; return; }
  void Promise.resolve(load(store.get())).then((texture) => { if (renderer.skinHash === tag && texture) { uniform.value = texture; renderer.hasSkin = true; } }, () => {});
}

// Browser only: decode stored PNG bytes into a nearest-filtered skin texture (skinCanvas repeats the cleanup, which is idempotent).
export async function skinTexture(bytes) {
  const texture = new THREE.CanvasTexture(await skinCanvas(new Blob([bytes], { type: "image/png" })));
  texture.magFilter = texture.minFilter = THREE.NearestFilter; texture.generateMipmaps = false;
  return texture;
}

// Browser only: file picker for the skin (64 x 32 or modern 64 x 64 PNG); resolves a status line for the menu.
export function chooseSkinFile(store) {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file"; input.accept = "image/png";
    input.oncancel = () => resolve("");
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) { resolve(""); return; }
      try { store.set(new Uint8Array(await (await canvasPng(await skinCanvas(file))).arrayBuffer())); resolve("Skin saved on this device."); }
      catch (e) { resolve(String(e.message).slice(0, 60)); }
    };
    input.click();
  });
}
