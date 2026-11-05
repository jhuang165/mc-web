import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  MAGMA, MAGMA_CREAM, PIGMAN, GOLD_NUGGET, GOLD_INGOT, ROTTEN_FLESH, GOLDEN_SWORD, magmaArmor, magmaDamage, magmaJumpMotion, magmaJumpDelay, magmaDrops,
  pigmanAnger, pigmanDrops, pigmanSwordDrop, pigmanExperience, pigmanEquipment, pigStruck, portalPigmanSpawn, MAGMA_SQUISH_DECAY, MAGMA_BRIGHTNESS,
} from "./nether-melee.js";
import { JavaRandom } from "./java-random.js";
import { pigmanRandom } from "./nether-melee-live.js";
import { armorReduced } from "./combat.js";
import { MAGMA_MODEL } from "./magma-cube-renderer.js";

const ref = JSON.parse(await readFile(new URL("../public/research/magma-pigman-reference.json", import.meta.url)));
const by = (c) => ref.records.filter((r) => r.case === c);
const f = Math.fround;
// original item ids -> browser ids
const ids = { 378: MAGMA_CREAM, 367: ROTTEN_FLESH, 371: GOLD_NUGGET, 266: GOLD_INGOT, 283: GOLDEN_SWORD };
const mapStacks = (rows) => rows.map((s) => ids[s[0]]);

test("reference covers the probe records", () => {
  assert.equal(ref.target, "Minecraft Java 1.7.10");
  assert.ok(ref.records.length >= 41);
});

test("magma cube facts per size", () => {
  for (const row of by("magmaFacts")[0].rows) {
    assert.equal(magmaArmor(row.size), row.armor);
    assert.equal(magmaDamage(row.size), row.damage);
    assert.equal(magmaJumpMotion(row.size), f(row.jumpMotion));
    assert.equal(row.canDamage, true);
    assert.equal(row.fireImmune, true);
    assert.equal(row.particle, MAGMA.particle);
    assert.equal(row.drop, 378);
    assert.equal(f(row.squishDecay), MAGMA_SQUISH_DECAY);
    assert.equal(row.brightnessPacked, MAGMA_BRIGHTNESS.packed);
    assert.equal(row.brightness, MAGMA_BRIGHTNESS.value);
  }
});

test("magma cube armour reduction", () => {
  for (const [size, amount, out] of by("magmaArmor")[0].rows) assert.ok(Math.abs(Math.min(f(armorReduced("magma_cube", amount, {}, size)), size * size) - out) < 1e-5, `size ${size} amount ${amount}`);
});

test("magma cube jump delay is four times the slime's", () => {
  for (const d of by("magmaJumpDelay")[0].rows) assert.ok(d % 4 === 0 && d >= 40 && d <= 116);
  assert.equal(magmaJumpDelay({ nextInt: (n) => n - 1 }), 116);
});

test("magma cream drops by size, looting and seed", () => {
  for (const r of by("magmaDrops")) r.rows.forEach((want, seed) => {
    assert.deepEqual(magmaDrops(pigmanRandom(seed), r.size, r.looting).map(() => 378).length, want.length, `size ${r.size} looting ${r.looting} seed ${seed}`);
  });
});

test("pigman facts", () => {
  const p = by("pigFacts")[0].row;
  assert.equal(p.maxHealth, PIGMAN.health);
  assert.equal(p.armor, PIGMAN.armor);
  assert.equal(p.attackDamage, PIGMAN.attackDamage);
  assert.equal(p.followRange, PIGMAN.followRange);
  assert.equal(p.speedAttr, PIGMAN.movement);
  assert.equal(p.boost.amount, PIGMAN.boost);
  assert.equal(p.say, PIGMAN.sounds.say);
  assert.equal(p.hurt, PIGMAN.sounds.hurt);
  assert.equal(p.death, PIGMAN.sounds.death);
  assert.equal(p.experience, PIGMAN.experience);
  assert.equal(p.fireImmune, true);
});

test("pigman anger values and range", () => {
  const rec = by("pigAnger")[0];
  assert.equal(rec.angerRange, PIGMAN.angerRange);
  assert.equal(rec.findCalm, null);
  for (const row of rec.rows) {
    const seed = row[0], [anger, delay] = row[2];
    assert.deepEqual(Object.values(pigmanAnger(pigmanRandom(seed))), [anger, delay], `seed ${seed}`);
  }
});

test("pigman drops, equipment and experience", () => {
  for (const r of by("pigDrops")) {
    r.rows.forEach((want, seed) => assert.deepEqual(pigmanDrops(pigmanRandom(seed), r.looting), mapStacks(want), `drops ${seed} looting ${r.looting}`));
    r.equipment.forEach((want, seed) => {
      const got = pigmanSwordDrop(pigmanRandom(seed), pigmanEquipment(), true, r.looting);
      assert.deepEqual(got ? [[got.id, 1, got.damage]] : [], want.map(([id, n, d]) => [ids[id], n, d]), `sword ${seed} looting ${r.looting}`);
    });
  }
  for (const [held, seed, xp] of by("pigXp")[0].rows) assert.equal(pigmanExperience(pigmanRandom(seed), held ? pigmanEquipment() : null), xp, `xp ${held} ${seed}`);
});

test("pigman spawn egg item and NBT facts", () => {
  const n = by("pigNbt")[0];
  assert.equal(n.restoredHeld, 283);
  assert.equal(n.hurtByKeys, false);
  assert.ok(n.keys.includes("Anger"));
  assert.equal(n.equipmentCount, 5);
});

test("pig struck by lightning becomes an adult pigman with the sword", () => {
  for (const row of by("pigLightning")[0].rows) {
    const out = pigStruck({ x: row.pos[0], y: row.pos[1], z: row.pos[2], rotationYaw: row.rot[0], rotationPitch: row.rot[1] });
    assert.deepEqual([out.x, out.y, out.z], row.pos);
    assert.deepEqual([out.rotationYaw, out.rotationPitch], row.rot);
    assert.equal(out.held.id, GOLDEN_SWORD);
    assert.equal(out.angerLevel, row.anger);
  }
});

test("BlockPortal pigman spawn rows", () => {
  const column = { top: (y) => y === 59, normal: () => false };
  for (const row of by("portal")[0].rows) {
    const hits = [];
    for (let s = 0; s < row.trials; s++) {
      const got = portalPigmanSpawn(new JavaRandom(BigInt(s)), { difficulty: row.difficulty }, 5, 63, 5, column);
      if (!got) continue;
      hits.push(s);
      assert.deepEqual([got.x, got.y, got.z, got.portalCooldown], [row.entity[1], row.entity[2], row.entity[3], row.entity[4]]);
    }
    assert.equal(hits.length, row.spawns, `difficulty ${row.difficulty}`);
    assert.deepEqual(hits.slice(0, 12), row.firstSeeds);
  }
  assert.equal(portalPigmanSpawn(new JavaRandom(2399n), { difficulty: 1, doMobSpawning: false }, 5, 63, 5, column), null);
  assert.equal(portalPigmanSpawn(new JavaRandom(2399n), { difficulty: 1, surfaceWorld: false }, 5, 63, 5, column), null);
});

test("magma cube model has the core and eight slices", () => {
  const rec = ref.records.find((r) => r.model === "magmacube");
  assert.equal(Object.keys(rec.parts).filter((k) => k.startsWith("slice")).length, 8);
  assert.ok(MAGMA_MODEL);
});
