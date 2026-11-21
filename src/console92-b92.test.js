// Batch 92 console92: /netstat on the dedicated server counts the S1C of a changed watcher on the native schedule (not only inside a message that carries a packet for the mob), the
// creeper / enderman / wither watcher keys, a tracked cart's or boat's S1C after a join and its S12, and one S0E per TNT / fireball (then the entry's own packets) instead of one a tick.
// Evidence: tools/probes/Console92Probe.java -> public/research/console92-reference.json (executed on the unchanged 1.7.10 classes).
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PLAY_FRAME, writePackets, watchSweep, kindRecords } from "./multiplayer/net-packet-ids.js";
import { watchState, watchDiff, hooks } from "./multiplayer/net-watch-bytes.js";
import { setVehicleInfo, joinWatcher } from "./multiplayer/server-cart-track.js";
import { setRowInfo } from "./multiplayer/net-row-info.js";
import { TntTracks } from "./multiplayer/tnt-tracks.js";
import { primeTnt } from "./explosion.js";

const ref = JSON.parse(await readFile(new URL("../public/research/console92-reference.json", import.meta.url)));
const C = PLAY_FRAME.clientbound;
const watch = (mobs) => ({ memory: new Map(), mob: (i) => mobs[i] });
const changeOf = (id, index) => ref.changeall.find((r) => r.id === id).changes.find((c) => c[0] === index)[2];
const object = (id) => ref.objects.find((r) => r.id === id);
const mob = (type, extra = {}) => ({ type, health: 10, ...extra });

test("executed: the S1C of one changed creeper, enderman or wither entry, and the whole watcher of each tracked object", () => {
  for (const idx of [16, 17, 18]) { assert.equal(changeOf("Creeper", idx), 8); assert.equal(changeOf("Enderman", idx), 8); }
  for (const idx of [17, 18, 19, 20]) assert.equal(changeOf("WitherBoss", idx), 11);
  for (const r of ref.changeall) assert.equal(r.s0fChanged, ref.spawns.find((s) => s.id === r.id).s0f, `${r.id}: a changed value is the same S0F size`);
  assert.equal(ref.s12, C[18]);
  assert.equal(joinWatcher(true, 0), object("Boat").s1cWhole);
  for (const [type, name] of [[0, "MinecartRideable"], [1, "MinecartChest"], [2, "MinecartFurnace"], [3, "MinecartTNT"], [4, "MinecartSpawner"], [5, "MinecartHopper"], [6, "MinecartCommandBlock"]]) assert.equal(joinWatcher(false, type), object(name).s1cWhole, name);
  assert.deepEqual(["PrimedTnt", "Fireball", "SmallFireball", "WitherSkull"].map((n) => [object(n).s0e, object(n).s0eData, object(n).s1cWhole]), [[21, 27, 11], [21, 27, 11], [21, 27, 11], [21, 27, 13]]);
});

test("a still mob's changed watcher is one S1C on its own tick, nothing while unchanged", () => {
  const pig = mob("pig", { growingAge: -50 }), w = watch({ 4: pig });
  w.memory.set(4, watchState(pig));
  assert.deepEqual(watchSweep(w), [], "nothing changed");
  pig.growingAge = -49; // EntityAgeable.e: a baby's watcher 12 changes every tick
  assert.deepEqual(watchSweep(w), [[28, ref.changes.find((r) => r.id === "Pig").changes.find((c) => c.index === 12).s1c]]);
  assert.deepEqual(watchSweep(w), [], "the same age again is not a change");
  pig.health = 4; pig.growingAge = -48;
  assert.deepEqual(watchSweep(w), [[28, 6 + 5 + 5]], "two entries in one S1C");
  delete w.mob; w.mob = () => undefined; // a mob that left: its destroy follows, nothing is counted
  assert.deepEqual(watchSweep(w), []);
});

test("creeper state / ignited, charged, enderman carried block and wither head targets are counted", () => {
  const cr = mob("creeper", { creeperState: -1 }), en = mob("enderman", { carried: 0, carriedData: 0 }), wi = mob("wither", { health: 300 });
  let heads = [0, 0, 0]; hooks.witherHeads = () => heads;
  try {
    const w = watch({ 1: cr, 2: en, 3: wi });
    for (const i of [1, 2, 3]) w.memory.set(i, watchState(w.mob(i)));
    assert.deepEqual(watchSweep(w), []);
    cr.creeperState = 1; assert.deepEqual(watchSweep(w), [[28, 6 + 2]], "one byte entry");
    cr.ignited = true; cr.powered = true; assert.deepEqual(watchSweep(w), [[28, 6 + 2 + 2]], "charged (17) and ignited (18)");
    en.carried = 2; en.carriedData = 1; assert.deepEqual(watchSweep(w), [[28, 6 + 2 + 2]], "carried block and its data");
    en.screaming = true; assert.deepEqual(watchSweep(w), [], "the scream is already in the port's own meta packet");
    heads = ["p1", 0, 0]; assert.deepEqual(watchSweep(w), [[28, 6 + 5]]);
    heads = ["p1", "mob-9", "mob-9"]; assert.deepEqual(watchSweep(w), [[28, 6 + 5 + 5]]);
    heads = ["p1", "mob-9", "mob-9"]; assert.deepEqual(watchSweep(w), []);
  } finally { hooks.witherHeads = null; }
  assert.equal(watchDiff(watchState(mob("creeper", { creeperState: -1 })), watchState(mob("creeper", { creeperState: 1 }))), 2);
});

test("the sweep uses the connection's per-tick state cache when it has one", () => {
  const pig = mob("pig", { growingAge: -5 }); let asked = 0;
  const w = { memory: new Map([[1, watchState(pig)]]), mob: () => pig, state: (i, live) => { asked++; return watchState(live); } };
  pig.growingAge = -4;
  assert.equal(watchSweep(w).length, 1); assert.equal(asked, 1);
});

test("a cart or boat join counts the S0E, the whole-watcher S1C and the S12; a quiet cart's S12 is counted from its kinds", () => {
  const row = (info) => { const r = { v: "c1" }; setVehicleInfo(r, info); return r; };
  const rec = (...rows) => writePackets({ type: "vehicles", set: rows });
  assert.deepEqual(rec(row({ kinds: [], join: true, data: 1, velocity: true, watch: joinWatcher(false, 1) })), [[14, C[14] + 6], [28, 38], [18, 11]]);
  assert.deepEqual(rec(row({ kinds: ["move"], join: true, data: 0, velocity: true, watch: joinWatcher(true, 0) })), [[14, C[14]], [28, 26], [18, 11], [21, 8]]);
  assert.deepEqual(rec(row({ kinds: [], join: true, data: 0, velocity: false })), [[14, C[14]]], "info without a watcher size keeps the old count");
  assert.deepEqual(kindRecords(["velocity", "moveLook"]), [[18, 11], [23, 10]]);
  assert.deepEqual(kindRecords([{ type: "meta" }, { type: "teleport" }, { type: "head" }]), [[28, 8], [24, 19]]);
});

test("dispEnts rows: one S0E (S1C, S12) when the viewer first holds the row, then only the entry's packets, and one S13 when it goes", () => {
  const objs = new Map(), tnt = (kinds = []) => setRowInfo({ k: "t", i: 1, x: 0, y: 0, z: 0, fuse: 40 }, { data: 0, velocity: true, watch: 11, kinds });
  const send = (ents) => writePackets({ type: "dispEnts", ents }, { objs });
  assert.deepEqual(send([tnt()]), [[14, 21], [28, 11], [18, 11]]);
  assert.deepEqual(send([tnt()]), [], "a tick with no tracker packet counts nothing");
  assert.deepEqual(send([tnt([{ type: "moveLook" }, { type: "velocity" }])]), [[23, 10], [18, 11]]);
  const ball = (p, data = 6) => setRowInfo({ k: "b", i: 2, kind: "fireball", x: 0, y: 0, z: 0, t: { s: [0, 0, 0, 1, 1, 1, 0, 0, 0], ...(p ? { p } : {}) } }, { data, velocity: false, watch: 11 });
  assert.deepEqual(send([tnt(), ball()]), [[14, 27], [28, 11]], "a fireball with a shooter: motion shorts, no S12");
  assert.deepEqual(send([tnt(), ball([{ type: "move", dx: 1, dy: 0, dz: 0 }, { type: "move", dx: 1, dy: 0, dz: 0, yb: 1, pb: 2 }, { type: "look", yb: 1, pb: 1 }, { type: "teleport" }, { type: "velocity" }, { type: "meta" }])]), [[21, 8], [23, 10], [22, 7], [24, 19], [18, 11], [28, 8]]);
  assert.deepEqual(send([ball()]), [[19, 2 + 4]], "the TNT left the list: one S13 with its id");
  assert.deepEqual(send([]), [[19, 6]]);
  assert.deepEqual(send([]), []);
  assert.deepEqual(writePackets({ type: "dispEnts", ents: [tnt(), tnt()] }), [[14, C[14]], [14, C[14]]], "without a connection state a row still counts one S0E a message");
});

test("a TNT falling for 40 ticks is one S0E, and the native entry's packets at its 160 / 10 / velocity cadence", () => {
  const tracks = new TntTracks(), e = primeTnt(0.5, 70, 0.5, { random: () => 0 }), objs = new Map();
  const counts = {};
  let ticks = 0;
  for (let t = 0; t < 40; t++) {
    e.vy -= 0.04; e.vy *= 0.98; e.y += e.vy; e.fuse--;
    tracks.update([e]);
    const row = setRowInfo({ k: "t", i: 7, x: e.x, y: e.y, z: e.z, fuse: e.fuse }, { data: 0, velocity: true, watch: 11, kinds: tracks.kinds(e) });
    for (const [id] of writePackets({ type: "dispEnts", ents: [row] }, { objs })) counts[id] = (counts[id] ?? 0) + 1;
    ticks++;
  }
  assert.equal(counts[14], 1, "one S0E, natively EntityTrackerEntry sends it once");
  assert.equal(counts[28], 1, "and one whole-watcher S1C");
  assert.ok(counts[18] >= 1, "the join S12");
  const moves = (counts[21] ?? 0) + (counts[23] ?? 0) + (counts[24] ?? 0);
  assert.ok(moves >= 2 && moves <= 5, `position packets only on the every 10th tick: ${moves}`);
  assert.equal(ticks, 40);
});
