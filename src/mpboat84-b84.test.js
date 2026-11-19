// Batch 84 mpboat84: the multiplayer boat copy's own splash draws (xi.h / sa.N on a client world), the rider's own boat running the physics on its client (isBoatEmpty false),
// and the late joiner's spawn record (EntityTrackerEntry.func_151260_c). Facts: .shared-memory/notes/mpboat84-b84-track.md. No browser.
import test from "node:test";
import assert from "node:assert/strict";
import { World, WATER } from "./world.js";
import { RemoteVehicles, boatClientStep, ownBoatPackets, riderRecord } from "./multiplayer/remote-vehicles.js";
import { ServerVehicles } from "./multiplayer/server-vehicles.js";
import { CartTracker } from "./multiplayer/server-cart-track.js";
import { Boats } from "./boats.js";
import { JavaRandom } from "./java-random.js";

const f = Math.fround;
const pool = () => {
  const w = new World("b84-boat");
  for (let x = 0; x <= 40; x++) for (let z = 0; z <= 40; z++) for (let y = 3; y <= 12; y++) w.put(x, y, z, y === 3 ? 1 : y <= 8 ? WATER : 0, 0, false);
  return w;
};
const place = (rv) => (bv, x, y, z) => rv.boats.setPosition(bv, x, y, z);
const copyAt = (rv, x, y, z, vx = 0) => {
  rv.apply({ set: [{ v: "b1", x, y, z, yaw: 0, pitch: 0, bc: 1, vs: 0, rs: 0, mx: vx, my: 0, mz: 0 }] });
  return rv.copies.get("b1");
};

test("a boat copy entering water draws 31 bubble and 31 splash (1 + 1.5 * 20) once, on its own Random, after its first update", () => {
  const world = pool(), rv = new RemoteVehicles(world), seen = [];
  const c = copyAt(rv, 20.5, 8.8, 20.5); // box bottom 8.5: over the surface (water top 9), then lowered in
  const fx = { spawn: (...a) => seen.push(a) };
  boatClientStep(c, place(rv), world, fx); // first update: nothing, whatever the box says
  assert.equal(seen.length, 0);
  c.v.inWater = false; rv.boats.setPosition(c.v, 20.5, 8.4, 20.5);
  boatClientStep(c, place(rv), world, fx);
  assert.equal(seen.filter(a => a[0] === "bubble").length, 31);
  assert.equal(seen.filter(a => a[0] === "splash").length, 31);
  assert.ok(seen.every(a => a[2] === Math.floor(8.4 - 0.3) + 1), "at floor(minY) + 1");
  const n = seen.length;
  boatClientStep(c, place(rv), world, fx);
  assert.equal(seen.length, n, "already in water: no second entry splash");
});

test("the entry splash consumes the same Random draws with or without a particle sink (the sound's two floats, three per bubble, two per splash)", () => {
  const draws = (rv, fx) => { const c = copyAt(rv, 20.5, 8.4, 20.5); c.v.firstUpdate = false; c.v.random = new JavaRandom(5); boatClientStep(c, place(rv), rv.world, fx); return c.v.random.nextInt(1 << 30); };
  const w = pool(), a = draws(new RemoteVehicles(w), null), b = draws(new RemoteVehicles(w), { spawn() {} });
  assert.equal(a, b);
  const r = new JavaRandom(5); for (let i = 0; i < 2 + 31 * 5; i++) r.nextFloat();
  assert.equal(a, r.nextInt(1 << 30));
});

test("a boat copy faster than 0.2625 throws 1 + d * 60 splash behind it (xi.h's loop before the isRemote test); a slow one throws none", () => {
  const world = pool(), rv = new RemoteVehicles(world), seen = [];
  const c = copyAt(rv, 20.5, 9.1, 20.5, 0.4);
  c.v.firstUpdate = false; c.v.inWater = true;
  boatClientStep(c, place(rv), world, { spawn: (...a) => seen.push(a) });
  assert.equal(seen.filter(a => a[0] === "splash").length, Math.ceil(1 + 0.4 * 60));
  assert.ok(seen.every(a => Math.abs(a[2] - (c.v.py - 0.125)) < 1e-9 || a[0] === "bubble"), "at posY - 0.125");
  const slow = copyAt(new RemoteVehicles(world), 20.5, 9.1, 20.5, 0.2), more = [];
  slow.v.firstUpdate = false; slow.v.inWater = true;
  boatClientStep(slow, () => {}, world, { spawn: (...a) => more.push(a) });
  assert.equal(more.length, 0);
});

test("the rider's own boat runs the physics from the input; a near position packet is dropped, a far one only resets the motion to the last S12", () => {
  const world = pool(), rv = new RemoteVehicles(world);
  const st = (o = {}) => ({ v: "b1", x: 20.5, y: 8.8, z: 20.5, yaw: 0, pitch: 0, own: 1, tx: 20.5, ty: 8.8, tz: 20.5, vs: 0, rs: 0, mx: 0, my: 0, mz: 0, ...o });
  rv.apply({ set: [st()] });
  rv.ride("b1", { yaw: 0, forward: 1, strafe: 0 });
  const c = rv.copies.get("b1"), z0 = c.v.z;
  for (let t = 0; t < 10; t++) rv.tick();
  assert.ok(c.v.z - z0 > 0.1 || z0 - c.v.z > 0.1, `it moved by itself: ${c.v.z}`);
  assert.equal(c.v.rider.moveForward, f(f(1) * f(0.98)));
  // a near position packet (target within one block): nothing; the copy keeps its own place and motion
  const near = { x: c.v.x, y: c.v.posY, z: c.v.z };
  const vz = c.v.vz;
  ownBoatPackets(c, st({ rs: 1, tx: near.x + 0.5, ty: near.y, tz: near.z, x: near.x + 0.5, z: near.z }));
  assert.equal(c.v.vz, vz); assert.equal(c.v.z, near.z);
  // a far one (over a block): the motion = the last S12 (zero here); the position is not set from it
  ownBoatPackets(c, st({ rs: 2, tx: near.x + 1.5, ty: near.y, tz: near.z, x: near.x + 1.5, z: near.z }));
  assert.equal(c.v.vz, 0); assert.equal(c.v.x, near.x);
  // an S12 sets the motion at once
  ownBoatPackets(c, st({ rs: 2, vs: 1, mx: 0.1, mz: -0.2, tx: near.x, tz: near.z }));
  assert.deepEqual([c.v.vx, c.v.vz], [0.1, -0.2]);
});

test("the rider's copy is put back on the server's exact state past two blocks (the port's seat), and returns to plain following when the ride ends", () => {
  const world = pool(), rv = new RemoteVehicles(world);
  const st = (x) => ({ v: "b1", x, y: 8.8, z: 20.5, yaw: 0, pitch: 0, own: 1, tx: x, ty: 8.8, tz: 20.5, vs: 0, rs: 0, mx: 0, my: 0, mz: 0 });
  rv.apply({ set: [st(20.5)] }); rv.ride("b1", { yaw: 0 }); rv.tick();
  rv.apply({ set: [st(26.5)] }); rv.tick();
  assert.ok(Math.abs(rv.copies.get("b1").v.x - 26.5) < 0.5);
  rv.ride(null);
  const c = rv.copies.get("b1");
  assert.equal(c.ride, false); assert.equal(c.v.rider, null);
  rv.apply({ set: [{ v: "b1", x: 30.5, y: 8.8, z: 20.5, yaw: 0, pitch: 0 }] }); rv.tick();
  assert.equal(c.v.x, 30.5, "a plain state snaps again");
});

test("riderRecord: the steering fields the server reads (yaw in degrees, 0.98 scaled forward, negated strafe)", () => {
  const r = riderRecord({ yaw: Math.PI / 2, forward: 1, strafe: -1 });
  assert.equal(r.yaw, f(180 - 90)); assert.ok(r.moveForward > 0 && r.moveStrafing > 0);
});

// ---- the late joiner ----
const boatHost = (boat, viewers) => {
  const host = { players: new Map(viewers.map(([id, x]) => [id, { position: { x, y: 0, z: 5 } }])), rules: {} };
  const sv = Object.create(ServerVehicles.prototype);
  Object.assign(sv, { host, views: new Map(), carts: { carts: [], reap() {} }, boats: { carts: [boat], reap() {} }, hanging: { track: () => [] } });
  for (const [id] of viewers) sv.views.set(id, { known: new Map() });
  return { host, sv };
};

test("a late joiner gets a spawn record at the boat's current position (floor(pos * 32) / 32, 0.3 high), rotation bytes and motion, not the last released state", () => {
  const boat = new Boats().spawnBoat({ x: 5.5, y: 0, z: 5.5, yaw: 0 });
  boat.id = 1;
  const { host, sv } = boatHost(boat, [["a", 5]]);
  for (let t = 0; t < 12; t++) { boat.x += 0.003; boat.yaw = f(t * 0.2); boat.vx = 0.01; sv.track(); } // under the 4/32 block and 4/256 turn thresholds: no packet
  const first = host.players.get("a").vehPackets.set[0];
  const released = Math.floor(5.5 * 32) / 32;
  assert.equal(first.x, released, "the first viewer holds the S0E from creation");
  host.players.set("b", { position: { x: 6, y: 0, z: 5 } }); sv.views.set("b", { known: new Map() });
  host.players.get("a").vehPackets = null;
  sv.track();
  const late = host.players.get("b").vehPackets.set[0];
  assert.equal(late.x, Math.floor(boat.x * 32) / 32, "serverPos from the current position");
  assert.notEqual(late.x, released);
  assert.equal(late.yaw, f(f(Math.floor(f(boat.yaw * 256 / 360)) * 360) / 256), "the entity's rotation as the S0E byte");
  assert.ok(Math.abs(late.y - boat.posY - 0.3) < 0.04 || late.y >= boat.posY + 0.25, "the constructor's lift");
  assert.equal(late.mx, Math.trunc(0.01 * 8000) / 8000, "the spawn's S12 carries the motion");
});

test("a late viewer's serverPos keeps the offset from the entry's: later S15 deltas land on it, an S18 sets it absolutely", () => {
  const tr = new CartTracker(), boat = { boat: true, id: 3, x: 5.5, posY: 0.3, z: 5.5, yaw: 0, pitch: 0, vx: 0, vy: 0, vz: 0 };
  const st = () => ({ x: boat.x, y: boat.posY, z: boat.z, yaw: boat.yaw, pitch: boat.pitch });
  tr.tick(boat, st());
  for (let t = 0; t < 4; t++) { boat.x += 0.05; tr.tick(boat, st()); } // 0.2 total: entry serverPos 176 -> 182 after one packet
  const base0 = tr.tick(boat, st());
  const j = tr.join(boat, false);
  assert.equal(j.sx, Math.floor(boat.x * 32));
  const viewer0 = tr.forViewer(boat, j, base0);
  assert.equal(viewer0.x, j.sx / 32, "nothing released since: the spawn position");
  let base = base0;
  for (let t = 0; t < 12; t++) { boat.x += 0.05; base = tr.tick(boat, st()); }
  const v1 = tr.forViewer(boat, j, base), en = tr.entries.get(boat);
  assert.ok(base.x !== j.sx / 32);
  assert.equal(v1.x, (en.m.sx + j.sx - j.msx) / 32, "deltas on the viewer's own serverPos");
  boat.x += 5; let tp = base; for (let t = 0; t < 4; t++) tp = tr.tick(boat, st());
  assert.equal(tr.forViewer(boat, j, tp).x, tp.x, "an S18 puts it at the entry's");
});
