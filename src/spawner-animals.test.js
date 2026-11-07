// SpawnerAnimals (spawner-animals.js, entities.js naturalSpawn) against public/research/spawn-lists-reference.json, which
// tools/verify-spawn-lists.mjs records from the unchanged 1.7.10 classes (tools/probes/SpawnListProbe.java).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CREATURE_TYPES, BIOME_SLOTS, spawnList, FORTRESS_MONSTERS, WITCH_HUT_MONSTERS, ENTITY_TYPE_OF, maxSpawnedInChunk, creatureTypeOf } from "./spawn-lists.js";
import { CREATURES as POPULATION_CREATURES, SPAWN_CHANCE } from "./population-tail.js";
import { chunkPairHash, eligibleChunkOrder, canCreatureTypeSpawnAtLocation, findChunksForSpawning } from "./spawner-animals.js";
import { EntityWorld } from "./entities.js";
import { JavaRandom } from "./java-random.js";
import { fromOriginal } from "./block-registry.js";
import { World, normalCube, isLiquid } from "./world.js";
import { setGameRuleSource } from "./game-rules.js";

const ref = JSON.parse(readFileSync(new URL("../public/research/spawn-lists-reference.json", import.meta.url)));
const f = Math.fround;

test("EnumCreatureType caps, materials and flags match the jar", () => {
  assert.deepEqual(CREATURE_TYPES.map(({ name, max, material, peaceful, animal }) => ({ name, max, material, peaceful, animal })),
    ref.types.map(({ name, max, material, peaceful, animal }) => ({ name, max, material, peaceful, animal })));
  assert.deepEqual(CREATURE_TYPES.map((t) => t.max), [70, 10, 15, 5]);
});

test("every biome's four spawn lists match BiomeGenBase.getSpawnableList", () => {
  assert.equal(ref.biomes.length, 61);
  assert.deepEqual(BIOME_SLOTS, ref.biomes.map((b) => b.index));
  for (const b of ref.biomes) {
    for (const t of CREATURE_TYPES) assert.deepEqual(spawnList(b.index, t.name), b[t.name], `${b.index} ${b.name} ${t.name}`);
    // performWorldGenSpawning reads the same creature list and getSpawningChance.
    if (b.index !== 8 && b.index !== 9) assert.deepEqual(POPULATION_CREATURES.get(b.index), b.creature, `population ${b.index}`);
    assert.equal(f(b.chance), SPAWN_CHANCE);
  }
  assert.equal(spawnList(41, "monster"), null);
  assert.deepEqual(FORTRESS_MONSTERS, ref.structures.fortress);
  assert.deepEqual(WITCH_HUT_MONSTERS, ref.structures.witchHut);
});

test("getMaxSpawnedInChunk and the creature type each listed mob counts as", () => {
  const byName = new Map(ref.entities.map((e) => [e.name, e]));
  const listed = new Set([...ref.biomes.flatMap((b) => CREATURE_TYPES.flatMap((t) => b[t.name].map((e) => e[0]))), ...ref.structures.fortress.map((e) => e[0]), "Witch"]);
  for (const name of listed) {
    const e = byName.get(name);
    assert.ok(ENTITY_TYPE_OF[name], name);
    assert.equal(maxSpawnedInChunk(name), e.maxInChunk, name);
    assert.deepEqual([creatureTypeOf(ENTITY_TYPE_OF[name])].filter(Boolean), e.counts, name);
  }
  // Mobs the lists never name still count for World.countEntities.
  for (const [name, type] of [["CaveSpider", "cave_spider"], ["Silverfish", "silverfish"], ["SnowMan", "snow_golem"], ["VillagerGolem", "iron_golem"], ["Villager", "villager"], ["Giant", "giant"]])
    assert.deepEqual([creatureTypeOf(type)].filter(Boolean), byName.get(name).counts, name);
});

test("the eligible-chunk HashMap iterates in java.util.HashMap order", () => {
  for (const o of ref.order) {
    const keys = eligibleChunkOrder(o.player[0], o.player[1]).map(([dx, dz, edge]) => [dx + o.player[0], dz + o.player[1], edge ? 1 : 0]);
    assert.deepEqual(keys, o.keys, String(o.player));
    // 289 chunks, the 64 of the outer ring do not spawn.
    assert.equal(keys.filter((k) => k[2]).length, 64);
  }
  assert.equal(chunkPairHash(0, 0), (1013904223 ^ ((Math.imul(1664525, -559038737) + 1013904223) | 0)));
});

// SpawnListProbe's WorldServer double: stone with a grass top at y 63..66 per 8-block cell, ponds of water y 50..61.
const PROBE_BIOMES = [4, 27, 21, 5, 2, 14, 3, 12];
const probeBiome = (cx, cz, biomes = PROBE_BIOMES) => biomes[(((cx * 7 + cz * 3) % 8) + 8) % 8];
const surface = (x, z) => 64 + (((x >> 3) + (z >> 3)) & 3);
const pond = (x, z) => (((x >> 4) + 2 * (z >> 4)) % 5 + 5) % 5 === 0 && (x & 15) >= 4 && (x & 15) <= 11 && (z & 15) >= 4 && (z & 15) <= 11;
function originalId(x, y, z, caves = false) {
  if (y < 0 || y > 255) return 0;
  if (pond(x, z)) return y < 50 ? 1 : y < 62 ? 9 : 0;
  if (caves && y >= 30 && y < 36 && (((x >> 4) + (z >> 4)) & 1) === 0) return 0; // the wet-caves replay's air pockets
  const s = surface(x, z);
  return y < s - 1 ? 1 : y === s - 1 ? 2 : 0;
}
const internal = { 0: 0, 1: fromOriginal(1).id, 2: fromOriginal(2).id, 9: fromOriginal(9).id };
const makeProbeWorld = (biomes = PROBE_BIOMES, caves = false) => ({
  height: 256, numericSeed: 1,
  get: (x, y, z) => internal[originalId(x, y, z, caves)],
  getMeta: () => 0,
  solid: (x, y, z) => { const id = originalId(x, y, z, caves); return id === 1 || id === 2; },
  biomeAt: (x, z) => ({ id: probeBiome(x >> 4, z >> 4, biomes) }),
  // Chunk.getTopFilledSegment: the probe fills every storage up to the highest block's.
  chunkTop: (cx, cz) => {
    let top = 0;
    for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++) for (let y = 255; y >= 0; y--) if (originalId(cx * 16 + x, y, cz * 16 + z, caves)) { top = Math.max(top, y); break; }
    return (top >> 4) << 4;
  },
});
const probeWorld = makeProbeWorld();

test("canCreatureTypeSpawnAtLocation matches the native columns", () => {
  const w = { block: probeWorld.get, normalCube, liquid: isLiquid, bedrock: 11, solidTop: (x, y, z) => normalCube(probeWorld.get(x, y, z)) };
  for (const col of ref.location)
    for (const t of CREATURE_TYPES) {
      let s = "";
      for (let y = 46; y <= 70; y++) s += canCreatureTypeSpawnAtLocation(t, w, col.x, y, col.z) ? "1" : "0";
      assert.equal(s, col[t.name], `${col.x},${col.z} ${t.name}`);
    }
});

function probeMobs(seed, spawn, world = probeWorld) {
  const mobs = new EntityWorld(world, []);
  mobs.worldRandom = new JavaRandom(seed);
  mobs.difficulty = 2;
  mobs.localDifficulty = () => 0;
  mobs.currentDate = () => new Date(2014, 9, 31);
  mobs.lightAt = () => 0;
  mobs.skyLightAt = () => 0;
  mobs.thunderLightAt = () => 0;
  mobs.fullLightAt = () => 15;
  mobs.isThundering = () => false;
  mobs.spawnPoint = () => ({ x: spawn[0], y: spawn[1], z: spawn[2] });
  return mobs;
}
const NAME_OF = Object.fromEntries(Object.entries(ENTITY_TYPE_OF).map(([k, v]) => [v, k]));
function extras(e) {
  let s = "";
  if (e.type === "sheep") s = `fleece:${e.color}`;
  if (e.type === "zombie") s = `child:${e.growingAge < 0},villager:${!!e.villager}`;
  if (creatureTypeOf(e.type) === "creature") s += `${s ? "," : ""}age:${e.growingAge ?? 0}`;
  if (e.ridingEntity) s += `,riding:${NAME_OF[e.ridingEntity.type]}`;
  return s;
}

for (const replay of ref.replays) {
  test(`seeded findChunksForSpawning replay "${replay.name}" (${replay.steps.length} ticks) spawns as the jar`, () => {
    const mobs = probeMobs(replay.seed, replay.spawn, makeProbeWorld(replay.biomes, replay.caves)), player = { x: replay.player[0], y: replay.player[1], z: replay.player[2] };
    for (let tick = 0; tick < replay.steps.length; tick++) {
      const step = replay.steps[tick], before = mobs.entities.length;
      const total = mobs.naturalSpawn(player, { time: 18000 }, tick % replay.animalsEvery === 0);
      const got = mobs.entities.slice(before).map((e) => [NAME_OF[e.type], e.x, e.y, e.z, f(e.rotationYaw), extras(e)]);
      const want = step.spawned.map(([n, x, y, z, yaw, ex]) => [n, x, y, z, f(yaw), ex]);
      assert.deepEqual(got, want, `tick ${tick}`);
      assert.equal(total, step.total, `tick ${tick} total`);
      assert.equal(String(mobs.worldRandom.seed), step.seed, `tick ${tick} World.rand`);
    }
  });
}

// A flat grass floor (internal grass at y 64, stone below; a floor at 63 would sit in segment 48, whose random y never reaches 64) for the pure control-flow checks.
const GRASS = fromOriginal(2).id, STONE = fromOriginal(1).id;
const floorBlock = (x, y) => (y < 64 ? STONE : y === 64 ? GRASS : 0);
function flatCtx(over = {}) {
  const created = [], counts = { monster: 0, creature: 0, ambient: 0, waterCreature: 0 }, counted = [];
  const ctx = {
    rand: new JavaRandom(5), order: eligibleChunkOrder(0, 0), capChunks: 289, spawn: { x: 0, y: 65, z: 0 },
    count: (name) => { counted.push(name); return counts[name]; },
    chunkTop: () => 64,
    block: (x, y, z) => floorBlock(x, y, z), normalCube, liquid: isLiquid, bedrock: 11, solidTop: (x, y, z) => normalCube(floorBlock(x, y, z)),
    isMaterial: (type, id) => (type.material === "water" ? isLiquid(id) : id === 0),
    playerWithin: (x, y, z) => x * x + (y - 65) ** 2 + z * z < 576,
    possibleCreatures: (type) => spawnList(1, type.name),
    create: (name, x, y, z, yaw) => ({ name, x, y, z, yaw }),
    canSpawnHere: () => true,
    add: (e) => created.push(e),
    onSpawn: (_e, data) => data,
    maxInChunk: maxSpawnedInChunk,
    ...over,
  };
  return { ctx, created, counts, counted };
}

test("spawns keep 24 blocks from the player and from the world spawn point, 3 groups x 4 jittered attempts per chunk", () => {
  const { ctx, created } = flatCtx({ spawn: { x: 40, y: 65, z: 0 } });
  findChunksForSpawning(ctx, true, true, true);
  assert.ok(created.length > 10, String(created.length));
  for (const e of created) {
    assert.ok(e.x * e.x + (e.y - 65) ** 2 + e.z * e.z >= 576, "player distance");
    const dx = f(e.x - 40), dy = f(e.y - 65), dz = f(e.z);
    assert.ok(f(f(f(dx * dx) + f(dy * dy)) + f(dz * dz)) >= 576, "spawn distance");
    assert.equal(e.y, 65);
    assert.equal(e.x - Math.floor(e.x), 0.5);
  }
  // At most 4 per chunk (getMaxSpawnedInChunk) from one chunk's point: every chunk contributes <= 4 creatures + 4 monsters...
  const perChunk = new Map();
  for (const e of created) { const k = `${e.name}:${Math.floor(e.x / 16)},${Math.floor(e.z / 16)}`; perChunk.set(k, (perChunk.get(k) ?? 0) + 1); }
  // ...but the jitter (up to +-5 per attempt, 4 attempts) lets a group leave its chunk; a group never exceeds 3 x 4 = 12 tries.
  for (const n of perChunk.values()) assert.ok(n <= 12);
  // Edge chunks never spawn: no random point is drawn there.
  const { ctx: c2, created: none } = flatCtx({ order: eligibleChunkOrder(0, 0).filter(([, , edge]) => edge) });
  findChunksForSpawning(c2, true, true, true);
  assert.equal(none.length, 0);
});

test("caps scale with the eligible chunk count / 256 and are checked once per type", () => {
  for (const [capChunks, monsters, allowed] of [[289, 79, true], [289, 80, false], [36, 9, true], [36, 10, false], [1, 0, true], [1, 1, false]]) {
    const { ctx, counts, created } = flatCtx({ capChunks, possibleCreatures: (type) => (type.name === "monster" ? spawnList(1, "monster") : []) });
    counts.monster = monsters;
    findChunksForSpawning(ctx, true, false, false);
    assert.equal(created.length > 0, allowed, `${capChunks} chunks, ${monsters} monsters`);
  }
  assert.equal(Math.trunc((10 * 289) / 256), 11);
  assert.equal(Math.trunc((15 * 289) / 256), 16);
  assert.equal(Math.trunc((5 * 289) / 256), 5);
});

test("Peaceful skips only monsters; the animal flag gates creatures; no flags spawn nothing", () => {
  const visit = (hostile, peaceful, animals) => { const { ctx, counted } = flatCtx(); findChunksForSpawning(ctx, hostile, peaceful, animals); return counted; };
  assert.deepEqual(visit(false, true, true), ["creature", "ambient", "waterCreature"]);
  assert.deepEqual(visit(false, true, false), ["ambient", "waterCreature"]);
  assert.deepEqual(visit(true, true, false), ["monster", "ambient", "waterCreature"]);
  assert.deepEqual(visit(true, false, true), ["monster"]);
  assert.deepEqual(visit(false, false, true), []);
});

test("group data threads through one group and resets for the next", () => {
  const seen = [];
  const { ctx } = flatCtx({ onSpawn: (e, data) => { seen.push(data); return data ?? { first: e }; }, possibleCreatures: (type) => (type.name === "monster" ? [["Zombie", 1, 4, 4]] : []) });
  findChunksForSpawning(ctx, true, false, false);
  assert.ok(seen.length > 4);
  // Each group's first spawn gets null, the rest the data its first spawn returned.
  let groups = 0;
  for (let i = 0; i < seen.length; i++) if (seen[i] === null) groups++; else assert.ok(seen[i].first);
  assert.ok(groups > 1 && groups < seen.length);
});

const daylightFlat = () => ({ height: 256, numericSeed: 1, get: (x, y, z) => floorBlock(x, y, z), getMeta: () => 0, solid: (x, y, z) => y <= 64, surface: () => 65, biomeAt: () => ({ id: 1 }) });
function liveMobs(world, seed = 9) {
  const mobs = new EntityWorld(world, []);
  mobs.naturalSpawning = true;
  mobs.worldRandom = new JavaRandom(seed);
  mobs.lightAt = () => 15; mobs.skyLightAt = () => 15; mobs.fullLightAt = () => 15; mobs.thunderLightAt = () => 5;
  mobs.spawnPoint = () => ({ x: 0, y: 65, z: 0 });
  return mobs;
}
const day = { time: 6000, health: 20, creative: false, damage() {}, scaledDamage() {}, count: () => 0 };

test("creatures spawn only on ticks where the world time is a multiple of 400", () => {
  const mobs = liveMobs(daylightFlat()), player = { x: 0.5, y: 65, z: 0.5 };
  const animals = () => mobs.entities.filter((e) => creatureTypeOf(e.type) === "creature").length;
  mobs.tick(player, day);
  assert.ok(animals() > 0, "tick 0");
  mobs.entities.length = 0;
  for (let i = 1; i < 400; i++) { mobs.tick(player, day); assert.equal(animals(), 0, `tick ${i}`); }
  mobs.tick(player, day);
  assert.ok(animals() > 0, "tick 400");
  // Daylight (light 15) keeps every monster out.
  assert.equal(mobs.entities.filter((e) => creatureTypeOf(e.type) === "monster").length, 0);
});

test("doMobSpawning false stops the pass; Peaceful still spawns animals but no monsters", () => {
  const player = { x: 0.5, y: 65, z: 0.5 }, night = { ...day, time: 18000 };
  setGameRuleSource((name) => (name === "doMobSpawning" ? false : undefined));
  try {
    const mobs = liveMobs(daylightFlat());
    mobs.lightAt = () => 0; mobs.skyLightAt = () => 0;
    for (let i = 0; i < 5; i++) mobs.tick(player, night);
    assert.equal(mobs.entities.length, 0);
  } finally { setGameRuleSource(null); }
  const mobs = liveMobs(daylightFlat(), 10);
  mobs.lightAt = () => 0; mobs.skyLightAt = () => 0;
  mobs.difficulty = 0;
  for (let i = 0; i < 5; i++) mobs.tick(player, night);
  assert.ok(mobs.entities.some((e) => creatureTypeOf(e.type) === "creature"));
  assert.equal(mobs.entities.filter((e) => creatureTypeOf(e.type) === "monster").length, 0);
  mobs.difficulty = 2;
  for (let i = 0; i < 5; i++) mobs.tick(player, night);
  assert.ok(mobs.entities.some((e) => creatureTypeOf(e.type) === "monster"));
});

test("streamed worlds: points are drawn in every resident chunk (ticking or not), the cap counts the native 289 eligible chunks and every loaded mob", () => {
  const h = 256, chunks = new Map();
  const chunkAt = (cx, cz) => {
    if (cx < 0 || cz < 0 || cx >= 8 || cz >= 8) return null;
    const k = cx * 8 + cz;
    if (!chunks.has(k)) { const c = { height: h, blocks: new Uint8Array(256 * h) }; for (let col = 0; col < 256; col++) for (let y = 0; y <= 64; y++) c.blocks[col * h + y] = y === 64 ? GRASS : STONE; chunks.set(k, c); }
    return chunks.get(k);
  };
  const world = { ...daylightFlat(), streaming: true, originX: 0, originZ: 0, chunkAt, isTicking: (x, z) => x >= 16 && x < 112 && z >= 16 && z < 112, inside: () => true };
  const mobs = liveMobs(world);
  mobs.lightAt = () => 0; mobs.skyLightAt = () => 0;
  assert.equal(mobs.spawnChunkTop(3, 3), 64);
  assert.equal(mobs.spawnChunkTop(0, 3), 64, "resident but not ticking: still eligible");
  assert.equal(mobs.spawnChunkTop(8, 3), -1, "not resident: skipped without draws");
  const player = { x: 64.5, y: 65, z: 64.5 };
  let caps = 0;
  const seen = new Set();
  const real = mobs.naturalSpawn.bind(mobs);
  for (let i = 0; i < 120; i++) { real(player, { time: 18000 }, true); caps = mobs._spawner.ctx.capChunks; }
  assert.equal(caps, 289);
  // Points are drawn in the 8 x 8 resident chunks; a group's jitter (four +-5 steps) may carry it up to 20 blocks out of them.
  let outer = 0;
  for (const e of mobs.entities) {
    seen.add(creatureTypeOf(e.type));
    assert.ok(e.x > -21 && e.x < 128 + 21 && e.z > -21 && e.z < 128 + 21, `${e.type} at ${e.x},${e.z}`);
    if (e.x < 16 || e.x >= 112 || e.z < 16 || e.z >= 112) outer++;
  }
  assert.ok(outer > 0, "the resident ring outside the ticking window is used");
  assert.ok(seen.has("monster") && seen.has("creature"));
  // The monster cap is 70 * 289 / 256 = 79: a full pass stops once more than 79 count.
  const monsters = mobs.entities.filter((e) => creatureTypeOf(e.type) === "monster" && !e.persistent).length;
  assert.ok(monsters > 79, String(monsters));
  const before = mobs.entities.length;
  real(player, { time: 18000 }, false);
  assert.equal(mobs.entities.filter((e) => creatureTypeOf(e.type) === "monster").length, mobs.entities.filter((e, i) => i < before && creatureTypeOf(e.type) === "monster").length);
});

test("Nether: the fortress list inside a fortress, BiomeGenHell's outside; the End uses BiomeGenEnd's", () => {
  const NETHERRACK = fromOriginal(87).id;
  const fortress = (x, z) => x >= 32 && x < 128 && z >= -128 && z < 128;
  const world = {
    dimension: -1, height: 256, actualHeight: 128, numericSeed: 1,
    get: (x, y) => (y < 10 ? NETHERRACK : 0), getMeta: () => 0, solid: (x, y) => y < 10, chunkTop: () => 0,
    fortressSpawns: (x, y, z) => (fortress(x, z) ? FORTRESS_MONSTERS : null),
  };
  const mobs = new EntityWorld(world, []);
  mobs.worldRandom = new JavaRandom(21);
  mobs.dimensionBlockLight = () => 0;
  const player = { x: 0, y: 120, z: 0 };
  for (let i = 0; i < 200; i++) mobs.naturalSpawn(player, { time: 18000 }, false);
  // The list is chosen at a group's first valid point; its later jittered points (four +-5 steps) may leave the fortress.
  const near = (e, pad) => e.x > 32 - pad && e.x < 128 + pad && e.z > -128 - pad && e.z < 128 + pad;
  const types = new Set(mobs.entities.map((e) => e.type));
  for (const e of mobs.entities) {
    assert.ok(["ghast", "pigman", "magma_cube", "blaze", "skeleton", "wither_skeleton"].includes(e.type), e.type);
    if (["blaze", "skeleton", "wither_skeleton"].includes(e.type)) assert.ok(near(e, 21), `${e.type} at ${e.x},${e.z}`);
    if (e.type === "ghast") assert.ok(!near(e, -21), `ghast at ${e.x},${e.z}`);
  }
  assert.ok(types.has("ghast") || types.has("pigman"), [...types].join());
  assert.ok(types.has("blaze") || types.has("skeleton") || types.has("wither_skeleton"), [...types].join());
  for (const e of mobs.entities) assert.equal(e.y, 10);
  // No creature, ambient or water lists in the Nether or the End.
  for (const slot of [8, 9]) for (const t of ["creature", "ambient", "waterCreature"]) assert.deepEqual(spawnList(slot, t), []);
  assert.deepEqual(spawnList(9, "monster"), [["Enderman", 10, 4, 4]]);
  // Peaceful: no monsters, and these dimensions have nothing else.
  const calm = new EntityWorld(world, []);
  calm.worldRandom = new JavaRandom(21);
  calm.difficulty = 0;
  for (let i = 0; i < 20; i++) calm.naturalSpawn(player, { time: 18000 }, true);
  assert.equal(calm.entities.length, 0);
});

test("a natural spawn tick stays cheap on a streamed world", (t) => {
  const world = new World("17", "javaStreamed", 12);
  world.blockLight = () => 0;
  const mobs = new EntityWorld(world, []);
  mobs.naturalSpawning = true;
  mobs.worldRandom = new JavaRandom(4);
  mobs.lightAt = () => 0; mobs.skyLightAt = () => 0; mobs.fullLightAt = () => 15;
  mobs.spawnPoint = () => ({ x: -1000, y: 64, z: -1000 });
  const player = { x: 64.5, y: world.surface(64, 64) + 1, z: 64.5 };
  // "capped": mobs accumulate, so the monster cap soon ends each pass early. "uncapped": entities are cleared before every tick,
  // the worst case where every type walks all 36 ticking chunks (creatures included every tick).
  const run = (clear) => {
    const times = [];
    let spawned = 0;
    for (let i = 0; i < 800; i++) {
      if (clear) mobs.entities.length = 0;
      mobs.worldTicks = i;
      const t0 = performance.now();
      spawned += mobs.naturalSpawn(player, { time: 18000 }, clear || i % 400 === 0);
      times.push(performance.now() - t0);
    }
    const steady = times.slice(50).sort((a, b) => a - b);
    return { first: times[0], mean: steady.reduce((a, b) => a + b, 0) / steady.length, p99: steady[Math.floor(steady.length * 0.99)], spawned };
  };
  const capped = run(false), uncapped = run(true);
  for (const [name, r] of [["capped", capped], ["uncapped", uncapped]]) {
    t.diagnostic(`${name}: first ${r.first.toFixed(2)} ms, mean ${r.mean.toFixed(3)} ms, p99 ${r.p99.toFixed(3)} ms, ${(r.spawned / 800).toFixed(2)} spawned/tick`);
  }
  assert.ok(capped.spawned > 0 && uncapped.spawned > capped.spawned);
  assert.ok(uncapped.mean < 2, `mean ${uncapped.mean} ms`);
});

test("mobs in loaded chunks outside the ticking window still count for the cap", () => {
  const h = 256, block = new Uint8Array(256 * h);
  for (let col = 0; col < 256; col++) for (let y = 0; y <= 64; y++) block[col * h + y] = y === 64 ? GRASS : STONE;
  const world = { ...daylightFlat(), streaming: true, originX: 0, originZ: 0, chunkAt: (cx, cz) => (cx >= 0 && cz >= 0 && cx < 8 && cz < 8 ? { height: h, blocks: block } : null), isTicking: (x, z) => x >= 16 && x < 112 && z >= 16 && z < 112, inside: () => true };
  const mobs = liveMobs(world);
  mobs.lightAt = () => 0; mobs.skyLightAt = () => 0;
  const player = { x: 64.5, y: 65, z: 64.5 };
  const frozen = () => { const e = mobs.create("zombie", 2000, 65, 2000); mobs.entities.push(e); return e; };
  for (let i = 0; i < 79; i++) frozen();
  // 79 counted is not above the cap of 79, so the monster pass runs (a pass may draw no valid point; it stops once 80 count).
  for (let i = 0; i < 60 && mobs.entities.length <= 79; i++) mobs.naturalSpawn(player, { time: 18000 }, false);
  const after79 = mobs.entities.filter((e) => creatureTypeOf(e.type) === "monster").length;
  assert.ok(after79 > 79, "79 frozen zombies equal the cap, so one more pass runs");
  const n = mobs.entities.length;
  mobs.naturalSpawn(player, { time: 18000 }, false);
  assert.equal(mobs.entities.filter((e) => creatureTypeOf(e.type) === "monster").length, mobs.entities.slice(0, n).filter((e) => creatureTypeOf(e.type) === "monster").length, "80+ monsters: the pass is skipped");
});

test("the animal cadence follows the saved total world time (WorldInfo.getWorldTotalTime before the tick adds 1)", () => {
  const mobs = liveMobs(daylightFlat());
  mobs.loadTotalTime(799);
  assert.equal(mobs.saveTotalTime(), 799);
  const player = { x: 0.5, y: 65, z: 0.5 };
  const animals = () => mobs.entities.filter((e) => creatureTypeOf(e.type) === "creature").length;
  mobs.tick(player, day); // sees 799
  assert.equal(animals(), 0);
  assert.equal(mobs.saveTotalTime(), 800);
  mobs.tick(player, day); // sees 800
  assert.ok(animals() > 0);
  assert.equal(mobs.saveTotalTime(), 801);
  // A fresh load of 801 skips to 1200.
  const fresh = liveMobs(daylightFlat());
  fresh.loadTotalTime(1199);
  fresh.tick(player, day);
  assert.equal(fresh.entities.filter((e) => creatureTypeOf(e.type) === "creature").length, 0);
  fresh.tick(player, day);
  assert.ok(fresh.entities.some((e) => creatureTypeOf(e.type) === "creature"));
  assert.equal(new EntityWorld(daylightFlat(), []).saveTotalTime(), undefined);
  mobs.loadTotalTime(undefined);
  assert.equal(mobs.saveTotalTime(), 0);
});

test("the witch hut list applies wherever the hut box covers, whatever the biome slot", () => {
  const hutSlots = new Set();
  const world = { ...daylightFlat(), biomeAt: () => ({ id: 1 }) };
  const mobs = liveMobs(world);
  mobs.swampHutAt = (x, y, z) => { hutSlots.add(1); return x >= 0 && x < 7 && z >= 0 && z < 7; };
  const hooks = mobs.spawnerState().ctx;
  assert.equal(hooks.possibleCreatures({ name: "monster" }, 3, 64, 3), WITCH_HUT_MONSTERS);
  assert.notEqual(hooks.possibleCreatures({ name: "monster" }, 30, 64, 3), WITCH_HUT_MONSTERS);
  assert.ok(hutSlots.has(1), "the lookup ran for a Plains slot");
});

test("a portal pigman is a pig zombie with the golden sword roll, a random yaw and the 300-tick portal cooldown", () => {
  const mobs = new EntityWorld(daylightFlat(), []);
  mobs.worldRandom = new JavaRandom(3);
  const rand = new JavaRandom(11), want = new JavaRandom(11).nextFloat();
  const e = mobs.spawnPortalPigman([4.5, 65.1, 4.5], rand);
  assert.equal(e.type, "pigman");
  assert.equal(e.portalCooldown, 300);
  assert.ok(mobs.entities.includes(e));
  assert.equal(e.rotationYaw, e.rotationYawHead);
  assert.ok(Math.abs(e.rotationYaw - (Math.fround(want * 360) > 180 ? Math.fround(want * 360) - 360 : Math.fround(want * 360))) < 1e-4);
});

test("a despawnable mob frozen outside the ticking window leaves like a native mob that keeps updating", () => {
  const h = 256, block = new Uint8Array(256 * h);
  const world = { ...daylightFlat(), streaming: true, originX: 0, originZ: 0, chunkAt: () => ({ height: h, blocks: block }), isTicking: (x, z) => x >= 16 && x < 112 && z >= 16 && z < 112, inside: () => true };
  const mobs = liveMobs(world);
  const player = { x: 64.5, y: 65, z: 64.5 };
  const add = (x, z) => { const e = mobs.create("zombie", x, 65, z); mobs.entities.push(e); return e; };
  const far = add(64 + 200, 64), ring = add(120, 64);
  for (let i = 0; i < 400; i++) mobs.sweepFrozen(player);
  assert.ok(!mobs.entities.includes(far), "beyond 128 blocks it goes at once");
  assert.ok(!mobs.entities.includes(ring), "beyond 32 blocks, idle past 600 ticks: the 1 in 800 roll lands within 8000 ticks");
});
