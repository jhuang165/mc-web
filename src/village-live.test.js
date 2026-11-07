import { test } from "node:test";
import assert from "node:assert/strict";
import { EntityWorld, setEntityRandom } from "./entities.js";
import { JavaRandom } from "./java-random.js";
import { WOODEN_DOOR, PUMPKIN, BLOCKS } from "./world.js";

// The live village systems on a double world: a flat plain with a row of doors, wooden roof-less so a door
// has sky on its outside only (canSeeSky hook), driving the real EntityWorld, brains and village collection.
const IRON = BLOCKS.findIndex((b) => b.name === "Iron block");
function plain(extra = new Map()) {
  const cells = extra;
  return {
    numericSeed: 1,
    cells,
    get: (x, y, z) => cells.get(`${x},${y},${z}`) ?? (y < 0 ? 1 : 0),
    getMeta: () => 1,
    set: (x, y, z, b) => { cells.set(`${x},${y},${z}`, b); },
    solid: (x, y, z) => (cells.get(`${x},${y},${z}`) ?? (y < 0 ? 1 : 0)) !== 0 && (cells.get(`${x},${y},${z}`) ?? 1) !== WOODEN_DOOR,
    surface: () => 0,
    spawn: () => ({ x: 64.5, y: 0, z: 64.5 }),
  };
}
const survival = { health: 20, creative: false, time: 6000, damage() {}, scaledDamage: () => true, count: () => 0 };
const player = { x: 200, y: 0, z: 200 };

function village() {
  const w = plain();
  for (let i = 0; i < 4; i++) { const x = 60 + i * 5; w.set(x, 0, 60, WOODEN_DOOR); w.set(x, 1, 60, WOODEN_DOOR); }
  const ew = new EntityWorld(w, null, () => 0.5);
  // Doors face along x: sky only on one side, the other (the house) is roofed.
  ew.ai.deps.canSeeSky = (x, y, z) => z < 60;
  ew.isDaytime = () => true;
  for (let i = 0; i < 5; i++) { const v = ew.create("villager", 62 + i, 0, 62); v.growingAge = 0; ew.entities.push(v); }
  return { w, ew };
}

test("villagers register their positions and the doors around them form a village", () => {
  const { ew } = village();
  for (let t = 0; t < 400; t++) ew.tick(player, survival);
  assert.equal(ew.villages.villages.length, 1);
  const v = ew.villages.villages[0];
  assert.ok(v.doors.length >= 1);
  assert.ok(v.numVillagers >= 1);
  const villager = ew.entities.find((e) => e.type === "villager");
  assert.ok(ew.ai.brain(villager).village, "the villager knows its village");
  assert.ok(villager.homeRadius > 0, "and gets a home area of 0.6 of the radius");
});

test("a pumpkin on an iron T becomes a player-created golem", () => {
  const w = plain();
  const ew = new EntityWorld(w, null, () => 0.5);
  for (const [x, y, z] of [[10, 0, 10], [10, 1, 10], [9, 1, 10], [11, 1, 10]]) w.set(x, y, z, IRON);
  w.set(10, 2, 10, PUMPKIN);
  const cells = ew.tryBuildIronGolem(10, 2, 10);
  assert.equal(cells.length, 5);
  for (const [x, y, z] of cells) assert.equal(w.get(x, y, z), 0);
  const g = ew.entities.find((e) => e.type === "iron_golem");
  assert.equal(g.playerCreated, true);
  assert.equal(g.health, 100);
});

test("an iron golem walks up to a monster and hits it for 7 to 21 with a fling", () => {
  const { ew } = village();
  for (let t = 0; t < 30; t++) ew.tick(player, survival);
  const g = ew.spawnIronGolem(66.5, 0, 64.5, false);
  const z = ew.create("zombie", 70.5, 0, 64.5);
  z.health = 20; z.noBurn = true;
  // ew.create rolls the zombie's armour (defaultGear, Math.random): a leather helmet and boots cut the minimum 7 hit
  // to 6.44, which made this test fail about 6% of runs. No armour here, and every Entity.rand is seeded.
  z.equipment = z.equipment?.map(() => null);
  ew.entities.forEach((e, i) => setEntityRandom(e, new JavaRandom(BigInt(1000 + i))));
  setEntityRandom(g, new JavaRandom(7n)); setEntityRandom(z, new JavaRandom(8n));
  ew.entities.push(z);
  let hit = false;
  for (let t = 0; t < 400 && !hit; t++) { ew.tick(player, survival); hit = z.health < 20 || z.health <= 0; }
  assert.ok(hit, "the golem reached and hit the zombie");
  assert.ok(20 - z.health >= 7 || z.health <= 0);
  assert.ok(g.attackTimer >= 0);
});

test("touching a monster retargets the golem on a 1 in 20 roll of its own Random, villagers never do", () => {
  const { ew } = village();
  const g = ew.spawnIronGolem(66.5, 0, 64.5, false), z = ew.create("zombie", 66.5, 0, 64.5), v = ew.create("villager", 66.5, 0, 64.5);
  ew.entities.push(z, v);
  setEntityRandom(g, new JavaRandom(5n));
  const mirror = new JavaRandom(5n);
  let expected = -1;
  for (let i = 0; i < 400 && expected < 0; i++) if (mirror.nextInt(20) === 0) expected = i;
  assert.ok(expected >= 0);
  // The zombie is the only IMob in the box (the villager is not): one nextInt(20) per push, retarget on the first 0.
  let at = -1;
  for (let i = 0; i < 400 && at < 0; i++) {
    ew.ai.brain(g).attackTarget = null;
    ew.push(g, { width: 1.4, height: 2.9 });
    if (ew.ai.brain(g).attackTarget === ew.ai.brain(z)) at = i;
  }
  assert.equal(at, expected);
  assert.notEqual(ew.ai.brain(g).attackTarget, ew.ai.brain(v));
});

test("a walking golem throws blockcrack dust of the block under its feet from its own Random", () => {
  const { ew } = village();
  const g = ew.spawnIronGolem(66.5, 0, 64.5, false), seen = [];
  ew.blockParticle = (...args) => seen.push(args);
  setEntityRandom(g, new JavaRandom(11n));
  g.vx = 0.1; g.vz = 0.1; g.attackTimer = 3; g.holdRose = 2;
  for (let i = 0; i < 60; i++) ew.golemTailTick(g);
  assert.ok(seen.length > 5 && seen.length < 20, "about 1 in 5 of 60 ticks: " + seen.length);
  assert.deepEqual([seen[0][0], seen[0][1]], [1, 1]);
  assert.equal([g.attackTimer, g.holdRose].join(), "0,0");
  ew.blockParticle = null;
  for (let i = 0; i < 10; i++) ew.golemTailTick(g); // no sink: still no error
});

test("a spawn egg of the villager class on a villager spawns a baby and uses the egg (EntityAgeable.interact)", async () => {
  const { eggOf } = await import("./spawn-eggs.js");
  const { ew } = village();
  const adult = ew.entities.find((e) => e.type === "villager"), cow = ew.create("cow", 70.5, 0, 64.5), moo = ew.create("mooshroom", 72.5, 0, 64.5);
  ew.entities.push(cow, moo);
  const taken = [], tank = (creative) => ({ creative, held: { id: 1950, damage: 120 }, take: (id) => taken.push(id) });
  const before = ew.entities.length;
  assert.equal(ew.spawnEggBaby(adult, tank(false), eggOf(120)) !== false, true);
  assert.equal(ew.entities.length, before + 1);
  const baby = ew.entities[ew.entities.length - 1];
  assert.equal(baby.type, "villager"); assert.equal(baby.growingAge, -24000);
  assert.deepEqual(taken, [1950]);
  assert.equal(ew.spawnEggBaby(adult, tank(true), eggOf(120)) !== false, true); // creative keeps the egg
  assert.deepEqual(taken, [1950]);
  assert.equal(ew.spawnEggBaby(adult, tank(false), eggOf(92)), false); // a cow egg on a villager spawns nothing
  assert.equal(ew.spawnEggBaby(moo, tank(false), eggOf(92)) !== false, true); // Cow is assignable from MushroomCow
  assert.equal(ew.entities[ew.entities.length - 1].type, "mooshroom");
  assert.equal(ew.spawnEggBaby(cow, tank(false), eggOf(96)), false); // a mooshroom egg does not fit a plain cow
});

test("a golem and the villages survive save and load", () => {
  const { ew } = village();
  for (let t = 0; t < 300; t++) ew.tick(player, survival);
  ew.spawnIronGolem(66.5, 0, 64.5, true);
  const saved = JSON.parse(JSON.stringify({ entities: ew.serialize(), villages: ew.villages.toJSON() }));
  const back = new EntityWorld(ew.world, saved.entities, () => 0.5);
  back.villages.loadJSON(saved.villages);
  const g = back.entities.find((e) => e.type === "iron_golem");
  assert.equal(g.playerCreated, true);
  assert.equal(back.villages.villages.length, 1);
  assert.deepEqual(back.villages.toJSON(), ew.villages.toJSON());
});

test("a villager hit by the player lowers the village's reputation of the player", () => {
  const { ew } = village();
  for (let t = 0; t < 400; t++) ew.tick(player, survival);
  const villager = ew.entities.find((e) => e.type === "villager"), v = ew.ai.brain(villager).village;
  assert.ok(v);
  ew.attackEntityFrom(villager, 1, { from: { x: 0, z: 0 }, player: true, name: "player" });
  assert.equal(v.playerReputation("Player"), -1);
});
