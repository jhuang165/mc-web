import test from "node:test";
import assert from "node:assert/strict";
import { DimensionWorld } from "./dimension-world.js";
import { dimensionSpawnList } from "./dimension-spawning.js";
import { EntityWorld } from "./entities.js";
import { JavaRandom } from "./java-random.js";
import { lightmap } from "./lighting.js";

test("fortress columns generate their native spawn list, loot and Blaze spawner after regeneration", () => {
  const w = new DimensionWorld("0", -1);
  const sx = -645, sy = 63, sz = -844;
  const first = w.netherChunk(sx >> 4, sz >> 4);
  const chest = w.netherChunk(-664 >> 4, -884 >> 4);
  assert.deepEqual(first.blocks, w.netherChunk(sx >> 4, sz >> 4).blocks);
  assert.equal(chest.blocks[((-664 & 15) * 16 + (-884 & 15)) * 256 + 61], 41);
  assert.equal(w.population.records.get(`${-664 >> 4},${-884 >> 4}`).chests[0].items.length > 0, true);
  const columns = [[sx >> 4, sz >> 4]];
  assert.deepEqual(w.population.claim(columns)[0].records.spawners, [{ x: sx, y: sy, z: sz, entityId: "Blaze" }]);
  w.netherChunk(sx >> 4, sz >> 4);
  assert.deepEqual(w.population.claim(columns), []);
  assert.deepEqual(dimensionSpawnList(w, sx, sy, sz).map(row => row[0]), ["Blaze", "PigZombie", "Skeleton", "LavaSlime"]);
  assert.deepEqual(dimensionSpawnList(w, 0, 64, 0).map(row => row[0]), ["Ghast", "PigZombie", "LavaSlime"]);
});

test("End endermen come from SpawnerAnimals clear of the player and stop at the ticking window's cap", () => {
  const world = {
    dimension: 1, actualHeight: 256, surface: () => 61,
    isTicking: (x, z) => x >= -48 && x < 48 && z >= -48 && z < 48,
    get: (_x, y) => y === 60 ? 152 : 0, getMeta: () => 0, solid: (_x, y) => y === 60,
  };
  const mobs = new EntityWorld(world, [], () => 0.2), player = { x: 0, y: 61, z: 0 };
  mobs.worldRandom = new JavaRandom(13);
  // 36 ticking chunks: the monster cap is 70 * 36 / 256 = 9, checked before each tick's pass.
  for (let i = 0; i < 400; i++) mobs.naturalSpawn(player, { time: 18000 }, false);
  assert.ok(mobs.entities.length >= 10 && mobs.entities.length <= 9 + 4 * 36, String(mobs.entities.length));
  const before = mobs.entities.length;
  mobs.naturalSpawn(player, { time: 18000 }, false);
  assert.equal(mobs.entities.length, before);
  for (const e of mobs.entities) {
    assert.equal(e.type, "enderman");
    assert.equal(e.y, 61);
    assert.ok(world.isTicking(e.x, e.z));
    assert.ok(Math.hypot(e.x, e.z) >= 24);
  }
});

test("End lightmap is independent of sky and starts with the native blue-green ambient blend", () => {
  const end = lightmap(1, 0, 0, undefined, false, 0, 1);
  assert.deepEqual([...end.slice(0, 4)], [61, 76, 68, 255]);
  for (let i = 1; i < 16; i++) assert.deepEqual(end.slice(0, 64), end.slice(i * 64, (i + 1) * 64));
});
