// Batch 86 seat86: a riding client's C0C (EntityClientPlayerMP.onUpdate's riding branch) and the server's processInput / processPlayer riding rules; the client boat reading
// the rider's input of the tick before (World.updateEntities); lily pads a boat breaks (World.func_147480_a: level event 2001, the drop) on the client copy and on the server.
// Facts: .shared-memory/notes/seat86-b86-track.md (bytecode-read). No browser.
import test from "node:test";
import assert from "node:assert/strict";
import { World, WATER, LILY_PAD, SNOW_LAYER } from "./world.js";
import { RemoteVehicles, riderPacket, riderRecord } from "./multiplayer/remote-vehicles.js";
import { DedicatedSimulation } from "./multiplayer/simulation.js";
import { cleanRide, applyRide } from "./multiplayer/server-vehicles.js";
import { idleActivity } from "./multiplayer/server-idle.js";
import { IDLE_INPUT } from "./multiplayer/protocol.js";
import { boatClearCell } from "./boats.js";

const f = Math.fround;

test("riderPacket: the C0C is the movement input (x 0.3D sneaking) times 0.98F, native strafe to the left, with jump and sneak", () => {
  assert.deepEqual(riderPacket({ forward: 1, strafe: 0 }), { s: f(-0 * f(0.98)), f: f(f(1) * f(0.98)), j: false, k: false });
  const r = riderPacket({ forward: -1, strafe: 1, jump: true });
  assert.equal(r.f, f(-1 * f(0.98))); assert.equal(r.s, f(-1 * f(0.98))); assert.equal(r.j, true);
  const sn = riderPacket({ forward: 1, sneak: true });
  assert.equal(sn.f, f(f(1 * 0.3) * f(0.98)), "MovementInputFromOptions: (float)(moveForward * 0.3D), then sv.e's 0.98F");
  assert.equal(sn.k, true);
  assert.equal(riderRecord({ yaw: 0, forward: 1 }, { forward: 0 }).moveForward, 0, "the steering comes from `move`, the yaw from `input`");
});

const pool = () => {
  const w = new World("b86-seat");
  for (let x = 0; x <= 40; x++) for (let z = 0; z <= 40; z++) for (let y = 3; y <= 12; y++) w.put(x, y, z, y === 3 ? 1 : y <= 8 ? WATER : 0, 0, false);
  return w;
};
const own = (x = 20.5) => ({ v: "b1", x, y: 8.8, z: 20.5, yaw: 0, pitch: 0, own: 1, tx: x, ty: 8.8, tz: 20.5, vs: 0, rs: 0, mx: 0, my: 0, mz: 0 });

test("the client boat reads the rider's moveForward of the tick before (the rider is updated after its mount)", () => {
  const rv = new RemoteVehicles(pool());
  rv.apply({ set: [own()] });
  rv.ride("b1", { yaw: 0, forward: 1, strafe: 0 }); rv.tick();
  const c = rv.copies.get("b1");
  assert.equal(c.v.rider.moveForward, 0, "first tick: no input the tick before");
  rv.ride("b1", { yaw: 0, forward: 0, strafe: 0 }); rv.tick();
  assert.equal(c.v.rider.moveForward, f(f(1) * f(0.98)), "the forward key of the last tick");
  rv.ride("b1", { yaw: 0, forward: 0, strafe: 0 }); rv.tick();
  assert.equal(c.v.rider.moveForward, 0);
});

test("the own boat's lily pad plays level event 2001 (id + meta << 12) on the client before the cell clears; a snow layer plays none", () => {
  const world = pool(), rv = new RemoteVehicles(world), aux = [], cleared = [];
  world.put(20, 9, 20, LILY_PAD, 2, false); world.put(21, 9, 20, SNOW_LAYER, 0, false); // corners at x 20.6 / 21.4
  rv.aux = (id, x, y, z, data) => aux.push([id, x, y, z, data, world.get(x, y, z)]);
  rv.cleared = (...a) => cleared.push(a);
  rv.apply({ set: [own(21)] }); rv.ride("b1", { yaw: 0 }); rv.tick();
  assert.equal(world.get(20, 9, 20), 0); assert.equal(world.get(21, 9, 20), 0);
  assert.deepEqual(aux, [[2001, 20, 9, 20, LILY_PAD + (2 << 12), LILY_PAD]], "one event, while the pad is still there");
  assert.equal(cleared.length, 2);
});

test("boatClearCell: a lily pad sends 2001, drops itself, then clears; a snow layer only clears", () => {
  const world = pool(), log = [];
  world.put(5, 9, 5, LILY_PAD, 0, false); world.put(6, 9, 6, SNOW_LAYER, 3, false);
  const hooks = { aux: (...a) => log.push(["aux", ...a]), drop: (st, ...a) => log.push(["drop", st, ...a]), set: (...a) => { log.push(["set", ...a]); world.set(...a, 0); } };
  boatClearCell(world, 5, 9, 5, LILY_PAD, hooks); boatClearCell(world, 6, 9, 6, SNOW_LAYER, hooks);
  assert.deepEqual(log, [["aux", 2001, 5, 9, 5, LILY_PAD], ["drop", [{ id: LILY_PAD, count: 1, damage: 0 }], 5, 9, 5], ["set", 5, 9, 5], ["set", 6, 9, 6]]);
});

// ---- the server ----
const key = n => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const input = (controls = {}, ride) => ({ type: "input", controls: { ...IDLE_INPUT, ...controls }, yaw: 0, pitch: 0, current: 0, hotbar: Array(9).fill(null), ...(ride ? { ride } : {}) });
function fixture() {
  const world = new World("mp-seat-b86");
  for (let x = 20; x <= 110; x++) for (let z = 20; z <= 110; z++) for (let y = 9; y <= 24; y++) world.put(x, y, z, y === 9 ? 1 : 0, 0, false);
  for (let x = 30; x <= 40; x++) for (let z = 30; z <= 40; z++) { world.put(x, 9, z, WATER, 0, false); world.put(x, 8, z, 1, 0, false); }
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  return new DedicatedSimulation({}, { world, gameMode: "survival", mobs: false });
}
const join = (s, id, n, x, z, y = 10) => { const p = s.addPlayer(id, id + "x", key(n)); p.position.copy({ x, y, z }); p.previous.copy(p.position); s.input(id, input()); return p; };
const seated = () => {
  const s = fixture(), p = join(s, "a", 1, 35.5, 35.5, 9.5), sv = s.vehicles;
  const boat = sv.spawnVehicle("boat", 35.5, 9, 35.5);
  s.tick(); s.tick();
  sv.queue("a", { v: `b${boat.id}`, hit: false }); s.tick();
  assert.ok(p.mount?.boat);
  return { s, p, sv, boat };
};

test("server: the C0C steers (moveForward / moveStrafing in [-1, 1], else the old value), a tick without one keeps them, its sneak dismounts", () => {
  const { s, p } = seated();
  s.input("a", input({ forward: 0 }, riderPacket({ forward: 1 }))); s.tick();
  assert.equal(p.mount.rider.moveForward, f(f(1) * f(0.98)), "the packet's moveForward, though the controls say 0");
  s.input("a", input({}, { s: 0.5, f: 2, j: false, k: false })); s.tick();
  assert.equal(p.mount.rider.moveForward, f(f(1) * f(0.98)), "2 is out of range: the old value stays");
  assert.equal(p.mount.rider.moveStrafing, 0.5);
  s.input("a", input({ forward: 1 })); s.tick();
  assert.equal(p.mount.rider.moveStrafing, 0.5, "no C0C this tick: nothing changes");
  s.input("a", input({ sneak: false }, { s: 0, f: 0, j: false, k: true })); s.tick();
  assert.equal(p.mount, null, "setSneaking from the C0C, then updateRidden lets go");
});

test("server: cleanRide / applyRide", () => {
  assert.equal(cleanRide(null), null); assert.equal(cleanRide(3), null);
  const r = cleanRide({ s: "x", f: -1, j: 1, k: true });
  assert.ok(Number.isNaN(r.s)); assert.equal(r.f, -1); assert.equal(r.j, false); assert.equal(r.k, true);
  const rider = { moveStrafing: 0.25, moveForward: 0.5 };
  applyRide(rider, r);
  assert.equal(rider.moveStrafing, 0.25, "NaN fails both bounds (Java float compare)"); assert.equal(rider.moveForward, -1);
});

test("server: a boat breaking a lily pad sends 2001 to every player within 64 blocks (the rider too) and drops the pad; a snow layer sends none", () => {
  const { s, p, boat } = seated();
  const far = join(s, "b", 2, 105.5, 105.5), near = join(s, "c", 3, 60.5, 60.5);
  for (const q of [p, far, near]) q.itemsOut = null;
  const cx = Math.floor(boat.x - 0.4), cz = Math.floor(boat.z - 0.4), cy = Math.floor(boat.posY) + 1;
  s.world.put(cx, cy, cz, LILY_PAD, 0, false);
  const before = s.items.items.length;
  s.tick();
  assert.equal(s.world.get(cx, cy, cz), 0);
  const ev = q => (q.itemsOut ?? []).filter(m => m.type === "aux").flatMap(m => m.events);
  assert.deepEqual(ev(p), [{ id: 2001, x: cx, y: cy, z: cz, data: LILY_PAD }]);
  assert.deepEqual(ev(near), ev(p));
  assert.deepEqual(ev(far), [], "over 64 blocks away");
  const drops = s.items.items.slice(before).filter(e => e.stack.id === LILY_PAD);
  assert.equal(drops.length, 1, "Block.dropBlockAsItem on the server world");
  for (const q of [p, far, near]) q.itemsOut = null;
  s.world.put(Math.floor(boat.x + 0.4), Math.floor(boat.posY) + 1, Math.floor(boat.z + 0.4), SNOW_LAYER, 0, false);
  s.tick();
  assert.deepEqual(ev(p), []);
});

test("idle: a riding client sends no C0B, so its sneak / sprint changes neither mark it active nor move the remembered state", () => {
  const prev = { current: 0, sneak: false, sprint: false };
  const out = idleActivity({ type: "input", controls: { sneak: true }, current: 0, ride: { s: 0, f: 0, j: false, k: true } }, prev);
  assert.equal(out.reset, false); assert.deepEqual(out.state, prev);
  const after = idleActivity({ type: "input", controls: { sneak: true }, current: 0 }, out.state);
  assert.equal(after.reset, true, "the first C0B after the ride");
  assert.equal(idleActivity({ type: "input", controls: {}, current: 2, ride: {} }, prev).reset, true, "a C09 still counts");
});
