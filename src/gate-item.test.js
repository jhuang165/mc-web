import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gateItemGeometry, isGateItem } from "./first-person.js";
import { GATE_ITEM_BOXES } from "./render-shapes.js";

test("the fence gate item model is the three type 21 boxes with six faces each", () => {
  assert.equal(GATE_ITEM_BOXES.length, 3);
  const g = gateItemGeometry(1167), pos = g.attributes.position;
  assert.equal(pos.count, 3 * 6 * 4);
  assert.equal(g.index.count, 3 * 6 * 6);
  // Box extents, centred on the block (the -0.5 translate): the bar spans z -0.5..0.5 at x +-1/16 and y 0.5..1-1/16 -> 0..0.4375.
  const box = (k) => { const lo = [9, 9, 9], hi = [-9, -9, -9]; for (let i = k * 24; i < k * 24 + 24; i++) for (let a = 0; a < 3; a++) { const v = pos.array[i * 3 + a]; lo[a] = Math.min(lo[a], v); hi[a] = Math.max(hi[a], v); } return [...lo, ...hi]; };
  GATE_ITEM_BOXES.forEach((b, k) => b.forEach((v, i) => assert.ok(Math.abs(box(k)[i] - (v - 0.5)) < 1e-6, `box ${k} coordinate ${i}`)));
});

test("the dropped scale shrinks the model and the block id counts as the item", () => {
  const big = gateItemGeometry(1167).attributes.position, small = gateItemGeometry(167, 0.25).attributes.position;
  for (let i = 0; i < big.array.length; i++) assert.ok(Math.abs(small.array[i] - big.array[i] * 0.25) < 1e-6);
  assert.ok(isGateItem(1167) && isGateItem(167) && !isGateItem(85) && !isGateItem(1168));
});

test("the inventory icon, the held model, the third-person hand and the dropped item all use the gate boxes", () => {
  for (const f of ["item-boxes.js", "block-textures.js", "first-person.js", "drop-renderer.js", "player-renderer.js"]) {
    const s = readFileSync(new URL("./" + f, import.meta.url), "utf8");
    assert.match(s, /itemSpec|GATE_ITEM_BOXES|gateItemGeometry|blockItemGeometry/, f);
  }
});
