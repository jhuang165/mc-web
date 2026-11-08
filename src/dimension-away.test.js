// Batch 29 dimrules2: the Overworld's weather timers keep running while the player is in the Nether/End (MinecraftServer ticks every
// WorldServer), and the Nether/End `simulation` stream survives world import.
import { test } from "node:test";
import assert from "node:assert/strict";
import { Weather, simulationKey } from "./weather.js";
import { JavaRandom } from "./java-random.js";
import { importedRuntime, importedDimensionState } from "./world-import.js";
import { DIM_KEYS } from "./dimension-live.js";

const world = { streaming: false, dimension: -1, isLoaded: () => false, get: () => 0, getMeta: () => 0, height: 128 };
const quiet = (w) => { w.tickChunks = () => {}; return w; }; // the chunk loop is not under test
const stream = (seed) => new Weather({ random: new JavaRandom(seed), lcg: 9 }).saveSimulation();

test("away Overworld timers advance exactly as updateWeather would on the Overworld", () => {
  const root = { weather: { rainTime: 100, thunderTime: 50, raining: false, thundering: false }, worldRandom: stream(7) };
  const nether = quiet(new Weather({ random: new JavaRandom(1), lcg: 3 }).restore(root.weather).awayOverworld(root));
  const reference = new Weather().restore(root.weather).restoreSimulation(root.worldRandom);
  for (let t = 0; t < 400; t++) { nether.tickDimension(world, { x: 0, z: 0 }); reference.updateWeather(); }
  assert.deepEqual(nether.saveWeather(), { ...reference.save(), rain: reference.rain, thunder: reference.thunder });
  assert.deepEqual(nether.saveOverworldSimulation(), reference.saveSimulation());
  assert.equal(nether.thundering, false); // the Nether's own copy is untouched
  assert.equal(nether.rainTime, 100);
  assert.equal(reference.thundering, true); // the thunder timer ran out at tick 50 (and the rain timer at 100)
  assert.equal(reference.raining, true);
});

test("a saved away strength resumes mid-fade, an ordinary save keeps the four native fields", () => {
  const w = new Weather();
  assert.deepEqual(Object.keys(w.saveWeather()), ["rainTime", "thunderTime", "raining", "thundering"]);
  const away = quiet(new Weather()).awayOverworld({ weather: { rainTime: 1, thunderTime: 5000, raining: false, thundering: false } });
  for (let i = 0; i < 20; i++) away.tickDimension(world, null); // the one-tick rain timer expires at once; the strength then ramps 0.01 per tick
  const saved = away.saveWeather();
  assert.equal(saved.raining, true);
  assert.ok(saved.rain > 0.15 && saved.rain < 0.25, String(saved.rain));
  assert.equal(new Weather().restore(saved).rain, saved.rain); // not restarted at full strength
  assert.equal(new Weather().restore({ rainTime: 0, thunderTime: 0, raining: true, thundering: false, rain: 7 }).rain, 1); // out-of-range ignored
});

test("world import keeps a valid simulation stream and drops a malformed one", () => {
  assert.ok(DIM_KEYS.includes("simulation"));
  assert.equal(simulationKey(-1), "simulation");
  const good = JSON.parse(JSON.stringify(stream(11)));
  assert.deepEqual(importedRuntime({ simulation: good, worldRandom: good }), { simulation: good, worldRandom: good });
  assert.deepEqual(importedRuntime({ simulation: { version: 1, random: { seed: "x" }, lcg: 1 }, worldRandom: "no" }), {});
  const blob = { state: { simulation: good, entities: [] }, tiles: {} };
  assert.deepEqual(importedDimensionState(blob), blob);
  assert.deepEqual(importedDimensionState({ state: { simulation: { bad: 1 }, entities: [] } }), { state: { entities: [] } });
  assert.deepEqual(importedDimensionState({ state: { entities: [] } }), { state: { entities: [] } });
});
