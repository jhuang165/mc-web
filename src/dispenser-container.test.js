import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DispenserContainer, newDispenser, DISPENSER_SLOTS } from "./dispenser-container.js";
import { PlayerInventory, makeStack, dragButton } from "./inventory.js";

const ref = JSON.parse(readFileSync(new URL("../public/research/dispenser-piston-reference.json", import.meta.url)));
// Native item facts the probe's random stacks use: snowball 332 and egg 344 stack to 16; sword 276 and bow 261 to 1 (damageable).
const items = new Proxy({}, { get: (t, id) => ({ id: +id, stack: [332, 344].includes(+id) ? 16 : [276, 261, 267].includes(+id) ? 1 : 64, durability: { 276: 1561, 261: 384, 267: 250 }[+id] ?? 0 }) });
const live = (r) => (r ? makeStack(r[0], r[1], r[2]) : null);
const row = (s) => (s ? [s.id, s.count, s.damage ?? 0] : null);
const build = (start, creative) => {
  const inv = new PlayerInventory(items);
  inv.creative = creative;
  start[1].forEach((r, i) => (inv.main[i] = live(r)));
  inv.cursor = live(start[2]);
  const d = newDispenser();
  start[0].forEach((r, i) => (d.items[i] = live(r)));
  return { inv, d, c: new DispenserContainer(inv, d) };
};
const state = (inv, d) => [d.items.map(row), inv.main.map(row), row(inv.cursor)];

test("slot layout matches ContainerDispenser", () => {
  const { c } = build([Array(9).fill(null), Array(36).fill(null), null], false);
  assert.equal(c.slots.length, ref.layout.slotCount);
  ref.layout.slots.forEach(([n, x, y, limit], i) => assert.deepEqual([c.slots[i].number, c.slots[i].x, c.slots[i].y, c.slots[i].limit], [n, x, y, limit], `slot ${i}`));
  assert.equal(DISPENSER_SLOTS, 9);
});

test("replays click, shift-click, hotbar, drop, drag, collect and creative sequences", () => {
  assert.equal(ref.containers.length, 150);
  ref.containers.forEach((cs, n) => {
    const { inv, d, c } = build(cs.start, cs.creative);
    for (const [op, expected, thrown] of cs.steps) {
      c.drops.length = 0;
      if (op[0] === "drag") {
        c.click(-999, dragButton(0, op[1]), 5);
        for (const s of op[2]) c.click(s, dragButton(1, op[1]), 5);
        c.click(-999, dragButton(2, op[1]), 5);
      } else c.click(op[1], op[2], op[3]);
      assert.deepEqual(state(inv, d), expected.slice(0, 3), `case ${n} ${JSON.stringify(op)}`);
      assert.deepEqual(c.drops.map(row), thrown, `case ${n} drops ${JSON.stringify(op)}`);
    }
  });
});

test("replays shift-click routes", () => {
  assert.equal(ref.shifts.length, 135);
  for (const r of ref.shifts) {
    const { inv, d, c } = build([r.before[0], r.before[1], null], false);
    const moved = c.click(r.slot, 0, 1);
    assert.deepEqual(row(moved), r.result, `slot ${r.slot}`);
    assert.deepEqual(state(inv, d).slice(0, 2), r.after.slice(0, 2), `slot ${r.slot}`);
  }
});
