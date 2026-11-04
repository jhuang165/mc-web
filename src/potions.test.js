import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { POTION_TYPES, REQUIREMENTS, AMPLIFIERS, INGREDIENT, getPotionEffects, potionLiquidColor, potionColor, potionPrefixKey, potionName, potionTooltipText,
  isSplashDamage, isInstantPotion, applyIngredient, modifierAmount } from "./potions.js";

const ref = JSON.parse(readFileSync(new URL("../public/research/potions-reference.json", import.meta.url), "utf8"));
const rec = (c) => ref.records.find((r) => r.case === c);
const sha = (lines) => createHash("sha256").update(lines.join("")).digest("hex");
const effText = (list) => (list ? list.map((e) => `${e.id}:${e.duration}:${e.amplifier}`).join(";") : "");

test("reference targets the unchanged 1.7.10 client", () => {
  assert.equal(ref.clientSha1, "e80d9b3bf5085002218d4be59e668bac718abbc6");
  for (const c of ["aen", "rv", "rw", "adp", "aov"]) assert.match(ref.classes[c].sha256, /^[0-9a-f]{64}$/);
});

test("Potion types: colour, flags, effectiveness, icon and attribute modifiers match", () => {
  const types = rec("potions").types;
  assert.equal(types.length, 23);
  for (const t of types) {
    const mine = POTION_TYPES[t.id];
    assert.equal(mine.key, t.name, `key ${t.id}`);
    assert.equal(mine.color, t.color, `colour ${t.id}`);
    assert.equal(mine.instant, t.instant);
    assert.equal(mine.bad, t.bad);
    assert.equal(mine.effectiveness, t.effectiveness);
    assert.equal(mine.icon, t.hasIcon ? t.icon : -1, `icon ${t.id}`);
    assert.equal(!!mine.modifier, t.modifiers.length === 1, `modifier ${t.id}`);
    if (mine.modifier) {
      const m = t.modifiers[0];
      assert.equal(mine.modifier.attribute, m.attribute);
      assert.equal(mine.modifier.uuid, m.uuid);
      assert.equal(mine.modifier.operation, m.operation);
      assert.equal(mine.modifier.base, m.base);
      m.amounts.forEach((a, amp) => assert.ok(Math.abs(modifierAmount(mine, amp) - a) < 1e-12, `amount ${t.id}/${amp}`));
    }
    assert.equal(mine.name, ref.records[1].lang[t.name], `name ${t.id}`);
    assert.equal(mine.postfix, ref.records[1].lang[`${t.name}.postfix`], `postfix ${t.id}`);
  }
});

test("PotionHelper requirement, amplifier and ingredient strings match", () => {
  const table = rec("table");
  assert.deepEqual(Object.fromEntries(Object.entries(REQUIREMENTS)), table.requirements);
  assert.deepEqual(Object.fromEntries(Object.entries(AMPLIFIERS)), table.amplifiers);
  assert.equal(table.defaultColor, potionLiquidColor(null));
  const ing = new Set(rec("ingredients").items.map((i) => i.effect));
  for (const s of Object.values(INGREDIENT)) assert.ok(ing.has(s), s);
  assert.equal(ing.size, Object.keys(INGREDIENT).length);
});

test("all 32768 damage values: effects, colour, prefix, name, flags and tooltip match the native digests", () => {
  const d = rec("damage"), colors = [], effects = [], prefixes = [], names = [], tips = [], flags = [];
  const lang = rec("table").lang;
  let nonEmpty = 0, splash = 0, instant = 0;
  for (let m = 0; m < 32768; m++) {
    const list = getPotionEffects(m), c = potionColor(m);
    colors.push(`${m}=${c}/${c}\n`);
    effects.push(`${m}=${effText(list)}\n`);
    prefixes.push(`${m}=${potionPrefixKey(m)}\n`);
    names.push(`${m}=${potionName(m)}\n`);
    tips.push(`${m}=${potionTooltipText(m)}\n`);
    flags.push(`${m}=${isSplashDamage(m)}/${isInstantPotion(m)}\n`);
    if (list) nonEmpty++;
    if (isSplashDamage(m)) splash++;
    if (isInstantPotion(m)) instant++;
  }
  assert.equal(nonEmpty, d.nonEmpty);
  assert.equal(splash, d.splash);
  assert.equal(instant, d.instant);
  assert.equal(sha(effects), d.effectSha256, "effects");
  assert.equal(sha(colors), d.colorSha256, "colours");
  assert.equal(sha(prefixes), d.prefixSha256, "prefixes");
  assert.equal(sha(flags), d.flagSha256, "flags");
  assert.equal(sha(names), d.nameSha256, "names");
  assert.equal(sha(tips), d.tooltipSha256, "tooltips");
  for (const s of d.samples) {
    assert.equal(effText(getPotionEffects(s.damage)), s.effects, `effects ${s.damage}`);
    assert.equal(potionName(s.damage), s.name);
    assert.equal(potionTooltipText(s.damage), s.tooltip);
  }
  assert.equal(lang["item.emptyPotion.name"], d.emptyName);
});

test("applyIngredient matches the native result for every ingredient string x all 32768 values", () => {
  const rows = rec("apply").rows;
  assert.equal(rows.length, 13);
  for (const row of rows) {
    const lines = [];
    for (let m = 0; m < 32768; m++) lines.push(`${m}>${applyIngredient(m, row.effect)}\n`);
    assert.equal(sha(lines), row.sha256, row.effect);
    for (const [m, r] of row.samples) assert.equal(applyIngredient(m, row.effect), r);
  }
});

test("brewing chains reach the known potions", () => {
  const awkward = applyIngredient(0, INGREDIENT.netherWart);
  assert.equal(awkward, 16);
  assert.equal(potionName(awkward), "Awkward Potion");
  const swift = applyIngredient(awkward, INGREDIENT.sugar);
  assert.equal(potionName(swift), "Potion of Swiftness");
  assert.equal(potionName(applyIngredient(swift, INGREDIENT.gunpowder)), "Splash Potion of Swiftness");
  assert.equal(potionName(applyIngredient(applyIngredient(awkward, INGREDIENT.speckledMelon), INGREDIENT.glowstone)), "Potion of Healing");
  assert.equal(potionLiquidColor(null), 3694022);
});
