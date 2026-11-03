// Stone-utility blocks: stone bricks (original 98), double stone slab (43), stone slab (44), end portal frame (120),
// cauldron (118) and flower pot (140), ported from the unchanged 1.7.10 classes (public/research/stone-utility-reference.json,
// tools/probes/StoneUtilityProbe.java). Pure rules with no imports, so world.js, lighting, the scene and the edit
// simulations can all share them.
//
// Internal block ids are world.js BLOCKS 101-106. The old sandstone slab (44:1) keeps internal id 82 and works as slab type 1.
// Item ids: tools occupy internal item ids 100-127, so these blocks' items sit at block id + 1000
// (1101 stone bricks, 1103 stone slab, 1104 end portal frame, 1105 cauldron, 1106 flower pot). The double slab has no item.
export const STONE_BRICKS = 101, DOUBLE_STONE_SLAB = 102, STONE_SLAB = 103, END_PORTAL_FRAME = 104, CAULDRON = 105, FLOWER_POT = 106;
export const SANDSTONE_SLAB = 82;
export const ITEM_STONE_BRICKS = 1101, ITEM_STONE_SLAB = 1103, ITEM_END_PORTAL_FRAME = 1104, ITEM_CAULDRON = 1105, ITEM_FLOWER_POT = 1106;
// This build's own bucket items (survival.js): empty 340, water 341.
export const BUCKET_ITEM = 340, WATER_BUCKET_ITEM = 341;

export const isStoneUtility = (b) => b >= STONE_BRICKS && b <= FLOWER_POT;
// Block <-> item mapping. `itemOfBlock` is the item a block's own pick/drop uses (the double slab drops slab items).
const ITEM_OF_BLOCK = { [STONE_BRICKS]: ITEM_STONE_BRICKS, [DOUBLE_STONE_SLAB]: ITEM_STONE_SLAB, [STONE_SLAB]: ITEM_STONE_SLAB, [END_PORTAL_FRAME]: ITEM_END_PORTAL_FRAME, [CAULDRON]: ITEM_CAULDRON, [FLOWER_POT]: ITEM_FLOWER_POT };
const BLOCK_OF_ITEM = { [ITEM_STONE_BRICKS]: STONE_BRICKS, [ITEM_STONE_SLAB]: STONE_SLAB, [ITEM_END_PORTAL_FRAME]: END_PORTAL_FRAME, [ITEM_CAULDRON]: CAULDRON, [ITEM_FLOWER_POT]: FLOWER_POT };
export const itemOfBlock = (b) => ITEM_OF_BLOCK[b] ?? 0;
export const blockOfItem = (id) => BLOCK_OF_ITEM[id] ?? 0;
export const STONE_UTILITY_ITEMS = Object.freeze({ [ITEM_STONE_BRICKS]: 'Stone bricks', [ITEM_STONE_SLAB]: 'Stone slab', [ITEM_END_PORTAL_FRAME]: 'End portal frame', [ITEM_CAULDRON]: 'Cauldron', [ITEM_FLOWER_POT]: 'Flower pot' });

// BlockStoneBrick (tile.stonebricksmooth.*): metadata 0-3, damageDropped = metadata, pick block keeps it.
export const STONE_BRICK_NAMES = ['Stone bricks', 'Mossy stone bricks', 'Cracked stone bricks', 'Chiseled stone bricks'];
export const stoneBrickTexture = (meta) => ['stonebrick', 'stonebrick_mossy', 'stonebrick_cracked', 'stonebrick_carved'][meta] ?? 'stonebrick';

// ---------------------------------------------------------------------------------------------------------------------
// Slabs (BlockSlab / BlockStoneSlab / ItemSlab). Types 0 stone, 1 sandstone, 2 wood, 3 cobblestone, 4 brick, 5 stone brick,
// 6 nether brick, 7 quartz. Single slab metadata bit 3 is the top half; the double slab (43) uses 0-7 and, for the
// blocks Minecraft writes as 43:8 and 43:9, the full-block stone and sandstone looks.
export const SLAB_NAMES = ['Stone slab', 'Sandstone slab', 'Wooden slab', 'Cobblestone slab', 'Brick slab', 'Stone brick slab', 'Nether brick slab', 'Quartz slab'];
// [side, top, bottom] texture names per type (BlockStoneSlab.getIcon). Type 0 and 8 use the slab top for the whole double block's top and bottom.
export const SLAB_TEXTURES = [
  ['stone_slab_side', 'stone_slab_top', 'stone_slab_top'], ['sandstone_normal', 'sandstone_top', 'sandstone_bottom'], ['planks_oak', 'planks_oak', 'planks_oak'],
  ['cobblestone', 'cobblestone', 'cobblestone'], ['brick', 'brick', 'brick'], ['stonebrick', 'stonebrick', 'stonebrick'],
  ['nether_brick', 'nether_brick', 'nether_brick'], ['quartz_block_side', 'quartz_block_top', 'quartz_block_bottom'],
];
export const isSlab = (b) => b === SANDSTONE_SLAB || b === DOUBLE_STONE_SLAB || b === STONE_SLAB;
// { type, top, double } of a slab cell, or null. Internal 82 is the old sandstone slab (44:1, bottom half).
export function slabInfo(b, meta = 0) {
  if (b === SANDSTONE_SLAB) return { type: 1, top: false, double: false };
  if (b === STONE_SLAB) return { type: meta & 7, top: (meta & 8) !== 0, double: false };
  if (b === DOUBLE_STONE_SLAB) return { type: meta & 7, top: false, double: true };
  return null;
}
// BlockSlab.setBlockBoundsBasedOnState: the double block is full, a single one is half high (the top half for bit 3).
export function slabBounds(b, meta = 0) {
  const s = slabInfo(b, meta);
  return !s || s.double ? [0, 0, 0, 1, 1, 1] : s.top ? [0, 0.5, 0, 1, 1, 1] : [0, 0, 0, 1, 0.5, 1];
}
// Internal block and metadata of a slab of `type` in the given half; types without a block of their own use id 103.
export const slabBlock = (type, top) => (type === 1 && !top ? { id: SANDSTONE_SLAB, meta: 0 } : { id: STONE_SLAB, meta: type | (top ? 8 : 0) });
export const doubleSlabBlock = (type) => ({ id: DOUBLE_STONE_SLAB, meta: type & 7 });
// The item a slab of this type is held as: the sandstone slab keeps its own item id (82), others use 1103 with the type as damage.
export const slabItem = (type) => (type === 1 ? { id: SANDSTONE_SLAB, damage: 0 } : { id: ITEM_STONE_SLAB, damage: type & 7 });
// The type a held slab item stands for (item 82 is sandstone), or -1.
export const heldSlabType = (id, damage = 0) => (id === SANDSTONE_SLAB ? 1 : id === ITEM_STONE_SLAB ? damage & 7 : -1);
// BlockSlab.onBlockPlaced: the top bit for a click on the underside, or on a side above the middle of the block.
export const slabPlacedMeta = (type, side, hitY) => (type & 7) | (side === 0 || (side !== 1 && hitY > 0.5) ? 8 : 0);
// Drops: a single slab one item, the double slab two (BlockSlab.quantityDropped), damage = metadata & 7.
export const slabDrops = (b, meta) => {
  const s = slabInfo(b, meta);
  return s ? [{ ...slabItem(s.type), count: s.double ? 2 : 1 }] : null;
};
// ItemSlab.onItemUse. `cell` is the clicked block's { id, meta }, `adj` the cell the click face leads to, `hitY` the
// vertical fraction of the click inside the clicked cell. Returns { merge: [x,y,z], ...doubleSlab }, { cell: 'adjacent', meta } or null.
// 1) a same-type single slab clicked on its open face merges there; 2) a same-type single slab in the adjacent cell
// merges whichever half it is (func_150946_a); 3) otherwise an ordinary placement into the adjacent cell.
export function planSlabUse(type, cell, adj, side, hitY) {
  const c = slabInfo(cell.id, cell.meta);
  if (c && !c.double && c.type === type && ((side === 1 && !c.top) || (side === 0 && c.top))) return { merge: 'clicked', ...doubleSlabBlock(type) };
  const a = adj && slabInfo(adj.id, adj.meta);
  if (a && !a.double && a.type === type) return { merge: 'adjacent', ...doubleSlabBlock(type) };
  return { merge: null, ...slabBlock(type, (slabPlacedMeta(type, side, hitY) & 8) !== 0) };
}

// Middle-click pick (getPickBlock): { id, damage } of the item a stone utility cell gives, or null for other blocks.
export function stoneUtilityPick(world, x, y, z) {
  const b = world.get(x, y, z), meta = world.getMeta(x, y, z);
  if (b === STONE_BRICKS) return { id: ITEM_STONE_BRICKS, damage: meta & 3 };
  if (b === DOUBLE_STONE_SLAB || b === STONE_SLAB) return slabItem(meta & 7);
  if (b === END_PORTAL_FRAME) return { id: ITEM_END_PORTAL_FRAME, damage: 0 };
  if (b === CAULDRON) return { id: ITEM_CAULDRON, damage: 0 };
  if (b === FLOWER_POT) return potPick(world, x, y, z);
  return null;
}

// ---------------------------------------------------------------------------------------------------------------------
// BlockEndPortalFrame (original 120): 13/16 high, facing in bits 0-1, the eye in bit 2. Unbreakable and blast-proof
// (setBlockUnbreakable, setResistance(6000000)); inserting an Eye of Ender and activating a portal are not implemented.
export const END_FRAME_HEIGHT = 0.8125;
export const END_FRAME_EYE_BOX = [0.3125, 0.8125, 0.3125, 0.6875, 1, 0.6875];
export const endFrameBounds = () => [0, 0, 0, 1, END_FRAME_HEIGHT, 1];
export const endFrameBoxes = (meta) => ((meta & 4) ? [endFrameBounds(), [...END_FRAME_EYE_BOX]] : [endFrameBounds()]);
// BlockEndPortalFrame.onBlockPlacedBy: ((floor(rotationYaw * 4 / 360 + 0.5) & 3) + 2) % 4; `rotationYaw` is Minecraft's yaw in degrees.
export const endFrameFacing = (rotationYaw) => ((Math.floor(Math.fround(Math.fround(Math.fround(rotationYaw) * 4) / 360) + 0.5) & 3) + 2) % 4;
// Block.getComparatorInputOverride: 15 with an eye, else 0.
export const endFrameComparator = (meta) => ((meta & 4) ? 15 : 0);

// ---------------------------------------------------------------------------------------------------------------------
// BlockCauldron (original 118): metadata 0-3 is the water level. Four wall boxes plus a 5/16 floor collide, the selection
// is the full cube.
export const CAULDRON_FLOOR = 0.3125, CAULDRON_WALL = 0.125;
export const cauldronBoxes = () => [[0, 0, 0, 1, CAULDRON_FLOOR, 1], [0, 0, 0, CAULDRON_WALL, 1, 1], [0, 0, 0, 1, 1, CAULDRON_WALL], [1 - CAULDRON_WALL, 0, 0, 1, 1, 1], [0, 0, 1 - CAULDRON_WALL, 1, 1, 1]];
// Height of the water surface for a level: (6 + 3 * level) / 16.
export const cauldronWaterHeight = (level) => (6 + 3 * (level & 3)) / 16;
// BlockCauldron.onBlockActivated for the items that exist here. No item: consumed with no effect. A water bucket always
// consumes the click, fills the cauldron to 3 and (outside Creative, below level 3) leaves an empty bucket. Everything else
// (empty/lava buckets, sticks, ...) returns false, so the item's own use proceeds. Glass bottles and armour washing do
// not exist in this build.
export function cauldronUse(heldId, level, creative = false) {
  if (!heldId) return { handled: true, level, bucket: false };
  if (heldId === WATER_BUCKET_ITEM) return { handled: true, level: level < 3 ? 3 : level, bucket: !creative && level < 3 };
  return { handled: false, level, bucket: false };
}
// BlockCauldron.onEntityCollidedWithBlock: a burning entity whose box bottom is at most (6 + 3 * level) / 16 above the cell
// is extinguished and uses one level.
export const cauldronExtinguishes = (level, burning, entityMinY, cellY) => burning && level > 0 && entityMinY <= cellY + cauldronWaterHeight(level);
// BlockCauldron.fillWithRain: on a one-in-twenty roll (Random.nextInt(20) == 1) the level rises by one, up to 3.
export const cauldronRain = (level, roll) => (roll === 1 && level < 3 ? level + 1 : level);
export const cauldronComparator = (meta) => meta & 15;

// ---------------------------------------------------------------------------------------------------------------------
// BlockFlowerPot (original 140) and TileEntityFlowerPot. The plant is a (item, damage) pair kept per cell; the block
// metadata is the held item's damage on insertion, and the tile entity BlockFlowerPot.createNewTileEntity makes for a
// metadata (generated structures write only the metadata) is POT_META_CONTENTS.
export const POT_BOUNDS = [0.3125, 0, 0.3125, 0.6875, 0.375, 0.6875];
// Internal plant ids: dandelion 43, red flower 44 (damage 0-8), sapling 48 (0-5), cactus 53, brown mushroom 75, red mushroom 76,
// dead bush 79, fern 84 (native tall grass damage 2).
const POT_PLANTS = { 43: [37, () => 0], 44: [38, (d) => d], 48: [6, (d) => d], 75: [39, () => 0], 76: [40, () => 0], 53: [81, () => 0], 79: [32, () => 0], 84: [31, () => 2] };
// Native (item, damage) of an internal plant stack, or null when the pot refuses it.
export function potPlantOf(id, damage = 0) {
  const p = POT_PLANTS[id];
  if (!p) return null;
  const d = p[1](damage | 0);
  if (id === 44 && (d < 0 || d > 8)) return null;
  if (id === 48 && (d < 0 || d > 5)) return null;
  return [p[0], d];
}
// What an insertion does: the content kept ({ id, damage }) and the block metadata, or null when the item is not a pot plant.
export function potInsertion(id, damage = 0) {
  const native = potPlantOf(id, damage);
  return native ? { content: { id, damage: id === 44 || id === 48 ? damage | 0 : 0 }, meta: native[1] } : null;
}
// createNewTileEntity by metadata (BlockFlowerPot.func_149929_a): internal [id, damage] or null for an empty pot.
const POT_META_CONTENTS = [null, [44, 0], [43, 0], [48, 0], [48, 1], [48, 2], [48, 3], [76, 0], [75, 0], [53, 0], [79, 0], [84, 0], [48, 4], [48, 5], null, null];
export const potContentsOfMeta = (meta) => { const c = POT_META_CONTENTS[meta & 15]; return c ? { id: c[0], damage: c[1] } : null; };
const potKey = (x, y, z) => `${x},${y},${z}`;
// The pot's plant: the explicit record (world.pots), or the one its metadata implies.
export function potContents(world, x, y, z) {
  const rec = world.pots?.get(potKey(x, y, z));
  return rec ?? potContentsOfMeta(world.getMeta(x, y, z));
}
export function setPotContents(world, x, y, z, content) {
  const pots = (world.pots ??= new Map());
  if (content) pots.set(potKey(x, y, z), { id: content.id, damage: content.damage | 0 });
  else pots.delete(potKey(x, y, z));
}
export const serializePots = (world) => [...(world.pots ?? [])].map(([k, v]) => { const [x, y, z] = k.split(',').map(Number); return { x, y, z, id: v.id, damage: v.damage }; });
export function restorePots(world, list) {
  world.pots = new Map();
  for (const p of Array.isArray(list) ? list : [])
    if (Number.isInteger(p?.x) && Number.isInteger(p?.y) && Number.isInteger(p?.z) && potPlantOf(p.id, p.damage)) setPotContents(world, p.x, p.y, p.z, p);
}
// BlockFlowerPot.onBlockActivated: only an empty pot takes a plant; the insertion returns true (and consumes one item
// outside Creative), anything else returns false.
export function potUse(world, x, y, z, heldId, heldDamage = 0) {
  if (!heldId || potContents(world, x, y, z)) return null;
  const ins = potInsertion(heldId, heldDamage);
  return ins;
}
// The break drops of a pot: its contents (when Survival) and the pot item itself (harvest).
export function potDrops(world, x, y, z) {
  const c = potContents(world, x, y, z);
  return [...(c ? [{ id: c.id, count: 1, damage: c.damage }] : []), { id: ITEM_FLOWER_POT, count: 1, damage: 0 }];
}
// BlockFlowerPot.getPickBlock: the plant when it holds one, else the pot.
export function potPick(world, x, y, z) {
  const c = potContents(world, x, y, z);
  return c ? { id: c.id, damage: c.damage } : { id: ITEM_FLOWER_POT, damage: 0 };
}

// ---------------------------------------------------------------------------------------------------------------------
// Cell-level helpers shared by world.js (bounds and collision).
export function stoneUtilityBounds(b, meta) {
  if (b === STONE_SLAB || b === DOUBLE_STONE_SLAB) return slabBounds(b, meta);
  if (b === END_PORTAL_FRAME) return endFrameBounds();
  if (b === FLOWER_POT) return [...POT_BOUNDS];
  return [0, 0, 0, 1, 1, 1];
}
export function stoneUtilityBoxes(b, meta) {
  if (b === END_PORTAL_FRAME) return endFrameBoxes(meta);
  if (b === CAULDRON) return cauldronBoxes();
  return [stoneUtilityBounds(b, meta)];
}
// Blocks whose selection is smaller than the cell, so rays pass the empty part of the cell.
export const hasPartialBounds = (b) => b === SANDSTONE_SLAB || b === STONE_SLAB || b === END_PORTAL_FRAME || b === FLOWER_POT;
// Ground a plant pot needs: BlockFlowerPot.canPlaceBlockAt, a solid top surface below (checked by the caller).
