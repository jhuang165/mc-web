// Batch 89 spcopy89: the integrated server's copy of the player (ai.js PlayerView, entities.js serverPlayerUpdate, server-process-player.js) after spcopy88.
// Bytecode-read (1.7.10 jar; server-process-player.js has the offsets):
//   - EntityBoat / EntityMinecart.attackEntityFrom (xi.a / xl.a 106-118) call riddenByEntity.mountEntity(this) before setDead; EntityPlayerMP.mountEntity (mw.a(sa)) sends S1B
//     and setPlayerLocation at the seat, so a boat or cart broken under the player gives an S08 there (a crash or /kill gives none: spcopy88's dead mount).
//   - transferPlayerToDimension (oi.a(mw, int)) removes the player from the old world at once (mt.f(sa) -> World.removePlayerEntityDangerously), and neither it nor
//     transferEntityToWorld writes the motion: only the Teleporter turns it (placeInExistingPortal, motionY kept) or zeroes it (the End's platform, a portal with no side).
//   - EntityPlayerMP.mountEntity and sleepInBedAt (mw.a(III): motion zeroed, the bed spot, S0A, setPlayerLocation, S0A) both end in setPlayerLocation: the copy waits for the C06.
// The walks run the client physics main.js runs (player-physics.js movePlayer, player-environment.js finishPlayerMovement) into the copy. Nothing here is a browser check.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { World } from "./world.js";
import { Survival } from "./survival.js";
import { EntityWorld } from "./entities.js";
import { movePlayer } from "./player-physics.js";
import { vector } from "./player-physics-fixture.js";
import { PlayerMotion } from "./player-movement.js";
import { finishPlayerMovement } from "./player-environment.js";
import { Boats } from "./boats.js";
import { Minecarts } from "./minecarts.js";
import { createPlayerRider, syncRider } from "./vehicle-simulation.js";
import { DimensionLive } from "./dimension-live.js";
import { GAME_IDS } from "./dimensions.js";
import { awaitedRuns, brokenMountLocation } from "./server-process-player.js";

const STONE = 1;
const flat = (name) => {
  const world = new World(name);
  for (let x = 30; x <= 50; x++) for (let z = 26; z <= 54; z++) for (let y = 9; y <= 40; y++) world.put(x, y, z, y === 9 ? STONE : 0, 0, false);
  return world;
};
const body = { alive: true, width: 0.6, height: 1.8, eyeHeight: 1.62 };
const at = (p) => ({ x: p.x, y: p.y, z: p.z });

// One game tick as main.js runs it. `serverCorrect` is main.js's: the S08 puts the client at the spot with its motion zeroed (bjb.a(fu)), and each one is recorded.
function host(name, { correct = true, start = { x: 40.5, y: 10, z: 40.5 } } = {}) {
  const world = flat(name);
  const w = new EntityWorld(world, [], () => 0.5), s = new Survival({});
  const state = { world, position: vector(start.x, start.y, start.z), previous: vector(start.x, start.y, start.z), velocity: vector(0, 0, 0), motion: new PlayerMotion(), grounded: true,
    collidedH: false, flying: false, fallDistance: 0, landedFall: 0, yaw: 0, survival: s, eating: null };
  const fixes = [];
  if (correct) w.serverCorrect = (to) => { fixes.push({ x: to.x, y: to.y, z: to.z }); Object.assign(state.position, at(to)); Object.assign(state.previous, at(to)); state.velocity.set(0, 0, 0); };
  const p = w.ai.player, landed = [];
  const calls = [], process = w.processPlayer.bind(w);
  w.processPlayer = (q, pkt, ground) => { calls.push({ pkt, answered: !q.hasMoved }); return process(q, pkt, ground); };
  const located = [], setLocation = p.setLocation.bind(p);
  p.setLocation = (to, o) => { located.push(at(to)); return setLocation(to, o); };
  const step = (controls = {}, extra = {}) => {
    const c = { forward: 0, strafe: 0, sneak: false, sprint: false, jump: false, ...controls };
    const r = movePlayer(state, c);
    if (state.grounded && state.landedFall > 0) landed.push(state.landedFall);
    finishPlayerMovement(state, { inWater: r.inWater, inLavaNow: r.inLavaNow, oldPosition: r.oldPosition }, {});
    Object.assign(p, { sneaking: false, flying: false, riding: false, sleeping: false, packetGround: !!state.grounded, sprinting: false, yaw: 0, ...extra });
    w.tick({ ...body, ...at(state.position) }, s);
  };
  for (let i = 0; i < 3; i++) step();
  return { world, w, s, p, state, step, fixes, calls, located, landed };
}
// A minecart ride (spcopy88's harness): the copy is seated by the live cart's updateRiderPosition (main.js serverSeat), its ridingEntity is rider.vehicle (serverMount).
function rideHost(name, opts) {
  const h = host(name, opts);
  const rider = createPlayerRider();
  syncRider({ rider, position: h.state.position, yaw: 0, world: h.world, survival: h.s, fallSound: () => {} });
  const carts = new Minecarts();
  const cart = carts.spawnEmpty({ x: 40.5, y: 11.5, z: 44.5 });
  const seatOf = () => { const was = at(rider); carts.updateRiderPosition(cart); const seat = at(rider); Object.assign(rider, was); return seat; };
  h.w.serverSeat = seatOf;
  h.w.serverMount = () => rider.vehicle ?? null;
  const ride = (n) => { for (let i = 0; i < n; i++) { carts.tick(h.world, { entities: [] }); carts.updateRiderPosition(cart); Object.assign(h.p, { riding: true, packetGround: false }); h.w.tick({ ...body, ...at(rider) }, h.s); } };
  return { ...h, rider, carts, cart, seatOf, ride };
}
// The port's client lets go of a dead vehicle at once (vehicle-simulation.js: minecarts.dismount, releaseRider).
const letGo = (h) => {
  h.carts.dismount(h.world, h.rider);
  Object.assign(h.state.position, at(h.rider)); Object.assign(h.state.previous, at(h.rider));
  Object.assign(h.state, { grounded: false, fallDistance: 0, landedFall: 0 }); h.state.velocity.set(0, 0, 0);
};

test("a cart broken by the player's hit: mountEntity(this) -> setPlayerLocation at the seat; the client is put there, its C06 answers, and both fall from the seat", () => {
  const h = rideHost("spcopy89-hitcart");
  assert.ok(h.carts.mount(h.cart, h.rider));
  h.ride(30);
  const seat = at(h.p);
  assert.deepEqual(seat, h.seatOf());
  h.fixes.length = 0; h.calls.length = 0;
  // A Creative hit (or damage over 40): EntityMinecart.attackEntityFrom with a rider re-links it before setDead.
  assert.equal(h.carts.attack(h.cart, 1, { creative: true }), true);
  assert.equal(h.cart.dead, true); assert.equal(h.cart.remounted, true);
  letGo(h);
  const spot = at(h.state.position);
  assert.notDeepEqual(spot, seat, "the port's client let go at its dismount spot");
  h.step();
  assert.deepEqual(h.fixes, [seat], "one S08, at the seat");
  assert.deepEqual(h.calls[0], { pkt: { ...seat, onGround: false }, answered: true }, "the C06 from the seat answers it");
  assert.equal(h.p.corrected ?? 0, 0, "a mount event, not a correction");
  assert.deepEqual(at(h.state.position), seat, "bjb.a(fu) put the client at the seat");
  for (let i = 0; i < 30; i++) h.step();
  assert.equal(h.fixes.length, 1); assert.equal(h.p.corrected ?? 0, 0);
  assert.ok(h.state.grounded && Math.abs(h.p.y - h.state.position.y) < 1e-9, "both landed together");
  assert.ok(h.calls.slice(1).every((c) => !c.answered), "no further wait");
});

test("a cart broken in the world pass (lava, a cactus, a mob's hit) while the client still sits: the S08 at the seat, then the C05 takes the walking branch", () => {
  const h = rideHost("spcopy89-lavacart");
  assert.ok(h.carts.mount(h.cart, h.rider));
  h.ride(30);
  const seat = at(h.p);
  h.fixes.length = 0; h.calls.length = 0;
  for (let i = 0; i < 5 && !h.cart.dead; i++) h.carts.attack(h.cart, 4, { source: "lava" }); // damage 40, then over 40
  assert.equal(h.cart.dead, true); assert.equal(h.cart.remounted, true);
  Object.assign(h.p, { riding: true, packetGround: false });
  h.w.tick({ ...body, ...seat }, h.s); // the client's link ends after the network tick (vehicle-simulation.js finishVehicleTick)
  assert.deepEqual(h.fixes, [seat]);
  assert.deepEqual(h.calls, [{ pkt: { ...seat, onGround: false }, answered: true }, { pkt: null, answered: false }], "the answer, then the C05 (no position)");
  assert.deepEqual(at(h.p), seat);
  assert.equal(h.p.corrected ?? 0, 0);
});

test("a cart that dies without attackEntityFrom (/kill, the void) sends no S08 (spcopy88's dead mount stands)", () => {
  const h = rideHost("spcopy89-killcart");
  assert.ok(h.carts.mount(h.cart, h.rider));
  h.ride(30);
  h.fixes.length = 0; h.calls.length = 0;
  h.carts.kill(h.cart);
  assert.equal(h.cart.dead, true); assert.ok(!h.cart.remounted);
  letGo(h);
  h.step();
  assert.equal(h.fixes.length, 0);
  assert.equal(h.calls[0].answered, false);
});

test("boats: attackEntityFrom's break marks the re-link only with a rider; the crash break and an empty boat's break do not", () => {
  const boats = new Boats();
  const ridden = boats.spawnBoat({ x: 40.5, y: 10, z: 40.5 }, { seed: 1 }), rider = createPlayerRider();
  assert.ok(boats.mount(ridden, rider));
  boats.attack(ridden, 3); assert.ok(!ridden.dead && !ridden.remounted, "damage 30: no break");
  boats.attack(ridden, 2); assert.ok(ridden.dead && ridden.remounted, "damage 50 > 40: the rider is re-linked before setDead");
  const creative = boats.spawnBoat({ x: 42.5, y: 10, z: 40.5 }, { seed: 2 }), r2 = createPlayerRider();
  assert.ok(boats.mount(creative, r2));
  boats.attack(creative, 0.1, { creative: true }); assert.ok(creative.dead && creative.remounted, "a Creative hit breaks it at any damage");
  const empty = boats.spawnBoat({ x: 44.5, y: 10, z: 40.5 }, { seed: 3 });
  boats.attack(empty, 5); assert.ok(empty.dead && !empty.remounted);
  const crashed = boats.spawnBoat({ x: 46.5, y: 10, z: 40.5 }, { seed: 4 }), r3 = createPlayerRider();
  assert.ok(boats.mount(crashed, r3));
  boats.crashBreak(crashed); assert.ok(crashed.dead && !crashed.remounted, "EntityBoat's crash only setDead");
});

test("brokenMountLocation: the S08 at the seat through serverCorrect, answered; with no client to take it the copy waits; nothing without a seat", () => {
  const h = host("spcopy89-unit");
  h.p.brokenSeat = { x: 41.5, y: 11, z: 40.5 };
  brokenMountLocation(h.w, h.p);
  assert.equal(h.p.brokenSeat, null);
  assert.deepEqual(h.fixes, [{ x: 41.5, y: 11, z: 40.5 }]);
  assert.equal(h.p.hasMoved, false); assert.deepEqual(h.p.answer, { x: 41.5, y: 11, z: 40.5, onGround: false });
  const lone = host("spcopy89-unit2", { correct: false });
  lone.p.brokenSeat = { x: 41.5, y: 11, z: 40.5 };
  brokenMountLocation(lone.w, lone.p);
  assert.equal(lone.p.answer, null); assert.equal(lone.p.hasMoved, false);
  const before = lone.located.length;
  brokenMountLocation(lone.w, lone.p);
  assert.equal(lone.located.length, before);
});

test("a portal trip takes the player out of the old world at once: the copy stops ticking and following packets, and no mob finds it; a failed trip gives it back", () => {
  const h = host("spcopy89-left");
  const spot = at(h.p), ticks = h.p.netTicks;
  let moved = 0;
  h.w.serverCopyMoved = () => { moved++; };
  h.p.left = true; // main.js: dims.busy from the portal tick until the new world launches (the async save runs meanwhile)
  h.calls.length = 0;
  for (let i = 0; i < 20; i++) { h.step({ forward: 1 }, { left: true }); }
  assert.equal(h.calls.length, 0, "no processPlayer");
  assert.equal(moved, 0, "no mw.i()");
  assert.deepEqual(at(h.p), spot, "the old copy stays where it left");
  assert.equal(h.p.netTicks, ticks);
  assert.ok(Math.hypot(h.state.position.x - spot.x, h.state.position.z - spot.z) > 2, "the client walked on");
  const mob = { x: spot.x, y: spot.y, z: spot.z + 1, distSq: () => 1 };
  assert.equal(h.w.ai.closestPlayer(mob, 16), null);
  assert.equal(h.w.ai.closestVulnerablePlayer(mob, 16), null);
  h.p.left = false;
  assert.equal(h.w.ai.closestPlayer(mob, 16), h.p);
  for (let i = 0; i < 5; i++) h.step({}, { left: false });
  assert.ok(h.calls.length > 0 && moved > 0, "back in the world after a failed trip");
  assert.equal(h.p.corrected ?? 0, 0);
  const main = readFileSync(new URL("./main.js", import.meta.url), "utf8");
  assert.match(main, /if \(mobs\?\.ai\?\.player\) mobs\.ai\.player\.left = !!dims\.busy;/);
  const ents = readFileSync(new URL("./entities.js", import.meta.url), "utf8");
  assert.match(ents, /if \(p\?\.alive && !p\.unticked && !p\.left\) \{/);
});

test("the motion crosses the trip: arriveFrom takes the Teleporter's result (or the old copy's own); travel puts the copy's motion in the transit", async () => {
  const old = host("spcopy89-from").p;
  Object.assign(old.motion, { x: 0.25, y: -0.3, z: 0.1 });
  old.fallDistance = 2;
  const fresh = host("spcopy89-to").p;
  fresh.arriveFrom(old, { x: -0.1, y: -0.3, z: 0.25 });
  assert.deepEqual(fresh.motion, { x: -0.1, y: -0.3, z: 0.25 });
  assert.equal(fresh.fallDistance, 2);
  const kept = host("spcopy89-to2").p;
  kept.arriveFrom(old);
  assert.deepEqual(kept.motion, { x: 0.25, y: -0.3, z: 0.1 });
  assert.notEqual(kept.motion, old.motion, "copied, not shared");
  // DimensionLive.travel: the transit carries host.player().motion (main.js: the copy's).
  const root = { id: "w1", seed: "s", name: "W", position: { x: 1, y: 70, z: 2, yaw: 0, pitch: 0 } };
  let next = null;
  const live = new DimensionLive({ active: () => root, worlds: () => [root], dirty() {}, save: async () => {}, sound() {}, player: () => ({ x: 3.5, y: 11, z: 5.5, yaw: 0, motion: old.motion }),
    openWorld: async (r) => { next = r; }, ticks: () => 150 });
  live.beginAway = async () => {};
  assert.equal(await live.travel(-1), true);
  assert.deepEqual(next.transit.motion, { x: 0.25, y: -0.3, z: 0.1 });
  const src = readFileSync(new URL("./main.js", import.meta.url), "utf8");
  assert.match(src, /player: \(\) => \(\{ x: position\.x, y: position\.y, z: position\.z, yaw, motion: mobs\?\.ai\?\.player\?\.motion \}\)/);
  assert.match(src, /tripArrival = trip \? transit : null;/);
});

// DimensionLive.arrive runs the transit's motion through the port's Teleporter (dimensions.js, ahp.a / ahp.b): into the End it is zeroed, at a Nether portal it is turned.
async function arriveWith(to, motion, dir = 0) {
  const live = new DimensionLive({ active: () => null, worlds: () => [], dirty() {}, save: async () => {}, sound() {}, player: () => ({ x: 0, y: 0, z: 0, yaw: 0 }), openWorld: async () => {}, ticks: () => 0 });
  live.readEdits = async () => [];
  const portal = new Set();
  for (let y = 64; y <= 66; y++) for (const z of [3, 4]) portal.add(`10,${y},${z}`); // a portal along z at x = 10: k2 = 1 (the block at z + 1 is portal)
  const prepared = { streaming: false, dimension: to, get: (x, y, z) => (portal.has(`${x},${y},${z}`) ? GAME_IDS.portal : y < 64 ? GAME_IDS.obsidian : 0) };
  const record = { id: "w1-nether", rootId: "w1", seed: "s", dimension: to, chunked: true, transit: { from: 0, x: 80.5, y: 64, z: 28.5, yaw: 0, dir, motion } };
  const t = record.transit;
  await live.arrive(prepared, record);
  return { t, record };
}

test("arrive: the End's platform zeroes the motion; a Nether portal turns x / z to its facing and keeps y (placeInExistingPortal)", async () => {
  const end = await arriveWith(1, { x: 0.25, y: -0.3, z: 0.1 });
  assert.deepEqual(end.t.arrivalMotion, { x: 0, y: 0, z: 0 });
  const nether = await arriveWith(-1, { x: 0.25, y: -0.3, z: 0.1 }, 0);
  const m = nether.t.arrivalMotion;
  assert.equal(m.y, -0.3, "motionY is not written");
  assert.deepEqual([Math.abs(m.x), Math.abs(m.z)].sort(), [0.1, 0.25].sort(), "a quarter or half turn of (x, z)");
  assert.ok(Math.abs(nether.record.position.x - 10.5) < 2 && Math.abs(nether.record.position.z - 4) < 2, "placed at the portal");
  const still = await arriveWith(-1, undefined, 0);
  assert.deepEqual(still.t.arrivalMotion, { x: 0, y: 0, z: 0 }, "no motion in the transit: nothing to turn");
  const src = readFileSync(new URL("./main.js", import.meta.url), "utf8");
  assert.match(src, /mobs\.ai\.player\.arriveFrom\(leftCopy, arrival\.arrivalMotion\)/);
});

test("the mount tick is mountEntity -> setPlayerLocation at the copy's spot; the C06 answers and the riding branch seats it, with no correction", () => {
  const h = rideHost("spcopy89-mount");
  const spot = at(h.p);
  h.located.length = 0; h.calls.length = 0;
  assert.ok(h.carts.mount(h.cart, h.rider));
  h.ride(1);
  assert.deepEqual(h.located, [spot], "one setPlayerLocation, where the copy stood");
  assert.equal(h.p.branch, "riding");
  assert.equal(h.p.hasMoved, true, "the C06 answered");
  assert.deepEqual(at(h.p), h.seatOf(), "seated by the riding branch");
  h.ride(20);
  assert.equal(h.p.corrected ?? 0, 0); assert.equal(h.fixes.length, 0);
  assert.equal(h.calls.length, 0, "the riding branch reads no position");
});

test("an unanswered mount S08 keeps the copy waiting: no riding branch, the S08 again every 20th network tick", () => {
  const h = rideHost("spcopy89-mountwait", { correct: false });
  const spot = at(h.p), located = h.p.setLocation;
  h.p.setLocation = (to, o) => located(to, { ...o, answered: false }); // the C06 never comes (in the game main.js's client always answers)
  let moved = 0;
  h.w.serverCopyMoved = () => { moved++; };
  assert.ok(h.carts.mount(h.cart, h.rider));
  const resent = [];
  for (let i = 0; i < 45; i++) { const n = h.p.netTicks, c = h.p.corrected ?? 0; h.ride(1); if ((h.p.corrected ?? 0) > c) resent.push(n); }
  assert.equal(h.p.hasMoved, false);
  assert.equal(moved, 0, "no mw.i() while r is false");
  assert.deepEqual(at(h.p), spot, "not seated");
  assert.ok(resent.length >= 2 && resent.every((n) => n % 20 === 0), `resends at ${resent}`);
});

test("the first sleeping tick is sleepInBedAt -> setPlayerLocation at the bed: motion zeroed, the C06 answers, then the sleeping branch keeps it there", () => {
  const h = host("spcopy89-sleep");
  Object.assign(h.p.motion, { x: 0.2, y: 0, z: -0.1 }); // a mob's push
  const bed = { x: 40.5, y: 10.5625, z: 47.5 };
  Object.assign(h.state.position, bed);
  h.located.length = 0;
  Object.assign(h.p, { sleeping: true, packetGround: true });
  let moved = 0;
  h.w.serverCopyMoved = () => { moved++; };
  h.w.tick({ ...body, ...bed }, h.s);
  assert.deepEqual(h.located, [bed]);
  assert.equal(h.p.branch, "sleeping");
  assert.equal(h.p.hasMoved, true);
  assert.equal(moved, 2, "the answering C06 and the tick's packet each take the sleeping branch");
  assert.deepEqual(at(h.p), bed);
  // sleepInBedAt zeroed the push; the two sleeping-branch onUpdateEntity runs then add only gravity from rest (no bed block under this test's box): -0.08 * 0.98, then (v - 0.08) * 0.98.
  assert.deepEqual([h.p.motion.x, h.p.motion.z], [0, 0], "sleepInBedAt zeroed the motion");
  assert.ok(Math.abs(h.p.motion.y - (-0.0784 - 0.08) * 0.98) < 1e-6, `motionY ${h.p.motion.y}`);
  for (let i = 0; i < 10; i++) { Object.assign(h.p, { sleeping: true }); h.w.tick({ ...body, x: bed.x + 0.1, y: bed.y, z: bed.z }, h.s); }
  assert.deepEqual(at(h.p), bed);
  assert.equal(h.p.corrected ?? 0, 0);
  // Unanswered: the sleeping branch waits too.
  const lone = host("spcopy89-sleepwait", { correct: false });
  const placed = lone.p.setLocation;
  lone.p.setLocation = (to, o) => placed(to, { ...o, answered: false });
  let n = 0;
  lone.w.serverCopyMoved = () => { n++; };
  for (let i = 0; i < 5; i++) { Object.assign(lone.p, { sleeping: true }); lone.w.tick({ ...body, ...bed }, lone.s); }
  assert.equal(n, 0); assert.equal(lone.p.hasMoved, false);
});

test("awaitedRuns: 0 while waiting, 2 for the answering tick, 1 otherwise", () => {
  const h = host("spcopy89-runs", { correct: false });
  const p = h.p;
  p.hasMoved = true; p.answer = null;
  assert.equal(awaitedRuns(h.w, p), 1);
  p.setLocation({ x: 41.5, y: 10, z: 40.5 });
  assert.equal(awaitedRuns(h.w, p), 2);
  assert.equal(p.hasMoved, true);
  p.setLocation({ x: 41.5, y: 10, z: 40.5 }, { answered: false });
  p.netTicks = 1;
  assert.equal(awaitedRuns(h.w, p), 0);
  p.answer = { x: 41.5, y: 10.5, z: 40.5, onGround: false }; // y off by 0.5: not the answer
  assert.equal(awaitedRuns(h.w, p), 0);
});
