// Natural spawning and spawners in the away run (batch 34): nothing spawns with no player in the Overworld.
//
// Native evidence, bytecode-read with javap on the 1.7.10 jar (not executed):
//   - WorldServer.tick (mt.b) calls SpawnerAnimals.findChunksForSpawning (aho.a(mt, boolean, boolean, boolean)) every tick. That method clears its
//     eligible-chunk HashMap and refills it only from `mt.h`, the world's own player list, so with the only player in the Nether or End the map is
//     empty and zero mobs spawn. (performWorldGenSpawning aho.a(ahb, ...) runs only when a chunk is populated; the away run generates no chunks.)
//   - MobSpawnerBaseLogic.updateSpawner (agq.g) starts with `if (!this.f()) return;`, and agq.f is World.getClosestPlayer(x+.5, y+.5, z+.5, range)
//     != null (ahb.a(DDDD)), which loops the world's own player list `ahb.h`. The spawner block (TileEntityMobSpawner) and the spawner minecart
//     (EntityMinecartMobSpawner) both call it, so neither spawns while away.
//   - Village sieges (wc.a) and random block ticks (ahb.g's active-chunk set) also come from `h`; none of it runs either.
// Nothing in WorldServer.tick spawns without a player, so there is nothing to port. This test pins that.
import { test } from "node:test";
import assert from "node:assert/strict";
import { populationBlockMapperReady } from "./population-world.js";
import { runAway, stateColumns, awayPlan } from "./away-world.js";
import { isActivated, SPAWNER_DEFAULTS } from "./mob-spawner.js";

await populationBlockMapperReady;
const STONE = 3, RAIL = 66;
const floorChunks = (cols) => cols.map(([x, z]) => {
  const blocks = new Uint8Array(65536), meta = new Uint8Array(65536);
  for (let lx = 0; lx < 16; lx++) for (let lz = 0; lz < 16; lz++) for (let y = 0; y <= 10; y++) blocks[(lx * 16 + lz) * 256 + y] = STONE;
  return { x, z, blocks, meta };
});
const base = { seed: "away", biome: "javaStreamed", worldType: "flat", worldSpawn: [0, 64, 0], player: { time: 18000 } };
const run = (root, ticks) => {
  const cols = stateColumns(root), plan = { ...awayPlan(root, cols, ticks, 3), chunks: floorChunks(cols), records: [] };
  return runAway(plan);
};
const total = (r) => Object.values(r.entities.counts).reduce((a, b) => a + b, 0);

test("a spawner is inactive with no player in its world: isActivated reads only the players it is given", () => {
  const s = { ...SPAWNER_DEFAULTS, x: 8, y: 20, z: 8 };
  assert.equal(isActivated(s, []), false);
  assert.equal(isActivated(s, [{ x: 8.5, y: 20.5, z: 8.5 }]), true);
});

test("a spawner minecart in a dark pit at night spawns nothing in 1200 ticks, and nothing after the gate", async () => {
  const cart = { id: 1, type: 4, x: 5.5, y: 11.05, z: 5.5, motion: [0, 0, 0], rotation: [0, 0], fallDistance: 0, fire: 0, onGround: true, items: [], spawner: { EntityId: "Zombie", Delay: 0, MinSpawnDelay: 1, MaxSpawnDelay: 2, SpawnCount: 4, MaxNearbyEntities: 6, RequiredPlayerRange: 16, SpawnRange: 4 } };
  for (const ticks of [1300, 3000]) {
    const r = await run({ ...base, minecarts: { version: 1, carts: [cart] } }, ticks);
    assert.equal(r.entities.minecarts.carts.length, 1, "the cart is still there");
    assert.equal(r.entities.mobs.length, 0, `${ticks} ticks: no mob`);
    assert.equal(total(r) - r.entities.counts.carts, 0, "no entity of any kind appeared");
  }
});

test("natural spawning does not run: an empty dark night world stays empty for 1200 ticks on Hard", async () => {
  const r = await run({ ...base, redstone: { version: 1, clock: 0, time: 0, pending: [[3, 11, 3, 75, 1, 0, 1]], events: [] } }, 1300);
  assert.equal(r.entities.mobs.length, 0);
  assert.equal(r.stats.entities.mobs, 0);
});
