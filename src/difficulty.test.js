import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JavaRandom } from "./lighting.js";
import {
  scaleDamage, starvationHurts, hungerDrops, peacefulRegen, localDifficulty, InhabitedTime, difficultySetting,
  spiderSpawnRolls, zombieSpawnRolls, zombieReinforcement, zombieFireOnHit, maxSafePointTries, attributeValue, REINFORCEMENT_CHARGE, HARD,
} from "./difficulty.js";
import { addMobEffect, tickMobEffects, speedModifiers, attackDamage, isInvisible, readMobEffects } from "./mob-effects.js";
import { potionColor } from "./fx.js";
import { Survival } from "./survival.js";
import { EntityWorld, aiMoveSpeed } from "./entities.js";
import { creatureTypeOf } from "./spawn-lists.js";

// DifficultyProbe on the unchanged 1.7.10 classes; see tools/verify-difficulty.mjs.
const reference = JSON.parse(readFileSync(new URL("../public/research/difficulty-reference.json", import.meta.url)));
const records = (c) => reference.records.filter((r) => r.case === c);
const f = Math.fround;

test("difficulty setting defaults to Normal", () => {
  assert.equal(difficultySetting(undefined), 2);
  assert.equal(difficultySetting(3), 3);
  assert.equal(difficultySetting(4), 2);
  assert.equal(difficultySetting("1"), 2);
});

test("World.func_147462_b local difficulty", () => {
  const all = records("local");
  assert.equal(all.length, 256);
  for (const r of all) assert.equal(localDifficulty(r.difficulty, r.worldTime, r.inhabited, r.exists !== false), f(r.value), JSON.stringify(r));
});

test("EntityPlayer.attackEntityFrom scales mob melee and explosions only", () => {
  const scaled = new Set(["mob", "explosion", "creeperExplosion"]);
  for (const r of records("player")) {
    const amount = scaled.has(r.source) ? scaleDamage(r.difficulty, r.input) : r.input;
    if (amount === 0) assert.deepEqual(r.result, { applied: false }, JSON.stringify(r));
    else assert.equal(amount, r.result.amount, JSON.stringify(r));
  }
});

test("FoodStats starvation and Peaceful hunger", () => {
  for (const r of records("starve")) {
    const s = new Survival({ health: r.health, food: 0, saturation: 0 }, "survival");
    s.difficulty = r.difficulty;
    const trace = [];
    // FoodStats alone: no Peaceful regeneration and no hurt-resistance window between hits 80 ticks apart.
    for (let t = 0; t < 400; t++) {
      s.hurtTicks = Math.max(0, s.hurtTicks - 1);
      s.foodTick();
      if (t % 80 === 79) trace.push(s.health);
    }
    assert.deepEqual(trace, r.trace, JSON.stringify(r));
    assert.equal(starvationHurts(r.difficulty, r.health), r.trace[0] < r.health);
  }
  for (const r of records("exhaust")) {
    const s = new Survival({ health: 20, food: 10, saturation: r.saturationIn, exhaustion: 4.5 }, "survival");
    s.difficulty = r.difficulty;
    s.foodTick();
    assert.equal(hungerDrops(r.difficulty), r.difficulty !== 0);
    assert.deepEqual([s.food, s.saturation, s.exhaustion], [r.food, r.saturation, r.exhaustion], JSON.stringify(r));
  }
});

test("Peaceful regeneration heals every 20 ticks", () => {
  assert.equal(peacefulRegen(0, 40), true);
  assert.equal(peacefulRegen(0, 41), false);
  assert.equal(peacefulRegen(1, 40), false);
  const s = new Survival({ health: 10, food: 0, saturation: 0 }, "survival");
  s.difficulty = 0;
  for (let i = 0; i < 40; i++) s.tick();
  assert.equal(s.health, 12);
  assert.equal(s.food, 0);
});

test("EntitySpider.onSpawnWithEgg rolls the Hard group effect from World.rand", () => {
  const all = records("spider");
  assert.equal(all.length, 1800);
  let effects = 0;
  for (const r of all) {
    const world = new JavaRandom(r.worldSeed), rand = new JavaRandom(r.seed + 1000);
    const out = spiderSpawnRolls(rand, world, r.difficulty, f(r.local));
    assert.equal(out.jockey, r.jockey, `jockey ${r.seed}`);
    assert.equal(out.effect, r.effect, JSON.stringify(r));
    if (r.effect) {
      effects++;
      assert.equal(r.duration, 2147483647);
      assert.equal(r.amplifier, 0);
      assert.equal(r.difficulty, HARD);
    }
    assert.equal(world.nextInt(), r.worldNext, `world stream ${JSON.stringify(r)}`);
  }
  assert.ok(effects > 50);
});

test("mob potion effects: attributes, colour, regeneration and swirls", () => {
  for (const r of records("potion")) {
    const e = { type: "spider", x: r.x, y: r.y, z: r.z, health: 8 };
    addMobEffect(e, r.id, 2147483647, r.amplifier);
    assert.equal(attributeValue(f(0.8), speedModifiers(e)), r.speed, "speed");
    assert.equal(attackDamage(e, 2), f(r.damage), "damage");
    assert.equal(potionColor(e.effects), r.color, "colour");
    assert.equal(isInvisible(e), r.invisible);
    const rand = new JavaRandom(r.seed), spawned = [];
    const fx = { spawn: (name, ...v) => spawned.push([name, ...v]) };
    r.ticks.forEach(([health, ...swirls], t) => {
      spawned.length = 0;
      tickMobEffects(e, { width: f(1.4), height: f(0.9) }, 16, rand, fx);
      assert.equal(e.health, health, `health ${r.id}/${r.amplifier} tick ${t}`);
      assert.deepEqual(spawned, swirls, `swirls ${r.id}/${r.amplifier} tick ${t}`);
    });
    assert.equal(e.effects[0].duration, r.durationLeft);
    assert.deepEqual(readMobEffects(JSON.parse(JSON.stringify(e.effects))), e.effects);
  }
  assert.deepEqual(readMobEffects([{ id: 99, duration: 5 }, { id: 1, duration: 0 }, { id: 5, duration: 9, amplifier: 300 }]), [{ id: 1, duration: 0, amplifier: 0 }, { id: 5, duration: 9, amplifier: 255 }]); // a spent effect is kept by a load (executed b54import) and removed by the first update
});

test("EntityZombie.attackEntityAsMob sets the target on fire by difficulty", () => {
  for (const r of records("zombieHit")) {
    const rand = new JavaRandom(r.seed);
    assert.equal(r.hit, true);
    assert.equal(zombieFireOnHit(rand, r.difficulty, r.burning), r.targetFire, JSON.stringify(r));
    assert.equal(rand.nextInt(), r.randNext);
  }
});

test("EntityZombie.onSpawnWithEgg rolls in the original order", () => {
  const all = records("zombieSpawn");
  assert.equal(all.length, 2400);
  let checked = 0, leaders = 0, children = 0;
  for (const r of all) {
    const world = new JavaRandom(r.worldSeed), rand = new JavaRandom(r.seed);
    const out = zombieSpawnRolls(rand, world, r.difficulty, f(r.local));
    const at = JSON.stringify(r);
    assert.deepEqual([out.loot, out.child, out.villager], [r.loot, r.child, r.villager], at);
    assert.equal(world.nextInt(), r.worldNext, `world stream ${at}`);
    assert.deepEqual(out.equipment, r.equipment, at);
    assert.equal(out.doors, r.doors, at);
    assert.equal(out.knockback, r.knockback, at);
    assert.equal(out.followRange, r.followRange, at);
    assert.equal(out.reinforcementBonus, r.reinforcement, at);
    assert.equal(out.maxHealth, r.maxHealth, at);
    assert.equal(rand.nextInt(), r.randNext, `entity stream ${at}`);
    checked++;
    leaders += out.leader;
    children += out.child;
  }
  assert.ok(checked === 2400 && leaders > 20 && children > 100, `${checked} ${leaders} ${children}`);
});

test("Hard zombie reinforcements search 50 spots", () => {
  let spawned = 0;
  for (const r of records("reinforce")) {
    const rand = new JavaRandom(r.seed);
    // EntityLivingBase.attackEntityFrom before EntityZombie's part: setBeenAttacked's and
    // knockBack's rand.nextDouble() against knockback resistance, then the hurt sound's pitch.
    rand.nextDouble(); rand.nextDouble(); rand.nextFloat(); rand.nextFloat();
    const place = { solidTop: (x, y) => y < 0, light: () => r.light, fits: (x, y) => y >= 0 };
    const spot = zombieReinforcement(rand, r.difficulty, r.chance, 4.5, 0, -7.5, place);
    const at = JSON.stringify(r);
    if (r.spawned) {
      spawned++;
      assert.deepEqual([spot.x, spot.y, spot.z], r.spawned.slice(0, 3), at);
      assert.equal(r.spawned[3], true);
      assert.equal(r.chance + REINFORCEMENT_CHARGE, r.callerChance, at);
    } else {
      assert.equal(spot, null, at);
      assert.equal(r.callerChance, r.chance, at);
    }
    assert.equal(rand.nextInt(), r.randNext, `entity stream ${at}`);
  }
  assert.ok(spawned > 50);
});

test("getMaxSafePointTries by difficulty", () => {
  assert.equal(maxSafePointTries(false, 20, 20, 3), 3);
  // (int)(20 - 6.6) = 13; Normal - 4, Hard - 0, Peaceful - 12.
  assert.equal(maxSafePointTries(true, 20, 20, 2), 12);
  assert.equal(maxSafePointTries(true, 20, 20, 3), 16);
  assert.equal(maxSafePointTries(true, 20, 20, 0), 4);
  assert.equal(maxSafePointTries(true, 5, 20, 1), 3);
});

test("inhabited time follows PlayerManager's 8000-tick passes", () => {
  const t = new InhabitedTime(100, 5000);
  for (let now = 5001; now <= 9000; now++) t.tick(now);
  // The first pass (8001 - 0 > 8000) adds the 3001 ticks since joining.
  assert.equal(t.value, 3101);
  for (let now = 9001; now <= 16001; now++) t.tick(now);
  assert.equal(t.value, 3101);
  t.tick(16002);
  assert.equal(t.value, 100 + 16002 - 5000);
  assert.equal(t.save(17000), 100 + 17000 - 5000);
});

// The wiring in entities.js, on a flat world with a grass floor at y = 0.
const flat = { numericSeed: 1, solid: (x, y, z) => y < 1, get: (x, y, z) => (y < 1 ? 1 : 0), surface: () => 1, spawn: () => ({ x: 64.5, y: 1, z: 64.5 }) };
const world = (list) => new EntityWorld(flat, list.map((m, i) => ({ id: `mob-${i + 1}`, health: 20, ...m })));
const night = { health: 20, creative: false, time: 18000, damage() {}, scaledDamage() {}, count: () => 0 };

test("Peaceful removes monsters at once and spawns none", () => {
  const w = world([{ type: "zombie", x: 64, y: 1, z: 64 }, { type: "cow", x: 70, y: 1, z: 64, health: 10 }]);
  w.difficulty = 0;
  w.naturalSpawning = true;
  const events = [];
  for (let i = 0; i < 400; i++) { w.tick({ x: 64, y: 1, z: 70 }, night); events.push(...w.drain()); }
  // SpawnerAnimals runs with spawnHostileMobs false: creatures (and water and ambient mobs) still spawn on Peaceful.
  assert.deepEqual(w.entities.filter((e) => creatureTypeOf(e.type) === "monster"), []);
  assert.ok(w.entities.some((e) => e.type === "cow" && e.id === "mob-2"));
  assert.ok(w.entities.some((e) => e.id !== "mob-2" && creatureTypeOf(e.type) === "creature"), "animals spawn on Peaceful");
  assert.ok(!events.some((e) => e.drop || e.xp), "no drops or experience");
});

test("mob hits go through the player's difficulty scaling, with Strength", () => {
  for (const d of [0, 1, 2, 3]) {
    const w = world([{ type: "spider", x: 64, y: 1, z: 64, effects: [{ id: 5, duration: 100, amplifier: 0 }] }]);
    w.difficulty = d;
    const s = new Survival({ health: 20 }, "survival");
    s.difficulty = d;
    const hit = w.hitPlayer(w.entities[0], s), amount = scaleDamage(d, f(4.6));
    assert.equal(hit, amount > 0);
    assert.ok(Math.abs(s.health - (20 - amount)) < 1e-5, `${d}: ${s.health}`);
  }
});

test("Speed raises the mob's AI move speed; saved effects are validated", () => {
  const w = world([{ type: "spider", x: 64, y: 1, z: 64, effects: [{ id: 1, duration: 50, amplifier: 0 }, { id: 99, duration: 5 }] }]);
  const e = w.entities[0];
  assert.deepEqual(e.effects, [{ id: 1, duration: 50, amplifier: 0 }]);
  assert.equal(aiMoveSpeed(e, 1), f(attributeValue(f(0.8), [[0.20000000298023224, 2]])));
  e.effects = [];
  assert.equal(aiMoveSpeed(e, 1), f(0.8));
});

test("a struck zombie calls a reinforcement on Hard only", () => {
  for (const d of [2, 3]) {
    const w = world([{ type: "zombie", x: 64.5, y: 1, z: 64.5, reinforcement: 1 }]);
    w.difficulty = d;
    w.lightAt = () => 0;
    w.ai.beginTick({ x: 64.5, y: 1, z: 66 }, night, 0);
    const z = w.entities[0];
    assert.ok(w.damage(z, 1, 64.5, 66));
    if (d === 2) { assert.equal(w.entities.length, 1); continue; }
    assert.equal(w.entities.length, 2);
    const help = w.entities[1];
    assert.equal(help.type, "zombie");
    assert.ok(Number.isInteger(help.x) && help.y === 1 && Number.isInteger(help.z));
    assert.equal(w.ai.brain(help).attackTarget, w.ai.player);
    assert.equal(z.reinforcement, 1 + REINFORCEMENT_CHARGE);
  }
});
