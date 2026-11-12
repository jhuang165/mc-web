// Items with Item.requiresMultipleRenderPasses() in 1.7.10: each pass draws getIconFromDamageForRenderPass(damage, pass) multiplied by getColorFromItemStack(stack, pass).
// Every icon is a cell of the item atlas (item-atlas.js), so a pass is a sprite url plus a colour.
//   leather armor (ItemArmor): pass 0 the cloth sprite in the dye colour, pass 1 its overlay, white.
//   spawn egg (ItemMonsterPlacer): pass 0 spawn_egg in the primary colour, pass 1 spawn_egg_overlay in the secondary colour.
//   potion (ItemPotion, bytecode-read adp.a(int,int) / adp.a(add,int)): pass 0 potion_overlay in PotionHelper's liquid colour, pass 1 the bottle (drinkable, or splash for
//   damage bit 16384), white.
// itemPasses(id, damage, color) -> { color, tint, base, overlay, overlayTint } (tints are [r, g, b] in 0..1, null = white) or null for a one-pass item. `color` is the pass 0 colour
// as an integer (a cache key); `base` is the pass 0 sprite, `overlay` the pass 1 sprite drawn over it.
import { leatherItemLayers } from "./leather-dye.js";
import { ITEM_SPAWN_EGG, eggColor } from "./spawn-eggs.js";
import { potionColor } from "./potions.js";

export const ITEM_POTION = 385;
const ITEMS_DIR = "/media/1.7.10/items/";
const rgb = (c) => [((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255];

export function itemPasses(id, damage = 0, color = undefined) {
  const leather = leatherItemLayers(id, color);
  if (leather) return { color: leather.color, tint: leather.tint, base: leather.base, overlay: leather.overlay, overlayTint: null };
  if (id === ITEM_SPAWN_EGG) {
    const primary = eggColor(damage, 0), secondary = eggColor(damage, 1);
    return { color: primary, tint: rgb(primary), base: ITEMS_DIR + "spawn_egg.png", overlay: ITEMS_DIR + "spawn_egg_overlay.png", overlayTint: rgb(secondary) };
  }
  if (id === ITEM_POTION) {
    const liquid = potionColor(damage | 0) & 0xffffff;
    return { color: liquid, tint: rgb(liquid), base: ITEMS_DIR + "potion_overlay.png", overlay: ITEMS_DIR + (damage & 16384 ? "potion_bottle_splash.png" : "potion_bottle_drinkable.png"), overlayTint: null };
  }
  return null;
}
