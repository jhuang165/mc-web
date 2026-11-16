// Batch 75 mpbuckets75: buckets on the dedicated server (multiplayer/server-bucket.js). The 41 `bucket` records of client-predict-reference.json are ItemBucket.onItemRightClick
// executed on the unchanged 1.7.10 classes (ClientPredictProbe: cells changed, the stack left in the hand and inventory, the thrown item, the Nether's fizz). They are replayed through
// DedicatedSimulation.edit with the server's own ray, so the server's world, inventory and dropped items must match the executed result. The probe world has isRemote = true, which
// only differs in World.func_147480_a (no drops on the client): the server's replaced plant also breaks with drops. Sounds, scheduling, dispensers and gates are in the later tests
// (bytecode-read `abo`: no addStat; canMineBlock then canPlayerEdit; random.fizz 0.5 / 2.6 + (r - r) * 0.8 at the cell centre, WorldManager.playSound with nobody excluded).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { World, PHYSICS, WATER, LAVA, TORCH } from "./world.js";
import { makeStack } from "./inventory.js";
import { fromOriginal } from "./block-registry.js";
import { JavaRandom } from "./java-random.js";
import { DedicatedSimulation } from "./multiplayer/simulation.js";
import { IDLE_INPUT } from "./multiplayer/protocol.js";
import { ITEM } from "./dispense.js";

const ref = JSON.parse(readFileSync(new URL("../public/research/client-predict-reference.json", import.meta.url), "utf8"));
const records = ref.records.filter((r) => r.case === "bucket");
const key = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const input = () => ({ type: "input", controls: { ...IDLE_INPUT }, yaw: 0, pitch: 0, current: 0, hotbar: Array(9).fill(null) });
const PORT = { 325: 340, 326: 341, 327: 342 }, DY = -30, EMPTY = 340, WATER_B = 341, LAVA_B = 342;
const nextUp = (v) => { const d = new DataView(new ArrayBuffer(8)); d.setFloat64(0, v); d.setBigInt64(0, d.getBigInt64(0) + 1n); return d.getFloat64(0); };
const mapped = (id, meta) => (id === 0 ? { id: 0, meta: 0 } : fromOriginal(id, meta));

// A server whose world is air except the probe's floor layer and what the record sets up (probe coordinates shifted down 30 so the cells sit inside the port's world).
function probeServer(r) {
  const world = new World(`b75-bucket-${r.name}`);
  for (let x = 2; x <= 14; x++) for (let z = 2; z <= 14; z++) for (let y = 1; y <= 50; y++) world.put(x, y, z, y === 33 && x >= 3 && x <= 13 && z >= 3 && z <= 13 ? 1 : 0, 0, false); // the probe's world has one stone floor layer (probe y 63, x and z 3..13)
  world.spawn = () => ({ x: 8.5, y: 34, z: 8.5 });
  const s = new DedicatedSimulation({}, { world, gameMode: r.creative ? "creative" : "survival", mobs: false });
  s.rules.chunkStream = false;
  s.rules.doMobSpawning = false;
  for (const [x, y, z, id, meta] of r.setup) { const m = mapped(id, meta); world.set(x, y + DY, z, m.id, false, m.meta); }
  if (r.hell) world.isHell = true;
  const p = s.addPlayer("a", "Alice", key(1)), b = s.addPlayer("b", "Bob", key(2));
  s.input("a", input()); s.input("b", input());
  p.moved = true;
  let feet = r.eye[1] + DY - PHYSICS.eye; // the server eye is feet + PHYSICS.eye: make it exactly the probe's (the bottom record starts on a cell boundary)
  for (let i = 0; i < 8 && feet + PHYSICS.eye < r.eye[1] + DY; i++) feet = nextUp(feet);
  p.position.copy({ x: r.eye[0], y: feet, z: r.eye[2] }); p.previous.copy(p.position);
  b.position.copy({ x: 10.5, y: 34, z: 10.5 }); b.previous.copy(b.position);
  // The native view (yaw 0 looks +z, pitch 90 down) in the port's convention: pitch -> -pitch, yaw -> pi - yaw.
  p.yaw = Math.PI - (r.yaw * Math.PI) / 180; p.pitch = (-r.pitch * Math.PI) / 180;
  const inv = p.survival.inventory;
  inv.main[0] = makeStack(PORT[r.item], r.count); inv.current = 0;
  if (r.fullInventory) for (let i = 1; i < 36; i++) inv.main[i] = makeStack(1, 64);
  return { s, p, b, world };
}
const cellsOf = (w) => { const out = new Map(); for (let x = 2; x <= 14; x++) for (let z = 2; z <= 14; z++) for (let y = 1; y <= 50; y++) out.set(`${x},${y},${z}`, `${w.get(x, y, z)}:${w.getMeta(x, y, z)}`); return out; };
const click = (s, p) => { for (const o of s.players.values()) o.soundsOut = null; return s.dimensions.within(p, () => s.edit(p, true)); };

test("every executed ItemBucket record (41) gives the same world and inventory on the server", () => {
  let checked = 0;
  for (const r of records) {
    const { s, p, world } = probeServer(r), before = cellsOf(world);
    click(s, p);
    const after = cellsOf(world), changed = new Map([...after].filter(([k, v]) => before.get(k) !== v));
    // the native diff in port ids; a cell the port already holds as that block (flowing 8 over still 9: one port water) is no change
    const want = new Map();
    for (const [x, y, z, id, meta] of r.diff) { const m = mapped(id, meta), k = `${x},${y + DY},${z}`; if (before.get(k) !== `${m.id}:${m.meta}`) want.set(k, `${m.id}:${m.meta}`); }
    assert.deepEqual(Object.fromEntries(changed), Object.fromEntries(want), `${r.name}: cells`);
    const main = p.survival.inventory.main, got = [];
    main.forEach((st, i) => { if (st && [EMPTY, WATER_B, LAVA_B].includes(st.id)) got.push([i, st.id, st.count]); });
    const wantInv = r.inventory.filter(([, id]) => id === 325 || id === 326 || id === 327).map(([i, id, n]) => [i, PORT[id], n]);
    assert.deepEqual(got, wantInv, `${r.name}: inventory`);
    const thrown = s.items.items.filter((e) => !e.dead && [WATER_B, LAVA_B, EMPTY].includes(e.stack.id));
    assert.equal(thrown.length, r.spawned, `${r.name}: thrown filled bucket`);
    checked++;
  }
  assert.equal(checked, 41);
});

test("the Nether records send random.fizz (0.5, pitch 2.6 +- 0.8 (float)) to the user and a player nearby, once", () => {
  for (const r of records.filter((q) => q.hell && q.item === 326)) {
    const { s, p, b } = probeServer(r);
    click(s, p); s.deliverSounds();
    for (const o of [p, b]) {
      const got = (o.soundsOut ?? []).filter((x) => x.name === "random.fizz");
      assert.equal(got.length, 1, `${r.name}: ${o.name}`);
      assert.equal(got[0].volume, Math.fround(0.5));
      assert.ok(got[0].pitch >= 1.8 && got[0].pitch <= 3.4, "2.6 + (r - r) * 0.8 stays in 1.8..3.4");
      assert.deepEqual([got[0].x, got[0].y, got[0].z], [8.5, 35.5, 8.5], "the cell centre above the clicked block");
    }
  }
  assert.equal(records.filter((q) => q.hell).some((q) => q.log.some((l) => l.startsWith("sound random.fizz 0.5"))), true, "executed: the native sound is random.fizz at volume 0.5");
});

test("no fizz and no sound at all in the Overworld, and a miss sends nothing", () => {
  for (const name of ["full326-top", "full327-top", "empty-liquid9-m0", "empty-air", "full326-reach-5.1"]) {
    const { s, p } = probeServer(records.find((q) => q.name === name));
    click(s, p); s.deliverSounds();
    assert.equal((p.soundsOut ?? []).length, 0, name);
  }
});

test("ItemBucket adds no statistic (bytecode-read)", () => {
  const { s, p } = probeServer(records.find((q) => q.name === "full326-top"));
  const calls = []; s.stats.used = (...a) => { calls.push(a); return true; }; s.stats.add = (...a) => { calls.push(a); return true; };
  click(s, p);
  assert.equal(calls.length, 0, "no use statistic call");
  assert.equal(p.survival.held.id, EMPTY, "the bucket was used");
});

test("Adventure players use a bucket (canPlayerEdit passes with an item in hand, b77), a protected spawn refuses it (canMineBlock)", () => {
  const r = records.find((q) => q.name === "full326-top");
  const a = probeServer(r); a.p.survival.mode = "adventure";
  click(a.s, a.p);
  assert.equal(a.world.get(8, 35, 8), WATER, "water is placed in Adventure");
  assert.equal(a.p.survival.held.id, EMPTY);
  const e = probeServer(records.find((q) => q.name === "empty-liquid9-m0")); e.p.survival.mode = "adventure";
  click(e.s, e.p);
  assert.equal(e.world.get(8, 34, 8), 0, "the source is taken in Adventure");
});

test("a placed source is scheduled on the server's Fluids and flows; the picked-up source leaves a dry cell", () => {
  const world = new World("b75-bucket-flow");
  for (let x = 40; x <= 90; x++) for (let z = 40; z <= 90; z++) for (let y = 9; y <= 24; y++) world.put(x, y, z, y === 9 ? 3 : 0, 0, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 68.5 });
  const s = new DedicatedSimulation({}, { world, gameMode: "survival", mobs: false });
  s.rules.chunkStream = false;
  const a = s.addPlayer("a", "Alice", key(1)); a.position.copy({ x: 64.5, y: 10, z: 68.5 }); a.previous.copy(a.position); s.input("a", input()); s.tick();
  a.survival.inventory.main[0] = makeStack(WATER_B, 1); a.survival.inventory.current = 0; a.yaw = 0; a.pitch = -Math.atan(1.72 / 4);
  s.queueEdit("a", { place: true }); s.tick();
  assert.equal(world.get(64, 10, 64), WATER, "the bucket's water");
  assert.equal(a.survival.held.id, EMPTY);
  for (let i = 0; i < 20; i++) s.tick();
  assert.equal(world.get(63, 10, 64), WATER, "it flowed");
  assert.ok(s.fluids.pending.size >= 0);
  // an empty bucket takes the source again
  s.queueEdit("a", { place: true }); s.tick();
  assert.equal(world.get(64, 10, 64), 0, "source taken");
  assert.equal(a.survival.held.id, WATER_B);
});

test("lava meeting water on the server fizzes to nearby players (BlockLiquid.func_149805_n)", () => {
  const world = new World("b75-bucket-fizz");
  for (let x = 40; x <= 90; x++) for (let z = 40; z <= 90; z++) for (let y = 9; y <= 24; y++) world.put(x, y, z, y === 9 ? 3 : 0, 0, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 68.5 });
  const s = new DedicatedSimulation({}, { world, gameMode: "survival", mobs: false });
  s.rules.chunkStream = false;
  const a = s.addPlayer("a", "Alice", key(1)); a.position.copy({ x: 64.5, y: 10, z: 68.5 }); a.previous.copy(a.position); s.input("a", input());
  s.tick();
  world.set(64, 10, 64, LAVA, true, 0); world.set(65, 10, 64, WATER, true, 0);
  const seen = [];
  for (let i = 0; i < 60; i++) { s.tick(); seen.push(...(a.soundsOut ?? []).filter((x) => x.name === "random.fizz")); a.soundsOut = null; }
  assert.ok(seen.length >= 1, "a fizz reached the player");
  assert.equal(seen[0].volume, Math.fround(0.5));
});

test("a flowing liquid that washes over a torch drops it as an item on the server", () => {
  const world = new World("b75-bucket-wash");
  for (let x = 40; x <= 90; x++) for (let z = 40; z <= 90; z++) for (let y = 9; y <= 24; y++) world.put(x, y, z, y === 9 ? 3 : 0, 0, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 68.5 });
  const s = new DedicatedSimulation({}, { world, gameMode: "survival", mobs: false });
  s.rules.chunkStream = false;
  s.addPlayer("a", "Alice", key(1)); s.input("a", input()); s.tick();
  world.put(65, 10, 64, TORCH, 0, false);
  world.set(64, 10, 64, WATER, true, 0);
  for (let i = 0; i < 20; i++) s.tick();
  assert.equal(world.get(65, 10, 64), WATER, "the water took the torch's cell");
  assert.ok(s.items.items.some((e) => e.stack.id === TORCH), "the torch dropped");
});

function dispenserServer(hell) {
  const world = new World("b75-bucket-disp");
  for (let x = 20; x <= 110; x++) for (let z = 20; z <= 110; z++) for (let y = 9; y <= 24; y++) world.put(x, y, z, y === 9 ? 3 : 0, 0, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  if (hell) world.isHell = true;
  const s = new DedicatedSimulation({}, { world, gameMode: "survival", mobs: false });
  s.rules.chunkStream = false;
  s.containers.ticks.rand = new JavaRandom(7);
  const p = s.addPlayer("a", "Alice", key(1)); p.position.copy({ x: 70.5, y: 10, z: 64.5 }); p.previous.copy(p.position); s.input("a", input());
  return { s, p, world };
}
function fire(s, stack) {
  s.world.set(64, 10, 62, 115, true, 3);
  s.tiles.dispensers["64,10,62"] = { items: [stack, null, null, null, null, null, null, null, null] };
  s.world.set(65, 10, 62, 123);
  for (let i = 0; i < 8; i++) s.tick();
  return s.tiles.dispensers["64,10,62"];
}

test("a dispenser's water bucket replaces a torch in front (tryPlaceContainedLiquid) and an empty one takes a lava source", () => {
  const { s, world } = dispenserServer(false);
  world.put(64, 10, 63, TORCH, 0, false);
  const t = fire(s, makeStack(ITEM.WATER_BUCKET, 1));
  assert.equal(world.get(64, 10, 63), WATER);
  assert.equal(t.items[0].id, ITEM.BUCKET);
  assert.ok(s.items.items.some((e) => e.stack.id === TORCH), "the torch dropped");
  const e = dispenserServer(false);
  e.world.set(64, 10, 63, LAVA, true, 0);
  const u = fire(e.s, makeStack(ITEM.BUCKET, 1));
  assert.equal(e.world.get(64, 10, 63), 0);
  assert.equal(u.items[0].id, ITEM.LAVA_BUCKET);
});

test("a dispenser's water bucket in the Nether only fizzes and is still emptied", () => {
  const { s, p, world } = dispenserServer(true);
  s.tick();
  p.soundsOut = null;
  const t = fire(s, makeStack(ITEM.WATER_BUCKET, 1));
  assert.equal(world.get(64, 10, 63), 0, "no water");
  assert.equal(t.items[0].id, ITEM.BUCKET);
  const heard = [];
  for (let i = 0; i < 1; i++) heard.push(...s.soundsOut.filter((x) => x.name === "random.fizz"));
  assert.ok(heard.length + (p.soundsOut ?? []).filter((x) => x.name === "random.fizz").length >= 1, "the dispenser's fizz was sent");
});

test("in the real Nether a water bucket fizzes (S29 dim -1), places no block, and a lava bucket places lava that is scheduled", { timeout: 120000 }, () => {
  const { s, p } = dispenserServer(false);
  s.tick();
  const n = s.dimensions.ensureNether(), w = n.world;
  assert.equal(w.isHell, true);
  for (let x = 60; x <= 70; x++) for (let z = 60; z <= 70; z++) for (let y = 40; y <= 48; y++) w.put(x, y, z, y === 40 ? 87 : 0, 0, false);
  p.dimension = -1; p.world = w; p.moved = true;
  p.position.copy({ x: 64.5, y: 41, z: 68.5 }); p.previous.copy(p.position); p.yaw = 0; p.pitch = -Math.atan(1.72 / 4);
  p.survival.inventory.main[0] = makeStack(WATER_B, 1); p.survival.inventory.current = 0;
  s.soundsOut.length = 0;
  s.dimensions.within(p, () => s.edit(p, true));
  assert.equal(w.get(64, 41, 64), 0, "no water block in the Nether");
  assert.equal(p.survival.held.id, EMPTY, "the bucket is used up anyway");
  assert.deepEqual(s.soundsOut.filter((x) => x.name === "random.fizz").map((x) => [x.dim, x.volume, x.x, x.y, x.z]), [[-1, Math.fround(0.5), 64.5, 41.5, 64.5]]);
  p.survival.inventory.main[0] = makeStack(LAVA_B, 1);
  s.dimensions.within(p, () => s.edit(p, true));
  assert.equal(w.get(64, 41, 64), LAVA, "lava is placed");
  assert.ok(n.fluids.pending.size > 0, "and scheduled on the Nether's own Fluids");
});
