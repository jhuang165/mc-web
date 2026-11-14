// Batch 65: createBlockAtlas with an HD pack (DOM stubbed like block-animation.test.js): the atlas is stitched at the pack's sizes, resized, announced to the scene,
// and the animation strip of an HD tile keeps its own size (frame width) with its mip chain.
import { test } from "node:test";
import assert from "node:assert/strict";

const strips = { stone: [64, 256], dirt: [64, 64], portal: [64, 512] }; // name -> [w, h]
const mcmeta = { "/media/1.7.10/blocks/stone.png.mcmeta": JSON.stringify({ animation: { frametime: 2 } }) };
const ctx2d = () => ({ imageSmoothingEnabled: false, clearRect() {}, fillRect() {}, putImageData() {}, getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }), save() {}, restore() {}, setTransform() {}, fill() {}, drawImage() {}, globalCompositeOperation: "", fillStyle: "" });
class Img { set src(u) { const name = u.match(/\/media\/1\.7\.10\/(.+)\.png/)[1]; this.__name = name; const s = strips[name.replace("blocks/", "")];
  this.width = this.naturalWidth = name.startsWith("colormap") ? 256 : name.startsWith("entity") ? 64 : s ? s[0] : 16; this.height = this.naturalHeight = name.startsWith("colormap") ? 256 : name.startsWith("entity") ? 64 : s ? s[1] : 16; queueMicrotask(() => this.onload?.()); } }
globalThis.Image = Img;
globalThis.HTMLCanvasElement = class {};
globalThis.document = { createElement: () => Object.assign(new globalThis.HTMLCanvasElement(), { width: 0, height: 0, getContext: ctx2d }) };
globalThis.fetch = async (url) => (mcmeta[url] ? { ok: true, text: async () => mcmeta[url] } : { ok: false });

test("an HD pack re-stitches the atlas, resizes the textures, notifies, and mips follow the sprite sizes", async () => {
  const bt = await import("./block-textures.js");
  const atlas = bt.createBlockAtlas(), calls = [];
  atlas.onRelayout = (s) => calls.push(s);
  atlas.setFiltering(3, 1, 1);
  await atlas.ready;
  assert.ok(calls.length >= 1 && calls.at(-1).sizes.stone === 64 && calls.at(-1).sizes.dirt === 64 && calls.at(-1).sizes.portal === 64);
  const stone = bt.tileByName("stone"), dirt = bt.tileByName("dirt"), sand = bt.tileByName("sand");
  assert.equal(bt.tileSize(stone), 64); assert.equal(bt.tileSize(sand), 16);
  assert.equal(atlas.texture.image.width, bt.ATLAS_WIDTH); assert.equal(atlas.texture.image.height, bt.ATLAS_HEIGHT);
  assert.equal(atlas.terrain.image.data.length, bt.ATLAS_WIDTH * bt.ATLAS_HEIGHT * 4);
  assert.equal(atlas.canvas.width, bt.ATLAS_WIDTH);
  assert.equal(atlas.terrain.mipmaps.length, 4, "three levels below level 0 (16 px sprites limit the chain to 4)");
  assert.deepEqual([atlas.terrain.mipmaps[3].width, atlas.terrain.mipmaps[3].height], [bt.ATLAS_WIDTH >> 3, bt.ATLAS_HEIGHT >> 3]);
  const [x, y] = bt.tileOrigin(dirt); assert.ok(x % 16 === 0 && y % 16 === 0);
  // animation at the pack's size: the stone strip has 4 frames of 64 px; the tick-2 frame redraws the tile and re-uploads
  assert.equal(atlas.animate(2), true);
  // back to a vanilla pack: executed layout again
  strips.stone = strips.dirt = strips.portal = undefined;
  await atlas.reload();
  assert.deepEqual([bt.ATLAS_WIDTH, bt.ATLAS_HEIGHT], [512, 256]);
  assert.equal(atlas.texture.image.width, 512);
  assert.equal(bt.tileSize(stone), 16);
});
