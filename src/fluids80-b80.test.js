// Batch 80 fluids80: replays public/research/fluids80-reference.json (tools/probes/Fluids80Probe.java, run by tools/verify-fluids80.mjs on the unchanged 1.7.10 classes) and the
// pearl lava rows of spexec79-reference.json, plus the native tile reads of region import against the executed falling-tiles79 Sign and MobSpawner rows.
//  - land80: a falling 8/10 lands as the flowing block and schedules its tick; 9/11 land still with no tick.
//  - stack80: flowing and still fluid stacks are different items (no equality, no inventory or item-entity merge).
//  - fire80: an item's Fire after burning (or after loading a Fire) is the counter Entity.writeToNBT writes.
//  - pearl79 `fire`: a thrown pearl takes fire 300 in lava (server and client copy), burns down on the server, and its client copy only shows the watched flag.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { World, WATER, LAVA } from "./world.js";
import { Fluids } from "./fluids.js";
import { FallingBlocks } from "./falling.js";
import { fromOriginal } from "./block-registry.js";
import { PlayerInventory, sameStackItem } from "./inventory.js";
import { ITEMS } from "./survival.js";
import { ItemEntities } from "./item-entities.js";
import { Projectiles, GaussianRandom } from "./projectiles.js";
import { impactEnderPearl } from "./ender-pearl.js";
import { fallingDropStack } from "./falling-drops.js";
import { NBT, decodeNbt } from "./nbt.js";
import { nbtToJson } from "./spawner-data.js";
import { MobSpawners, spawnerJSON } from "./mob-spawner.js";
import { readSignTile, readSpawnerTile } from "./region-import.js";
import { javaProjectileFromNbt } from "./java-projectiles.js";
import { metaValues, objectView } from "./object-tracker.js";
import { populationBlockMapperReady } from "./population-world.js";

await populationBlockMapperReady;
const ref = JSON.parse(readFileSync(new URL("../public/research/fluids80-reference.json", import.meta.url), "utf8"));
const of = (kind) => ref.records.filter((r) => r.kind === kind);

test("the reference holds the executed records", () => {
  assert.match(ref.target, /1\.7\.10/);
  assert.equal(of("land80").length, 16);
  assert.equal(of("stack80").length, 8);
  assert.equal(of("fire80").length, 83);
});

// ---- falling fluid landing ------------------------------------------------------------------------------------------------------------------------------------
const X = 3, Y = 61, Z = 3; // the landing cell; stone below it
function landWorld() {
  const w = new World("fluids80");
  for (let x = 0; x < 8; x++) for (let z = 0; z < 8; z++) for (let y = 50; y < 80; y++) w.put(x, y, z, y === Y - 1 ? 1 : 0, 0, false);
  return w;
}
test("a falling flowing fluid (8/10) lands flowing with its tick; a still one (9/11) lands with none (executed land80)", () => {
  for (const r of of("land80")) {
    assert.equal(r.error, null);
    const w = landWorld(), fluids = new Fluids(w), cell = fromOriginal(r.block, 0);
    const fb = new FallingBlocks(w, {}, [{ block: cell.id, meta: r.meta, ...(cell.state?.flowing ? { flowing: true } : {}), x: X + 0.5, y: Y + 0.52 - 0.49, z: Z + 0.5, vx: 0, vy: 0, vz: 0, ticks: 2, onGround: false, fallDistance: 0 }]);
    for (let i = 0; i < 3 && fb.entities.some((e) => !e.dead); i++) fb.tick();
    const label = `block ${r.block} meta ${r.meta}`;
    assert.equal(r.dead, true);
    assert.equal(r.landed, r.block, label + " native lands as itself");
    assert.equal(w.get(X, Y, Z), cell.id, label + " landed block");
    assert.equal(w.getMeta(X, Y, Z), r.landedMeta, label + " landed metadata");
    const want = r.scheduled ? r.scheduled.split(";").map((s) => s.split(",").map(Number)).map(([, , , , delay]) => delay) : [];
    const got = [...fluids.pending.values()].filter((e) => e.x === X && e.y === Y && e.z === Z).map((e) => e.time - fluids.time);
    assert.deepEqual(got, want, label + " scheduled ticks");
    assert.equal(cell.id === WATER || cell.id === LAVA, true);
  }
});

// ---- fluid stacks ---------------------------------------------------------------------------------------------------------------------------------------------
const stackOf = (orig, count) => ({ ...fallingDropStack({ block: fromOriginal(orig, 0).id, meta: 0, ...(orig === 8 || orig === 10 ? { flowing: true } : {}) }), count });
const tag = (s) => `${s.rawId ?? { 10: 9, 42: 11 }[s.id]}x${s.count}`;
test("flowing and still fluid stacks stay different items in equality, the inventory and item entities (executed stack80)", () => {
  for (const r of of("stack80")) {
    const label = `${r.a} + ${r.b}`;
    assert.equal(r.itemA, r.a);
    assert.equal(r.itemB, r.b);
    const a = stackOf(r.a, 3), b = stackOf(r.b, 2);
    assert.equal(sameStackItem(a, b), r.isItemEqual, label + " isItemEqual");
    const inv = new PlayerInventory(ITEMS);
    assert.equal(inv.add({ ...a }), r.addA, label + " add a");
    assert.equal(inv.add({ ...b }), r.addB, label + " add b");
    const slots = inv.main.slice(0, 4).map((s) => (s ? tag(s) : "-")).join(",");
    assert.equal(slots, r.slots, label + " inventory slots");
    const items = new ItemEntities(() => 0.5);
    const ea = items.spawn({ ...a }, 0.5, 70, 0.5, { motion: [0, 0, 0] }), eb = items.spawn({ ...b }, 0.5, 70, 0.5, { motion: [0, 0, 0] });
    const combined = items.combine(ea, eb, () => 64);
    assert.equal(!!combined, r.combined, label + " combineItems");
    assert.equal(`${ea.stack.count},${eb.stack.count}`, r.entityCounts, label + " entity counts");
  }
});

// ---- item Fire ------------------------------------------------------------------------------------------------------------------------------------------------
function fireWorld() {
  const w = new World("fluids80-fire");
  for (let x = -2; x < 3; x++) for (let z = -2; z < 3; z++) for (let y = 20; y < 80; y++) w.put(x, y, z, 0, 0, false); // open air, as the probe (no block within reach)
  return w;
}
test("an item's saved Fire is its burning counter after ticks, and a loaded Fire burns on (executed fire80)", () => {
  const bad = [];
  for (const r of of("fire80")) {
    const w = fireWorld(), items = new ItemEntities(() => 0.5);
    let e;
    if (r.path === "set") {
      e = items.spawn({ id: 12, count: 1, damage: 0 }, 0.5, 70, 0.5, { motion: [0, 0, 0] });
      e.fire = r.start;
    } else {
      items.load([{ stack: { id: 12, count: 1, damage: 0 }, x: 0.5, y: 70 - 0.125, z: 0.5, mx: 0, my: 0, mz: 0, age: 7, delay: 0, fire: r.start }], (s) => s);
      e = items.items[0];
    }
    for (let i = 0; i < r.ticks && !e.dead; i++) items.tickOne(w, e);
    const saved = items.serializeOne(e);
    // the export writes Fire as region-export.js does: the saved counter, else -1 for an item that has aged
    const fire = Number.isInteger(saved.fire) ? saved.fire : (saved.age ?? 0) > 0 ? -1 : 0;
    const got = [fire, saved.age, e.health, !!e.dead].join(), want = [r.fire, r.age, r.health, r.dead].join();
    if (got !== want) bad.push(`${r.path} start ${r.start} ticks ${r.ticks}: port ${got} native ${want}`);
  }
  assert.deepEqual(bad, []);
});

// ---- thrown pearl in lava -------------------------------------------------------------------------------------------------------------------------------------
const spexec = JSON.parse(readFileSync(new URL("../public/research/spexec79-reference.json", import.meta.url), "utf8"));
const PORT_LIQUID = { 9: 10, 8: 10, 11: 42, 10: 42, 0: 0 };
test("a pearl takes fire 300 in lava on the server and the client copy, and the server's burns down a tick at a time (executed spexec79 pearl79)", () => {
  const rows = spexec.records.filter((r) => r.kind === "pearl79");
  assert.ok(rows.some((r) => r.ticks.some((t) => t.fire === 300)), "the reference has lava ticks");
  for (const r of rows) {
    const lid = PORT_LIQUID[r.liquid];
    const world = { get: (x, y, z) => (y <= r.floorTop ? 3 : y <= r.liquidTop && lid ? lid : 0), solid(x, y, z) { const id = this.get(x, y, z); return id !== 0 && id !== 10 && id !== 42; }, getMeta: () => 0, remote: r.remote };
    const pr = new Projectiles(() => 0.5);
    pr.remote = r.remote;
    pr.spawner = { spawn: () => {} };
    pr.sink = () => {};
    const rand = new GaussianRandom(9), owner = { kind: "playerMP", connected: true, world, riding: false, fallDistance: 12 };
    const b = { kind: "enderPearl", owner: "player", x: r.start[0], y: r.start[1], z: r.start[2], px: r.start[0], py: r.start[1], pz: r.start[2], mx: r.launch[0], my: r.launch[1], mz: r.launch[2], yaw: 0, pitch: 0, prevYaw: 0, prevPitch: 0, ticks: 0, rand, random: rand, dead: false };
    pr.balls.push(b);
    for (const t of r.ticks) {
      pr.tick(world, [], () => {}, ({ pearl, world: w, hit }) => impactEnderPearl(pearl, { world: w, owner, hit }, { particle: () => {}, teleport: () => {}, damage: () => true }));
      assert.equal(b.fire ?? 0, t.fire, `${r.name} remote=${r.remote} tick ${t.tick} fire`);
      if (b.dead && !r.remote) break;
    }
  }
});
test("a burning throwable: velocityChanged on its fire ticks, the watched flag, the client view, save and load, import", () => {
  const world = { get: () => 0, solid: () => false, getMeta: () => 0 };
  const pr = new Projectiles(() => 0.5);
  const b = { kind: "snowball", x: 0.5, y: 100, z: 0.5, px: 0.5, py: 100, pz: 0.5, mx: 0, my: 0, mz: 0, yaw: 0, pitch: 0, prevYaw: 0, prevPitch: 0, ticks: 0, rand: new GaussianRandom(1), dead: false, fire: 41 };
  pr.balls.push(b);
  pr.tick(world, [], () => {});
  assert.equal(b.fire, 40);
  assert.ok(!b.velocityChanged, "41 is not a 20th");
  pr.tick(world, [], () => {});
  assert.equal(b.fire, 39);
  assert.equal(b.velocityChanged, true, "attackEntityFrom(onFire) at 40 runs setBeenAttacked");
  assert.deepEqual(metaValues("snowball", { fire: b.fire })[0], [0, 0, 1]);
  assert.deepEqual(metaValues("snowball", { fire: 0 })[0], [0, 0, 0]);
  const saved = pr.serialize();
  assert.equal(saved[0].fire, 39);
  const again = new Projectiles(() => 0.5);
  again.load(saved);
  assert.equal(again.balls[0].fire, 39);
  // a client copy shows the watched flag, not the live counter
  const live = { x: 0, y: 0, z: 0, fire: 0 }, client = { x: 0, y: 0, z: 0, px: 0, py: 0, pz: 0, meta: new Map([[0, 1]]) };
  const tracker = { clientEntity: () => client };
  assert.equal(objectView(tracker, live, "enderPearl").burning, true);
  client.meta.set(0, 0);
  assert.equal(objectView(tracker, live, "enderPearl").burning, false);
  // region import: the Fire short of a Snowball / ThrownEnderpearl
  const entity = new Map([["Pos", { type: NBT.LIST, value: { elementType: NBT.DOUBLE, items: [1, 70, 1] } }], ["Fire", { type: NBT.SHORT, value: 120 }]]);
  for (const id of ["Snowball", "ThrownEnderpearl"]) { entity.set("id", { type: NBT.STRING, value: id }); assert.equal(javaProjectileFromNbt(entity).record?.fire, 120, id); }
});

// ---- region import Sign and MobSpawner tiles --------------------------------------------------------------------------------------------------------------------
const tiles = JSON.parse(readFileSync(new URL("../public/research/falling-tiles79-reference.json", import.meta.url), "utf8"));
const decode = (hex) => decodeNbt(Buffer.from(hex, "hex")).tag.value;
const str = (m, k) => { const t = m.get(k); return t?.type === NBT.STRING ? t.value : null; };
// The file compound a region holds is what TileEntity.readFromNBT gets: the merged compound of the falling rows (the fresh tile's entries, the data laid over them).
const merged = (r) => { const m = new Map(decode(r.base)); for (const [k, v] of decode(r.data)) if (k !== "x" && k !== "y" && k !== "z") m.set(k, v); return m; };
function nativeSpawner(t) {
  const out = Object.fromEntries(["EntityId", "Delay", "MinSpawnDelay", "MaxSpawnDelay", "SpawnCount", "MaxNearbyEntities", "RequiredPlayerRange", "SpawnRange"].map((k) => [k, t.get(k).value]));
  if (t.has("SpawnData")) out.SpawnData = { type: out.EntityId, weight: 1, props: nbtToJson({ type: NBT.COMPOUND, value: t.get("SpawnData").value }) };
  if (t.has("SpawnPotentials")) out.SpawnPotentials = t.get("SpawnPotentials").value.items.map((i) => ({ type: i.get("Type").value, weight: i.get("Weight").value, props: nbtToJson({ type: NBT.COMPOUND, value: i.get("Properties")?.value ?? new Map() }) }));
  return out;
}
test("region import reads Sign and MobSpawner tiles as their readFromNBT does (executed falling-tiles79 rows)", () => {
  const rows = tiles.tile.filter((r) => (r.name === "sign" || r.name === "spawner") && r.data && !r.error);
  assert.ok(rows.filter((r) => r.name === "sign").length >= 10 && rows.filter((r) => r.name === "spawner").length >= 15);
  const bad = [];
  for (const r of rows) {
    const t = decode(r.tile), m = merged(r);
    let port, native;
    if (r.name === "sign") { port = readSignTile(m); native = [1, 2, 3, 4].map((i) => str(t, `Text${i}`)); }
    else { port = spawnerJSON(new MobSpawners().add({ x: 1, y: 2, z: 3, ...readSpawnerTile(m) })); native = nativeSpawner(t); }
    if (JSON.stringify(port) !== JSON.stringify(native)) bad.push([r.name, r.label, JSON.stringify(port), JSON.stringify(native)]);
  }
  assert.deepEqual(bad, []);
});
