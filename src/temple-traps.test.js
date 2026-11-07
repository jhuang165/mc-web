// Jungle and desert temple traps running live: tripwire -> redstone -> dispenser arrows, the lever puzzle -> sticky
// pistons, and the stone plate -> TNT. Block rules are replayed natively in tripwire.test.js / redstone.test.js;
// this checks the generated temples are wired into the running engine (finite v14 seed 267, jungle).
import test from "node:test";
import assert from "node:assert/strict";
import { World } from "./world.js";
import { populationBlockMapperReady } from "./population-world.js";
import { restorePopulation } from "./population-runtime.js";
import { createRedstoneRuntime } from "./redstone-runtime.js";
import { JavaRandom } from "./java-random.js";
import { fromOriginal } from "./block-registry.js";

await populationBlockMapperReady;
const HOOK = 131, STRING = 132, DISPENSER = 23, STICKY = 29, HEAD = 34, SANDSTONE = 24, PLATE = 70, TNT = 46;

function jungle() {
  const world = new World("267", "java", 14), survival = { chests: {}, dispensers: {}, furnaces: {} };
  restorePopulation({}, world, survival, { entities: [], create: (type, x, y, z) => ({ type, x, y, z }) });
  const arrows = [], sounds = [], drops = [], pos = { x: 0, y: -999, z: 0 };
  const runtime = createRedstoneRuntime({
    world,
    game: {
      dispensers: () => survival.dispensers,
      sound: (name) => sounds.push(name),
      drop: (x, y, z, d) => drops.push(d),
      arrows: () => arrows.list,
      player: () => ({ position: pos, width: 0.6, height: 1.8, alive: true }),
      dispense: { rng: () => new JavaRandom(5), arrow: (e) => arrows.push(e) },
    },
  });
  arrows.list = [];
  const r = runtime.redstone, run = (n) => { for (let i = 0; i < n; i++) runtime.tick(); };
  return { world, runtime, r, arrows, sounds, drops, pos, run, meta: (x, y, z) => r.getBlockMetadata(x, y, z) };
}
const stand = (g, x, z) => Object.assign(g.pos, { x: x + 0.5, y: 62, z: z + 0.5 });
const leave = (g) => Object.assign(g.pos, { x: 0, y: -999, z: 0 });

test("the generated jungle temple keeps its inert, settled tripwire state", () => {
  const g = jungle();
  assert.deepEqual([g.r.getBlock(49, 62, 55), g.r.getBlock(53, 62, 55), g.r.getBlock(50, 62, 55)], [HOOK, HOOK, STRING]);
  assert.deepEqual([g.meta(49, 62, 55), g.meta(53, 62, 55), g.meta(50, 62, 55)], [7, 5, 4]);
  g.run(60);
  assert.deepEqual([g.meta(49, 62, 55), g.meta(53, 62, 55), g.meta(51, 62, 55)], [7, 5, 4]);
  assert.equal(g.arrows.length, 0);
});

test("stepping on the first trap line powers the wire and the dispenser fires an arrow once", () => {
  const g = jungle();
  stand(g, 51, 55);
  g.run(30);
  assert.equal(g.arrows.length, 1);
  assert.deepEqual([g.meta(49, 62, 55), g.meta(53, 62, 55)], [15, 13]);
  assert.equal(g.meta(51, 62, 55), 5);
  assert.ok(g.sounds.includes("random.bow"));
  // Standing on the string keeps it powered without a second shot; leaving releases the hooks.
  g.run(60);
  assert.equal(g.arrows.length, 1);
  leave(g);
  g.run(30);
  assert.deepEqual([g.meta(49, 62, 55), g.meta(53, 62, 55), g.meta(51, 62, 55)], [7, 5, 4]);
});

test("the second trap line fires the other dispenser; an arrow entity also trips a string", () => {
  const g = jungle();
  stand(g, 56, 50);
  g.run(30);
  assert.equal(g.arrows.length, 1, "second dispenser");
  leave(g);
  g.run(30);
  const g2 = jungle();
  g2.arrows.list.push({ x: 51.5, y: 62.1, z: 55.5, dead: false });
  g2.run(20);
  assert.equal(g2.arrows.length, 1);
});

test("shears disarm a string: breaking it neither powers nor leaves an attached line", () => {
  const g = jungle();
  g.world.put(51, 62, 55, 114, 4 | 8); // BlockTripWire.onBlockHarvested with shears (metadata |8, flags 4)
  g.world.set(51, 62, 55, 0);
  g.run(20);
  assert.equal(g.arrows.length, 0);
  assert.deepEqual([g.meta(49, 62, 55), g.meta(53, 62, 55)], [3, 1], "hooks lose attached, never powered");
  // Without shears the same break powers the line for a moment (func_150138_a(meta | 1)).
  const h = jungle();
  h.world.set(51, 62, 55, 0);
  h.run(20);
  assert.equal(h.arrows.length, 1);
});

test("breaking a hook and a string's floor drops the right items", () => {
  const g = jungle();
  g.world.set(50, 61, 55, 0); // the floor under a string: its suspended bit no longer matches
  g.run(2);
  assert.equal(g.r.getBlock(50, 62, 55), 0);
  assert.ok(g.drops.some((d) => d.id === 321), "string item");
  const h = jungle();
  h.world.set(48, 62, 55, 0); // the block a hook hangs on
  h.run(2);
  assert.equal(h.r.getBlock(49, 62, 55), 0);
  assert.ok(h.drops.some((d) => d.id === 1113), "tripwire hook item");
});

test("the lever puzzle: the right lever extends the sticky pistons that open the hidden room, the decoys do nothing", () => {
  for (const [lever, opens] of [[56, false], [57, false], [58, true]]) {
    const g = jungle();
    g.run(5);
    assert.equal(g.r.getBlock(56, 63, 57), STICKY);
    g.runtime.use(60, 63, lever);
    g.run(40);
    assert.equal(g.r.getBlock(56, 64, 57) === HEAD, opens, `lever ${lever}`);
    assert.equal(g.r.getBlock(56, 63, 57) === HEAD, opens, `lever ${lever}`);
  }
});

test("a pressed stone plate over sandstone primes the TNT block beneath (desert pyramid layout)", () => {
  const world = new World("desert-trap", "meadow"), primed = [], pos = { x: 0, y: -999, z: 0 };
  const rt = createRedstoneRuntime({ world, game: { primeTnt: (x, y, z) => primed.push([x, y, z]), player: () => ({ position: pos, width: 0.6, height: 1.8, alive: true }) } });
  const r = rt.redstone, [x, y, z] = [20, 40, 20];
  for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) for (let dy = -3; dy <= 2; dy++) world.put(x + dx, y + dy, z + dz, 0, 0, false);
  // generator: plate (10,-11,10) on sandstone (10,-12,10) above TNT (9..11,-13,9..11); sandstone around.
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
    r.setRaw(x + dx, y - 2, z + dz, TNT, 0);
    r.setRaw(x + dx, y - 1, z + dz, SANDSTONE, 2);
  }
  r.setRaw(x, y, z, PLATE, 0);
  assert.ok(fromOriginal(PLATE, 0));
  rt.tick();
  assert.equal(primed.length, 0);
  Object.assign(pos, { x: x + 0.5, y, z: z + 0.5 });
  for (let i = 0; i < 5; i++) rt.tick();
  assert.deepEqual(primed, [[x, y - 2, z]], "the TNT directly under the powered sandstone primes");
  assert.equal(r.getBlock(x, y - 2, z), 0);
  assert.equal(r.getBlockMetadata(x, y, z), 1);
});
