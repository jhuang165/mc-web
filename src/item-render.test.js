// RenderBlocks.renderBlockAsItem (what hands, slots and dropped items draw for 3D block items) against the unchanged 1.7.10 classes: tools/probes/ItemRenderProbe.java,
// public/research/item-render-reference.json (every block id whose render type renderItemIn3d accepts: the transform, colour and Tessellator draw calls in order, vertices as
// float bits). The port's item box tables (stairs, fences, gate, beacon, the others in ITEM_BOXES, the anvil's boxes) and boxItemGeometry's uv crop are replayed against it.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { boxItemGeometry } from "./first-person.js";
import { ITEM_BOXES, GATE_ITEM_BOXES, BEACON_ITEM_BOXES, itemBoxUv, anvilUv } from "./render-shapes.js";
import { STAIR_ITEM_BOXES } from "./stairs.js";
import { FENCE_ITEM_BOXES } from "./fences.js";
import { anvilModelBoxes } from "./anvil-block.js";
import { tileRect } from "./block-textures.js";

const ref = JSON.parse(readFileSync(new URL("../public/research/item-render-reference.json", import.meta.url), "utf8"));
const bf = new Float32Array(1), bi = new Int32Array(bf.buffer), fl = (b) => { bi[0] = b; return bf[0]; };
const draws = (it) => it.events.filter((e) => e[0] === "D").map((e) => { const q = []; for (let i = 0; i < e[1]; i++) { const o = i * 8, u = fl(e[2][o + 3]), idx = Math.floor(u / 2); q.push({ p: [fl(e[2][o]), fl(e[2][o + 1]), fl(e[2][o + 2])], s: u - 2 * idx, t: fl(e[2][o + 4]), icon: ref.icons[idx] }); } return q; });
// Boxes of an item: every six consecutive draws (renderFaceYNeg, YPos, ZNeg, ZPos, XNeg, XPos) are one box; its extent is the vertices' bounding box.
const boxesOf = (it) => { const d = draws(it), out = []; for (let i = 0; i + 6 <= d.length; i += 6) { const lo = [9, 9, 9], hi = [-9, -9, -9]; for (const q of d.slice(i, i + 6)) for (const v of q) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], v.p[k]); hi[k] = Math.max(hi[k], v.p[k]); } out.push({ box: [...lo, ...hi], quads: d.slice(i, i + 6) }); } return out; };
const item = (id, meta = 0) => ref.items.find((e) => e.id === id && e.meta === meta);
const same = (a, b, what) => { assert.equal(a.length, b.length, what); a.forEach((v, i) => assert.ok(Math.abs(v - b[i]) < 1e-6, `${what} [${i}] ${v} vs ${b[i]}`)); };

test("the recorded item draws are boxes of six faces and the unit cubes are the rest", () => {
  const types = new Set(ref.items.map((e) => e.type));
  assert.deepEqual([...types].sort((a, b) => a - b), [0, 10, 11, 13, 16, 21, 26, 27, 31, 32, 34, 35, 39].sort((a, b) => a - b));
  for (const it of ref.items) if (it.id !== 122) assert.equal(draws(it).length % 6, 0, `${it.id}:${it.meta}`);
  assert.deepEqual(ref.failed.map((f) => +f.split(":")[0]).filter((v, i, a) => a.indexOf(v) === i), [54, 130, 146], "only the chest family needs a tile entity renderer");
});

test("stairs, fences, the gate and the beacon: the port's boxes are the executed item boxes", () => {
  for (const id of [53, 67, 108, 109, 114, 128, 134, 135, 136, 156, 163, 164]) same(boxesOf(item(id)).flatMap((b) => b.box), STAIR_ITEM_BOXES.flat(), `stairs ${id}`);
  for (const id of [85, 113]) same(boxesOf(item(id)).flatMap((b) => b.box), FENCE_ITEM_BOXES.flat(), `fence ${id}`);
  same(boxesOf(item(107)).flatMap((b) => b.box), GATE_ITEM_BOXES.flat(), "gate");
  same(boxesOf(item(138)).flatMap((b) => b.box), BEACON_ITEM_BOXES.flat(), "beacon");
});

test("every non-cube type 0 item and the wall have their boxes in ITEM_BOXES, and no listed block is a cube", () => {
  const unit = (b) => b.every((v, i) => v === [0, 0, 0, 1, 1, 1][i]);
  const seen = new Set();
  for (const it of ref.items) {
    if ([10, 11, 21, 34, 35, 27].includes(it.type)) continue;
    const bs = boxesOf(it).map((b) => b.box);
    if (bs.length === 1 && unit(bs[0])) { assert.equal(ITEM_BOXES[it.id], undefined, `${it.id} is a cube`); continue; }
    assert.ok(ITEM_BOXES[it.id], `item ${it.id}:${it.meta} (type ${it.type}) has no ITEM_BOXES entry`);
    same(bs.flat(), ITEM_BOXES[it.id].flat(), `item ${it.id}:${it.meta}`);
    seen.add(it.id);
  }
  assert.deepEqual([...seen].sort((a, b) => a - b), Object.keys(ITEM_BOXES).map(Number).sort((a, b) => a - b));
});

test("boxItemGeometry places every vertex and crops the texture as the native faces do", () => {
  const checked = { n: 0 };
  const all = [[53, STAIR_ITEM_BOXES], [85, FENCE_ITEM_BOXES], [107, GATE_ITEM_BOXES], ...Object.entries(ITEM_BOXES).map(([id, b]) => [+id, b])];
  for (const [id, boxes] of all) {
    const g = boxItemGeometry(boxes, () => 0, 1), pos = g.attributes.position, uv = g.attributes.uv, r = tileRect(0), nat = boxesOf(item(id)).flatMap((b) => b.quads);
    assert.equal(pos.count, nat.length * 4, `${id} vertex count`);
    // native draw order is -y, +y, -z, +z, -x, +x; the port's face order is +x, -x, +y, -y, +z, -z
    const order = [3, 2, 5, 4, 1, 0];
    nat.forEach((q, qi) => {
      const fi = order[qi % 6], box = boxes[Math.floor(qi / 6)];
      for (const v of q) {
        let found = false;
        for (let k = 0; k < 4; k++) {
          const i = (Math.floor(qi / 6) * 6 + fi) * 4 + k;
          if (![0, 1, 2].every((a) => Math.abs(pos.getComponent(i, a) + 0.5 - v.p[a]) < 1e-6)) continue;
          found = true;
          const s = (uv.getX(i) - r.u0) / (r.u1 - r.u0), t = (r.v1 - uv.getY(i)) / (r.v1 - r.v0);
          assert.ok(Math.abs(s - v.s) < 2e-3 && Math.abs(t - v.t) < 2e-3, `${id} box ${box} face ${fi} vertex ${v.p}: uv ${s.toFixed(4)},${t.toFixed(4)} vs native ${v.s.toFixed(4)},${v.t.toFixed(4)}`);
          checked.n++;
        }
        assert.ok(found, `${id} face ${fi} vertex ${v.p} missing`);
      }
    });
  }
  assert.ok(checked.n > 600);
});

test("the anvil item: four boxes, the world model's facing 0 boxes", () => {
  const nat = boxesOf(item(145));
  same(nat.flatMap((b) => b.box), anvilModelBoxes(0).flat(), "anvil boxes");
  // the faces' uv: itemBoxUv or the anvil's turn table, whichever the record fits (reported by the failure message)
  const order = [3, 2, 5, 4, 1, 0];
  let plain = 0, turned = 0, total = 0;
  nat.forEach(({ box, quads }) => quads.forEach((q, qi) => { const fi = order[qi]; for (const v of q) { total++; const a = itemBoxUv(fi, v.p, box), b = anvilUv(0, fi, v.p, box); if (Math.abs(a[0] - v.s) < 2e-3 && Math.abs(a[1] - v.t) < 2e-3) plain++; if (Math.abs(b[0] - v.s) < 2e-3 && Math.abs(b[1] - v.t) < 2e-3) turned++; } }));
  assert.ok(plain === total || turned === total, `anvil uv: plain ${plain}, turned facing 0 ${turned} of ${total}`);
});

test("blockItemGeometry: port block ids reach the executed boxes, cubes and sprites stay null, the anvil ignores its damage for the boxes", async () => {
  const { blockItemGeometry, itemModelBoxes } = await import("./first-person.js");
  const { fromOriginal } = await import("./block-registry.js");
  for (const [orig, expected] of [[44, ITEM_BOXES[44]], [126, ITEM_BOXES[126]], [139, ITEM_BOXES[139]], [85, FENCE_ITEM_BOXES], [113, FENCE_ITEM_BOXES], [78, ITEM_BOXES[78]], [171, ITEM_BOXES[171]], [151, ITEM_BOXES[151]], [116, ITEM_BOXES[116]], [120, ITEM_BOXES[120]], [70, ITEM_BOXES[70]], [143, ITEM_BOXES[143]], [53, STAIR_ITEM_BOXES], [1, null], [17, null], [5, null], [29, null]]) {
    const port = fromOriginal(orig, 0)?.id;
    assert.ok(port, `port id of ${orig}`);
    assert.deepEqual(itemModelBoxes(port), expected, `original ${orig} (port ${port})`);
  }
  assert.ok(itemModelBoxes(167) && itemModelBoxes(1167));
  const base = blockItemGeometry(85 /* port anvil */, 0).attributes.position.array;
  for (const damage of [1, 2, 3]) assert.deepEqual([...blockItemGeometry(85, damage).attributes.position.array], [...base], `anvil damage ${damage}`);
  assert.equal(blockItemGeometry(85, 0).attributes.position.count, 4 * 6 * 4);
});
