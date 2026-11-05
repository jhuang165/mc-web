// Rails (BlockRail / BlockRailBase / RailLogic) and wall torches (BlockTorch), replayed against
// the unchanged 1.7.10 classes: public/research/fence-rail-reference.json (tools/verify-fence-rail.mjs).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BLOCKS, RAIL, TORCH, FENCE, SNOW_LAYER, blockBounds, collisionBoxes, selectionBounds, solidBlock, opaqueCube, normalCube } from "./world.js";
import { railBounds, railCanPlace, railSupported, railAdded, solidTop, Rails, RailLogic } from "./rails.js";
import { torchBounds, torchCanPlace, torchPlacedMeta, torchAddedMeta, torchSupported, placedTorchMeta, Torches } from "./torches.js";
import { toOriginal, fromOriginal } from "./block-registry.js";
import { lightOpacity } from "./lighting.js";
import { MATERIALS, RECIPES } from "./survival.js";
import { digSpeed } from "./mining.js";
import { CREATIVE_TABS } from "./creative.js";
import { placeHeldBlock } from "./block-placement-simulation.js";

const ref = JSON.parse(readFileSync(new URL("../public/research/fence-rail-reference.json", import.meta.url)));
const records = (c) => ref.records.filter((r) => r.case === c);
const facts = (block) => records("facts").find((r) => r.block === block);

// A sparse world: `floor` puts stone under y 0, like the probe's world.
function grid(cells = {}, floor = false) {
  const map = new Map(), metas = new Map();
  for (const [k, v] of Object.entries(cells)) map.set(k, v);
  const w = {
    height: 64,
    inside: () => true,
    get: (x, y, z) => map.get(`${x},${y},${z}`) ?? (floor && y < 0 ? 3 : 0),
    getMeta: (x, y, z) => metas.get(`${x},${y},${z}`) ?? 0,
    set(x, y, z, b, track = true, meta = 0) {
      const k = `${x},${y},${z}`, old = w.get(x, y, z);
      if (b) map.set(k, b); else map.delete(k);
      metas.set(k, meta);
      if (track) w.onChange?.(x, y, z, old, b);
      return true;
    },
    solid(x, y, z) { return solidBlock(this.get(x, y, z), this.getMeta(x, y, z)); },
  };
  return w;
}
const at = (...p) => p.join(",");

test("rail block facts match BlockRail", () => {
  const f = facts("rail");
  assert.equal(BLOCKS[RAIL].name, "Rail");
  for (let meta = 0; meta < 16; meta++) {
    assert.deepEqual(toOriginal(RAIL, meta), [66, meta <= 9 ? meta : 0]);
    assert.deepEqual(fromOriginal(66, meta), { id: RAIL, meta: meta <= 9 ? meta : 0, exact: meta <= 9 });
  }
  assert.equal(lightOpacity(RAIL), f.opacity);
  assert.equal(opaqueCube(RAIL), f.opaque);
  assert.equal(normalCube(RAIL), f.normalCube);
  assert.equal(solidBlock(RAIL), f.blocksMovement);
  assert.equal(MATERIALS[RAIL].hardness, f.hardness);
  assert.equal(MATERIALS[RAIL].drop ?? RAIL, fromOriginal(f.drop).id);
  assert.equal(MATERIALS[RAIL].tier, undefined, "no tool needed");
  assert.equal(digSpeed(RAIL, { kind: "pickaxe", speed: 4 }), 4, "ItemPickaxe lists the rail");
  const recipe = RECIPES.find((r) => r.output === RAIL);
  assert.deepEqual([recipe.width, recipe.height, recipe.count], [3, 3, 16]);
  assert.deepEqual(recipe.pattern, [302, 0, 302, 302, 300, 302, 302, 0, 302]);
  assert.ok(CREATIVE_TABS[3].items.includes(RAIL));
});

test("rail bounds per metadata, with no collision box", () => {
  for (const r of records("railBounds")) {
    const meta = r.meta <= 9 ? r.meta : 0, w = grid({ "0,0,0": RAIL }, true);
    w.set(0, 0, 0, RAIL, false, meta);
    assert.equal(r.collision, null);
    // Metadata 10-15 is not a valid rail; the port reads it as 0 (both are 0.125 high).
    assert.deepEqual(railBounds(meta), r.bounds, `meta ${r.meta}`);
    assert.deepEqual(blockBounds(w, 0, 0, 0), r.bounds);
    assert.deepEqual(selectionBounds(w, 0, 0, 0), r.bounds);
    assert.deepEqual(collisionBoxes(w, 0, 0, 0), []);
  }
});

test("solid-top, rail and torch support agree with the original for every port block", () => {
  const byOriginal = new Map(records("block").map((r) => [r.id, r]));
  for (let id = 1; id < BLOCKS.length; id++)
    for (let meta = 0; meta < 16; meta++) {
      if (BLOCKS[id].reserved) continue;
      const [mc, mm] = toOriginal(id, meta), back = fromOriginal(mc, mm);
      if (back.id !== id || back.meta !== meta || !back.exact) continue;
      const r = byOriginal.get(mc), bit = (mask) => !!(mask & (1 << mm)), name = `${BLOCKS[id].name} ${mc}:${mm}`;
      const w = grid();
      w.set(0, 0, 0, id, false, meta);
      assert.equal(solidTop(w, 0, 0, 0), bit(r.solidTop), `solidTop ${name}`);
      assert.equal(railCanPlace(w, 0, 1, 0), bit(r.railBelow), `rail on ${name}`);
      assert.equal(torchCanPlace(w, 0, 1, 0), bit(r.torchBelow), `torch on ${name}`);
    }
});

test("BlockRailBase.onNeighborBlockChange breaks unsupported rails, including raised ends", () => {
  for (const r of records("railSupport")) {
    if (r.meta > 9) continue;
    for (let mask = 0; mask < 32; mask++) {
      const cells = {};
      if (mask & 1) cells["0,0,0"] = 3;
      if (mask & 2) cells["1,1,0"] = 3;
      if (mask & 4) cells["-1,1,0"] = 3;
      if (mask & 8) cells["0,1,-1"] = 3;
      if (mask & 16) cells["0,1,1"] = 3;
      const w = grid(cells);
      w.set(0, 1, 0, RAIL, false, r.meta);
      assert.equal(!railSupported(w, 0, 1, 0), !!r.removed[mask], `meta ${r.meta} mask ${mask}`);
      // The live watcher drops the rail item and clears the cell.
      const dropped = [];
      new Rails(w, { drop: (s) => dropped.push(...s) }).neighbourChanged(0, 1, 0);
      assert.equal(w.get(0, 1, 0), r.removed[mask] ? 0 : RAIL);
      assert.deepEqual(dropped, r.removed[mask] ? [{ id: RAIL, count: 1, damage: 0 }] : []);
    }
  }
});

test("RailLogic picks straight, curved and ascending shapes as the original places them", () => {
  let steps = 0;
  for (const r of records("railPlace")) {
    const w = grid({}, true);
    for (const [x, y, z] of r.stones) w.set(x, y, z, 3, false, 0);
    const placed = [];
    for (const step of r.steps) {
      const [x, y, z] = step.place;
      placed.push(step.place);
      w.set(x, y, z, RAIL, false, 0);
      railAdded(w, x, y, z);
      const now = placed.filter((p) => w.get(...p) === RAIL).map((p) => [...p, w.getMeta(...p)]);
      assert.deepEqual(now, step.rails, `stones ${JSON.stringify(r.stones)} after ${at(...step.place)}`);
      steps++;
    }
  }
  assert.ok(steps > 300);
  // A lone rail keeps metadata 0 and connects to nothing.
  const w = grid({}, true);
  w.set(0, 0, 0, RAIL, false, 0);
  railAdded(w, 0, 0, 0);
  assert.deepEqual(new RailLogic(w, 0, 0, 0).connected, [[0, 0, -1], [0, 0, 1]]);
});

test("placing rails from the hotbar checks support and shapes the track", () => {
  const w = grid({ "0,4,0": 3, "1,4,0": 3 }), taken = [];
  const survival = { creative: false, count: () => 64, take: (id) => taken.push(id), held: { id: RAIL, count: 64, damage: 0 }, chests: {} };
  const state = { world: w, survival, position: { x: 10.5, y: 5, z: 10.5 }, flowers: {}, farming: { observe() {} }, yaw: 0 };
  const place = (block, adjacent) => placeHeldBlock(state, { id: RAIL, item: { block: true }, target: { block, adjacent } }, { collides: () => false });
  assert.equal(place([0, 4, 0], [0, 5, 0]).placed, true);
  assert.equal(place([1, 4, 0], [1, 5, 0]).placed, true);
  assert.deepEqual([w.getMeta(0, 5, 0), w.getMeta(1, 5, 0)], [1, 1]);
  // No solid top below (the rail itself is not one): refused, nothing taken.
  assert.equal(place([0, 5, 0], [0, 6, 0]).reason, "rail-support");
  assert.deepEqual(taken, [RAIL, RAIL]);
});

test("torch bounds per metadata follow BlockTorch.collisionRayTrace", () => {
  for (const r of records("torchBounds")) {
    assert.equal(r.collision, null);
    assert.deepEqual(torchBounds(r.meta), r.bounds, `meta ${r.meta}`);
    const w = grid();
    w.set(0, 0, 0, TORCH, false, r.meta);
    assert.deepEqual(blockBounds(w, 0, 0, 0), r.bounds);
    assert.deepEqual(collisionBoxes(w, 0, 0, 0), []);
  }
  // The standing torch is stored as 0 in the port and written as original 5.
  assert.deepEqual(toOriginal(TORCH, 0), [50, 5]);
  assert.deepEqual(fromOriginal(50, 5), { id: TORCH, meta: 0, exact: true });
  for (let m = 1; m <= 4; m++) assert.deepEqual(fromOriginal(50, m), { id: TORCH, meta: m, exact: true });
});

test("torch placement, orientation and support replay BlockTorch", () => {
  const torchWorld = (mask) => {
    const cells = {};
    if (mask & 1) cells["-1,1,0"] = 3;
    if (mask & 2) cells["1,1,0"] = 3;
    if (mask & 4) cells["0,1,-1"] = 3;
    if (mask & 8) cells["0,1,1"] = 3;
    if (mask & 16) cells["0,0,0"] = 3;
    return grid(cells);
  };
  for (const r of records("torch")) {
    const w = torchWorld(r.mask);
    assert.equal(torchCanPlace(w, 0, 1, 0), r.canPlace, `mask ${r.mask}`);
    for (let side = 0; side < 6; side++) {
      const meta = torchPlacedMeta(w, 0, 1, 0, side);
      assert.equal(meta, r.placed[side], `mask ${r.mask} side ${side}`);
      assert.equal(torchAddedMeta(w, 0, 1, 0, meta), r.added[side], `added mask ${r.mask} side ${side}`);
      // ItemBlock only places when canPlaceBlockAt holds; the port stores standing torches as 0.
      const expected = !r.canPlace ? -1 : r.added[side] === 5 ? 0 : r.added[side];
      assert.equal(placedTorchMeta(w, 0, 1, 0, side), expected);
    }
    for (let meta = 1; meta <= 5; meta++) {
      w.set(0, 1, 0, TORCH, false, meta);
      assert.equal(torchSupported(w, 0, 1, 0), !!r.kept[meta - 1], `kept mask ${r.mask} meta ${meta}`);
    }
    w.set(0, 1, 0, TORCH, false, 0);
    assert.equal(torchSupported(w, 0, 1, 0), !!r.kept[4], "the port's standing torch (0) acts as 5");
  }
  // Torches stand on fences and glass (func_150107_m) as well as solid tops.
  for (const b of [FENCE, 9]) assert.equal(torchCanPlace(grid({ "0,0,0": b }), 0, 1, 0), true);
  assert.equal(torchCanPlace(grid({ "0,0,0": RAIL }), 0, 1, 0), false);
  // A neighbour change drops an unsupported torch as an item.
  const w = grid({ "-1,1,0": 3 }), dropped = [];
  w.set(0, 1, 0, TORCH, false, 1);
  new Torches(w, { drop: (s) => dropped.push(...s) }).watch();
  w.set(-1, 1, 0, 0);
  assert.equal(w.get(0, 1, 0), 0);
  assert.deepEqual(dropped, [{ id: TORCH, count: 1, damage: 0 }]);
  // A full snow layer is a solid top; a thinner one is not.
  const snow = grid();
  snow.set(0, 0, 0, SNOW_LAYER, false, 7);
  assert.equal(solidTop(snow, 0, 0, 0), true);
  snow.set(0, 0, 0, SNOW_LAYER, false, 6);
  assert.equal(solidTop(snow, 0, 0, 0), false);
});

test("placing a torch on a wall stores the wall metadata", () => {
  const w = grid({ "0,5,0": 3, "0,4,1": 3 });
  const survival = { creative: true, count: () => 64, take() {}, held: { id: TORCH, count: 64, damage: 0 }, chests: {} };
  const state = { world: w, survival, position: { x: 10.5, y: 5, z: 10.5 }, flowers: {}, farming: { observe() {} }, yaw: 0 };
  const place = (block, adjacent) => placeHeldBlock(state, { id: TORCH, item: { block: true }, target: { block, adjacent } }, { collides: () => false });
  // The east face of (0,5,0): a wall torch pointing east (1).
  assert.equal(place([0, 5, 0], [1, 5, 0]).placed, true);
  assert.equal(w.getMeta(1, 5, 0), 1);
  // On top of a block: standing (0).
  assert.equal(place([0, 4, 1], [0, 5, 1]).placed, true);
  assert.equal(w.getMeta(0, 5, 1), 0);
  // In the air with nothing around: refused.
  assert.equal(place([5, 9, 5], [5, 10, 5]).reason, "torch-support");
});
