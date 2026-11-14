// The item atlas (TextureMap type 1, textures/atlas/items.png) and the block atlas cells that items draw from (TextureMap type 0, ItemBlock icons with getSpriteNumber() 0:
// flowers, torch, web, bars, saplings, levers ...): the port's flat item sprites are cells of a 256 x 256 (items) or 512 x 256 (blocks) canvas texture laid out by the
// executed 1.7.10 Stitcher (item-atlas-layout.js / atlas-layout.js, public/research/stitcher-reference.json via tools/verify-stitcher.mjs), and every sprite samples it
// through the TextureAtlasSprite uv with the 0.01 px inset (initSprite: getMinU/getMaxU/getMinV/getMaxV, float32), the way the held 2D item, the dropped sprite and the item
// frame draw it natively. Natively an item whose sprite number is 0 binds the block atlas; here a /media/1.7.10/blocks/<name>.png url takes a cell of the blocks sheet
// (tinted inventory tiles such as grass or leaves keep their own data urls: natively the tint is a vertex colour, here it is baked).
//
// Each sprite is a three.js Texture that shares the sheet's Source (so the sheet uploads once) and carries `userData.st` = (scaleU, scaleV, offsetU, offsetV): the native sprite
// uv in three's texture space (v up). Materials that sample sprites (entityMaterial, glintMesh, the projectile's worldMaterial uvTransform) apply it to the geometry's 0..1
// uv, because ShaderMaterials ignore Texture.matrix; they hold this very vector, so a re-stitch moves every user. Sprites that are not in a layout (potion composites, baked tints,
// skulls) keep their own textures and an identity transform.
//
// Resource packs with higher resolution: a sheet starts on the native layout (all sprites at the vanilla sizes). When a sprite image turns out to have another size, the sheet
// is stitched again with the sizes seen so far (unseen sprites keep their vanilla size) by the ported Stitcher (stitcher.js: largest first, power-of-two growth) and every sprite
// is drawn at its own size, 1:1, not scaled to a 16 px cell. Not modelled: item mip levels (none natively), pack .mcmeta animation of item sprites other than the clock and
// compass strips, and exact Anaglyph conversion of translucent texels (the canvas is read back at upload, see anaglyph.js).
import * as THREE from "three";
import { NATIVE_ITEM_SPRITES, NATIVE_ITEM_ATLAS_WIDTH, NATIVE_ITEM_ATLAS_HEIGHT } from "./item-atlas-layout.js";
import { NATIVE_BLOCK_SPRITES, NATIVE_ATLAS_WIDTH, NATIVE_ATLAS_HEIGHT } from "./atlas-layout.js";
import { stitch } from "./stitcher.js";
import { onResourcesRefreshed } from "./resource-refresh.js";
import { versioned, unversioned } from "./media-version.js";

const F = Math.fround, INSET = 0.009999999776482582;
const KINDS = {
  items: { prefix: "/media/1.7.10/items/", native: NATIVE_ITEM_SPRITES, width: NATIVE_ITEM_ATLAS_WIDTH, height: NATIVE_ITEM_ATLAS_HEIGHT },
  blocks: { prefix: "/media/1.7.10/blocks/", native: NATIVE_BLOCK_SPRITES, width: NATIVE_ATLAS_WIDTH, height: NATIVE_ATLAS_HEIGHT },
};
// The layout of a sheet: Map name -> [x, y, w, h] and the atlas size. `known` maps sprite name -> [w, h] of the sprites whose pack image was seen; every other sprite keeps its
// vanilla size. With no size differing from vanilla this is the executed layout itself (the ported Stitcher gives the same result, stitcher-b64.test.js), otherwise it is stitched again.
export function sheetLayout(kind, known = new Map()) {
  const k = KINDS[kind], cells = new Map();
  let same = true;
  for (const [name, [w, h]] of known) { const n = k.native[name]; if (!n || n[2] !== w || n[2] !== h) same = false; }
  if (same) {
    for (const [name, [x, y, size]] of Object.entries(k.native)) cells.set(name, [x, y, size, size]);
    return { width: k.width, height: k.height, cells, hd: false };
  }
  const out = stitch(Object.entries(k.native).map(([name, [, , size]]) => { const [w, h] = known.get(name) ?? [size, size]; return { name, width: w, height: h }; }));
  for (const s of out.sprites) cells.set(s.name, [s.x, s.y, s.w, s.h]);
  return { width: out.width, height: out.height, cells, hd: true };
}
// TextureAtlasSprite.initSprite's uv of a cell (v down, as the native getMinV/getMaxV return it), float32 like the original. `cell` = [x, y, w, h], `atlas` = { width, height }.
export function spriteUvOf(cell, atlas) {
  const [x, y, w, h] = cell, iu = F(INSET / atlas.width), iv = F(INSET / atlas.height);
  return {
    minU: F(F(F(x) / F(atlas.width)) + iu), maxU: F(F(F(x + w) / F(atlas.width)) - iu),
    minV: F(F(F(y) / F(atlas.height)) + iv), maxV: F(F(F(y + h) / F(atlas.height)) - iv),
  };
}
// uv transform of three's flipped textures for a uv rectangle: texture uv (u, v) in 0..1 -> (u * sx + ox, v * sy + oy).
const transformOf = ({ minU, maxU, minV, maxV }) => [maxU - minU, maxV - minV, minU, 1 - maxV];

function spriteName(kind, url) {
  const prefix = KINDS[kind].prefix;
  if (typeof url !== "string" || !url.startsWith(prefix)) return null;
  const rest = unversioned(url).slice(prefix.length);
  if (!rest.endsWith(".png")) return null;
  const name = rest.slice(0, -4);
  return Object.hasOwn(KINDS[kind].native, name) ? name : null;
}
// The sprite name of an item texture url (a /media items png that the Stitcher laid out), or null.
export const itemSpriteName = (url) => spriteName("items", url);
// The sprite name of a block texture url that is a cell of the block atlas, or null.
export const blockSpriteName = (url) => spriteName("blocks", url);
// The uv of a sprite in the sheet as it is laid out now (the vanilla layout until a pack with other sprite sizes is seen).
export function itemSpriteUv(name) { return sheetUv("items", name); }
export function blockSpriteUv(name) { return sheetUv("blocks", name); }
function sheetUv(kind, name) { const a = sheets[kind], l = a ? a.layout : sheetLayout(kind); return spriteUvOf(l.cells.get(name), l); }
// The same rectangle as a uv transform of three's flipped textures.
export function itemSpriteTransform(name) { return transformOf(itemSpriteUv(name)); }
export function blockSpriteTransform(name) { return transformOf(blockSpriteUv(name)); }

const sheets = { items: null, blocks: null };
function getSheet(kind) {
  if (sheets[kind]) return sheets[kind];
  const layout = sheetLayout(kind), canvas = document.createElement("canvas");
  canvas.width = layout.width; canvas.height = layout.height;
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = texture.minFilter = THREE.NearestFilter;
  return (sheets[kind] = { kind, canvas, texture, layout, known: new Map(), entries: new Map(), generation: 0 });
}
function drawEntry(a, e) {
  if (!e.img) return;
  const cell = a.layout.cells.get(e.name), ctx = a.canvas.getContext("2d"), w = e.img.naturalWidth, h = Math.min(e.img.naturalHeight, w);
  const f = Math.min(e.frame, Math.max(0, Math.floor(e.img.naturalHeight / w) - 1)); // frame `e.frame` of an animation strip (0 unless TextureClock / TextureCompass set it)
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(cell[0], cell[1], cell[2], cell[3]);
  ctx.drawImage(e.img, 0, f * w, w, h, cell[0], cell[1], cell[2], cell[3]);
}
function refreshGpu(a, resized) {
  if (resized) { a.texture.dispose(); for (const e of a.entries.values()) e.tex.dispose(); }
  a.texture.needsUpdate = true;
  for (const e of a.entries.values()) e.tex.needsUpdate = true; // sibling textures re-enter the upload path; the shared Source uploads once
}
function applyUv(a, e) { e.tex.userData.st.set(...transformOf(spriteUvOf(a.layout.cells.get(e.name), a.layout))); }
// Stitch again with the sprite sizes seen so far, resize the canvas and redraw every requested sprite; the sprites' uv vectors are updated in place.
function relayout(a) {
  let layout;
  try { layout = sheetLayout(a.kind, a.known); } catch (err) { console.warn(a.kind + " atlas: " + err.message); return false; }
  a.layout = layout;
  a.canvas.width = layout.width; a.canvas.height = layout.height;
  for (const e of a.entries.values()) { applyUv(a, e); drawEntry(a, e); }
  refreshGpu(a, true);
  return true;
}
function setImage(a, e, img) {
  e.img = img;
  const w = img.naturalWidth, h = Math.min(img.naturalHeight, w), cell = a.layout.cells.get(e.name), native = KINDS[a.kind].native[e.name];
  if (!w) return;
  if (w === native[2] && h === native[2]) a.known.delete(e.name); else a.known.set(e.name, [w, h]);
  if (cell[2] !== w || cell[3] !== h) { if (relayout(a)) return; }
  drawEntry(a, e); refreshGpu(a, false);
}
function request(a, e, gen) {
  const img = new Image();
  img.onload = () => { if (a.generation <= gen) setImage(a, e, img); };
  img.src = versioned(KINDS[a.kind].prefix + e.name + ".png", gen);
  return new Promise((resolve) => { const done = () => resolve(); img.addEventListener("load", done); img.addEventListener("error", done); });
}
function sheetTexture(kind, name) {
  if (typeof globalThis.document?.createElement !== "function") return null; // tests may stub a partial document
  const a = getSheet(kind);
  let e = a.entries.get(name);
  if (!e) {
    const tex = new THREE.Texture();
    tex.source = a.texture.source;
    tex.magFilter = tex.minFilter = THREE.NearestFilter;
    tex.userData.st = new THREE.Vector4(...transformOf(spriteUvOf(a.layout.cells.get(name), a.layout)));
    tex.userData.itemSprite = name;
    tex.needsUpdate = true;
    e = { name, tex, img: null, frame: kind === "items" ? pendingFrames.get(name) ?? 0 : 0 };
    a.entries.set(name, e);
    request(a, e, a.generation);
  }
  return e.tex;
}
// The sprite texture of an item url that the Stitcher laid out (the item atlas, or a block atlas cell for a /media blocks png), or null (not laid out, or no DOM: tests).
export function itemAtlasTexture(url) {
  const item = itemSpriteName(url);
  if (item) return sheetTexture("items", item);
  const block = blockSpriteName(url);
  return block ? sheetTexture("blocks", block) : null;
}
// TextureClock / TextureCompass: the sprite's cell shows strip frame `frame` (the native sprite uploads the current frame's pixels into its atlas cell every tick, so every
// view of the item shows the same frame). No effect without a DOM or before the sprite is requested; a later request starts at the frame set here.
export function setItemAtlasFrame(name, frame) {
  const a = sheets.items, e = a?.entries.get(name);
  if (!e) { pendingFrames.set(name, frame); return; }
  if (e.frame === frame) return;
  e.frame = frame;
  if (e.img) { drawEntry(a, e); refreshGpu(a, false); }
}
const pendingFrames = new Map();
// Resource pack change (also the Anaglyph toggle): every sprite image is read again and the sheets redrawn (and stitched again when the sprite sizes changed) and re-uploaded.
onResourcesRefreshed(async (gen) => {
  await Promise.all(Object.values(sheets).filter(Boolean).map(async (a) => {
    a.generation = gen;
    await Promise.all([...a.entries.values()].map((e) => request(a, e, gen)));
    refreshGpu(a, false);
  }));
});
