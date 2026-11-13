// Batch 61 smallchecks3: the brewing stand's potion take hook (SlotBrewingStandPotion.onPickupFromSlot, bytecode-read zz$aab), and the Java 7 HashMap order of effect ids
// (an independent hand simulation; no Java 6/7 JDK exists on the dev Mac, only JDK 19, so Java 7 is NOT executed here).
import test from "node:test";
import assert from "node:assert/strict";
import { PlayerInventory } from "./inventory.js";
import { ITEMS } from "./survival.js";
import { BrewingContainer } from "./brewing-container.js";
import { brewingView, newBrewingTile } from "./brewing.js";
import { JavaHashSetOrder } from "./java-hashset-order.js";
import { effectsMapOrder } from "./status-effects.js";

const POTION = 385, BOTTLE = 384;
function stand(items) {
  const tile = newBrewingTile(); items.forEach((s, i) => (tile.items[i] = s));
  const inv = new PlayerInventory(ITEMS, []), c = new BrewingContainer(inv, brewingView(tile), null), taken = [];
  c.onPotionTaken = (s) => taken.push({ ...s });
  return { inv, c, taken };
}
const p = (damage) => ({ id: POTION, count: 1, damage });

test("brewing take hook: a potion with damage > 0 taken by click awards, a water bottle or glass bottle does not", () => {
  const { inv, c, taken } = stand([p(8193), p(0), { id: BOTTLE, count: 1, damage: 0 }, null]);
  c.click(0, 0, 0); assert.equal(taken.length, 1); assert.equal(taken[0].damage, 8193);
  inv.cursor = null;
  c.click(1, 0, 0); c.click(2, 0, 0);
  assert.equal(taken.length, 1);
});

test("brewing take hook: shift-click out of a bottle slot awards; shift-click into the stand does not", () => {
  const { c, taken } = stand([p(16), null, null, null]);
  c.click(0, 0, 1);
  assert.equal(taken.length, 1);
  const b = stand([null, null, null, null]);
  b.inv.main[0] = p(16); b.c.click(4 + 27, 0, 1); // hotbar slot 0 of the container is index 31
  assert.equal(b.taken.length, 0);
});

test("brewing take hook: placing into a bottle slot or taking from the ingredient slot does not award", () => {
  const { inv, c, taken } = stand([null, null, null, { id: 372, count: 3, damage: 0 }]);
  c.click(3, 0, 0); assert.equal(taken.length, 0);
  inv.cursor = p(16); c.click(0, 0, 0); assert.equal(taken.length, 0);
});

// Java 7 HashMap<Integer, V> (Java 6/7 source, recalled): hash = h ^= (h >>> 20) ^ (h >>> 12); h ^ (h >>> 7) ^ (h >>> 4); index = hash & (len - 1);
// put adds at the HEAD of the chain; the table doubles when size >= threshold (0.75 * len) after the add, and transfer() re-inserts each old entry at the head of its new chain.
function java7Order(ids) {
  let len = 16, table = Array(len).fill(null), size = 0;
  const hash = (h) => { h ^= (h >>> 20) ^ (h >>> 12); return h ^ (h >>> 7) ^ (h >>> 4); };
  for (const id of ids) {
    const i = hash(id) & (len - 1);
    table[i] = { id, next: table[i] }; size++;
    if (size >= len * 0.75) {
      const nl = len * 2, nt = Array(nl).fill(null);
      for (const head of table) for (let e = head; e;) { const nx = e.next, j = hash(e.id) & (nl - 1); e.next = nt[j]; nt[j] = e; e = nx; }
      table = nt; len = nl;
    }
  }
  const out = [];
  for (const head of table) for (let e = head; e; e = e.next) out.push(e.id);
  return out;
}

test("Java 7 order: hand simulation agrees with JavaHashSetOrder('java7') and equals Java 8 for ids 1..15", () => {
  let seed = 7; const rnd = () => (seed = (seed * 1103515245 + 12345) >>> 0) / 2 ** 32;
  for (let t = 0; t < 400; t++) {
    const n = 1 + Math.floor(rnd() * 11), ids = [];
    while (ids.length < n) { const id = 1 + Math.floor(rnd() * 23); if (!ids.includes(id)) ids.push(id); }
    const m = new JavaHashSetOrder("java7"); for (const id of ids) m.add(id, id);
    assert.deepEqual(java7Order(ids), m.keys(), ids.join());
    if (ids.every((i) => i <= 15)) assert.deepEqual(java7Order(ids), effectsMapOrder(ids.map((id) => ({ id }))).map((x) => x.id));
  }
});

test("Java 7 order: ids 16..23 swap bucket pairs and join the front of a chain; the Java 8 choice stays", () => {
  assert.deepEqual(java7Order([16, 17]), [17, 16]); // buckets 1 and 0
  assert.deepEqual(effectsMapOrder([{ id: 16 }, { id: 17 }]).map((x) => x.id), [16, 17]); // Java 8: bucket 0 then 1
  assert.deepEqual(java7Order([1, 17]), [17, 1]); // 17 hashes to bucket 0 (h ^ h>>>4 = 16)
  assert.deepEqual(effectsMapOrder([{ id: 1 }, { id: 17 }]).map((x) => x.id), [1, 17]); // Java 8: 17 is bucket 1, after id 1
  assert.deepEqual(java7Order([1, 16]), [16, 1]); // same as Java 8 here: 16 -> bucket 1 (head) vs bucket 0
});
