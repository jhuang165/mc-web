// Batch 81 throwfire81: arrows, thrown potions and bottles in lava, and the flames over burning items, orbs, arrows and boats.
//  - EntityArrow (zc) does not override attackEntityFrom, so setOnFireFromLava's attackEntityFrom(lava, 4) runs Entity.setBeenAttacked: velocityChanged (the tracker's S12) on
//    every tick in lava, with setFire(15). A client copy zeroes its counter every update (sa.C) and takes 300 again in lava (bytecode-read sa.C, sa.E, sa.Q, sa.a(ro, float)).
//  - EntityPotion and EntityExpBottle are EntityThrowables: the same fire counter as a snowball, saved and loaded as Entity's Fire.
//  - Render.doRenderShadowAndFire draws renderEntityOnFire over any entity whose canRenderOnFire (isBurning) holds; only EntityFallingBlock overrides it (false).
import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { LAVA, WATER } from "./world.js";
import { Arrows } from "./bow.js";
import { GaussianRandom } from "./projectiles.js";
import { WitchPotions } from "./witch-potions.js";
import { NBT } from "./nbt.js";
import { javaProjectileFromNbt, javaProjectileToNbt } from "./java-projectiles.js";
import { objectView, vehicleView } from "./object-tracker.js";
import { FireOverlays, FIRE_BOXES, entityBurning, cameraViewYaw } from "./fire-overlays.js";
import { RemoteDispense } from "./multiplayer/client-dispense.js";

globalThis.document ??= { createElementNS: () => ({ addEventListener() {}, removeEventListener() {}, style: {} }) };

// lava (or water) filling y <= top, air above
const fluidWorld = (id, top = 70) => ({ get: (x, y, z) => (y <= top ? id : 0), getMeta: () => 0, solid: () => false });
const AIR = { get: () => 0, getMeta: () => 0, solid: () => false };

test("an arrow in lava flags velocityChanged on its first lava tick and every one after, with fire 300", () => {
  const arrows = new Arrows(() => 0.5), lava = fluidWorld(LAVA);
  const a = arrows.make({ x: 0.5, y: 70.5, z: 0.5, mx: 0, my: -0.1, mz: 0, yaw: 1, pitch: -90 }, new GaussianRandom(1));
  assert.equal(a.fire, 0);
  arrows.step(lava, a, {});
  assert.equal(a.fire, 300);
  assert.equal(a.velocityChanged, true, "attackEntityFrom(lava) -> setBeenAttacked on the first lava tick");
  a.velocityChanged = false;
  arrows.step(lava, a, {});
  assert.equal(a.fire, 300, "299 after the counter tick, then setFire(15) puts it back to 300");
  assert.equal(a.velocityChanged, true, "still in lava: flagged again");
  // out of the lava: the counter runs down and the flag only comes on the 20th ticks
  const b = arrows.make({ x: 0.5, y: 100, z: 0.5, mx: 0, my: 0, mz: 0, yaw: 1, pitch: 1 }, new GaussianRandom(2));
  b.fire = 299;
  arrows.step(AIR, b, {});
  assert.equal(b.fire, 298);
  assert.ok(!b.velocityChanged);
});

test("a client arrow copy zeroes its counter every update and takes 300 in lava", () => {
  const arrows = new Arrows(() => 0.5);
  const a = arrows.make({ x: 0.5, y: 100, z: 0.5, mx: 0, my: 0, mz: 0, yaw: 1, pitch: 1 }, new GaussianRandom(3));
  a.fire = 120;
  arrows.step(AIR, a, { remote: true });
  assert.equal(a.fire, 0, "sa.C: a client world zeroes the counter");
  const b = arrows.make({ x: 0.5, y: 70.5, z: 0.5, mx: 0, my: -0.1, mz: 0, yaw: 1, pitch: -90 }, new GaussianRandom(4));
  arrows.step(fluidWorld(LAVA), b, { remote: true });
  assert.equal(b.fire, 300);
});

const potionBall = (pots, kind, y, fire = 0) => {
  const rng = pots.projectiles.rng();
  const b = { kind, damage: kind === "potion" ? 16388 : 0, owner: null, x: 0.5, y, z: 0.5, px: 0.5, py: y, pz: 0.5, mx: 0, my: 0, mz: 0, yaw: 0, pitch: 0, prevYaw: 0, prevPitch: 0, ticks: 0, rand: rng, random: rng, dead: false, ...(fire ? { fire } : {}) };
  pots.projectiles.balls.push(b);
  return b;
};
const mobsOn = (world) => ({ world, entities: [], events: [] });

test("thrown potions and bottles o' enchanting burn in lava, burn down, go out in water, and save and load Fire", () => {
  for (const kind of ["potion", "expBottle"]) {
    const lava = fluidWorld(LAVA), pots = new WitchPotions(mobsOn(lava), () => 0.5), b = potionBall(pots, kind, 69.5); // the 0.25 box shrunk 0.4 at top and bottom still reaches the lava cell
    pots.projectiles.tickOne(lava, b, []);
    assert.equal(b.fire, 300, kind);
    assert.equal(b.velocityChanged, true, kind);
    const air = new WitchPotions(mobsOn(AIR), () => 0.5), c = potionBall(air, kind, 100, 41);
    air.projectiles.tickOne(AIR, c, []);
    assert.equal(c.fire, 40);
    const saved = air.serialize();
    assert.equal(saved[0].fire, 40, `${kind} saves Fire`);
    const again = new WitchPotions(mobsOn(AIR), () => 0.5);
    again.load(saved);
    assert.equal(again.balls[0].fire, 40, `${kind} loads Fire`);
    assert.equal(again.balls[0].kind, kind);
    const water = fluidWorld(WATER), wet = new WitchPotions(mobsOn(water), () => 0.5), d = potionBall(wet, kind, 69.5, 100);
    wet.projectiles.spawner = { spawn: () => {} };
    wet.projectiles.tickOne(water, d, []);
    assert.equal(d.fire, 0, `${kind}: handleWaterMovement puts it out`);
  }
  const unburnt = new WitchPotions(mobsOn(AIR), () => 0.5);
  potionBall(unburnt, "potion", 100);
  assert.equal("fire" in unburnt.serialize()[0], false);
});

test("a ThrownPotion or ThrownExpBottle Fire short imports; the exporter's record keeps the counter", () => {
  const entity = (id, extra = []) => new Map([["id", { type: NBT.STRING, value: id }], ["Pos", { type: NBT.LIST, value: { elementType: NBT.DOUBLE, items: [1, 70, 1] } }], ["Fire", { type: NBT.SHORT, value: 77 }], ...extra]);
  assert.equal(javaProjectileFromNbt(entity("ThrownExpBottle")).record.fire, 77);
  const potion = javaProjectileFromNbt(entity("ThrownPotion", [["potionValue", { type: NBT.INT, value: 16388 }]]));
  assert.equal(potion.list, "thrownPotions");
  assert.equal(potion.record.fire, 77);
  assert.equal(potion.record.damage, 16388);
  assert.equal(javaProjectileToNbt("thrownPotions", { kind: "expBottle" }).id, "ThrownExpBottle");
});

test("object views carry Entity.isBurning for items, orbs, arrows and boats from the copy's watched flag 0", () => {
  for (const kind of ["item", "orb", "arrow", "potion", "expBottle"]) {
    const live = { x: 0, y: 0, z: 0, fire: 0 }, client = { x: 0, y: 0, z: 0, px: 0, py: 0, pz: 0, meta: new Map([[0, 1]]) }, tracker = { clientEntity: () => client };
    assert.equal(objectView(tracker, live, kind).burning, true, kind);
    client.meta.set(0, 0);
    assert.equal(objectView(tracker, live, kind).burning, false, kind);
    if (kind === "arrow" || kind === "potion") { client.sim = { fire: 300 }; assert.equal(objectView(tracker, live, kind).burning, true, `${kind}: the copy's own counter from lava`); }
  }
  // no client copy: the live entity, read through its counter
  assert.equal(entityBurning({ fire: 5 }), true);
  assert.equal(entityBurning({ fire: -1 }), false);
  assert.equal(entityBurning({ fire: 5, burning: false }), false, "a copy's flag wins over the live counter");
  const boat = { x: 0, y: 0, z: 0, fire: 0, dead: false }, copy = { present: true, kind: "boat", spec: { yOff: 0.3, width: 1.5, height: 0.6 }, x: 0, y: 0.3, z: 0, px: 0, py: 0.3, pz: 0, yaw: 0, pitch: 0, prevYaw: 0, prevPitch: 0, meta: new Map([[0, 1]]) };
  const boatTracker = { entries: new Map([[boat, { client: copy }]]) };
  assert.equal(vehicleView(boatTracker, boat).burning, true);
});

test("FireOverlays keeps one EntityFireRenderer per burning entity, sized by its box, and drops it with the entity", () => {
  assert.deepEqual(FIRE_BOXES.item, [0.25, 0.25, 0.125]);
  assert.deepEqual(FIRE_BOXES.orb, [0.5, 0.5, 0.25]);
  const scene = new THREE.Scene(), fires = new FireOverlays(scene, FIRE_BOXES.item), item = {}, other = {};
  fires.draw(item, true, 1, 64, 2, 180);
  fires.draw(other, false, 0, 0, 0, 180);
  fires.sweep();
  assert.equal(fires.fires.size, 1, "a burning entity only");
  const root = fires.fires.get(item).root;
  assert.equal(root.visible, true);
  assert.deepEqual([root.position.x, root.position.y, root.position.z], [1, 64.125, 2], "renderEntityOnFire at posY: the box bottom plus the item's yOffset");
  fires.draw(item, false, 1, 64, 2, 180);
  fires.sweep();
  assert.equal(root.visible, false, "put out: hidden");
  fires.sweep();
  assert.equal(fires.fires.size, 0, "gone from the list: disposed");
  assert.equal(scene.children.length, 0);
});

test("the flames turn to the camera like renderEntityOnFire's -playerViewY", () => {
  const camera = new THREE.PerspectiveCamera();
  camera.updateMatrixWorld();
  assert.equal(Math.round(cameraViewYaw(camera)), 180, "a camera looking along -z");
  camera.rotation.y = Math.PI / 2;
  camera.updateMatrixWorld();
  assert.equal(Math.round(cameraViewYaw(camera)), 90);
  assert.equal(cameraViewYaw(null), 180);
});

test("multiplayer rows: the dedicated client's arrows and balls carry the server's fire flag", () => {
  const remote = new RemoteDispense({});
  remote.ents([{ k: "a", i: 1, x: 0, y: 70, z: 0, yaw: 0, pitch: 0, f: 1 }, { k: "b", i: 2, kind: "potion", x: 0, y: 70, z: 0, damage: 5 }, { k: "b", i: 3, kind: "snowball", x: 0, y: 70, z: 0, f: 1 }]);
  assert.equal(remote.arrows[0].burning, true);
  assert.equal(remote.balls.find((b) => b.kind === "potion").burning, false);
  assert.equal(remote.balls.find((b) => b.kind === "snowball").burning, true);
});
