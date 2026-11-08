// Batch 28 dimension rules: provider facts under native names, and per-dimension World.rand / updateLCG streams.
// Evidence: public/research/dimension-rules-reference.json (bytecode-read, tools/verify-dimension-rules.mjs) and the unchanged-class providers of
// light-engine3-reference.json (aqo.f, aqo.g, dimensionId and World.getActualHeight run on WorldProviderSurface/Hell/End).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { providerOf, actualHeight, PROVIDERS } from "./dimensions.js";
import { rulesOf, viewRecord, storedRecord, DIM_KEYS } from "./dimension-live.js";
import { DimensionWorld } from "./dimension-world.js";
import { Weather, simulationKey } from "./weather.js";
import { placeContainedLiquid } from "./buckets.js";
import { WATER } from "./world.js";

const rules = JSON.parse(await readFile(new URL("../public/research/dimension-rules-reference.json", import.meta.url)));
const light = JSON.parse(await readFile(new URL("../public/research/light-engine3-reference.json", import.meta.url)));
const classesOf = (k) => [...new Set(rules.readers[k].map((r) => r.class))].sort();

test("reference: aqo.f is read by bucket, ice and dynamic liquid only; aqo.g by the light, weather, map and plant code", () => {
  assert.deepEqual(classesOf("aqo.f"), ["abo", "akr", "alp"]);
  for (const c of ["ahb", "apx", "adh", "akg", "alw", "mw", "ur"]) assert.ok(classesOf("aqo.g").includes(c), c);
  assert.deepEqual(classesOf("World.getActualHeight"), ["aho", "ahp"]);
});

test("PROVIDERS match the unchanged providers: hasNoSky = aqo.g, isHellWorld = aqo.f, actual height 128 where aqo.g", () => {
  const byKind = new Map(light.scenarios.map((s) => [s.provider.dimensionId, s.provider]));
  assert.equal(byKind.size, 3);
  for (const [id, p] of byKind) {
    const mine = providerOf(id);
    assert.equal(mine.hasNoSky, p.g, `hasNoSky ${id}`);
    assert.equal(mine.isHellWorld, p.f, `isHellWorld ${id}`);
    assert.equal(actualHeight(id), p.actualHeight, `actualHeight ${id}`);
  }
  assert.equal(actualHeight(1), 128);
  assert.equal(PROVIDERS[1].lightNoSky, undefined);
});

test("dimension worlds carry the native flags; the End is skyless and 128 tall, only the Nether is hell", () => {
  for (const [dim, noSky, hell, h] of [[-1, true, true, 128], [1, true, false, 128]]) {
    const w = new DimensionWorld("5", dim);
    assert.equal(w.hasNoSky, noSky); assert.equal(w.isHell, hell); assert.equal(w.actualHeight, h); assert.equal(w.height, 256);
  }
});

test("water fizzes only where aqo.f (Nether): the End places water", () => {
  assert.deepEqual([-1, 0, 1].map((d) => rulesOf({ dimension: d }).waterEvaporates), [true, false, false]);
  for (const [w, fizz] of [[{ isHell: true, hasNoSky: true }, true], [{ isHell: false, hasNoSky: true }, false]]) {
    let evap = 0; const placed = [];
    Object.assign(w, { inside: () => true, get: () => 0, solid: () => false, evaporated: () => evap++, set: (...a) => placed.push(a) });
    placeContainedLiquid(w, 0, 1, 0, WATER);
    assert.equal(evap, fizz ? 1 : 0); assert.equal(placed.length, fizz ? 0 : 1);
  }
});

test("reference: World.rand and updateLCG are unseeded per World instance", () => {
  assert.equal(rules.worldRandom.perInstance, true);
  assert.equal(rules.worldRandom.worldServerReseeds, false);
  for (const c of rules.worldRandom.constructors) assert.equal(c.sequence, "new init() nextInt() put k new init() put s get s nextInt(int)");
});

test("Nether and End keep their own random streams; the Overworld's stream is untouched by a visit", () => {
  assert.equal(simulationKey(0), "worldRandom"); assert.equal(simulationKey(-1), "simulation"); assert.equal(simulationKey(1), "simulation");
  assert.ok(DIM_KEYS.includes("simulation"));
  const over = new Weather(); for (let i = 0; i < 7; i++) over.random.nextInt(100);
  const root = { id: "w", dimensions: {}, worldRandom: over.saveSimulation(), player: {} };
  const expectOver = new Weather().restoreSimulation(root.worldRandom);
  // Visit the Nether: its view starts without a stream (fresh), draws, and saves into `simulation`.
  const view = viewRecord(root, -1);
  assert.equal(view.simulation, undefined);
  const nether = new Weather().restoreSimulation(view[simulationKey(-1)]);
  for (let i = 0; i < 50; i++) nether.random.nextInt(1000);
  view[simulationKey(-1)] = nether.saveSimulation();
  const stored = storedRecord(view, root);
  assert.deepEqual(stored.worldRandom, root.worldRandom);
  assert.deepEqual(stored.dimensions[-1].state.simulation, nether.saveSimulation());
  // Back in the Overworld: the stream resumes where it left off; a second Nether visit resumes the Nether's.
  const back = new Weather().restoreSimulation(viewRecord(stored, 0)[simulationKey(0)]);
  assert.equal(back.random.nextInt(1 << 30), expectOver.random.nextInt(1 << 30));
  const again = viewRecord(stored, -1);
  assert.deepEqual(again.simulation, nether.saveSimulation());
  const resumed = new Weather().restoreSimulation(again.simulation);
  assert.equal(resumed.random.nextInt(1 << 30), nether.random.nextInt(1 << 30));
  assert.equal(viewRecord(stored, 0).simulation, undefined);
});
