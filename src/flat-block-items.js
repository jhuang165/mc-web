// Batch 57 (b57dp): which block items RenderItem and ItemRenderer draw as a flat sprite of the block's own icon. An ItemBlock whose block's render type fails
// RenderBlocks.renderItemIn3d is drawn as a sprite (executed: public/research/display-pixel-reference.json, 170 blocks); the rest are boxes (renderBlockAsItem).
// FLAT_BLOCK_ITEMS lists the port block ids (not the original ids) of the obtainable ones the sprite path of first-person.js itemTexture did not cover before: ladder, rail,
// lily pad, vine, mushrooms, dead shrub, tall grass and fern, double plants, the powered, detector and activator rails and the stained glass pane. The hopper (160 in
// the executed table, port 133) takes the item atlas sprite `hopper`: BlockHopper.getItemIconName (aln.O(), bytecode-read) returns "hopper".
import { itemBlockId } from "./item-boxes.js";

export const FLAT_BLOCK_ITEMS = Object.freeze(new Set([39, 52, 59, 61, 69, 72, 75, 76, 79, 83, 84, 135, 136, 137, 141]));
export const HOPPER_BLOCK = 133;
export const HOPPER_ITEM_URL = "/media/1.7.10/items/hopper.png";

// The port block id behind an item id that is a flat block item, or 0. Item ids 100..255 are tools and food, not blocks: a block at or above 100 is the item 1000 + id.
// Both the hopper block item (port 133: Block.getItem of the hopper is item 154, class abh, executed in display-pixel-reference.json, so picking a placed hopper gives it) and Items.hopper (original 410, port 1133) are the hopper sprite.
export const isHopperItem = (id) => id === HOPPER_BLOCK || id === 1133;
export function flatBlockItem(id) {
  if (isHopperItem(id)) return HOPPER_BLOCK;
  if (!(id > 0 && id < 100) && !(id >= 1000 && id < 1256)) return 0;
  const b = itemBlockId(id);
  return FLAT_BLOCK_ITEMS.has(b) || b === HOPPER_BLOCK ? b : 0;
}
