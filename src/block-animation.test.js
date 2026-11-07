// Block atlas animation from ".png.mcmeta" (createBlockAtlas.animate): a DOM-free replay with stubbed canvas, Image and fetch.
// The frame rule itself is texture-animation.js, replayed against the original classes in texture-animation.test.js.
import { test } from "node:test";
import assert from "node:assert/strict";

const draws = []; // { tile: [x, y], srcY }
const strips = { stone: [16, 64] }; // name -> [w, h]
const mcmeta = { "/media/1.7.10/blocks/stone.png.mcmeta": JSON.stringify({ animation: { frametime: 2, frames: [2, 0, { index: 3, time: 1 }] } }) };
function ctx2d() {
  return { imageSmoothingEnabled: false, clearRect() {}, fillRect() {}, putImageData() {}, getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
    save() {}, restore() {}, setTransform() {}, fill() {}, globalCompositeOperation: "", fillStyle: "",
    drawImage(src, sx, sy, sw, sh, dx, dy, dw, dh) { if (dw === 16 && dh === 16 && src.__name === "blocks/stone") draws.push({ tile: [dx, dy], srcY: sy }); } };
}
class Img { set src(u) { const m = u.match(/\/media\/1\.7\.10\/(.+)\.png/); const name = m[1]; this.__name = name; const s = strips[name.replace("blocks/", "")]; this.width = this.naturalWidth = name.startsWith("colormap") ? 256 : name.startsWith("entity") ? 64 : s ? s[0] : 16; this.height = this.naturalHeight = name.startsWith("colormap") ? 256 : name.startsWith("entity") ? 64 : s ? s[1] : 16; queueMicrotask(() => this.onload?.()); } }
globalThis.Image = Img;
globalThis.HTMLCanvasElement = class {};
globalThis.document = { createElement: () => Object.assign(new globalThis.HTMLCanvasElement(), { width: 0, height: 0, getContext: ctx2d }) };
globalThis.fetch = async (url) => (mcmeta[url] ? { ok: true, text: async () => mcmeta[url] } : { ok: false });

test("a block tile with a pack mcmeta animates in the atlas, redrawing only changed frames", async () => {
  const { createBlockAtlas, tileByName } = await import("./block-textures.js");
  const atlas = createBlockAtlas();
  await atlas.ready;
  const stone = tileByName("stone"), at = [stone % 16 * 16, Math.floor(stone / 16) * 16];
  const last = () => draws.filter((d) => d.tile[0] === at[0] && d.tile[1] === at[1]).at(-1).srcY / 16;
  assert.equal(last(), 2, "list starts at frame index 2");
  draws.length = 0;
  // frametime 2: ticks 0-1 frame 2, 2-3 frame 0, 4 frame 3 (time 1), then the cycle (5 ticks) repeats
  atlas.animate(4); assert.equal(last(), 3);
  atlas.animate(2); assert.equal(last(), 0);
  atlas.animate(5); assert.equal(last(), 2);
  const before = draws.length;
  assert.equal(atlas.animate(5), false, "no frame change: no redraw");
  assert.equal(draws.length, before);
  // only the changed tile is redrawn, not the whole atlas
  draws.length = 0; atlas.animate(7);
  assert.ok(draws.length <= 2 && draws.every((d) => d.tile[0] === at[0] && d.tile[1] === at[1]));
});
