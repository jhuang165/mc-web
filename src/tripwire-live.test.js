// Live tripwire entity rules (batch 17, probed in tripwire-reference.json): which entities trip a string, which only keep a
// powered one active, bats, and random ticks. Uses the generated jungle temple line of temple-traps.test.js.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { World } from "./world.js";
import { populationBlockMapperReady } from "./population-world.js";
import { restorePopulation } from "./population-runtime.js";
import { createRedstoneRuntime } from "./redstone-runtime.js";
import { JavaRandom } from "./java-random.js";

await populationBlockMapperReady;
const reference = JSON.parse(readFileSync(new URL("../public/research/tripwire-reference.json", import.meta.url)));

function jungle() {
  const world = new World("267", "java", 14), survival = { chests: {}, dispensers: {}, furnaces: {} };
  restorePopulation({}, world, survival, { entities: [], create: (type, x, y, z) => ({ type, x, y, z }) });
  const arrows = { list: [] }, thrown = [], mobs = { entities: [], size: () => [0.5, 0.9] }, shots = [];
  const runtime = createRedstoneRuntime({
    world,
    game: {
      dispensers: () => survival.dispensers,
      arrows: () => arrows.list,
      thrown: () => thrown,
      mobs: () => mobs,
      player: () => ({ position: { x: 0, y: -999, z: 0 }, width: 0.6, height: 1.8, alive: true }),
      dispense: { rng: () => new JavaRandom(5), arrow: (e) => shots.push(e) },
    },
  });
  const r = runtime.redstone;
  return { runtime, r, arrows, thrown, mobs, shots, run: (n) => { for (let i = 0; i < n; i++) runtime.tick(); }, meta: (x, y, z) => r.getBlockMetadata(x, y, z) };
}
const SETTLED = [7, 5, 4];
const state = (g) => [g.meta(49, 62, 55), g.meta(53, 62, 55), g.meta(51, 62, 55)];

test("the probe shows the class facts the live entity rules rely on", () => {
  assert.deepEqual(Object.entries(reference.tripwireEntities.ignoresPlates).filter(([, v]) => v).map(([k]) => k), ["bat"]);
  assert.equal(reference.tripwireEntities.tickRandomly[131] && reference.tripwireEntities.tickRandomly[132], true);
  assert.equal(reference.collisionCallers.zc.doBlockCollisions, true, "arrows collide with blocks in flight");
  for (const c of ["zj", "zl", "zm", "zn", "zo", "zg"]) assert.equal(reference.collisionCallers[c].doBlockCollisions || reference.collisionCallers[c].moveEntity, false, c);
});

test("a flying arrow trips a string, a stuck arrow does not, a thrown snowball does not", () => {
  const stuck = jungle();
  stuck.arrows.list.push({ x: 51.5, y: 62.1, z: 55.5, dead: false, inGround: true });
  stuck.run(30);
  assert.deepEqual(state(stuck), SETTLED);
  assert.equal(stuck.shots.length, 0);
  const ball = jungle();
  ball.thrown.push({ x: 51.5, y: 62.05, z: 55.5, dead: false, kind: "snowball" });
  ball.run(30);
  assert.deepEqual(state(ball), SETTLED);
  const flying = jungle();
  flying.arrows.list.push({ x: 51.5, y: 62.1, z: 55.5, dead: false, inGround: false });
  flying.run(30);
  assert.deepEqual([flying.meta(49, 62, 55), flying.meta(53, 62, 55)], [15, 13]);
});

test("a thrown projectile in the box keeps a powered string active; a bat never trips or holds it", () => {
  const g = jungle();
  g.mobs.entities.push({ type: "bat", health: 6, x: 51.5, y: 62, z: 55.5 });
  g.run(30);
  assert.deepEqual(state(g), SETTLED, "a bat is ignored");
  g.arrows.list.push({ x: 51.5, y: 62.1, z: 55.5, dead: false });
  g.run(15);
  assert.deepEqual([g.meta(49, 62, 55), g.meta(53, 62, 55)], [15, 13]);
  g.arrows.list.length = 0;
  g.thrown.push({ x: 51.5, y: 62.05, z: 55.5, dead: false, kind: "snowball" });
  g.run(40);
  assert.deepEqual([g.meta(49, 62, 55), g.meta(53, 62, 55)], [15, 13], "the snowball sustains the scheduled re-sense");
  g.thrown.length = 0;
  g.run(30);
  assert.deepEqual(state(g), SETTLED);
});

test("random ticks run the hook and string updateTick", () => {
  const g = jungle();
  assert.equal(g.runtime.randomTick(49, 62, 55, 113), true);
  assert.equal(g.runtime.randomTick(50, 62, 55, 114), true);
  assert.equal(g.runtime.randomTick(50, 62, 55, 1), false);
  assert.deepEqual(state(g), SETTLED);
});
