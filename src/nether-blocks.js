// Nether, End and quartz building blocks of Minecraft Java 1.7.10 usable in the Overworld (no Nether dimension):
// netherrack 87, soul sand 88, End stone 121, nether brick 112, nether brick fence 113, nether brick stairs 114,
// nether quartz ore 153, block of quartz 155, quartz stairs 156, the nether brick item 405 and the nether brick (44:6) and
// quartz (44:7) stone slabs. Every rule is replayed against the unchanged classes by src/nether-blocks.test.js
// (public/research/nether-blocks-reference.json, tools/verify-nether-blocks.mjs); notes in public/research/nether-blocks.md.
//
// Internal ids are 150-158 (block id = item id, since only 100-127 collide with tool items) and 520 for the nether brick
// item; the nether quartz item (original 406) already exists as internal 382 (redstone-blocks-2.js).
// This module imports nothing so world.js and the render/physics modules can all use it.

export const NETHERRACK = 150, SOUL_SAND = 151, END_STONE = 152, NETHER_BRICK = 153, NETHER_FENCE = 154, NETHER_BRICK_STAIRS = 155,
  QUARTZ_ORE = 156, QUARTZ_BLOCK = 157, QUARTZ_STAIRS = 158;
export const NETHER_BRICK_ITEM = 520, NETHER_QUARTZ = 382;
export const NETHER_FIRST = 150, NETHER_LAST = 158;
export const isNetherBlock = (id) => id >= NETHER_FIRST && id <= NETHER_LAST;
export const isNetherFence = (id) => id === NETHER_FENCE;
export const isNetherStair = (id) => id === NETHER_BRICK_STAIRS || id === QUARTZ_STAIRS;

// Internal block id -> original 1.7.10 block id.
export const NETHER_ORIGINAL = Object.freeze({ 150: 87, 151: 88, 152: 121, 153: 112, 154: 113, 155: 114, 156: 153, 157: 155, 158: 156 });
// Original item id (or "id:damage") -> internal item, merged into ORIGINAL_ITEMS and tools/inventory-replay.mjs MC_IDS.
export const NETHER_ITEMS = Object.freeze({ 87: 150, 88: 151, 121: 152, 112: 153, 113: 154, 114: 155, 153: 156, 155: 157, 156: 158, 405: NETHER_BRICK_ITEM });

// Block.blockHardness / blockResistance (field = resistance * 3; getExplosionResistance = field / 5) and the Material tool class.
// resistance here is the original `blockResistance` field (nether-blocks-reference.json "resistanceField").
export const NETHER_FACTS = Object.freeze({
  150: { name: 'Netherrack', color: '#6f3a3a', hardness: 0.4, resistance: 2, kind: 'pickaxe', sound: 'stone' },
  151: { name: 'Soul Sand', color: '#52403a', hardness: 0.5, resistance: 2.5, kind: 'shovel', sound: 'sand' },
  152: { name: 'End Stone', color: '#dcdca0', hardness: 3, resistance: 45, kind: 'pickaxe', sound: 'stone' },
  153: { name: 'Nether Brick', color: '#2c161b', hardness: 2, resistance: 30, kind: 'pickaxe', sound: 'stone' },
  154: { name: 'Nether Brick Fence', color: '#2c161b', hardness: 2, resistance: 30, kind: 'pickaxe', sound: 'stone' },
  155: { name: 'Nether Brick Stairs', color: '#2c161b', hardness: 2, resistance: 30, kind: 'pickaxe', sound: 'stone' },
  156: { name: 'Nether Quartz Ore', color: '#7d5a52', hardness: 3, resistance: 15, kind: 'pickaxe', sound: 'stone' },
  157: { name: 'Block of Quartz', color: '#e9e5dc', hardness: 0.8, resistance: 4, kind: 'pickaxe', sound: 'stone' },
  158: { name: 'Quartz Stairs', color: '#e9e5dc', hardness: 0.8, resistance: 4, kind: 'pickaxe', sound: 'stone' },
});
export const QUARTZ_NAMES = Object.freeze(['Block of Quartz', 'Chiseled Quartz Block', 'Pillar Quartz Block']);

// world.js calls this once after the BLOCKS literal. Ids 140-149 belong to other content tracks; any of them still empty
// (or any id below 150 left unset) is filled with a hidden reserved placeholder so BLOCKS stays a dense array.
export function installNetherBlocks(blocks) {
  for (const [id, f] of Object.entries(NETHER_FACTS)) blocks[id] = { name: f.name, color: f.color };
  for (let i = 0; i < NETHER_FIRST; i++) if (!blocks[i]) blocks[i] = { name: 'Reserved ' + i, color: '#ff00ff', hidden: true, reserved: true };
}

// survival.js: block items (auto-created from BLOCKS) get their variants; the nether brick item is new.
export function installNetherItems(items) {
  items[QUARTZ_BLOCK].variants = [...QUARTZ_NAMES];
  items[NETHER_BRICK_ITEM] = { id: NETHER_BRICK_ITEM, name: 'Nether Brick', texture: 'netherbrick', stack: 64, color: '#2c161b', glyph: '▪' };
}
// MATERIALS: hardness, tool class, tier 0 (rock needs any pickaxe; soul sand is dug faster with a shovel and needs none).
export function installNetherMaterials(m) {
  for (const [id, f] of Object.entries(NETHER_FACTS)) m[id] = f.kind === 'pickaxe' ? { hardness: f.hardness, kind: 'pickaxe', tier: 0 } : { hardness: f.hardness, kind: f.kind };
  // BlockOre.getItemDropped: nether quartz ore drops the quartz item (one, 2-5 experience: populationXp).
  m[QUARTZ_ORE] = { hardness: 3, kind: 'pickaxe', tier: 0, drop: NETHER_QUARTZ };
}
// BlockOre experience for the plain (unenchanted) break: MathHelper.getRandomIntegerInRange(rand, 2, 5).
export const quartzOreXp = (random) => 2 + Math.floor(random() * 4);

// CraftingManager shaped recipes whose ingredients ignore damage; the damage-sensitive ones are netherCraftingResult.
export function installNetherRecipes({ recipe }) {
  recipe('nether-brick', 'Nether Brick', ['##', '##'], { '#': NETHER_BRICK_ITEM }, NETHER_BRICK);
  recipe('nether-brick-fence', 'Nether Brick Fence', ['###', '###'], { '#': NETHER_BRICK }, NETHER_FENCE, 6);
  recipe('quartz-block', 'Block of Quartz', ['##', '##'], { '#': NETHER_QUARTZ }, QUARTZ_BLOCK);
}
// FurnaceRecipes: netherrack -> nether brick (0.1 experience), nether quartz ore -> quartz (0.2).
export function installNetherSmelting(smelting) {
  Object.assign(smelting, { [NETHERRACK]: NETHER_BRICK_ITEM, [QUARTZ_ORE]: NETHER_QUARTZ });
}
export const NETHER_SMELT_EXPERIENCE = Object.freeze({ [NETHER_BRICK_ITEM]: 0.1, [NETHER_QUARTZ]: 0.2 });

const ITEM_STONE_SLAB = 1103;
// Damage-sensitive recipes (original ingredient damage is 32767 = any unless noted):
//   3 nether bricks (153) in a row -> 6 slabs 44:6;  3 quartz blocks (155, any damage) -> 6 slabs 44:7
//   2 quartz slabs (44:7) in a column -> chiseled quartz (155:1);  2 plain quartz blocks (155:0) in a column -> pillar (155:2) x2
//   6 nether bricks / 6 quartz blocks in the stair shape -> 4 stairs (stairs.js stairRecipeResult)
export function netherCraftingResult(cells, size) {
  const filled = cells.filter(Boolean);
  if (filled.length === 3) {
    for (let y = 0; y < size; y++) for (let x = 0; x <= size - 3; x++) {
      const row = [cells[y * size + x], cells[y * size + x + 1], cells[y * size + x + 2]];
      if (row.every((s) => s?.id === NETHER_BRICK)) return { id: ITEM_STONE_SLAB, count: 6, damage: 6 };
      if (row.every((s) => s?.id === QUARTZ_BLOCK)) return { id: ITEM_STONE_SLAB, count: 6, damage: 7 };
    }
  }
  if (filled.length === 2) {
    for (let i = 0; i < cells.length - size; i++) {
      const a = cells[i], b = cells[i + size];
      if (a?.id === ITEM_STONE_SLAB && b?.id === ITEM_STONE_SLAB && (a.damage ?? 0) === 7 && (b.damage ?? 0) === 7 && filled.length === 2) return { id: QUARTZ_BLOCK, count: 1, damage: 1 };
      if (a?.id === QUARTZ_BLOCK && b?.id === QUARTZ_BLOCK && (a.damage ?? 0) === 0 && (b.damage ?? 0) === 0) return { id: QUARTZ_BLOCK, count: 2, damage: 2 };
    }
  }
  return null;
}

// BlockQuartz.onBlockPlaced: metadata 2 (the pillar) takes its axis from the clicked side (north/south face 3 -> meta 4,
// west/east face -> meta 3, otherwise 2 = vertical); other metadata is kept. `side` is Minecraft's 0..5 (bottom, top, north,
// south, west, east); the live placement code passes the same numbering to stairPlacementMeta.
export function quartzPlacedMeta(damage, side) {
  if (damage === 2) return side === 2 || side === 3 ? 4 : side === 4 || side === 5 ? 3 : 2;
  return damage;
}
// BlockQuartz.damageDropped: the pillar axes (3, 4) drop the vertical pillar (2).
export const quartzDropDamage = (meta) => (meta !== 3 && meta !== 4 ? meta : 2);

// BlockQuartz.getIcon by this renderer's face index (block-textures.js): 0/1 = +/-x, 2 top, 3 bottom, 4/5 = +/-z.
// The icon names come from nether-blocks-reference.json (icons rows).
export function quartzTexture(meta, face) {
  const m = meta & 7, top = face === 2, bottom = face === 3;
  if (m === 1) return top || bottom ? 'quartz_block_chiseled_top' : 'quartz_block_chiseled';
  if (m === 2) return top || bottom ? 'quartz_block_lines_top' : 'quartz_block_lines';
  // Pillars on their side (icons rows): meta 3 has its end caps on Minecraft sides 4 and 5 (west/east = renderer faces 0 and 1),
  // meta 4 on sides 2 and 3 (north/south = renderer faces 4 and 5).
  if (m === 3) return face === 0 || face === 1 ? 'quartz_block_lines_top' : 'quartz_block_lines';
  if (m === 4) return face === 4 || face === 5 ? 'quartz_block_lines_top' : 'quartz_block_lines';
  return top ? 'quartz_block_top' : bottom ? 'quartz_block_bottom' : 'quartz_block_side';
}

// BlockSoulSand.getCollisionBoundingBoxFromPool: 1 - 0.125 high; the selection box stays the full cube.
export const SOUL_SAND_COLLISION = Object.freeze([0, 0, 0, 1, 0.875, 1]);
// BlockSoulSand.onEntityCollidedWithBlock: motionX and motionZ * 0.4, once per overlapped cell.
export const SOUL_SAND_SLOWDOWN = 0.4;
