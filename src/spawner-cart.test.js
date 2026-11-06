import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { JavaRandom } from "./java-random.js";
import { spiderSpawnRolls } from "./difficulty.js";
import { solidBlock } from "./world.js";
import { Minecarts } from "./minecarts.js";
import { itemFromOriginal } from "./region-import.js";
import { NBT } from "./nbt.js";
import { spawnerRecord, summonCart } from "./cart-summon.js";
import { CART_ENTITY_IDS, variantJSON, variantNBT } from "./cart-variants.js";
import { liveCartSpawners } from "./structure-simulation.js";
import { entityIdOf, makeSpawner, readNBT, spawnerJSON, updateSpawner, updateSpawnerClient, boxesIntersect, countInBox, monsterCanSpawnHere } from "./mob-spawner.js";
import { pickWeighted, spawnerPairs } from "./spawner-data.js";

// public/research/spawner-cart-reference.json: the unchanged EntityMinecartMobSpawner (tools/verify-spawner-cart.mjs, tools/probes/SpawnerCartProbe.java).
const ref = JSON.parse(await readFile(new URL("../public/research/spawner-cart-reference.json", import.meta.url)));
const by = Object.fromEntries(ref.scenarios.map((s) => [s.name, s]));
const MASK = (1n << 48n) - 1n;
const entitySeed = (worldSeed, index) => Number((BigInt(worldSeed * 1000 + index) * 0x9e3779b97f4a7c15n) & MASK);
const SIZE = { cave_spider: [0.7, 0.5], spider: [1.4, 0.9] };
const TYPE_NAME = { cave_spider: "CaveSpider", spider: "Spider" };

class Counting extends JavaRandom {
  constructor(seed) { super(seed); this.calls = 0; }
  next(bits) { this.calls++; return super.next(bits); }
}

// NbtProbe tag -> a src/nbt.js tree ({type, value}; compounds are Maps, list items raw).
function fromProbe(t) {
  const value = (type, v) => {
    if (type === NBT.COMPOUND) return new Map(v.map(([k, c]) => [k, fromProbe(c)]));
    if (type === NBT.LIST) return { elementType: v.elementType, items: v.items.map((i) => value(v.elementType, i)) };
    return v;
  };
  return { type: t.type, value: value(t.type, t.value) };
}
// A [type, value] pair of spawnerPairs -> the probe's {type, value} with compounds as sorted [key, tag] arrays.
function pairToProbe(p) {
  const compound = (o) => Object.entries(o).map(([k, v]) => [k, pairToProbe(v)]).sort(([a], [b]) => (a < b ? -1 : 1));
  if (p[0] === 10) return { type: 10, value: compound(p[1]) };
  if (p[0] === 9) return { type: 9, value: { elementType: p[1], items: p[2].map((i) => (p[1] === 10 ? compound(i) : i)) } };
  return { type: p[0], value: p[1] };
}
function sortProbe(t) {
  const sort = (v, type) => (type === 10 ? v.map(([k, c]) => [k, sortProbe(c)]).sort(([a], [b]) => (a < b ? -1 : 1)) : v);
  if (t.type === 10) return { type: 10, value: sort(t.value, 10) };
  if (t.type === 9) return { type: 9, value: { elementType: t.value.elementType, items: t.value.items.map((i) => (t.value.elementType === 10 ? sort(i, 10) : i)) } };
  return t;
}
const pairsToProbe = (pairs) => pairToProbe([10, pairs]);

// A scenario without an input tag set EntityId through the logic (setEntityName) on the constructor defaults.
const recordOf = (r) => (r.input ? spawnerRecord(fromProbe(r.input).value) : { EntityId: r.entityId });

function stateOf(input) {
  const s = makeSpawner(0, 0, 0);
  if (input) readNBT(s, spawnerRecord(fromProbe(input).value));
  return s;
}

test("spawner cart facts: type 4, mob_spawner display at offset 6, defaults of MobSpawnerBaseLogic", () => {
  assert.deepEqual([ref.facts.type, ref.facts.displayBlock, ref.facts.offset, ref.facts.defaultEntityId, ref.facts.defaultDelay], [4, 52, 6, "Pig", 20]);
  assert.equal(CART_ENTITY_IDS[4], "MinecartSpawner");
  assert.deepEqual([ref.facts.width, ref.facts.height], [0.9800000190734863, 0.699999988079071]);
});

for (const c of ref.nbt)
  test(`MinecartSpawner NBT: ${c.name}`, () => {
    const s = stateOf(c.input);
    assert.equal(entityIdOf(s), c.entityId, "EntityId (agq.e)");
    assert.equal(s.delay, c.delay);
    assert.deepEqual(pairToProbe([10, spawnerPairs(s)]), sortProbe(c.output), "writeEntityToNBT");
    // The save path (spawnerJSON -> readNBT) round-trips like readEntityFromNBT(writeEntityToNBT).
    const again = makeSpawner(0, 0, 0);
    readNBT(again, JSON.parse(JSON.stringify(spawnerJSON(s))));
    assert.deepEqual(pairToProbe([10, spawnerPairs(again)]), sortProbe(c.again), "second round trip");
  });

test("a spawner cart's start NBT matches the original", () => {
  for (const r of ref.scenarios) {
    const carts = new Minecarts({});
    const cart = carts.spawnCart(4, { x: r.cart[0], y: r.cart[1], z: r.cart[2], spawner: recordOf(r) }, { seed: 1000 });
    assert.deepEqual(pairsToProbe(variantNBT(cart)), sortProbe({ type: 10, value: r.start.value.filter(([k]) => ["EntityId", "Delay", "MinSpawnDelay", "MaxSpawnDelay", "SpawnCount", "MaxNearbyEntities", "RequiredPlayerRange", "SpawnRange", "SpawnData", "SpawnPotentials"].includes(k)) }), r.name);
    assert.equal(JSON.parse(JSON.stringify(variantJSON(cart))).spawner.EntityId, cart.spawner.entityId);
  }
});

const floorWorld = (floor) => ({ get: (x, y, z) => (y < floor ? 3 : 0), getMeta: () => 0, solid: (x, y, z) => solidBlock(y < floor ? 3 : 0, 0) });

// The server half: JS cart physics, then the logic at floor(cart) with the probe's spawn hooks.
function replayServer(r) {
  const world = floorWorld(r.floor), carts = new Minecarts({});
  const cart = carts.spawnCart(4, { x: r.cart[0], y: r.cart[1], z: r.cart[2], spawner: recordOf(r) }, { seed: 1000 });
  [cart.vx, cart.vy, cart.vz] = r.motion;
  const random = new Counting(r.worldSeed), entities = [];
  let index = 0, row;
  const sizeOf = (e) => SIZE[e.type];
  const ctx = {
    random, players: r.player ? [{ x: r.player[0], y: r.player[1], z: r.player[2] }] : [],
    countNearby(type, box) { index++; return countInBox(entities, type, box, sizeOf); },
    createMob: (type, x, y, z, yaw) => ({ type, x, y, z, yaw, width: SIZE[type][0], height: SIZE[type][1], seed: entitySeed(r.worldSeed, index - 1) }),
    canSpawnHere(mob) {
      const cells = (b, low, test) => {
        for (let x = Math.floor(b[0]); x < Math.floor(b[3] + 1); x++) for (let y = Math.floor(b[1]) - low; y < Math.floor(b[4] + 1); y++) for (let z = Math.floor(b[2]); z < Math.floor(b[5] + 1); z++) if (test(x, y, z)) return true;
        return false;
      };
      const env = {
        difficulty: 2, thundering: false, skyLight: () => 0, lightValue: () => 0, entityCollision: () => false,
        blockCollision: (b) => cells(b, 1, (x, y, z) => y < r.floor && boxesIntersect(b, [x, y, z, x + 1, y + 1, z + 1])), liquid: () => false,
      };
      const ok = monsterCanSpawnHere(mob, env, new JavaRandom(mob.seed));
      row.attempts.push({ type: TYPE_NAME[mob.type], x: mob.x, y: mob.y, z: mob.z, yaw: mob.yaw, ok });
      return ok;
    },
    initMob: (mob) => { if (mob.type === "spider") spiderSpawnRolls(new JavaRandom(0), random, 2, 0); },
    applyProperties: (mob, props) => {
      const pos = props.get("Pos")?.value?.items;
      if (pos) [mob.x, mob.y, mob.z] = pos;
    },
    addMob: (mob) => { entities.push(mob); row.spawned.push({ x: mob.x, y: mob.y, z: mob.z, yaw: mob.yaw }); },
    spawnParticles: (x, y, z) => row.aux.push([x, y, z, 0]),
    blockEvent: (s, id, data) => { assert.deepEqual([id, data], [1, 0]); row.events++; },
  };
  let state = random.seed.toString(), spawned = 0;
  for (const want of r.ticks) {
    row = { attempts: [], spawned: [], aux: [], events: 0 };
    random.calls = 0;
    const at = `${r.name} tick ${want.t}`;
    if (want.t === r.killTick) carts.attack(cart, 5, { source: null });
    if (!cart.dead) {
      carts.tick(world, { entities: [], host: {} });
      assert.deepEqual([cart.x, cart.posY, cart.z, cart.vx, cart.vy, cart.vz], want.cart.slice(0, 6), `${at} cart`);
      for (const s of liveCartSpawners(carts)) {
        assert.deepEqual([s.x, s.y, s.z], want.pos, `${at} floor position`);
        updateSpawner(s, ctx);
      }
    }
    assert.equal(cart.spawner.delay, want.delay, `${at} delay`);
    assert.equal(random.calls, want.calls ?? 0, `${at} World.rand calls`);
    if (want.state) state = want.state;
    assert.equal(random.seed.toString(), state, `${at} World.rand state`);
    assert.deepEqual(row.attempts, want.attempts ?? [], `${at} attempts`);
    assert.deepEqual(row.spawned, want.spawned ?? [], `${at} spawned`);
    assert.deepEqual(row.aux, want.aux ?? [], `${at} aux 2004 at the floored cart position`);
    assert.equal(row.events, want.events ?? 0, `${at} entity events`);
    const out = carts.drain();
    assert.equal(out.length, want.drops?.length ?? 0, `${at} drops`);
    (want.drops ?? []).forEach(([id, count, damage, dx, dy, dz, , , , delay], k) => {
      const d = out[k], mapped = itemFromOriginal(id, damage);
      assert.deepEqual([d.stack.id, d.original], [mapped.id, null], `${at} drop`);
      assert.deepEqual([d.stack.count, d.x, d.posY, d.z, d.delay], [count, dx, dy, dz, delay], `${at} drop position`);
    });
    spawned += row.spawned.length;
  }
  return spawned;
}

for (const r of ref.scenarios.filter((x) => !x.remote))
  test(`MinecartSpawner server replay: ${r.name}`, () => {
    const spawned = replayServer(r);
    assert.equal(spawned, r.ticks.reduce((a, t) => a + (t.spawned?.length ?? 0), 0));
  });

test("MinecartSpawner client replay: particles and the spinning mob", () => {
  const r = by.client, carts = new Minecarts({});
  const cart = carts.spawnCart(4, { x: r.cart[0], y: r.cart[1], z: r.cart[2], spawner: recordOf(r) }, { seed: 1000 });
  const random = new Counting(r.worldSeed);
  let particles, state = random.seed.toString();
  const ctx = { random, players: [{ x: r.player[0], y: r.player[1], z: r.player[2] }], particle: (name, x, y, z) => particles.push([name, x, y, z]) };
  for (const want of r.ticks) {
    particles = []; random.calls = 0;
    for (const s of liveCartSpawners({ carts: [{ type: 4, dead: false, spawner: cart.spawner, x: want.cart[0], posY: want.cart[1], z: want.cart[2] }] })) {
      assert.deepEqual([s.x, s.y, s.z], want.pos);
      updateSpawnerClient(s, ctx);
    }
    const at = `client tick ${want.t}`;
    assert.equal(cart.spawner.client.delay, want.delay, `${at} delay`);
    assert.equal(cart.spawner.client.rotation, want.rot, `${at} rotation`);
    assert.equal(cart.spawner.client.prevRotation, want.prev, `${at} prevRotation`);
    assert.deepEqual(particles, want.particles, `${at} particles`);
    if (want.state) state = want.state;
    assert.equal(random.seed.toString(), state, `${at} state`);
  }
});

test("spawner cart evidence covers what the task names", () => {
  const total = ref.scenarios.reduce((a, r) => a + r.ticks.reduce((b, t) => b + (t.spawned?.length ?? 0), 0), 0);
  assert.ok(total >= 40, `spawned ${total}`);
  // The floored position follows the falling and the moving cart.
  assert.ok(new Set(by["falling-default-delays"].ticks.map((t) => t.pos.join())).size >= 5);
  assert.ok(new Set(by["moving-floor-position"].ticks.map((t) => t.pos.join())).size === 2);
  // SpawnPotentials roll both entries; SpawnData Pos replaces the rolled position after the spawn check.
  const types = new Set(by["potentials-weighted"].ticks.flatMap((t) => (t.attempts ?? []).map((a) => a.type)));
  assert.deepEqual([...types].sort(), ["CaveSpider", "Spider"]);
  assert.ok(by["spawn-data-pos"].ticks.some((t) => t.spawned?.every((p) => p.x === 10.5 && p.y === 19 && p.z === 9.5)));
  // No player in range, an unknown id and a killed cart do nothing; breaking it drops one plain minecart (328).
  for (const n of ["no-player", "player-out-of-range", "unknown-id"]) assert.ok(by[n].ticks.every((t) => !t.spawned && !t.calls));
  assert.deepEqual(by["kill-drops-minecart"].ticks.flatMap((t) => t.drops ?? []).map((d) => [d[0], d[1]]), [[328, 1]]);
});

test("WeightedRandom.getRandomItem: total weight, nextInt(total), subtract", () => {
  const e = [{ type: "A", weight: 1 }, { type: "B", weight: 3 }, { type: "C", weight: 0 }];
  const seen = { A: 0, B: 0, C: 0 };
  const rnd = new JavaRandom(7);
  for (let i = 0; i < 400; i++) seen[pickWeighted(rnd, e).type]++;
  assert.equal(seen.C, 0);
  assert.ok(seen.B > seen.A * 2);
  assert.equal(pickWeighted(new JavaRandom(1), [{ type: "A", weight: 0 }]), null);
});

test("summoning MinecartSpawner without EntityId reads the empty EntityId and Delay 0 like readEntityFromNBT", () => {
  const carts = new Minecarts({});
  const tag = new Map([["SpawnRange", { type: NBT.SHORT, value: 2 }]]);
  const res = summonCart(carts, 4, 1.5, 70, 1.5, tag);
  assert.deepEqual(res.ignored, []);
  const s = carts.carts[0].spawner;
  assert.deepEqual([s.entityId, s.delay, s.spawnRange, s.minSpawnDelay], ["", 0, 2, 200]);
  // Without a data tag the constructor's defaults stand.
  const bare = new Minecarts({});
  summonCart(bare, 4, 0.5, 70, 0.5, null);
  assert.deepEqual([bare.carts[0].spawner.entityId, bare.carts[0].spawner.delay], ["Pig", 20]);
});

test("bytecode facts recorded for the renderer and CommandSummon", () => {
  assert.match(ref.render.spawnerCart.mobArguments, /absolute world coordinates/);
  assert.match(ref.summon.riding.loop, /mountEntity/);
  assert.deepEqual(Object.keys(ref.classes).sort(), ["agq", "agr", "bmp", "boi", "boj", "bu", "xl", "xt", "xu"]);
});

test("region export writes the spawner cart and a block spawner's SpawnData and SpawnPotentials", async () => {
  const { World } = await import("./world.js");
  const { Survival } = await import("./survival.js");
  const { exportJavaSave } = await import("./region-export.js");
  const { readRegion, decodeRegionChunk, regionAddress, regionSlot } = await import("./region-file.js");
  const { chunkFromNbt } = await import("./chunk-nbt.js");
  const w = new World("17", "javaStreamed", 12);
  w.restore([["-1,100,-1", 1]]);
  const carts = new Minecarts({});
  carts.spawnCart(4, { x: -0.5, y: 101, z: -0.5, spawner: spawnerRecord(fromProbe(by["spawn-data-spider"].input).value) }, { seed: 1 });
  const r = { id: "export", name: "Export", seed: "17", biome: "javaStreamed", generationVersion: 12, mode: "survival", edits: [...w.edits], player: new Survival({}, "survival").serialize(),
    position: { x: -0.5, y: 102, z: -0.5, yaw: 0, pitch: 0 }, minecarts: carts.toJSON(), updated: 1700000000000 };
  const { files } = await exportJavaSave(r, { world: w });
  const cx = -1 + w.originX / 16, cz = -1 + w.originZ / 16, a = regionAddress(cx, cz);
  const c = chunkFromNbt(await decodeRegionChunk(readRegion(files.get(`region/r.${a.regionX}.${a.regionZ}.mca`)).get(regionSlot(a.x, a.z))));
  const cart = c.entities.find((e) => e.get("id").value === "MinecartSpawner");
  assert.ok(cart, "MinecartSpawner entity");
  assert.equal(cart.get("EntityId").value, "Spider");
  assert.equal(cart.get("SpawnData").value.get("id").value, "Spider");
  const pot = cart.get("SpawnPotentials").value;
  assert.equal(pot.elementType, 10);
  assert.equal(pot.items[0].get("Type").value, "Spider");
  assert.equal(cart.get("SpawnRange").value, 4);
});

test("a block spawner's SpawnData and SpawnPotentials survive the Anvil export and import", async () => {
  const { World } = await import("./world.js");
  const { exportJavaSave } = await import("./region-export.js");
  const { importJavaRegionArea } = await import("./region-import.js");
  const w = new World("17", "javaStreamed", 12);
  w.restore([]);
  const s = stateOf(ref.nbt.find((n) => n.name === "spawn-data-and-potentials").input);
  const spawner = { x: -1, y: 103, z: -1, ...spawnerJSON(s) };
  const record = { id: "dimensions", name: "Dimensions", seed: "17", biome: "javaStreamed", generationVersion: 12, mode: "survival", dimension: 1, position: { x: -0.5, y: 110, z: -0.5 },
    edits: [], portalState: { c: 0, t: 0 }, worldSpawn: [35, 68, 70],
    dimensions: { [-1]: { edits: [["-1,103,-1", 62]], state: { spawners: [spawner] } }, [1]: { edits: [], state: {} } } };
  const { files } = await exportJavaSave(record, { world: w });
  const filename = "r.-1.-1.mca";
  const { record: imported } = await importJavaRegionArea([{ filename, bytes: files.get(`DIM-1/region/${filename}`) }], { seed: "17", dimension: -1, area: { chunkX: -1, chunkZ: -1, width: 1, depth: 1 } });
  const back = imported.dimensions[-1].state.spawners[0];
  assert.deepEqual(JSON.parse(JSON.stringify(back)), JSON.parse(JSON.stringify(spawner)));
});
