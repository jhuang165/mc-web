// TileEntityBrewingStand (aov) and the brewing stand rules of Minecraft Java 1.7.10, ported from the unchanged class and replayed
// from public/research/potions-reference.json (case "brew": 780 seeded bottle layouts). Pure logic with no runtime imports: main.js
// owns the block, the screen and the world metadata. See public/research/brewing.md.
//
// Internal ids: block 134 (original 117, item 1134 = block id + 1000), potion 385 (373), glass bottle 384 (374); the ingredient items
// are this build's 386-394 plus the existing sugar 329, spider eye 326, gunpowder 330, redstone 360 and glowstone dust 383.
import { ITEM_POTION, ITEM_GLASS_BOTTLE, INGREDIENT, getPotionEffects, effectListsEqual, applyIngredient, isSplashDamage } from "./potions.js";

export const BREWING_STAND = 134, ITEM_BREWING_STAND = 1134, BREW_TIME = 400, STAND_SLOTS = 4, INGREDIENT_SLOT = 3;
export const ITEM_NETHER_WART = 386, ITEM_BLAZE_ROD = 387, ITEM_BLAZE_POWDER = 388, ITEM_GHAST_TEAR = 389, ITEM_MAGMA_CREAM = 390,
  ITEM_FERMENTED_SPIDER_EYE = 391, ITEM_GLISTERING_MELON = 392, ITEM_GOLDEN_CARROT = 393, ITEM_GOLD_NUGGET = 394;
const SUGAR = 329, SPIDER_EYE = 326, GUNPOWDER = 330, REDSTONE = 360, GLOWSTONE_DUST = 383;

// Item.setPotionEffect: the brewing effect string of every potion ingredient (isPotionIngredient = the item has one)
export const POTION_INGREDIENTS = Object.freeze({
  [ITEM_NETHER_WART]: INGREDIENT.netherWart, [SUGAR]: INGREDIENT.sugar, [ITEM_GHAST_TEAR]: INGREDIENT.ghastTear, [SPIDER_EYE]: INGREDIENT.spiderEye,
  [ITEM_FERMENTED_SPIDER_EYE]: INGREDIENT.fermentedSpiderEye, [ITEM_BLAZE_POWDER]: INGREDIENT.blazePowder, [ITEM_MAGMA_CREAM]: INGREDIENT.magmaCream,
  [ITEM_GLISTERING_MELON]: INGREDIENT.speckledMelon, [ITEM_GOLDEN_CARROT]: INGREDIENT.goldenCarrot, [REDSTONE]: INGREDIENT.redstone,
  [GLOWSTONE_DUST]: INGREDIENT.glowstone, [GUNPOWDER]: INGREDIENT.gunpowder,
});
// Original ids of the ingredient items (for the replay and the Java converters)
export const INGREDIENT_ORIGINAL = Object.freeze({ 289: GUNPOWDER, 331: REDSTONE, 348: GLOWSTONE_DUST, 353: SUGAR, 370: ITEM_GHAST_TEAR, 372: ITEM_NETHER_WART, 375: SPIDER_EYE, 376: ITEM_FERMENTED_SPIDER_EYE, 377: ITEM_BLAZE_POWDER, 378: ITEM_MAGMA_CREAM, 382: ITEM_GLISTERING_MELON, 396: ITEM_GOLDEN_CARROT });
export const isPotionIngredient = (stack) => !!stack && POTION_INGREDIENTS[stack.id] !== undefined;
export const potionEffectOf = (stack) => (stack ? POTION_INGREDIENTS[stack.id] ?? null : null);
// TileEntityBrewingStand.func_145936_c(meta, ingredient): the new damage value after one ingredient
export const applyBrewIngredient = (damage, stack) => (!stack ? damage : isPotionIngredient(stack) ? applyIngredient(damage, potionEffectOf(stack)) : damage);

// ItemPotion.getEffects(meta) is cached per damage value, so the original compares the two lists by reference: the same damage value
// gives the same list and two empty results are both null.
const sameList = (j, k, a, b) => (a === null && b === null) || j === k;

// ContainerBrewingStand slots: SlotPotion (potion or glass bottle, 1 each) and the ingredient slot (isPotionIngredient)
export const maxStackOf = (id) => (id === ITEM_POTION ? 1 : 64);
export const isBottleOrPotion = (stack) => !!stack && (stack.id === ITEM_POTION || stack.id === ITEM_GLASS_BOTTLE);
// isItemValidForSlot / canInsertItem (all sides alike)
export const isItemValidForSlot = (slot, stack) => (slot === INGREDIENT_SLOT ? isPotionIngredient(stack) : isBottleOrPotion(stack));
// getAccessibleSlotsFromSide: the top (side 1) reaches the ingredient, every other side the three bottles
export const accessibleSlots = (side) => (side === 1 ? [3] : [0, 1, 2]);
export const canInsertItem = (slot, stack, side) => isItemValidForSlot(slot, stack);
export const canExtractItem = () => true;

export class BrewingStand {
  constructor(saved) {
    this.slots = [null, null, null, null];
    this.brewTime = 0;
    this.brewItem = null; // field m: the ingredient item the running brew started with (not saved, so a reload cancels it)
    this.lastBits = 0; // field l
    this.customName = null;
    if (saved) this.load(saved);
  }
  // NBT "Items" [{Slot, id, Count, Damage}] and "BrewTime" (short)
  load(saved) {
    this.slots = [null, null, null, null];
    for (const s of saved.items ?? []) if (s && s.slot >= 0 && s.slot < 4 && s.id && s.count > 0) this.slots[s.slot] = { id: s.id, count: s.count, damage: s.damage ?? 0, ...(s.tag ? { tag: s.tag } : {}) };
    this.brewTime = (saved.brewTime << 16) >> 16;
    this.customName = saved.customName ?? null;
  }
  save() {
    return { items: this.slots.flatMap((s, slot) => (s ? [{ slot, ...s }] : [])), brewTime: this.brewTime, ...(this.customName ? { customName: this.customName } : {}) };
  }
  // j(): bit k of the block metadata marks a stack in bottle slot k
  bottleBits() {
    let bits = 0;
    for (let i = 0; i < 3; i++) if (this.slots[i]) bits |= 1 << i;
    return bits;
  }
  // k(): can the ingredient change at least one bottle?
  canBrew() {
    const ing = this.slots[3];
    if (!ing || ing.count <= 0) return false;
    if (!isPotionIngredient(ing)) return false;
    for (let i = 0; i < 3; i++) {
      const s = this.slots[i];
      if (!s || s.id !== ITEM_POTION) continue;
      const j = s.damage, k = applyBrewIngredient(j, ing);
      if (!isSplashDamage(j) && isSplashDamage(k)) return true;
      const a = getPotionEffects(j), b = getPotionEffects(k);
      if ((j <= 0 || !sameList(j, k, a, b)) && (a === null || (!effectListsEqual(a, b) && b !== null))) {
        if (j !== k) return true;
      }
    }
    return false;
  }
  // l(): brewPotions
  brewPotions() {
    if (!this.canBrew()) return;
    const ing = this.slots[3];
    for (let i = 0; i < 3; i++) {
      const s = this.slots[i];
      if (!s || s.id !== ITEM_POTION) continue;
      const j = s.damage, k = applyBrewIngredient(j, ing);
      const a = getPotionEffects(j), b = getPotionEffects(k);
      if ((j > 0 && sameList(j, k, a, b)) || (a !== null && (effectListsEqual(a, b) || b === null))) {
        if (!isSplashDamage(j) && isSplashDamage(k)) s.damage = k;
      } else if (j !== k) s.damage = k;
    }
    ing.count--;
    if (ing.count <= 0) this.slots[3] = null;
  }
  // h(): the per-tick update. Returns the new bottle-bit metadata when it changed (the caller writes it with flag 2), else null.
  tick() {
    if (this.brewTime > 0) {
      this.brewTime--;
      if (this.brewTime === 0) this.brewPotions();
      else if (!this.canBrew()) this.brewTime = 0;
      else if (this.brewItem !== this.slots[3]?.id) this.brewTime = 0;
    } else if (this.canBrew()) {
      this.brewTime = BREW_TIME;
      this.brewItem = this.slots[3].id;
    }
    const bits = this.bottleBits();
    if (bits !== this.lastBits) {
      this.lastBits = bits;
      return bits;
    }
    return null;
  }
  // BlockBrewingStand.getComparatorInputOverride: Container.calcRedstoneFromInventory
  comparatorSignal(maxStack = maxStackOf) {
    let n = 0, sum = Math.fround(0);
    for (const s of this.slots) if (s) { sum = Math.fround(sum + Math.fround(s.count / Math.min(64, maxStack(s.id)))); n++; }
    sum = Math.fround(sum / this.slots.length);
    return Math.floor(Math.fround(sum * 14)) + (n > 0 ? 1 : 0);
  }
  // GuiBrewingStand: the arrow grows over the brew (28 * (400 - time) / 400 pixels) and the bubbles follow the table below
  progress() {
    return this.brewTime > 0 ? Math.trunc((28 * (BREW_TIME - this.brewTime)) / BREW_TIME) : 0;
  }
  get items() { return this.slots; }
  // Contents a broken stand drops (InventoryHelper.dropInventoryItems)
  contents() { return this.slots.filter(Boolean).map((s) => ({ ...s })); }
}
// GuiBrewingStand bubble column heights, indexed by (brewTime / 2) % 7
export const BUBBLE_HEIGHTS = Object.freeze([29, 24, 20, 16, 11, 6, 0]);
export const bubbleHeight = (brewTime) => (brewTime > 0 ? BUBBLE_HEIGHTS[Math.trunc(brewTime / 2) % 7] : 0);

// BlockBrewingStand.addCollisionBoxesToList: the 2/16 base, then the centre post 7/16-9/16 up to 14/16. The selection box is approximated
// as the 14/16 high cell (the original keeps whatever bounds the last collision call set).
export const BREWING_BOXES = Object.freeze([[0, 0, 0, 1, 0.125, 1], [0.4375, 0, 0.4375, 0.5625, 0.875, 0.5625]]);
export const BREWING_SELECTION = Object.freeze([0, 0, 0, 1, 0.875, 1]);
export const brewingItemBlock = (itemId) => (itemId === ITEM_BREWING_STAND ? BREWING_STAND : 0);

// ---- runtime store: survival.brewing["x,y,z"] = { items: [4 stacks|null], brewTime } is plain data (saved, chunk-resident, exported);
// brewingView() wraps one record in a BrewingStand sharing its slots/brewTime, keeping the unsaved runtime fields (brewItem, lastBits) beside it.
export const newBrewingTile = () => ({ items: [null, null, null, null], brewTime: 0 });
const VIEWS = new WeakMap();
export function brewingView(data) {
  let view = VIEWS.get(data);
  if (view) return view;
  if (!Array.isArray(data.items) || data.items.length !== 4) data.items = [...Array(4)].map((_, i) => data.items?.[i] ?? null);
  view = new BrewingStand();
  view.slots = data.items;
  Object.defineProperty(view, "brewTime", { get: () => data.brewTime | 0, set: (v) => { data.brewTime = v; }, configurable: true });
  view.lastBits = view.bottleBits();
  VIEWS.set(data, view);
  return view;
}
// Metadata bits for a record, as BlockBrewingStand stores them (bit i = bottle slot i filled).
export const brewingBits = (data) => (data.items ?? []).slice(0, 3).reduce((b, s, i) => b | (s ? 1 << i : 0), 0);
