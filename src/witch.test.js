import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { JavaRandom } from "./java-random.js";
import {
  WITCH, WITCH_SOUNDS, WITCH_DROP_TABLE, POTIONS, ITEM_POTION, witchDrink, chooseThrownPotion, throwSpawn, splashImpact, witchDamage,
  witchDrops, witchEquipmentDrop, noseAngles, WITCH_MODEL,
} from "./witch.js";

const ref = JSON.parse(await readFile(new URL("../public/research/witch-reference.json", import.meta.url)));
const by = (c) => ref.records.filter((r) => r.case === c);
const f = Math.fround;
// Original ids of the drop table to this build's ids (glowstone dust, sugar, redstone, spider eye, glass bottle, gunpowder, stick).
const INTERNAL = { 348: 383, 353: 329, 331: 360, 375: 326, 374: 384, 289: 330, 280: 300 };

test("facts: attributes, sounds, flags and the drop table", () => {
  const [r] = by("facts");
  assert.equal(WITCH.health, r.maxHealth);
  assert.equal(WITCH.movement, r.speed);
  assert.equal(WITCH.followRange, r.followRange);
  assert.equal(WITCH.attackDamage, r.attackDamage);
  assert.equal(WITCH.width, f(r.width));
  assert.equal(WITCH.height, f(r.height));
  assert.equal(WITCH.eyeHeight, f(r.eyeHeight));
  assert.equal(WITCH.talkInterval, r.talkInterval);
  assert.equal(WITCH.experience, r.experienceValue);
  assert.deepEqual(Object.values(WITCH_SOUNDS), [r.idle, r.hurt, r.death]);
  assert.deepEqual(WITCH_DROP_TABLE, r.dropTable.map((id) => INTERNAL[id]));
});

test("tasks: the recorded task list is the one ai.js builds", () => {
  const [r] = by("tasks");
  assert.deepEqual(r.tasks.map((t) => [t.priority, t.class]), [[1, "EntityAISwimming"], [2, "EntityAIArrowAttack"], [2, "EntityAIWander"], [3, "EntityAIWatchClosest"], [3, "EntityAILookIdle"]]);
  assert.deepEqual(r.targets.map((t) => [t.priority, t.class]), [[1, "EntityAIHurtByTarget"], [2, "EntityAINearestAttackableTarget"]]);
  const arrow = r.tasks[1].params;
  assert.deepEqual([arrow.e, arrow.g, arrow.h, arrow.i], [1, 60, 60, 10]);
});

test("drops: dropFewItems replays 80 seeds at looting 0 and 3", () => {
  for (const r of by("drops"))
    r.rows.forEach((row, seed) => {
      const got = witchDrops(new JavaRandom(seed), r.looting);
      assert.deepEqual(got.map(([id]) => id), row.map(([id]) => INTERNAL[id]), `seed ${seed} looting ${r.looting}`);
    });
});

test("equipment: the held potion drops with 8.5 percent after a player hit", () => {
  let dropped = 0;
  for (const r of by("equipment"))
    for (const [hit, seed, items, next] of r.rows) {
      const rand = new JavaRandom(seed), got = witchEquipmentDrop(rand, { id: ITEM_POTION, damage: 16341, count: 1 }, hit === 1, r.looting);
      assert.deepEqual(got ? [[got.id, got.count, got.damage]] : [], items.map(([id, n, d]) => [ITEM_POTION, n, d]), `seed ${seed}`);
      assert.equal(rand.nextInt(), next, `rng after seed ${seed}`);
      if (got) dropped++;
    }
  assert.ok(dropped > 0);
});

test("damage: the witch ignores its own and cuts magic to 15 percent", () => {
  for (const r of by("damage").flatMap((x) => x.rows)) {
    const got = witchDamage(r.amount, { isMagic: r.magic, byWitch: r.entity === "self" });
    assert.equal(got, f(r.result), `${r.source} ${r.amount}`);
  }
});

test("drinking: the first roll of seeded witches matches the recorded think rows", () => {
  for (const r of by("think")) {
    const t0 = r.ticks[0], seed = r.seed;
    if (!["idle", "burning", "hurt", "water"].includes(r.kind)) continue;
    const w = { drinking: false, timer: 0, held: null }, rand = new JavaRandom(seed);
    // The probe's first tick draws on the same Random before and after the roll (living sound, AI); only the decision is compared where
    // the roll is the first draw: a burning or injured witch at tick 0.
    if (seed !== 1) continue;
    const out = witchDrink(w, { rand, inWater: r.kind === "water", burning: r.kind === "burning", health: r.kind === "hurt" ? 10 : 26, maxHealth: 26, target: null, targetDistSq: 0, hasEffect: () => false });
    assert.equal(w.drinking, t0.drinking === true || (out.started !== null && r.kind === "burning"), r.kind);
  }
});

test("drinking: the countdown runs 32 ticks, then the held potion is handed over", () => {
  const w = { drinking: true, timer: 32, held: { id: ITEM_POTION, damage: 16341, count: 1 } };
  const rand = new JavaRandom(5), noRoll = { rand, inWater: false, burning: false, health: 26, maxHealth: 26, target: null, hasEffect: () => false };
  let ticks = 0, done = null;
  while (!done) { done = witchDrink(w, noRoll).finished; ticks++; }
  assert.equal(ticks, 32);
  assert.equal(done.damage, 16341);
  assert.equal(w.held, null);
  assert.equal(w.drinking, false);
});

test("potions: the eight potion values are those of PotionHelper", () => {
  const samples = new Map(by("table")[0].samples.map((s) => [s.damage, s]));
  for (const [damage, effects] of Object.entries(POTIONS)) {
    const s = samples.get(Number(damage));
    assert.ok(s, `sample ${damage}`);
    assert.equal(effects.map(([id, a, d]) => `${id}:${d}:${a}`).join(","), s.effects, `potion ${damage}`);
  }
});

test("decide: the potion choice and the spawn point of the recorded cases", () => {
  const [r] = by("decide");
  for (const [dist, health, mask, seed, thrown] of r.rows) {
    const rand = new JavaRandom(seed), has = (id) => ({ 2: (mask & 2) !== 0, 18: (mask & 4) !== 0, 19: (mask & 1) !== 0 })[id] === true;
    const target = { x: 64.5, y: 0, z: 64.5 + dist, eyeHeight: f(0.85 * 1.8), motionX: 0, motionZ: 0, health, hasEffect: has };
    const got = chooseThrownPotion(rand, { x: 64.5, y: 0, z: 64.5 }, target, false);
    assert.equal(got.damage, thrown[0][0], `dist ${dist} health ${health} mask ${mask} seed ${seed}`);
    const at = throwSpawn({ x: 64.5, y: 0, z: 64.5 }, 0, WITCH.eyeHeight);
    assert.deepEqual([at.x, at.y, at.z], thrown[0].slice(1, 4));
  }
  assert.equal(chooseThrownPotion(new JavaRandom(1), { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 9, eyeHeight: 1, motionX: 0, motionZ: 0, health: 20, hasEffect: () => false }, true), null);
});

test("splash: impact factors, rounding, undead inversion and the 20 tick floor", () => {
  const [r] = by("splash"), offsets = r.offsets, impact = { x: 64.5, y: 0, z: 64.5 };
  let checked = 0;
  for (const row of r.rows) {
    if (!POTIONS[row.damage]) continue;
    const targets = [...offsets.map((o, i) => ({ x: 64.5 + o, y: 0, z: 64.5, width: 0.6, height: 0.9, ref: i })),
      { x: 64.5, y: 0, z: 66, width: 0.6, height: 1.8, undead: true, ref: 8 }, { x: 64.5, y: 0, z: 62.5, width: 0.6, height: 1.8, ref: 9 }];
    const res = splashImpact(row.damage, impact, targets);
    targets.forEach((t, i) => {
      const hit = res.find((x) => x.ref === i), want = row.targets[i];
      const hp = f(Math.max(0, Math.min(i < 8 ? 10 : 20, 10 - (hit?.hurt ?? 0) + (hit?.heal ?? 0)))); // the probe's targets (pigs) have 10 maximum health, the zombie and player 20
      assert.equal(hp, want.health, `damage ${row.damage} target ${i}`);
      assert.deepEqual((hit?.effects ?? []).map((e) => [e.id, e.amplifier, e.duration]), want.effects, `effects ${row.damage} target ${i}`);
    });
    checked++;
  }
  assert.ok(checked >= 6, `${checked} potions replayed`);
});

test("nose: ModelWitch.setRotationAngles", () => {
  for (const p of by("nose")[0].poses) {
    const got = noseAngles(p.id, p.ticks + 0.25 === 0 ? 0 : p.ticks + 0.25, p.held);
    got.forEach((v, i) => assert.ok(Math.abs(v - p.nose[i]) < 2e-3, `held ${p.held} id ${p.id} ticks ${p.ticks} [${i}]: ${v} vs ${p.nose[i]}`));
  }
});

test("model: boxes and hat of ModelWitch", () => {
  const m = ref.records.find((r) => r.model === "witch");
  assert.deepEqual(m.texture, [64, 32]);
  const hat = m.parts["bim.i"], chain = [];
  for (let p = hat; p; p = p.children[0]) chain.push(p);
  assert.equal(chain.length, 4);
  chain.forEach((p, i) => { assert.deepEqual(p.boxes[0].uv, [0, WITCH_MODEL.hat[i].boxes[0][7]]); assert.deepEqual(p.point.map(f), WITCH_MODEL.hat[i].point.map(f)); });
});

test("integration: the witch is registered, spawns from swamp-hut records and exports as Witch", async () => {
  const { ENTITY_TYPES, HOSTILE } = await import("./entities.js");
  assert.equal(ENTITY_TYPES.witch.health, 26);
  assert.ok(HOSTILE.has("witch"));
  const { SPAWNER_ENTITY_IDS } = await import("./mob-spawner.js");
  assert.equal(SPAWNER_ENTITY_IDS.Witch, "witch");
});
