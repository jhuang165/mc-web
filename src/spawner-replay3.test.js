// Round-3 seeded SpawnerAnimals.findChunksForSpawning replays against public/research/spawn-replay3-reference.json, which
// tools/verify-spawn-replay3.mjs records from the unchanged 1.7.10 classes (tools/probes/SpawnReplay3Probe.java): lit areas (block and
// sky light fixtures, skylightSubtracted 0 / 4 / 11, thunder) so every EntityMob.isValidLightLevel draw (savedSky > nextInt(32), light <=
// nextInt(8)) and the animals' grass + full light > 8 rule is compared in native order, and a Nether over the real MapGenNetherBridge:
// the port generates the same starts (structure and piece boxes must equal the jar's) and picks the fortress list through them.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ENTITY_TYPE_OF, creatureTypeOf } from "./spawn-lists.js";
import { EntityWorld } from "./entities.js";
import { JavaRandom } from "./java-random.js";
import { fromOriginal } from "./block-registry.js";
import { MapGenNetherBridge, fortressMonsterSpawnList } from "./fortress.js";
import { localDifficulty } from "./difficulty.js";
import { NETHER_BRICK } from "./nether-blocks.js";

const ref = JSON.parse(readFileSync(new URL("../public/research/spawn-replay3-reference.json", import.meta.url)));
const f = Math.fround;
const NAME_OF = Object.fromEntries(Object.entries(ENTITY_TYPE_OF).map(([k, v]) => [v, k]));
const internal = new Map();
const idOf = (o) => (o === 0 ? 0 : internal.get(o) ?? internal.set(o, fromOriginal(o).id).get(o));

// The probe's fixtures (SpawnReplay3Probe.sky / blk) and terrains (SpawnReplay2Probe.blockId, SpawnListProbe.blockId).
const skyOf = (r, x, y, z) => { if (r.mode === "nether") return 0; const h = ((x >> 1) * 7 + (z >> 1) * 13 + (y >> 2) * 5) & 15; return h < 5 ? 0 : h < 10 ? h : 15; };
const blkOf = (x, y, z) => ((x >> 2) * 3 + (z >> 2) * 5 + (y >> 3) * 2 + ((x ^ z) >> 4)) & 15;
const surface = (x, z) => 64 + (((x >> 3) + (z >> 3)) & 3);
const pond = (x, z) => (((x >> 4) + 2 * (z >> 4)) % 5 + 5) % 5 === 0 && (x & 15) >= 4 && (x & 15) <= 11 && (z & 15) >= 4 && (z & 15) <= 11;
const inBox = (r, x, z) => r.starts.some((s) => x >= s.bb[0] && x <= s.bb[3] && z >= s.bb[2] && z <= s.bb[5]);
const netherFloor = (r, x, z) => (inBox(r, x, z) ? 62 + (((x >> 3) + (z >> 3)) & 3) : 32 + (((x >> 3) + (z >> 3)) & 3));
function originalId(r, x, y, z) {
  if (y < 0 || y > 255) return 0;
  if (r.mode === "nether") {
    const s = netherFloor(r, x, z);
    if (y >= 120 && y < 128) return 87;
    if (y < s - 1) return 87;
    return y === s - 1 ? (inBox(r, x, z) ? 112 : 87) : 0;
  }
  if (pond(x, z)) return y < 50 ? 1 : y < 62 ? 9 : 0;
  if (r.caves && y >= 30 && y < 36 && (((x >> 4) + (z >> 4)) & 1) === 0) return 0;
  const s = surface(x, z);
  return y < s - 1 ? 1 : y === s - 1 ? 2 : 0;
}
function makeWorld(r) {
  const tops = new Map();
  const nether = r.mode === "nether";
  const bridge = nether ? new MapGenNetherBridge(99) : null;
  if (nether) {
    const pcx = Math.floor(r.player[0] / 16), pcz = Math.floor(r.player[2] / 16);
    for (let cx = pcx - 8; cx <= pcx + 8; cx++) for (let cz = pcz - 8; cz <= pcz + 8; cz++) bridge.generate(cx, cz);
  }
  const world = {
    height: 256, numericSeed: 1, javaSeed: 99, ...(nether ? { dimension: -1, actualHeight: 128 } : {}), bridge,
    get: (x, y, z) => idOf(originalId(r, x, y, z)), getMeta: () => 0,
    solid: (x, y, z) => originalId(r, x, y, z) !== 0 && originalId(r, x, y, z) !== 9,
    biomeAt: (x, z) => ({ id: !nether ? r.biomes[(((x >> 4) * 7 + (z >> 4) * 3) % 8 + 8) % 8] : 8 }),
    chunkTop: (cx, cz) => {
      const key = `${cx},${cz}`;
      if (tops.has(key)) return tops.get(key);
      let top = 0;
      for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++) for (let y = 255; y >= 0; y--) if (originalId(r, cx * 16 + x, y, cz * 16 + z)) { top = Math.max(top, y); break; }
      tops.set(key, (top >> 4) << 4);
      return tops.get(key);
    },
  };
  if (nether) world.fortressSpawns = (x, y, z) => fortressMonsterSpawnList(bridge, (bx, by, bz) => (originalId(r, bx, by, bz) === 112 ? NETHER_BRICK : 0), x, y, z);
  return world;
}
function extras(e) {
  let s = "";
  if (e.type === "slime" || e.type === "magma_cube") s = `size:${e.size}`;
  if (e.type === "horse") s = "horse";
  if (e.type === "skeleton" || e.type === "wither_skeleton") s = e.ridingEntity ? "skeleton-jockey" : `skeleton:${e.type === "wither_skeleton" ? 1 : 0}`;
  if (e.type === "sheep") s = `fleece:${e.color}`;
  if (e.type === "zombie" || e.type === "pigman") s = `child:${e.growingAge < 0},villager:${!!e.villager}`;
  if (creatureTypeOf(e.type) === "creature" && e.type !== "horse") s += `${s ? "," : ""}age:${e.growingAge ?? 0}`;
  if (e.ridingEntity) s += `,riding:${NAME_OF[e.ridingEntity.type]}`;
  return s;
}
const gearOf = (e) => [0, 1, 2, 3, 4].map((i) => { const s = e.equipment?.[i]; return s ? `${s.id}:${s.damage ?? 0}` : "-"; }).join("/");

for (const r of ref.replays) {
  test(`lit/fortress findChunksForSpawning replay "${r.name}" (${r.steps.length} ticks) spawns as the jar`, () => {
    const world = makeWorld(r);
    const mobs = new EntityWorld(world, []);
    mobs.worldRandom = new JavaRandom(r.seed);
    mobs.entitySeed = (rand) => rand.seed;
    mobs.difficulty = r.hostile ? 2 : 0;
    // World.func_147462_b over a never-inhabited chunk at NORMAL: the moon phase term of the real WorldInfo day time.
    mobs.localDifficulty = () => localDifficulty(2, r.dayTime, 0, true);
    mobs.currentDate = () => new Date(2014, 9, 31);
    // World.getBlockLightValue (skylightSubtracted r.sub), the thunder variant (10), getFullBlockLightValue and the saved sky value.
    const blk = r.mode === "nether" ? (x, y, z) => blkOf(x, y, z) : null;
    mobs.lightAt = (x, y, z) => Math.max(blkOf(x, y, z), skyOf(r, x, y, z) - r.sub);
    mobs.thunderLightAt = (x, y, z) => Math.max(blkOf(x, y, z), skyOf(r, x, y, z) - 10);
    mobs.fullLightAt = (x, y, z) => Math.max(blkOf(x, y, z), skyOf(r, x, y, z));
    mobs.skyLightAt = (x, y, z) => skyOf(r, x, y, z);
    mobs.dimensionBlockLight = blk ?? (() => 0);
    mobs.isThundering = () => r.thunder;
    mobs.spawnPoint = () => ({ x: r.spawn[0], y: r.spawn[1], z: r.spawn[2] });
    const player = { x: r.player[0], y: r.player[1], z: r.player[2] };
    let spawns = 0;
    const tally = {};
    for (let tick = 0; tick < r.steps.length; tick++) {
      const step = r.steps[tick];
      if (tick % r.clearEvery === 0) mobs.entities.length = 0;
      const before = mobs.entities.length;
      const total = mobs.naturalSpawn(player, { time: r.dayTime }, tick % r.animalsEvery === 0);
      const got = mobs.entities.slice(before);
      if (got.length !== step.spawned.length && process.env.DBG) console.log(tick, got.map((e) => [e.type, e.x, e.y, e.z].join()), step.spawned.map((e) => e.slice(0, 4).join()));
      assert.equal(got.length, step.spawned.length, `tick ${tick} count`);
      step.spawned.forEach(([name, x, y, z, yaw, ex], i) => {
        const e = got[i], at = `tick ${tick} #${i} ${name}`;
        assert.equal(e.type === "wither_skeleton" ? "Skeleton" : NAME_OF[e.type], name, at);
        assert.deepEqual([e.x, e.y, e.z, f(e.rotationYaw)], [x, y, z, f(yaw)], at);
        tally[name] = (tally[name] ?? 0) + 1;
        if (e.type === "horse") {
          const h = Object.fromEntries(ex.split(",").map((kv) => kv.split(":")));
          const want = { type: +h.type, variant: +h.variant, age: +h.age, tame: h.tame === "true", temper: +h.temper };
          assert.deepEqual({ type: e.horse.type, variant: e.horse.variant, age: e.growingAge, tame: e.horse.tame, temper: e.horse.temper }, want, at);
          for (const [got1, want1] of [[e.health, h.health], [e.horse.maxHealth, h.maxHealth], [e.horse.speed, h.speed], [e.horse.jump, h.jump]]) assert.ok(Math.abs(got1 - Number(want1)) < 1e-6, `${at} ${got1} ${want1}`);
        } else if (e.type === "skeleton" || e.type === "wither_skeleton" || e.type === "zombie" || e.type === "pigman") {
          const [head, gear] = ex.split(",gear:");
          assert.equal(extras(e).split(",riding")[0], head.split(",riding")[0], at);
          if (gear && !e.ridingEntity) assert.equal(gearOf(e), gear, `${at} gear`);
        } else assert.equal(extras(e), ex, at);
        spawns++;
      });
      assert.equal(total, step.total, `tick ${tick} total`);
      assert.equal(String(mobs.worldRandom.seed), step.seed, `tick ${tick} World.rand`);
    }
    assert.ok(spawns > 500, String(spawns));
    if (r.mode === "nether") {
      assert.ok(tally.Ghast >= 3 && tally.Blaze >= 3 && tally.Skeleton >= 3 && tally.LavaSlime >= 3, JSON.stringify(tally));
    } else if (r.hostile) {
      for (const n of ["Zombie", "Skeleton", "Creeper", "Spider", "Enderman", "Witch"]) assert.ok(tally[n] > 0 || (n === "Witch" || n === "Enderman"), `${n} ${JSON.stringify(tally)}`);
    }
  });
}

test("the port's MapGenNetherBridge builds the jar's fortress starts and piece boxes", () => {
  for (const r of ref.replays.filter((x) => x.mode === "nether")) {
    const bridge = makeWorld(r).bridge;
    const starts = [...bridge.structureMap.values()].map((s) => ({ chunk: [s.chunkX, s.chunkZ], bb: s.boundingBox.toArray(), pieces: s.components.map((c) => c.describe()) }));
    assert.equal(starts.length, r.starts.length);
    assert.deepEqual(starts, r.starts.map((s) => ({ chunk: s.chunk, bb: s.bb, pieces: s.pieces })));
  }
});

test("natural-spawn ocelot kittens ignore the 40-entity limit; a spawn egg keeps it", () => {
  const make = () => {
    const mobs = new EntityWorld({ height: 256, get: () => 0, getMeta: () => 0, solid: () => false, biomeAt: () => ({ id: 21 }) }, []);
    mobs.worldRandom = new JavaRandom(1);
    for (let i = 0; i < 45; i++) mobs.entities.push({ type: "pig", x: 0, y: 0, z: 0, persistent: true });
    return mobs;
  };
  for (const [limit, expect] of [[Infinity, true], [undefined, false]]) {
    let litters = 0;
    for (let seed = 0; seed < 200; seed++) {
      const mobs = make();
      mobs.worldRandom = new JavaRandom(seed);
      const e = mobs.create("ocelot", 0.5, 64, 0.5);
      const before = mobs.entities.length;
      mobs.onSpawnWithEgg(e, { limit });
      if (mobs.entities.length > before) { litters++; assert.equal(mobs.entities.length - before, 2); }
    }
    assert.equal(litters > 0, expect, String(limit));
  }
});
