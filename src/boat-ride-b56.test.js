// Batch 56 (tag b56bc): the boat the client player rides, replayed against the executed classes (tools/probes/BoatCopyProbe.java `ride` records in
// public/research/boat-copy-reference.json): the unchanged EntityBoat (xi) on a remote world stand-in, the client player mounted (S1B: sa.a(sa) and setIsBoatEmpty(false)),
// the rider's moveForward / moveStrafing / yaw set per tick. The port's copy (ObjectClient.rideBoat -> Boats.tickBoat with `remote`) must match the boat's state, the
// seat the rider is put on (Entity.updateRiderPosition), the splash sounds and particles, the world clears, and the rider's fall distance, every tick.
import test from "node:test";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { ObjectTracker, boatSeat } from "./object-tracker.js";
import { JavaRandom } from "./java-random.js";
import { WATER, SNOW_LAYER, LILY_PAD, solidBlock } from "./world.js";

const f = Math.fround;
const ref = JSON.parse(await readFile(new URL("../public/research/boat-copy-reference.json", import.meta.url), "utf8"));
const num = (v) => (v === "-0" ? -0 : v);
const internal = { 0: 0, 1: 3, 8: WATER, 9: WATER, 78: SNOW_LAYER, 111: LILY_PAD };
function probeWorld(cells) {
  const map = new Map(cells.map(([x, y, z, id, meta = 0]) => [`${x},${y},${z}`, [internal[id], meta]]));
  const cell = (x, y, z) => map.get(`${x},${y},${z}`) ?? [y < 0 ? 3 : 0, 0];
  return { get: (x, y, z) => cell(x, y, z)[0], getMeta: (x, y, z) => cell(x, y, z)[1], meta: (x, y, z) => cell(x, y, z)[1], solid: (x, y, z) => solidBlock(...cell(x, y, z)),
    set: (x, y, z, id) => { map.set(`${x},${y},${z}`, [id, 0]); return true; } };
}
const rides = ref.cases.filter((r) => r.kind === "ride");

function replay(c, tweak = null) {
  const world = probeWorld(c.cells), t = new ObjectTracker(10, () => 0.5), player = { x: 0, y: 0, z: 0 };
  const live = { id: 1, x: 5.5, posY: 0.3, z: 5.5, y: 0.3, vx: 0, vy: 0, vz: 0, yaw: 0, pitch: 0, timeSinceHit: 0, forwardDir: 1, damage: 0, dead: false, bb: [4.75, 0, 4.75, 6.25, 0.6, 6.25] };
  const rider = { player: true, yaw: 0, moveForward: 0, moveStrafing: 0, vehicle: live, fallDistance: 0 };
  live.rider = rider;
  t.view.player = player; t.ctx.world = world; t.hooks.rides = (l) => l === live;
  t.serverTick({ boat: [{ ...live, rider: undefined }] }, player); t.clientTick();
  const log = [];
  t.hooks.particle = (name, x, y, z, vx, vy, vz) => log.push(["p", name, x, y, z, vx, vy, vz]);
  t.hooks.sound = (name, x, y, z, vol, pitch) => log.push(["s", name, vol, pitch]);
  t.clientClear = (x, y, z, block) => { log.push(["c", x, y, z, block === SNOW_LAYER ? "air" : "break"]); world.set(x, y, z, 0); }
  const entry = [...t.entries.entries()][0];
  entry[1].client.live = live;
  const e = entry[1].client;
  Object.assign(e, { world, x: c.spawn[0], y: c.spawn[1] + f(0.3), z: c.spawn[2], vx: c.spawn[3], vy: c.spawn[4], vz: c.spawn[5], yaw: f(c.boatYaw), pitch: 0, firstUpdate: true, inWater: false, vt: null, cv: [0, 0, 0], onGround: false });
  e.sim.rand = new JavaRandom(7);
  tweak?.(e, live);
  const bad = [];
  c.ticks.forEach(([st, rs, sounds, particles, cleared], tick) => {
    for (const row of c.inputs) if (row[0] <= tick) { rider.moveForward = row[1]; rider.moveStrafing = row[2]; rider.yaw = f(row[3]); }
    for (const p of c.packets) if (p[0] === tick) { if (p[1] === 0) e.setVelocity(p[2], p[3], p[4]); else e.place(p[2], p[3], p[4], f(p[5]), f(p[6])); }
    log.length = 0;
    e.stepVehicle();
    const b = e.rb, bb = e.box();
    const got = [e.x, e.y, e.z, e.vx, e.vy, e.vz, e.yaw, b.onGround, b.collidedH, false, null, null, null, b.speed, b.fallDistance, bb[0], bb[1], bb[2]];
    got.forEach((v, i) => {
      const w = i === 6 || i === 14 ? f(st[i]) : num(st[i]); // yaw and fall distance are floats
      if (v === null) return;
      if (typeof w === "number" ? !(Math.abs(v - w) <= 1e-9 * Math.max(1, Math.abs(w))) : v !== w) bad.push([c.name, tick, "state", i, v, w]);
    });
    const seat = boatSeat(e), want = rs.map(num);
    [seat.x, seat.y, seat.z].forEach((v, i) => { if (Math.abs(v - want[i]) > 1e-9 * Math.max(1, Math.abs(want[i]))) bad.push([c.name, tick, "seat", i, v, want[i]]); });
    const gs = log.filter((r) => r[0] === "s"), gp = log.filter((r) => r[0] === "p"), gc = log.filter((r) => r[0] === "c");
    if (gs.length !== sounds.length) bad.push([c.name, tick, "sound count", gs.length, sounds.length]);
    sounds.forEach(([name, vol, pitch], i) => { if (!gs[i] || gs[i][1] !== name || gs[i][2] !== f(vol) || gs[i][3] !== f(pitch)) bad.push([c.name, tick, "sound", i, gs[i], [name, vol, pitch]]); });
    if (gp.length !== particles.length) bad.push([c.name, tick, "particle count", gp.length, particles.length]);
    particles.forEach((q, i) => { const g = gp[i]; if (!g || g[1] !== q[0] || q.slice(1).some((w, k) => Math.abs(g[2 + k] - num(w)) > 1e-9 * Math.max(1, Math.abs(num(w))))) bad.push([c.name, tick, "particle", i, g, q]); });
    if (gc.length !== cleared.length || gc.some((r, i) => r.slice(1).join() !== cleared[i].join())) bad.push([c.name, tick, "cleared", gc, cleared]);
  });
  // the rider's fall distance (EntityBoat.updateFallState -> Entity.fall on the rider) is the last tick's, counted once per landing above 3
  const fallen = num(c.beforeDismount[5]);
  if ((e.rb.falls > 0) !== (fallen > 0)) bad.push([c.name, "falls", e.rb.falls, fallen]);
  return bad;
}

test("the ride records exist and cover the scenarios", () => {
  assert.ok(rides.length >= 12);
  for (const n of ["ride-forward", "ride-turning", "ride-beach", "ride-crash-fast", "ride-fall-high", "ride-packets", "ride-clear-lilypads", "ride-flowing-water"]) assert.ok(rides.some((r) => r.name === n), n);
});

for (const c of rides) test(`ridden boat copy ${c.name}: state, seat, sounds, particles and clears match the executed classes each tick`, () => {
  assert.deepEqual(replay(c).slice(0, 3), []);
});

test("the executed client boat does not break on a fast crash or a high fall, and does not drag on the crash tick", () => {
  const crash = rides.find((r) => r.name === "ride-crash-fast");
  assert.ok(crash.ticks.every(([s]) => s[9] === false || s[9] === "false"), "never dead");
  assert.ok(crash.ticks.some(([s]) => s[8] === true), "collided");
  const fall = rides.find((r) => r.name === "ride-fall-high");
  assert.ok(num(fall.beforeDismount[5]) > 3 && fall.ticks.every(([s]) => s[9] === false || s[9] === "false"));
});

test("the client player's dismount keeps the seat (EntityPlayer.mountEntity skips dismountEntity on a client world)", () => {
  for (const c of rides) assert.deepEqual(c.dismount.slice(0, 3), c.beforeDismount.slice(0, 3), c.name);
});

test("mutation checks: dropping the strafe input, or a copy that never steps its boat, is caught", () => {
  const strafe = rides.find((r) => r.name === "ride-diagonal-strafe");
  assert.ok(replay(strafe, (e, live) => { live.rider = Object.create(live.rider, { moveStrafing: { get: () => 0, set() {} } }); }).length > 0);
  const lily = rides.find((r) => r.name === "ride-clear-lilypads");
  assert.ok(replay(lily, (e) => { e.tracker.rideBoats = null; const t = e.tracker; Object.defineProperty(t, "rideBoats", { get: () => ({ tickBoat: () => [], setPosition() {} }), set() {} }); }).length > 0);
});
