import { test } from "node:test";
import assert from "node:assert/strict";
import { placeHeldBlock } from "./block-placement-simulation.js";
import { World, WATER, SNOW_LAYER, ICE, TALL_GRASS, REEDS, WOOL, YELLOW_FLOWER, RED_FLOWER, LADDER, CACTUS, SAPLING, ANVIL } from "./world.js";
import { Survival, ITEMS } from "./survival.js";
import { CHEST } from "./chest.js";
import { REEDS_ITEM } from "./plants.js";
import { anvilPlacementMeta } from "./anvil-block.js";

const FLOWERS = { yellow: YELLOW_FLOWER, red: RED_FLOWER };
const putStack = (survival, id, count = 4, damage = 0) => survival.inventory.setStack(0, { id, count, damage });
const stateFor = (world, survival, position = { x: 30.5, y: 20, z: 30.5 }) => ({
  world, survival, position, flowers: FLOWERS, yaw: 0,
  farming: { observe() {} },
});
const targetAt = (block, adjacent) => ({ block, adjacent });

test("ordinary ItemBlock placement preserves silent collision probe, metadata, count, and hook order", () => {
  const world = new World("block-placement", "meadow", 1), survival = new Survival();
  const here = [10, 20, 10], p = [10, 21, 10];
  world.set(...here, 1);
  world.set(...p, 0);
  putStack(survival, WOOL, 4, 14);
  const calls = [], baseSet = world.set.bind(world);
  world.set = (x, y, z, id, notify, meta) => {
    calls.push(["set", x, y, z, id, notify, meta]);
    return baseSet(x, y, z, id, notify, meta);
  };
  const outcome = placeHeldBlock(stateFor(world, survival), {
    id: WOOL, item: ITEMS[WOOL], target: targetAt(here, p),
  }, {
    collides: (w, x, y, z) => { calls.push("collides"); assert.deepEqual([x, y, z], [30.5, 20, 30.5]); return false; },
    updateBlock: (...args) => calls.push(["update", ...args]),
    renderHotbar: () => calls.push("hotbar"),
    sound: (...args) => calls.push(["sound", ...args]),
    markUnsaved: () => calls.push("dirty"),
  });
  assert.deepEqual(outcome, { placed: true, reason: "block", block: WOOL, position: p });
  assert.equal(world.get(...p), WOOL);
  assert.equal(world.getMeta(...p), 14);
  assert.equal(survival.count(WOOL), 3);
  assert.deepEqual(calls[0].slice(4), [WOOL, false, 14]);
  assert.equal(calls[1], "collides");
  assert.equal(calls[2][4], WOOL);
  assert.equal(calls[2][5], true);
  assert.deepEqual(calls.slice(-4), [["update", p[0], p[2], p[1]], "hotbar", ["sound", true, WOOL], "dirty"]);

  const leafBase = [12, 20, 12], leafCell = [12, 21, 12];
  world.set(...leafBase, 1);
  world.set(...leafCell, 0);
  putStack(survival, 5, 1);
  const leaves = placeHeldBlock(stateFor(world, survival), {
    id: 5, item: ITEMS[5], target: targetAt(leafBase, leafCell),
  }, { collides: () => false });
  assert.equal(leaves.placed, true);
  assert.equal(world.getMeta(...leafCell), 4, "placed leaves retain ItemLeaves' no-decay metadata");
});

test("real World collision rolls ItemBlock writes back and keeps old metadata/count", () => {
  const world = new World("block-placement-collision", "meadow", 1), survival = new Survival();
  const p = [15, 20, 15], here = [15, 19, 15];
  world.set(...here, 1);
  world.set(...p, SNOW_LAYER, true, 6); // a replaceable cell; the rollback restores it with its metadata
  putStack(survival, 2, 3, 0);
  const calls = [], baseSet = world.set.bind(world);
  world.set = (...args) => { calls.push(args.slice(3)); return baseSet(...args); };
  const state = stateFor(world, survival, { x: 15.5, y: 20, z: 15.5 }), messages = [];
  const outcome = placeHeldBlock(state, { id: 2, item: ITEMS[2], target: targetAt(here, p) }, { toast: (m) => messages.push(m) });
  assert.equal(outcome.reason, "player-collision");
  assert.equal(world.get(...p), SNOW_LAYER);
  assert.equal(world.getMeta(...p), 6);
  assert.equal(survival.count(2), 3);
  assert.deepEqual(calls.slice(-2), [[2, false, 0], [SNOW_LAYER, false, 6]]);
  assert.deepEqual(messages, ["Give yourself a little room to build."]);
});

test("snow stacking preserves high metadata bits and rolls back on real player collision", () => {
  const world = new World("block-placement-snow", "meadow", 1), survival = new Survival();
  const cell = [18, 20, 18];
  world.set(...cell, SNOW_LAYER, true, 10);
  putStack(survival, SNOW_LAYER, 2);
  const successful = placeHeldBlock(stateFor(world, survival), {
    id: SNOW_LAYER, item: ITEMS[SNOW_LAYER], target: targetAt(cell, [18, 21, 18]),
  }, { collides: () => false });
  assert.equal(successful.reason, "stacked-snow");
  assert.equal(world.getMeta(...cell), 11);
  assert.equal(survival.count(SNOW_LAYER), 1);

  const rollbackCell = [22, 20, 22];
  world.set(...rollbackCell, SNOW_LAYER, true, 5);
  const collisionState = stateFor(world, survival, { x: 22.5, y: 20, z: 22.5 }), messages = [];
  const failed = placeHeldBlock(collisionState, {
    id: SNOW_LAYER, item: ITEMS[SNOW_LAYER], target: targetAt(rollbackCell, [22, 21, 22]),
  }, { toast: (m) => messages.push(m) });
  assert.equal(failed.reason, "player-collision");
  assert.equal(world.getMeta(...rollbackCell), 5);
  assert.equal(survival.count(SNOW_LAYER), 1);
  assert.deepEqual(messages, ["Give yourself a little room to build."]);
});

test("reeds replace tall grass only with adjacent water support and consume once", () => {
  const world = new World("block-placement-reeds", "meadow", 1), survival = new Survival();
  const cell = [25, 20, 25];
  world.set(cell[0], cell[1] - 1, cell[2], 1);
  world.set(cell[0] - 1, cell[1] - 1, cell[2], WATER);
  world.set(...cell, TALL_GRASS);
  putStack(survival, REEDS_ITEM, 2);
  const events = [];
  const placed = placeHeldBlock(stateFor(world, survival), {
    id: REEDS_ITEM, item: ITEMS[REEDS_ITEM], target: targetAt(cell, [cell[0], cell[1] + 1, cell[2]]),
  }, { sound: (...args) => events.push(["sound", ...args]), markUnsaved: () => events.push("dirty") });
  assert.equal(placed.reason, "reeds");
  assert.equal(world.get(...cell), REEDS);
  assert.equal(survival.count(REEDS_ITEM), 1);
  assert.deepEqual(events, [["sound", true, REEDS], "dirty"]);

  const unsupported = [27, 20, 27];
  world.set(unsupported[0], unsupported[1] - 1, unsupported[2], 1);
  world.set(...unsupported, TALL_GRASS);
  const failed = placeHeldBlock(stateFor(world, survival), {
    id: REEDS_ITEM, item: ITEMS[REEDS_ITEM], target: targetAt(unsupported, unsupported),
  });
  assert.equal(failed.reason, "cannot-place-reeds");
  assert.equal(world.get(...unsupported), TALL_GRASS);
  assert.equal(survival.count(REEDS_ITEM), 1);
});

test("Creative chest placement skips the count and sets orientation; support checks reject invalid blocks", () => {
  const world = new World("block-placement-creative", "meadow", 1), creative = new Survival({}, "creative");
  const support = [35, 20, 35], p = [35, 21, 35];
  world.set(...support, 1);
  world.set(...p, 0);
  const chestState = stateFor(world, creative, { x: 45.5, y: 20, z: 45.5 });
  chestState.yaw = Math.PI / 2;
  const chest = placeHeldBlock(chestState, {
    id: CHEST, item: ITEMS[CHEST], target: targetAt(support, p),
  }, { collides: () => false });
  assert.equal(chest.placed, true);
  assert.equal(world.get(...p), CHEST);
  assert.equal(creative.count(CHEST), 0);
  assert.equal(creative.chests["35,21,35"].facing, 5);

  const failures = [
    [YELLOW_FLOWER, [40, 20, 40], [40, 21, 40]], // flower without valid ground
    [SAPLING, [42, 20, 42], [42, 21, 42]], // sapling without valid ground
    [SNOW_LAYER, [44, 20, 44], [44, 21, 44]], // snow over air
    [LADDER, [46, 20, 46], [46, 21, 46]], // ladder with no adjacent normal cube
    [CACTUS, [48, 20, 48], [48, 21, 48]], // cactus without sand/cactus below
  ];
  const expectedReasons = ["flower-support", "sapling-support", "snow-support", "ladder-support", "cactus-support"];
  for (const [i, [id, block, adjacent]] of failures.entries()) {
    if (id === LADDER) for (const [dx, dz] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) world.set(adjacent[0] + dx, adjacent[1], adjacent[2] + dz, 0);
    if (id === CACTUS) world.set(...block, 1);
    world.set(...block, 0);
    world.set(...adjacent, 0);
    const outcome = placeHeldBlock(stateFor(world, creative, { x: 55.5, y: 20, z: 55.5 }), {
      id, item: ITEMS[id], target: targetAt(block, adjacent),
    });
    assert.equal(outcome.reason, expectedReasons[i], `block ${id} rejected by its support rule`);
    assert.equal(world.get(...adjacent), 0);
  }
  const flowerBase = [52, 20, 52], flowerCell = [52, 21, 52];
  world.set(...flowerBase, 1);
  for (let y = 21; y < world.height; y++) world.set(52, y, 52, 0);
  const flower = placeHeldBlock(stateFor(world, creative, { x: 60.5, y: 20, z: 60.5 }), {
    id: YELLOW_FLOWER, item: ITEMS[YELLOW_FLOWER], target: targetAt(flowerBase, flowerCell),
  }, { collides: () => false });
  assert.equal(flower.placed, true, "passed FLOWERS lighting IDs permit a supported, lit flower");
  assert.equal(world.get(...flowerCell), YELLOW_FLOWER);
  assert.equal(world.get(44, 20, 44), 0, "ICE is also rejected as snow support");
  world.set(44, 19, 44, ICE);
  const iceSnow = placeHeldBlock(stateFor(world, creative), {
    id: SNOW_LAYER, item: ITEMS[SNOW_LAYER], target: targetAt([44, 19, 44], [44, 20, 44]),
  });
  assert.equal(iceSnow.reason, "snow-support");
  assert.equal(world.get(44, 20, 44), 0);
});

test("ItemBlock count feedback and legacy versus Java top-layer bounds are retained", () => {
  const survival = new Survival(), messages = [], cells = new Map();
  const world = {
    height: 256,
    inside: (x, y, z) => x >= 0 && z >= 0 && y >= 0 && y < 256,
    get(x, y, z) { return cells.get(`${x},${y},${z}`)?.id ?? 0; },
    getMeta(x, y, z) { return cells.get(`${x},${y},${z}`)?.meta ?? 0; },
    set(x, y, z, id, _notify, meta = 0) { cells.set(`${x},${y},${z}`, { id, meta }); return true; },
  };
  const state = { world, survival, position: { x: 8.5, y: 8, z: 8.5 }, flowers: FLOWERS, yaw: 0, farming: { observe() {} } };
  const itemBlock = (y) => placeHeldBlock(state, {
    id: 2, item: ITEMS[2], target: targetAt([1, y - 1, 1], [1, y, 1]),
  }, { collides: () => false, toast: (message) => messages.push(message) });
  assert.equal(itemBlock(255).reason, "empty-stack");
  assert.deepEqual(messages, ["Gather this material first."]);
  putStack(survival, 2, 1);
  assert.equal(itemBlock(255).placed, true, "Java worlds permit a block at y=255");
  assert.equal(itemBlock(256).reason, "invalid-position");

  world.height = 64;
  assert.equal(itemBlock(62).reason, "empty-stack", "legacy world's highest placeable cell is y=62");
  assert.equal(itemBlock(63).reason, "invalid-position", "legacy top layer y=63 remains reserved");
  assert.equal(itemBlock(0).reason, "invalid-position", "bedrock layer is not a placement target");
});

test("anvil ItemBlock placement keeps native yaw quadrants, item damage, and schedules falling", () => {
  const quarterTurns = [0, Math.PI / 2, Math.PI, -Math.PI / 2], expectedFacing = [0, 3, 2, 1];
  for (let damage = 0; damage <= 2; damage++) for (let i = 0; i < quarterTurns.length; i++) {
    const world = new World(`anvil-placement-${damage}-${i}`, "meadow", 1), survival = new Survival();
    const support = [12, 20, 12], cell = [12, 21, 12];
    world.set(...support, 1); world.set(...cell, 0); putStack(survival, ANVIL, 2, damage);
    const state = stateFor(world, survival); state.yaw = quarterTurns[i];
    const scheduled = [];
    const placed = placeHeldBlock(state, { id: ANVIL, item: ITEMS[ANVIL], target: targetAt(support, cell) }, { collides: () => false, scheduleFalling: (...p) => scheduled.push(p) });
    assert.equal(placed.placed, true);
    assert.equal(world.get(...cell), ANVIL);
    assert.equal(world.getMeta(...cell), anvilPlacementMeta(quarterTurns[i], damage));
    assert.equal(world.getMeta(...cell) & 3, expectedFacing[i]);
    assert.deepEqual(scheduled, [cell], "successful ItemBlock set is silent; schedule its BlockFalling update explicitly");
    assert.equal(survival.count(ANVIL), 1);
  }
});
