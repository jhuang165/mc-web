// Batch 85 mppredict85: the multiplayer client's ItemStack.useItemRightClick on its own world (client-item-use.js; bytecode-read per item class).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { World, WATER, LAVA, LILY_PAD } from "./world.js";
import { makeStack } from "./inventory.js";
import { Survival } from "./survival.js";
import { clientUseItem } from "./client-item-use.js";
import { applyHeldPlan } from "./client-prediction.js";
import { applySlots } from "./multiplayer/server-items.js";
import { ITEM_GLASS_BOTTLE, ITEM_POTION } from "./potions.js";
import { BOAT_ITEM } from "./boats.js";
import { SNOWBALL, EGG, ENDER_PEARL } from "./player-throw-simulation.js";
import { ITEM_EXP_BOTTLE, ITEM_SPAWN_EGG } from "./spawn-eggs.js";

function pond() {
  const w = new World("mppredict85-pond");
  for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) {
    for (let y = 9; y <= 16; y++) w.set(40 + dx, y, 40 + dz, 0, false, 0);
    w.set(40 + dx, 10, 40 + dz, 3, false, 0); w.set(40 + dx, 11, 40 + dz, WATER, false, 0);
  }
  return w;
}
const DOWN = { eye: [40.5, 12.8, 40.5], dir: [0, -1, 0] };
const use = (w, survival, extra = {}) => clientUseItem({ world: w, survival, held: survival.held, ...DOWN, yaw: 0, ...extra });
const survivalOf = (id, n, damage = 0) => { const s = new Survival({ slots: [makeStack(id, n)] }); s.held.damage = damage; s.held.count = n; return s; };

test("lily pad: the client places the pad above the traced water and loses one; Creative keeps the stack; a pad cell is not water", () => {
  const w = pond(), s = survivalOf(LILY_PAD, 3);
  const out = use(w, s);
  assert.deepEqual(out.cells, [{ x: 40, y: 12, z: 40, block: LILY_PAD, meta: 0 }]);
  assert.deepEqual(out.plan, { dCount: -1 });
  applyHeldPlan(s.inventory, out.plan);
  assert.equal(s.held.count, 2);
  w.set(40, 12, 40, LILY_PAD, false, 0);
  assert.deepEqual(use(w, s), { cells: [], plan: null });
  const c = survivalOf(LILY_PAD, 3); c.mode = "creative";
  assert.deepEqual(use(pond(), c).plan, null);
  assert.equal(use(pond(), c).cells.length, 1);
});

test("S2F is absolute: the client's decrement and the server's equal one do not add up", () => {
  const w = pond(), s = survivalOf(LILY_PAD, 3);
  applyHeldPlan(s.inventory, use(w, s).plan);
  applySlots(s.inventory, { slots: [{ slot: 0, stack: { id: LILY_PAD, count: 2, damage: 0 } }], seq: 1 }, {});
  assert.equal(s.inventory.main[0].count, 2);
});

test("glass bottle: a traced water cell takes one (Creative too, abl has no creative test); a lone bottle becomes the water bottle; no world change", () => {
  const w = pond(), s = survivalOf(ITEM_GLASS_BOTTLE, 1);
  const out = use(w, s);
  assert.deepEqual(out.cells, []);
  assert.deepEqual(out.plan, { dCount: 0, swap: [ITEM_GLASS_BOTTLE, ITEM_POTION] });
  applyHeldPlan(s.inventory, out.plan);
  assert.equal(s.held.id, ITEM_POTION);
  const many = survivalOf(ITEM_GLASS_BOTTLE, 4); many.mode = "creative";
  assert.deepEqual(use(w, many).plan, { dCount: -1, give: ITEM_POTION });
  assert.equal(use(w, survivalOf(ITEM_GLASS_BOTTLE, 2), { eye: [50.5, 12.8, 50.5] }).plan, null);
  w.set(40, 11, 40, LAVA, false, 0);
  assert.equal(use(w, survivalOf(ITEM_GLASS_BOTTLE, 2)).plan, null);
});

test("throwables and the splash potion lose one unless Creative; a drinkable potion, spawn egg and anything else change nothing", () => {
  const w = pond();
  for (const id of [SNOWBALL, EGG, ENDER_PEARL, ITEM_EXP_BOTTLE]) {
    assert.deepEqual(use(w, survivalOf(id, 5)).plan, { dCount: -1 }, String(id));
    const c = survivalOf(id, 5); c.mode = "creative";
    assert.equal(use(w, c).plan, null, `${id} creative`);
  }
  assert.deepEqual(use(w, survivalOf(ITEM_POTION, 2, 16384 + 1)).plan, { dCount: -1 }, "splash");
  assert.equal(use(w, survivalOf(ITEM_POTION, 2, 1)).plan, null, "drinkable");
  assert.deepEqual(use(w, survivalOf(ITEM_SPAWN_EGG, 2, 50)), { cells: [], plan: null });
});

test("boat: one is taken when the boat fits on the traced water; a blocked box or Creative keeps the stack", () => {
  const w = pond();
  assert.deepEqual(use(w, survivalOf(BOAT_ITEM, 2)).plan, { dCount: -1 });
  assert.equal(use(w, survivalOf(BOAT_ITEM, 2), { entities: [{ bb: [39, 10, 39, 42, 14, 42], collide: false }] }).plan, null); // b86 predict86: the copies come as clientEntityBoxes rows
  const c = survivalOf(BOAT_ITEM, 2); c.mode = "creative";
  assert.equal(use(w, c).plan, null);
  assert.equal(use(w, survivalOf(BOAT_ITEM, 2), { eye: [40.5, 30, 40.5], dir: [0, 1, 0] }).plan, null);
});

test("buckets: the empty one takes a source and swaps; the full one places and empties; the client world edit comes with it", () => {
  const w = pond(), s = survivalOf(340, 1);
  const out = use(w, s);
  assert.equal(out.cells.length, 1);
  assert.equal(out.cells[0].block, 0);
  assert.deepEqual(out.plan.swap?.[0], 340);
});

test("main.js sends sendUseItem's prediction only when the click swung nothing and aimed at no entity", () => {
  const main = readFileSync(new URL("./main.js", import.meta.url), "utf8");
  assert.match(main, /if \(!swings && !\(aimedEntity \|\| aimedCart \|\| aimedHanging \|\| aimedRemoteMob \|\| aimedRemotePlayer\)\) predictMultiplayerUse\(\)/);
  assert.match(main, /clientUseItem\(\{ world, survival, held: survival\.held/);
});
