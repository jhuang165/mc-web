import test from "node:test";
import assert from "node:assert/strict";
import { DimensionWorld } from "./dimension-world.js";
import { MapGenNetherBridge, FORTRESS_SPAWN_LIST } from "./fortress.js";
import { fortressDataFile } from "./structure-data.js";
import { restoreImportedFortress } from "./fortress-restore.js";

const b64 = (bytes) => { let s = ""; for (const b of bytes) s += String.fromCharCode(b); return btoa(s); };
const firstHit = (seed) => {
  const m = new MapGenNetherBridge(BigInt(seed));
  for (let x = -64; x < 64; x++) for (let z = -64; z < 64; z++) if (m.canSpawnStructureAtCoords(x, z)) return [x, z];
};

test("an imported Fortress.dat start becomes a live fortress of the Nether world (spawn list inside its pieces)", async () => {
  // A file from another seed: its start sits where seed 17 has none, so only the restore can make that spot a fortress.
  const other = 99, hit = firstHit(other);
  assert.equal(new MapGenNetherBridge(17n).canSpawnStructureAtCoords(...hit), false);
  const file = await fortressDataFile({ record: {}, seed: String(other), generationVersion: 15, chunks: [hit] });
  const record = { structureData: { Fortress: b64(file.bytes) } };
  const world = new DimensionWorld("17", -1);
  const before = world.provider.bridge.structureMap.size;
  assert.equal(await restoreImportedFortress(world, record), file.report.starts);
  assert.equal(world.provider.bridge.structureMap.size, before + file.report.starts);
  assert.equal(world.populator.bridge.structureMap.size, before + file.report.starts);
  assert.notEqual(world.provider.bridge.structureMap.get(hit[0], hit[1]), world.populator.bridge.structureMap.get(hit[0], hit[1]), "separate copies");
  const start = world.provider.bridge.structureMap.get(hit[0], hit[1]), [cx, cy, cz] = start.components[0].getCenter();
  assert.deepEqual(world.fortressSpawns(cx, cy, cz), FORTRESS_SPAWN_LIST);
  // Generating the chunk keeps the imported start (MapGenStructure.generate skips existing keys).
  world.provider.bridge.generate(hit[0], hit[1]);
  assert.equal(world.provider.bridge.structureMap.get(hit[0], hit[1]), start);
  // Nothing to restore for the Overworld, a missing file or a corrupt one.
  assert.equal(await restoreImportedFortress(new DimensionWorld("17", 1), record), 0);
  assert.equal(await restoreImportedFortress(world, {}), 0);
  assert.equal(await restoreImportedFortress(world, { structureData: { Fortress: b64([1, 2, 3]) } }), 0);
});
