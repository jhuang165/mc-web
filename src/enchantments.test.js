import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JavaRandom } from "./java-random.js";
import {
  ENCHANTMENT_LIST, ENCHANTMENTS_BY_ID, ENCHANTMENT_TYPES, BOOK_ENCHANTMENT_LIST, DAMAGE_SOURCES, CREATURE_ATTRIBUTES, ITEM_ENCHANTING,
  itemInfo, canApplyTogether, typeCanEnchantItem, canApply, calcModifierDamage, calcModifierLiving, isItemTool, isItemEnchantable,
  isItemStackDamageable, getEnchantmentLevel, getEnchantments, setEnchantments, addEnchantment, addStoredEnchantment,
  getKnockbackModifier, getFireAspectModifier, getRespiration, getEfficiencyModifier, getSilkTouchModifier, getFortuneModifier,
  getLuckOfTheSeaModifier, getLureModifier, getLootingModifier, getAquaAffinityModifier, firstItemWith, getEnchantmentModifierDamage,
  getEnchantmentModifierLiving, fireProtectionTicks, blastProtectionKnockback, thornsShouldHit, thornsDamage, negateDamage,
  attemptDamageItem, calcItemStackEnchantability, mapEnchantmentData, buildEnchantmentList, addRandomEnchantment, EnchantingTable,
} from "./enchantments.js";

const ref = JSON.parse(readFileSync(new URL("../public/research/enchantment-reference.json", import.meta.url)));
const pairs = (a) => a.map(([id, lvl]) => ({ id, lvl }));
const stack = (s) => s && { id: s[0], count: s[1], damage: s[2], enchantments: pairs(s[3]), storedEnchantments: pairs(s[4]), unbreakable: !!s[5] };
const encode = (s) => s && [s.id, s.count ?? 1, s.damage ?? 0, (s.enchantments || []).map((e) => [e.id, e.lvl]), (s.storedEnchantments || []).map((e) => [e.id, e.lvl]), s.unbreakable ? 1 : 0];
const chosen = (l) => l && l.map((d) => [d.enchantment.id, d.level]);
const SOURCE_LIST = Object.values(DAMAGE_SOURCES);
const ATTR = ["UNDEFINED", "UNDEAD", "ARTHROPOD"];

test("registry, types, sources and per-level formulas match the original classes", () => {
  assert.deepEqual(ENCHANTMENT_TYPES, ref.types);
  assert.deepEqual(BOOK_ENCHANTMENT_LIST, ref.bookList);
  assert.deepEqual(CREATURE_ATTRIBUTES, ATTR);
  assert.equal(SOURCE_LIST.length, ref.sources.length);
  ref.sources.forEach(([name, projectile, explosion, fire, creative, fall], i) =>
    assert.deepEqual(SOURCE_LIST[i], { name, projectile, explosion, fire, canHarmInCreative: creative, fall }));
  assert.equal(ENCHANTMENT_LIST.length, ref.registry.length);
  for (const r of ref.registry) {
    const e = ENCHANTMENTS_BY_ID[r.id];
    assert.deepEqual([e.className, e.name, e.weight, e.minLevel, e.maxLevel, e.type], [r.class, r.name, r.weight, r.minLevel, r.maxLevel, r.type], r.name);
    for (const [l, min, max] of r.levels) assert.deepEqual([e.minEnchantability(l), e.maxEnchantability(l)], [min, max], `${r.name} ${l}`);
    assert.deepEqual(ENCHANTMENT_LIST.filter((b) => canApplyTogether(e, b)).map((b) => b.id), r.compatible, r.name);
    r.living.forEach((row, l) => row.forEach((v, a) => assert.equal(calcModifierLiving(e, l, ATTR[a]), Math.fround(v), `${r.name} ${l}`)));
    r.damage.forEach((row, l) => row.forEach((v, si) => assert.equal(calcModifierDamage(e, l, SOURCE_LIST[si]), v, `${r.name} ${l} ${si}`)));
  }
});

test("item enchantability, damageability and applicability over every registered item", () => {
  assert.equal(ref.items.length, 315);
  for (const [id, name, kind, armorType, ench, maxDamage, damageable, , tool1, tool2, ench1, ench2, stackDamageable, typeMask, applyMask] of ref.items) {
    const it = itemInfo(id), one = { id, count: 1 }, two = { id, count: 2 };
    assert.deepEqual([it.kind, it.armorType, it.enchantability, it.maxDamage, it.damageable], [kind, armorType, ench, maxDamage, damageable], name);
    assert.deepEqual([isItemTool(one), isItemTool(two), isItemEnchantable(one), isItemEnchantable(two), isItemStackDamageable(one)], [tool1, tool2, ench1, ench2, stackDamageable], name);
    assert.equal(ENCHANTMENT_TYPES.reduce((m, t, i) => m | (typeCanEnchantItem(t, id) ? 1 << i : 0), 0), typeMask, name);
    assert.equal(ENCHANTMENT_LIST.reduce((m, e, i) => m | (canApply(e, one) ? 1 << i : 0), 0), applyMask, name);
  }
  assert.ok(Object.keys(ITEM_ENCHANTING).every((id) => ref.items.some((r) => r[0] === +id)));
  for (const v of ref.variants) {
    const s = stack(v.stack);
    assert.equal(ENCHANTMENT_LIST.reduce((m, e, i) => m | (canApply(e, s) ? 1 << i : 0), 0), v.apply);
    assert.deepEqual([isItemStackDamageable(s), isItemEnchantable(s)], [v.damageable, v.enchantable]);
  }
});

test("table slot levels for bookshelf counts across seeds", () => {
  assert.ok(ref.slots.length >= 900);
  for (const [id, shelves, seed, a, b, c, next] of ref.slots) {
    const r = new JavaRandom(BigInt(seed)), s = { id };
    assert.deepEqual([0, 1, 2].map((i) => calcItemStackEnchantability(r, i, shelves, s)), [a, b, c], `${id} ${shelves} ${seed}`);
    assert.equal(r.nextInt(), next);
  }
});

test("mapEnchantmentData candidates in original HashMap order", () => {
  for (const [id, level, values] of ref.maps) {
    const m = mapEnchantmentData(level, { id });
    assert.deepEqual(m && m.map((d) => [d.enchantment.id, d.level]), values, `${id} ${level}`);
  }
});

test("buildEnchantmentList and addRandomEnchantment replay exactly", () => {
  for (const [id, level, seed, values, next] of ref.build) {
    const r = new JavaRandom(BigInt(seed));
    assert.deepEqual(chosen(buildEnchantmentList(r, { id }, level)), values, `${id} ${level} ${seed}`);
    assert.equal(r.nextInt(), next);
  }
  for (const [id, level, seed, result, same, next] of ref.addRandom) {
    const r = new JavaRandom(BigInt(seed)), s = { id, count: 1, damage: 0 };
    assert.equal(addRandomEnchantment(r, s, level) === s, same);
    assert.deepEqual(encode(s), result, `${id} ${level} ${seed}`);
    assert.equal(r.nextInt(), next);
  }
});

test("ContainerEnchantment sequences: bookshelves, levels, costs, books and rerolls", () => {
  let accepted = 0;
  for (const c of ref.table) {
    const [tx, ty, tz] = c.pos, blocks = new Map();
    for (let dy = 0; dy < 2; dy++) for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++)
      blocks.set(`${tx + dx},${ty + dy},${tz + dz}`, c.cells[(dy * 5 + dz + 2) * 5 + dx + 2]);
    const world = { getBlock: (x, y, z) => blocks.get(`${x},${y},${z}`) ?? 0 };
    const random = new JavaRandom(BigInt(c.seed));
    const table = new EnchantingTable({ world, x: tx, y: ty, z: tz, random, remote: c.remote });
    const player = { experienceLevel: c.level, experienceTotal: 777, experience: 0.25, creative: c.creative };
    const label = JSON.stringify([c.seed, c.stack]);
    for (const step of c.steps) {
      if (step[0] === "put") table.setItem(stack(c.stack));
      if (step[0] === "replace") table.setItem(stack(step[1]));
      if (step[0] === "remove") table.setItem(null);
      if (step[0] === "enchant") {
        const ok = table.enchantItem(player, step[1]);
        assert.equal(ok, step[2], label);
        if (ok) accepted++;
        assert.deepEqual(encode(table.item), step[3], label);
        assert.deepEqual([player.experienceLevel, player.experienceTotal, Math.fround(player.experience)], step[6].map((v, i) => (i === 2 ? Math.fround(v) : v)), label);
      }
      const [seedField, levels] = step[0] === "enchant" ? [step[4], step[5]] : step[0] === "replace" ? [step[2], step[3]] : [step[1], step[2]];
      assert.equal(table.nameSeed.toString(), seedField, label);
      assert.deepEqual(table.enchantLevels, levels, `${label} ${step[0]}`);
    }
    assert.equal(random.nextInt(), c.next, label);
  }
  assert.ok(accepted > 100);
});

test("armour damage modifier with EnchantmentHelper's static Random", () => {
  for (const [armor, si, seed, value, next] of ref.damage) {
    const r = new JavaRandom(BigInt(seed));
    assert.equal(getEnchantmentModifierDamage(armor.map(stack), SOURCE_LIST[si], r), value, JSON.stringify([armor, si]));
    assert.equal(r.nextInt(), next);
  }
});

test("living modifier and entity getters", () => {
  for (const [s, a, value] of ref.living) assert.equal(getEnchantmentModifierLiving(stack(s), ATTR[a]), Math.fround(value), JSON.stringify(s));
  const watch = [0, 1, 3, 5, 6, 7, 34];
  for (const g of ref.getters) {
    const held = stack(g.held), items = g.items.map(stack);
    if (g.heldSlot) items[0] = held;
    const out = [getEnchantmentModifierLiving(held, ATTR[g.targetAttr]), getKnockbackModifier(held), getFireAspectModifier(held), getRespiration(items),
      getEfficiencyModifier(held), getSilkTouchModifier(held), getFortuneModifier(held), getLuckOfTheSeaModifier(held), getLureModifier(held),
      getLootingModifier(held), getAquaAffinityModifier(items), fireProtectionTicks(items, g.ticks), blastProtectionKnockback(items, g.knock)];
    assert.deepEqual(out, g.out.map((v, i) => (i === 0 ? Math.fround(v) : v)), JSON.stringify(g));
    assert.deepEqual(watch.map((id) => firstItemWith(id, items)), g.first);
  }
});

test("unbreaking damage skips, negateDamage and thorns rolls", () => {
  for (const [before, amount, seed, broke, damage, next] of ref.unbreaking) {
    const r = new JavaRandom(BigInt(seed)), s = stack(before);
    assert.equal(attemptDamageItem(s, amount, r), broke, JSON.stringify(before));
    assert.equal(s.damage, damage);
    assert.equal(r.nextInt(), next);
  }
  for (const [id, lvl, seed, value, next] of ref.negate) {
    const r = new JavaRandom(seed);
    assert.equal(negateDamage({ id }, lvl, r), value);
    assert.equal(r.nextInt(), next);
  }
  for (const [lvl, seed, hit, n1, dmg, n2] of ref.thorns) {
    const r = new JavaRandom(BigInt(seed));
    assert.equal(thornsShouldHit(lvl, r), hit);
    assert.equal(r.nextInt(), n1);
    const r2 = new JavaRandom(BigInt(seed));
    assert.equal(thornsDamage(lvl, r2), dmg);
    assert.equal(r2.nextInt(), n2);
  }
});

test("enchantment NBT helpers", () => {
  for (const [op, before, arg, result, after, unbreaking] of ref.nbt) {
    const s = stack(before);
    if (op === 0) assert.deepEqual([...getEnchantments(s)], result);
    if (op === 1) setEnchantments(new Map(arg), s);
    if (op === 2) for (const [id, lvl] of arg) if (ENCHANTMENTS_BY_ID[id]) addStoredEnchantment(s, id, lvl);
    if (op === 3) for (const [id, lvl] of arg) if (ENCHANTMENTS_BY_ID[id]) addEnchantment(s, id, lvl);
    assert.deepEqual(encode(s), after, JSON.stringify([op, before, arg]));
    assert.equal(getEnchantmentLevel(34, s), unbreaking);
  }
});
