// Batch 83 tracker83: the velocityChanged S12 of items and orbs on the multiplayer wire, the boat and cart tracker entries (range 80, frequency 3, velocity, 400-tick
// teleport, the re-list cadence) replayed against the executed tracker-vehicles-reference.json, and Entity.handleWaterMovement's splash for fireballs, skulls and their copies.
// Facts: .shared-memory/notes/tracker83-b83-track.md. No browser.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { World, WATER } from "./world.js";
import { DedicatedSimulation } from "./multiplayer/simulation.js";
import { ObjectTracker } from "./multiplayer/server-object-tracker.js";
import { ItemTrackClient } from "./multiplayer/client-itrack.js";
import { ServerVehicles } from "./multiplayer/server-vehicles.js";
import { RemoteVehicles } from "./multiplayer/remote-vehicles.js";
import { CartTracker, TELEPORT_LIFT } from "./multiplayer/server-cart-track.js";
import { Boats } from "./boats.js";
import { Minecarts } from "./minecarts.js";
import { makeStack } from "./inventory.js";
import { JavaRandom } from "./java-random.js";
import { ballSplash, SPLASH_SOUND } from "./fireball-splash.js";
import { stepBallCopy } from "./multiplayer/fireball-copy.js";

const f = Math.fround;
const key = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const ref = JSON.parse(readFileSync(new URL("../public/research/tracker-vehicles-reference.json", import.meta.url)));

// ---- (1) velocityChanged: the tail S12 of EntityTrackerEntry.my.a(List), to every tracking player, off the frequency beat ----
test("an item or orb row with vc sends S12 at once to each tracking player; without it the resting object sends none off the beat", () => {
  const host = { players: new Map([["a", { dimension: 0, position: { x: 0.5, y: 0, z: 0.5 } }], ["b", { dimension: 0, position: { x: 2.5, y: 0, z: 0.5 } }]]), rules: { trackerLimit: 144 } };
  const tracker = new ObjectTracker(host, undefined, true);
  const S12 = [];
  for (let t = 0; t < 12; t++) {
    const vc = t === 5, item = { i: 4, x: 5.5, y: 0, z: 5.5, stack: makeStack(3, 1, 0), mx: vc ? 0.4 : 0, my: vc ? 0.3 : 0, mz: 0, ...(vc ? { vc: 1 } : {}) };
    const orb = { i: 9, x: 6.5, y: 0, z: 5.5, v: 3, c: 0, vx: vc ? -0.2 : 0, vy: 0, vz: 0, ...(vc ? { vc: 1 } : {}) };
    const message = { items: [item], xp: [orb] }; // one tick message, shared by the players (the tracker runs once per message)
    for (const pid of ["a", "b"]) {
      const out = tracker.messageFor(pid, message, 0);
      for (const r of out.itrack ?? []) for (const p of r.p) if (p.type === "velocity") S12.push([t, pid, r.k, p.vx, p.vy]);
    }
  }
  const at5 = S12.filter(([t]) => t === 5);
  assert.deepEqual(at5.map(([, pid, k]) => `${pid}:${k}`).sort(), ["a:item", "a:orb", "b:item", "b:orb"], "both players get both S12s");
  assert.deepEqual(at5.find(([, pid, k]) => pid === "b" && k === "item").slice(3), [3200, 2400], "(int)(motion * 8000)");
  assert.ok(S12.every(([t]) => t === 5 || t === 0), `no other S12 but the spawn's: ${JSON.stringify(S12)}`);
});

test("the dedicated server: a blast-pushed item (velocityChanged) reaches the client copy through S12 that tick, and the flag is cleared", () => {
  const world = new World("b83-items");
  for (let x = 0; x <= 40; x++) for (let z = 58; z <= 70; z++) for (let y = 9; y <= 14; y++) world.put(x, y, z, y === 9 ? 3 : 0, 0, false);
  world.spawn = () => ({ x: 8.5, y: 10, z: 64.5 });
  const sim = new DedicatedSimulation({}, { world, mobs: false, gameMode: "survival" });
  const a = sim.addPlayer("a", "Alice", key(1));
  a.position.copy({ x: 8.5, y: 10, z: 64.5 }); a.previous.copy(a.position);
  const it = sim.items.spawn(makeStack(3, 1, 0), 20.5, 10.125, 64.5, { delay: 40, motion: [0, 0, 0] });
  const client = new ItemTrackClient(() => 0.5);
  const run = () => { const out = sim.objectTracker.messageFor("a", sim.tick(), 0); client.tick(out.itrack, sim.world, a.position); return out; };
  for (let t = 0; t < 5; t++) run();
  it.mx = 0.5; it.my = 0.4; it.velocityChanged = true; // what spblast82's push leaves on the item
  const out = run();
  assert.ok((out.itrack ?? []).some((r) => r.k === "item" && r.p.some((p) => p.type === "velocity")), "S12 off the 20-tick beat");
  assert.equal(it.velocityChanged, false);
  const c = client.copies.get(`item:${it.eid}`);
  assert.ok(c.vy > 0.2 && c.vx > 0.2, `the copy flies: ${c.vx} ${c.vy}`);
  run(); run();
  assert.ok(c.y > 10.2, "and rises on its own physics between packets");
});

// ---- (2) boats and carts: the vehicles message replayed against the executed EntityTrackerEntry and the client EntityBoat / EntityMinecart ----
function replayVehicle(name) {
  const rec = ref[name], boat = name.startsWith("boat");
  const host = { players: new Map([["a", { position: { x: rec.player[0], y: 0, z: rec.player[1] } }]]), rules: {} };
  const sv = Object.create(ServerVehicles.prototype);
  const v = boat ? new Boats().spawnBoat({ x: 5.5, y: 0, z: 5.5, yaw: 0 }) : new Minecarts().spawnEmpty({ x: 5.5, y: 0.35, z: 5.5 });
  Object.assign(sv, { host, views: new Map([["a", { known: new Map() }]]), carts: { carts: boat ? [] : [v], reap() {} }, boats: { carts: boat ? [v] : [], reap() {} }, hanging: { track: () => [] } });
  const rv = new RemoteVehicles(null), bad = [], states = [];
  rec.inputs.forEach((inp, t) => {
    // inputs: posX, posY, posZ, motion, yaw, pitch, onGround, velocityChanged, dead; the pushes' addVelocity at tick 4 sets isAirBorne (not in the inputs)
    Object.assign(v, { x: inp[0], posY: inp[1], z: inp[2], vx: inp[3], vy: inp[4], vz: inp[5], yaw: inp[6], pitch: inp[7], airBorne: name.endsWith("Push") && t === 4, velocityChanged: inp[9] === 1 });
    sv.track();
    const m = host.players.get("a").vehPackets; host.players.get("a").vehPackets = null;
    states.push(m?.set?.[0] ?? null);
    if (m) rv.apply(m);
    rv.tick(); // the probe's client: the tick's packets, then the client entity's onUpdate
    const c = [...rv.copies.values()][0]?.v, want = rec.client[t];
    if (!!c !== (want[0] === 1)) { bad.push([t, "present", !!c]); return; }
    if (!c) return;
    const got = boat ? [c.x, c.posY, c.z, c.vx, c.vy, c.vz] : [c.x, c.posY, c.z];
    got.forEach((g, k) => { if (Math.abs(g - want[1 + k]) > 1e-9) bad.push([t, k, g, want[1 + k]]); });
  });
  return { bad: bad.slice(0, 4), states };
}
for (const name of ["boatGlide", "boatPush", "boatTeleport", "boatSplash", "boatFar"]) test(`boat copy follows the executed client EntityBoat tick for tick (${name}): S12 coasting, 3 + 5 increments, the 0.3 spawn lift`, () => {
  assert.deepEqual(replayVehicle(name).bad, []);
});
for (const name of ["cart0", "cart1", "cart3", "cartTeleport", "cartPush"]) test(`cart copy follows the executed client EntityMinecart (${name})`, () => {
  assert.deepEqual(replayVehicle(name).bad, []);
});
test("boatFar: the 80 range square is re-tested only when the entry moved 4 blocks, on lastScaledPosition / 32; the copy leaves one tick after the untrack", () => {
  const rec = ref.boatFar, gone = rec.client.findIndex((r) => r[0] === 0);
  assert.equal(gone, 72);
  const { bad } = replayVehicle("boatFar");
  assert.deepEqual(bad, []);
  assert.ok(rec.inputs[60][0] - rec.player[0] > 80, "the boat was already past 80 blocks for ten ticks");
});

test("a 400-tick (or long jump) teleport: the released state is serverPos / 32 with y + 1/64, as the client entity holds it", () => {
  const rec = ref.cartTeleport, tp = rec.rows.find(([, ps]) => ps.some((p) => p[0] === "S18")), p = tp[1].find((q) => q[0] === "S18");
  const { states } = replayVehicle("cartTeleport");
  const s = states[tp[0]];
  assert.equal(s.x, p[1] / 32); assert.equal(s.z, p[3] / 32);
  assert.equal(s.y, p[2] / 32 + TELEPORT_LIFT);
  assert.equal(TELEPORT_LIFT, 1 / 64);
});

test("the boat a viewer rides keeps the exact server state (no tracker fields); other viewers get the tracked one", () => {
  const host = { players: new Map([["a", { position: { x: 5, y: 0, z: 5 }, mount: { key: "b1" } }], ["b", { position: { x: 6, y: 0, z: 5 } }]]), rules: {} };
  const sv = Object.create(ServerVehicles.prototype);
  const boat = new Boats().spawnBoat({ x: 5.51, y: 0, z: 5.5, yaw: 0 });
  boat.id = 1;
  Object.assign(sv, { host, views: new Map([["a", { known: new Map() }], ["b", { known: new Map() }]]), carts: { carts: [], reap() {} }, boats: { carts: [boat], reap() {} }, hanging: { track: () => [] } });
  sv.track();
  const sa = host.players.get("a").vehPackets.set[0], sb = host.players.get("b").vehPackets.set[0];
  assert.equal(sa.bc, undefined); assert.equal(sa.x, 5.51);
  assert.equal(sb.bc, 1); assert.equal(sb.x, Math.floor(5.51 * 32) / 32);
  assert.ok(Math.abs(sb.y - f(boat.posY) - 0.3) < 0.04, "the S0E constructor's yOffset lift");
});

test("a re-released boat position (same serverPos) still re-aims the copy: the release count goes in the state", () => {
  const tr = new CartTracker(), boat = { boat: true, id: 3, x: 5.5, posY: 0.3, z: 5.5, yaw: 0, pitch: 0, vx: 0, vy: 0, vz: 0 };
  const st = () => ({ x: boat.x, y: boat.posY, z: boat.z, yaw: boat.yaw, pitch: boat.pitch });
  let s0 = tr.tick(boat, st()), rs = s0.rs, later = null;
  for (let t = 1; t <= 60; t++) { const s = tr.tick(boat, st()); if (s.rs !== rs) { later = [t, s]; rs = s.rs; } }
  assert.ok(later && later[0] === 60, `the 60th-tick forced S15 (${JSON.stringify(later)})`);
  assert.equal(later[1].x, s0.x);
});

// ---- (3) Entity.handleWaterMovement's splash ----
const draws = (n) => { const r = new JavaRandom(77); for (let i = 0; i < n; i++) r.nextFloat(); return r.nextInt(1 << 30); };
test("ballSplash: on entering water after the first update: the sound draws, then 1 + width * 20 bubble and splash on the entity's Random", () => {
  for (const [width, n] of [[1, 21], [f(0.3125), 8]]) {
    const spawned = [], sounds = [], rand = new JavaRandom(77);
    const b = { x: 3.25, y: 15.5, z: 7.5, vx: 0.5, vy: -0.25, vz: 0.1 };
    assert.equal(ballSplash(b, true, 15.5, width, { rand, fx: { spawn: (...v) => spawned.push(v) } }), null, "first update: no splash");
    assert.equal(ballSplash(b, false, 15.5, width, { rand }), null, "dry");
    const hit = ballSplash(b, true, 15.5, width, { rand, fx: { spawn: (...v) => spawned.push(v) }, sound: (vol, pitch) => sounds.push([vol, pitch]) });
    const vol = f(f(Math.sqrt(b.vx * b.vx * 0.20000000298023224 + b.vy * b.vy + b.vz * b.vz * 0.20000000298023224)) * f(0.2));
    assert.equal(hit.volume, vol); assert.deepEqual(sounds, [[hit.volume, hit.pitch]]);
    assert.equal(spawned.filter((s) => s[0] === "bubble").length, n); assert.equal(spawned.filter((s) => s[0] === "splash").length, n);
    assert.ok(spawned.every((s) => s[2] === 16), "at floor(minY) + 1");
    assert.equal(rand.nextInt(1 << 30), draws(2 + n * 5), "two for the pitch, three per bubble, two per splash");
    assert.equal(ballSplash(b, true, 15.5, width, { rand }), null, "already in water");
  }
});

test("the server fireball: one splash S29 (game.neutral.swim.splash) as it enters the water, not every tick in it", () => {
  const world = new World("b83-splash");
  for (let x = 0; x <= 130; x++) for (let z = 20; z <= 110; z++) for (let y = 9; y <= 24; y++) world.put(x, y, z, y === 9 ? 1 : x >= 80 && x <= 100 && y <= 20 ? WATER : 0, 0, false);
  world.spawn = () => ({ x: 74.5, y: 10, z: 64.5 });
  const s = new DedicatedSimulation({}, { world, gameMode: "survival", mobs: false });
  const a = s.addPlayer("a", "ax", key(1));
  a.position.copy({ x: 74.5, y: 10, z: 64.5 }); a.previous.copy(a.position);
  s.tick(); s.tick();
  const b = s.mobs.mobs.fireballs.launch({ large: true, owner: null, x: 70.5, y: 15.5, z: 64.5, exact: [1, 0, 0] });
  const heard = [];
  for (let t = 0; t < 25 && !b.dead; t++) { a.soundsOut = []; s.tick(); heard.push(...(a.soundsOut ?? []).filter((q) => q.name === SPLASH_SOUND).map((q) => [t, q])); }
  assert.equal(heard.length, 1, JSON.stringify(heard));
  assert.ok(heard[0][1].volume > 0 && heard[0][1].volume <= 1 && Math.abs(heard[0][1].pitch - 1) <= 0.4);
  assert.ok(heard[0][1].x >= 79 && heard[0][1].x <= 81, `at the water's edge: ${heard[0][1].x}`);
  assert.equal(b.inWater, true);
});

test("the client copy: its own splash particles (no sound) when it flies into the water; none on its first update", () => {
  const mk = () => ({ kind: "fireball", angles: true, x: 79.2, y: 15.5, z: 64.5, vx: 0.5, vy: 0, vz: 0, ax: 0.1, ay: 0, az: 0, yaw: 0, pitch: 0, fire: 0 });
  const run = (wetAt) => {
    const c = mk(), seen = [];
    for (let t = 0; t < 4; t++) stepBallCopy(c, { water: () => ({ wet: t >= wetAt, push: [0, 0, 0] }), spawn: (...v) => seen.push([t, ...v]) });
    return seen;
  };
  const seen = run(2);
  assert.equal(seen.filter(([t, n]) => t === 2 && n === "splash").length, 21);
  assert.equal(seen.filter(([t, n, , y]) => t === 2 && n === "bubble" && y === 16).length, 21, "the splash bubbles at floor(minY) + 1");
  assert.equal(seen.filter(([t, n]) => t === 3 && n === "splash").length, 0, "still in water: no second splash");
  assert.equal(run(0).filter(([, n]) => n === "splash").length, 0, "wet from its first update: firstUpdate suppresses it");
});
