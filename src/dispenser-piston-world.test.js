import { test } from "node:test";
import assert from "node:assert/strict";
import { placeHeldBlock } from "./block-placement-simulation.js";
import { breakPlayerBlock } from "./block-break-simulation.js";
import { World, blockBounds } from "./world.js";
import { Survival, ITEMS, MATERIALS } from "./survival.js";
import { DISPENSER, STICKY_PISTON, PISTON, PISTON_HEAD, DISPENSER_ITEM, PISTON_ITEM, STICKY_PISTON_ITEM, pistonOrientation, minecraftYaw } from "./dispenser-piston.js";
import { DispenserContainer, newDispenser } from "./dispenser-container.js";
import { splitRuntime, joinRuntime, separateContainers } from "./chunk-runtime.js";
import { makeStack } from "./inventory.js";

const stateFor = (world, survival, yaw = 0, position = { x: 30.5, y: 20, z: 30.5 }) => ({ world, survival, position, flowers: {}, yaw, farming: { observe() {} } });
const place = (world, survival, itemId, yaw, position) => {
  survival.inventory.setStack(0, { id: itemId, count: 4, damage: 0 });
  return placeHeldBlock(stateFor(world, survival, yaw, position), { id: itemId, item: ITEMS[itemId], target: { block: [10, 20, 10], adjacent: [10, 21, 10] } }, { collides: () => false });
};

test("block items place their native blocks with determineOrientation metadata", () => {
  for (const [item, block] of [[DISPENSER_ITEM, DISPENSER], [STICKY_PISTON_ITEM, STICKY_PISTON], [PISTON_ITEM, PISTON]]) {
    for (const yaw of [0, 1, 2, 3, 4.5]) {
      const world = new World("dp-place", "meadow", 1), survival = new Survival();
      world.set(10, 20, 10, 1);
      const out = place(world, survival, item, yaw);
      assert.equal(out.placed, true);
      assert.equal(world.get(10, 21, 10), block);
      assert.equal(world.getMeta(10, 21, 10), pistonOrientation(10, 21, 10, 30.5, 20, 30.5, minecraftYaw(yaw)));
      assert.equal(survival.count(item), 3);
      assert.equal(!!survival.dispensers?.["10,21,10"], block === DISPENSER);
    }
  }
});

test("dispenser contents persist through serialize, runtime split/join and the container store", () => {
  const survival = new Survival();
  survival.dispensers["3,64,-5"] = { items: [makeStack(1, 5), null, null, null, makeStack(DISPENSER_ITEM, 2), null, null, null, null] };
  const saved = survival.serialize();
  assert.deepEqual(Object.keys(saved.dispensers), ["3,64,-5"]);
  const again = new Survival(JSON.parse(JSON.stringify(saved)));
  assert.equal(again.dispensers["3,64,-5"].items[0].count, 5);
  assert.equal(again.dispensers["3,64,-5"].items[4].id, DISPENSER_ITEM);
  const record = { player: { chests: {}, furnaces: {}, dispensers: saved.dispensers } };
  const { metadata, columns } = splitRuntime(JSON.parse(JSON.stringify(record)));
  assert.equal(columns.length, 1);
  assert.ok(columns[0].state.dispensers["3,64,-5"]);
  const { containers } = separateContainers(columns);
  assert.ok(containers[0].state.dispensers["3,64,-5"]);
  const joined = joinRuntime(metadata, containers);
  assert.deepEqual(joined.player.dispensers, saved.dispensers);
});

test("breaking a dispenser spills its stacks; breaking a head removes the base, and the reverse", () => {
  const spilled = [], dropped = [];
  const items = { spill: (s, ...p) => spilled.push([s, p]), dropBlock: (s, ...p) => dropped.push([s, p]) };
  const ctx = (world, survival) => ({ world, survival, items, xpOrbs: { spawn() {} }, farming: { observe() {} }, trees: { random: Math.random }, heldTool: 0 });
  const world = new World("dp-break", "meadow", 1), survival = new Survival();
  world.set(5, 20, 5, DISPENSER, true, 3);
  survival.dispensers["5,20,5"] = { items: [makeStack(1, 7), ...Array(8).fill(null)] };
  assert.ok(breakPlayerBlock(ctx(world, survival), [5, 20, 5], { creative: true }));
  assert.equal(world.get(5, 20, 5), 0);
  assert.equal(spilled.length, 1);
  assert.equal(spilled[0][0][0].count, 7);
  assert.equal(survival.dispensers["5,20,5"], undefined);
  // Extended sticky piston facing east: base at x=8, head at x=9.
  world.set(8, 20, 8, STICKY_PISTON, true, 8 | 5);
  world.set(9, 20, 8, PISTON_HEAD, true, 8 | 5);
  assert.ok(breakPlayerBlock(ctx(world, survival), [9, 20, 8], { creative: false }));
  assert.equal(world.get(9, 20, 8), 0);
  assert.equal(world.get(8, 20, 8), 0);
  assert.deepEqual(dropped.flatMap(([stacks]) => stacks.map((x) => x.id)), [STICKY_PISTON_ITEM]);
  world.set(8, 20, 8, PISTON, true, 8 | 5);
  world.set(9, 20, 8, PISTON_HEAD, true, 5);
  assert.ok(breakPlayerBlock(ctx(world, survival), [8, 20, 8], { creative: true }));
  assert.equal(world.get(9, 20, 8), 0);
});

test("static extended states keep native bounds and the dispenser container opens", () => {
  const world = new World("dp-bounds", "meadow", 1);
  world.set(2, 20, 2, PISTON, true, 8 | 3);
  assert.deepEqual(blockBounds(world, 2, 20, 2), [0, 0, 0, 1, 1, 0.75]);
  assert.ok(MATERIALS[DISPENSER] && MATERIALS[PISTON_HEAD].drop === 0);
  const survival = new Survival(), container = new DispenserContainer(survival.inventory, newDispenser());
  assert.equal(container.slots.length, 45);
});
