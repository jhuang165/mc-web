import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as dp from "./dispenser-piston.js";

const ref = JSON.parse(readFileSync(new URL("../public/research/dispenser-piston-reference.json", import.meta.url)));
const blockOf = (n) => ref.blocks.find((b) => b.id === n);
const IDS = { 23: dp.DISPENSER, 29: dp.STICKY_PISTON, 33: dp.PISTON, 34: dp.PISTON_HEAD };
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-5, `${a} vs ${b}`);

test("determineOrientation matches the native server and client results", () => {
  const [bx, by, bz] = ref.orientation.block;
  for (const [dx, dy, dz, yaw, , server, client] of ref.orientation.rows) {
    assert.equal(server, client);
    assert.equal(dp.pistonOrientation(bx, by, bz, bx + dx, by + dy, bz + dz, yaw), server, JSON.stringify([dx, dy, dz, yaw]));
  }
});

test("placement metadata matches onBlockPlacedBy for all three blocks", () => {
  const [bx, by, bz] = ref.placement.block;
  for (const [, px, py, pz, yaw, , meta] of ref.placement.rows) assert.equal(dp.pistonOrientation(bx, by, bz, bx + px, by + py, bz + pz, yaw), meta);
});

test("metadata helpers", () => {
  assert.deepEqual(Array.from({ length: 16 }, (_, m) => dp.pistonFacing(m)), ref.helpers.orientation);
  assert.deepEqual(Array.from({ length: 16 }, (_, m) => dp.pistonExtended(m)), ref.helpers.extended);
  assert.deepEqual(Array.from({ length: 16 }, (_, m) => dp.headFacing(m)), ref.helpers.headFacing);
});

test("bounds, collision boxes and icons per metadata", () => {
  for (const b of ref.blocks) {
    const id = IDS[b.id];
    for (let m = 0; m < 16; m++) {
      assert.deepEqual(dp.dispenserPistonBounds(id, m), b.boundsByMeta[m], `${b.id}:${m}`);
      if (b.id !== 23) assert.deepEqual(dp.dispenserPistonBoxes(id, m), b.collision[m].boxes, `${b.id}:${m} boxes`);
      for (let s = 0; s < 6; s++) assert.equal(dp.iconName(id, m, s), b.icons[m][s], `${b.id}:${m}:${s}`);
    }
  }
});

test("render quads replay RenderBlocks.renderPistonBase / renderPistonExtension", () => {
  for (const c of ref.render.cases) {
    const quads = dp.pistonQuads(IDS[c.id], c.meta), flat = quads.flatMap((q) => q.verts.map((v) => [v, q]));
    assert.equal(flat.length, c.quads.length, `${c.id}:${c.meta}`);
    flat.forEach(([v, q], i) => {
      const r = c.quads[i];
      for (let k = 0; k < 3; k++) near(v[k], r[k]);
      assert.equal(q.icon, r[3], `${c.id}:${c.meta}:${i}`);
      near(v[3], r[4]); near(v[4], r[5]);
      assert.ok(Math.abs(q.shade - (r[6] & 255) / 255) < 0.005 || (r[6] === -1 && q.shade === 1), `shade ${q.shade} vs ${r[6]}`);
    });
  }
});

test("item ids stay off the tool range and map back to original items", () => {
  assert.deepEqual([dp.DISPENSER_ITEM, dp.STICKY_PISTON_ITEM, dp.PISTON_ITEM], [1115, 1116, 1117]);
  assert.equal(dp.blockForItem(1117), dp.PISTON);
  assert.equal(dp.itemForBlock(dp.PISTON_HEAD), 0);
  assert.deepEqual(dp.ORIGINAL_ITEMS, { 341: 460, 23: 1115, 29: 1116, 33: 1117 });
});
