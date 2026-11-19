// Stone-utility blocks: stone bricks (original 98), double stone slab (43), stone slab (44), end portal frame (120),
// cauldron (118) and flower pot (140), ported from the unchanged 1.7.10 classes (public/research/stone-utility-reference.json,
// tools/probes/StoneUtilityProbe.java). Pure rules with no runtime imports, so world.js, lighting, the scene and the edit
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
// BlockCauldron.onBlockActivated: no item consumes the click with no effect. A water bucket always
// consumes the click, fills the cauldron to 3 and (outside Creative, below level 3) leaves an empty bucket. Leather
// armor washing is handled by cauldronWash; empty/lava buckets, sticks and other items return false.
export function cauldronUse(heldId, level, creative = false) {
  if (!heldId) return { handled: true, level, bucket: false };
  if (heldId === WATER_BUCKET_ITEM) return { handled: true, level: level < 3 ? 3 : level, bucket: !creative && level < 3 };
  return { handled: false, level, bucket: false };
}
// BlockCauldron.onBlockActivated: any leather armor is washed with one water level,
// even if it has no explicit color tag. Creative also consumes the cauldron's water.
export function cauldronWash(stack, level) {
  if (!stack || stack.id < 400 || stack.id > 403 || !(level > 0)) return { handled: false, level, stack };
  const washed = { ...stack };
  for (const key of ['enchantments', 'storedEnchantments', 'stored'])
    if (Array.isArray(washed[key])) washed[key] = washed[key].map((entry) => ({ ...entry }));
  delete washed.color;
  return { handled: true, level: level - 1, stack: washed };
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
// dead bush 79, fern 84 (native tall grass damage 2). Only a pot read from NBT holds the other drawn pairs (b80): dead shrub 83 (tall grass 0), tall grass 39
// (tall grass 1) and cobweb 51 (render type 1 too, so RenderBlocks.func_147752_a draws it crossed).
const POT_PLANTS = { 43: [37, () => 0], 44: [38, (d) => d], 48: [6, (d) => d], 75: [39, () => 0], 76: [40, () => 0], 53: [81, () => 0], 79: [32, () => 0], 84: [31, () => 2], 83: [31, () => 0], 39: [31, () => 1], 51: [30, () => 0] };
// BlockFlowerPot.func_149928_a (executed, pot-sweep-reference.json potAccept): the stacks a click puts in: tall grass only at damage 2 (the fern), no cobweb.
const POT_INSERTABLE = new Set([43, 44, 48, 75, 76, 53, 79, 84]);
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
  const native = POT_INSERTABLE.has(id) ? potPlantOf(id, damage) : null;
  return native ? { content: { id, damage: id === 44 || id === 48 ? damage | 0 : 0 }, meta: native[1] } : null;
}
// createNewTileEntity by metadata (BlockFlowerPot.func_149929_a): internal [id, damage] or null for an empty pot.
const POT_META_CONTENTS = [null, [44, 0], [43, 0], [48, 0], [48, 1], [48, 2], [48, 3], [76, 0], [75, 0], [53, 0], [79, 0], [84, 0], [48, 4], [48, 5], null, null];
export const potContentsOfMeta = (meta) => { const c = POT_META_CONTENTS[meta & 15]; return c ? { id: c[0], damage: c[1] } : null; };
// TileEntityFlowerPot.writeToNBT / readFromNBT (executed, pot-sweep-reference.json): native Item id and Data. Batch 72.
// Export keeps the native item and the held damage; import maps a native (Item, Data) to the browser's content when it is a plant the port can
// draw (single-icon plants ignore Data, flowers and saplings need a representable damage), else an undrawn record (b81, below).
// A pot record is { id, damage } (the drawn plant), plus `data` (the exact native Data when it differs from the drawn plant's own damage, b79) or, for an
// item the client does not draw (b81), { id: 0, damage: 0, item, data, stack? }: `item`/`data` are the tile's Item and Data, `stack` the port stack of
// that ItemStack (absent when the port has no such item).
export function potNbtOf(content) {
  if (content && Number.isInteger(content.item)) return { Item: content.item, Data: content.data | 0 }; // b81: an undrawn item writes back unchanged
  const native = content ? potPlantOf(content.id, content.damage) : null;
  // `data` is the exact native TileEntityFlowerPot Data a pot kept from an import or save; the plant drawn and dropped stays the one `damage` names.
  return native ? { Item: native[0], Data: Number.isInteger(content.data) ? content.data : native[1] } : { Item: 0, Data: 0 };
}
// What the unchanged client draws for a native (Item, Data) (b79, bytecode-read RenderBlocks.func_147752_a -> getIcon(0, Data)): BlockFlower (dandelion, red
// flower) takes icons[Data] and falls back to icons[0] when Data >= the array length (1 and 9 entries), a negative index throws, BlockSapling uses
// clamp(Data & 7, 0, 5), mushrooms, dead bush, cobweb and cactus ignore Data. BlockTallGrass.getIcon (anz.a(int,int), b80 bytecode-read) is the same
// rule over its 3 icons {deadbush, tallgrass, fern}. Returns the port's drawable damage (tall grass: the icon index), or null when the client would throw.
export function potDrawDamage(item, data) {
  if (item === 38) return data < 0 ? null : data <= 8 ? data : 0;
  if (item === 37) return data < 0 ? null : 0;
  if (item === 31) return data < 0 ? null : data <= 2 ? data : 0;
  if (item === 6) return Math.min(data & 7, 5);
  return 0;
}
const NATIVE_TO_POT = { 37: 43, 38: 44, 6: 48, 39: 75, 40: 76, 81: 53, 32: 79, 30: 51 };
const TALL_GRASS_ICONS = [83, 39, 84];
// b81: the item ids Item.itemRegistry holds in 1.7.10 (executed smallchecks sweep, smallchecks-reference.json, 315 ids). Item.getItemById of any other id is
// null, so TileEntityFlowerPot.readFromNBT leaves the pot empty and writeToNBT writes Item 0 (pot-sweep-reference.json potNbt rows 6000 and -5).
const NATIVE_ITEM_RANGES = [[1,25],[27,33],[35,35],[37,54],[56,58],[60,62],[65,67],[69,70],[72,73],[76,82],[84,91],[95,103],[106,114],[116,116],[119,123],[125,131],[133,139],[141,143],[145,148],[151,164],[170,175],[256,408],[417,422],[2256,2267]];
export const nativeItemRegistered = (id) => Number.isInteger(id) && NATIVE_ITEM_RANGES.some(([a, b]) => id >= a && id <= b);
// b81: the port stack of a native ItemStack(Item, 1, Data) for a pot that holds an item. `itemOf(id, damage)` is region-import.js itemFromOriginal (passed in:
// this module has no runtime imports). The ItemStack constructor (add.<init>(adb,II), bytecode-read) turns a negative damage into 0. A damage the port's
// catalogue has no variant for loads as the item at damage 0 with `rawDamage` (the java-mobs.js convention), which export writes back. null: no such port item.
export function potItemStack(item, data, itemOf) {
  if (typeof itemOf !== 'function') return null;
  const d = Math.max(0, data | 0), exact = itemOf(item, d);
  if (exact) return { id: exact.id, damage: exact.damage };
  const base = itemOf(item, 0);
  return base ? { id: base.id, damage: base.damage, rawDamage: d } : null;
}
// TileEntityFlowerPot.readFromNBT keeps any registered item and Data (executed potNbt rows). This returns the pot content: the drawn plant when the pair is
// one the port draws (render type 1 or 13 ItemBlocks), an undrawn record for any other registered item (b81: stone, reeds, seeds, a double plant, and a
// flower or tall grass with a negative Data, which the unchanged client cannot draw), or null for an empty pot (Item 0 or an unregistered id).
export function potFromNbt(tag, itemOf = null) {
  const item = tag?.Item, data = tag?.Data | 0;
  if (!nativeItemRegistered(item)) return null;
  const drawn = item in NATIVE_TO_POT || item === 31 ? potDrawDamage(item, data) : null;
  const id = drawn === null ? 0 : item === 31 ? TALL_GRASS_ICONS[drawn] : NATIVE_TO_POT[item], damage = item === 31 ? 0 : drawn | 0;
  const native = drawn === null ? null : potPlantOf(id, damage);
  if (!native) { const stack = potItemStack(item, data, itemOf); return { id: 0, damage: 0, item, data, ...(stack ? { stack } : {}) }; }
  // The exact native Data rides along when it differs from the drawn plant's own damage, so export and save keep it (b79).
  return data === native[1] ? { id, damage } : { id, damage, data };
}
// The colour RenderBlocks.func_147752_a multiplies the plant by: Block.colorMultiplier of the plant at the pot's cell. Only BlockTallGrass (anz.d, bytecode-read)
// is not white, and it reads the cell metadata, i.e. the POT's: metadata 0 is white, anything else the biome grass colour. Returns true for the grass tint.
export const potPlantTinted = (content, potMeta) => !!content && potPlantOf(content.id, content.damage)?.[0] === 31 && (potMeta & 15) !== 0;
// b84 cmdfix84: a pot tile whose readFromNBT left Item 0 (or an unregistered id). BlockFlowerPot.createNewTileEntity (ald.a(ahb,I), bytecode-read) makes the tile from the
// block metadata's plant, so an untagged /setblock keeps the meta plant; a tag with no registered Item reads over it and leaves the tile empty whatever the metadata is.
export const EMPTY_POT = Object.freeze({ id: 0, damage: 0, empty: true });
export const potKey = (x, y, z) => `${x},${y},${z}`;
// The pot's plant: the explicit record (world.pots), or the one its metadata implies.
export function potContents(world, x, y, z) {
  const rec = world.pots?.get(potKey(x, y, z));
  if (rec) return rec.empty ? null : rec; // b84 cmdfix84: an explicitly empty tile (EMPTY_POT) hides the metadata's plant
  return potContentsOfMeta(world.getMeta(x, y, z));
}
const validStack = (s) => !!s && Number.isInteger(s.id) && s.id > 0 && Number.isInteger(s.damage) && (s.rawDamage === undefined || (Number.isInteger(s.rawDamage) && s.rawDamage > 0));
// b81: a stored pot record (save, population hand-off, S35 description) is either a drawn plant or an undrawn registered item.
export const validPotRecord = (p) => !!p && (p.empty === true || (Number.isInteger(p.item) ? nativeItemRegistered(p.item) && Number.isInteger(p.data) : !!potPlantOf(p.id, p.damage)));
// A copy of a record with only the fields above (the drop stack copied too).
function potRecord(content) {
  if (content.empty) return { id: 0, damage: 0, empty: true };
  if (Number.isInteger(content.item)) {
    const s = content.stack;
    return { id: 0, damage: 0, item: content.item, data: content.data | 0, ...(validStack(s) ? { stack: { id: s.id, damage: s.damage, ...(s.rawDamage ? { rawDamage: s.rawDamage } : {}) } } : {}) };
  }
  return { id: content.id, damage: content.damage | 0, ...(Number.isInteger(content.data) ? { data: content.data } : {}) };
}
export function setPotContents(world, x, y, z, content) {
  const pots = (world.pots ??= new Map());
  if (content) pots.set(potKey(x, y, z), potRecord(content));
  else pots.delete(potKey(x, y, z));
}
export const serializePots = (world) => [...(world.pots ?? [])].map(([k, v]) => { const [x, y, z] = k.split(',').map(Number); return { x, y, z, ...potRecord(v) }; });
export function restorePots(world, list) {
  world.pots = new Map();
  for (const p of Array.isArray(list) ? list : [])
    if (Number.isInteger(p?.x) && Number.isInteger(p?.y) && Number.isInteger(p?.z) && validPotRecord(p)) setPotContents(world, p.x, p.y, p.z, p);
}
// BlockFlowerPot.onBlockActivated: only an empty pot takes a plant; the insertion returns true (and consumes one item
// outside Creative), anything else returns false. A pot holding an undrawn item is full too (func_145965_a is non-null).
export function potUse(world, x, y, z, heldId, heldDamage = 0) {
  if (!heldId || potContents(world, x, y, z)) return null;
  const ins = potInsertion(heldId, heldDamage);
  return ins;
}
// b81: the port stack { id, damage, rawDamage? } of the tile's ItemStack(Item, 1, Data), or null for an empty pot or an item the port does not have.
// Native breakBlock (ald.a(ahb,III,aji,int), b80 bytecode-read) drops new ItemStack(tile Item, 1, tile Data) exactly and getPickBlock / getDamageValue
// (ald.d, ald.k) pick the same pair. A record without `data` is that stack (tall grass 0/1 map to dead shrub 83 / tall grass 39). A record with `data` holds
// a stack the catalogue has no variant for (dandelion 1-15, red flower 9-15, sapling 6-15, tall grass 3-15, cobweb/cactus/mushroom/dead bush 1-15): it is the
// plant's item at damage 0 with `rawDamage` = Data (a negative Data is 0 in the ItemStack constructor). An undrawn record carries its own `stack`.
export function potStack(content) {
  if (!content) return null;
  if (Number.isInteger(content.item)) return validStack(content.stack) ? { ...content.stack } : null;
  const native = potPlantOf(content.id, content.damage);
  if (!native) return null;
  if (!Number.isInteger(content.data)) return { id: content.id, damage: content.damage | 0 };
  const [item] = native, d = Math.max(0, content.data);
  if (item === 31) return d <= 2 ? { id: TALL_GRASS_ICONS[d], damage: 0 } : { id: TALL_GRASS_ICONS[0], damage: 0, rawDamage: d };
  const base = NATIVE_TO_POT[item];
  if (d === 0 || (item === 38 && d <= 8) || (item === 6 && d <= 5)) return { id: base, damage: item === 38 || item === 6 ? d : 0 };
  return { id: base, damage: 0, rawDamage: d };
}
// A break-drop entry ({ id, count, damage, tags? }: block-break-simulation.js and population-blocks.js pass `tags` to makeStack) for a pot's content.
export const potDropEntry = (content) => { const s = potStack(content); return s ? { id: s.id, count: 1, damage: s.damage, ...(s.rawDamage ? { tags: { rawDamage: s.rawDamage } } : {}) } : null; };
// b82 pots82: BlockFlowerPot.breakBlock (ald.a(ahb,III,aji,int), bytecode-read) runs inside every server setBlock that replaces the pot: Chunk.func_150807_a
// (apx.a(IIILaji;I)Z) calls the old block's breakBlock whenever !isRemote, also for a pot replaced by a pot with another metadata. So an explosion, water or
// lava flowing in, a bucket, a piston, /setblock, the wither and the dragon all drop the tile's ItemStack(Item, 1, Data). The drop is
// Block.dropBlockAsItem(world, x, y, z, stack) (aji.a(ahb,III,add)): nothing without doTileDrops, else three world.rand floats, rand * 0.7F + 0.15 each.
// Returns the drop entry (potDropEntry) at its position, { id: 0 } when the tile holds an item the port lacks (the floats are still drawn), or null for a cell
// that is no pot or an empty pot (no draws). `rand` null: no position.
const SPREAD = Math.fround(0.7), INSET = Math.fround(1 - SPREAD) * 0.5;
export function potBreakDrop(world, x, y, z, rand = null, tileDrops = true) {
  if (world.get(x, y, z) !== FLOWER_POT) return null;
  const content = world.getMeta ? potContents(world, x, y, z) : world.pots?.get(potKey(x, y, z)) ?? null;
  return potHeldDrop(content, x, y, z, rand, tileDrops);
}
// The same drop from contents read before the cell was cleared.
export function potHeldDrop(content, x, y, z, rand = null, tileDrops = true) {
  if (!content || !tileDrops) return null;
  const e = potDropEntry(content) ?? { id: 0, count: 0, damage: 0 };
  if (!rand) return e;
  const at = () => Math.fround(rand.nextFloat() * SPREAD) + INSET;
  const px = x + at(), py = y + at(), pz = z + at();
  return { ...e, x: px, y: py, z: pz };
}
export const potEntryStack = (e, make) => make(e.id, e.count ?? 1, e.damage || 0, undefined, e.tags);
// The break drops of a pot: its contents (when Survival) and the pot item itself (harvest).
export function potDrops(world, x, y, z) {
  const s = potStack(potContents(world, x, y, z));
  return [...(s ? [{ ...s, count: 1 }] : []), { id: ITEM_FLOWER_POT, count: 1, damage: 0 }];
}
// BlockFlowerPot.getPickBlock: the plant when it holds one, else the pot. A pot holding an item the port lacks picks nothing (id 0): natively it picks that
// item. b82 pots82: the pick keeps `rawDamage` (Minecraft.middleClickMouse passes getDamageValue = the tile Data to InventoryPlayer.func_146030_a, which finds
// and makes ItemStack(item, n, Data)); main.js passes it to inventory.pick.
export function potPick(world, x, y, z) {
  const c = potContents(world, x, y, z);
  if (!c) return { id: ITEM_FLOWER_POT, damage: 0 };
  const s = potStack(c);
  return s ? { id: s.id, damage: s.damage, ...(s.rawDamage ? { rawDamage: s.rawDamage } : {}) } : { id: 0, damage: 0 };
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
