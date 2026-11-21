// Batch 89 mpobjects89: object copies on the multiplayer client and ender crystal fixes. Falling blocks join the dedicated server's thrown-entity tracker lane
// (EntityTracker 160 / 20 / velocity, S0E type 70 with id | meta << 16) and become client copies, drawn, simulated and listed by the boat check; the multiplayer client
// player collides with the remote boat copies; a crystal's eye height is 0 on the server, /summon EnderCrystal lifts posY by the yOffset 1, a piston moves the crystal's
// posY-centred box and the fireball sweep uses that box. See .shared-memory/notes/mpobjects89-b89-track.md.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { World, GRAVEL } from "./world.js";
import { DedicatedSimulation } from "./multiplayer/simulation.js";
import { ThrownTracks } from "./multiplayer/thrown-tracks.js";
import { ThrownCopies } from "./multiplayer/thrown-copy.js";
import { RemoteDispense } from "./multiplayer/client-dispense.js";
import { fallingOf, fallingTrackList, hookFallingJoin } from "./multiplayer/falling-lane.js";
import { clientPlacementBlocker } from "./multiplayer/client-placement-entities.js";
import { clientEntityBoxes } from "./client-item-use.js";
import { BOAT_ENTITY_SIZES } from "./boat-place-entities.js";
import { FALLING_SIZE, FALLING_Y_OFFSET } from "./falling.js";
import { Boats, clientBoatCopyBoxes } from "./boats.js";
import { clientBoatBoxProvider } from "./entity-collision.js";
import { EntityWorld, setEntityBoxes, pushBox } from "./entities.js";
import { Survival } from "./survival.js";
import { movePlayer } from "./player-physics.js";
import { vector } from "./player-physics-fixture.js";
import { PlayerMotion } from "./player-movement.js";
import { finishPlayerMovement } from "./player-environment.js";
import { crystalBox, CRYSTAL_EYE_HEIGHT, CRYSTAL_Y_OFFSET, liftSummonedCrystal, crystalPushMove } from "./ender-crystal.js";
import { sweepBox, sweepBoxReference, fast79 } from "./mpperf79-fast.js";
import { livingEyeHeight } from "./ai.js";
import { createCommandRunner } from "./commands.js";
import { createCommandHost } from "./command-host.js";
import { JavaRandom } from "./java-random.js";

const f = Math.fround;
const src = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const summonRef = JSON.parse(src("../public/research/summon87-reference.json"));

// A dedicated world with one gravel block over an air shaft (World height 64).
function fallingSim(name = "b89-falling") {
  const world = new World(name);
  const sim = new DedicatedSimulation({}, { world, gameMode: "survival" });
  for (let y = 31; y < 50; y++) world.put(5, y, 5, 0, 0, false);
  world.put(5, 30, 5, 1, 0, false);
  world.put(5, 40, 5, GRAVEL, 0, false);
  return { world, sim };
}

test("bytecode-read EntityTracker / my.c: a falling block is in the server's tracker lane, born at its join state, with S0E type 70 and data id | meta << 16", () => {
  const { sim } = fallingSim();
  assert.deepEqual(sim.dispense.thrownList(), [], "no falling block yet");
  const e = sim.falling.fall(5, 40, 5);
  assert.ok(e && e.block === GRAVEL);
  const list = sim.dispense.thrownList();
  assert.deepEqual(list.map((x) => x.kind), ["falling"]);
  assert.equal(list[0].e, e);
  assert.ok(sim.dispense.thrownTracks.births.has(e), "FallingBlocks.joined copies the join state (ThrownTracks.birth)");
  // the shared tracker entry: 160 / 20 / velocity (OBJECT_KINDS.falling), the S0E from the posY (box bottom + 0.49 = y + 0.5) and the native gravel id 13
  const t = new ThrownTracks({ idOf: () => 7 }), players = new Map([["p1", { position: { x: 5.5, y: 35, z: 5.5 } }]]);
  t.birth(list);
  const [row] = t.update(list, players).get("p1");
  assert.equal(row.k, "falling");
  const spawn = row.p.find((p) => p.type === "spawn");
  assert.deepEqual([spawn.objectType, spawn.data, spawn.x, spawn.y, spawn.z], [70, 13, 176, 1296, 176]); // floor(40.5 * 32) = 1296
  // a block that landed (dead) leaves the list; its S13 goes out a tick later
  e.dead = true;
  assert.deepEqual(sim.dispense.thrownList(), []);
});

test("the falling lane: each dimension's own FallingBlocks; the Overworld's is the one on sim outside a dimension swap; the join hook is installed once", () => {
  const home = { entities: [{ dead: false }, { dead: true }] }, nether = { entities: [{ dead: false }] }, swapped = { entities: [] };
  const births = [];
  const tracks = { birth: (l) => births.push(...l) };
  const sim = { falling: home, dimensions: { depth: 0 } };
  const d0 = { sim, dim: 0, tracksOf: () => tracks }, dn = { sim, dim: -1, dimState: (d) => (d === -1 ? { falling: nether } : null), tracksOf: () => tracks };
  assert.equal(fallingOf(d0), home);
  assert.equal(fallingTrackList(d0).length, 1, "the dead one is skipped");
  sim.falling = swapped; sim.dimensions.depth = 1; // the Nether's systems are swapped onto sim
  assert.equal(fallingOf(d0), home, "the cached Overworld list, not the swapped-in one");
  assert.equal(fallingOf(dn), nether);
  const before = [];
  const sys = { joined: (e) => before.push(e) };
  hookFallingJoin(sys, tracks); hookFallingJoin(sys, tracks);
  const one = { x: 1 };
  sys.joined(one);
  assert.deepEqual(before, [one], "the earlier joined hook still runs, once");
  assert.equal(births.filter((b) => b.e === one).length, 1, "born once");
  assert.equal(births.at(-1).kind, "falling");
});

test("the client copy: drawn as the block from the S0E data, box bottom = posY - 0.49, simulated (gravity) and listed by the boat check and the placement check", () => {
  const { world, sim } = fallingSim("b89-falling-copy");
  sim.dispense.thrownList(); // the lane hooks FallingBlocks.joined on its first pass (every dispense tick)
  const e = sim.falling.fall(5, 40, 5);
  const t = new ThrownTracks({ idOf: () => 7 }), players = new Map([["p1", { position: { x: 5.5, y: 35, z: 5.5 } }]]);
  const list = sim.dispense.thrownList();
  t.birth(list);
  const rows = t.update(list, players).get("p1");
  const rd = new RemoteDispense({ copyWorld: () => world });
  rd.apply({ type: "dispEnts", ents: [], trk: rows });
  assert.equal(rd.falling.length, 1);
  const c = rd.falling[0];
  assert.deepEqual([c.id, c.block, c.meta, c.x, c.z], [7, GRAVEL, 0, 5.5, 5.5]);
  assert.equal(c.y, 1296 / 32 - f(FALLING_SIZE / 2));
  assert.equal(c.y, e.y, "the server record's box bottom");
  assert.deepEqual(rd.balls, [], "not a thrown ball");
  // the next message: the copy updates first (motionY -= 0.04, moveEntity), then takes the packets
  rd.apply({ type: "dispEnts", ents: [], trk: [] });
  assert.ok(Math.abs(rd.falling[0].y - (e.y - 0.04)) < 1e-6, `fell ${rd.falling[0].y}`);
  assert.equal(rd.falling[0].py, e.y);
  // the boat check (ItemBoat's entity list on the client) and the block placement check (checkNoEntityCollision; EntityFallingBlock sets preventEntitySpawning)
  const boxes = clientEntityBoxes({ falling: rd.falling });
  assert.equal(boxes.length, 1);
  const s = BOAT_ENTITY_SIZES.falling, r = rd.falling[0];
  assert.deepEqual(boxes[0], { bb: [r.x - s / 2, r.y, r.z - s / 2, r.x + s / 2, r.y + s, r.z + s / 2], collide: true });
  const blocker = clientPlacementBlocker(() => ({ players: null, mobs: null, vehicles: null, primed: [], falling: rd.falling }));
  assert.equal(blocker([5, Math.floor(r.y), 5, 6, Math.floor(r.y) + 1, 6]), true);
  assert.equal(blocker([8, 20, 8, 9, 21, 9]), false);
  // ThrownCopies routes the kind to its own list
  assert.deepEqual(Object.keys(new ThrownCopies({}).lists()), ["arrows", "balls", "hooks", "falling"]);
  rd.clear();
  assert.deepEqual(rd.falling, []);
  assert.equal(f(FALLING_SIZE / 2), f(FALLING_Y_OFFSET));
});

test("main.js wiring: the falling copies are drawn, checked by ItemBoat and the placement check; server-dispense lists the lane", () => {
  const main = src("./main.js");
  assert.match(main, /scene\.setFalling\?\.\(remoteDispense\.falling \?\? \[\]\); \/\/ b89 mpobjects89/);
  assert.match(main, /falling: remoteDispense\?\.falling \?\? \[\], \/\/ b89 mpobjects89/);
  assert.match(main, /primed: remoteDispense\?\.primed, falling: remoteDispense\?\.falling \}\)\); \/\/ b82 mpplace82/);
  assert.match(main, /const clientBoatCopies = \(\) => \(multiplayer \? clientBoatCopyBoxes\(remoteVehicles\?\.boats\) : objectTracker\.vehicleTargets\(\)/);
  assert.match(src("./multiplayer/server-dispense.js"), /out\.push\(\.\.\.fallingTrackList\(this\)\);/);
});

// A floor at y 30, a boat copy resting on it at z 40, the client player walking -z into it from z 43 (yaw 0 forward is -z).
function walkIntoBoat(copies) {
  const world = new World("b89-boatwalk");
  for (let x = 30; x <= 50; x++) for (let z = 30; z <= 50; z++) for (let y = 29; y <= 40; y++) world.put(x, y, z, y === 29 ? 1 : 0, 0, false);
  const boats = new Boats();
  const boat = boats.spawnBoat({ x: 40.5, y: 30, z: 40 }, { seed: 3 });
  boats.setPosition(boat, 40.5, 30 + f(0.3), 40);
  const s = new Survival({});
  const state = { world, position: vector(40.5, 30, 43), previous: vector(40.5, 30, 43), velocity: vector(0, 0, 0), motion: new PlayerMotion(), grounded: true, collidedH: false, flying: false, fallDistance: 0, landedFall: 0, yaw: 0, survival: s, eating: null };
  setEntityBoxes(clientBoatBoxProvider(copies ? () => clientBoatCopyBoxes(boats) : () => [], () => []));
  try {
    for (let i = 0; i < 40; i++) {
      const r = movePlayer(state, { forward: 1, strafe: 0, sneak: false, sprint: false, jump: false });
      finishPlayerMovement(state, { inWater: r.inWater, inLavaNow: r.inLavaNow, oldPosition: r.oldPosition });
    }
  } finally { setEntityBoxes(null); }
  return { z: state.position.z, y: state.position.y, bb: boat.bb };
}

test("World.getCollidingBoundingBoxes: the multiplayer client player walks into a remote boat copy (EntityBoat.getBoundingBox), not through it", () => {
  const boats = new Boats(), b = boats.spawnBoat({ x: 1.5, y: 10, z: 1.5 }, { seed: 1 });
  boats.setPosition(b, 1.5, 10.3, 1.5);
  assert.deepEqual(clientBoatCopyBoxes(boats), [b.bb]);
  b.dead = true;
  assert.deepEqual(clientBoatCopyBoxes(boats), [], "a destroyed copy");
  assert.deepEqual(clientBoatCopyBoxes(null), []);
  const before = walkIntoBoat(false), after = walkIntoBoat(true);
  assert.ok(before.z < before.bb[2], `without the copies the player walked through (z ${before.z})`);
  assert.ok(Math.abs(after.z - (after.bb[5] + 0.3)) < 1e-6, `stopped at the boat's far side (z ${after.z}, boat maxZ ${after.bb[5]})`);
  assert.equal(after.y, 30, "the 0.6 boat is above the 0.5 step");
});

test("bytecode-read wz: the crystal's eye height is 0 on the server; a living mob's is its size height * 0.85 (the old `mob.height` read was undefined: NaN)", () => {
  assert.equal(CRYSTAL_EYE_HEIGHT, 0);
  const sim = new DedicatedSimulation({}, { world: new World("b89-eye"), mobs: true, gameMode: "survival" });
  const crystal = { type: "ender_crystal", x: 0.5, y: 40, z: 0.5, health: 5 }, zombie = sim.mobs.mobs.create("zombie", 0.5, 40, 0.5), wolf = sim.mobs.mobs.create("wolf", 0.5, 40, 0.5);
  assert.equal(zombie.height, undefined, "the server's records carry no height");
  assert.equal(sim.mobs.useEye(crystal), 0);
  assert.equal(sim.mobs.useEye(zombie), livingEyeHeight("zombie", sim.mobs.mobs.size(zombie)[1]));
  assert.equal(sim.mobs.useEye(zombie), f(f(1.8) * f(0.85)));
  assert.equal(sim.mobs.useEye(wolf), f(f(0.8) * f(0.8)));
  const sm = src("./multiplayer/server-mobs.js");
  assert.ok(!sm.includes("livingEyeHeight(mob.type, mob.height)"));
  assert.equal(sm.match(/eye: this\.useEye\(mob\)/g).length, 2, "attack and interact");
});

function summonGame() {
  const world = new World("b89-summon", "meadow", 1), survival = new Survival({}, "creative"), mobs = new EntityWorld(world, []);
  mobs.worldRandom = new JavaRandom(1);
  const env = { world: () => world, survival: () => survival, mobs: () => mobs, active: () => ({ mode: "creative", allowCommands: true }), position: () => ({ x: 0.5, y: 60, z: 0.5 }), changed() {}, refreshInventory() {},
    stackName: () => "stack", giveDrop() {}, updateBlock() {}, destroyBlock() {}, minecarts: () => null, entityHosts: () => null, rockets: () => ({ rockets: [] }) };
  const host = createCommandHost(env); host.print = () => {};
  const runner = createCommandRunner(host);
  return { mobs, run: (s) => runner.run(s) };
}

test("executed (summon87-reference.json) and bytecode-read bu.b: /summon EnderCrystal sets posY = command y + yOffset 1, tagged or not", () => {
  const pos = (name, tag) => Number(summonRef.base.find((r) => r[0] === name && r[1] === tag)[2].Pos.match(/1:(-?[0-9.]+)d/)[1]);
  assert.equal(pos("EnderCrystal", null), pos("Pig", null) + 1);
  const tagged = summonRef.base.find((r) => r[0] === "EnderCrystal" && r[1])[1];
  assert.equal(pos("EnderCrystal", tagged), pos("Pig", tagged) + 1);
  assert.equal(CRYSTAL_Y_OFFSET, 1);
  const g = summonGame();
  g.run("/summon Pig 0.5 50 0.5");
  g.run("/summon EnderCrystal 0.5 50 0.5");
  g.run("/summon EnderCrystal 3.5 50 0.5 {Invulnerable:1b}");
  const pig = g.mobs.entities.find((e) => e.type === "pig"), [plain, inv] = g.mobs.entities.filter((e) => e.type === "ender_crystal");
  assert.equal(plain.y, pig.y + 1);
  assert.equal(inv.y, pig.y + 1);
  assert.equal(inv.invulnerable, true);
  if (plain.py !== undefined) assert.equal(plain.py, plain.y);
  const pigLift = liftSummonedCrystal({ type: "pig", y: 5 });
  assert.equal(pigLift.y, 5, "only crystals");
});

test("bytecode-read Entity.moveEntity on the crystal: a piston moves its posY-centred box (stepHeight 0, no steps)", () => {
  const world = new World("b89-crystal-push");
  for (let x = 15; x <= 26; x++) for (let z = 15; z <= 26; z++) for (let y = 5; y <= 16; y++) world.put(x, y, z, 0, 0, false);
  for (let z = 15; z <= 26; z++) world.put(22, 9, z, 1, 0, false); // a wall cell x 22..23, y 9..10: inside the crystal's [y - 1, y + 1], under the old feet box [y, y + 2]
  for (let x = 15; x <= 21; x++) for (let z = 15; z <= 26; z++) world.put(x, 11, z, 1, 0, false); // a ceiling 11..12, met by the old box only
  const w = new EntityWorld(world, [], () => 0.5);
  const c = { type: "ender_crystal", x: 20.5, y: 10, z: 20.5, health: 5, vx: 0, vy: 0, vz: 0 };
  w.entities.push(c);
  w.pushMove(c, 0.75, 0, 0);
  assert.equal(c.x, 21.0, "stopped by the wall at x 22 (box maxX 21.5 -> 22)");
  w.pushMove(c, 0, 0.5, 0);
  assert.equal(c.y, 10, "the box top already touches the ceiling at 11");
  assert.equal(w.events.filter((e) => e.sound).length, 0, "canTriggerWalking (wz.g_) is false");
  // with a box below: pushed down onto a floor at 8 the box bottom rests at 8 (posY 9)
  for (let x = 15; x <= 21; x++) for (let z = 15; z <= 26; z++) world.put(x, 7, z, 1, 0, false);
  w.pushMove(c, 0, -1.5, 0);
  assert.equal(c.y, 9);
  // the helper alone: y is the box bottom only during the move
  const seen = [];
  crystalPushMove(null, { y: 4 }, 0, 0, 0, (_w, e, wd, h, dx, dy, dz, step) => { seen.push([e.y, wd, h, step]); return 0; });
  assert.deepEqual(seen, [[3, 2, 2, 0]]);
  assert.match(src("./entities.js"), /if \(e\.type === "ender_crystal"\) return crystalPushMove\(this\.world, e, dx, dy, dz, moveEntity(?:, crystalPushHooks\(e, \(c\) => crystalAttack\(this, c\)\))?\);/); // b90 mpobjects90: the line gained the hooks argument (a source pin, same behaviour)
});

test("the fireball sweep's crystal box is centred on posY (ze.h reads Entity.boundingBox), with mpperf79 on and off", () => {
  const c = { type: "ender_crystal", x: 0.5, y: 10, z: 0.5, health: 5 };
  const mobs = { size: () => [2, 2], sizeInto: (_e, out) => { out[0] = 2; out[1] = 2; return out; } };
  const low = [0, 9.2, 0, 1, 9.6, 1]; // under posY: in [y - 1, y + 1], not in the feet box [y, y + 2]
  const high = [0, 11.4, 0, 1, 11.8, 1]; // in the feet box only
  const mode = fast79.mode;
  try {
    for (const m of ["on", "off", "verify"]) {
      fast79.mode = m;
      assert.deepEqual(sweepBox(mobs, c, low, pushBox), crystalBox(0.5, 10, 0.5), m);
      assert.equal(sweepBox(mobs, c, high, pushBox), null, m);
    }
  } finally { fast79.mode = mode; }
  assert.deepEqual(sweepBoxReference(mobs, c, low, pushBox), crystalBox(0.5, 10, 0.5));
  const pig = { type: "pig", x: 0.5, y: 10, z: 0.5 };
  assert.deepEqual(sweepBoxReference({ size: () => [0.9, 0.9] }, pig, [0, 10.2, 0, 1, 10.4, 1], pushBox), pushBox(pig, 0.9, 0.9), "other mobs keep their feet box");
});
