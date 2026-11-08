import test from "node:test";
import assert from "node:assert/strict";
import { JavaRandom } from "./lighting.js";
import { EntityWorld } from "./entities.js";
import { Survival } from "./survival.js";
import { revengeOf } from "./revenge-target.js";

// EntityLivingBase.attackEntityFrom sets the revenge target (getAITarget) for any living DamageSource entity; EntityAIHurtByTarget (priority 1 in
// EntityMob, EntityIronGolem, EntitySkeleton) turns it into the attack target. Native rows: public/research/village-fight-reference.json.
const flat = () => ({ numericSeed: 1, height: 256, get: (x, y) => (y < 0 ? 1 : 0), getMeta: () => 0, set() {}, solid: (x, y) => y < 0, surface: () => 1, spawn: () => ({ x: 5.5, y: 0, z: 5.5 }) });
function setup(types) {
  const ew = new EntityWorld(flat(), [], () => 0.5);
  ew.difficulty = 2;
  ew.worldRandom = new JavaRandom(7);
  ew.isDaytime = () => false;
  ew.lightAt = () => 15;
  const mobs = types.map(([type, x, z]) => { const e = ew.create(type, x, 0, z); e.onGround = true; ew.entities.push(e); return e; });
  const survival = new Survival({}, "survival");
  survival.difficulty = 2; survival.health = 1000;
  const player = { x: 10.5, y: 0, z: 90, health: 1000, alive: true, isPlayer: true };
  const tick = (n = 1) => { for (let i = 0; i < n; i++) { ew.ai.beginTick(player, survival, 0); ew.tick(player, survival, 0); survival.health = 1000; } };
  return { ew, mobs, tick };
}
const mob = (by) => ({ from: { x: by.x, z: by.z }, attacker: by, name: "mob", player: false });
const arrow = (by) => ({ from: { x: by.x, z: by.z }, attacker: by, shooter: by, name: "arrow", player: false });

test("a zombie hit by an iron golem retaliates against it", () => {
  const { ew, mobs: [zombie, golem], tick } = setup([["zombie", 10.5, 10.5], ["iron_golem", 12.5, 10.5]]);
  assert.ok(ew.attackEntityFrom(zombie, 3, mob(golem)));
  assert.equal(revengeOf(zombie), golem);
  tick(4);
  assert.equal(ew.ai.brain(zombie).attackTarget?.e, golem);
});

test("a skeleton arrow that hits a zombie or another skeleton makes the victim target the shooter", () => {
  const { ew, mobs: [shooter, zombie, other], tick } = setup([["skeleton", 10.5, 10.5], ["zombie", 14.5, 10.5], ["skeleton", 10.5, 14.5]]);
  assert.ok(ew.attackEntityFrom(zombie, 2, arrow(shooter)));
  assert.ok(ew.attackEntityFrom(other, 2, arrow(shooter)));
  assert.equal(revengeOf(zombie), shooter);
  assert.equal(revengeOf(other), shooter);
  tick(4);
  assert.equal(ew.ai.brain(zombie).attackTarget?.e, shooter);
  assert.equal(ew.ai.brain(other).attackTarget?.e, shooter);
});

test("the revenge target lapses after 100 ticks and when its mob dies", () => {
  const { ew, mobs: [zombie, golem], tick } = setup([["zombie", 10.5, 10.5], ["iron_golem", 12.5, 10.5]]);
  ew.attackEntityFrom(zombie, 1, mob(golem));
  tick(1);
  assert.ok(zombie.revenge);
  golem.health = 0;
  tick(2);
  assert.ok(!zombie.revenge, "dead attacker clears the revenge target");
  const z2 = setup([["zombie", 10.5, 10.5], ["iron_golem", 12.5, 10.5]]);
  z2.ew.attackEntityFrom(z2.mobs[0], 1, mob(z2.mobs[1]));
  z2.mobs[1].x = 60.5; // out of the golem's reach, so only the timer ends it
  z2.tick(98);
  assert.ok(z2.mobs[0].revenge);
  z2.tick(5);
  assert.ok(!z2.mobs[0].revenge, "100 ticks after the hit it clears");
});

test("a damage source without a living entity sets no revenge target", () => {
  const { ew, mobs: [zombie] } = setup([["zombie", 10.5, 10.5]]);
  ew.attackEntityFrom(zombie, 1, { name: "fall", player: false });
  assert.ok(!zombie.revenge);
});

test("a skeleton's combat task follows its held item (EntitySkeleton.setCombatTask): a bow shoots, an empty hand or a sword closes in", () => {
  const { ew, mobs: [s], tick } = setup([["skeleton", 10.5, 10.5]]);
  const kind = () => ew.ai.brain(s).combatTask?.constructor.name;
  s.equipment = [null, null, null, null, null];
  tick(1);
  const melee = kind();
  s.equipment = [{ id: 261, count: 1, damage: 0 }, null, null, null, null];
  tick(1);
  const bow = kind();
  assert.notEqual(bow, melee);
  s.equipment = [{ id: 272, count: 1, damage: 0 }, null, null, null, null];
  tick(1);
  assert.equal(kind(), melee);
  // the combat task stays the last entry (priority 4 added after Wander and the look tasks) after every swap
  assert.equal(ew.ai.brain(s).tasks.entries.at(-1).action, ew.ai.brain(s).combatTask);
  assert.equal(ew.ai.brain(s).tasks.entries.filter((x) => x.priority === 4).length, 1);
});
