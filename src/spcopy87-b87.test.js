// Batch 87 spcopy87: the integrated server's copy of the player (ai.js PlayerView, entities.js serverPlayerUpdate / processPlayer) after spcopy86. NetHandlerPlayServer.processPlayer
// (nh.a(jd), bytecode-read; server-process-player.js has the offsets): the copy's collision lists hold the boats' boxes (World.getCollidingBoundingBoxes: EntityBoat.J; a
// minecart's J is null), the riding branch seats the copy on its live mount and takes only the packet's angles, the sleeping branch keeps it at o / p / q, and handleFalling
// (mw.b(DZ)) counts the fall distance from the accepted moves and deals the fall damage, which the client (EntityClientPlayerMP.attackEntityFrom returns false) no longer does.
// Rubber-banding is only visible in a browser, so the walks below run the client physics main.js runs (player-physics.js movePlayer, player-environment.js
// finishPlayerMovement, whose landing would deal the damage a second time if it still did) into the copy, and require no S08 and exactly the native damage.
import test from "node:test";
import assert from "node:assert/strict";
import { World, LADDER, WATER, HAY_BALE, BLOCKS } from "./world.js";
import { Survival } from "./survival.js";
import { EntityWorld, setEntityBoxes } from "./entities.js";
import { movePlayer } from "./player-physics.js";
import { vector } from "./player-physics-fixture.js";
import { PlayerMotion } from "./player-movement.js";
import { finishPlayerMovement } from "./player-environment.js";
import { Boats } from "./boats.js";
import { Minecarts } from "./minecarts.js";
import { boatBoxProvider } from "./entity-collision.js";
import { createPlayerRider, syncRider } from "./vehicle-simulation.js";
import { landingEffects } from "./damage-fx.js";
import { handleFalling, copyFall } from "./server-process-player.js";

const STONE = 1;
const flat = (name) => {
  const world = new World(name);
  for (let x = 30; x <= 50; x++) for (let z = 26; z <= 54; z++) for (let y = 9; y <= 40; y++) world.put(x, y, z, y === 9 ? STONE : 0, 0, false);
  return world;
};
const body = { alive: true, width: 0.6, height: 1.8, eyeHeight: 1.62 };
// EntityLivingBase.fall's damage for a player's fall distance (no Jump Boost).
const native = (distance) => Math.max(0, landingEffects(distance, { kind: "player" }).points);

function host(name, build, at = { x: 40.5, y: 10, z: 48.5 }, { boats = null, grounded = true } = {}) {
  const world = flat(name); build?.(world);
  const w = new EntityWorld(world, [], () => 0.5), s = new Survival({});
  const hits = [], damage = s.damage.bind(s);
  s.damage = (n, reason, ...rest) => { hits.push({ n, reason }); return damage(n, reason, ...rest); };
  const fixes = [];
  w.serverCorrect = (to) => fixes.push({ ...to }); // the S08 (main.js puts the client there)
  const state = { world, position: vector(at.x, at.y, at.z), previous: vector(at.x, at.y, at.z), velocity: vector(0, 0, 0), motion: new PlayerMotion(), grounded, collidedH: false,
    flying: false, fallDistance: 0, landedFall: 0, yaw: 0, survival: s, eating: null };
  const p = w.ai.player;
  const landed = [], copyFalls = [];
  // One game tick as main.js runs it: the client moves and lands (movePlayer, finishPlayerMovement), the world's entities update (here the boats), then the network tick.
  const step = (controls = {}) => {
    const c = { forward: 0, strafe: 0, sneak: false, sprint: false, jump: false, ...controls };
    const r = movePlayer(state, c);
    if (state.grounded && state.landedFall > 0) landed.push(state.landedFall); // the client's own Entity.fallDistance at its landing
    finishPlayerMovement(state, { inWater: r.inWater, inLavaNow: r.inLavaNow, oldPosition: r.oldPosition });
    boats?.tick(world, {});
    Object.assign(p, { sneaking: !!c.sneak, flying: false, riding: false, packetGround: !!state.grounded, sprinting: !!state.motion.sprinting, yaw: state.yaw });
    copyFalls.push(p.fallDistance);
    w.tick({ ...body, x: state.position.x, y: state.position.y, z: state.position.z }, s);
    const d = (p.x - state.position.x) ** 2 + (p.y - state.position.y) ** 2 + (p.z - state.position.z) ** 2;
    assert.ok(d <= 9.0E-4 + 1e-9, `the copy trails the client by at most the C03 threshold (${d}: copy ${p.x} ${p.y} ${p.z} client ${state.position.x} ${state.position.y} ${state.position.z} corrected ${p.corrected} fixes ${fixes.length} branch ${p.branch})`);
  };
  for (let i = 0; i < 3; i++) step();
  return { world, w, s, p, state, step, fixes, hits, landed, copyFalls };
}
const clean = (h, what) => {
  assert.equal(h.p.corrected ?? 0, 0, `${what}: no setPlayerLocation`);
  assert.equal(h.fixes.length, 0, `${what}: no S08 reached the client`);
  assert.equal(h.p.hasMoved, true);
};
const falls = (h) => h.hits.filter((x) => x.reason === "a fall");
// A drop from `y` onto whatever `build` put below; returns the host after it has settled.
function drop(name, y, build, at = { x: 40.5, z: 40.5 }) {
  const h = host(name, build, { x: at.x, y, z: at.z }, { grounded: false });
  for (let i = 0; i < 80 && !(h.state.grounded && h.landed.length); i++) h.step();
  for (let i = 0; i < 10; i++) h.step();
  return h;
}
// The copy deals exactly EntityLivingBase.fall's damage for the fall distance the client itself counted, once, and the client's landing deals none.
const nativeFall = (h, what) => {
  assert.ok(h.landed.length <= 1, `${what}: one landing at most`);
  const want = h.landed.length ? native(h.landed[0]) : 0, got = falls(h);
  assert.deepEqual(got.map((x) => x.n), want > 0 ? [want] : [], `${what}: ${want} points once (client counted ${h.landed[0]})`);
  assert.equal(h.p.fallDistance, 0, `${what}: the copy's fallDistance landed`);
  return want;
};

test("the copy's collision lists hold the boats (EntityBoat.J): walking, jumping and standing on a boat on land and in water need no correction", () => {
  for (const water of [false, true]) {
    const boats = new Boats();
    setEntityBoxes(boatBoxProvider(boats)); // main.js installs the same provider for the one world
    try {
      const h = host(`spcopy87-boat-${water}`, (world) => {
        // In water: a pool the boat floats in, the player starting on its stone bank (its top at 11), a jump from the bank onto the floating boat.
        if (water) for (let x = 36; x <= 44; x++) for (let z = 26; z <= 54; z++) { if (z <= 46) world.put(x, 10, z, WATER, 0, false); else world.put(x, 10, z, STONE, 0, false); }
      }, { x: 40.5, y: water ? 11 : 10, z: 47.4 }, { boats: water ? null : boats }); // the floating boat is held still after settling: see below
      const boat = boats.spawnBoat({ x: 40.5, y: water ? 10.4 : 10, z: water ? 45.9 : 44.5 }, { seed: 5 });
      // Let it settle, on the ground or floating. A floating boat keeps bobbing by about 0.01; a player whose feet it lifts inside its box falls into it
      // (Entity.moveEntity ignores boxes it already overlaps), and once more than 1/16 deep the copy's "!flag1" test puts it back, as native would. That is the
      // boat's own motion (boatcheck87's scope), so the water walk holds the settled boat still.
      for (let i = 0; i < 400; i++) boats.tick(h.world, {});
      let top = 0, onBoat = 0;
      for (let i = 0; i < 60; i++) {
        h.step({ forward: i < 30 ? 1 : 0, jump: i % 8 === 0 });
        const over = Math.abs(h.state.position.z - boat.z) < 0.75 + 0.3;
        if (over && h.state.grounded && Math.abs(h.state.position.y - boat.bb[4]) < 1e-6) onBoat++;
        top = Math.max(top, h.state.position.y);
      }
      assert.ok(onBoat >= 1, `stood on the boat (${water ? "in water" : "on land"}, ${onBoat} ticks, boat top ${boat.bb[4]})`);
      for (let i = 0; i < 20; i++) h.step({ jump: i % 5 === 0 }); // jumping in place on it
      clean(h, water ? "boat in water" : "boat on land");
    } finally { setEntityBoxes(null); }
  }
});

test("a move into a boat's body is checked against the boat: put back with the boat's box, kept without it", () => {
  const run = (withBoxes) => {
    const boats = new Boats();
    if (withBoxes) setEntityBoxes(boatBoxProvider(boats));
    try {
      const h = host(`spcopy87-into-boat-${withBoxes}`, null, { x: 40.5, y: 10, z: 46.6 }, { boats });
      boats.spawnBoat({ x: 40.5, y: 10, z: 44.5 }, { seed: 5 });
      // The client claims a spot inside the boat (a C03 the client physics would never send): mw.d runs into the boat's side, the "moved wrongly" test fires.
      Object.assign(h.p, { packetGround: true, riding: false });
      h.w.tick({ ...body, x: 40.5, y: 10, z: 44.6 }, h.s);
      return h.p.corrected ?? 0;
    } finally { setEntityBoxes(null); }
  };
  assert.equal(run(true), 1, "the boat's box is in the copy's lists (World.getCollidingBoundingBoxes)");
  assert.equal(run(false), 0, "without it the move is kept");
});

test("falls: a plain drop, onto hay, onto a boat, into water, down a ladder and onto a ladder's foot deal the native damage once, from the copy, with no correction", () => {
  const stone = drop("spcopy87-drop", 24);
  assert.equal(stone.landed.length, 1);
  const points = nativeFall(stone, "drop");
  assert.ok(points >= 8, `a 14-block drop hurts (${points})`);
  clean(stone, "drop");
  // BlockHay keeps Block's empty onFallenUpon in 1.7.10 (its fall cushion is a later version's): the same damage as stone.
  const hay = drop("spcopy87-hay", 25, (world) => world.put(40, 10, 40, HAY_BALE, 0, false));
  assert.equal(nativeFall(hay, "hay"), points, "a hay bale takes nothing off");
  clean(hay, "hay");
  // There is no slime block in 1.7.10 (Block's registry, bytecode-read), nor in the port.
  assert.ok(!BLOCKS.some((b) => /slime/i.test(b?.name ?? "")));
  // The water: handleWaterMovement at the landing position zeroes the copy's fallDistance (sv.a(DZ) runs it first).
  const pool = drop("spcopy87-water", 30, (world) => { for (let x = 37; x <= 43; x++) for (let z = 37; z <= 43; z++) for (let y = 10; y <= 11; y++) world.put(x, y, z, WATER, 0, false); });
  assert.equal(falls(pool).length, 0, "no damage into water");
  assert.equal(pool.p.fallDistance, 0);
  clean(pool, "water");
  // A ladder column: the ladder branch of moveEntityWithHeading zeroes fallDistance in mw.i() from the accepted position, as on the client.
  const climb = drop("spcopy87-ladder", 30, (world) => { for (let y = 10; y <= 30; y++) world.put(40, y, 39, STONE, 0, false); for (let y = 10; y <= 15; y++) world.put(40, y, 40, LADDER, 3, false); }, { x: 40.5, z: 40.65 });
  assert.equal(climb.landed.length, 0, "the ladder took the client's fall distance before it reached the ground");
  assert.equal(falls(climb).length, 0, "nor did the copy deal any");
  assert.equal(climb.p.fallDistance, 0);
  assert.ok(Math.max(...climb.copyFalls) > 10, "the copy counted the fall above the ladder");
  clean(climb, "ladder");
  // A ladder only in the floor cell: whether the last tick of the fall starts inside it (isOnLadder at the feet before the move) decides for both sides alike.
  const foot = drop("spcopy87-ladder-foot", 26, (world) => { for (let y = 10; y <= 30; y++) world.put(40, y, 39, STONE, 0, false); world.put(40, 10, 40, LADDER, 3, false); }, { x: 40.5, z: 40.65 });
  nativeFall(foot, "ladder foot");
  clean(foot, "ladder foot");
  // Onto a boat: its box is the ground (EntityBoat.J), the landing hurts as any other.
  const boats = new Boats();
  setEntityBoxes(boatBoxProvider(boats));
  try {
    const onto = drop("spcopy87-onto-boat", 26, (world) => { boats.spawnBoat({ x: 40.5, y: 10, z: 40.5 }, { seed: 2 }); for (let i = 0; i < 5; i++) boats.tick(world, {}); });
    assert.ok(Math.abs(onto.state.position.y - boats.carts[0].bb[4]) < 1e-6, "landed on the boat");
    assert.ok(nativeFall(onto, "boat") > 0);
    clean(onto, "boat");
  } finally { setEntityBoxes(null); }
});

test("the copy's fall distance follows the client's own; handleFalling counts downward moves, deals once on landing, and Creative or the dead take none", () => {
  const h = drop("spcopy87-follow", 24);
  // Before the landing the copy counted, from the accepted packets, what the client counted from its moves.
  const peak = Math.max(...h.copyFalls);
  assert.ok(Math.abs(peak - h.landed[0]) < 0.5, `copy ${peak}, client ${h.landed[0]}`);
  // handleFalling on its own: an accepted downward move counts, a landing deals once and zeroes it, a landing in Creative deals none.
  const world = flat("spcopy87-unit");
  const hits = [];
  const p = { x: 40.5, y: 10, z: 40.5, width: 0.6, height: 1.8, fallDistance: 0, inWater: false, creative: false, survival: { health: 20, creative: false, damage: (n, r) => hits.push([n, r]) } };
  handleFalling(world, p, -6, false);
  assert.equal(p.fallDistance, 6);
  handleFalling(world, p, 0.5, false); // a rise adds nothing
  assert.equal(p.fallDistance, 6);
  handleFalling(world, p, -0.25, true);
  assert.deepEqual(hits, [[3, "a fall"]]);
  assert.equal(p.fallDistance, 0);
  p.fallDistance = 10; p.creative = true;
  handleFalling(world, p, 0, true);
  assert.equal(hits.length, 1, "Creative (allowFlying): EntityPlayer.fall returns");
  assert.equal(p.fallDistance, 0);
  assert.equal(copyFall(world, { ...p, creative: false, survival: { health: 0, damage: () => hits.push("dead") } }, 10), 0);
  assert.equal(hits.length, 1);
});

test("a harness that places the copy itself keeps the client's landing damage", () => {
  const world = flat("spcopy87-placed");
  const w = new EntityWorld(world, [], () => 0.5), s = new Survival({});
  w.ai.player.placed = true;
  const hits = [], damage = s.damage.bind(s);
  s.damage = (n, reason, ...rest) => { hits.push(n); return damage(n, reason, ...rest); };
  const state = { world, position: vector(40.5, 24, 40.5), previous: vector(40.5, 24, 40.5), velocity: vector(0, 0, 0), motion: new PlayerMotion(), grounded: false, collidedH: false,
    flying: false, fallDistance: 0, landedFall: 0, yaw: 0, survival: s, eating: null };
  let landed = 0;
  for (let i = 0; i < 60; i++) {
    const r = movePlayer(state, { forward: 0, strafe: 0, sneak: false, sprint: false, jump: false });
    if (state.grounded && state.landedFall > 0) landed = state.landedFall;
    finishPlayerMovement(state, { inWater: r.inWater, inLavaNow: r.inLavaNow, oldPosition: r.oldPosition });
    w.tick({ ...body, x: state.position.x, y: state.position.y, z: state.position.z }, s);
  }
  assert.equal(w.ai.player.fallOwner, false);
  assert.deepEqual(hits, [native(landed)]);
});

// A riding host: the vehicle moves in the world tick; the client sits on its client copy's seat, a tick behind (main.js seatOnCartCopy); the copy sits on the live seat.
function rideHost(name, build) {
  const h = host(name, build);
  const rider = createPlayerRider();
  const vstate = { rider, position: h.state.position, yaw: 0, world: h.world, survival: h.s, fallSound: () => {} };
  syncRider(vstate); // rider.fall / rider.fallHit: the mount's fall passed on (Entity.fall, EntityHorse.fall)
  return { ...h, rider, vstate };
}
const seatOf = (rider, seats, v) => { const was = { x: rider.x, y: rider.y, z: rider.z }; seats.updateRiderPosition(v); const seat = { x: rider.x, y: rider.y, z: rider.z }; Object.assign(rider, was); return seat; };

test("riding a minecart: the copy sits on the live seat, takes only the angles, never corrects or counts a fall; the cart's landing passes its fall once", () => {
  const h = rideHost("spcopy87-cart");
  const carts = new Minecarts();
  const cart = carts.spawnEmpty({ x: 40.5, y: 20.5, z: 46.5 });
  assert.ok(carts.mount(cart, h.rider));
  h.w.serverSeat = () => seatOf(h.rider, carts, cart); // main.js: the live mount's updateRiderPosition (mw.m.ac())
  h.p.motion.x = 0.3; h.p.fallDistance = 4; // what a mob's hit and the walk left before the mount
  let seen = 0;
  for (let i = 0; i < 40; i++) {
    const clientSeat = { x: h.rider.x, y: h.rider.y, z: h.rider.z }; // the client copy's seat lags the live cart
    carts.tick(h.world, { entities: [] }); carts.updateRiderPosition(cart);
    Object.assign(h.p, { riding: true, packetGround: false, yaw: 30 + i });
    h.w.tick({ ...body, ...clientSeat }, h.s);
    if (i > 0) {
      const live = seatOf(h.rider, carts, cart);
      assert.deepEqual({ x: h.p.x, y: h.p.y, z: h.p.z }, live, "the copy is on the live seat, not the packet's position");
      if (Math.abs(clientSeat.y - live.y) > 1e-3) seen++;
      assert.equal(h.p.fallDistance, 0, "EntityLivingBase.updateRidden");
      assert.deepEqual([h.p.motion.x, h.p.motion.y, h.p.motion.z], [0, 0, 0], "Entity.updateRidden");
      assert.equal(h.p.yaw, 30 + i, "the packet's angles");
    }
  }
  assert.ok(seen > 3, "the client's position differed from the live seat while the cart fell");
  assert.deepEqual(falls(h).map((x) => x.n), [7], "the cart's 10-block landing reached the rider once (Entity.fall -> rider.fall)");
  // The dismount (a direct placement), then walking: no stale fall distance, no correction.
  carts.dismount(h.world, h.rider);
  Object.assign(h.state.position, { x: h.rider.x, y: h.rider.y, z: h.rider.z }); Object.assign(h.state.previous, { x: h.rider.x, y: h.rider.y, z: h.rider.z });
  for (let i = 0; i < 30; i++) h.step({ forward: i < 10 ? 1 : 0 });
  assert.equal(falls(h).length, 1);
  clean(h, "cart");
});

test("riding a horse: seated on the live horse, no correction, the horse's landing gives the rider EntityHorse.fall's points once", () => {
  const h = rideHost("spcopy87-horse");
  const e = h.w.create("horse", 40.5, 20, 44.5);
  h.w.entities.push(e);
  e.horse.tame = true; e.horse.saddled = true; e.horse.owner = "player";
  const seats = h.w.horseSeats;
  assert.ok(seats.mount(e, h.rider));
  const v = h.rider.vehicle;
  h.w.serverSeat = () => seatOf(h.rider, seats, v);
  let top = e.y;
  for (let i = 0; i < 40; i++) {
    const clientSeat = { x: h.rider.x, y: h.rider.y, z: h.rider.z };
    Object.assign(h.p, { riding: true, packetGround: false });
    h.w.tick({ ...body, ...clientSeat }, h.s); // the horse falls in the world tick, then the network tick seats the copy
    seats.updateRiderPosition(v);
    if (i > 0) {
      assert.deepEqual({ x: h.p.x, y: h.p.y, z: h.p.z }, { x: h.rider.x, y: h.rider.y, z: h.rider.z }, "the copy on the live seat");
      assert.equal(h.p.fallDistance, 0);
    }
    top = Math.max(top, e.y);
  }
  assert.ok(e.y < 10.01, "landed");
  const want = Math.ceil(Math.fround(Math.fround(top - e.y) * 0.5) - 3);
  assert.ok(want > 0);
  assert.deepEqual(falls(h).map((x) => x.n), [want], "rider.fallHit once");
  assert.equal(h.p.corrected ?? 0, 0);
  assert.equal(h.fixes.length, 0);
});

test("sleeping: the copy stays at o / p / q whatever the packets say, counts no fall, and resumes after the wake's setPlayerLocation", () => {
  const h = host("spcopy87-sleep");
  for (let i = 0; i < 5; i++) h.step();
  // sleepInBedAt: the client lies at the bed (a direct placement on the first sleeping tick, setPlayerLocation natively).
  const bed = { x: 40.5, y: 10.5625, z: 47.5 };
  Object.assign(h.state.position, bed);
  Object.assign(h.p, { sleeping: true, packetGround: true });
  h.w.tick({ ...body, ...bed }, h.s);
  assert.deepEqual(h.p.accepted, bed);
  const before = h.p.fallDistance;
  for (let i = 0; i < 30; i++) {
    const drift = { x: bed.x + 0.1 * (i % 3), y: bed.y - 0.2 * (i % 2), z: bed.z }; // packets that would be moves (and falls) for a walking copy
    Object.assign(h.p, { sleeping: true, packetGround: i % 2 === 0 });
    h.w.tick({ ...body, ...drift }, h.s);
    assert.deepEqual({ x: h.p.x, y: h.p.y, z: h.p.z }, bed, "mw.a(o, p, q): back at the bed spot");
    assert.equal(h.p.branch, i === 0 ? h.p.branch : "sleeping");
  }
  assert.equal(h.p.fallDistance, before, "no handleFalling in the sleeping branch");
  assert.equal(falls(h).length, 0);
  // The wake: mw.a(ZZZ) -> setPlayerLocation (main.js), the copy waits for the C06 and then walks again.
  const up = { x: 40.5, y: 10, z: 46.5 };
  Object.assign(h.state.position, up); h.state.previous.x = up.x; h.state.previous.y = up.y; h.state.previous.z = up.z;
  h.p.sleeping = false;
  h.p.setLocation(up);
  for (let i = 0; i < 20; i++) h.step({ forward: i < 8 ? 1 : 0 });
  clean(h, "sleep");
});
