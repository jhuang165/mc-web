// Batch 57 (tag b57bx): the ridden boat copy among other entities, replayed against the executed classes (tools/probes/BoatCopyProbe.java `ride2` records in
// public/research/boat-collide-reference.json): the unchanged EntityBoat (xi) on a remote world stand-in with the client player mounted, other entities (a boat, a minecart,
// a player stand-in, an item) in the world list. The port's copy (ObjectClient.rideBoat -> clientBlockers -> Boats.tickBoat) must match the boat state every tick, and the rider's
// landing sounds (clientRiderFall, the real EntityLivingBase.fall with EntityPlayerSP.playSound) must match the executed `played` calls.
import test from "node:test";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { ObjectTracker, ObjectClient, boatSeat, clientRiderFall } from "./object-tracker.js";
import { JavaRandom } from "./java-random.js";
import { WATER, SAND, solidBlock } from "./world.js";
import { fromOriginal } from "./block-registry.js";

const f = Math.fround;
const ref = JSON.parse(await readFile(new URL("../public/research/boat-collide-reference.json", import.meta.url), "utf8"));
const num = (v) => (v === "-0" ? -0 : v);
const GLASS = fromOriginal(20, 0).id;
function cellsOf(label) {
  const out = [];
  const water = (x0, x1, z0, z1) => { for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) { out.push([x, -1, z, WATER, 0], [x, 0, z, WATER, 0]); } };
  const floor = (id) => { for (let x = -3; x <= 4; x++) for (let z = -3; z <= 4; z++) out.push([x, -1, z, id, 0]); };
  if (label === "open") water(-4, 24, -8, 8); else if (label === "pool") water(-4, 4, -4, 4); else if (label === "floor12") floor(SAND); else if (label === "floor20") floor(GLASS);
  return out;
}
function probeWorld(label) {
  const map = new Map(cellsOf(label).map(([x, y, z, id, meta = 0]) => [`${x},${y},${z}`, [id, meta]]));
  const cell = (x, y, z) => map.get(`${x},${y},${z}`) ?? [y < 0 ? 3 : 0, 0];
  return { get: (x, y, z) => cell(x, y, z)[0], getMeta: (x, y, z) => cell(x, y, z)[1], meta: (x, y, z) => cell(x, y, z)[1], solid: (x, y, z) => solidBlock(...cell(x, y, z)),
    set: (x, y, z, id) => { map.set(`${x},${y},${z}`, [id, 0]); return true; } };
}
const rides = ref.cases;
const KINDS = { 0: "boat", 1: "minecart", 3: "item" };

function build(c, { blockers = true } = {}) {
  const world = probeWorld(c.world), t = new ObjectTracker(10, () => 0.5), player = { x: 0, y: 0, z: 0 };
  const live = { id: 1, x: 5.5, posY: 0.3, z: 5.5, y: 0.3, vx: 0, vy: 0, vz: 0, yaw: 0, pitch: 0, timeSinceHit: 0, forwardDir: 1, damage: 0, dead: false, bb: [4.75, 0, 4.75, 6.25, 0.6, 6.25] };
  const rider = { player: true, yaw: 0, moveForward: 0, moveStrafing: 0, vehicle: live, fallDistance: 0 };
  live.rider = rider;
  t.view.player = player; t.ctx.world = world; t.hooks.rides = (l) => l === live;
  t.serverTick({ boat: [{ ...live, rider: undefined }] }, player); t.clientTick();
  const [[, en]] = [...t.entries.entries()];
  const e = en.client;
  en.client.live = live;
  Object.assign(e, { world, x: c.spawn[0], y: c.spawn[1] + f(0.3), z: c.spawn[2], vx: c.spawn[3], vy: c.spawn[4], vz: c.spawn[5], yaw: f(c.boatYaw), pitch: 0, firstUpdate: true, inWater: false, vt: null, cv: [0, 0, 0], onGround: false });
  e.sim.rand = new JavaRandom(7);
  // the other entities: the tracker's own object copies, and a plain target for the player stand-in
  const copies = [], stands = [];
  for (const o of c.others) {
    if (KINDS[o[0]]) { const k = new ObjectClient(KINDS[o[0]], t); k.present = true; k.world = world; if (blockers) t.clientList.add({ client: k }); copies.push([k, o]); }
    else stands.push({ ref: {}, box: null, o });
  }
  if (blockers) t.hooks.clientTargets = () => stands.map((s) => ({ ref: s.ref, box: s.box }));
  return { world, t, e, live, rider, copies, stands };
}
const place = (k, kind, s) => { k.x = s[0]; k.y = s[1]; k.z = s[2]; };
const stand = (s) => [s[0] - f(0.3), s[1], s[2] - f(0.3), s[0] + f(0.3), s[1] + f(1.8), s[2] + f(0.3)]; // the player stand-in: 0.6 x 1.8 from its feet (yOffset 0)

function replay(c, { blockers = true, tweak = null } = {}) {
  const { world, t, e, rider, copies, stands } = build(c, { blockers });
  tweak?.(e);
  const log = [];
  t.hooks.particle = () => {};
  t.hooks.riderFall = (d, seat, w) => { for (const s of clientRiderFall(d, seat, w)) log.push([s.name, seat.x, seat.y, seat.z, s.volume, s.pitch]); };
  t.clientClear = (x, y, z) => world.set(x, y, z, 0);
  const bad = [];
  c.ticks.forEach(([st, rs, , , , played, attacks, others], tick) => {
    for (const row of c.inputs) if (row[0] <= tick) { rider.moveForward = row[1]; rider.moveStrafing = row[2]; rider.yaw = f(row[3]); }
    copies.forEach(([k, o], i) => place(k, o[0], others[c.others.indexOf(o)].map(num)));
    stands.forEach((s) => { s.box = stand(others[c.others.indexOf(s.o)].map(num)); });
    log.length = 0;
    e.stepVehicle();
    const b = e.rb;
    const got = [e.x, e.y, e.z, e.vx, e.vy, e.vz, e.yaw, b.onGround, b.collidedH, false, null, null, null, b.speed, b.fallDistance];
    got.forEach((v, i) => {
      const w = i === 6 || i === 14 ? f(st[i]) : num(st[i]);
      if (v === null) return;
      if (typeof w === "number" ? !(Math.abs(v - w) <= 1e-9 * Math.max(1, Math.abs(w))) : v !== w) bad.push([c.name, tick, "state", i, v, w]);
    });
    const seat = boatSeat(e), want = rs.map(num);
    [seat.x, seat.y, seat.z].forEach((v, i) => { if (Math.abs(v - want[i]) > 1e-9 * Math.max(1, Math.abs(want[i]))) bad.push([c.name, tick, "seat", i, v, want[i]]); });
    if (log.length !== played.length) bad.push([c.name, tick, "played count", log, played]);
    played.forEach(([name, x, y, z, vol, pitch], i) => {
      const g = log[i];
      if (!g || g[0] !== name || g[4] !== f(vol) || g[5] !== f(pitch) || [x, y, z].some((v, k) => Math.abs(g[1 + k] - num(v)) > 1e-9)) bad.push([c.name, tick, "sound", i, g, [name, x, y, z, vol, pitch]]);
    });
    void attacks;
  });
  return bad;
}

test("the collide records exist and cover the scenarios", () => {
  assert.ok(rides.length >= 25);
  for (const n of ["bx-solo", "bx-boat-ahead", "bx-cart-ahead", "bx-player-ahead", "bx-item-ahead", "bx-boat-crossing", "bx-beside-moving-boat", "bx-fall-stone-9", "bx-fall-sand-6", "bx-fall-onto-boat-below"]) assert.ok(rides.some((r) => r.name === n), n);
});

for (const c of rides) test(`ridden boat copy among other entities ${c.name}: state, seat and the rider's landing sounds match the executed classes each tick`, () => {
  assert.deepEqual(replay(c).slice(0, 3), []);
});

const rec = (n) => rides.find((r) => r.name === n);
const lastState = (c) => c.ticks[c.ticks.length - 1][0];

test("executed: a boat, a cart, a player or an item ahead stops the copy at the box (every entity's box blocks an EntityBoat)", () => {
  const solo = rec("bx-solo");
  assert.ok(lastState(solo)[0] > 20, "alone it sails on");
  const stopped = { "bx-boat-ahead": 5, "bx-boat-ahead-offset": 5, "bx-boat-ahead-edge": 5, "bx-cart-ahead": 5.26, "bx-player-ahead": 5.45, "bx-item-ahead": 5.625 };
  for (const [n, x] of Object.entries(stopped)) assert.ok(Math.abs(num(lastState(rec(n))[0]) - x) < 1e-3, `${n} ${lastState(rec(n))[0]}`);
  for (const n of ["bx-boat-ahead-touch", "bx-boat-ahead-miss"]) assert.ok(lastState(rec(n))[0] > 20, n); // a touching or missing box does not stop it
});

test("executed: a boat beside the copy, even moving and within 0.2, neither pushes the copy nor is pushed (the push is server side)", () => {
  const solo = rec("bx-solo").ticks.map((t) => JSON.stringify(t[0]));
  for (const n of ["bx-beside-moving-boat", "bx-beside-moving-boat-near"]) {
    const c = rec(n);
    assert.ok(c.ticks.every((t, i) => JSON.stringify(t[0]) === solo[i]), `${n} is the solo run`);
    assert.ok(c.ticks.every((t) => t[7].every((o) => num(o[3]) === 0 && num(o[5]) === 0)), `${n}: the other boat's motion is untouched`);
  }
});

test("executed: the rider's landing plays the fall and step sounds locally and deals no damage on the client", () => {
  const stone = rec("bx-fall-stone-9").ticks.flatMap((t) => t[5]);
  assert.deepEqual(stone.map((s) => s[0]), ["game.player.hurt.fall.big", "step.stone"]);
  assert.equal(rides.filter((r) => r.name.startsWith("bx-fall-")).every((r) => r.ticks.every((t) => t[6] === 1 || t[6] === 0)), true);
  assert.equal(rec("bx-fall-stone-3").ticks.flatMap((t) => t[5]).length, 0, "3 blocks is no fall");
  assert.equal(rec("bx-fall-water-9").ticks.flatMap((t) => t[5]).length, 0, "water ends the fall");
  assert.equal(rec("bx-fall-onto-boat-below").ticks.flatMap((t) => t[5]).length, 1, "landing on a boat plays the fall sound only (air under the feet)");
});

test("without the other entities' boxes the copy sails through them (mutation check)", () => {
  for (const n of ["bx-boat-ahead", "bx-cart-ahead", "bx-player-ahead", "bx-item-ahead"]) assert.ok(replay(rec(n), { blockers: false }).length > 0, n);
  const ahead = rec("bx-boat-ahead");
  assert.ok(replay(ahead, { tweak: (e) => { e.clientBlockers = () => []; } }).length > 0);
});

test("creative players and distances up to 3 play nothing; a jump boost lowers the fall (clientRiderFall)", () => {
  const world = probeWorld("empty"), seat = { x: 0.5, y: 0.1, z: 0.5 };
  assert.deepEqual(clientRiderFall(9, seat, world, { creative: true }), []);
  assert.deepEqual(clientRiderFall(3, seat, world), []);
  assert.deepEqual(clientRiderFall(0, seat, world), []);
  assert.deepEqual(clientRiderFall(9, seat, world).map((s) => s.name), ["game.player.hurt.fall.big", "step.stone"]);
  assert.deepEqual(clientRiderFall(3.9, seat, world, { amplifier: 0 }), []);
  assert.deepEqual(clientRiderFall(9, seat, world, { amplifier: 1 }).map((s) => s.name), ["game.player.hurt.fall.small", "step.stone"]);
});
