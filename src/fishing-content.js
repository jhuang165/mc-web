// Fishing items (ItemFishingRod acv 346, ItemFishFood act 349/350). Internal ids append after the other
// content tracks (700-706). Every fish variant is its own internal item (the native damage value is the
// FishType), the same way potions and dyes map '349:1' style keys in original-items.js. Values:
// public/research/fishing-reference.json; notes in public/research/fishing.md.
export const FISHING_ROD = 700, RAW_COD = 701, RAW_SALMON = 702, CLOWNFISH = 703, PUFFERFISH = 704, COOKED_COD = 705, COOKED_SALMON = 706;
// Whether the player's bobber is out: the held rod then shows fishing_rod_cast (EntityPlayer.getItemIcon).
export const rodState = { cast: false };
export const FISHING_ITEMS = Object.freeze({ 346: FISHING_ROD, '349:0': RAW_COD, '349:1': RAW_SALMON, '349:2': CLOWNFISH, '349:3': PUFFERFISH, '350:0': COOKED_COD, '350:1': COOKED_SALMON });
export const FISH_FOODS = new Set([RAW_COD, RAW_SALMON, CLOWNFISH, PUFFERFISH, COOKED_COD, COOKED_SALMON]);
// Furnace experience (FurnaceRecipes.func_151396_a(... , 0.35F) for each cookable FishType), keyed by the output.
export const FISHING_SMELT_EXPERIENCE = { [COOKED_COD]: 0.35, [COOKED_SALMON]: 0.35 };

const f = Math.fround;
export function installFishingItems(items) {
  // ItemFishingRod: setMaxDamage(64), setMaxStackSize(1), Tools tab, full3D and rotated when held.
  items[FISHING_ROD] = { id: FISHING_ROD, name: 'Fishing Rod', kind: 'fishing_rod', texture: 'fishing_rod_uncast', durability: 64, stack: 1, color: '#8d6a3f', glyph: '/' };
  // ItemFishFood.FishType heal and saturation (ItemFishFood.func_150905_g / func_150906_h).
  for (const [id, name, texture, food, saturation, color] of [
    [RAW_COD, 'Raw Fish', 'fish_cod_raw', 2, 0.1, '#c9b27c'], [RAW_SALMON, 'Raw Salmon', 'fish_salmon_raw', 2, 0.1, '#c06a5a'],
    [CLOWNFISH, 'Clownfish', 'fish_clownfish_raw', 1, 0.1, '#e8873c'], [PUFFERFISH, 'Pufferfish', 'fish_pufferfish_raw', 1, 0.1, '#d6c857'],
    [COOKED_COD, 'Cooked Fish', 'fish_cod_cooked', 5, 0.6, '#a3764a'], [COOKED_SALMON, 'Cooked Salmon', 'fish_salmon_cooked', 6, 0.8, '#b0603f'],
  ]) items[id] = { id, name, texture, food, saturation: f(saturation), stack: 64, color, glyph: '◕' };
}
// CraftingManager: fishing rod "  #", " #X", "# X" with sticks and string (the mirror matches too).
export function installFishingRecipes({ recipe }) {
  recipe('fishing-rod', 'Fishing Rod', ['  #', ' #X', '# X'], { '#': 300, X: 321 }, FISHING_ROD);
}
// FurnaceRecipes: raw cod and salmon cook (clownfish and pufferfish have no cooked form).
export function installFishingSmelting(smelting) {
  Object.assign(smelting, { [RAW_COD]: COOKED_COD, [RAW_SALMON]: COOKED_SALMON });
}
// Creative tabs: the rod follows the other tools; the fish follow the other foods (Item.itemRegistry order).
export const FISHING_CREATIVE = { tools: [FISHING_ROD], food: [RAW_COD, RAW_SALMON, CLOWNFISH, PUFFERFISH, COOKED_COD, COOKED_SALMON] };
