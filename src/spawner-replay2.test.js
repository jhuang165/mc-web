// Seeded SpawnerAnimals.findChunksForSpawning replays of slimes (swamp and slime chunk rules, size rolls), ocelots, horses (group data, foals,
// variants), the Nether (pigmen, ghasts, the fortress list) and the End against public/research/spawn-replay2-reference.json, which
// tools/verify-spawn-replay2.mjs records from the unchanged 1.7.10 classes (tools/probes/SpawnReplay2Probe.java). The probe seeds Entity.rand
// from World.rand's state inside setLocationAndAngles (and repeats the slimes' constructor draws); the port does the same through
// `EntityWorld.entitySeed` (naturalSpawn's ctx.create), so every roll on either Random is replayed in native order.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ENTITY_TYPE_OF, creatureTypeOf, FORTRESS_MONSTERS } from "./spawn-lists.js";
import { EntityWorld } from "./entities.js";
import { JavaRandom } from "./java-random.js";
import { fromOriginal } from "./block-registry.js";

const ref = JSON.parse(readFileSync(new URL("../public/research/spawn-replay2-reference.json", import.meta.url)));
const f = Math.fround;
const NAME_OF = Object.fromEntries(Object.entries(ENTITY_TYPE_OF).map(([k, v]) => [v, k]));
const internal = new Map();
const idOf = (o) => (o === 0 ? 0 : internal.get(o) ?? internal.set(o, fromOriginal(o).id).get(o));

// The probe's terrains (SpawnReplay2Probe.blockId, SpawnListProbe.blockId).
const surface = (x, z) => 64 + (((x >> 3) + (z >> 3)) & 3);
const pond = (x, z) => (((x >> 4) + 2 * (z >> 4)) % 5 + 5) % 5 === 0 && (x & 15) >= 4 && (x & 15) <= 11 && (z & 15) >= 4 && (z & 15) <= 11;
const fortressChunk = (x, z) => (((x >> 4) + 2 * (z >> 4)) % 3 + 3) % 3 === 0;
function originalId(r, x, y, z) {
  if (y < 0 || y > 255) return 0;
  if (r.mode === "nether") {
    const s = 32 + (((x >> 3) + (z >> 3)) & 3);
    if (y >= 120 && y < 128) return 87;
    if (y < s - 1) return 87;
    return y === s - 1 ? (fortressChunk(x, z) ? 112 : 87) : 0;
  }
  if (r.mode === "end") return y < 60 + (((x >> 3) + (z >> 3)) & 3) ? 121 : 0;
  if (pond(x, z)) return y < 50 ? 1 : y < 62 ? 9 : 0;
  if (r.caves && y >= 30 && y < 36 && (((x >> 4) + (z >> 4)) & 1) === 0) return 0;
  const s = surface(x, z);
  return y < s - 1 ? 1 : y === s - 1 ? 2 : 0;
}
function makeWorld(r) {
  const tops = new Map();
  const dimension = r.mode === "nether" ? -1 : r.mode === "end" ? 1 : undefined;
  const world = {
    height: 256, numericSeed: 1, javaSeed: 99, ...(dimension ? { dimension, actualHeight: 128 } : {}),
    get: (x, y, z) => idOf(originalId(r, x, y, z)), getMeta: () => 0,
    solid: (x, y, z) => originalId(r, x, y, z) !== 0 && originalId(r, x, y, z) !== 9,
    biomeAt: (x, z) => ({ id: r.mode === "overworld" ? r.biomes[(((x >> 4) * 7 + (z >> 4) * 3) % 8 + 8) % 8] : r.mode === "nether" ? 8 : 9 }),
    chunkTop: (cx, cz) => {
      const key = `${cx},${cz}`;
      if (tops.has(key)) return tops.get(key);
      let top = 0;
      for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++) for (let y = 255; y >= 0; y--) if (originalId(r, cx * 16 + x, y, cz * 16 + z)) { top = Math.max(top, y); break; }
      tops.set(key, (top >> 4) << 4);
      return tops.get(key);
    },
  };
  if (r.mode === "nether") world.fortressSpawns = (x, y, z) => (fortressChunk(x, z) && y >= 30 && y <= 60 ? FORTRESS_MONSTERS : null);
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
  test(`seeded findChunksForSpawning replay "${r.name}" (${r.steps.length} ticks) spawns as the jar`, () => {
    const mobs = new EntityWorld(makeWorld(r), []);
    mobs.worldRandom = new JavaRandom(r.seed);
    mobs.entitySeed = (rand) => rand.seed;
    mobs.difficulty = r.hostile ? 2 : 0;
    mobs.localDifficulty = () => 0;
    mobs.currentDate = () => new Date(2014, 9, 31);
    mobs.lightAt = r.lit ? (x, y) => (y >= 40 ? ((x >> 2) * 3 + (Math.floor(mobs._lz ?? 0) >> 2) * 5) & 7 : 0) : () => 0;
    mobs.skyLightAt = () => 0; mobs.thunderLightAt = () => 0; mobs.fullLightAt = () => 15; mobs.isThundering = () => false;
    mobs.dimensionBlockLight = () => 0;
    mobs.spawnPoint = () => ({ x: r.spawn[0], y: r.spawn[1], z: r.spawn[2] });
    if (r.lit) mobs.lightAt = (x, y, z) => (y >= 40 ? ((x >> 2) * 3 + (z >> 2) * 5) & 7 : 0);
    if (r.slimeOnly || r.ocelotOnly) {
      // The probe's synthetic lists; the world-random pick over one entry still draws nextInt(1).
      const ctx = (mobs._spawner ??= mobs.spawnerState()).ctx, real = ctx.possibleCreatures;
      ctx.possibleCreatures = (type, x, y, z) => (r.slimeOnly && type.name === "monster" ? [["Slime", 1, 4, 4]] : r.ocelotOnly && type.name === "creature" ? [["Ozelot", 2, 1, 1]] : real(type, x, y, z));
    }
    const player = { x: r.player[0], y: r.player[1], z: r.player[2] };
    let spawns = 0;
    for (let tick = 0; tick < r.steps.length; tick++) {
      const step = r.steps[tick];
      if (r.clearEvery && tick % r.clearEvery === 0) mobs.entities.length = 0;
      const before = mobs.entities.length;
      const total = mobs.naturalSpawn(player, { time: r.dayTime }, tick % r.animalsEvery === 0);
      const got = mobs.entities.slice(before);
      assert.equal(got.length, step.spawned.length, `tick ${tick} count`);
      step.spawned.forEach(([name, x, y, z, yaw, ex], i) => {
        const e = got[i], at = `tick ${tick} #${i} ${name}`;
        assert.equal(e.type === "wither_skeleton" ? "Skeleton" : NAME_OF[e.type], name, at);
        assert.deepEqual([e.x, e.y, e.z, f(e.rotationYaw)], [x, y, z, f(yaw)], at);
        if (e.type === "horse") {
          const h = Object.fromEntries(ex.split(",").map((kv) => kv.split(":")));
          const want = { type: +h.type, variant: +h.variant, age: +h.age, tame: h.tame === "true", temper: +h.temper };
          assert.deepEqual({ type: e.horse.type, variant: e.horse.variant, age: e.growingAge, tame: e.horse.tame, temper: e.horse.temper }, want, at);
          for (const [got1, want1] of [[e.health, h.health], [e.horse.maxHealth, h.maxHealth], [e.horse.speed, h.speed], [e.horse.jump, h.jump]]) assert.ok(Math.abs(got1 - Number(want1)) < 1e-6, `${at} ${got1} ${want1}`);
        } else if (e.type === "skeleton" || e.type === "wither_skeleton") {
          const [head, gear] = ex.split(",gear:");
          assert.equal(extras(e).split(",riding")[0], head.split(",riding")[0], at);
          if (gear) assert.equal(gearOf(e), gear, `${at} gear`);
        } else assert.equal(extras(e), ex, at);
        spawns++;
      });
      assert.equal(total, step.total, `tick ${tick} total`);
      assert.equal(String(mobs.worldRandom.seed), step.seed, `tick ${tick} World.rand`);
    }
    assert.ok(spawns > 50, String(spawns));
  });
}
