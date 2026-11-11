// The item atlas (TextureMap type 1, textures/atlas/items.png): the port's item sprites are cells of one 256 x 256 canvas texture laid out by the executed 1.7.10 Stitcher
// (item-atlas-layout.js, public/research/stitcher-reference.json via tools/verify-stitcher.mjs), and every sprite samples it through the TextureAtlasSprite uv with the
// 0.01 px inset (initSprite: getMinU/getMaxU/getMinV/getMaxV, float32), the way the held 2D item, the dropped sprite and the item frame draw it natively.
//
// Each sprite is a three.js Texture that shares the atlas' Source (so the atlas uploads once) and carries `userData.st` = (scaleU, scaleV, offsetU, offsetV): the
// native sprite uv in three's texture space (v up). Materials that sample item sprites (entityMaterial, glintMesh, the projectile's worldMaterial uvTransform) apply it to
// the geometry's 0..1 uv, because ShaderMaterials ignore Texture.matrix. Sprites that are not in the layout (potion composites, spawn eggs, animated frames, skulls,
// block-atlas flowers) keep their own textures and an identity transform.
//
// The atlas is drawn from the pack's sprite images: the canvas is 256 px times the largest sprite's resolution / 16 (HD packs), each 16 px cell scaled up
// nearest-neighbour; the native Stitcher would lay an HD pack out again (not modelled). Not modelled either: item mip levels (the port samples these with GL_NEAREST, no
// mip chain) and exact Anaglyph conversion of translucent texels (the canvas is read back at upload, see anaglyph.js).
import * as THREE from "three";
import { NATIVE_ITEM_SPRITES, NATIVE_ITEM_ATLAS_WIDTH, NATIVE_ITEM_ATLAS_HEIGHT } from "./item-atlas-layout.js";
import { onResourcesRefreshed } from "./resource-refresh.js";
import { versioned, unversioned } from "./media-version.js";

const F = Math.fround, INSET = 0.009999999776482582, PREFIX = "/media/1.7.10/items/", MAX_SCALE = 16;
// The sprite name of an item texture url (a /media items png that the Stitcher laid out), or null.
export function itemSpriteName(url) {
  if (typeof url !== "string" || !url.startsWith(PREFIX)) return null;
  const rest = unversioned(url).slice(PREFIX.length);
  if (!rest.endsWith(".png")) return null;
  const name = rest.slice(0, -4);
  return Object.hasOwn(NATIVE_ITEM_SPRITES, name) ? name : null;
}
// TextureAtlasSprite.initSprite's uv of a laid-out sprite (v down, as the native getMinV/getMaxV return it), float32 like the original.
export function itemSpriteUv(name) {
  const [x, y, size] = NATIVE_ITEM_SPRITES[name], iu = F(INSET / NATIVE_ITEM_ATLAS_WIDTH), iv = F(INSET / NATIVE_ITEM_ATLAS_HEIGHT);
  return {
    minU: F(F(F(x) / F(NATIVE_ITEM_ATLAS_WIDTH)) + iu), maxU: F(F(F(x + size) / F(NATIVE_ITEM_ATLAS_WIDTH)) - iu),
    minV: F(F(F(y) / F(NATIVE_ITEM_ATLAS_HEIGHT)) + iv), maxV: F(F(F(y + size) / F(NATIVE_ITEM_ATLAS_HEIGHT)) - iv),
  };
}
// The same rectangle as a uv transform of three's flipped textures: texture uv (u, v) in 0..1 -> (u * sx + ox, v * sy + oy).
export function itemSpriteTransform(name) {
  const { minU, maxU, minV, maxV } = itemSpriteUv(name);
  return [maxU - minU, maxV - minV, minU, 1 - maxV];
}

let atlas = null;
function getAtlas() {
  if (atlas) return atlas;
  const canvas = document.createElement("canvas");
  canvas.width = NATIVE_ITEM_ATLAS_WIDTH; canvas.height = NATIVE_ITEM_ATLAS_HEIGHT;
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = texture.minFilter = THREE.NearestFilter;
  return (atlas = { canvas, texture, scale: 1, entries: new Map(), generation: 0 });
}
function drawEntry(a, e) {
  if (!e.img) return;
  const [x, y, size] = NATIVE_ITEM_SPRITES[e.name], ctx = a.canvas.getContext("2d"), s = a.scale, w = e.img.naturalWidth; // the first frame of an animation strip
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(x * s, y * s, size * s, size * s);
  ctx.drawImage(e.img, 0, 0, w, w, x * s, y * s, size * s, size * s);
}
function refreshGpu(a, resized) {
  if (resized) { a.texture.dispose(); for (const e of a.entries.values()) e.tex.dispose(); }
  a.texture.needsUpdate = true;
  for (const e of a.entries.values()) e.tex.needsUpdate = true; // sibling textures re-enter the upload path; the shared Source uploads once
}
function setImage(a, e, img) {
  e.img = img;
  const need = Math.min(MAX_SCALE, Math.max(1, Math.round(img.naturalWidth / 16)));
  if (need > a.scale) {
    a.scale = need; a.canvas.width = NATIVE_ITEM_ATLAS_WIDTH * need; a.canvas.height = NATIVE_ITEM_ATLAS_HEIGHT * need;
    for (const o of a.entries.values()) drawEntry(a, o);
    refreshGpu(a, true);
  } else { drawEntry(a, e); refreshGpu(a, false); }
}
function request(a, e, gen) {
  const img = new Image();
  img.onload = () => { if (a.generation <= gen) setImage(a, e, img); };
  img.src = versioned(PREFIX + e.name + ".png", gen);
  return new Promise((resolve) => { const done = () => resolve(); img.addEventListener("load", done); img.addEventListener("error", done); });
}
// The sprite texture of an item url that the Stitcher laid out, or null (not in the layout, or no DOM: tests).
export function itemAtlasTexture(url) {
  const name = itemSpriteName(url);
  if (!name || typeof document === "undefined") return null;
  const a = getAtlas();
  let e = a.entries.get(name);
  if (!e) {
    const tex = new THREE.Texture();
    tex.source = a.texture.source;
    tex.magFilter = tex.minFilter = THREE.NearestFilter;
    tex.userData.st = new THREE.Vector4(...itemSpriteTransform(name));
    tex.userData.itemSprite = name;
    tex.needsUpdate = true;
    e = { name, tex, img: null };
    a.entries.set(name, e);
    request(a, e, a.generation);
  }
  return e.tex;
}
// Resource pack change (also the Anaglyph toggle): every sprite image is read again and the atlas redrawn and re-uploaded.
onResourcesRefreshed(async (gen) => {
  if (!atlas) return;
  atlas.generation = gen;
  await Promise.all([...atlas.entries.values()].map((e) => request(atlas, e, gen)));
  refreshGpu(atlas, false);
});
