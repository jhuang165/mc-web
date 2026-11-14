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
import { flatBlockItem } from "./flat-block-items.js";
import { blockTile, tileName } from "./block-textures.js";
import { itemGrassColor, hasColormaps, FOLIAGE_BASIC, LILY_PAD_COLOR } from "./biome-colors.js";

export const ITEM_POTION = 385;
const ITEMS_DIR = "/media/1.7.10/items/";
const rgb = (c) => [((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255];

// Flat block items whose block has a getRenderColor tint (executed sweep b52dx, leafcolor-reference.json): tall grass (damage 1) and fern, the double plants grass and fern, vine
// and lily pad. RenderItem draws the block-atlas icon (ItemBlock sprite number 0) with that colour as the vertex colour, so the sprite is the grey blocks-sheet cell times the colour,
// not a baked image. Keyed by the tile the port picks for the item; tall grass damage 0 (the dead shrub) and the other double plants are white and stay untinted. Leaves are
// cubes (renderItemIn3d), not flat sprites, so they are not here.
const VANILLA_ITEM_GRASS = 0x7cbd6b; // ColorizerGrass.getGrassColor(0.5, 1.0) of the shipped colormap (executed), used until the colormaps are loaded
const GRASS_TILE = /^(tallgrass|fern|double_plant_(grass|fern)_(bottom|top))$/;
export function flatTintOfTile(name) {
  if (GRASS_TILE.test(name)) return hasColormaps() ? itemGrassColor() : VANILLA_ITEM_GRASS;
  if (name === "vine") return FOLIAGE_BASIC;
  if (name === "waterlily") return LILY_PAD_COLOR;
  return null;
}
const BLOCKS_DIR = "/media/1.7.10/blocks/";

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
  const flat = flatBlockItem(id);
  if (flat && flat !== 141) {
    const name = tileName(blockTile(flat, 2, false, damage)), colour = flatTintOfTile(name);
    if (colour != null) return { color: colour & 0xffffff, tint: rgb(colour), base: BLOCKS_DIR + name + ".png", overlay: null, overlayTint: null };
  }
  return null;
}
