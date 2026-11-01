import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { EntityWorld, ENTITY_TYPES, setEntityRandom, entityRandom, pushBox, FEATHER, RAW_CHICKEN, COOKED_CHICKEN } from "./entities.js";
import { armorReduced, applyEntityCollision } from "./combat.js";
import { splitExperience } from "./experience.js";
import { JavaRandom } from "./lighting.js";
import { WOOL } from "./world.js";
import { CARROT, POTATO } from "./crops.js";
import { STRING, SPIDER_EYE } from "./spider.js";
import { GUNPOWDER } from "./creeper.js";

const f = Math.fround;
const reference = JSON.parse(readFileSync(new URL("../public/research/combat-reference.json", import.meta.url)));
const records = (c) => reference.records.filter((r) => r.case === c);
const flat = { numericSeed: 1, solid: (x, y) => y < 0, get: (x, y) => (y < 0 ? 1 : 0), surface: () => 0, spawn: () => ({ x: 64.5, y: 0, z: 64.5 }) };
// Original item ids to this build's; records (2256-2267) do not exist here.
const ITEM = { 319: 202, 320: 203, 363: 204, 364: 205, 334: 315, 288: FEATHER, 365: RAW_CHICKEN, 366: COOKED_CHICKEN, 367: 206, 262: 320, 352: 311, 261: 127, 287: STRING, 375: SPIDER_EYE, 289: GUNPOWDER, 35: WOOL, 265: 302, 391: CARROT, 392: POTATO };
const size = (type, child) => {
  const t = ENTITY_TYPES[type], s = child ? 0.5 : 1;
  return { width: t.width * s, height: t.height * s };
};

test("the reference was recorded from the unchanged 1.7.10 client", () => {
  assert.equal(reference.clientSha1, "e80d9b3bf5085002218d4be59e668bac718abbc6");
  assert.deepEqual(Object.fromEntries(["pushable", "push", "hurt", "split"].map((c) => [c, records(c).length])), { pushable: 8, push: 96, hurt: 1008, split: 1 });
});

test("EntityXPOrb.getXPSplit as onDeathUpdate drops the orbs", () => {
  for (const [value, first] of records("split")[0].values) assert.equal(splitExperience(value)[0], first, `${value}`);
});

test("Entity.canBePushed: living mobs and the player, not dead mobs, items, orbs, arrows, TNT or falling blocks", () => {
  const value = Object.fromEntries(records("pushable").map((r) => [r.kind, r.value]));
  assert.deepEqual(value, { zombie: true, deadZombie: false, player: true, item: false, xpOrb: false, arrow: false, tnt: false, falling: false });
});

test("collideWithNearbyEntities / applyEntityCollision match the original motions exactly", () => {
  let moved = 0;
  for (const r of records("push")) {
    const w = new EntityWorld(flat, []);
    w.ai.player.alive = false;
    const a = w.create(r.a, 3.5, 0, -2.25), b = w.create(r.b, 3.5 + r.offset[0], r.offset[1], -2.25 + r.offset[2]);
    Object.assign(a, { vx: 0.01, vy: 0, vz: -0.02 });
    Object.assign(b, { vx: 0, vy: -0.0784, vz: 0 });
    if (r.bDead) Object.assign(b, { health: 0, death: 20 });
    w.entities.push(a, b);
    const at = JSON.stringify(r);
    assert.deepEqual([pushBox(a, ...w.size(a))[0], pushBox(a, ...w.size(a))[3]], r.aBox, at);
    assert.deepEqual([pushBox(b, ...w.size(b))[0], pushBox(b, ...w.size(b))[3]], r.bBox, at);
    w.push(a, size(r.a, false));
    assert.deepEqual([a.vx, a.vy, a.vz], r.aMotion, at);
    assert.deepEqual([b.vx, b.vy, b.vz], r.bMotion, at);
    if (r.aMotion[0] !== 0.01) moved++;
  }
  assert.ok(moved > 20, `${moved}`);
});

test("a mob beside the player is pushed away, and the player is not", () => {
  const w = new EntityWorld(flat, []), z = w.create("zombie", 64.5, 0, 64.5);
  w.entities.push(z);
  Object.assign(w.ai.player, { x: 64.9, y: 0, z: 64.5, alive: true });
  w.push(z, size("zombie", false));
  assert.ok(z.vx < 0);
  assert.equal(w.ai.player.vx, undefined);
  // Within 0.01 on both axes nothing moves.
  const same = { x: 1, z: 1, vx: 0, vz: 0 }, other = { x: 1.005, z: 1.009, vx: 0, vz: 0 };
  applyEntityCollision(same, other);
  assert.deepEqual([same.vx, other.vx], [0, 0]);
});

test("the zombie's 2 armour points: melee, arrows, lava and fire blocks are cut to 23/25, falls, burning and drowning are not", () => {
  assert.equal(armorReduced("zombie", 4, "player"), f(f(4 * 23) / 25));
  assert.equal(armorReduced("zombie", 4, "lava"), f(3.68));
  assert.equal(armorReduced("zombie", 4, "inFire"), f(3.68));
  for (const name of ["fall", "onFire", "drown", "generic"]) assert.equal(armorReduced("zombie", 4, name), 4);
  assert.equal(armorReduced("pig", 4, "player"), 4);
});

// EntityLivingBase.attackEntityFrom, onDeath and onDeathUpdate replayed on the seeded streams.
const source = { fire: "onFire" };
test("attackEntityFrom, the drops and the death experience match the original step for step", () => {
  const seen = { sounds: 0, drops: 0, xp: 0, topUps: 0, refused: 0, knockback: 0 };
  for (const r of records("hurt")) {
    const at = `${r.type}${r.child ? " child" : ""} scenario ${r.scenario} seed ${r.seed}`;
    const w = new EntityWorld(flat, []);
    w.fx = { spawn() {} };
    w.worldRandom = new JavaRandom(r.worldSeed);
    const e = w.create(r.type, 8.5, 0, -4.5);
    if (r.child) e.growingAge = -24000;
    if (r.type === "sheep") Object.assign(e, { color: r.color, sheared: r.sheared });
    // The probe's mobs skip onSpawnWithEgg (the zombie's random knockback bonus).
    e.knockbackResistance = r.type === "zombie" && r.scenario === 4 ? 0.5 : 0;
    e.fire = r.burning ? 160 : 0;
    w.entities.push(e);
    setEntityRandom(e, new JavaRandom(r.seed));
    for (const s of r.steps) {
      const [name, amount, ticks] = s.step.split(":");
      for (let t = 0; t < +ticks; t++) {
        e.hurt = Math.max(0, e.hurt - 1);
        if (e.recentlyHit > 0) e.recentlyHit--;
      }
      Object.assign(e, { vx: 0, vy: 0, vz: 0 });
      w.drain();
      const hit =
        name === "player" ? w.damage(e, f(+amount), 10.5, -4.0, true)
        : name === "mob" ? w.damage(e, f(+amount), 10.5, -4.0, false, "zombie")
        : name === "skelArrow" ? w.damage(e, f(+amount), 10.5, -4.0, false, "skeleton")
        : w.hazard(e, f(+amount), source[name] ?? name);
      const events = w.drain(), step = `${at} ${s.step}`;
      assert.equal(hit, s.hit, step);
      assert.equal(e.health, f(s.health), step);
      assert.deepEqual([e.vx, e.vy, e.vz], s.motion, step);
      assert.equal(e.limbSwingAmount, s.limb, step);
      assert.equal(e.hurt, s.hurtTime, step);
      assert.equal(e.hurt > 0 ? e.hurt + 10 : s.resist <= 10, e.hurt > 0 ? s.resist : true, step);
      assert.equal(e.lastDamage, f(s.lastDamage), step);
      assert.equal(e.recentlyHit, s.recentlyHit, step);
      const sounds = events.filter((x) => x.sound).map((x) => [x.sound, x.volume, x.pitch]);
      assert.deepEqual(sounds, s.sounds.map((x) => x.split("|")).map(([n, v, p]) => [n, f(+v), f(+p)]), step);
      const drops = events.filter((x) => x.drop).map((x) => [x.drop, x.count, x.damage || 0]);
      assert.deepEqual(drops, s.drops.filter((d) => d[0] < 2256).map(([id, n, d]) => [ITEM[id], n, d]), step);
      seen.sounds += sounds.length;
      seen.drops += drops.length;
      seen.topUps += s.hit && !sounds.length;
      seen.refused += !s.hit;
      seen.knockback += s.motion[1] > 0;
    }
    if (r.death) {
      const t = size(r.type, r.child), xp = [];
      for (let i = 0; i < 20; i++) {
        w.deathUpdate(e, t);
        for (const x of w.drain()) if (x.xp) xp.push(...splitExperience(x.xp));
        if (e.recentlyHit > 0) e.recentlyHit--;
      }
      assert.deepEqual(xp, r.death.xp, at);
      assert.equal(e.death, 20, at);
      seen.xp += xp.length > 0;
    } else assert.ok(e.health > 0, at);
    assert.equal(entityRandom(e).nextInt(), r.randNext, `Entity.rand after ${at}`);
    assert.equal(w.worldRandom.nextInt(), r.worldNext, `World.rand after ${at}`);
  }
  for (const [k, n] of Object.entries(seen)) assert.ok(n > 50, `${k} ${n}`);
});

test("a mob the fire kills counts its first death tick in the same update and drops cooked meat, without experience", () => {
  const w = new EntityWorld(flat, []), survival = { health: 20, creative: false, time: 18000, damage() {}, scaledDamage() {}, count: () => 0 };
  const pig = w.create("pig", 64.5, 0, 64.5);
  w.entities.push(pig);
  pig.health = 1;
  pig.fire = 20;
  w.tick({ x: 80, y: 0, z: 80 }, survival);
  assert.equal(pig.health, 0);
  assert.equal(pig.death, 1);
  const events = w.drain();
  assert.ok(events.some((x) => x.sound === "mob.pig.death"));
  // Still burning (isBurning): cooked porkchops. No player hit: no experience at deathTime 20.
  assert.ok(events.some((x) => x.drop === 203) && !events.some((x) => x.drop === 202));
  for (let i = 0; i < 19; i++) w.tick({ x: 80, y: 0, z: 80 }, survival);
  assert.ok(!w.drain().some((x) => x.xp));
  assert.equal(w.entities.includes(pig), false);
});
