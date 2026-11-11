// Which block items RenderBlocks.renderBlockAsItem draws as boxes instead of a unit cube, and with which boxes: the one table behind the inventory icons (block-textures.js),
// the held, third-person and dropped geometry (first-person.js blockItemGeometry). Batch 42 executed the boxes (item-render-reference.json); batch 43 let every consumer see
// the item ids that map to blocks (1103, the stone slab item, and the rest of the ItemBlock / ItemSlab / ItemMultiTexture family) through itemBlockId.
import { ANVIL, GLASS_PANE } from './world.js';
import { STAIRS, STAIR_ITEM_BOXES } from './stairs.js';
import { FENCE_ITEM_BOXES } from './fences.js';
import { GATE_ITEM_BOXES, BEACON_ITEM_BOXES, ITEM_BOXES, anvilUv } from './render-shapes.js';
import { anvilModelBoxes } from './anvil-block.js';
import { toOriginal } from './block-registry.js';
import { STONE_BRICKS, STONE_SLAB, END_PORTAL_FRAME } from './stone-utility.js';
import { blockForItem } from './dispenser-piston.js';

export const isGateItem = (id) => id === 1167 || id === 167;
// The port block an item id stands for: the 1000 + block id items of the coloured, redstone, stone and glass families and the chest, slab, brick and frame items fold back to
// their block ids (the chain iconRaw used to carry privately), the dispenser / dropper / piston items to their blocks. Other ids come back unchanged.
export function itemBlockId(id) {
  if (id === 1139) id = 139;
  if (id === 1940 || id === 1941) id -= 1778;
  if (id >= 1140 && id <= 1148) id -= 1000;
  if (id === 1177 || id === 1178) id -= 1000;
  if (id >= 1165 && id <= 1169) id -= 1000; // shaped-blocks.js: wood slab, gate, trapdoor, wall
  if (id === 1100) id = GLASS_PANE;
  if (id >= 1135 && id <= 1137) id -= 1000;
  if (id >= 1108 && id <= 1113) id -= 1000;
  if (id >= 1120 && id <= 1131) id -= 1000;
  if (id === 1101) id = STONE_BRICKS;
  if (id === 1103) id = STONE_SLAB;
  if (id === 1104) id = END_PORTAL_FRAME;
  return blockForItem(id) || id;
}

// The box model of a block item, or null when it is a unit cube or a sprite: { boxes, turned, kind, tileOf(face, box), uvOf }. `turned`: renderBlockAsItem first turns types 0, 31,
// 39 and 26 by 90 degrees about y (the stair, fence, gate, beacon, anvil, wall and dragon egg types do not). `id` is a port block id or an item id (1000 and above fold through
// itemBlockId); `blockTile` is block-textures.js's (passed in because that module owns the atlas and imports this one's tables).
//   anvil (type 35, executed): always the facing 0 boxes whatever the damage, every face on anvil_base except the top of the last box (anvil_top_damaged_n), each face's texture
//   turned as facing 0 of the world model (anvilUv). Beacon (type 34): the obsidian base (metadata 1 faces), the core (2), then the glass shell (0).
export function itemSpec(id, damage, blockTile) {
  const plain = (kind, boxes, turned, tid = id) => ({ boxes, turned, kind, tileOf: (fi) => blockTile(tid, fi, false, damage), uvOf: undefined });
  if (isGateItem(id)) return plain('gate', GATE_ITEM_BOXES, false);
  const b = id >= 1000 ? itemBlockId(id) : id;
  if (STAIRS[b]) return plain('stairs', STAIR_ITEM_BOXES, false, b);
  if (b === ANVIL) {
    const meta = (damage & 3) << 2;
    return { boxes: anvilModelBoxes(0), turned: false, kind: 'anvil', tileOf: (fi, k) => (k === 3 ? blockTile(ANVIL, fi, false, meta) : blockTile(ANVIL, fi === 2 ? 0 : fi, false, 0)), uvOf: (fi, p, box) => anvilUv(0, fi, p, box) };
  }
  if (!(b > 0 && b < 256)) return null;
  const o = toOriginal(b, 0)?.[0];
  if (o === 85 || o === 113) return plain('fence', FENCE_ITEM_BOXES, false, b);
  if (o === 138) return { boxes: BEACON_ITEM_BOXES, turned: false, kind: 'beacon', tileOf: (fi, k) => blockTile(b, fi, false, [1, 2, 0][k]), uvOf: undefined };
  const boxes = ITEM_BOXES[o];
  return boxes ? plain('boxes', boxes, !(o === 139 || o === 122), b) : null;
}
