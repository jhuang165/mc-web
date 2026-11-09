// Primed TNT of generation (batch 33): population callbacks record a powered TNT (tntPowered, native-neighbor-world.js); the streamed hand-over makes it a
// live EntityTNTPrimed, and an import writes it into the chunk runtime; save, reload and the Anvil export carry it as PrimedTnt with Fuse.
import test from 'node:test';
import assert from 'node:assert/strict';
import { World } from './world.js';
import { PopulationArea, populationBlockMapperReady } from './population-world.js';
import { StreamingPopulation, CELL } from './streaming-population.js';
import { restorePopulationColumns, primedTntEntity, primedTntRecord } from './population-runtime.js';
import { exportJavaSave } from './region-export.js';
import { readRegion, decodeRegionChunk, regionAddress, regionSlot } from './region-file.js';
import { chunkFromNbt } from './chunk-nbt.js';
import { Survival } from './survival.js';
import { TNT_Y_OFFSET } from './explosion.js';

await populationBlockMapperReady;

test('a streamed cell records the powered TNT of its callbacks and the hand-over primes it once with Math.random motion', () => {
  const world = new World('17', 'javaStreamed');
  const pop = world.population;
  // Synthetic population area: no vanilla structure makes powered TNT (the desert temple's TNT sits under an unpressed plate), so the world
  // gets the record the way tntPowered writes it.
  const run = PopulationArea.prototype.run;
  let at = null;
  PopulationArea.prototype.run = function (hooks) {
    const out = run.call(this, hooks);
    const x = (this.chunkX + 2) * 16 + 8.5, z = (this.chunkZ + 3) * 16 + 4.5;
    at = [x, z];
    (this.world.primedTnt ??= []).push({ type: 'PrimedTnt', x, y: 70.5, z, fuse: 80 });
    // outside the cell: not recorded here
    this.world.primedTnt.push({ type: 'PrimedTnt', x: (this.chunkX - 1) * 16 + 0.5, y: 70.5, z, fuse: 80 });
    return out;
  };
  let cell;
  try { cell = pop.generate(3, 2, true); } finally { PopulationArea.prototype.run = run; }
  const ox = pop.originChunkX * 16, oz = pop.originChunkZ * 16;
  const listed = [...cell.records.values()].flatMap((r) => r.primedTnt ?? []);
  assert.deepEqual(listed, [{ x: at[0] - ox, y: 70.5, z: at[1] - oz, fuse: 80 }]);
  const lcx = Math.floor((at[0] - ox) / 16), lcz = Math.floor((at[1] - oz) / 16);
  const records = cell.records.get(`${lcx},${lcz}`);
  assert.equal(records.primedTnt.length, 1);

  const primed = [], none = { chests: {}, dispensers: {} };
  const handed = restorePopulationColumns([{ x: lcx, z: lcz, records }], { world: { get: () => 0 }, survival: { ...none }, mobs: { entities: [] }, spawners: { add() {} }, minecarts: { spawnChest() {} }, fluids: { schedule() {} }, primed });
  assert.equal(handed.primed, 1);
  const [e] = primed;
  assert.equal(e.fuse, 80);
  assert.deepEqual([e.x, e.y, e.z], [at[0] - ox, 70.5 - TNT_Y_OFFSET, at[1] - oz]);
  assert.equal(e.vy, 0.20000000298023224);
  assert.ok(Math.abs(Math.hypot(e.vx, e.vz) - 0.02) < 1e-6, 'heading of length 0.02');
  // With no `primed` list nothing is created (older callers).
  assert.equal(restorePopulationColumns([{ x: lcx, z: lcz, records }], { world: { get: () => 0 }, survival: { ...none }, mobs: { entities: [] }, spawners: { add() {} }, minecarts: { spawnChest() {} }, fluids: { schedule() {} } }).primed, 0);
});

test('the primed TNT motion follows the supplied random and the record form reloads as the same entity', () => {
  const e = primedTntEntity({ x: 10.5, y: 65.5, z: 3.5, fuse: 80 }, () => 0);
  assert.deepEqual([e.vx, e.vz], [-0, Math.fround(-Math.fround(0.02))]); // heading 0: motion (-sin * 0.02, 0.2, -cos * 0.02)
  const rec = primedTntRecord(e);
  assert.deepEqual(rec, { x: 10.5, y: 65.5 - TNT_Y_OFFSET, z: 3.5, vx: e.vx, vy: e.vy, vz: e.vz, fuse: 80 });
  assert.deepEqual(JSON.parse(JSON.stringify(rec)), JSON.parse(JSON.stringify(primedTntRecord(primedTntEntity({ x: rec.x, y: rec.y + TNT_Y_OFFSET, z: rec.z, fuse: rec.fuse }, () => 0)))));
});

test('a generated primed TNT is exported as PrimedTnt with Fuse and Motion', async () => {
  const w = new World('17', 'javaStreamed', 12); w.restore([['-1,100,-1', 1]]);
  const e = primedTntEntity({ x: -0.5, y: 100.5, z: -0.5, fuse: 61 });
  const player = new Survival({}, 'survival').serialize();
  const r = { id: 'export', name: 'Export', seed: '17', biome: 'javaStreamed', generationVersion: 12, mode: 'survival', edits: [...w.edits], player, position: { x: -0.5, y: 102, z: -0.5, yaw: 0, pitch: 0 }, tnt: [primedTntRecord(e)], minecarts: { version: 1, carts: [] }, updated: 1700000000000 };
  const { files, report } = await exportJavaSave(r, { world: w });
  assert.equal(report.unsupportedEntities, 0);
  const cx = -1 + w.originX / 16, cz = -1 + w.originZ / 16, a = regionAddress(cx, cz);
  const c = chunkFromNbt(await decodeRegionChunk(readRegion(files.get(`region/r.${a.regionX}.${a.regionZ}.mca`)).get(regionSlot(a.x, a.z))));
  const t = c.entities.find((n) => n.get('id').value === 'PrimedTnt');
  assert.equal(t.get('Fuse').value, 61);
  assert.equal(t.get('Pos').value.items[1], 100.5);
  assert.deepEqual(t.get('Motion').value.items, [e.vx, e.vy, e.vz]);
});
