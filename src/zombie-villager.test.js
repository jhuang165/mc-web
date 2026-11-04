import { test } from "node:test";
import assert from "node:assert/strict";
import { IRON_BARS } from "./world.js";
import { EntityWorld, setEntityRandom } from "./entities.js";
import { HARD, NORMAL, EASY, PEACEFUL } from "./difficulty.js";
import { JavaRandom } from "./lighting.js";
import { GOLDEN_APPLE, WEAKNESS, STRENGTH, NAUSEA, killConverts, startConversionTicks, conversionBoost, canCure, readZombieVillager, auxSound, remedySound } from "./zombie-villager.js";

const plain = () => {
  const cells = new Map();
  return {
    numericSeed: 1,
    cells,
    get: (x, y, z) => cells.get(`${x},${y},${z}`) ?? (y < 0 ? 1 : 0),
    getMeta: () => 0,
    set: (x, y, z, b) => { cells.set(`${x},${y},${z}`, b); },
    solid: (x, y, z) => (cells.get(`${x},${y},${z}`) ?? (y < 0 ? 1 : 0)) !== 0,
    surface: () => 0,
    spawn: () => ({ x: 64.5, y: 0, z: 64.5 }),
  };
};
const survival = { health: 20, creative: false, time: 18000, damage() {}, scaledDamage: () => true, count: () => 0 };
const player = { x: 110, y: 0, z: 110 }; // inside the 128-block despawn radius, outside the 40-block follow range
const fixed = (bool, float = 0.5) => ({ nextBoolean: () => bool, nextFloat: () => float, nextInt: (n) => n - 1 });
const apples = (n = 1) => { const s = { creative: false, n, count: () => s.n, take: () => { s.n--; return true; } }; return s; };

test("onKillEntity: Normal converts half the time, Hard always, Easy and Peaceful never", () => {
  assert.equal(killConverts(HARD, fixed(true)), true);
  assert.equal(killConverts(NORMAL, fixed(true)), false);
  assert.equal(killConverts(NORMAL, fixed(false)), true);
  assert.equal(killConverts(EASY, fixed(false)), false);
  assert.equal(killConverts(PEACEFUL, fixed(false)), false);
  let draws = 0;
  killConverts(HARD, { nextBoolean: () => { draws++; return true; } });
  assert.equal(draws, 0, "Hard draws nothing");
});

test("the cure timer is 3600 + nextInt(2401) and the boost counts iron bars", () => {
  assert.equal(startConversionTicks({ nextInt: (n) => (assert.equal(n, 2401), 7) }), 3607);
  const none = () => 0, rand = new JavaRandom(5);
  assert.equal(conversionBoost({ nextFloat: () => 0.5 }, none, 0, 0, 0), 1, "no scan above 0.01");
  const bars = (x, y, z) => (x >= 0 && x < 3 && y === 0 && z === 0 ? IRON_BARS : 0);
  let calls = 0;
  const lucky = { nextFloat: () => (calls++ === 0 ? 0 : 0.1) };
  assert.equal(conversionBoost(lucky, bars, 1.5, 0.2, 0.5), 4, "three bars, each below 0.3");
  let n = 0;
  const scan = { nextFloat: () => (n++ === 0 ? 0 : 0.9) };
  assert.equal(conversionBoost(scan, () => IRON_BARS, 0, 0, 0), 1);
  assert.equal(n, 1 + 14, "the scan stops after 14 blocks");
  assert.ok(rand);
});

test("a golden apple cures only a weakened zombie villager", () => {
  const z = { type: "zombie", villager: true, health: 20, effects: [{ id: WEAKNESS, duration: 100, amplifier: 0 }] };
  assert.equal(canCure(z, GOLDEN_APPLE, 0), true);
  assert.equal(canCure(z, GOLDEN_APPLE, 1), false, "the enchanted apple is a different stack");
  assert.equal(canCure({ ...z, villager: false }, GOLDEN_APPLE), false);
  assert.equal(canCure({ ...z, effects: [] }, GOLDEN_APPLE), false);
  assert.equal(canCure({ ...z, conversionTime: 100 }, GOLDEN_APPLE), false);
  assert.equal(canCure(z, 200), false);
  assert.deepEqual(readZombieVillager({ villager: true, conversionTime: 50 }), { villager: true, conversionTime: 50 });
  assert.deepEqual(readZombieVillager({ conversionTime: -1 }), { villager: false });
});

function arena(difficulty = HARD) {
  const w = plain();
  const ew = new EntityWorld(w, null, () => 0.5);
  ew.difficulty = difficulty;
  ew.isDaytime = () => true;
  ew.ai.deps.canSeeSky = () => false; // daylight stops spawns, a roof stops the burning
  return { w, ew };
}

test("a zombie hunts a villager, hits it for 3 and a Hard kill makes a zombie villager", () => {
  const { ew, w } = arena(HARD);
  const z = ew.create("zombie", 60.5, 0, 60.5), v = ew.create("villager", 64.5, 0, 60.5);
  ew.entities.push(z, v);
  v.health = 4;
  // A dead-end corridor along x at z = 60: the villager cannot outrun the zombie.
  for (let x = 58; x <= 67; x++) for (const y of [0, 1]) { w.set(x, y, 59, 1); w.set(x, y, 61, 1); }
  for (const y of [0, 1]) w.set(67, y, 60, 1);
  let hit = false, events = [];
  for (let t = 0; t < 1200; t++) {
    ew.tick(player, survival);
    events.push(...ew.events.splice(0));
    if (ew.entities.some((e) => e.type === "zombie" && e.villager)) { hit = true; break; }
  }
  assert.ok(hit, "the villager died and a second zombie took its place");
  assert.ok(!ew.entities.some((e) => e.type === "villager" && e.health > 0));
  const made = ew.entities.find((e) => e.type === "zombie" && e.villager);
  assert.equal(made.villager, true);
  assert.ok(events.some((e) => e.sound === "mob.zombie.infect" && e.volume === 2));
  assert.ok(ew.ai.brain(z).attackTarget === null || ew.ai.brain(z).attackTarget.e !== v || v.health <= 0);
});

test("on Normal the zombie's nextBoolean decides; on Easy a villager just dies", () => {
  for (const [difficulty, bool, converts] of [[NORMAL, false, true], [NORMAL, true, false], [EASY, false, false]]) {
    const { ew } = arena(difficulty);
    const z = ew.create("zombie", 60.5, 0, 60.5), v = ew.create("villager", 61.2, 0, 60.5);
    setEntityRandom(z, { ...new JavaRandom(3), nextBoolean: () => bool, nextFloat: () => 0.5, nextInt: () => 0, nextDouble: () => 0.5, nextGaussian: () => 0 });
    ew.entities.push(z, v);
    ew.attackEntityFrom(v, 100, { from: { x: z.x, z: z.z }, attacker: z, name: "mob", player: false });
    ew.tick(player, survival);
    assert.equal(ew.entities.filter((e) => e.type === "zombie" && e.villager).length, converts ? 1 : 0, `${difficulty} ${bool}`);
  }
});

test("a child villager makes a child zombie villager and a skeleton's kill converts nothing", () => {
  const { ew } = arena(HARD);
  const z = ew.create("zombie", 60.5, 0, 60.5), v = ew.create("villager", 61.2, 0, 60.5);
  v.growingAge = -24000;
  ew.entities.push(z, v);
  ew.attackEntityFrom(v, 100, { attacker: z, name: "mob", player: false });
  const made = ew.entities.find((e) => e !== z && e.type === "zombie");
  assert.ok(made.growingAge < 0, "a child zombie");
  const { ew: other } = arena(HARD);
  const w = other.create("villager", 5.5, 0, 5.5);
  other.entities.push(w);
  other.attackEntityFrom(w, 100, { attacker: "skeleton", name: "arrow", player: false });
  assert.ok(!other.entities.some((e) => e.type === "zombie"));
});

test("feeding a golden apple starts the cure; the timer ends in a villager with Nausea", () => {
  const { w, ew } = arena(HARD);
  const z = ew.create("zombie", 60.5, 0, 60.5);
  z.villager = true;
  z.effects = [{ id: WEAKNESS, duration: 1000, amplifier: 0 }];
  ew.entities.push(z);
  const s = apples();
  assert.equal(ew.cure(z, GOLDEN_APPLE, s), true);
  assert.equal(s.n, 0, "the apple is used");
  assert.ok(z.conversionTime >= 3600 && z.conversionTime <= 6000);
  assert.ok(!z.effects.some((x) => x.id === WEAKNESS));
  const strength = z.effects.find((x) => x.id === STRENGTH);
  assert.equal(strength.duration, z.conversionTime, "Strength lasts the cure");
  const first = ew.events.splice(0).find((e) => e.sound === "mob.zombie.remedy");
  assert.ok(first && first.volume >= 1 && first.volume < 2);
  assert.equal(ew.cure(z, GOLDEN_APPLE, apples()), false, "a second apple does nothing");
  // Four iron bars beside it speed the timer up.
  const before = z.conversionTime;
  z.conversionTime = 3;
  setEntityRandom(z, { nextFloat: () => 0, nextInt: () => 0, nextDouble: () => 0.5, nextGaussian: () => 0, nextBoolean: () => false });
  w.set(60, 0, 60, IRON_BARS); w.set(61, 0, 60, IRON_BARS); w.set(62, 0, 60, IRON_BARS);
  ew.tick(player, survival);
  const v = ew.entities.find((e) => e.type === "villager");
  assert.ok(v, "boost 4 finished a timer of 3");
  assert.ok(before > 0);
  assert.equal(v.defaultReputation, true);
  assert.ok(v.profession >= 0 && v.profession < 5);
  assert.ok(v.effects.some((x) => x.id === NAUSEA && x.duration > 190));
  assert.equal(z.health, 0);
  assert.ok(ew.events.some((e) => e.sound === "mob.zombie.unfect"));
  ew.tick(player, survival);
  assert.ok(!ew.entities.includes(z), "the zombie is gone");
});

test("creative keeps the apple and the cure state saves and loads", () => {
  const { w, ew } = arena(HARD);
  const z = ew.create("zombie", 60.5, 0, 60.5);
  z.villager = true;
  z.effects = [{ id: WEAKNESS, duration: 1000, amplifier: 0 }];
  ew.entities.push(z);
  const s = { creative: true, count: () => 0, take: () => assert.fail("not taken") };
  assert.equal(ew.cure(z, GOLDEN_APPLE, s), true);
  const back = new EntityWorld(w, JSON.parse(JSON.stringify(ew.serialize())), () => 0.5);
  const l = back.entities.find((e) => e.type === "zombie");
  assert.equal(l.villager, true);
  assert.equal(l.conversionTime, z.conversionTime);
  assert.equal(canCure(l, GOLDEN_APPLE), false);
});

test("a cured villager gives every known player +5 reputation once it finds a village", () => {
  const { ew } = arena(HARD);
  const v = ew.create("villager", 60.5, 0, 60.5);
  v.defaultReputation = true;
  ew.entities.push(v);
  const calls = [];
  const brain = ew.ai.brain(v);
  brain.village = null;
  const village = { center: [60, 0, 60], radius: 20, changeAllReputations: (d) => calls.push(d) };
  ew.villages.findNearestVillage = () => village;
  brain.randomTickDivider = 0;
  brain.updateAITick();
  brain.randomTickDivider = 0;
  brain.updateAITick();
  assert.deepEqual(calls, [5]);
});

test("sounds: the aux events sit at the block centre and the remedy at +0.5", () => {
  const r = new JavaRandom(1);
  const a = auxSound(1016, r, { x: 3.9, y: 4.1, z: -2.5 });
  assert.deepEqual(a.position, { x: 3.5, y: 4.5, z: -1.5 });
  assert.equal(a.volume, 2);
  const m = remedySound(new JavaRandom(1), { x: 1, y: 2, z: 3 });
  assert.deepEqual(m.position, { x: 1.5, y: 2.5, z: 3.5 });
});
