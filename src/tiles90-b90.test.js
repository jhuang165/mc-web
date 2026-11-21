// Batch 90 tiles90: furnace, dispenser and dropper facing in block metadata. Notes: .shared-memory/notes/tiles90-b90-track.md.
//  * BlockDispenser.onBlockAdded (akm.m, bytecode-read) and BlockFurnace.onBlockAdded (ale.e) rewrite the metadata from the opaque neighbours (2-5, default 3).
//  * /setblock lit_furnace keeps a lit block with an empty tile (TileEntityFurnace.updateEntity flips it only when burnTime > 0 changes).
import test from "node:test";
import assert from "node:assert/strict";
import { populationBlockMapperReady } from "./population-world.js";
import { fromOriginal, toOriginal } from "./block-registry.js";
import { World } from "./world.js";
import { Survival } from "./survival.js";
import { createCommandHost } from "./command-host.js";
import { createCommandRunner } from "./commands.js";

await populationBlockMapperReady;
const FURNACE = fromOriginal(61).id, DISPENSER = fromOriginal(23).id, DROPPER = fromOriginal(158).id, STONE = 3;

function host() {
  const world = new World("tiles90", "meadow", 1), survival = new Survival({}, "creative");
  for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++) for (let y = 50; y <= 55; y++) world.set(x, y, z, 0);
  const env = { world: () => world, survival: () => survival, active: () => ({ mode: "creative", allowCommands: true }), position: () => ({ x: 8, y: 52, z: 8 }),
    changed() {}, refreshInventory() {}, stackName: () => "stack", updateBlock() {}, destroyBlock(x, y, z) { world.set(x, y, z, 0); }, spillTile() {}, closeTile() {} };
  const h = createCommandHost(env); h.print = () => {};
  return { world, survival, h, run: (s) => createCommandRunner(h).run(s) };
}

test("/setblock dispenser and dropper: onBlockAdded settles the facing from the opaque sides, whatever metadata the command gave", () => {
  for (const [name, cell] of [["dispenser", DISPENSER], ["dropper", DROPPER]]) {
    const g = host();
    g.world.set(4, 52, 5, STONE); // opaque south -> faces north (2)
    g.run(`/setblock 4 52 4 ${name} 5`);
    assert.equal(g.world.get(4, 52, 4), cell);
    assert.equal(g.world.getMeta(4, 52, 4), 2, `${name}: south wall -> 2, not the command's 5`);
    g.run(`/setblock 8 52 8 ${name} 0`);
    assert.equal(g.world.getMeta(8, 52, 8), 3, `${name}: no wall -> default 3, not 0 (down)`);
    g.run(`/setblock 10 52 10 ${name} 11`); // the trigger bit does not survive either
    assert.equal(g.world.getMeta(10, 52, 10), 3);
  }
});

test("/setblock lit_furnace shows lit with an empty tile; the export and blockAt report the cell's facing", () => {
  const g = host();
  g.run("/setblock 6 52 6 lit_furnace 2");
  const f = g.survival.furnaces["6,52,6"];
  assert.equal(f.burn, 0);
  assert.equal(f.lit, true, "the record keeps the lit block");
  assert.deepEqual(g.h.blockAt(6, 52, 6), { id: 62, meta: 3 });
  g.survival.tickFurnaces();
  assert.equal(g.survival.furnaces["6,52,6"].lit, true, "no flip while burnTime stays 0");
  g.run("/setblock 6 52 6 furnace");
  assert.equal(g.h.blockAt(6, 52, 6).id, 61);
  // export: the cell metadata, not the default 3
  assert.deepEqual(toOriginal(FURNACE, 5, {}), [61, 5]);
  assert.deepEqual(toOriginal(FURNACE, 0, { facing: 4, lit: true }), [62, 4]);
  assert.equal(fromOriginal(62, 2).meta, 2, "import puts the facing in the cell metadata");
});

// ---- SpawnerAnimals reads the previous tick's skylightSubtracted ----
import { DedicatedSimulation } from "./multiplayer/simulation.js";
import { celestialAngle, skylightSubtracted } from "./lighting.js";
import { readFileSync } from "node:fs";

test("server: the spawner's skylightSubtracted is the previous tick's (WorldServer.tick runs SpawnerAnimals before calculateSkylightSubtracted)", () => {
  const world = new World("tiles90-dark");
  for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++) world.put(x, 9, z, 3, 0, false);
  world.spawn = () => ({ x: 8.5, y: 10, z: 8.5 });
  const sim = new DedicatedSimulation({}, { world });
  const at = (t) => skylightSubtracted(celestialAngle(t, 1), 0, 0);
  let t = 0; while (at(t) === at(t + 1)) t++; // a tick where the value steps
  assert.ok(sim.mobs?.mobs?.spawnSubtracted, "the server's EntityWorld has the spawner hook");
  sim.time = t; sim.tick(); // the tick from t leaves the value at t
  assert.equal(sim.spawnDarkness, at(t));
  assert.notEqual(at(t), at(t + 1));
  const mobs = sim.mobs.mobs, tick = sim.mobs.tick.bind(sim.mobs); let during;
  sim.mobs.tick = (...a) => { during = { live: sim.darkness, spawner: mobs.spawnSubtracted(), spawnerLight: mobs.lightSubtracted() }; return tick(...a); };
  sim.tick(); // from t + 1, across the edge
  assert.equal(during.live, at(t + 1), "this tick's own value, which the entities read");
  assert.equal(during.spawner, at(t), "the spawner still has the previous tick's");
  assert.equal(sim.spawnDarkness, at(t + 1));
});

test("single player: main.js hands SpawnerAnimals the pre-step darkness captured before tickSurvival, and the spawner env prefers it", () => {
  const main = readFileSync(new URL("./main.js", import.meta.url), "utf8"), ent = readFileSync(new URL("./entities.js", import.meta.url), "utf8");
  assert.match(main, /spawnSubtracted = sensorSky\(survival\.time[^\n]*\n\s*tickSurvival\(inWater/);
  assert.match(main, /mobs\.spawnLightAt = /);
  assert.match(ent, /this\.spawnLightAt \? this\.spawnLightAt\(x, y, z\)/);
  assert.match(ent, /this\.spawnSubtracted\?\.\(\) \?\? this\.lightSubtracted/);
});
