import { test } from "node:test";
import assert from "node:assert/strict";
import { Survival } from "./survival.js";
import { usePotion, finishPotion, bottleFromCauldron } from "./potion-use.js";
import { newBrewingTile, brewingView, BREW_TIME } from "./brewing.js";
import { makeStack } from "./inventory.js";

const mk = (damage, count = 1) => { const s = new Survival({ time: 0, slots: [] }, "survival"); s.inventory.main[0] = makeStack(385, count, damage); s.inventory.current = 0; return s; };

test("drinking a potion applies its effects and returns a glass bottle in Survival", () => {
  const s = mk(8193); // regeneration
  const state = { survival: s, eating: null };
  assert.equal(usePotion(state), "drink");
  assert.deepEqual([state.eating.ticks, state.eating.drink], [32, true]);
  assert.equal(finishPotion(s), true);
  assert.equal(s.effects.has(10), true);
  assert.equal(s.inventory.main[0].id, 384);
});

test("creative drinking keeps the potion", () => {
  const s = mk(8193); s.mode = "creative";
  assert.equal(finishPotion(s), true);
  assert.equal(s.inventory.main[0].id, 385);
});

test("splash potion throw consumes one and spawns a flying potion", () => {
  const s = mk(16385, 1), thrown = [];
  const state = { survival: s, position: { x: 0, y: 60, z: 0 }, yaw: 0, pitch: 0, mobs: { potions: { throwFromPlayer: (...a) => thrown.push(a) } } };
  assert.equal(usePotion(state), "throw");
  assert.equal(thrown.length, 1);
  assert.equal(thrown[0][3], 16385);
  assert.equal(s.inventory.main[0], null);
});

test("a cauldron level fills a bottle", () => {
  const s = new Survival({ time: 0, slots: [] }, "survival");
  s.inventory.main[0] = makeStack(384, 2); s.inventory.current = 0;
  const state = { survival: s, items: null };
  assert.equal(bottleFromCauldron(state, 3), 2);
  assert.equal(s.inventory.main[0].count, 1);
  assert.equal(s.count(385), 1);
  assert.equal(bottleFromCauldron(state, 0), null);
});

test("a brewing stand record brews a water bottle into an awkward potion", () => {
  const tile = newBrewingTile();
  tile.items[0] = { id: 385, count: 1, damage: 0 };
  tile.items[3] = { id: 386, count: 1, damage: 0 }; // nether wart
  const view = brewingView(tile);
  for (let i = 0; i <= BREW_TIME + 1; i++) view.tick();
  assert.equal(tile.items[0].damage, 16);
  assert.equal(tile.items[3], null);
  assert.equal(view.bottleBits(), 1);
});
