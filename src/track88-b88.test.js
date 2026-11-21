// Batch 88 track88: entity tracking after sptrack87. The mob trackers' fresh-column try at the player's slot (the native double delta), a player who arrives before its
// destination's pass, the late viewer's S0F / S1C / S1B / S04 order and the equipment check, single player's objects spawned inside tickEntitySimulation, and a thrown entity
// spawned in the pass a player arrives in. See .shared-memory/notes/track88-b88-track.md.
// Bytecode-read (javap -c -p, 1.7.10 jar): EntityTrackerEntry.tryStartWachingThis (my.b(mw)): the spawn packet (my.c), S1C hw(id, dw, true) unless the watcher is blank, S20 for
// living entities, S12 if `u` and not S0F, S1B(0) the vehicle, S1B(1) the leash, S04 hz for each held slot 0..4, S0A the bed, S1D each effect. my.c for an IAnimals: the head
// byte floor_float(au() * 256 / 360), then S0F fz(sv). EntityLivingBase.onUpdate (sv.h 65..178): each slot not areItemStacksEqual (add.b) to g[i] goes out as S04 through
// EntityTracker.func_151247_a (mn.a(sa, ft)), then g[i] = the copy (add.m). EntityPlayerMP.onUpdate (mw.h) sends the chunks and tries their entities (mn.a(mw, apx)).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { World } from "./world.js";
import { DedicatedSimulation } from "./multiplayer/simulation.js";
import { IDLE_INPUT } from "./multiplayer/protocol.js";
import { encodeAxis, sizeClass } from "./entity-tracker.js";
import { RemoteMobs } from "./multiplayer/remote-mobs.js";
import { ObjectTracker } from "./object-tracker.js";
import { tickEntitySimulation } from "./entity-simulation.js";
import { ThrownTracks } from "./multiplayer/thrown-tracks.js";

const wire = (rows) => JSON.parse(JSON.stringify(rows ?? []));
const key = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const input = () => ({ type: "input", controls: { ...IDLE_INPUT }, yaw: 0, pitch: 0, current: 0, hotbar: Array(9).fill(null) });
function flat() {
  const w = new World("track88");
  for (let x = 20; x <= 110; x++) for (let z = 20; z <= 110; z++) for (let y = 9; y <= 24; y++) w.put(x, y, z, y === 9 ? 1 : 0, 0, false);
  w.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  return w;
}
const join = (s, id, n, x, z) => { const p = s.addPlayer(id, id + "x", key(n)); p.position.copy({ x, y: 10, z }); p.previous.copy(p.position); s.input(id, input()); return p; };
const take = (pl) => { const o = wire(pl.mobPackets); pl.mobPackets = null; return o; };
const server = () => {
  const s = new DedicatedSimulation({}, { world: flat(), gameMode: "creative", mobs: true });
  s.mobs.spawning = false; s.mobs.mobs.entities.length = 0;
  return s;
};
const enc = (m, v) => encodeAxis(sizeClass(0.9), v); // a pig is 0.9 wide
const mine = (list, i) => list.filter((x) => x.i === i);
const wid = (m) => Number(String(m.id).replace("mob-", "")); // ServerMobs num(e): the wire id
// The mob moves between the copy beforePass takes and the tracker pass (its own update): `pre` is the state before this tick's update, `live` the state the pass reads.
function moving(s, tracker, m) {
  const st = { pre: null, live: null }, bp = tracker.beforePass.bind(tracker), step = tracker.serverStep.bind(tracker);
  tracker.beforePass = () => { st.pre = m.x; bp(); m.x += 0.25; };
  tracker.serverStep = (mobs, size) => { st.live = m.x; return step(mobs, size); };
  return st;
}
function firstSpawn(s, p, q, i, ticks = 20) {
  for (let k = 0; k < ticks; k++) {
    s.tick();
    const a = mine(take(p), i), b = mine(take(q), i), sp = a.findIndex((x) => x.type === "spawn");
    if (sp >= 0) return { p: a.slice(sp), q: b };
  }
  return null;
}
const moves = (list) => list.filter((x) => x.type === "move" || x.type === "moveLook" || x.type === "teleport" || x.type === "look");

// --- 1. the mob trackers: columns sent to a returning player (my.b at the player's slot) ---
test("a player returning to the Overworld: an older mob's S0F is this tick's state, then the pass's move as the player who stayed gets it (the native double delta)", { timeout: 180000 }, () => {
  const s = server(), p = join(s, "p", 1, 64.5, 64.5), q = join(s, "q", 2, 66.5, 64.5);
  const m = s.mobs.mobs.create("pig", 56.5, 10, 56.5); s.mobs.mobs.entities.push(m);
  for (let i = 0; i < 30; i++) { s.tick(); take(p); take(q); }
  s.dimensions.arrive(p, -1, { at: { x: 64.5, y: 70, z: 64.5 } });
  for (let i = 0; i < 5; i++) { s.tick(); take(p); take(q); }
  s.dimensions.arrive(p, 0, { at: { x: 64.5, y: 10, z: 64.5 } }); // the pig is older than p's new slot
  const st = moving(s, s.mobs.tracker, m), id = wid(m);
  const got = firstSpawn(s, p, q, id);
  assert.ok(got, "p sees the pig again");
  assert.equal(got.p[0].x, enc(m, st.live), "updated before the player's slot: the state the pass reads");
  assert.notEqual(got.p[0].x, enc(m, st.pre));
  assert.equal(got.p[1].type, "meta", "S1C after the S0F");
  const mv = moves(got.q);
  assert.ok(mv.length && mv[0].dx, `q gets a move: ${JSON.stringify(got.q)}`);
  assert.deepEqual(moves(got.p), mv, "and p gets the same move after its S0F");
});

test("a mob newer than the returning player's slot: the S0F is the copy taken before its update, then the same move", { timeout: 180000 }, () => {
  const s = server(), p = join(s, "p", 1, 64.5, 64.5), q = join(s, "q", 2, 66.5, 64.5);
  for (let i = 0; i < 10; i++) { s.tick(); take(p); take(q); }
  s.dimensions.arrive(p, -1, { at: { x: 64.5, y: 70, z: 64.5 } });
  for (let i = 0; i < 5; i++) { s.tick(); take(p); take(q); }
  s.dimensions.arrive(p, 0, { at: { x: 64.5, y: 10, z: 64.5 } });
  const m = s.mobs.mobs.create("pig", 56.5, 10, 56.5); s.mobs.mobs.entities.push(m); // after p in the list
  const st = moving(s, s.mobs.tracker, m);
  s.tick(); take(q); take(p);
  const id = wid(m), got = firstSpawn(s, p, q, id);
  assert.ok(got, "p sees the pig when its column goes out");
  assert.equal(got.p[0].x, enc(m, st.pre), "not updated yet at the player's slot: the copy");
  assert.notEqual(got.p[0].x, enc(m, st.live));
  assert.deepEqual(moves(got.p), moves(got.q), "then the pass's packets");
});

test("a player who reaches the Nether before the Nether's pass (the port's afterTick): the mobs spawned in that pass come before it in the list", { timeout: 180000 }, () => {
  const s = server(), p = join(s, "p", 1, 64.5, 64.5), q = join(s, "q", 2, 66.5, 64.5);
  for (let i = 0; i < 5; i++) s.tick();
  s.dimensions.arrive(q, -1, { at: { x: 66.5, y: 10, z: 64.5 } });
  const n = s.dimensions.nether;
  for (let x = 40; x <= 90; x++) for (let z = 40; z <= 90; z++) for (let y = 8; y <= 24; y++) n.world.put(x, y, z, y === 9 ? 87 : 0, 0, false);
  n.mobs.spawning = false; n.mobs.mobs.entities.length = 0;
  for (let i = 0; i < 20; i++) { s.tick(); take(p); take(q); }
  let m = null, st = null;
  const d = s.dimensions, cp = d.checkPortal.bind(d);
  d.checkPortal = (r) => {
    if (r !== p) return cp(r);
    d.checkPortal = cp;
    d.arrive(p, -1, { at: { x: 64.5, y: 10, z: 64.5 } });
    m = n.mobs.mobs.create("pigman", 56.5, 10, 56.5); n.mobs.mobs.entities.push(m); // spawned in the Nether pass that follows
    st = moving(s, n.mobs.tracker, m);
  };
  s.tick(); take(p); take(q);
  assert.ok(m, "transferred at the portal point");
  const w = n.mobs.tracker.watchers.get(p.id), en = n.mobs.tracker.entries.get(m);
  assert.ok(en.seq < w.seq, "the new entry comes before the arriving player");
  const got = firstSpawn(s, p, q, wid(m));
  assert.ok(got, "p sees the pigman");
  assert.equal(got.p[0].x, encodeAxis(sizeClass(0.6), st.live), "this tick's state, as an entity before the player's slot");
  assert.deepEqual(moves(got.p), moves(got.q));
});

// --- 2. the late viewer's packets in my.b's order, and the equipment check ---
test("a late viewer gets S0F (the head byte), the full S1C, then S04 for each held slot; a changed slot goes out as S04 at the next update; the copy applies it", { timeout: 180000 }, () => {
  const s = server(), p = join(s, "p", 1, 64.5, 64.5), q = join(s, "q", 2, 66.5, 64.5);
  // b90 lead: a roof over the pen, so the daylight roll (sunIgnite -> daylightHelmet, on the mob's randomly seeded Random) cannot wear the leather cap and send an unrelated S04
  for (let x = 56; x <= 76; x++) for (let z = 60; z <= 80; z++) s.world.put(x, 20, z, 1, 0, false);
  const m = s.mobs.mobs.create("skeleton", 66.5, 10, 70.5); s.mobs.mobs.entities.push(m);
  m.equipment[4] = { id: 298, count: 1, damage: 3 };
  const remote = new RemoteMobs(s.world, {});
  let first = null;
  for (let i = 0; i < 10 && !first; i++) { s.tick(); take(p); const b = take(q); remote.apply(b); if (b.some((x) => x.type === "spawn")) first = b; }
  const id = wid(m), rows = mine(first, id), types = rows.map((x) => x.type);
  assert.equal(types[0], "spawn");
  assert.equal(types[1], "meta", "S1C right after the S0F");
  const eq = rows.filter((x) => x.type === "equipment");
  // b89 mobpackets89: the entry is made at the spawn now, so the mob's first update's equipment check (EntityLivingBase.g starts empty) sends the held slots again after the spawn try
  assert.deepEqual(eq.map((x) => [x.slot, x.item.id]), [[0, m.equipment[0].id], [4, 298], [0, m.equipment[0].id], [4, 298]], "S04 for the held slots, in slot order, then the first update's check");
  assert.ok(types.indexOf("equipment") > types.lastIndexOf("attach") && types.indexOf("equipment") > 1, "after the S1C and S1B");
  const copy = remote.copies.get(id).mob;
  assert.deepEqual(copy.equipment.map((x) => x?.id ?? null), [m.equipment[0].id, null, null, null, 298]);
  // a change: the next update's check sends S04 to the watchers
  m.equipment[0] = null; m.equipment[1] = { id: 301, count: 1, damage: 0 };
  let changed = [];
  for (let i = 0; i < 3; i++) { s.tick(); take(p); const b = take(q); remote.apply(b); changed.push(...mine(b, id).filter((x) => x.type === "equipment")); }
  assert.deepEqual(changed.map((x) => [x.slot, x.item?.id ?? null]).filter(([k]) => k <= 1), [[0, null], [1, 301]]);
  assert.deepEqual(copy.equipment.map((x) => x?.id ?? null), [null, 301, null, null, 298]);
  for (let i = 0; i < 3; i++) { s.tick(); take(p); assert.equal(mine(take(q), id).filter((x) => x.type === "equipment").length, 0, "no change: no S04"); }
});

test("the S0F head byte and the angle bytes: (byte)(int)(v * 256 / 360) as fz(sv) writes them", { timeout: 180000 }, () => {
  const s = server(), p = join(s, "p", 1, 64.5, 64.5), q = join(s, "q", 2, 66.5, 64.5);
  const m = s.mobs.mobs.create("pig", 66.5, 10, 70.5); s.mobs.mobs.entities.push(m);
  let sp = null, read = null;
  // b89 mobpackets89: the S0F carries the spawn state (the entry is made at the spawn), so the angles are set before the mob's first tick
  m.rotationYawHead = 200.7; m.rotationYaw = -33.3; read = { rotationYawHead: m.rotationYawHead, rotationYaw: m.rotationYaw };
  for (let i = 0; i < 10 && !sp; i++) { s.tick(); take(p); sp = take(q).find((x) => x.type === "spawn") ?? null; }
  assert.ok(sp && read);
  const f = Math.fround, b = (deg) => (Math.trunc(f(f(f(deg) * 256) / 360)) << 24) >> 24;
  assert.equal(sp.head, b(read.rotationYawHead), "aO: (byte)(int)(rotationYawHead * 256 / 360)");
  assert.equal(sp.yaw, b(read.rotationYaw));
  assert.equal(sp.head, b(200.7));
});

// --- 3. single player: objects spawned inside tickEntitySimulation ---
test("single player without a walk: born() copies the objects one explosion spawns before the next pushes them, so the S0E is their spawn state", () => {
  const tracker = new ObjectTracker(10, () => 0.5), log = [];
  tracker.view.log = (pk) => log.push(wire(pk));
  const player = { x: 0.5, y: 0, z: 0.5 };
  tracker.serverTick({ item: [] }, player);
  const world = new World("track88sp");
  for (let x = -4; x <= 4; x++) for (let z = -4; z <= 4; z++) world.put(x, 1, z, 1, 0, false);
  const items = [];
  const drop = { x: 0.5, y: 3, z: 0.5, mx: 0, my: 0, mz: 0, entityId: 91, stack: { id: 1, count: 1, damage: 0 } };
  const tnt = (z) => ({ x: 0.5, y: 2, z, px: 0.5, py: 2, pz: z, vx: 0, vy: 0, vz: 0, fuse: 0, onGround: true });
  let blasts = 0;
  const explodeTnt = () => { blasts++; if (blasts === 1) items.push(drop); else drop.z += 2; }; // the first drops the item, the second pushes it
  for (const withBorn of [true, false]) {
    items.length = 0; blasts = 0; drop.z = 0.5; tracker.birthRecords = new WeakMap();
    const state = { world, items: { items, tick() {} }, primed: [tnt(0.5), tnt(1.5)], projectiles: { tick() {}, drain: () => [] }, arrows: { tick() {}, list: [] }, survival: { health: 0 }, position: player, width: 0.6, height: 1.8 };
    const hooks = { explodeTnt, ...(withBorn ? { born: () => tracker.births({ item: items }) } : {}) };
    tickEntitySimulation(state, hooks);
    assert.equal(blasts, 2, "both fuses ran out");
    log.length = 0;
    tracker.serverTick({ item: items }, player);
    const spawn = log.find((x) => x.type === "spawn");
    assert.ok(spawn);
    if (withBorn) assert.equal(spawn.z, Math.floor(0.5 * 32), "the spawn state (the copy after the first explosion)");
    else assert.equal(spawn.z, Math.floor(2.5 * 32), "without the hook: the end-of-pass state");
    tracker.entries.delete(drop);
  }
});

test("tickEntitySimulation calls born after each explosion, each projectile hit and the hatch events; main.js passes it on the unwalked path only", () => {
  const calls = [];
  const state = { world: new World("track88b"), items: { items: [], tick: () => calls.push("items") }, primed: [], projectiles: { tick: (w, t, hit) => { calls.push("hit:" + hit("e")); }, drain: () => [{}] }, arrows: { tick: () => calls.push("arrows"), list: [] }, survival: { health: 0 }, position: { x: 0, y: 0, z: 0 }, width: 0.6, height: 1.8 };
  tickEntitySimulation(state, { born: () => calls.push("born"), projectileHit: () => "r", projectileEvent: () => calls.push("event") });
  assert.deepEqual(calls, ["items", "born", "hit:r", "event", "born", "arrows"]);
  const src = readFileSync(new URL("./main.js", import.meta.url), "utf8");
  assert.match(src, /objectTracker\.births\(trackLists\(\)\);[^\n]*\n\s*tickEntitySimulation\(entityTick\.state, !isWalked\(mobs\) && world && screen !== "home" \? \{ \.\.\.entityTick\.hooks, born: \(\) => objectTracker\.births\(trackLists\(\)\) \} : entityTick\.hooks\)/);
});

// --- 4. thrown entities: a player who arrives before the destination's pass ---
let nextId = 9000;
const ids = new WeakMap(); const idOf = (e) => ids.get(e) ?? (ids.set(e, nextId++), ids.get(e));
const ball = (z) => ({ x: 0.5, y: 5, z, mx: 0, my: 0, mz: 0.3, yaw: 10, pitch: 0, entityId: nextId++ });
test("ThrownTracks: an arriving watcher (`arrived`) takes its slot after the entries this update adds; later watchers keep theirs before them", () => {
  for (const arrivedNow of [true, false]) {
    const open = new Set([1]), fresh = new Set();
    const a = { position: { x: 0, y: 0, z: 0 } }, b = { position: { x: 1, y: 0, z: 0 }, arrivedNow };
    const tracks = new ThrownTracks({ idOf, watches: (pid) => open.has(pid), fresh: (pid) => fresh.delete(pid), arrived: (pl) => !!pl.arrivedNow });
    const list = [];
    tracks.update(list, new Map([[1, a]]));
    const e = ball(0.5); list.push({ e, kind: "snowball" });
    e.z += e.mz; tracks.update(list, new Map([[1, a], [2, b]])); // b arrives in the pass the ball spawns in; its gate is closed
    b.arrivedNow = false;
    const w = tracks.watchers.get(2), o = tracks.objs.get(e);
    assert.equal(arrivedNow ? o.seq < w.seq : o.seq > w.seq, true);
    const last = tracks.entryOf(e).e.z;
    e.z += e.mz; open.add(2); fresh.add(2);
    const out = tracks.update(list, new Map([[1, a], [2, b]])), row = wire(out.get(2)).find((r) => r.i === e.entityId).p;
    assert.equal(row[0].type, "spawn");
    assert.equal(row[0].z, Math.floor((arrivedNow ? e.z : last) * 32), arrivedNow ? "before the player: this tick's state" : "after the player: the state read last tick");
  }
});

test("the server stamps the transfer tick and the dispense lanes pass `arrived`", () => {
  const dims = readFileSync(new URL("./multiplayer/server-dimensions.js", import.meta.url), "utf8");
  assert.match(dims, /p\.world = dest; p\.dimension = to;\n\s*p\.arrivedAt = sim\.ticks;/);
  const disp = readFileSync(new URL("./multiplayer/server-dispense.js", import.meta.url), "utf8");
  assert.match(disp, /arrived: p => p\.arrivedAt === sim\.ticks/);
});
