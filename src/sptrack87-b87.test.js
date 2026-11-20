// Batch 87 sptrack87: the single-player object tracker's spawn state, the state a player returning to a dimension gets, a hook left behind as a blast target of its own world, and the
// stand-in lane while a dimension is built in the middle of the send step. See .shared-memory/notes/sptrack87-b87-track.md.
// Bytecode-read (javap -c -p, 1.7.10 jar): World.spawnEntityInWorld (ahb.d(sa)) -> WorldManager.onEntityCreate (mp.a(sa)) -> EntityTracker.trackEntity (mn.a(sa)) -> my.b(playerEntities);
// MinecraftServer.updateTimeLightAndEntities: per WorldServer tick(), updateEntities(), getEntityTracker().updateTrackedEntities(), then NetworkSystem.networkTick (the portal
// transfer, ServerConfigurationManager.transferPlayerToDimension oi.a(mw, int), runs inside it, from the player's own update); EntityPlayerMP.onUpdate (mw.h) sends the chunks and
// tries the entities in them (mn.a(mw, apx)).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ObjectTracker, birthWalks } from "./object-tracker.js";
import { ThrownTracks } from "./multiplayer/thrown-tracks.js";
import { World } from "./world.js";
import { DedicatedSimulation } from "./multiplayer/simulation.js";
import { IDLE_INPUT } from "./multiplayer/protocol.js";
import { makeStack } from "./inventory.js";
import { FISHING_ROD } from "./fishing-content.js";

const wire = (rows) => JSON.parse(JSON.stringify(rows ?? []));

// --- 1. single player ---
function harness(kind) {
  const tracker = new ObjectTracker(10, () => 0.5), log = [];
  tracker.view.log = (p) => log.push(wire(p));
  const player = { x: 0.5, y: 0, z: 0.5 };
  const tick = (list) => { log.length = 0; tracker.serverTick({ [kind]: list }, player); return log.slice(); };
  return { tracker, tick };
}
const arrowAt = (z) => ({ x: 0.5, y: 5, z, mx: 0, my: 0, mz: 0.5, yaw: 0, pitch: 0, entityId: 77, shooterId: 3 });

test("single player: an object copied before its first update gets the S0E of its spawn, and the pass after that update sends the move from it (ahb.d -> mp.a -> mn.a(sa))", () => {
  for (const recorded of [true, false]) {
    const { tracker, tick } = harness("arrow");
    tick([]);
    const e = arrowAt(0.5);
    const walks = birthWalks(new Map([["arrow", { list: () => [e], tick: (x) => { x.z += 0.5; }, reap() {} }]]), () => (recorded ? tracker : null));
    walks.get("arrow").tick(e); // the walk: spawned inside it, the arrow updates in the same pass
    const sent = tick([e]), spawn = sent[0];
    assert.equal(spawn.type, "spawn");
    if (recorded) {
      assert.equal(spawn.z, Math.floor(0.5 * 32), "the spawn state");
      const pos = sent.find((p) => p.type === "move" || p.type === "moveLook");
      assert.ok(pos && pos.dz === 16, `the pass's move from the spawn baseline (an arrow sends at its first pass): ${JSON.stringify(sent)}`);
      assert.equal(tracker.entries.get(e).entry.lastZ, 32);
    } else {
      assert.equal(spawn.z, 32, "unrecorded: the state after the update (the old behaviour)");
      assert.ok(sent.filter((p) => p.type === "move" || p.type === "moveLook").every((p) => p.dz === 0), "no move from a spawn baseline (the 60th-tick move carries 0)");
    }
  }
});

test("single player: a tracked object is not copied again; a copy older than the last pass is replaced; an item keeps the copy's yaw", () => {
  const { tracker, tick } = harness("arrow");
  const e = arrowAt(0.5);
  tracker.birth(e); e.z = 3;
  tick([]); tick([]); // two passes without it (an unloaded chunk): the copy is stale
  tracker.birth(e); // replaced by the state now
  e.z = 3.5;
  assert.equal(tick([e])[0].z, Math.floor(3 * 32));
  tracker.birth(e); assert.equal(tracker.birthRecords.has(e), false, "tracked: no copy");
  // an item: ObjectTracker.read gives the copy a random yaw; the live item takes it, so the next reads agree with the S0E
  const items = harness("item"), it = { x: 0.5, y: 5, z: 0.5, mx: 0, my: 0, mz: 0, entityId: 78, stack: makeStack(1, 1) };
  items.tick([]); items.tracker.birth(it);
  const s = items.tick([it])[0];
  assert.equal(s.type, "spawn");
  assert.equal(typeof it.rotationYaw, "number");
  assert.equal(items.tracker.entries.get(it).entry.e.rotationYaw, it.rotationYaw);
});

test("single player: main.js copies the walked objects, eyes and the hook before their first update", () => {
  const src = readFileSync(new URL("./main.js", import.meta.url), "utf8");
  assert.match(src, /mobs\.walks = birthWalks\(entityWalkers\(/);
  assert.match(src, /for \(const e of eyes\.eyes\) objectTracker\.birth\(e\);[^\n]*\n\s*eyes\.tick\(/);
  assert.match(src, /if \(fishing\.active\) objectTracker\.birth\(fishing\.hook\);[^\n]*\n\s*fishing\.tick\(fishingHost\(\)\)/);
  assert.match(src, /objectTracker\.births\(trackLists\(\)\);[^\n]*\n\s*tickEntitySimulation\(/);
});

// --- 2. a player returning to a dimension (unit) ---
let nextId = 5000;
const ids = new WeakMap(); const idOf = (e) => ids.get(e) ?? (ids.set(e, nextId++), ids.get(e));
const ball = (z) => ({ x: 0.5, y: 5, z, mx: 0, my: 0, mz: 0.3, yaw: 10, pitch: 0, entityId: nextId++ });
const move = (e) => { e.z += e.mz; };

test("a returning player: an entity before it in the list gives this tick's state, then the pass's delta to every watcher (mw.h's chunk send, then my.a(List))", () => {
  let doubled = 0;
  for (let away = 0; away < 10; away++) {
    const e = ball(0.5), list = [{ e, kind: "snowball" }];
    const a = { position: { x: 0, y: 0, z: 0 } }, b = { position: { x: 1, y: 0, z: 0 } };
    const tracks = new ThrownTracks({ idOf });
    for (let t = 0; t < 4; t++) { move(e); tracks.update(list, new Map([[1, a], [2, b]])); }
    for (let t = 0; t <= away; t++) { move(e); tracks.update(list, new Map([[1, a]])); }
    const last = tracks.entryOf(e).e.z;
    move(e);
    const out = tracks.update(list, new Map([[1, a], [2, b]])), back = wire(out.get(2))[0].p, stay = wire(out.get(1) ?? [])[0]?.p ?? [];
    assert.equal(back[0].type, "spawn");
    assert.equal(back[0].z, Math.floor(e.z * 32), "this tick's state");
    assert.notEqual(back[0].z, Math.floor(last * 32), "not the state read last tick");
    assert.deepEqual(back.slice(0, 3).map((p) => p.type), ["spawn", "meta", "velocity"]);
    assert.deepEqual(back.slice(3), stay, "then this pass's packets, the same as the watcher who stayed");
    if (stay.some((p) => p.type === "move" || p.type === "moveLook")) doubled++;
  }
  assert.ok(doubled > 0, "some return tick has a move after the S0E (the native double delta)");
});

test("columns sent to a watcher: an entry older than the watcher gives this tick's state, one newer gives the state read last tick; both then get the pass's delta", () => {
  const open = new Set(), fresh = new Set();
  const tracks = new ThrownTracks({ idOf, watches: (pid, cx, cz) => open.has(pid), fresh: (pid) => fresh.delete(pid) });
  const old = ball(0.5), a = { position: { x: 0, y: 0, z: 0 } }, b = { position: { x: 1, y: 0, z: 0 } };
  open.add(1);
  const list = [{ e: old, kind: "snowball" }];
  move(old); tracks.update(list, new Map([[1, a]]));
  move(old); tracks.update(list, new Map([[1, a], [2, b]])); // b joins: its columns are not sent yet
  const young = ball(0.5); list.push({ e: young, kind: "snowball" }); // after b in the list
  for (let t = 0; t < 3; t++) { move(old); move(young); const o = tracks.update(list, new Map([[1, a], [2, b]])); assert.equal(o.get(2), undefined, "gate closed"); }
  const lastOld = tracks.entryOf(old).e.z, lastYoung = tracks.entryOf(young).e.z;
  move(old); move(young); open.add(2); fresh.add(2);
  const out = tracks.update(list, new Map([[1, a], [2, b]]));
  const rows = new Map(wire(out.get(2)).map((r) => [r.i, r.p])), stay = new Map(wire(out.get(1)).map((r) => [r.i, r.p]));
  const ro = rows.get(old.entityId), ry = rows.get(young.entityId);
  assert.equal(ro[0].z, Math.floor(old.z * 32), "updated before the player's slot: this tick's state");
  assert.notEqual(ro[0].z, Math.floor(lastOld * 32));
  assert.equal(ry[0].z, Math.floor(lastYoung * 32), "after the player's slot: not updated yet");
  assert.notEqual(ry[0].z, Math.floor(young.z * 32));
  for (const [r, e] of [[ro, old], [ry, young]]) assert.deepEqual(r.slice(3), stay.get(e.entityId) ?? [], "then the pass's packets");
});

// --- 2. a player returning to a dimension (the dedicated server, both port orders) ---
const key = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const input = () => ({ type: "input", controls: { ...IDLE_INPUT }, yaw: 0, pitch: 0, current: 0, hotbar: Array(9).fill(null) });
function flat() {
  const w = new World("sptrack87");
  for (let x = 40; x <= 110; x++) for (let z = 40; z <= 90; z++) for (let y = 9; y <= 30; y++) w.put(x, y, z, y === 9 ? 3 : 0, 0, false);
  w.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  return w;
}
const join = (s, id, n, at) => { const p = s.addPlayer(id, id + "x", key(n)); p.position.copy(at); p.previous.copy(p.position); s.input(id, input()); return p; };
const fly = (lane, x, y, z) => { const r = lane.arrows.make({ x, y, z, mx: 0, my: 0.4, mz: 0.15, yaw: 0, pitch: 0 }, lane.arrows.rng(), { shooter: null, pickup: 1 }); lane.arrows.list.push(r); return r; };
const clearNether = (n) => { for (let x = 52; x <= 76; x++) for (let z = 52; z <= 80; z++) for (let y = 8; y <= 40; y++) n.world.put(x, y, z, y === 9 ? 87 : 0, 0, false); };
// the transfer at the port's own point: ServerDimensions.afterTick -> checkPortal -> arrive, after the Overworld's tick and before the Nether's
function transferAtPortal(s, p, to, at) {
  const d = s.dimensions, cp = d.checkPortal.bind(d);
  d.checkPortal = (q) => { if (q === p) { d.checkPortal = cp; d.arrive(p, to, { at }); p.position.copy(at); p.previous.copy(p.position); return; } cp(q); };
}
function firstSpawn(s, dim, p, q, e, ticks = 30) {
  const lane = dim ? s.dimensions.nether.dispense : s.dispense, t = lane.tracksOf(lane), up = t.update.bind(t);
  let got = null;
  t.update = (list, players) => {
    const out = up(list, players), id = t.objs.get(e)?.p.id, rows = wire(out.get(p.id)), row = rows.find((r) => r.i === id);
    if (!got && row?.p[0]?.type === "spawn") got = { spawn: row.p[0], rest: row.p.slice(3), stay: wire(out.get(q.id)).find((r) => r.i === id)?.p ?? [], z: e.z, last: t.objs.get(e).p.z };
    return out;
  };
  for (let i = 0; i < ticks && !got; i++) s.tick();
  t.update = up;
  return got;
}

test("the dedicated server, Nether -> Overworld (the transfer after the Overworld's pass) and Overworld -> Nether (before the Nether's pass): the first S0E is that tick's state, then the delta", { timeout: 180000 }, () => {
  const s = new DedicatedSimulation({}, { world: flat(), gameMode: "survival", mobs: false });
  const p = join(s, "p", 1, { x: 64.5, y: 10, z: 64.5 }), q = join(s, "q", 2, { x: 66.5, y: 10, z: 64.5 });
  for (let i = 0; i < 20; i++) s.tick();
  // order (ii): p is in the Nether, an Overworld arrow flies; p comes back at the portal point
  s.dimensions.arrive(p, -1, { at: { x: 64.5, y: 10, z: 64.5 } }); clearNether(s.dimensions.nether);
  p.position.copy({ x: 64.5, y: 10, z: 64.5 }); p.previous.copy(p.position);
  for (let i = 0; i < 3; i++) s.tick();
  const arrow = fly(s.dispense, 64.5, 12, 64.5);
  for (let i = 0; i < 3; i++) s.tick();
  transferAtPortal(s, p, 0, { x: 64.5, y: 10, z: 64.5 });
  const back = firstSpawn(s, 0, p, q, arrow);
  assert.ok(back, "p sees the arrow again");
  assert.equal(back.spawn.z, Math.floor(back.z * 32), "the state of the Overworld pass that first sends it");
  assert.equal(back.last, back.z);
  assert.deepEqual(back.rest, back.stay, "then that pass's packets, as the player who stayed gets them");
  // order (i): q goes to the Nether first, a Nether arrow flies, then p goes there at the portal point (the Nether's pass follows in the same port tick)
  s.dimensions.arrive(q, -1, { at: { x: 66.5, y: 10, z: 64.5 } }); q.position.copy({ x: 66.5, y: 10, z: 64.5 }); q.previous.copy(q.position);
  for (let i = 0; i < 20; i++) s.tick();
  const nArrow = fly(s.dimensions.nether.dispense, 64.5, 12, 64.5);
  for (let i = 0; i < 2; i++) s.tick();
  transferAtPortal(s, p, -1, { x: 64.5, y: 10, z: 64.5 });
  const there = firstSpawn(s, -1, p, q, nArrow);
  assert.ok(there, "p sees the Nether arrow");
  assert.equal(there.spawn.z, Math.floor(there.z * 32), "the state of the Nether pass that first sends it");
  assert.deepEqual(there.rest, there.stay);
});

// --- 3. a hook left behind is a blast target of its own world ---
test("an Overworld blast pushes the hook of an angler who went to the Nether; a Nether blast at the same coordinates does not", { timeout: 180000 }, () => {
  const s = new DedicatedSimulation({}, { world: flat(), gameMode: "survival", mobs: false });
  const p = join(s, "a", 1, { x: 64.5, y: 10, z: 64.5 });
  for (let i = 0; i < 5; i++) s.tick();
  p.survival.inventory.main[0] = makeStack(FISHING_ROD, 1); p.survival.inventory.current = 0; p.pitch = 0.3;
  assert.equal(s.fishing.use(p), true);
  s.tick(); s.tick();
  const hook = s.fishing.byPlayer.get(p.id).hook;
  s.dimensions.arrive(p, -1, { at: { x: 64.5, y: 10, z: 64.5 } }); clearNether(s.dimensions.nether);
  p.position.copy({ x: 64.5, y: 10, z: 64.5 }); p.previous.copy(p.position);
  s.tick();
  assert.equal(s.fishing.byPlayer.get(p.id)?.hook, hook, "the hook lives on in the Overworld");
  assert.equal(s.fishing.hookOf(p), null);
  assert.deepEqual(s.fishing.hooksIn(0), [hook]); assert.deepEqual(s.fishing.hooksIn(-1), []);
  const at = { x: hook.x, y: hook.y - 1, z: hook.z };
  const v0 = [hook.vx, hook.vy, hook.vz];
  s.dimensions.within(p, () => s.mobs.explode({ ...at, size: 4, source: null }));
  assert.deepEqual([hook.vx, hook.vy, hook.vz], v0, "not in the Nether's list");
  s.mobs.explode({ ...at, size: 4, source: null });
  assert.notDeepEqual([hook.vx, hook.vy, hook.vz], v0, "pushed in its own world");
  assert.ok(hook.vy > v0[1]);
});

// --- 4. the stand-in lane while the Nether is built in the middle of the send step ---
test("a stand-in lane whose dimension is built inside its tracker update (the chunk gate's worldOf -> ensureNether -> adopt): its rows are dropped, one copy only, the Nether instance's", { timeout: 180000 }, () => {
  const s = new DedicatedSimulation({}, { world: flat(), gameMode: "survival", mobs: false });
  const q = join(s, "q", 2, { x: 64.5, y: 10, z: 64.5 });
  for (let i = 0; i < 5; i++) s.tick();
  const lane = s.dispense.laneFor(-1), arrow = fly(lane, 64.5, 12, 60.5), t = s.dispense.tracksOf(lane), up = t.update.bind(t);
  assert.ok(!s.dimensions.nether, "not built yet");
  // (executed: in a whole tick the players' loop builds it first, ServerDimensions.within; this drives the flush alone, with the build where the gate would make it)
  let sent = null;
  t.update = (list, players) => { s.dimensions.ensureNether(); return (sent = up(list, players)); };
  q.dimension = -1; q.dispOut = null;
  s.dispense.flush();
  t.update = up;
  assert.ok(s.dimensions.nether && s.dispense.extra.size === 0, "built and adopted inside the send step");
  assert.ok(sent.get(q.id)?.some((r) => r.p.some((x) => x.type === "spawn")), "the stand-in tracker did spawn the arrow to q");
  assert.equal((q.dispOut ?? []).filter((m) => m.type === "dispEnts" && m.trk?.length).length, 0, "but its rows never go out (ServerDispense.flush skips a dimension it no longer serves)");
  q.world = s.dimensions.nether.world; clearNether(s.dimensions.nether);
  for (let i = 0; i < 25; i++) s.tick();
  const spawns = (q.dispOut ?? []).filter((m) => m.type === "dispEnts" && m.trk).flatMap((m) => m.trk).filter((r) => r.k === "arrow" && r.p.some((x) => x.type === "spawn"));
  assert.equal(new Set(spawns.map((r) => r.i)).size, 1, "one copy, from the Nether instance's own tracker");
  assert.equal(s.dimensions.nether.dispense.arrows.list.includes(arrow), true);
});
