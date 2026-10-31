import { test } from "node:test";
import assert from "node:assert/strict";
import { World, collides, blockBounds } from "./world.js";
import { CHEST, canPlaceChest, placementFacing, placeChest, openChest, tickLid, lidAngle, newChest, chestPair, christmas } from "./chest.js";
import { Survival, craftingResult, burnTime } from "./survival.js";
import { makeStack } from "./inventory.js";

function flat() {
  const w = new World("Chests", "meadow", 3);
  for (let x = 10; x < 20; x++) for (let z = 10; z < 20; z++) for (let y = 40; y < 44; y++) w.set(x, y, z, 0, false);
  return w;
}
const put = (w, chests, x, z, yaw = 0) => { w.set(x, 40, z, CHEST); placeChest(w, chests, x, 40, z, yaw); };

test("chests face the player and pair only with a single neighbour", () => {
  assert.deepEqual([0, Math.PI / 2, Math.PI, -Math.PI / 2].map(placementFacing), [3, 5, 2, 4]);
  const w = flat(), chests = {};
  put(w, chests, 12, 12);
  put(w, chests, 13, 12);
  assert.deepEqual([chests["12,40,12"].facing, chests["13,40,12"].facing], [3, 3]);
  assert.equal(canPlaceChest(w, 14, 40, 12), false, "next to a double chest");
  assert.equal(canPlaceChest(w, 12, 40, 13), false, "beside one half of a pair");
  assert.equal(canPlaceChest(w, 15, 40, 12), true);
  put(w, chests, 15, 14);
  put(w, chests, 17, 14);
  assert.equal(canPlaceChest(w, 16, 40, 14), false, "between two chests");
});

test("a pair placed against the yaw keeps the opaque-neighbour facing", () => {
  const w = flat(), chests = {};
  put(w, chests, 12, 15, Math.PI / 2);
  assert.equal(chests["12,40,15"].facing, 5);
  w.set(12, 40, 17, 3);
  put(w, chests, 12, 16, Math.PI / 2);
  // A z-axis pair faces east or west; the yaw (east) lines up, so both turn east.
  assert.deepEqual([chests["12,40,15"].facing, chests["12,40,16"].facing], [5, 5]);
  const other = {};
  w.set(15, 40, 11, 3);
  put(w, other, 15, 12, Math.PI / 2);
  put(w, other, 16, 12, Math.PI / 2);
  // An x-axis pair cannot face east; stone to the north turns it south.
  assert.deepEqual([other["15,40,12"].facing, other["16,40,12"].facing], [3, 3]);
});

test("opening needs a free lid, and a pair opens as one large chest", () => {
  const w = flat(), chests = {};
  put(w, chests, 12, 12);
  put(w, chests, 13, 12);
  chests["12,40,12"].items[0] = makeStack(4, 5);
  chests["13,40,12"].items[0] = makeStack(3, 7);
  const opened = openChest(w, chests, 13, 40, 12);
  assert.equal(opened.title, "Large Chest");
  assert.deepEqual(opened.keys, ["12,40,12", "13,40,12"]);
  assert.deepEqual([opened.inventory.getStack(0), opened.inventory.getStack(27)], [makeStack(4, 5), makeStack(3, 7)]);
  w.set(12, 41, 12, 5);
  assert.ok(openChest(w, chests, 13, 40, 12), "leaves are not a normal cube");
  w.set(12, 41, 12, 3);
  assert.equal(openChest(w, chests, 13, 40, 12), null, "stone on the partner blocks the lid");
  w.set(12, 41, 12, 20);
  assert.ok(openChest(w, chests, 12, 40, 12), "a torch is not a normal cube");
  assert.deepEqual(chestPair(w, 12, 40, 12), { primary: true, east: true, south: false, double: true });
  assert.equal(chestPair(w, 13, 40, 12).primary, false);
});

test("the lid opens and closes at 0.1 per tick with the original sound timing", () => {
  const c = newChest(), sounds = [];
  c.users = 1;
  for (let i = 0; i < 12; i++) sounds.push(tickLid(c, true));
  assert.equal(sounds[0], "random.chestopen");
  assert.equal(sounds.filter(Boolean).length, 1);
  assert.equal(c.lid, 1);
  c.users = 0;
  const closing = [];
  for (let i = 0; i < 12; i++) closing.push(tickLid(c, true));
  assert.equal(closing.indexOf("random.chestclosed"), 4, "float lid steps fall below 0.5 on the fifth tick");
  assert.equal(c.lid, 0);
  assert.equal(lidAngle({ lid: 1, prevLid: 1 }), Math.PI / 2);
  assert.ok(Math.abs(lidAngle({ lid: 0.5, prevLid: 0.5 }) - (7 / 8) * (Math.PI / 2)) < 1e-9);
  assert.equal(christmas(new Date(2026, 11, 25)), true);
  assert.equal(christmas(new Date(2026, 11, 27)), false);
});

test("chest bounds, recipe, fuel, container and save", () => {
  const w = flat(), chests = {};
  put(w, chests, 12, 12);
  assert.deepEqual(blockBounds(w, 12, 40, 12), [1 / 16, 0, 1 / 16, 15 / 16, 0.875, 15 / 16]);
  assert.equal(collides(w, 12.5, 40.875, 12.5), false);
  assert.equal(collides(w, 12.5, 40.8, 12.5), true);
  assert.equal(collides(w, 11.69, 40.5, 12.5), false, "the 1/16 inset leaves a gap");
  put(w, chests, 13, 12);
  assert.equal(blockBounds(w, 12, 40, 12)[3], 1);
  const p = new Survival({ slots: [] });
  assert.deepEqual(craftingResult([7, 7, 7, 7, null, 7, 7, 7, 7].map((id) => id && makeStack(id)), 3), makeStack(41));
  assert.equal(burnTime(makeStack(41)), 300);
  p.chests = chests;
  chests["12,40,12"].items[3] = makeStack(4, 9);
  const c = p.openChest(w, 12, 40, 12);
  assert.equal(c.slots.length, 90);
  assert.equal(c.height, 222);
  assert.deepEqual([c.slots[54].x, c.slots[54].y, c.slots[81].y], [8, 139, 197]);
  assert.equal(chests["12,40,12"].users, 1);
  c.close();
  assert.equal(chests["13,40,12"].users, 0);
  const saved = new Survival(JSON.parse(JSON.stringify(p.serialize())));
  assert.deepEqual(saved.chests["12,40,12"].items[3], makeStack(4, 9));
  assert.equal(saved.chests["12,40,12"].facing, 3);
  assert.equal(saved.chests["12,40,12"].users, 0);
});
