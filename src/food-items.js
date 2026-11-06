// Pumpkin Pie (original item 400) and the Enchanted Golden Apple (original 322 with damage 1), Minecraft Java 1.7.10.
// Evidence: tools/probes/FoodItemsProbe.java -> public/research/food-items-reference.json (replayed by food-items.test.js),
// notes in public/research/food-items.md. A leaf module: survival.js installs the items, the recipe and the eating effects.
//
// ItemFood(8, 0.3F, false) is the pie: heal 8, saturation modifier 0.3, 32 eat ticks, stack 64, Food tab, nothing else.
// ItemAppleGold(4, 1.2F, false).setAlwaysEdible().setPotionEffect(Regeneration, 5 s, level II, 100 %):
//  * ItemAppleGold.onFoodEaten always adds Absorption I for 2400 ticks first (outside the client);
//  * damage 0 then runs ItemFood.onFoodEaten: the potion roll (Regeneration II, 100 ticks, probability 1.0);
//  * damage > 0 skips that and adds Regeneration V 600 ticks, Resistance I 6000 and Fire Resistance I 6000.
//  * hasEffect is damage > 0 (glint); the rarity is rare (aqua name) for damage 0 and epic (light purple) above.
//  * getSubItems lists damage 0 then 1; the recipe is 8 gold blocks around an apple (gold ingots: damage 0).
import { POTION } from './potions.js';

export const PUMPKIN_PIE = 2130; // this build's id for original item 400 (the 2100s hold the carrot on a stick, fireworks and maps)
export const GOLDEN_APPLE = 372, APPLE = 200, GOLD_BLOCK_ITEM = 27;
export const FOOD_ITEMS = Object.freeze({ 400: PUMPKIN_PIE });

// ItemAppleGold.onFoodEaten (acy.c), in the order the original calls addPotionEffect. `chance` is the ItemFood potion roll
// (nextFloat() < probability); entries without it are unconditional.
export function goldenAppleEffects(damage = 0) {
  const effects = [{ id: POTION.ABSORPTION, duration: 2400, amplifier: 0 }];
  if (damage > 0) effects.push({ id: POTION.REGENERATION, duration: 600, amplifier: 4 }, { id: POTION.RESISTANCE, duration: 6000, amplifier: 0 }, { id: POTION.FIRE_RESISTANCE, duration: 6000, amplifier: 0 });
  else effects.push({ id: POTION.REGENERATION, duration: 100, amplifier: 1, chance: 1 });
  return effects;
}

// ItemAppleGold.getRarity (acy.f): rare (aqua name) for damage 0, epic (light purple) above; indexed by min(damage, 1).
export const GOLDEN_APPLE_RARITY = Object.freeze(['aqua', 'pink']);

export function installFoodItems(items) {
  items[PUMPKIN_PIE] = { id: PUMPKIN_PIE, name: 'Pumpkin Pie', texture: 'pumpkin_pie', stack: 64, color: '#d98a3d', food: 8, saturation: 0.3 };
  // damage 1 is the enchanted golden apple (the native name is "Golden Apple" for both, so the variants repeat it).
  Object.assign(items[GOLDEN_APPLE], { variants: ['Golden apple', 'Golden apple'], alwaysEdible: true, glintDamage: 1, rarity: GOLDEN_APPLE_RARITY });
}

// CraftingManager: pumpkin + sugar + egg (shapeless).
export function installFoodRecipes({ shapeless }) { shapeless(PUMPKIN_PIE, 1, 0, 67, 329, 316); }

// CraftingManager: eight gold blocks around an apple make the enchanted golden apple (damage 1). The shaped matcher only
// produces damage 0 outputs, so this grid is recognised here, ahead of it.
export function foodCraftingResult(cells, size) {
  if (size !== 3 || cells.length < 9) return null;
  for (let i = 0; i < 9; i++) if (cells[i]?.id !== (i === 4 ? APPLE : GOLD_BLOCK_ITEM)) return null;
  return { id: GOLDEN_APPLE, count: 1, damage: 1 };
}
