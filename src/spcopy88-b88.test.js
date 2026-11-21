// Batch 88 spcopy88: the integrated server's copy of the player (ai.js PlayerView, entities.js serverPlayerUpdate / processPlayer, server-process-player.js) after spcopy87.
// Bytecode-read (1.7.10 jar; server-process-player.js has the offsets): the landing's dust (World.playAuxSFX 2006), Block.onFallenUpon (the farmland trample) and the
// distance-fallen stat are the server's (EntityLivingBase.updateFallState and EntityPlayer.fall run on the client too, but `!isRemote` skips the first two and the client's addStat
// is EntityPlayer's empty one), so the copy's handleFalling does them and the client's landing no longer does. processPlayer's `if (!r) return` after mw.i() (681), a dead
// mount letting the copy go at its seat (Entity.updateRidden / World.updateEntities: no setPlayerLocation) against a dismount (mountEntity(null) -> setPlayerLocation), and a
// portal trip keeping the same EntityPlayerMP (transferPlayerToDimension: its fallDistance goes along, then setPlayerLocation at the arrival).
// The walks run the client physics main.js runs (player-physics.js movePlayer, player-environment.js finishPlayerMovement) into the copy. Nothing here is a browser check.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { World, WATER } from "./world.js";
import { Survival } from "./survival.js";
import { EntityWorld, setEntityBoxes } from "./entities.js";
import { movePlayer } from "./player-physics.js";
import { vector } from "./player-physics-fixture.js";
import { PlayerMotion } from "./player-movement.js";
import { finishPlayerMovement, landPlayer } from "./player-environment.js";
import { Farming } from "./farming.js";
import { Boats } from "./boats.js";
import { Minecarts } from "./minecarts.js";
import { boatBoxProvider } from "./entity-collision.js";
import { createPlayerRider, syncRider } from "./vehicle-simulation.js";
import { landingEffects } from "./damage-fx.js";
import { handleFalling } from "./server-process-player.js";

const STONE = 1, FARMLAND = 29;
const f = Math.fround;
const flat = (name) => {
  const world = new World(name);
  for (let x = 30; x <= 50; x++) for (let z = 26; z <= 54; z++) for (let y = 9; y <= 40; y++) world.put(x, y, z, y === 9 ? STONE : 0, 0, false);
  return world;
};
const body = { alive: true, width: 0.6, height: 1.8, eyeHeight: 1.62 };
const native = (distance) => Math.max(0, landingEffects(distance, { kind: "player" }).points);

// One game tick as main.js runs it, with the landing hooks main.js gives both sides: the client's (player-environment.js landPlayer: trample, landingDust) and the
// EntityWorld's (landingDust, onLand, serverFallStat), each recorded.
function host(name, build, at = { x: 40.5, y: 10, z: 40.5 }, { grounded = true, settle = 3 } = {}) {
  const world = flat(name); build?.(world);
  const w = new EntityWorld(world, [], () => 0.5), s = new Survival({});
  const hits = [], damage = s.damage.bind(s);
  s.damage = (n, reason, ...rest) => { hits.push({ n, reason }); return damage(n, reason, ...rest); };
  const fixes = [], server = { dust: [], trample: [], stat: [] }, client = { dust: [], trample: [] };
  w.serverCorrect = (to) => fixes.push({ ...to });
  w.landingDust = (e, x, y, z, n) => server.dust.push({ who: e.isPlayer ? "copy" : e.type, x, y, z, n });
  w.onLand = (e, d) => server.trample.push({ who: e.isPlayer ? "copy" : e.type, d, x: e.x, y: e.y, z: e.z });
  w.serverFallStat = (e, d) => server.stat.push(Math.round(f(d) * 100));
  const state = { world, position: vector(at.x, at.y, at.z), previous: vector(at.x, at.y, at.z), velocity: vector(0, 0, 0), motion: new PlayerMotion(), grounded, collidedH: false,
    flying: false, fallDistance: 0, landedFall: 0, yaw: 0, survival: s, eating: null };
  const p = w.ai.player, landed = [];
  const hooks = { trample: (pos, d) => client.trample.push(d), landingDust: (x, y, z, n) => client.dust.push({ x, y, z, n }) };
  const step = (controls = {}, { boats = null } = {}) => {
    const c = { forward: 0, strafe: 0, sneak: false, sprint: false, jump: false, ...controls };
    const r = movePlayer(state, c);
    if (state.grounded && state.landedFall > 0) landed.push(state.landedFall);
    finishPlayerMovement(state, { inWater: r.inWater, inLavaNow: r.inLavaNow, oldPosition: r.oldPosition }, hooks);
    boats?.tick(world, {});
    Object.assign(p, { sneaking: !!c.sneak, flying: false, riding: false, packetGround: !!state.grounded, sprinting: !!state.motion.sprinting, yaw: state.yaw });
    w.tick({ ...body, x: state.position.x, y: state.position.y, z: state.position.z }, s);
  };
  for (let i = 0; i < settle; i++) step();
  return { world, w, s, p, state, step, fixes, hits, landed, server, client };
}
const falls = (h) => h.hits.filter((x) => x.reason === "a fall").map((x) => x.n);
function drop(name, y, build, at = { x: 40.5, z: 40.5 }) {
  const h = host(name, build, { x: at.x, y, z: at.z }, { grounded: false });
  for (let i = 0; i < 80 && !(h.state.grounded && h.landed.length); i++) h.step();
  for (let i = 0; i < 10; i++) h.step();
  return h;
}

test("a drop: the landing dust, the trample call and the fall stat come from the copy once, at the copy's distance, and the client's landing does none of them", () => {
  const h = drop("spcopy88-drop", 24);
  assert.equal(h.landed.length, 1);
  const d = h.landed[0];
  assert.deepEqual(falls(h), [native(d)], "the damage once (spcopy87)");
  assert.deepEqual(h.server.dust, [{ who: "copy", x: 40, y: 9, z: 40, n: Math.ceil(f(d - 3)) }], "2006 at the block under the copy's feet, ceil(R - 3)");
  assert.equal(h.server.trample.length, 1);
  assert.equal(h.server.trample[0].who, "copy");
  assert.ok(Math.abs(h.server.trample[0].d - d) < 1e-4, `onFallenUpon with the copy's R (${h.server.trample[0].d} vs the client's ${d})`);
  assert.deepEqual(h.server.stat, [Math.round(f(d) * 100)], "stat.fallOneCm once");
  assert.deepEqual(h.client, { dust: [], trample: [] }, "the client's updateFallState: isRemote skips the dust and onFallenUpon");
  assert.equal(h.p.corrected ?? 0, 0);
});

test("small falls: a jump lands with a trample call but no stat (R < 2) and no dust (R <= 3); a 2.5-block step-off adds the stat only", () => {
  const h = host("spcopy88-jump");
  h.step({ jump: true });
  for (let i = 0; i < 20; i++) h.step();
  assert.equal(h.server.trample.length, 1, "Block.onFallenUpon runs for any R > 0");
  assert.ok(h.server.trample[0].d > 1 && h.server.trample[0].d < 1.3, `a jump's R (${h.server.trample[0].d})`);
  assert.deepEqual(h.server.stat, []);
  assert.deepEqual(h.server.dust, []);
  const ledge = drop("spcopy88-ledge", 12.5);
  assert.equal(ledge.server.stat.length, 1);
  assert.ok(ledge.server.stat[0] >= 200 && ledge.server.stat[0] < 300, `round(R * 100) (${ledge.server.stat[0]})`);
  assert.deepEqual(ledge.server.dust, []);
  assert.deepEqual(falls(ledge), []);
});

test("farmland: the copy's landing tramples it (a player whatever mobGriefing says); the client's landing no longer calls the trample", () => {
  let farming = null;
  const h = drop("spcopy88-farm", 14, (world) => { world.put(40, 9, 40, FARMLAND, 0, false); farming = new Farming(world); });
  // main.js trampleFarmland: farming.trample at floor(x), floor(y - 0.2), floor(z) with grief = a player or mobGriefing; the roll here always passes.
  for (const t of h.server.trample) farming.trample(Math.floor(t.x), Math.floor(t.y - 0.2), Math.floor(t.z), t.d, () => 0, t.who === "copy" || false);
  assert.equal(h.world.get(40, 9, 40), 2, "BlockFarmland.onFallenUpon -> dirt");
  assert.deepEqual(h.client.trample, []);
  const src = readFileSync(new URL("./main.js", import.meta.url), "utf8");
  assert.match(src, /farming\.trample\(x, y, z, distance, Math\.random, entity === position \|\| !!entity\?\.isPlayer \|\| gameRule\("mobGriefing"\)\)/, "the copy (isPlayer) tramples without mobGriefing");
});

test("handleFalling's hooks follow sv.a(DZ) and yz.b(F): air under the feet gives no dust, Creative (allowFlying) gives no stat, water zeroes R first", () => {
  const world = flat("spcopy88-units");
  const calls = [];
  const hooks = { dust: (...a) => calls.push(["dust", ...a]), trample: (d) => calls.push(["trample", d]), stat: (d) => calls.push(["stat", d]) };
  const s = new Survival({}), p = { x: 40.5, y: 10, z: 40.5, width: f(0.6), height: f(1.8), fallDistance: 6, inWater: false, survival: s, creative: false };
  handleFalling(world, p, 0, true, hooks);
  assert.deepEqual(calls, [["dust", 40, 9, 40, 3], ["trample", 6], ["stat", 6]], "dust, onFallenUpon, then fall's stat (and the damage)");
  assert.equal(p.fallDistance, 0);
  calls.length = 0;
  Object.assign(p, { y: 12, fallDistance: 6 }); // standing on nothing solid at floor(y - 0.2) = 11: air
  handleFalling(world, p, 0, true, hooks);
  assert.deepEqual(calls, [["trample", 6], ["stat", 6]], "no 2006 over air");
  calls.length = 0;
  Object.assign(p, { y: 10, fallDistance: 6, creative: true });
  handleFalling(world, p, 0, true, hooks);
  assert.deepEqual(calls, [["dust", 40, 9, 40, 3], ["trample", 6]], "Creative: EntityPlayer.fall returns before the stat; the dust and onFallenUpon do not test it");
  calls.length = 0;
  world.put(40, 10, 40, WATER, 0, false);
  Object.assign(p, { y: 10, fallDistance: 6, creative: false });
  handleFalling(world, p, 0, true, hooks);
  assert.deepEqual(calls, [], "handleWaterMovement zeroed R first");
});

test("landPlayer: a copy that owns the fall leaves the client only the sounds; a placed harness keeps the client's trample, dust and damage", () => {
  const world = flat("spcopy88-land");
  for (const owner of [true, false]) {
    const s = new Survival({}), got = { trample: 0, dust: 0, sound: 0, hurt: 0 };
    s.damage = () => { got.hurt++; return true; };
    s.serverPlayer = { fallOwner: owner };
    landPlayer({ world, position: { x: 40.5, y: 10, z: 40.5 }, survival: s, inWater: false }, 10, { trample: () => got.trample++, landingDust: () => got.dust++, fallSound: () => got.sound++ });
    assert.ok(got.sound > 0, "the fall sound is the client's own");
    assert.deepEqual([got.trample, got.dust, got.hurt], owner ? [0, 0, 0] : [1, 1, 1]);
  }
  const src = readFileSync(new URL("./main.js", import.meta.url), "utf8");
  assert.match(src, /if \(grounded && !survival\.serverPlayer\?\.fallOwner\) addFallStat\(stats, landedFall, survival\.creative\)/, "the tick's landing leaves the stat to the copy");
  assert.match(src, /land: \(d\) => \{ if \(!survival\.serverPlayer\?\.fallOwner\) addFallStat\(/, "so does a piston push's landing");
  assert.match(src, /mobs\.serverFallStat = \(p, d\) => addFallStat\(stats, d, false\)/);
});

test("processPlayer 681-688: a setPlayerLocation inside mw.i() (a portal's travelToDimension) ends the packet at the new spot; the copy then waits for the C06", () => {
  const h = host("spcopy88-681");
  const spot = { x: 44.5, y: 10, z: 44.5 };
  let fire = false;
  h.w.serverCopyMoved = (p) => { if (fire) { fire = false; p.setLocation(spot); } }; // stands in for sa.C's travelToDimension -> setPlayerLocation inside mw.i()
  fire = true;
  h.p.packetGround = true;
  h.w.tick({ ...body, x: 40.5, y: 10, z: 40.8 }, h.s); // the client walked 0.3: a C03 that the copy would accept
  assert.deepEqual({ x: h.p.x, y: h.p.y, z: h.p.z }, spot, "mw.a(o, p, q) at the new o / p / q, then return: the packet's move is not applied");
  assert.equal(h.p.corrected ?? 0, 0, "no moved-wrongly S08 from the rest of the packet");
  // The client takes the S08 (setLocation queued its C06); the next tick's packets resume from the spot.
  Object.assign(h.state.position, spot); Object.assign(h.state.previous, spot);
  for (let i = 0; i < 10; i++) h.step({ forward: i < 5 ? 1 : 0 });
  assert.equal(h.p.hasMoved, true);
  assert.equal(h.fixes.length, 0);
});

// A minecart ride on the ground: the client sits on the seat (a tick behind the live cart is spcopy87's test; here the cart stands still).
function rideHost(name) {
  const h = host(name);
  const rider = createPlayerRider();
  syncRider({ rider, position: h.state.position, yaw: 0, world: h.world, survival: h.s, fallSound: () => {} });
  const carts = new Minecarts();
  const cart = carts.spawnEmpty({ x: 40.5, y: 14.5, z: 44.5 }); // in the air: it falls to the stone while ridden
  assert.ok(carts.mount(cart, rider));
  const seatOf = () => { const was = { x: rider.x, y: rider.y, z: rider.z }; carts.updateRiderPosition(cart); const seat = { x: rider.x, y: rider.y, z: rider.z }; Object.assign(rider, was); return seat; };
  h.w.serverSeat = seatOf;
  h.w.serverMount = () => rider.vehicle ?? null; // main.js
  const calls = [], process = h.w.processPlayer.bind(h.w);
  h.w.processPlayer = (p, pkt, ground) => { calls.push({ pkt, answered: !p.hasMoved }); return process(p, pkt, ground); };
  const ride = (n) => { for (let i = 0; i < n; i++) { carts.tick(h.world, { entities: [] }); carts.updateRiderPosition(cart); Object.assign(h.p, { riding: true, packetGround: false }); h.w.tick({ ...body, x: rider.x, y: rider.y, z: rider.z }, h.s); } };
  return { ...h, rider, carts, cart, seatOf, calls, ride };
}

test("a dead mount lets the copy go at its seat (Entity.updateRidden): no setPlayerLocation, the walking branch from the seat, the fall from there counted once", () => {
  const h = rideHost("spcopy88-deadcart");
  h.ride(40);
  assert.ok(h.cart.onGround || h.cart.y < 10.6, "the cart came down");
  const seat = { x: h.p.x, y: h.p.y, z: h.p.z };
  assert.deepEqual(seat, h.seatOf(), "on the live seat (spcopy87)");
  // The cart dies in this tick's world pass (killed by a mob, an explosion, /kill); the client still reports the seat (a C05). The network tick finds the dead mount.
  h.cart.dead = true;
  h.calls.length = 0;
  Object.assign(h.p, { riding: true, packetGround: false });
  h.w.tick({ ...body, ...seat }, h.s);
  assert.equal(h.calls.length, 1, "the walking branch ran for the packet");
  assert.equal(h.calls[0].pkt, null, "a C05: no position");
  assert.deepEqual({ x: h.p.x, y: h.p.y, z: h.p.z }, seat, "the copy stays at its seat");
  // Natively the client too is let go at its seat (its own updateRidden) and falls from there; the copy follows with no correction and no wait.
  h.rider.vehicle = null;
  Object.assign(h.state.position, seat); Object.assign(h.state.previous, seat);
  Object.assign(h.state, { grounded: false, fallDistance: 0, landedFall: 0 }); h.state.velocity.set(0, 0, 0);
  h.calls.length = 0;
  for (let i = 0; i < 30; i++) h.step();
  assert.ok(h.calls.every((c) => !c.answered), "no setPlayerLocation wait");
  assert.equal(h.p.corrected ?? 0, 0);
  assert.equal(h.fixes.length, 0);
  assert.ok(Math.abs(h.p.y - h.state.position.y) < 1e-9 && h.state.grounded, "both landed");
  assert.equal(h.landed.length, 1);
  if (h.landed[0] >= 2) assert.deepEqual(h.server.stat, [Math.round(f(h.landed[0]) * 100)]);
});

test("a dismount is mountEntity(null) -> setPlayerLocation: the copy is put on the spot and its C06 answer is processed before the next packets", () => {
  const h = rideHost("spcopy88-dismount");
  h.ride(40);
  h.carts.dismount(h.world, h.rider); // EntityLivingBase.dismountEntity's spot (the client and server agree in single player)
  const spot = { x: h.rider.x, y: h.rider.y, z: h.rider.z };
  Object.assign(h.state.position, spot); Object.assign(h.state.previous, spot);
  Object.assign(h.state, { grounded: false, fallDistance: 0, landedFall: 0 }); h.state.velocity.set(0, 0, 0);
  h.calls.length = 0;
  h.step();
  assert.deepEqual(h.calls[0], { pkt: { ...spot, onGround: false }, answered: true }, "the C06 at the spot answers the S08");
  assert.equal(h.p.branch, "walk");
  for (let i = 0; i < 20; i++) h.step({ forward: i < 6 ? 1 : 0 });
  assert.equal(h.p.hasMoved, true);
  assert.equal(h.p.corrected ?? 0, 0);
  assert.equal(h.fixes.length, 0);
});

test("a removed horse lets the copy go too (the horse seat's isDead: not in the world's list)", () => {
  const h = host("spcopy88-horse");
  const rider = createPlayerRider();
  syncRider({ rider, position: h.state.position, yaw: 0, world: h.world, survival: h.s, fallSound: () => {} });
  const e = h.w.create("horse", 40.5, 10, 44.5);
  h.w.entities.push(e);
  Object.assign(e.horse, { tame: true, saddled: true, owner: "player" });
  const seats = h.w.horseSeats;
  assert.ok(seats.mount(e, rider));
  const v = rider.vehicle;
  h.w.serverSeat = () => { const was = { x: rider.x, y: rider.y, z: rider.z }; seats.updateRiderPosition(v); const seat = { x: rider.x, y: rider.y, z: rider.z }; Object.assign(rider, was); return seat; };
  h.w.serverMount = () => rider.vehicle ?? null;
  for (let i = 0; i < 10; i++) { seats.updateRiderPosition(v); Object.assign(h.p, { riding: true, packetGround: false }); h.w.tick({ ...body, x: rider.x, y: rider.y, z: rider.z }, h.s); }
  const seat = { x: h.p.x, y: h.p.y, z: h.p.z };
  h.w.entities.splice(h.w.entities.indexOf(e), 1); // /kill, a despawn or the chunk unloading
  assert.equal(v.dead, true);
  h.rider = rider; rider.vehicle = null;
  Object.assign(h.state.position, seat); Object.assign(h.state.previous, seat);
  Object.assign(h.state, { grounded: false, fallDistance: 0, landedFall: 0 }); h.state.velocity.set(0, 0, 0);
  const process = h.w.processPlayer.bind(h.w), answered = [];
  h.w.processPlayer = (p, pkt, ground) => { answered.push(!p.hasMoved); return process(p, pkt, ground); };
  for (let i = 0; i < 20; i++) h.step();
  assert.ok(answered.length > 0 && answered.every((a) => !a), "the walking branch from the seat, no setPlayerLocation");
  assert.equal(h.p.corrected ?? 0, 0);
  assert.equal(h.fixes.length, 0);
});

test("a portal trip keeps the EntityPlayerMP: the new world's copy has the old one's fallDistance and waits at the arrival; a fresh copy (login, End exit, death) has none", () => {
  const run = (carry) => {
    const old = new EntityWorld(flat("spcopy88-from"), [], () => 0.5);
    old.ai.player.fallDistance = 6; // fell into an end portal from 6 blocks up (the copy's own count)
    const h = host(`spcopy88-to-${carry}`, null, { x: 40.5, y: 10, z: 40.5 }, { settle: 0 });
    const calls = [], process = h.w.processPlayer.bind(h.w);
    h.w.processPlayer = (p, pkt, ground) => { calls.push({ pkt, answered: !p.hasMoved }); return process(p, pkt, ground); };
    if (carry) h.p.arriveFrom(old.ai.player);
    for (let i = 0; i < 5; i++) h.step();
    return { h, calls };
  };
  const carried = run(true);
  assert.deepEqual(carried.calls[0], { pkt: { x: 40.5, y: 10, z: 40.5, onGround: false }, answered: true }, "setPlayerLocation(arrival): the C06 answers it");
  assert.deepEqual(falls(carried.h), [native(6)], "the carried R lands on the first grounded packet");
  assert.equal(carried.h.s.serverPlayer, carried.h.p, "the new world's copy owns the fall from its first tick");
  assert.equal(carried.h.p.corrected ?? 0, 0);
  const fresh = run(false);
  assert.deepEqual(falls(fresh.h), []);
  assert.equal(fresh.calls.length > 0 && fresh.calls[0].answered, false, "a login places the copy directly");
  const src = readFileSync(new URL("./main.js", import.meta.url), "utf8");
  assert.match(src, /const leftCopy = mobs\?\.ai\?\.player;/);
  // b89 spcopy89: record.transit is deleted by dimension-live.js arrive before launch, so the transit now comes through tripArrival (and the Teleporter's motion with it)
  assert.match(src, /if \(tripLoading && arrival && !arrival\.exit && !arrival\.death\) mobs\.ai\.player\.arriveFrom\(leftCopy, arrival\.arrivalMotion\);/, "only a portal trip: the End's exit and a death are respawnPlayer (a new EntityPlayerMP)");
});

// Item 5. EntityTrackerEntry.sendLocationToAllClients (my.a(List), bytecode-read: a relative move only for a delta of 4/32 block or more, offsets 481-507, or every 60
// ticks) never sends a floating boat's bob, and the client's empty EntityBoat moves only by its own interpolation, so natively the client stands on a still boat while
// the server's copy is checked against the live, bobbing one. Executed here: the client collides with the boat as it was when it settled, the copy with the live boat.
// The bob stays under processPlayer's 1/16 box shrink (the "!flag1" test), so it trips no correction. The port's client collides with the live boat itself (one Boats for
// both sides); that is measured below and left to the boat tracks (spcopy87's note: the client sinks into the rising box and the copy puts it back, as native would).
const intersects = (a, b) => b[3] > a[0] && b[0] < a[3] && b[4] > a[1] && b[1] < a[4] && b[5] > a[2] && b[2] < a[5]; // entity-collision.js
function bobRun(shared) {
  const boats = new Boats(), live = boatBoxProvider(boats);
  const h = host(`spcopy88-bob-${shared}`, (world) => {
    for (let x = 36; x <= 44; x++) for (let z = 26; z <= 54; z++) world.put(x, 10, z, z <= 46 ? WATER : STONE, 0, false);
  }, { x: 40.5, y: 11, z: 47.4 }, { settle: 0 });
  const boat = boats.spawnBoat({ x: 40.5, y: 10.4, z: 45.9 }, { seed: 5 });
  for (let i = 0; i < 400; i++) boats.tick(h.world, {});
  const still = [...boat.bb];
  const seen = (box, e) => (boat.dead || !intersects(box, still) ? [] : [still]); // the client's boat: where the tracker last put it
  let lo = Infinity, hi = -Infinity, onBoat = 0;
  try {
    for (let i = 0; i < 200; i++) {
      const c = { forward: i < 7 ? 1 : 0, strafe: 0, sneak: false, sprint: false, jump: i === 1 || (i > 20 && i % 25 === 0) }; // a jump onto it, then standing and jumping in place
      setEntityBoxes(shared ? live : seen);
      const r = movePlayer(h.state, c);
      finishPlayerMovement(h.state, { inWater: r.inWater, inLavaNow: r.inLavaNow, oldPosition: r.oldPosition });
      setEntityBoxes(live);
      boats.tick(h.world, {});
      Object.assign(h.p, { sneaking: false, flying: false, riding: false, packetGround: !!h.state.grounded, sprinting: false, yaw: 0 });
      const before = h.fixes.length;
      h.w.tick({ ...body, x: h.state.position.x, y: h.state.position.y, z: h.state.position.z }, h.s);
      if (h.fixes.length > before) { Object.assign(h.state.position, h.fixes.at(-1)); Object.assign(h.state.previous, h.fixes.at(-1)); } // main.js serverCorrect
      if (i > 40) { lo = Math.min(lo, boat.bb[4]); hi = Math.max(hi, boat.bb[4]); }
      if (h.state.grounded && Math.abs(h.state.position.z - boat.z) < 1.05 && Math.abs(h.state.position.y - still[4]) < 1e-6) onBoat++;
    }
  } finally { setEntityBoxes(null); }
  return { bob: hi - lo, onBoat, corrected: h.p.corrected ?? 0, fixes: h.fixes.length };
}

test("a floating boat's bob: with the client on a still boat (native) the copy, checked against the live boat, needs no correction; the port's shared boat is measured", (t) => {
  const native = bobRun(false);
  assert.ok(native.onBoat > 100, `stood on the boat (${native.onBoat} ticks)`);
  assert.ok(native.bob > 0.005 && native.bob < 0.0625, `the live boat bobbed (${native.bob}), under the 1/16 shrink`);
  assert.equal(native.corrected, 0, "no S08");
  assert.equal(native.fixes, 0);
  const port = bobRun(true);
  t.diagnostic(`the port's client on the live boat: ${port.corrected} corrections in 200 ticks, ${port.onBoat} ticks on it (a boat-track follow-up, not the copy's)`);
});

test("source pins: the copy's landing hooks, the 681 return and the mount hook", () => {
  const ents = readFileSync(new URL("./entities.js", import.meta.url), "utf8");
  assert.match(ents, /handleFalling\(world, p, to\.y - from\.y, !!ground, this\.copyLanding\(p\)\)/);
  assert.match(ents, /if \(!p\.hasMoved\) \{ p\.x = p\.accepted\.x; p\.y = p\.accepted\.y; p\.z = p\.accepted\.z; return; \}/);
  assert.match(ents, /if \(p\.mount\?\.dead\) \{\n[^\n]*\n\s*if \(p\.mount\.remounted\)[^\n]*\n\s*this\.processPlayer\(p, null, p\.packetGround\); p\.netTicks\+\+; return;/); // b89 spcopy89: a broken mount's S08 comes first
  const main = readFileSync(new URL("./main.js", import.meta.url), "utf8");
  assert.match(main, /mobs\.serverMount = \(\) => rider\.vehicle \?\? null;/);
  assert.ok(!/server-process-player/.test(readFileSync(new URL("./multiplayer/simulation.js", import.meta.url), "utf8")), "the dedicated server is unchanged");
});
