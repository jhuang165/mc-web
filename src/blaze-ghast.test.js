import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { JavaRandom } from "./java-random.js";
import { mhSin, mhCos } from "./lighting.js";
import * as B from "./blaze-ghast.js";

// tools/probes/BlazeGhastProbe.java (tools/verify-blaze-ghast.mjs): the unchanged EntityBlaze (xx), EntityGhast (yd), EntityLargeFireball
// (zg), EntitySmallFireball (zi) and EntityFireball (ze) of 1.7.10 on the MobMoveProbe world double.
export const reference = JSON.parse(await readFile(new URL("../public/research/blaze-ghast-reference.json", import.meta.url)));
const f = Math.fround;
const mix = (i) => i * 1000003 + 17; // the probe's seed for rows that sweep seeds
const rows = (name) => reference.rows.filter((r) => r.case === name);
const near = (a, b, eps, what) => assert.ok(Math.abs(a - b) <= eps, `${what}: ${a} vs ${b}`);
// Original item ids of the probe to this build's internal ids (original-items.js).
const INTERNAL = { 369: B.BLAZE_ROD, 370: B.GHAST_TEAR, 289: B.GUNPOWDER };

test("the probe record counts are the ones the evidence was written with", () => {
  assert.equal(reference.rows.length, Object.values(reference.counts).reduce((a, b) => a + b, 0));
  assert.equal(reference.counts.blazeVolley, 1560);
  assert.equal(reference.counts.ghastAi, 800);
  assert.equal(reference.counts.fireballFlight, 160);
});

test("the blaze and ghast constants are the original's", () => {
  const { blaze, ghast } = rows("facts")[0];
  assert.equal(B.BLAZE.width, f(blaze.width));
  assert.equal(B.BLAZE.height, f(blaze.height));
  assert.equal(B.BLAZE.health, blaze.maxHealth);
  assert.equal(B.BLAZE.attackDamage, blaze.attackDamage);
  assert.equal(B.BLAZE.speed, f(blaze.movementSpeed));
  assert.equal(B.BLAZE.followRange, blaze.followRange);
  assert.equal(blaze.immuneToFire, true);
  assert.equal(blaze.light, 15728880);
  assert.equal(blaze.brightness, 1);
  assert.equal(B.BLAZE.sounds.living, blaze.living);
  assert.equal(B.BLAZE.sounds.hurt, blaze.hurt);
  assert.equal(B.BLAZE.sounds.death, blaze.death);
  assert.equal(B.BLAZE.volume, blaze.volume);
  assert.equal(B.BLAZE.talkInterval, blaze.talkInterval);
  assert.equal(INTERNAL[blaze.dropItem], B.BLAZE_ROD);
  assert.equal(B.GHAST.width, f(ghast.width));
  assert.equal(B.GHAST.height, f(ghast.height));
  assert.equal(B.GHAST.health, ghast.maxHealth);
  assert.equal(ghast.immuneToFire, true);
  assert.equal(B.GHAST.sounds.living, ghast.living);
  assert.equal(B.GHAST.sounds.hurt, ghast.hurt);
  assert.equal(B.GHAST.sounds.death, ghast.death);
  assert.equal(B.GHAST.volume, f(ghast.volume));
  assert.equal(B.GHAST.talkInterval, ghast.talkInterval);
  assert.equal(B.GHAST.maxSpawnedInChunk, ghast.maxSpawnedInChunk);
  assert.equal(ghast.explosionPower, B.FIREBALL.defaultPower);
  assert.equal(ghast.dropItem, 289); // Items.gunpowder, the original id (this build's 330)
  const xp = rows("xp")[0];
  assert.equal(B.BLAZE.experience, xp.blaze);
  assert.equal(B.GHAST.experience, xp.ghast);
});

test("blaze rods and ghast tears and gunpowder are dropped with the original's draws", () => {
  const blaze = rows("blazeDrops"), ghast = rows("ghastDrops");
  assert.equal(blaze.length, 320);
  assert.equal(ghast.length, 160);
  for (const r of blaze) {
    const got = B.blazeDrops(new JavaRandom(mix(r.seed)), r.looting, r.playerHit);
    assert.deepEqual(got, r.items.flatMap((i) => Array(i.count).fill(INTERNAL[i.id])), `blaze ${r.seed} looting ${r.looting} hit ${r.playerHit}`);
  }
  for (const r of ghast) {
    const got = B.ghastDrops(new JavaRandom(mix(r.seed)), r.looting);
    assert.deepEqual(got, r.items.flatMap((i) => Array(i.count).fill(INTERNAL[i.id])), `ghast ${r.seed} looting ${r.looting}`);
  }
  // Blaze rods only drop for a player kill.
  assert.ok(blaze.some((r) => r.looting === 3 && r.items.length && r.items[0].count >= 1) && blaze.every((r) => r.playerHit || !r.items.length));
});

test("the blaze's three-shot volley, melee and aim replay the probe", () => {
  let shots = 0;
  for (const start of rows("blazeStart")) {
    const { dist, seed } = start, rand = new JavaRandom(seed), s = B.blazeState(), me = { x: 64.5, y: 20, z: 64.5 };
    const target = { x: 64.5 + dist, z: 64.5 + dist * 0.5, minY: 20, height: f(0.9) };
    const distance = f(Math.sqrt((target.x - me.x) ** 2 + (target.minY - me.y) ** 2 + (target.z - me.z) ** 2));
    for (const r of rows("blazeVolley").filter((x) => x.dist === dist && x.seed === seed)) {
      if (s.attackTime > 0) s.attackTime--;
      s.hasAttacked = false;
      const out = B.blazeAttack(s, rand, me, target, distance), at = `dist ${dist} seed ${seed} tick ${r.tick}`;
      assert.equal(s.attackTime, r.attackTime, at);
      assert.equal(s.shots, r.shots, at);
      assert.equal(s.burning, r.burning, at);
      assert.equal(s.hasAttacked, r.hasAttacked, at);
      near(out.yaw, r.yaw, 1e-4, at + " yaw");
      assert.deepEqual(out.event ? [{ id: out.event, x: Math.floor(me.x), y: Math.floor(me.y), z: Math.floor(me.z) }] : [], r.aux, at);
      assert.equal(out.shot ? 1 : 0, r.spawned.length, at);
      if (out.shot) {
        shots++;
        near(out.shot.x, r.spawned[0].x, 1e-9, at);
        near(out.shot.y, r.spawned[0].y, 1e-9, at);
        near(out.shot.z, r.spawned[0].z, 1e-9, at);
      }
    }
  }
  // Three volleys of three shots in 260 ticks: shot 1 only winds up, shots 2 to 4 fire (6 ticks apart), then 100 ticks of rest.
  assert.ok(shots > 0);
  const melee = rows("blazeMelee")[0], s = B.blazeState(), rand = new JavaRandom(5);
  const out = B.blazeAttack(s, rand, { x: 64.5, y: 20, z: 64.5 }, { x: 65, z: 64.5, minY: 20, height: f(0.9) }, 0.5);
  assert.equal(out.melee, true);
  assert.equal(s.attackTime, melee.attackTime);
  assert.equal(out.shot, null);
  assert.equal(melee.targetDamage, B.BLAZE.attackDamage);
  assert.equal(melee.spawned.length, 0);
});

test("the blaze's hover push, its 100 tick offset and the fall damping replay the probe", () => {
  for (const seed of [4, 9]) {
    const s = B.blazeState(), rand = new JavaRandom(seed);
    let y = 20;
    for (const r of rows("blazeUpdate").filter((x) => x.seed === seed)) {
      const vy1 = B.blazeHover(s, rand, { y, eye: r.eye, vy: 0 }, { y: r.targetY, eye: r.targetEye }, { onGround: false });
      y += vy1;
      const vy = (vy1 - 0.08) * 0.98; // sv.e: moveEntity, then gravity and drag
      near(vy, r.vy, 1e-6, `seed ${seed} tick ${r.tick} vy`);
      near(y, r.y, 1e-6, `seed ${seed} tick ${r.tick} y`);
      // The third offset is a fresh gaussian pair; between the draws the probe's shared Entity.rand also feeds EntityLiving's own idle
      // randomness, which this port keeps in its AI, so only the first two offsets (one pair) are replayed.
      if (r.tick <= 200) near(s.hoverOffset, r.hover, 1e-6, `seed ${seed} tick ${r.tick} hover`);
      assert.equal(s.hoverDelay, r.delay, `seed ${seed} tick ${r.tick}`);
    }
  }
  for (const r of rows("blazeFall")) {
    const s = B.blazeState(), vy1 = B.blazeHover(s, new JavaRandom(r.seed), { y: 20, eye: 1.53, vy: -1 }, null, { onGround: false });
    near((vy1 - 0.08) * 0.98, r.vy, 1e-6, "fall damping");
  }
});

test("the ghast's wander, charge-up, warning and fire events replay the probe", () => {
  let fired = 0, warned = 0, held = null;
  for (const start of rows("ghastStart")) {
    const seed = start.seed, rand = new JavaRandom(seed), s = B.ghastState(), _reset = (held = null), me = { x: 64.5, y: 40, z: 64.5, vx: 0, vy: 0, vz: 0 };
    for (const r of rows("ghastAi").filter((x) => x.seed === seed)) {
      const player = r.tick >= 300 ? { x: 64.5, z: 74.5 } : r.tick >= 200 ? null : { x: 64.5, z: 84.5 }, aux = [];
      if (player) held = player; // the original keeps its target until it is dead or the 20 tick re-scan finds nobody
      if (r.tick === 300) held = player;
      const view = () => held && { x: held.x, minY: 40, z: held.z, height: f(1.8), distSq: (held.x - me.x) ** 2 + (40 - me.y) ** 2 + (held.z - me.z) ** 2 };
      const out = B.ghastStep(s, rand, me, {
        pathClear: () => true, findPlayer: () => (player && view().distSq < 10000 ? player : null), target: view, canSee: () => true,
        event: (id) => aux.push({ id, x: Math.floor(me.x), y: Math.floor(me.y), z: Math.floor(me.z) }),
      });
      const at = `seed ${seed} tick ${r.tick}`;
      assert.deepEqual([s.wx, s.wy, s.wz].map((v) => Math.fround(v)).map((v, i) => Math.abs(v - r.waypoint[i]) < 1e-3), [true, true, true], at + " waypoint");
      near(me.vx, r.vx, 1e-9, at + " vx");
      near(me.vy, r.vy, 1e-9, at + " vy");
      near(me.vz, r.vz, 1e-9, at + " vz");
      assert.equal(s.wander, r.wander, at);
      assert.equal(s.charge, r.charge, at);
      assert.equal(s.prevCharge, r.prevCharge, at);
      assert.equal(s.delay, r.targetDelay, at);
      assert.equal(s.hasTarget, r.hasTarget, at);
      assert.equal(out.charging, r.charging, at);
      near(out.yaw, r.yaw, 1e-3, at + " yaw");
      assert.deepEqual(aux, r.aux, at);
      assert.equal(out.fireball ? 1 : 0, r.spawned.length, at);
      warned += aux.filter((a) => a.id === 1007).length;
      if (out.fireball) {
        fired++;
        assert.equal(s.charge, -40, at);
        const look = B.lookVector(out.yaw, 0, mhSin, mhCos), sp = r.spawned[0];
        near(me.x + look[0] * 4, sp.x, 1e-4, at + " spawn x");
        near(me.y + f(B.GHAST.height / 2) + 0.5, sp.y, 1e-6, at + " spawn y");
        near(me.z + look[2] * 4, sp.z, 1e-4, at + " spawn z");
        const [ax, ay, az] = B.fireballAcceleration(out.fireball.dx, out.fireball.dy, out.fireball.dz);
        near(Math.hypot(ax, ay, az), 0.1, 1e-6, "aim norm");
      }
      // The probe stands in for sr.e: friction 0.91F, then the position moves.
      me.vx *= f(0.91); me.vy *= f(0.91); me.vz *= f(0.91);
      me.x += me.vx; me.y += me.vy; me.z += me.vz;
    }
  }
  assert.ok(fired > 0 && warned > 0, "the ghast fired and warned");
});

test("fireball flight, acceleration, deflection and impact constants replay the probe", () => {
  for (const start of rows("fireballStart")) {
    const b = { ...start.fireball };
    assert.equal(b.width, f(start.large ? B.FIREBALL.largeSize : B.FIREBALL.smallSize));
    near(Math.hypot(b.ax, b.ay, b.az), 0.1, 1e-6, "acceleration norm"); // the noise changes the direction, never the 0.1
    for (const r of rows("fireballFlight").filter((x) => x.large === start.large && x.seed === start.seed)) {
      B.fireballStep(b, false);
      for (const k of ["x", "y", "z", "vx", "vy", "vz"]) near(b[k], r.fireball[k], 1e-6, `${start.large} ${start.seed} tick ${r.tick} ${k}`);
    }
  }
  const explicit = rows("fireballExplicit")[0].fireball;
  const [ax, ay, az] = B.fireballAcceleration(3, 0, 4);
  near(ax, explicit.ax, 1e-12, "dispenser ax");
  near(ay, explicit.ay, 1e-12, "dispenser ay");
  near(az, explicit.az, 1e-12, "dispenser az");
  const hurt = rows("fireballHurt")[0], b = { ...hurt.fireball, vx: 0, vy: 0, vz: 0, ax: 0, ay: 0, az: 0 };
  B.deflect(b, [hurt.lookX, hurt.lookY, hurt.lookZ]);
  for (const k of ["vx", "vy", "vz", "ax", "ay", "az"]) near(b[k], hurt.fireball[k], 1e-12, "deflect " + k);
  assert.equal(hurt.ownerIsPlayer, true);
  // Impacts: the large ball explodes flaming with its power and hits for 6, the small hits for 5 and ignites unless the target is immune.
  const large = rows("largeImpact");
  assert.deepEqual(large.map((r) => r.explosions[0].power), [1, 3, 1]);
  assert.ok(large.every((r) => r.explosions[0].flaming && r.dead));
  assert.equal(large[2].damage, B.FIREBALL.largeDamage);
  const small = rows("smallImpact");
  assert.equal(small[0].damage, B.FIREBALL.smallDamage);
  assert.equal(small[0].burning, true);
  assert.equal(small[1].damage, 0);
  const props = rows("smallProps")[0];
  assert.equal(props.canBeCollidedWith, false);
  assert.equal(props.largeCanBeCollidedWith, true);
  assert.deepEqual(B.faceCell(5, 6, 7, 1), [5, 7, 7]);
  assert.deepEqual(B.faceCell(5, 6, 7, 4), [4, 6, 7]);
  const nbt = rows("nbt")[0];
  assert.equal(nbt.ghastDefault, B.FIREBALL.defaultPower);
  assert.equal(nbt.fireballDefault, B.FIREBALL.defaultPower);
  // EntityGhast.attackEntityFrom: the player's own deflected fireball kills it; ordinary hits do not.
  const [fire, plain] = rows("ghastHurt");
  assert.equal(fire.health, 0);
  assert.ok(plain.health > 0);
});
