// Batch 82 fireext82: the fire counter of eyes of ender, firework rockets and primed TNT (Entity.onEntityUpdate and moveEntity's fire tail, bytecode-read), their
// overlays and saves, the fireballs' saved rotation, and the fire flag of the multiplayer cadence-off item and orb rows.
import test from "node:test";
import assert from "node:assert/strict";
import { NBT } from "./nbt.js";
import { JavaRandom } from "./java-random.js";
import { createEye, tickEye } from "./eye-of-ender.js";
import { EyesOfEnder, eyeFire, eyeBox } from "./eye-of-ender-live.js";
import { createRocket, tickRocket } from "./firework-rocket.js";
import { FireworkRockets } from "./fireworks-live.js";
import { primeTnt, tickTnt } from "./explosion.js";
import { metaValues, objectView } from "./object-tracker.js";
import { FIRE_BOXES } from "./fire-overlays.js";
import { Fireballs, savedRotation } from "./fireballs.js";
import { fireballTurn } from "./fireball-turn.js";
import { javaProjectileFromNbt, javaProjectileToNbt } from "./java-projectiles.js";
import { javaObjectFromNbt } from "./java-objects.js";
import { LAVA, WATER, FIRE } from "./world.js";

import { CAULDRON } from "./stone-utility.js";

// `id` filling y <= top, air above
const fluidWorld = (id, top = 70) => ({ get: (x, y, z) => (y <= top ? id : 0), getMeta: () => 0, set() {}, solid: () => false });
const AIR = { get: () => 0, getMeta: () => 0, set() {}, solid: () => false };
// one block at (bx, by, bz), air elsewhere
const oneBlock = (id, bx, by, bz, meta = 0) => { const sets = []; return { sets, get: (x, y, z) => (x === bx && y === by && z === bz ? id : 0), getMeta: (x, y, z) => (x === bx && y === by && z === bz ? meta : 0), set: (...a) => sets.push(a), solid: () => false }; };
const nbtEntity = (id, extra = []) => new Map([["id", { type: NBT.STRING, value: id }], ["Pos", { type: NBT.LIST, value: { elementType: NBT.DOUBLE, items: [1, 70, 1] } }], ...extra]);
const short = (v) => ({ type: NBT.SHORT, value: v });

test("an eye of ender counts its fire down on the server, flags every 20th tick, burns 300 in lava and goes out in water", () => {
  const eye = createEye(0.5, 100, 0.5);
  assert.equal(eye.fire, 0);
  eye.fire = 41;
  eyeFire(eye, AIR);
  assert.equal(eye.fire, 40);
  assert.ok(!eye.velocityChanged);
  eyeFire(eye, AIR);
  assert.equal(eye.fire, 39);
  assert.equal(eye.velocityChanged, true, "fire % 20 == 0: attackEntityFrom(onFire) -> setBeenAttacked");
  const hot = createEye(0.5, 69.5, 0.5);
  eyeFire(hot, fluidWorld(LAVA));
  assert.equal(hot.fire, 300);
  assert.equal(hot.velocityChanged, true, "setOnFireFromLava: attackEntityFrom(lava, 4)");
  const wet = createEye(0.5, 69.5, 0.5);
  wet.fire = 120;
  eyeFire(wet, fluidWorld(WATER), { inWater: true });
  assert.equal(wet.fire, 0, "handleWaterMovement: fire = 0");
  const copy = createEye(0.5, 100, 0.5);
  copy.fire = 120;
  eyeFire(copy, AIR, { remote: true });
  assert.equal(copy.fire, 0, "a client world zeroes the counter");
  eyeFire(copy, fluidWorld(LAVA), { remote: true, box: eyeBox(0.5, 69.5, 0.5) });
  assert.equal(copy.fire, 300, "a client copy in lava sets its own counter");
  // the eye never calls moveEntity: a fire block does not light it, and the counter never rests below 0
  const byFire = createEye(0.5, 64, 0.5);
  eyeFire(byFire, oneBlock(FIRE, 0, 64, 0));
  assert.equal(byFire.fire, 0);
  // tickEye alone runs no fire part (EyesOfEnder.tick calls eyeFire first)
  const plain = createEye(0.5, 100, 0.5); plain.fire = 50;
  tickEye(plain, new JavaRandom(1));
  assert.equal(plain.fire, 50);
});

test("the live eyes burn in lava through the world hook, draw the flames, and save and load Fire", () => {
  const eyes = new EyesOfEnder(new JavaRandom(5));
  const eye = eyes.launch(0.5, 69.5, 0.5, [100, 70, 100]);
  eyes.tick({ world: fluidWorld(LAVA) });
  assert.equal(eye.fire, 300);
  assert.equal(eyes.balls[0].burning, true);
  const saved = eyes.serialize();
  assert.equal(saved.eyes[0].fire, 300);
  const again = new EyesOfEnder(new JavaRandom(5));
  again.load(saved);
  assert.equal(again.eyes[0].fire, 300);
  // out of lava and water: 1 a tick
  again.tick({ world: AIR });
  assert.equal(again.eyes[0].fire, 299);
  // the box test of handleWaterMovement puts it out when no inWater hook is given
  const wet = new EyesOfEnder(new JavaRandom(6)), w = wet.launch(0.5, 69.5, 0.5, [100, 70, 100]);
  w.fire = 100;
  wet.tick({ world: fluidWorld(WATER) });
  assert.equal(w.fire, 0);
  // an older save without Fire loads with 0
  const old = new EyesOfEnder(new JavaRandom(7));
  old.load({ eyes: [{ ...saved.eyes[0], fire: undefined }] });
  assert.equal(old.eyes[0].fire, 0);
});

test("a firework rocket: -1 at rest, 160 when a fire block lights it, a 0 counter in fire stays at 1, lava 300 + 1", () => {
  const rand = new JavaRandom(9);
  const r = createRocket(0.5, 100, 0.5, null, rand);
  assert.equal(r.fire, 0);
  tickRocket(r, AIR, rand);
  assert.equal(r.fire, -1, "moveEntity: out of fire a counter <= 0 rests at -fireResistance");
  // a rocket born in fire: 0 -> 1 (no setFire), then the counter's -1 and the tail's +1 hold it at 1
  const fireAt = (y) => oneBlock(FIRE, 0, Math.floor(y), 0);
  const born = createRocket(0.5, 64.1, 0.5, null, rand);
  born.mx = born.mz = 0;
  tickRocket(born, fireAt(64.1), rand);
  assert.equal(born.fire, 1);
  assert.equal(born.velocityChanged, true, "dealFireDamage(1): attackEntityFrom -> setBeenAttacked");
  // from -1 the fire block lights it: ++fire == 0 -> setFire(8)
  const lit = createRocket(0.5, 64.1, 0.5, null, rand);
  lit.mx = lit.mz = 0; lit.fire = -1;
  tickRocket(lit, { get: () => FIRE, getMeta: () => 0, solid: () => false }, rand);
  assert.equal(lit.fire, 160);
  // lava: setFire(15) to 300, then the tail's ++ in the lava cell
  const hot = createRocket(0.5, 69.5, 0.5, null, rand);
  tickRocket(hot, fluidWorld(LAVA), rand);
  assert.equal(hot.fire, 301);
  // a client copy (server false) zeroes it first
  const copy = createRocket(0.5, 100, 0.5, null, rand);
  copy.fire = 200;
  tickRocket(copy, AIR, rand, { remote: true, server: false });
  assert.equal(copy.fire, -1, "0 from the client world, then the tail rests it at -1");
});

test("a burning rocket in water goes out with handleWaterMovement before the fizz can play", () => {
  const rand = new JavaRandom(10), r = createRocket(0.5, 69.5, 0.5, null, rand);
  r.fire = 100;
  const out = tickRocket(r, fluidWorld(WATER), rand);
  assert.equal(r.fire, -1);
  assert.equal(out.fizz, undefined, "the counter is 0 by the tail, so no fizz");
});

test("the live rockets save and load Fire and draw the flames", () => {
  const rockets = new FireworkRockets(new JavaRandom(11));
  const r = createRocket(0.5, 100, 0.5, null, new JavaRandom(1));
  r.fire = 55;
  rockets.rockets.push(r);
  assert.equal(rockets.balls[0].burning, true);
  const saved = rockets.serialize();
  assert.equal(saved.rockets[0].fire, 55);
  const again = new FireworkRockets(new JavaRandom(11));
  again.load(saved);
  assert.equal(again.rockets[0].fire, 55);
  again.load({ rockets: [{ ...saved.rockets[0], fire: -1 }] });
  assert.equal(again.rockets[0].fire, -1, "a resting counter loads as saved");
  // no fizz: isWet at the tail is this update's water test, which also put the counter out, and the lava test reads the same cells of the same box, so only
  // rain (not modelled) could leave a rocket wet and burning there
});

test("primed TNT counts its own fire in moveEntity: -1 at rest, 160 in fire, no count-down; the copy too, without the cauldron", () => {
  const t = primeTnt(0.5, 100.49, 0.5, { random: () => 0 });
  assert.equal(t.fire, 0);
  tickTnt(AIR, t);
  assert.equal(t.fire, -1);
  const fire = { get: (x, y, z) => (y === 100 ? FIRE : 0), getMeta: () => 0, solid: () => false };
  const lit = primeTnt(0.5, 100.49, 0.5, { random: () => 0 });
  lit.fire = -1; lit.vy = 0;
  tickTnt(fire, lit);
  assert.equal(lit.fire, 160);
  assert.equal(lit.velocityChanged, true);
  tickTnt(fire, lit);
  assert.equal(lit.fire, 161, "EntityTNTPrimed never calls onEntityUpdate: nothing counts it down");
  lit.y = 200; lit.py = 200; lit.vy = 0;
  tickTnt(AIR, lit);
  assert.equal(lit.fire, 161, "out of fire a counter above 0 is kept");
  // a burning TNT copy over a filled cauldron: only the server's puts it out (BlockCauldron's !isRemote)
  const pot = oneBlock(CAULDRON, 0, 100, 0, 3), copy = primeTnt(0.5, 100.49, 0.5, { random: () => 0 });
  copy.fire = 50; copy.vy = 0;
  tickTnt(pot, copy, null, { remote: true });
  assert.equal(copy.fire, 50);
  assert.equal(pot.sets.length, 0);
  const server = primeTnt(0.5, 100.49, 0.5, { random: () => 0 });
  server.fire = 50; server.vy = 0;
  tickTnt(pot, server);
  assert.equal(server.fire, -1, "extinguish, then the tail rests it");
  assert.equal(pot.sets.length, 1);
  // flag 0 is never set for TNT (no onEntityUpdate), while other objects send it
  assert.equal(metaValues("tnt", { fire: 200 })[0][2], 0);
  assert.equal(metaValues("eyeOfEnder", { fire: 200 })[0][2], 1);
  assert.deepEqual(FIRE_BOXES.tnt, [0.98, 0.98, 0.49]);
});

test("objectView: an eye, rocket or TNT copy burns by its own counter; a falling block copy reads its block again", () => {
  const fake = (kind, c) => ({ clientEntity: () => ({ x: 1, y: 2, z: 3, px: 1, py: 2, pz: 3, yaw: 0, pitch: 0, meta: new Map(), ...c }) });
  assert.equal(objectView(fake("eyeOfEnder", { sim: { fire: 300 } }), {}, "eyeOfEnder").burning, true);
  assert.equal(objectView(fake("eyeOfEnder", { sim: { fire: 0 }, meta: new Map([[0, 1]]) }), {}, "eyeOfEnder").burning, true, "the watched flag 0");
  assert.equal(objectView(fake("firework", { sim: { fire: 0 } }), {}, "firework").burning, false);
  assert.equal(objectView(fake("firework", { sim: { fire: 1 } }), {}, "firework").burning, true);
  const tnt = objectView(fake("tnt", { sim: { fire: 160, fuse: 40 } }), {}, "tnt");
  assert.equal(tnt.burning, true);
  assert.equal(tnt.fuse, 40);
  const falling = objectView(fake("falling", { sim: { block: 12, meta: 1 } }), {}, "falling");
  assert.deepEqual([falling.block, falling.meta], [12, 1], "the dangling else bound the falling branch to the tnt test");
});

test("eye and rocket Fire import from NBT and export through javaProjectileFromNbt / the exporter record", () => {
  const eye = javaProjectileFromNbt(nbtEntity("EyeOfEnderSignal", [["Fire", short(120)]]));
  assert.equal(eye.record.fire, 120);
  assert.equal("fire" in javaProjectileFromNbt(nbtEntity("EyeOfEnderSignal")).record, false);
  const rocket = javaProjectileFromNbt(nbtEntity("FireworksRocketEntity", [["Fire", short(-1)]]));
  assert.equal(rocket.record.fire, -1);
  const tnt = javaObjectFromNbt(nbtEntity("PrimedTnt", [["Fire", short(170)], ["Fuse", { type: NBT.BYTE, value: 30 }]]));
  assert.equal(tnt.record.fire, 170);
});

test("fireballs take the shooter's rotation, turn toward the motion, and save, load and export Rotation", () => {
  const world = AIR, mobs = { world, entities: [], random: () => 0.25, isActive: () => true, fx: null };
  const balls = new Fireballs(mobs);
  const ghast = { id: "g1", x: 0, y: 100, z: 0, rotationYaw: 33.5, rotationPitch: -12, health: 10 };
  mobs.entities.push(ghast);
  const b = balls.launch({ large: true, owner: ghast, x: 0, y: 101, z: 0, dx: 1, dy: 0, dz: 0 });
  assert.deepEqual([b.yaw, b.pitch, b.prevYaw, b.prevPitch], [33.5, -12, 33.5, -12]);
  const exact = balls.launch({ large: false, owner: ghast, x: 0, y: 101, z: 0, exact: [1, 0, 0] });
  assert.deepEqual([exact.yaw, exact.pitch], [0, 0], "the (world, x, y, z, ax, ay, az) form keeps its own 0, 0");
  b.vx = 0.2; b.vy = 0; b.vz = 0.1;
  const want = fireballTurn({ yaw: b.yaw, pitch: b.pitch, prevYaw: b.yaw, prevPitch: b.pitch }, 0.2, 0, 0.1);
  balls.tickBall(b);
  assert.deepEqual([b.yaw, b.pitch], [want.yaw, want.pitch]);
  assert.equal(b.prevYaw, want.prevYaw);
  const saved = balls.serialize();
  assert.deepEqual(saved[0].rotation, [b.yaw, b.pitch]);
  const again = new Fireballs(mobs);
  again.load(saved);
  assert.equal(again.list[0].yaw, Math.fround(b.yaw % 360));
  assert.equal(again.list[0].prevYaw, Math.fround(b.yaw));
  assert.deepEqual(savedRotation({ rotation: [370, 10] }), { yaw: 10, pitch: 10, prevYaw: 370, prevPitch: 10 });
  assert.deepEqual(savedRotation({}), { yaw: 0, pitch: 0, prevYaw: 0, prevPitch: 0 });
  const out = javaProjectileToNbt("fireballs", { kind: "smallFireball", vx: 0, vy: 0, vz: 0, rotation: [1.5, 2.5] });
  assert.deepEqual(out.fields.Rotation.value, { elementType: NBT.FLOAT, items: [1.5, 2.5] });
  const direction = ["direction", { type: NBT.LIST, value: { elementType: NBT.DOUBLE, items: [0.1, 0, 0] } }];
  const rotation = ["Rotation", { type: NBT.LIST, value: { elementType: NBT.FLOAT, items: [45, -5] } }];
  assert.deepEqual(javaProjectileFromNbt(nbtEntity("Fireball", [direction, rotation])).record.rotation, [45, -5]);
  assert.deepEqual(javaProjectileFromNbt(nbtEntity("SmallFireball", [direction])).record.rotation, [0, 0]);
});

test("a world export writes the eye's motion and Fire, the rocket's and TNT's counters and a ghast fireball's Rotation", async () => {
  const { World } = await import("./world.js");
  const { Survival } = await import("./survival.js");
  const { exportJavaSave } = await import("./region-export.js");
  const { readRegion, decodeRegionChunk, regionSlot, regionAddress } = await import("./region-file.js");
  const { chunkFromNbt } = await import("./chunk-nbt.js");
  const { nbtGet } = await import("./nbt-get.js");
  const w = new World("17", "javaStreamed", 12), player = new Survival({}, "survival").serialize();
  const eye = { x: -6, y: 102.5, z: -2.5, px: -6, py: 102.5, pz: -2.5, vx: 0.25, vy: 0.125, vz: -0.5, yaw: 0, pitch: 0, prevYaw: 0, prevPitch: 0, tx: 0, ty: 0, tz: 0, age: 3, drops: false, fire: 120 };
  const rocket = { ...createRocket(-5, 102.5, -2.5, null, new JavaRandom(3)), fire: -1 };
  delete rocket.box;
  const fireballs = [{ kind: "fireball", x: -4, y: 102.5, z: -2.5, vx: 0.3, vy: 0, vz: 0.1, ax: 0, ay: 0, az: 0, dimension: 0, rotation: [-71.5, 22.25] }];
  const tnt = [{ x: -3, y: 102, z: -2.5, vx: 0, vy: 0, vz: 0, fuse: 40, fire: 165 }];
  const { files } = await exportJavaSave({ id: "f82", name: "F82", seed: "17", biome: "javaStreamed", generationVersion: 12, mode: "survival", edits: [], player,
    position: { x: -0.5, y: 102, z: -0.5, yaw: 0, pitch: 0 }, updated: 1700000000000, fireballs, eyes: { eyes: [eye] }, rockets: { rockets: [rocket] }, tnt }, { world: w });
  const cx = -1 + w.originX / 16, cz = -1 + w.originZ / 16, a = regionAddress(cx, cz);
  const chunk = chunkFromNbt(await decodeRegionChunk(readRegion(files.get(`region/r.${a.regionX}.${a.regionZ}.mca`)).get(regionSlot(a.x, a.z))));
  const find = (id) => chunk.entities.find((e) => nbtGet(e, "id", NBT.STRING, "") === id);
  const motion = (e) => nbtGet(e, "Motion", NBT.LIST).items;
  const e = find("EyeOfEnderSignal");
  assert.ok(e);
  assert.deepEqual(motion(e), [0.25, 0.125, -0.5], "the eye's vx/vy/vz (it exported as 0 before)");
  assert.equal(nbtGet(e, "Fire", NBT.SHORT), 120);
  assert.equal(nbtGet(find("FireworksRocketEntity"), "Fire", NBT.SHORT), -1);
  const t = find("PrimedTnt");
  assert.ok(t);
  assert.equal(nbtGet(t, "Fire", NBT.SHORT), 165);
  const ball = find("Fireball");
  assert.deepEqual(javaProjectileFromNbt(ball, { shiftX: -w.originX, shiftZ: -w.originZ }).record.rotation, [-71.5, 22.25]);
});
