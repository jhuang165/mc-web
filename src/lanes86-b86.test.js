// Batch 86 lanes86: the thrown-entity tracker lanes (multiplayer/thrown-tracks.js) hold one shared entry per entity (EntityTracker / EntityTrackerEntry, bytecode-read mn / my),
// every lane (a dimension's own instance or a stand-in lane) has its own tracker sending only to its dimension's players, and a fishing hook outlives its angler's dimension change
// (bytecode-read oi.a(mw, int), xe.h, xe.e). See .shared-memory/notes/lanes86-b86-track.md.
import test from "node:test";
import assert from "node:assert/strict";
import { OBJECT_KINDS } from "./object-tracker.js";
import { ThrownTracks, THROWN } from "./multiplayer/thrown-tracks.js";
import { World } from "./world.js";
import { DedicatedSimulation } from "./multiplayer/simulation.js";
import { IDLE_INPUT } from "./multiplayer/protocol.js";
import { makeStack } from "./inventory.js";
import { FISHING_ROD } from "./fishing-content.js";

let nextId = 9000;
const ids = new WeakMap(); const idOf = (e) => ids.get(e) ?? (ids.set(e, nextId++), ids.get(e));
const wire = (rows) => JSON.parse(JSON.stringify(rows ?? []));
// a stand-in entity the tracker reads (object-tracker.js ObjectTracker.read): eyes and hooks carry vx/vy/vz, the rest mx/my/mz; rotation in degrees
const VXYZ = new Set(["eyeOfEnder", "fishHook"]);
function make(kind, x, y, z) {
  const e = { x, y, z, yaw: 10, pitch: -5, entityId: nextId++ };
  if (kind === "potion") e.damage = 16421;
  if (kind === "arrow") e.shooterId = 7;
  if (kind === "fishHook") e.anglerId = "angler";
  setMotion(kind, e, 0.03, 0.01, 0.3);
  return e;
}
function setMotion(kind, e, a, b, c) { if (VXYZ.has(kind)) { e.vx = a; e.vy = b; e.vz = c; } else { e.mx = a; e.my = b; e.mz = c; } }
function step(kind, e) { const [a, b, c] = VXYZ.has(kind) ? [e.vx, e.vy, e.vz] : [e.mx, e.my, e.mz]; e.x += a; e.y += b; e.z += c; e.yaw += 3; }
const vint = (v) => Math.trunc(Math.max(-3.9, Math.min(3.9, v)) * 8000) + 0;

test("every thrown kind: a viewer who comes into range late gets an S0E built from the entity's current position, rotation and motion, then shares the one baseline", () => {
  assert.deepEqual([...THROWN].sort(), ["arrow", "egg", "enderPearl", "expBottle", "eyeOfEnder", "firework", "fishHook", "potion", "snowball"]);
  for (const kind of THROWN) {
    const spec = OBJECT_KINDS[kind], e = make(kind, 0.5, 5, 0.5), list = [{ e, kind }];
    const near = { position: { x: 0, y: 0, z: 0 } }, late = { position: { x: 600, y: 0, z: 0 } }, players = new Map([[1, near], [2, late]]);
    const tracks = new ThrownTracks({ idOf }); let first = null;
    for (let t = 0; t < 15; t++) {
      step(kind, e);
      const out = tracks.update(list, players);
      first ??= out.get(1)[0].p.find((p) => p.type === "spawn");
      assert.equal(out.get(2), undefined, `${kind}: out of range`);
    }
    setMotion(kind, e, -0.11, 0.07, 0.21); e.yaw = 77; e.pitch = 12; step(kind, e);
    late.position = { x: e.x + 1, y: 0, z: e.z }; // moved more than 4 blocks: the player's own entry re-evaluates and re-tests every entry (mn.a())
    const out = tracks.update(list, players), rows = wire(out.get(2));
    assert.equal(rows.length, 1, kind);
    const got = rows[0].p, spawn = got[0];
    assert.equal(spawn.type, "spawn", kind);
    assert.deepEqual([spawn.x, spawn.y, spawn.z], [Math.floor(e.x * 32), Math.floor(e.y * 32), Math.floor(e.z * 32)], `${kind}: the current position`);
    assert.notEqual(spawn.z, first.z, `${kind}: not the first one recorded`);
    // the reference: the S0E (my.c) a tracker that meets the entity now builds for its first viewer
    const ref = wire(new ThrownTracks({ idOf }).update(list, new Map([[9, { position: { ...late.position } }]])).get(9))[0].p;
    assert.deepEqual(got, ref.slice(0, got.length), `${kind}: S0E, S1C (and S12) of the current state`);
    assert.equal(got[1].type, "meta", kind);
    if (spec.velocity) assert.deepEqual(got[2], { type: "velocity", vx: vint(-0.11), vy: vint(0.07), vz: vint(0.21) }, `${kind}: the S12 of the current motion`);
    else assert.equal(got.length, 2, kind);
    if (kind === "arrow") { assert.equal(spawn.data, 7); assert.equal(spawn.vx, vint(-0.11)); } // data > 0: the S0E carries the motion
    if (kind === "fishHook") { assert.equal(spawn.data, "angler"); assert.deepEqual(rows[0].sh, { p: "angler" }); }
    if (kind === "potion") assert.equal(spawn.data, 16421);
    // j/k/l: the shared last-sent motion is the current one now
    const en = tracks.entryOf(e);
    assert.deepEqual([en.lastVX, en.lastVY, en.lastVZ], [-0.11, 0.07, 0.21], kind);
    // one baseline: the packets after the late spawn are the same for both watchers
    let sent = 0;
    for (let t = 0; t < 25; t++) {
      step(kind, e);
      const o = tracks.update(list, players);
      const [a, b] = [wire(o.get(1)), wire(o.get(2))];
      assert.deepEqual(a, b, `${kind} t${t}: the same packets`); sent += a.length;
    }
    assert.ok(sent > 0, kind);
  }
});

test("the players present when an entity joins get the join state; a player who leaves the dimension leaves the sets, and on return gets a new S0E", () => {
  const e = make("snowball", 0.5, 5, 0.5), list = [{ e, kind: "snowball" }];
  const a = { position: { x: 0, y: 0, z: 0 } }, b = { position: { x: 2, y: 0, z: 0 } };
  const tracks = new ThrownTracks({ idOf });
  tracks.birth(list); e.z += 3; // the entity pass of the join tick
  const out = tracks.update(list, new Map([[1, a], [2, b]]));
  for (const pid of [1, 2]) assert.equal(out.get(pid)[0].p[0].z, Math.floor(0.5 * 32), "mn.a(sa, int, int, boolean): my.b(playerEntities) at the join");
  // player 2 changes dimension: untrackEntity, no S13 on this world's lane (the next world's client never had the copy)
  for (let t = 0; t < 3; t++) { step("snowball", e); const o = tracks.update(list, new Map([[1, a]])); assert.equal(o.get(2), undefined); assert.equal(tracks.tracking(2), false); }
  assert.equal(tracks.entryOf(e).set.size, 1);
  const read = e.z; step("snowball", e);
  const back = wire(tracks.update(list, new Map([[1, a], [2, b]])).get(2));
  const spawn = back[0].p[0];
  assert.equal(spawn.type, "spawn", "the returning player's first pass here tries every entry");
  // b87 sptrack87 (was: the state the shared entry read last tick, a port-order gap): natively the chunk send at the player's slot of updateEntities (mw.h -> mn.a(mw, apx)) tries an entity
  // that is before the player in loadedEntityList, so it has updated: the S0E carries this tick's state, and the pass's delta follows (sptrack87-b87.test.js)
  assert.notEqual(spawn.z, Math.floor(read * 32));
  assert.equal(spawn.z, Math.floor(e.z * 32));
  for (let t = 0; t < 12; t++) { step("snowball", e); const o = tracks.update(list, new Map([[1, a], [2, b]])); assert.deepEqual(wire(o.get(1)), wire(o.get(2)), "then the one baseline's packets"); }
});

test("a watcher who walks out of range is dropped and its S13 waits one tick (destroyedItemsNetCache)", () => {
  const e = make("enderPearl", 0.5, 5, 0.5), list = [{ e, kind: "enderPearl" }];
  setMotion("enderPearl", e, 0, 0, 0);
  const a = { position: { x: 0, y: 0, z: 0 } }, b = { position: { x: 3, y: 0, z: 0 } }, players = new Map([[1, a], [2, b]]);
  const tracks = new ThrownTracks({ idOf });
  tracks.update(list, players);
  b.position = { x: 300, y: 0, z: 0 };
  const o1 = tracks.update(list, players);
  assert.ok(!(o1.get(2) ?? []).some((r) => r.p.some((p) => p.type === "destroy")), "not this tick");
  assert.equal(tracks.tracking(2), true, "the held S13 keeps the player's message going");
  const o2 = tracks.update(list, players);
  assert.deepEqual(wire(o2.get(2)).flatMap((r) => r.p).map((p) => p.type), ["destroy"]);
  assert.equal(tracks.tracking(2), false);
  assert.ok(tracks.entryOf(e).set.size === 1);
});

// --- the dedicated server lanes ---
const key = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const input = () => ({ type: "input", controls: { ...IDLE_INPUT }, yaw: 0, pitch: 0, current: 0, hotbar: Array(9).fill(null) });
function flat() {
  const w = new World("lanes86");
  for (let x = 40; x <= 110; x++) for (let z = 40; z <= 90; z++) for (let y = 9; y <= 30; y++) w.put(x, y, z, y === 9 ? 3 : 0, 0, false);
  w.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  return w;
}
const join = (s, id, n, at) => { const p = s.addPlayer(id, id + "x", key(n)); p.position.copy(at); p.previous.copy(p.position); s.input(id, input()); return p; };
const trkRows = (p, k) => (p.dispOut ?? []).filter((m) => m.type === "dispEnts" && m.trk).flatMap((m) => m.trk).filter((r) => !k || r.k === k);
const exactRows = (p) => (p.dispOut ?? []).filter((m) => m.type === "dispEnts").flatMap((m) => m.ents ?? []);
const fly = (lane, x, y, z) => { const r = lane.arrows.make({ x, y, z, mx: 0, my: 0, mz: 0.2, yaw: 0, pitch: 0 }, lane.arrows.rng(), { shooter: null, pickup: 1 }); lane.arrows.list.push(r); return r; };

test("a stand-in lane has its own tracker (players of its dimension only); its arrows never go out as exact rows; the Nether instance's lane 0 is the Overworld instance", { timeout: 120000 }, () => {
  const s = new DedicatedSimulation({}, { world: flat(), gameMode: "survival", mobs: false });
  const b = join(s, "b", 2, { x: 64.5, y: 10, z: 64.5 });
  const lane = s.dispense.laneFor(-1);
  assert.notEqual(lane, s.dispense); assert.equal(s.dispense.extra.get(-1), lane);
  assert.notEqual(s.dispense.tracksOf(lane), s.dispense.thrownTracks, "one EntityTracker per world");
  const seen = []; const t = s.dispense.tracksOf(lane), up = t.update.bind(t);
  t.update = (list, players) => { seen.push([...players.keys()]); return up(list, players); };
  fly(lane, 64.5, 12, 60.5); fly(s.dispense, 64.5, 12, 60.5);
  for (let i = 0; i < 20; i++) s.tick();
  b.dispOut = null; s.tick();
  assert.ok(seen.length > 0 && seen.every((k) => k.length === 0), "the Overworld player is no viewer of the Nether lane");
  assert.equal(exactRows(b).filter((r) => r.k === "a" || r.k === "b").length, 0, "no exact arrow / ball rows (b84 kept them for stand-in lanes)");
  assert.equal(trkRows(b, "arrow").length, 1, "only the Overworld arrow, as tracker rows");
  // the Nether is built: the stand-in is adopted, and lane 0 asked from the Nether instance is the Overworld's own
  const c = join(s, "c", 3, { x: 64.5, y: 10, z: 64.5 });
  s.dimensions.arrive(c, -1, { at: { x: 64.5, y: 70, z: 64.5 } });
  const n = s.dimensions.nether;
  assert.equal(s.dispense.extra.size, 0);
  assert.equal(n.dispense.laneFor(0), s.dispense, "not a dimension-0 stand-in inside the Nether instance");
  assert.equal(n.dispense.extra.size, 0);
  assert.equal(n.dispense.arrows.list.length, 1);
});

test("a hook outlives its angler's dimension change within 32 blocks; a far reel lands the catch in the hook's world and the orb in the angler's; past 1024 squared it dies", { timeout: 120000 }, () => {
  const s = new DedicatedSimulation({}, { world: flat(), gameMode: "survival", mobs: false });
  const p = join(s, "a", 1, { x: 64.5, y: 10, z: 64.5 }), q = join(s, "q", 2, { x: 80.5, y: 10, z: 64.5 });
  for (let i = 0; i < 20; i++) s.tick(); // q's columns stream (the chunk gate of the thrown lane)
  p.survival.inventory.main[0] = makeStack(FISHING_ROD, 1); p.survival.inventory.current = 0; p.pitch = 0.3;
  assert.equal(s.fishing.use(p), true);
  s.tick(); s.tick();
  const fishing = s.fishing.byPlayer.get(p.id), hook = fishing.hook;
  assert.ok(hook && trkRows(q, "fishHook").length > 0);
  // through a portal to the Nether, landing at the same coordinates (a cleared box)
  s.dimensions.arrive(p, -1, { at: { x: 64.5, y: 10, z: 64.5 } });
  const n = s.dimensions.nether;
  for (let x = 56; x <= 72; x++) for (let z = 56; z <= 72; z++) for (let y = 8; y <= 14; y++) n.world.put(x, y, z, y === 9 ? 150 : 0, 0, false);
  p.position.copy({ x: 64.5, y: 10, z: 64.5 }); p.previous.copy(p.position);
  q.dispOut = null; p.dispOut = null;
  for (let i = 0; i < 3; i++) s.tick();
  assert.equal(s.fishing.byPlayer.get(p.id)?.hook, hook, "xe.h: the angler is alive, holds the rod and is within 32 blocks by coordinates");
  assert.equal(s.fishing.hookOf(p), null, "not in the angler's world");
  assert.ok(trkRows(q).filter((r) => r.k === "fishHook").every((r) => !r.p.some((x) => x.type === "destroy")), "the Overworld viewer keeps the copy");
  assert.equal(trkRows(p, "fishHook").length, 0, "the Nether player is no viewer of the Overworld lane");
  // a bite, and the angler reels from the Nether (ItemFishingRod -> xe.e)
  hook.ticksCatchable = 5; hook.inGround = false; hook.hooked = null;
  const items = s.items.items.length, spawned = { 0: 0, [-1]: 0 };
  for (const [d, xp] of [[0, s.serverItems.xp], [-1, n.xp]]) { const sp = xp.spawn.bind(xp); xp.spawn = (...a) => { spawned[d]++; return sp(...a); }; } // (the angler may collect the orb in the same tick)
  assert.equal(s.fishing.use(p), true);
  s.tick();
  assert.equal(s.fishing.byPlayer.has(p.id), false, "reeled in");
  assert.equal(s.items.items.length, items + 1, "xe.e 294..298: the catch spawns in the hook's world");
  assert.deepEqual(spawned, { 0: 0, [-1]: 1 }, "xe.e 303..363: the orb spawns in the angler's world");
  // cast again in the Nether, back to the Overworld, then walk away past 32 blocks
  s.fishing.use(p);
  const h2 = s.fishing.byPlayer.get(p.id).hook;
  assert.ok(h2 && s.fishing.byPlayer.get(p.id).dimension === -1);
  s.dimensions.arrive(p, 0, { at: { x: 64.5, y: 10, z: 64.5 } });
  p.position.copy({ x: 64.5, y: 10, z: 64.5 }); p.previous.copy(p.position);
  s.tick();
  assert.equal(s.fishing.byPlayer.get(p.id)?.hook, h2, "still alive");
  p.position.copy({ x: 104.5, y: 10, z: 64.5 }); p.previous.copy(p.position);
  s.tick();
  assert.equal(s.fishing.byPlayer.has(p.id), false, "getDistanceSqToEntity > 1024: setDead");
});
