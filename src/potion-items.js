// Items of the potion/brewing build: plain items 386-394, the brewing stand block item 1134, and the creative tab contents.
// Item rows are [id, name, texture, extra] for population-content.js; see public/research/brewing.md for what is Creative-only.
import { ITEM_POTION, ITEM_GLASS_BOTTLE } from "./potions.js";
import { ITEM_BREWING_STAND, ITEM_NETHER_WART, ITEM_BLAZE_ROD, ITEM_BLAZE_POWDER, ITEM_GHAST_TEAR, ITEM_MAGMA_CREAM, ITEM_FERMENTED_SPIDER_EYE, ITEM_GLISTERING_MELON, ITEM_GOLDEN_CARROT, ITEM_GOLD_NUGGET } from "./brewing.js";

export const POTION_ITEM_ROWS = [
  [ITEM_NETHER_WART, "Nether Wart", "nether_wart"], [ITEM_BLAZE_ROD, "Blaze Rod", "blaze_rod"], [ITEM_BLAZE_POWDER, "Blaze Powder", "blaze_powder"],
  [ITEM_GHAST_TEAR, "Ghast Tear", "ghast_tear"], [ITEM_MAGMA_CREAM, "Magma Cream", "magma_cream"], [ITEM_FERMENTED_SPIDER_EYE, "Fermented Spider Eye", "spider_eye_fermented"],
  [ITEM_GLISTERING_MELON, "Glistering Melon", "melon_speckled"], [ITEM_GOLDEN_CARROT, "Golden Carrot", "carrot_golden", { food: 6, saturation: 14.4 }],
  [ITEM_GOLD_NUGGET, "Gold Nugget", "gold_nugget"], [ITEM_BREWING_STAND, "Brewing Stand", "brewing_stand"],
];
// CreativeTabs.tabBrewing (creative-reference.json, 1.7.10 order); the potion damages are the native list.
export const BREWING_POTION_DAMAGES = [0, 8193, 8225, 8257, 16385, 16417, 16449, 8194, 8226, 8258, 16386, 16418, 16450, 8227, 8259, 16419, 16451, 8196, 8228, 8260, 16388, 16420, 16452, 8261, 8229, 16453, 16421, 8230, 8262, 16422, 16454, 8232, 8264, 16424, 16456, 8201, 8233, 8265, 16393, 16425, 16457, 8234, 8266, 16426, 16458, 8268, 8236, 16460, 16428, 8237, 8269, 16429, 16461, 8238, 8270, 16430, 16462];
export const BREWING_TAB = [ITEM_GHAST_TEAR, ...BREWING_POTION_DAMAGES.map((d) => (d ? [ITEM_POTION, d] : ITEM_POTION)), ITEM_GLASS_BOTTLE, ITEM_FERMENTED_SPIDER_EYE, ITEM_BLAZE_POWDER, ITEM_MAGMA_CREAM, ITEM_BREWING_STAND, 1105, ITEM_GLISTERING_MELON];
// The search tab lists every potion damage where item 373 sits in registry order.
export const POTION_SEARCH = BREWING_TAB.filter((e) => (Array.isArray(e) ? e[0] : e) === ITEM_POTION);
