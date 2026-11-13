// Batch 57 (b57dp): display and held-item lighting against native formulas, and the item/sprite choice of every block id.
// public/research/display-pixel-reference.json: executed (tools/probes/DisplayPixelProbe.java, tools/verify-display-pixel.mjs): Item.getItemFromBlock, render types, renderItemIn3d
// and RenderHelper.enableStandardItemLighting's GL calls. public/research/display-pixel-render.json: the PORT's shader read back from headless Chrome
// (tools/verify-display-pixel-render.mjs), compared here with the fixed-function formula C * (0.4 + 0.6 * sum N.L) clamped, times the texel and the lightmap texel.
import test from "node:test";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import * as THREE from "three";
import { fromOriginal } from "./block-registry.js";
import { itemTexture } from "./first-person.js";
import { itemBlockId } from "./item-boxes.js";
import { flatBlockItem, HOPPER_ITEM_URL } from "./flat-block-items.js";
import { ITEMS } from "./survival.js";
import { ITEM_LIGHTS } from "./light-material.js";
import { lightmap } from "./lighting.js";
import { renderCases } from "./display-pixel-cases.js";

const read = async (n) => JSON.parse(await readFile(new URL("../public/research/" + n, import.meta.url), "utf8"));
const ref = await read("display-pixel-reference.json"), render = (await read("display-pixel-render.json")).results;
const blocks = ref.records.filter((r) => r.kind === "itemBlock"), lighting = ref.records.find((r) => r.kind === "standardLighting").calls;

test("the probe covers every registered block with an item, and only the hopper and the skull name an item sprite", () => {
  assert.equal(blocks.length, 170);
  assert.deepEqual(blocks.filter((r) => r.itemIconName).map((r) => [r.id, r.itemIconName]), [[144, "skull_skeleton"], [154, "hopper"]]);
});

// port item id of an original block id and metadata, or 0: block ids below 100 are their own items, a block at or above 100 is the item 1000 + id (ids 100..255 are tools and food)
function portItem(original, meta) {
  const cell = fromOriginal(original, meta);
  if (!cell) return 0;
  const item = cell.id < 100 ? cell.id : 1000 + cell.id;
  return itemBlockId(item) === cell.id && ITEMS[item] ? item : 0;
}

test("every block item the port has: a sprite exactly where renderItemIn3d refuses the render type", () => {
  const bad = [];
  let checked = 0;
  for (const r of blocks) {
    if (r.item === -1 || [3, 4, 6, 28].includes(r.renderType)) continue; // fluids, fire, crops and cocoa: their ItemBlock ids exist natively but nothing hands them out (seeds and dye are other items)
    for (const meta of [0, 1, 2, 5]) {
      const item = portItem(r.id, meta);
      if (!item) continue;
      checked++;
      const sprite = !!itemTexture(item, fromOriginal(r.id, meta).meta);
      if (sprite === r.in3d) bad.push(r.id + ":" + meta + " type " + r.renderType + " item " + item + (sprite ? " sprite" : " cube"));
    }
  }
  assert.ok(checked > 120, "checked " + checked);
  assert.deepEqual(bad, []);
});

test("the flat block items (ladder, rails, lily pad, vine, mushrooms, shrubs, double plants, stained pane) draw as sprites; the hopper takes the item atlas sprite", () => {
  for (const original of [65, 66, 27, 28, 157, 111, 106, 39, 40, 31, 32, 175, 160]) {
    const item = portItem(original, original === 31 ? 1 : 0);
    assert.ok(item, "port item of " + original);
    assert.ok(flatBlockItem(item), "flat " + original);
    assert.ok(itemTexture(item, 0), "sprite " + original);
  }
  assert.equal(itemTexture(1133, 0), HOPPER_ITEM_URL);
  for (const solid of [1, 2, 5, 17, 18, 24, 44, 54, 58, 98]) assert.equal(flatBlockItem(solid), 0, "block " + solid + " stays a box model");
  assert.equal(flatBlockItem(100), 0, "100 is the wooden pickaxe, not the glass pane block");
});

test("RenderHelper.enableStandardItemLighting (executed): two lights of diffuse 0.6, no light ambient, model ambient 0.4, colour material ambient and diffuse", () => {
  const num = (s) => s.split(" ").slice(1).map(Number);
  const light = (n, p) => lighting.find((c) => c.startsWith(`light ${n} ${p} `));
  assert.ok(lighting.includes("colormaterial 1032 5634"));
  assert.ok(lighting.includes("lightmodel 2899 0.4 0.4 0.4 1.0"));
  for (const n of [16384, 16385]) {
    assert.deepEqual(num(light(n, 4609)).slice(2), [0.6, 0.6, 0.6, 1]);
    assert.deepEqual(num(light(n, 4608)).slice(2), [0, 0, 0, 1]);
  }
  [[16384, ITEM_LIGHTS[0]], [16385, ITEM_LIGHTS[1]]].forEach(([n, l]) => {
    const p = num(light(n, 4611)).slice(2);
    assert.equal(p[3], 0);
    [0, 1, 2].forEach((k) => assert.ok(Math.abs(p[k] - l.getComponent(k)) < 1e-6, `light ${n} component ${k}`));
  });
});

const lm = new Map();
const lightmapRgb = (c) => {
  const key = c.lightmap.join();
  if (!lm.has(key)) lm.set(key, lightmap(...c.lightmap, new Uint8Array(1024)));
  const i = (c.sky * 16 + c.block) * 4, d = lm.get(key);
  return [d[i], d[i + 1], d[i + 2]];
};
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const L = ITEM_LIGHTS.map((l) => [l.x, l.y, l.z]);
const litSum = (n, lights = L) => 0.4 + 0.6 * lights.reduce((s, l) => s + Math.max(0, dot(n, l)), 0);
const expectedPixel = (c, lit) => {
  const glColor = (c.tint ?? [1, 1, 1]).map((t) => t * (c.brightness ?? 1)), lmr = lightmapRgb(c);
  return [0, 1, 2].map((k) => c.texel[k] * Math.min(1, glColor[k] * lit) * (lmr[k] / 255));
};

test("the recorded renders are the cases the shared list describes", () => {
  const cases = renderCases();
  assert.equal(render.length, cases.length);
  render.forEach((r, i) => assert.deepEqual([r.kind, r.fname, r.packed], [cases[i].kind, cases[i].fname, cases[i].packed]));
});

test("pixel render of drops, item frames, minecart display blocks and tinted blocks: texel x clamped glColor x lighting x lightmap texel within one level", () => {
  const worst = {};
  for (const c of render.filter((r) => r.kind !== "held")) {
    const e = expectedPixel(c, litSum(c.normal));
    const d = Math.max(...e.map((v, k) => Math.abs(v - c.pixel[k])));
    worst[c.kind] = Math.max(worst[c.kind] ?? 0, d);
    assert.ok(d <= 1, `${c.kind} ${c.lname} sky ${c.sky} block ${c.block} ${c.fname}: ${c.pixel} vs ${e.map((v) => v.toFixed(2))}`);
  }
  assert.equal(Object.keys(worst).length, 4);
});

test("a tinted face lit above 1 keeps min(1, C * lit): the cart's top at brightness 0.37 reads 0.507, not 0.37 (executed GL order, the pre-b57 shader read 27 levels low)", () => {
  const top = render.find((r) => r.kind === "cart" && r.fname === "up" && r.sky === 15 && r.lname === "day");
  const lmr = lightmapRgb(top), full = top.texel.map((t, k) => t * lmr[k] / 255);
  top.pixel.forEach((p, k) => assert.ok(Math.abs(p - full[k] * Math.min(1, 0.37 * litSum(top.normal))) <= 1));
  assert.ok(Math.abs(Math.min(1, 0.37 * litSum(top.normal)) - 0.507) < 0.001);
  const old = top.texel.map((t, k) => t * 0.37 * Math.min(1, litSum(top.normal)) * lmr[k] / 255);
  assert.ok(Math.max(...old.map((v, k) => Math.abs(v - top.pixel[k]))) > 15, "the old order is far from the recorded pixels");
});

test("held items: the lights turned by the player's pitch and yaw (bytecode-read ItemRenderer) equal the port's world-fixed lights for every view and face", () => {
  const held = render.filter((r) => r.kind === "held");
  assert.equal(held.length, 24);
  for (const c of held) {
    // GL transforms glLight's position by the model-view at the call: rotate(pitch, x) then rotate(yaw, y) of the player, no camera. The port's camera has pitch = -mcPitch
    // and yaw = -(mcYaw + 180 degrees) (its view matrix equals orientCamera's rotate(pitch), rotate(yaw + 180)).
    const mcPitch = -c.view.pitch, mcYaw = -c.view.yaw - Math.PI;
    const M = new THREE.Matrix4().makeRotationX(mcPitch).multiply(new THREE.Matrix4().makeRotationY(mcYaw));
    const native = L.map((l) => new THREE.Vector3(...l).applyMatrix4(M)).map((v) => [v.x, v.y, v.z]);
    const e = expectedPixel(c, litSum(c.normal, native));
    const d = Math.max(...e.map((v, k) => Math.abs(v - c.pixel[k])));
    assert.ok(d <= 1, `view ${c.view.pitch},${c.view.yaw} ${c.fname}: ${c.pixel} vs ${e.map((v) => v.toFixed(2))}`);
  }
});
