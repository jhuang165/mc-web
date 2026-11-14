// Batch 72 cakefog72: BlockCake.onBlockClicked eats a slice (aju bytecode-read: a(ahb,III,yz) -> b(...) -> yz.g(false), zr.a(2, 0.1f), meta + 1, cleared at 6);
// setupFog (blt) offsets 587-637: Nether and End (aqo.b(II)Z true in aqp and aqr) fog from far * 0.05 to min(far, 192) * 0.5.
import { test } from "node:test";
import assert from "node:assert/strict";
import { World } from "./world.js";
import { Survival } from "./survival.js";
import { Farming } from "./farming.js";
import { Trees } from "./trees.js";
import { JavaRandom } from "./java-random.js";
import { applyPlayerEdit } from "./player-edit-simulation.js";
import { CAKE } from "./stems-cake.js";
import { serverCakeEat } from "./multiplayer/server-cake.js";
import { dimensionFogRange, doesXZShowFog } from "./void-fog.js";

const POS = [42, 12, 42];
function fixture(food, mode = "survival") {
  const world = new World("b72-cake");
  world.set(...POS, CAKE, false, 0);
  world.set(POS[0], POS[1] + 1, POS[2], 0, false, 0);
  const survival = new Survival({ food, slots: [] }, mode);
  const state = {
    screen: "playing", heldTool: 0, world, survival, position: { x: 10.5, y: 10, z: 10.5 }, velocity: { x: 0, y: 0, z: 0 },
    motion: { sneaking: false, sprinting: false }, mobs: {}, farming: new Farming(world), trees: new Trees(world, { random: new JavaRandom(18) }), fire: {},
    grounded: true, fallDistance: 0, wasInWater: false, yaw: 0, eating: null, mining: null, mineCooldown: 0, mineHeld: true,
    flowers: {}, boneRandom: new JavaRandom(21), itemRand: new JavaRandom(22),
  };
  return { state, request: { target: { block: [...POS], adjacent: [POS[0], POS[1] + 1, POS[2]] } } };
}

test("single player: a left click (dig start) eats a slice when hungry, in the network-tick task", () => {
  const f = fixture(10), queue = [];
  applyPlayerEdit(f.state, f.request, { serverTask: fn => queue.push(fn) });
  assert.equal(f.state.survival.food, 10, "waits for the network tick");
  queue.shift()();
  assert.equal(f.state.survival.food, 12);
  assert.equal(f.state.world.getMeta(...POS), 1);
  assert.equal(f.state.world.get(...POS), CAKE);
});

test("single player: a full player or a Creative player eats nothing on a punch", () => {
  for (const f of [fixture(20), fixture(10, "creative")]) {
    applyPlayerEdit(f.state, f.request, {});
    assert.equal(f.state.world.getMeta(...POS), 0);
    assert.equal(f.state.world.get(...POS), CAKE);
  }
});

test("single player: the sixth bite by punches removes the cake", () => {
  const f = fixture(0);
  f.state.world.set(...POS, CAKE, false, 5);
  applyPlayerEdit(f.state, f.request, {});
  assert.equal(f.state.world.get(...POS), 0);
});

test("server: serverCakeEat eats like the right click, refuses when full or Creative, ignores other blocks", () => {
  const world = new World("b72-cake-srv");
  world.set(...POS, CAKE, false, 0);
  const s = new Survival({ food: 5, slots: [] }, "survival");
  assert.equal(serverCakeEat(world, s, ...POS), true);
  assert.equal(s.food, 7);
  assert.equal(world.getMeta(...POS), 1);
  s.food = 20;
  assert.equal(serverCakeEat(world, s, ...POS), true, "the click is consumed");
  assert.equal(world.getMeta(...POS), 1, "but nothing is eaten");
  assert.equal(serverCakeEat(world, s, POS[0], POS[1] + 1, POS[2]), false);
  const c = new Survival({ food: 5, slots: [] }, "creative");
  serverCakeEat(world, c, ...POS);
  assert.equal(world.getMeta(...POS), 1);
});

test("fog: Nether and End use far * 0.05 .. min(far, 192) * 0.5, the Overworld nothing", () => {
  assert.deepEqual([0, -1, 1].map(doesXZShowFog), [false, true, true]);
  assert.equal(dimensionFogRange({ far: 128, dimension: 0 }), null);
  for (const d of [-1, 1]) {
    assert.deepEqual(dimensionFogRange({ far: 128, dimension: d }), { start: Math.fround(128 * Math.fround(0.05)), end: 64 });
    assert.deepEqual(dimensionFogRange({ far: 256, dimension: d }), { start: Math.fround(256 * Math.fround(0.05)), end: 96 });
  }
});
