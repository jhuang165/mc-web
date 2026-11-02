import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { JavaRandom } from "./java-random.js";
import { spiderSpawnRolls } from "./difficulty.js";
import {
  MobSpawners, SPAWNER_DEFAULTS, spawnerBox, boxesIntersect, mobBox, countsAs, monsterCanSpawnHere, receiveClientEvent,
  spawnerMobMatrix, spawnerDisplayEntity, SPAWN_BRIGHTNESS, isActivated, countInBox,
} from "./mob-spawner.js";

const ref = JSON.parse(await readFile(new URL("../public/research/mob-spawner-reference.json", import.meta.url)));
const scenarios = ref.records.filter((r) => r.case === "scenario");
const SIZE = { cave_spider: [0.7, 0.5], spider: [1.4, 0.9] };
const MASK = (1n << 48n) - 1n;
// MobSpawnerProbe.SeededCaveSpider: Entity.rand = new Random(((worldSeed * 1000 + index) * 0x9E3779B97F4A7C15) & MASK).
const entitySeed = (worldSeed, index) => Number((BigInt(worldSeed * 1000 + index) * 0x9e3779b97f4a7c15n) & MASK);
const parseNBT = (s) => Object.fromEntries([...s.matchAll(/(\w+):(?:(-?\d+)s|\\?"([^"\\]*)\\?")/g)].map((m) => [m[1], m[2] !== undefined ? Number(m[2]) : m[3]]));

// The probe world: stone below floorY (or everywhere, "encased"), water from floorY for three
// layers ("water"), the spawner (a full collision cube) at its cell, one light value everywhere.
function terrain(r) {
  const [sx, sy, sz] = r.spawner;
  const spawner = (x, y, z) => x === sx && y === sy && z === sz;
  const solid = (x, y, z) => !spawner(x, y, z) && (r.terrain === "encased" || y < r.floorY);
  const water = (x, y, z) => r.terrain === "water" && y >= r.floorY && y < r.floorY + 3 && !spawner(x, y, z);
  const cells = (b, low, test) => {
    for (let x = Math.floor(b[0]); x < Math.floor(b[3] + 1); x++)
      for (let y = Math.floor(b[1]) - low; y < Math.floor(b[4] + 1); y++)
        for (let z = Math.floor(b[2]); z < Math.floor(b[5] + 1); z++) if (test(x, y, z)) return true;
    return false;
  };
  return {
    blockCollision: (b) => cells(b, 1, (x, y, z) => (solid(x, y, z) || spawner(x, y, z)) && boxesIntersect(b, [x, y, z, x + 1, y + 1, z + 1])),
    liquid: (b) => cells(b, 0, water),
  };
}

class Counting extends JavaRandom {
  constructor(seed) { super(seed); this.calls = 0; }
  next(bits) { this.calls++; return super.next(bits); }
}

function replayServer(r) {
  const random = new Counting(r.worldSeed), world = terrain(r);
  const entities = r.crowd.map((c) => ({ ...c }));
  let index = 0, row;
  const sizeOf = (e) => SIZE[e.type];
  const ctx = {
    random,
    players: r.player ? [{ x: r.player[0], y: r.player[1], z: r.player[2] }] : [],
    countNearby(type, box) {
      index++; // EntityList.createEntityByName ran just before this query
      const n = countInBox(entities, type, box, sizeOf);
      row.boxes.push([...box, n]);
      return n;
    },
    createMob: (type, x, y, z, yaw) => ({ type, x, y, z, yaw, width: SIZE[type][0], height: SIZE[type][1], seed: entitySeed(r.worldSeed, index - 1) }),
    canSpawnHere(mob) {
      const env = {
        difficulty: r.difficulty, thundering: false, skyLight: () => r.sky, lightValue: () => r.light,
        entityCollision: (b) => entities.some((e) => boxesIntersect(b, mobBox(e.x, e.y, e.z, ...sizeOf(e)))),
        ...world,
      };
      const ok = monsterCanSpawnHere(mob, env, new JavaRandom(r.real ? 0 : mob.seed));
      if (!r.real) row.attempts.push({ seed: mob.seed, x: mob.x, y: mob.y, z: mob.z, yaw: mob.yaw, ok });
      return ok;
    },
    // EntitySpider.onSpawnWithEgg's World.rand draws (Entity.rand is the probe's own).
    initMob: (mob) => { if (mob.type === "spider") spiderSpawnRolls(new JavaRandom(0), random, r.difficulty, 0); },
    addMob: (mob) => { entities.push(mob); row.spawned.push([mob.x, mob.y, mob.z, mob.yaw]); },
    spawnParticles: (x, y, z) => { assert.deepEqual([x, y, z], r.spawner); row.aux++; },
    blockEvent: (s, id, data) => { assert.deepEqual([id, data], [1, 0]); row.blockEvents++; },
  };
  const spawners = new MobSpawners();
  const s = spawners.add({ x: r.spawner[0], y: r.spawner[1], z: r.spawner[2], entityId: r.entityId });
  let state = random.seed.toString(), counts = { attempts: 0, spawned: 0, aux: 0 };
  for (const want of r.ticks) {
    row = { boxes: [], attempts: [], spawned: [], aux: 0, blockEvents: 0 };
    random.calls = 0;
    spawners.tick(ctx);
    const at = `${r.name} tick ${want.t}`;
    assert.equal(s.delay, want.delay, `${at} delay`);
    assert.equal(random.calls, want.calls ?? 0, `${at} World.rand calls`);
    if (want.state) state = want.state;
    assert.equal(random.seed.toString(), state, `${at} World.rand state`);
    assert.deepEqual(row.boxes, want.boxes ?? [], `${at} boxes`);
    if (!r.real) assert.deepEqual(row.attempts, want.attempts ?? [], `${at} attempts`);
    assert.deepEqual(row.spawned, want.spawned ?? [], `${at} spawned`);
    assert.equal(row.aux, want.aux ?? 0, `${at} aux 2004`);
    assert.equal(row.blockEvents, want.blockEvents ?? 0, `${at} block events`);
    counts.attempts += row.attempts.length; counts.spawned += row.spawned.length; counts.aux += row.aux;
  }
  // writeToNBT after the run.
  const nbt = parseNBT(r.nbt), saved = spawners.toJSON()[0];
  for (const [k, v] of Object.entries(nbt)) assert.equal(saved[k], v, `${r.name} NBT ${k}`);
  return counts;
}

for (const r of scenarios.filter((x) => !x.remote))
  test(`MobSpawnerBaseLogic server replay: ${r.name}`, () => {
    const c = replayServer(r);
    const want = r.ticks.reduce((a, t) => a + (t.spawned?.length ?? 0), 0);
    assert.equal(c.spawned, want);
  });

for (const r of scenarios.filter((x) => x.remote))
  test(`MobSpawnerBaseLogic client replay: ${r.name}`, () => {
    const random = new Counting(r.worldSeed), spawners = new MobSpawners();
    const s = spawners.add({ x: r.spawner[0], y: r.spawner[1], z: r.spawner[2], entityId: r.entityId });
    let particles, state = random.seed.toString();
    const ctx = { random, players: [{ x: r.player[0], y: r.player[1], z: r.player[2] }], particle: (name, x, y, z) => particles.push([name, x, y, z]) };
    for (const want of r.ticks) {
      particles = []; random.calls = 0;
      if (want.t === r.blockEventTick) assert.equal(receiveClientEvent(s, 1), true);
      spawners.tickClient(ctx);
      const at = `${r.name} tick ${want.t}`;
      assert.equal(s.client.delay, want.delay, `${at} delay`);
      assert.equal(s.client.rotation, want.rot, `${at} rotation`);
      assert.equal(s.client.prevRotation, want.prev, `${at} prevRotation`);
      assert.deepEqual(particles, want.particles, `${at} particles`);
      assert.equal(random.calls, want.calls ?? 0, `${at} calls`);
      if (want.state) state = want.state;
      assert.equal(random.seed.toString(), state, `${at} state`);
    }
  });

test("spawner evidence covers every scenario the task names", () => {
  const names = scenarios.map((r) => r.name);
  for (const n of ["dark-open", "player-at-16", "player-at-15.99", "lit-15", "crowded-6", "encased", "water", "client"]) assert.ok(names.includes(n), n);
  const total = (k) => scenarios.reduce((a, r) => a + r.ticks.reduce((b, t) => b + (t[k]?.length ?? 0), 0), 0);
  assert.ok(total("spawned") >= 40 && total("attempts") >= 200);
  // In range at 15.99 from the centre, out at exactly 16; nothing happens without a player.
  const ticks = (n) => scenarios.find((r) => r.name === n).ticks;
  assert.ok(ticks("player-at-16").every((t) => t.delay === 20 && !t.calls));
  assert.ok(ticks("player-at-15.99").some((t) => t.spawned));
  assert.equal(isActivated({ ...SPAWNER_DEFAULTS, x: 8, y: 20, z: 8 }, [{ x: 24.5, y: 20.5, z: 8.5 }]), false);
  assert.equal(isActivated({ ...SPAWNER_DEFAULTS, x: 8, y: 20, z: 8 }, [{ x: 24.49, y: 20.5, z: 8.5 }]), true);
});

test("spawner box, class counting and brightness table", () => {
  assert.deepEqual(spawnerBox({ x: 8, y: 20, z: 8, spawnRange: 4 }), [0, 16, 0, 17, 25, 17]);
  assert.equal(countsAs("spider", "cave_spider"), true);
  assert.equal(countsAs("cave_spider", "spider"), false);
  assert.equal(countsAs("zombie", "zombie"), true);
  // In floats getLightBrightness 12 is 0.50000006, so 0.5 - b >= 0 holds up to light 11.
  assert.equal(SPAWN_BRIGHTNESS[12], 0.5000000596046448);
  assert.ok(SPAWN_BRIGHTNESS[11] < 0.5 && SPAWN_BRIGHTNESS[0] === 0 && SPAWN_BRIGHTNESS[15] === 1);
  // Thundering reads the light with skylightSubtracted 10.
  const env = { difficulty: 2, thundering: true, skyLight: () => 0, lightValue: () => 15, thunderLightValue: () => 0, entityCollision: () => false, blockCollision: () => false, liquid: () => false };
  assert.equal(monsterCanSpawnHere({ x: 0.5, y: 0, z: 0.5, width: 0.7, height: 0.5 }, env, new JavaRandom(1)), false); // brightness 15 > 0.5
  assert.equal(monsterCanSpawnHere({ x: 0.5, y: 0, z: 0.5, width: 0.7, height: 0.5 }, { ...env, lightValue: () => 0 }, new JavaRandom(1)), true);
});

test("spawner records save and reload with readFromNBT's field groups", () => {
  const a = new MobSpawners();
  const s = a.add({ x: 3, y: 12, z: -40, entityId: "CaveSpider" });
  assert.deepEqual({ ...s, client: undefined }, { x: 3, y: 12, z: -40, entityId: "CaveSpider", ...SPAWNER_DEFAULTS, client: undefined });
  s.delay = 345;
  a.add({ x: 1, y: 2, z: 3, name: "Spider" });
  const json = JSON.parse(JSON.stringify(a.toJSON()));
  assert.deepEqual(json[0], { x: 3, y: 12, z: -40, EntityId: "CaveSpider", Delay: 345, MinSpawnDelay: 200, MaxSpawnDelay: 800, SpawnCount: 4, MaxNearbyEntities: 6, RequiredPlayerRange: 16, SpawnRange: 4 });
  const b = MobSpawners.fromJSON(json);
  assert.equal(b.get(3, 12, -40).delay, 345);
  assert.equal(b.get(3, 12, -40).client.delay, 345);
  assert.equal(b.get(1, 2, 3).entityId, "Spider");
  // MaxSpawnDelay is read only beside MinSpawnDelay; RequiredPlayerRange only beside MaxNearbyEntities.
  const c = MobSpawners.fromJSON([{ x: 0, y: 0, z: 0, EntityId: "Zombie", Delay: 5, MaxSpawnDelay: 9, RequiredPlayerRange: 3, SpawnRange: 2 }, { y: 1 }, null]);
  assert.equal(c.size, 1);
  assert.deepEqual([c.get(0, 0, 0).maxSpawnDelay, c.get(0, 0, 0).requiredPlayerRange, c.get(0, 0, 0).spawnRange], [800, 16, 2]);
  assert.equal(c.remove(0, 0, 0), true);
  assert.equal(c.get(0, 0, 0), null);
});

test("TileEntityMobSpawnerRenderer transform", () => {
  const s = { x: 8, y: 20, z: 8, entityId: "CaveSpider", client: { rotation: 9, prevRotation: 0 } };
  const m = spawnerMobMatrix(s, 0.5);
  // Angle (0 + 9 * 0.5) * 10 = 45 degrees about y after -30 about x; scale 0.4375.
  const k = Math.fround(0.4375), a = Math.fround(Math.fround(4.5) * 10) * Math.PI / 180, b = -Math.PI / 6;
  const apply = (p) => [0, 1, 2].map((i) => m[i] * p[0] + m[4 + i] * p[1] + m[8 + i] * p[2] + m[12 + i]);
  const close = (u, v) => u.forEach((x, i) => assert.ok(Math.abs(x - v[i]) < 1e-12, `${u} != ${v}`));
  // The mob's origin: T(.5, .4, .5) R T(0, -.4, 0).
  const lift = Math.fround(0.4), o = [Math.sin(a) * Math.sin(b) * -lift, -Math.cos(b) * lift, Math.cos(a) * Math.sin(b) * -lift];
  close(apply([0, 0, 0]), [8.5 + o[0], 20 + lift + o[1], 8.5 + o[2]]);
  // A point 1 up the mob: rotated by Rx(-30) then Ry(45), scaled.
  const up = [Math.sin(a) * Math.sin(b) * k, Math.cos(b) * k, Math.cos(a) * Math.sin(b) * k], base = apply([0, 0, 0]);
  close(apply([0, 1, 0]), base.map((v, i) => v + up[i]));
  const d = spawnerDisplayEntity({ ...s, x: 8 }, 0.5);
  assert.equal(d.type, "cave_spider");
  assert.deepEqual(d.lightPos, { x: 8, y: 20, z: 8 });
  assert.equal(spawnerDisplayEntity({ ...s, entityId: "NoSuchMob" }), null);
  assert.deepEqual(ref.render.spawnerMob.steps.length, 7);
});
