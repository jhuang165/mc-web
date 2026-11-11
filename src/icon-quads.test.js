// Inventory icons of boxes and the chest model, against the executed records: the port's quads (item box tables + itemBoxUv, ModelBox formula + CHEST_ITEM_PARTS) are
// rasterised and compared pixel for pixel with the recorded Tessellator vertices under the recorded GL matrix calls (item-render-reference.json, chest-item-reference.json).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { boxQuads, chestIconQuads, eventsMatrix, rasterQuads, FACE_SHADE } from "./icon-quads.js";
import { guiBase, boxModelView, cubeFaces, gl, transformPoint } from "./icon-cube.js";
import { rasterIcon } from "./atlas-texels.js";
import { ITEM_BOXES, GATE_ITEM_BOXES, BEACON_ITEM_BOXES, anvilUv } from "./render-shapes.js";
import { anvilModelBoxes } from "./anvil-block.js";
import { STAIR_ITEM_BOXES } from "./stairs.js";
import { FENCE_ITEM_BOXES } from "./fences.js";
import { CHEST_ITEM_PREFIX, CHEST_ITEM_PARTS, modelBoxQuads } from "./chest-item-model.js";

const read = (n) => JSON.parse(readFileSync(new URL(`../public/research/${n}`, import.meta.url), "utf8"));
const raw = read("item-render-reference.json"), chest = read("chest-item-reference.json");
// The chest family (render type 22) is the chest model, matched against chest-item-reference.json below, not a RenderBlocks box item.
const ref = { ...raw, items: raw.items.filter((e) => e.type !== 22) };
const bf = new Float32Array(1), bi = new Int32Array(bf.buffer), fl = (b) => { bi[0] = b; return bf[0]; };
// Each texel carries its own (x, y) so a raster says which texel every pixel shows.
const tile = (() => { const d = new Uint8Array(16 * 16 * 4); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) d.set([x * 16 + 1, y * 16 + 1, 7, 255], (y * 16 + x) * 4); return { data: d, w: 16, h: 16 }; })();
const sheet = (() => { const d = new Uint8Array(64 * 64 * 4); for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) d.set([x * 4 + 1, y * 4 + 1, 9, 255], (y * 64 + x) * 4); return { data: d, w: 64, h: 64 }; })();
const normalAxis = (p) => { const a = [0, 1, 2].map((k) => p[1][k] - p[0][k]), b = [0, 1, 2].map((k) => p[3][k] - p[0][k]), n = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]].map(Math.abs); return n.indexOf(Math.max(...n)); };

// Walk a recorded event list with a matrix stack from the GUI base: every Tessellator draw becomes quads with the matrix current at that moment.
function nativeQuads(events, texture, shadeFrame = false) {
  let m = guiBase(); const stack = [], out = [];
  for (const e of events) {
    if (e[0] === "T") m = gl.translate(m, e[1], e[2], e[3]);
    else if (e[0] === "S") m = gl.scale(m, e[1], e[2], e[3]);
    else if (e[0] === "R") m = gl.rotate(m, e[1], e[2], e[3], e[4]);
    else if (e[0] === "P") stack.push(m);
    else if (e[0] === "O") m = stack.pop();
    else if (e[0] === "D") for (let q = 0; q < e[1]; q += 4) {
      const pos = [], uv = [];
      for (let i = q; i < q + 4; i++) { const o = i * 8, u = fl(e[2][o + 3]); pos.push([fl(e[2][o]), fl(e[2][o + 1]), fl(e[2][o + 2])]); uv.push([u - 2 * Math.floor(u / 2), fl(e[2][o + 4])]); }
      out.push({ pos, uv, tex: texture, shade: shadeFrame ? FACE_SHADE[normalAxis(pos)] : 0, m });
    }
  }
  return out;
}
const differing = (a, b) => { let n = 0; for (let i = 0; i < a.length; i += 4) if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2] || a[i + 3] !== b[i + 3]) n++; return n; };
const covered = (a) => { let n = 0; for (let i = 3; i < a.length; i += 4) if (a[i]) n++; return n; };

test("the chest model quads equal the executed ModelBox draws and the prefix equals the renderer's GL calls", () => {
  const first = chest.items[0].events, d = first.findIndex((e) => e[0] === "P");
  assert.deepEqual(first.slice(0, d), [["C", 1, 1, 1, 1], ["R", 90, 0, 1, 0], ["T", -0.5, -0.5, -0.5]]);
  assert.deepEqual(first.slice(d + 1, d + 7), [["C", 1, 1, 1, 1], ...CHEST_ITEM_PREFIX]);
  for (const it of chest.items) assert.deepEqual(it.events, first, `chest ${it.id} records the same geometry as the plain chest`);
  // after the prefix: per part [T rotation point, D x6, T back, T 0 (ModelRenderer's offset), ...]; collect the draws per part
  const draws = first.filter((e) => e[0] === "D"), ts = first.filter((e) => e[0] === "T").map((e) => e.slice(1));
  assert.equal(draws.length, 18);
  CHEST_ITEM_PARTS.forEach((part, k) => {
    assert.ok(ts.some((t) => t.every((v, i) => v === part.at[i] / 16)), `rotation point of part ${k}`);
    modelBoxQuads(part).forEach((q, qi) => {
      const e = draws[k * 6 + qi];
      q.forEach((v, i) => [0, 1, 2, 3, 4].forEach((c) => assert.equal(Math.fround(v[c]), fl(e[2][i * 8 + c]), `part ${k} quad ${qi} vertex ${i} component ${c}`)));
    });
  });
});

test("the chest icon raster equals the raster of the recorded draws, pixel for pixel", () => {
  const port = rasterQuads(64, 64, chestIconQuads(sheet)), nat = rasterQuads(64, 64, nativeQuads(chest.items[0].events, sheet, true));
  assert.ok(covered(port) > 600, `covered ${covered(port)}`);
  assert.equal(differing(port, nat), 0);
});

test("every executed box item draws the same icon as its port table (stairs, fences, gate, beacon, anvil, egg, slabs, plates, ... and cubes)", () => {
  let n = 0, nonCube = 0;
  for (const it of ref.items) {
    if (it.type === 13 || it.type === 16) continue; // cactus and the piston bases keep the cube icon (their item models are not box tables yet)
    const boxes = it.type === 34 ? BEACON_ITEM_BOXES : it.type === 10 ? STAIR_ITEM_BOXES : it.type === 11 ? FENCE_ITEM_BOXES : it.type === 21 ? GATE_ITEM_BOXES : it.type === 35 ? anvilModelBoxes(0) : ITEM_BOXES[it.id] ?? [[0, 0, 0, 1, 1, 1]];
    const turned = it.events.some((e) => e[0] === "R"), uvOf = it.type === 35 ? (fi, p, box) => anvilUv(0, fi, p, box) : undefined;
    const nat = rasterQuads(64, 64, nativeQuads(it.events, tile, true)), port = rasterQuads(64, 64, boxQuads(boxes, () => tile, uvOf), 4, boxModelView(turned));
    assert.equal(differing(port, nat), 0, `item ${it.id}:${it.meta} type ${it.type}: ${differing(port, nat)} pixels differ`);
    n++; if (boxes.length > 1 || boxes[0][4] !== 1) nonCube++;
  }
  assert.ok(n > 60 && nonCube > 25, `${n} items, ${nonCube} non-cube`);
});

test("the unit cube through the box path: the west and south faces are the old cube path's rasters, the top face follows the executed uv rule", () => {
  const F = cubeFaces(4, 0), Q = boxQuads([[0, 0, 0, 1, 1, 1]], () => tile);
  for (const [name, fi, shade] of [["west", 1, 0.2], ["south", 4, 0.08], ["top", 2, 0]]) {
    const old = rasterIcon(64, 64, [{ tile: tile.data, matrix: F[name], shade, gl: true }]), now = rasterQuads(64, 64, [Q[fi]]);
    assert.equal(covered(old), covered(now), `${name} coverage`);
    if (name !== "top") assert.equal(differing(old, now), 0, `${name} texels`);
  }
});

test("the dragon egg's rows are the executed boxes", () => {
  const rows = []; const d = ref.items.find((e) => e.id === 122).events.filter((e) => e[0] === "D")[0];
  for (let r = 0; r < 8; r++) { const lo = [9, 9, 9], hi = [-9, -9, -9]; for (let i = r * 24; i < r * 24 + 24; i++) for (let k = 0; k < 3; k++) { const v = fl(d[2][i * 8 + k]); lo[k] = Math.min(lo[k], v); hi[k] = Math.max(hi[k], v); } rows.push([...lo, ...hi]); }
  assert.deepEqual(ITEM_BOXES[122].flat(), rows.flat());
});

test("the held / dropped chest model occupies the executed part boxes (block frame minus the 0.5 translate)", async () => {
  const THREE = await import("three"), { chestItemModel } = await import("./chest-renderer.js");
  const group = chestItemModel(new THREE.MeshBasicMaterial()); group.updateMatrixWorld(true);
  const port = []; group.traverse((n) => { if (n.isMesh) { n.geometry.computeBoundingBox(); const b = n.geometry.boundingBox.clone().applyMatrix4(n.matrixWorld); port.push([b.min.x, b.min.y, b.min.z, b.max.x, b.max.y, b.max.z].map((v) => Math.round(v * 1e4) / 1e4)); } });
  const prefix = eventsMatrix(CHEST_ITEM_PREFIX), nat = CHEST_ITEM_PARTS.map((part) => {
    const m = gl.translate(prefix, ...part.at.map((c) => c / 16)), lo = [9, 9, 9], hi = [-9, -9, -9];
    for (const q of modelBoxQuads(part)) for (const v of q) { const p = transformPoint(m, v[0], v[1], v[2]); for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], p[k]); hi[k] = Math.max(hi[k], p[k]); } }
    return [...lo, ...hi].map((v) => Math.round((v - 0.5) * 1e4) / 1e4); // the chest cell centred on the origin
  });
  const key = (a) => a.join(","), sort = (l) => l.map(key).sort();
  assert.deepEqual(sort(port), sort(nat), "port boxes vs executed part boxes");
});

test("item ids that map to blocks (1103 and the rest of the ItemBlock / ItemSlab / ItemMultiTexture family) reach the executed boxes", async () => {
  const { ORIGINAL_ITEMS } = await import("./original-items.js"), { itemSpec } = await import("./item-boxes.js"), { blockItemGeometry } = await import("./first-person.js");
  const { STAIR_ITEM_BOXES: stairs } = await import("./stairs.js");
  const want = new Map([...Object.entries(ITEM_BOXES).map(([o, b]) => [+o, b]), ...[53, 67, 108, 109, 114, 128, 134, 135, 136, 156, 163, 164].map((o) => [o, stairs]), [85, FENCE_ITEM_BOXES], [113, FENCE_ITEM_BOXES], [107, GATE_ITEM_BOXES], [138, BEACON_ITEM_BOXES], [145, anvilModelBoxes(0)]]);
  let n = 0;
  for (const [o, boxes] of want) {
    if ([60, 92].includes(o)) continue; // farmland has no item; the cake item is a sprite (ItemReed)
    const item = ORIGINAL_ITEMS[o];
    assert.ok(item, `item of original ${o}`);
    const spec = itemSpec(item, 0, () => 0);
    assert.ok(spec, `item ${item} (original ${o}) has a box model`);
    assert.deepEqual(spec.boxes.map((b) => [...b]), boxes.map((b) => [...b]), `item ${item} (original ${o})`);
    n++;
  }
  assert.ok(n >= 30, `${n} items`);
  assert.ok(blockItemGeometry(1103, 0, 1), "the stone slab item in a hand");
  assert.equal(blockItemGeometry(1103, 0, 1).attributes.position.count, 24);
  assert.equal(blockItemGeometry(1165, 0, 0.25).attributes.position.count, 24, "the wood slab item");
  assert.equal(blockItemGeometry(1168, 0, 1).attributes.position.count, 24, "the trapdoor item");
  assert.equal(blockItemGeometry(171, 0, 1).attributes.position.count, 8 * 24, "the dragon egg block");
  assert.equal(blockItemGeometry(1, 0, 1), null, "a stone cube stays the plain cube");
});

test("a flat icon in GL mode is the 58 px quad with binary pixel-centre coverage (texel = nearest at the centre)", () => {
  const out = rasterIcon(64, 70, [{ tile: tile.data, matrix: [58 / 16, 0, 0, 58 / 16, 3, 5], gl: true }]);
  let n = 0; for (let y = 0; y < 70; y++) for (let x = 0; x < 64; x++) { const o = (y * 64 + x) * 4, inside = x >= 3 && x < 61 && y >= 5 && y < 63; assert.equal(out[o + 3], inside ? 255 : 0, `${x},${y}`); if (inside) { n++; assert.equal(out[o], Math.floor(((x + 0.5 - 3) * 16) / 58) * 16 + 1); assert.equal(out[o + 1], Math.floor(((y + 0.5 - 5) * 16) / 58) * 16 + 1); } }
  assert.equal(n, 58 * 58);
});
