// SpawnData / SpawnPotentials Riding chains (spawner-riding.js, entities.js spawnerMount, structure-simulation.js spawnerVehicle) replayed against
// public/research/spawn-data-reference.json: the unchanged EntityMinecartMobSpawner / MobSpawnerBaseLogic.a(sa) (tools/probes/SpawnDataProbe.java).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { JavaRandom } from "./java-random.js";
import { solidBlock } from "./world.js";
import { Minecarts } from "./minecarts.js";
import { Boats } from "./boats.js";
import { EntityWorld } from "./entities.js";
import { NBT } from "./nbt.js";
import { spawnerRecord } from "./cart-summon.js";
import { liveCartSpawners, spawnerVehicle } from "./structure-simulation.js";
import { makeSpawner, readNBT, updateSpawner, MobSpawners } from "./mob-spawner.js";
import { ridingChain, spawnRidingChain, creatableEntity } from "./spawner-riding.js";

const ref = JSON.parse(await readFile(new URL("../public/research/spawn-data-reference.json", import.meta.url)));
const by = Object.fromEntries(ref.scenarios.map((s) => [s.name, s]));
const NAMES = { zombie: "Zombie", skeleton: "Skeleton", spider: "Spider", pig: "Pig", chicken: "Chicken", creeper: "Creeper" };

class Counting extends JavaRandom {
  constructor(seed) { super(seed); this.calls = 0; }
  next(bits) { this.calls++; return super.next(bits); }
}
function fromProbe(t) {
  const value = (type, v) => {
    if (type === NBT.COMPOUND) return new Map(v.map(([k, c]) => [k, fromProbe(c)]));
    if (type === NBT.LIST) return { elementType: v.elementType, items: v.items.map((i) => value(v.elementType, i)) };
    return v;
  };
  return { type: t.type, value: value(t.type, t.value) };
}

const unblock = (e) => { e.health = 0; e.death = 20; };
const FLOOR = ref.scenarios[0].floor;
const floorWorld = { numericSeed: 1, get: (x, y, z) => (y < FLOOR ? 3 : 0), getMeta: () => 0, solid: (x, y, z) => solidBlock(y < FLOOR ? 3 : 0, 0), surface: () => FLOOR, spawn: () => ({ x: 8, y: FLOOR, z: 8 }) };

// One scenario on the real pieces: the cart's physics, the spawner logic, EntityWorld's spawner hooks (mobs) and spawnerVehicle (carts, boats).
// `unblocked`: the probe's World.getCollidingBoundingBoxes(entity, box) returns no entities, so spawned mobs never block each other there; the port's
// spawn check does count them, so replays that compare long runs mark each spawned mob as dead for the purposes of pushable() (health 0, death 20).
function replay(r, { unblocked = true, run = r.run } = {}) {
  const carts = new Minecarts({}), extra = new Minecarts({}), boats = new Boats();
  const cart = carts.spawnCart(4, { x: r.cart[0], y: r.cart[1], z: r.cart[2], spawner: spawnerRecord(fromProbe(r.input).value) }, { seed: 1000 });
  const mobs = new EntityWorld(floorWorld, [], () => 0.5), random = new Counting(r.worldSeed);
  mobs.difficulty = 2;
  mobs.worldRandom = random;
  const spawnedAll = [], hooks = mobs.spawnerHooks({ skyLight: () => 0, lightValue: () => 0, thunderLightValue: () => 0, limit: 1000, spawnVehicle: (id, tag, rider) => spawnerVehicle({ minecarts: extra, boats }, id, tag, rider) });
  const ctx = {
    ...hooks, random, players: [{ x: r.player[0], y: r.player[1], z: r.player[2] }],
    addMob: (e) => { hooks.addMob(e); spawnedAll.push(e); if (unblocked) unblock(e); },
    spawnMount: (id, tag, rider) => { const m = hooks.spawnMount(id, tag, rider); if (m) { spawnedAll.push(m); if (unblocked && !m.slots && !m.boat) unblock(m); } return m; },
  };
  const rows = [];
  let state = random.seed.toString(), base = 0;
  for (let t = 0; t < run; t++) {
    random.calls = 0;
    carts.tick(floorWorld, { entities: [], host: {} });
    let crashed = false;
    for (const s of liveCartSpawners(carts)) crashed = updateSpawner(s, ctx).crashed === true;
    const want = r.ticks.find((x) => x.t === t), at = `${r.name} tick ${t}`;
    assert.equal(random.calls, want?.calls ?? 0, `${at} World.rand calls`);
    if (want) state = want.state;
    assert.equal(random.seed.toString(), state, `${at} World.rand state`);
    assert.equal(crashed, want?.error === "NullPointerException", `${at} NullPointerException`);
    if (want) assert.equal(cart.spawner.delay, want.delay, `${at} delay`);
    const made = spawnedAll.slice(base);
    base = spawnedAll.length;
    assert.equal(made.length, want?.entities.length ?? 0, `${at} entities spawned`);
    made.forEach((e, i) => {
      const w = want.entities[i], id = e.boat ? "Boat" : e.slots ? ["MinecartRideable", "MinecartChest"][e.type] : NAMES[e.type];
      const [x, y, z] = e.slots || e.boat ? [e.x, e.posY, e.z] : [e.x, e.y, e.z];
      assert.deepEqual([id, x, y, z], [w.id, w.x, w.y, w.z], `${at} entity ${i} (${w.id}) position`);
      if (!e.slots && !e.boat) assert.deepEqual([e.rotationYaw, e.rotationPitch], [Math.fround(w.yaw), w.pitch], `${at} entity ${i} angles`);
      else if (e.boat) assert.equal(e.yaw, Math.fround(w.yaw), `${at} boat yaw`);
      const rides = e.ridingEntity ? spawnedAll.indexOf(e.ridingEntity) : -1;
      const ridden = (e.riddenBy ?? e.passenger) ? spawnedAll.indexOf(e.riddenBy ?? e.passenger) : -1;
      assert.deepEqual([rides, ridden], [w.rides, w.ridden], `${at} entity ${i} riding links`);
    });
    if (want) rows.push(want);
  }
  return { spawned: spawnedAll.length, mobs, cart };
}

for (const r of ref.scenarios)
  test(`SpawnData Riding replay: ${r.name}`, () => {
    const out = replay(r);
    assert.equal(out.spawned, r.ticks.reduce((n, t) => n + t.entities.length, 0));
  });

test("the Riding loop reads the SpawnData Properties, not the written entity, for the next step", () => {
  const props = fromProbe(by["three-chain"].input).value.get("SpawnData").value;
  assert.deepEqual(ridingChain(props).map((c) => c.id), ["Chicken", "Pig"]);
  assert.deepEqual(ridingChain(new Map()), []);
  // A Riding that is not a compound, or a compound without an id (id ""), ends or yields an unmakeable step.
  assert.deepEqual(ridingChain(fromProbe(by["riding-not-compound"].input).value.get("SpawnData").value), []);
  assert.deepEqual(ridingChain(fromProbe(by["mount-missing-id"].input).value.get("SpawnData").value).map((c) => c.id), [""]);
});

test("the native NullPointerException case: an unmakeable id before a makeable one", () => {
  const props = fromProbe(by["mount-unknown-id"].input).value.get("SpawnData").value;
  const made = [], ctx = { spawnMount: (id, tag, rider) => { const m = { id, rider }; made.push(m); return m; } };
  const out = spawnRidingChain({ type: "zombie" }, props, ctx);
  assert.deepEqual([out.crashed, made.length], [true, 0]);
  // An unmakeable id with nothing makeable after it just ends the chain.
  const tail = fromProbe(by["mount-unknown-then-end"].input).value.get("SpawnData").value;
  assert.deepEqual(spawnRidingChain({ type: "zombie" }, tail, ctx), { mounts: [], crashed: false });
  assert.equal(creatableEntity("Mob"), false);
  assert.equal(creatableEntity("Spider"), true);
  assert.equal(creatableEntity("NoSuchMob"), false);
});

test("a spawned jockey keeps its link in a save and reloads as a mob pair", () => {
  const r = by["spider-jockey"], out = replay(r, { unblocked: false, run: 12 });
  const saved = JSON.parse(JSON.stringify(out.mobs.serialize())), loaded = new EntityWorld(floorWorld, saved);
  const riders = loaded.entities.filter((e) => e.ridingEntity);
  assert.equal(riders.length, 4);
  for (const e of riders) assert.equal(e.ridingEntity.type, "spider");
  assert.equal(riders.every((e) => e.type === "skeleton"), true);
});

test("/setblock mob_spawner reads SpawnData with its Riding chain, and it survives save JSON and a Java region round trip", async () => {
  const { World, MOB_SPAWNER } = await import("./world.js");
  const { createCommandHost } = await import("./command-host.js");
  const { exportJavaSave } = await import("./region-export.js");
  const { importJavaRegionArea } = await import("./region-import.js");
  const world = new World("17", "javaStreamed", 12);
  world.restore([]);
  const spawners = new MobSpawners(), survival = {};
  const host = createCommandHost({ active: () => ({ mode: "creative", allowCommands: true }), world: () => world, survival: () => survival, spawners: () => spawners,
    changed() {}, updateBlock() {}, refreshInventory() {}, destroyBlock() {} });
  const tag = fromProbe(by["three-chain"].input).value;
  assert.notEqual(host.setBlock(-1, 103, -1, 52, 0, "replace", tag), "unsupported");
  const placed = spawners.get(-1, 103, -1);
  assert.deepEqual(ridingChain(placed.spawnData.props).map((c) => c.id), ["Chicken", "Pig"]);
  // No tag: constructor defaults (Pig, delay 20).
  host.setBlock(-1, 104, -1, 52, 0, "replace", null);
  assert.deepEqual([spawners.get(-1, 104, -1).entityId, spawners.get(-1, 104, -1).delay], ["Pig", 20]);
  const copy = MobSpawners.fromJSON(JSON.parse(JSON.stringify(spawners.toJSON())));
  assert.deepEqual(ridingChain(copy.get(-1, 103, -1).spawnData.props).map((c) => c.id), ["Chicken", "Pig"]);
  const record = { id: "sd", name: "SD", seed: "17", biome: "javaStreamed", generationVersion: 12, mode: "survival", dimension: 0,
    position: { x: -0.5, y: 110, z: -0.5 }, edits: [], dimensions: { [-1]: { edits: [["-1,103,-1", MOB_SPAWNER]], state: { spawners: spawners.toJSON() }, tiles: {} } } };
  const { files } = await exportJavaSave(record, { world });
  const dx = -1, dz = -1; // Nether columns carry no overworld origin offset
  const filename = "r.-1.-1.mca", bytes = files.get(`DIM-1/region/${filename}`);
  const { record: imported } = await importJavaRegionArea([{ filename, bytes }], { seed: "17", dimension: -1, area: { chunkX: dx, chunkZ: dz, width: 1, depth: 1 } });
  const back = MobSpawners.fromJSON(imported.dimensions[-1].state.spawners ?? []);
  const got = back.get(-1, 103, -1);
  assert.ok(got, "spawner imported");
  assert.deepEqual(ridingChain(got.spawnData.props).map((c) => c.id), ["Chicken", "Pig"]);
});
