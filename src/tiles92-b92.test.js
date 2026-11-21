// Batch 92 tiles92: the single-player random ticks, the sleep checks and the away run read skylightSubtracted as WorldServer.tick left it. Notes: .shared-memory/notes/tiles92-b92-track.md.
//  * WorldServer.tick (mt.b, bytecode-read in b88) calculates skylightSubtracted from the world time BEFORE it adds 1, then ticks random blocks, entities and tile entities.
//  * the away run's clock: plan.time is the END of the trip, so tick n reads the angle at (start + n + 1) / 24000 while the clock moves, (time + 1) / 24000 while it is frozen.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { populationBlockMapperReady } from "./population-world.js";
import { awayEntities } from "./away-entities.js";
import { Weather } from "./weather.js";
import { plain } from "./legacy-ai-replay.js";
import { skylightSubtracted, celestialAngle } from "./lighting.js";

await populationBlockMapperReady;
const src = (f) => readFileSync(new URL(`./${f}`, import.meta.url), "utf8");
const run = (plan, opts = {}) => {
  const tiles = { furnaces: {}, chests: {}, dispensers: {}, brewing: {}, hoppers: {} };
  return awayEntities({ entities: {}, editSequence: 0, idBase: 1, ...plan }, { world: plain([]), weather: new Weather(), tiles, ticking: () => true, entityTicks: () => true,
    rt: { redstone: { collide() {} }, flush() {}, fluidChanges() {} }, fire: { ignite() {} }, readStack: (s) => s, maxStack: () => 64, ...opts });
};
const native = (preStep) => skylightSubtracted(celestialAngle(preStep + 1), 0, 0); // calculateSkylightSubtracted(1.0F) at world time preStep
// a time near dusk where the darkening steps within a few ticks
let step = 0;
for (let t = 11000; t < 14000; t++) if (native(t) !== native(t - 1)) { step = t; break; }

test("the fixture time has a darkness step", () => assert.ok(step > 0));

const sky = (ents) => ents.mobs.lightAt(0, 100, 0); // open sky: 15 less skylightSubtracted

test("away run: tick n reads the darkness of the pre-step time (start + n), not the saved end time", () => {
  const ticks = 8, start = step - 4, ents = run({ time: start + ticks, ticks });
  const seen = [], want = [];
  for (let n = 0; n < ticks; n++) { seen.push(sky(ents)); want.push(Math.max(0, 15 - native(start + n))); ents.tick(); }
  assert.deepEqual(seen, want);
  assert.notEqual(want[0], want[ticks - 1], "the fixture spans a step");
});

test("away run: with doDaylightCycle off the clock stays and every tick reads (time + 1) / 24000", () => {
  const ents = run({ time: step - 1, ticks: 5 }, { cycling: () => false });
  const want = Math.max(0, 15 - native(step - 1));
  for (let n = 0; n < 4; n++) { assert.equal(sky(ents), want); ents.tick(); }
});

test("away run: a /time shift reaches the next tick's read, not the one in progress", () => {
  const ents = run({ time: step + 10, ticks: 10 });
  ents.beginTick(); // b93: away-world.js begins each tick (the darkness is fixed there)
  const before = sky(ents);
  ents.shiftTime(-5000);
  assert.equal(sky(ents), before, "the darkness was calculated before the command block fired");
  ents.tick(); ents.endTick(); ents.beginTick();
  assert.equal(sky(ents), Math.max(0, 15 - native(step + 10 - 10 + 1 - 5000)));
});

test("away run: the first tick of a moving clock starts ticks before the saved end", () => {
  const code = src("away-entities.js");
  assert.match(code, /plan\.time : 0\) - \(cycling\(\) \? plan\.ticks \| 0 : 0\)/);
  assert.match(code, /celestialAngle\(clock, 1\)/); // b93: the tick's begin fixes it (snap)
  assert.match(code, /clock \+= step/);
  assert.match(src("away-world.js"), /light, cycling, runCommand/);
});

test("live game: random ticks, the bed and the sleep click read entitySubtracted", () => {
  const code = src("main.js");
  assert.match(code, /light: \(x, y, z\) => \(scene\.light \? scene\.light\.level\(x, y, z, entitySubtracted\(\)\)/);
  assert.match(code, /farming\.lightLevel=\(x,y,z\)=>scene\.light\?scene\.light\.level\(x,y,z,entitySubtracted\(\)\)/);
  assert.match(code, /wrapRandomTickLight\(world, mobs\.ring, \(\) => entitySubtracted\(\), trees, farming\)/);
  assert.match(code, /daytime: entitySubtracted\(\) < 4,/);
  assert.match(code, /bedSleep\.tick\(world, entitySubtracted\(\) < 4\)/);
  assert.doesNotMatch(code, /scene\.subtracted \?\? 0\) < 4/);
});
