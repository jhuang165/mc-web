// Colored and storage blocks of 1.7.10 (public/research/colored-blocks-reference.json, tools/probes/ColoredBlocksProbe.java):
// stained glass (95) and its pane (160), carpet (171), hay bale (170), the coal (173), lapis (22) and emerald (133)
// blocks, the sponge (19) and the jack o'lantern (91). Internal block ids 140-148, item ids 1000 + block id (the plain ids
// above 100 belong to tools). Only world.js is imported, so doors-panes.js and the shared tables can use this module.
// No imports: world.js, doors-panes.js and the shared tables import this module, so it must not close a cycle.
export const STAINED_GLASS = 140, STAINED_GLASS_PANE = 141, CARPET = 142, HAY_BALE = 143, COAL_BLOCK = 144, LAPIS_BLOCK = 145, EMERALD_BLOCK = 146, SPONGE = 147, JACK_O_LANTERN = 148;
const WOOL = 19, DYE = 351; // internal wool item id (world.js WOOL) and the dye item id (world.js DYE)
// ItemCloth/BlockColored colour names in metadata order (the lang file's colour words, as world.js WOOL_COLORS labels).
const WOOL_LABELS = ['White', 'Orange', 'Magenta', 'Light blue', 'Yellow', 'Lime', 'Pink', 'Gray', 'Light gray', 'Cyan', 'Purple', 'Blue', 'Brown', 'Green', 'Red', 'Black'];

export const COLORED_BLOCKS = [STAINED_GLASS, STAINED_GLASS_PANE, CARPET, HAY_BALE, COAL_BLOCK, LAPIS_BLOCK, EMERALD_BLOCK, SPONGE, JACK_O_LANTERN];
export const COLORED_ITEM_OFFSET = 1000;
// Original block id -> internal block id.
export const COLORED_ORIGINAL = Object.freeze({ 95: STAINED_GLASS, 160: STAINED_GLASS_PANE, 171: CARPET, 170: HAY_BALE, 173: COAL_BLOCK, 22: LAPIS_BLOCK, 133: EMERALD_BLOCK, 19: SPONGE, 91: JACK_O_LANTERN });
// Original item id -> internal item id (spread into ORIGINAL_ITEMS and tools/inventory-replay.mjs MC_IDS).
export const COLORED_ORIGINAL_ITEMS = Object.freeze(Object.fromEntries(Object.entries(COLORED_ORIGINAL).map(([mc, id]) => [mc, id + COLORED_ITEM_OFFSET])));
// ItemCloth blocks whose stack damage is the colour (the stack damage equals the metadata).
export const COLORED_VARIANT_DAMAGE = Object.freeze(new Set([95, 160, 171]));

export const isColoredBlock = (b) => b >= STAINED_GLASS && b <= JACK_O_LANTERN;
export const coloredItemId = (block) => (isColoredBlock(block) ? block + COLORED_ITEM_OFFSET : 0);
export const coloredItemBlock = (item) => (item >= STAINED_GLASS + COLORED_ITEM_OFFSET && item <= JACK_O_LANTERN + COLORED_ITEM_OFFSET ? item - COLORED_ITEM_OFFSET : 0);
export const isStainedGlass = (b) => b === STAINED_GLASS;
export const isStainedPane = (b) => b === STAINED_GLASS_PANE;
export const isCarpet = (b) => b === CARPET;
export const CARPET_HEIGHT = 1 / 16;
// BlockCarpet.setBlockBoundsForCarpet: the selection box is 1/16 high; its collision box (func_149668_a) is flat
// (maxY 0), so entities do not stand on it but on the block below.
export const carpetBounds = () => [0, 0, 0, 1, CARPET_HEIGHT, 1];

// Block.func_149646_a for BlockStainedGlass (BlockBreakable): a face against the same block with the same metadata is not drawn (the class compares both before the identity check).
export const stainedGlassFaceHidden = (self, neighbour, selfMeta = 0, neighbourMeta = 0) => neighbour === self && selfMeta === neighbourMeta;

// Metadata an item places with: ItemCloth/ItemColored damage for the three coloured blocks, BlockRotatedPillar
// (func_149660_a) for the hay bale (damage & 3 plus an axis from the clicked side), and the player's facing for the jack
// o'lantern and pumpkin (BlockPumpkin.func_149689_a).
export const hayPlacedMeta = (damage, side) => (damage & 3) | (side === 2 || side === 3 ? 8 : side === 4 || side === 5 ? 4 : 0);
// BlockPumpkin.onBlockPlacedBy: floor(yaw * 4 / 360 + 0.5) & 3 and metadata 2, 3, 0, 1 for those values. `yaw` is the
// Minecraft rotationYaw in degrees (180 - camera yaw in degrees).
export const pumpkinFacingMeta = (minecraftYaw) => [2, 3, 0, 1][Math.floor((Math.fround(minecraftYaw) * 4) / 360 + 0.5) & 3];
export function coloredPlacedMeta(block, damage, side, minecraftYaw) {
  if (block === STAINED_GLASS || block === STAINED_GLASS_PANE || block === CARPET) return damage & 15;
  if (block === HAY_BALE) return hayPlacedMeta(damage, side);
  if (block === JACK_O_LANTERN) return pumpkinFacingMeta(minecraftYaw);
  return 0;
}
// BlockCarpet.canPlaceBlockAt / func_149718_j (canBlockStay): any non-air block below.
export const carpetCanStay = (world, x, y, z) => world.get(x, y - 1, z) !== 0;
// BlockCarpet.onNeighborBlockChange (func_150090_e): an unsupported carpet drops itself and disappears.
// Returns the removed carpet's drop ({id,count,damage}) or null.
export function carpetNeighbourChange(world, x, y, z) {
  if (world.get(x, y, z) !== CARPET || carpetCanStay(world, x, y, z)) return null;
  const damage = world.getMeta(x, y, z);
  world.set(x, y, z, 0);
  return { id: CARPET + COLORED_ITEM_OFFSET, count: 1, damage };
}

// Block.getItemDropped / damageDropped (probe rows kind "drops"): stained glass and its pane drop nothing, carpet
// drops itself with its colour, hay (BlockRotatedPillar.damageDropped) with meta & 3, the rest themselves.
export function coloredDrops(block, meta) {
  if (!isColoredBlock(block)) return null;
  if (block === STAINED_GLASS || block === STAINED_GLASS_PANE) return [];
  const item = block + COLORED_ITEM_OFFSET;
  if (block === CARPET) return [{ id: item, count: 1, damage: meta & 15 }];
  if (block === HAY_BALE) return [{ id: item, count: 1, damage: meta & 3 }];
  return [{ id: item, count: 1, damage: 0 }];
}
// Block.getDamageValue (Creative pick block): the metadata of the three colours, hay meta & 3.
export const coloredPickDamage = (block, meta) => (block === STAINED_GLASS || block === STAINED_GLASS_PANE || block === CARPET ? meta & 15 : block === HAY_BALE ? meta & 3 : 0);

// Item registrations; `ITEMS[block]` (the stray block-id entries 140-148) stay for completeness but are hidden.
export function installColoredItems(items) {
  const variants = { [STAINED_GLASS]: WOOL_LABELS.map((n) => n + ' stained glass'), [STAINED_GLASS_PANE]: WOOL_LABELS.map((n) => n + ' stained glass pane'), [CARPET]: WOOL_LABELS.map((n) => n + ' carpet') };
  for (const block of COLORED_BLOCKS) {
    const item = block + COLORED_ITEM_OFFSET;
    items[item] = { ...items[block], id: item, block: true, stack: 64, hidden: undefined };
    if (variants[block]) items[item].variants = variants[block];
  }
}
// Block hardness and tools (probe rows "block" and "harvest"): glass 0.3, carpet 0.1, hay 0.5, sponge 0.6 and the jack
// o'lantern 1.0 need no tool; coal 5 (wooden pickaxe), lapis 3 (stone), emerald 5 (iron). `drop: 0` drops nothing.
export function installColoredMaterials(m) {
  m[STAINED_GLASS] = { hardness: 0.3, drop: 0 };
  m[STAINED_GLASS_PANE] = { hardness: 0.3, drop: 0 };
  m[CARPET] = { hardness: 0.1, drop: CARPET + COLORED_ITEM_OFFSET };
  m[HAY_BALE] = { hardness: 0.5, drop: HAY_BALE + COLORED_ITEM_OFFSET };
  m[COAL_BLOCK] = { hardness: 5, kind: 'pickaxe', tier: 0, drop: COAL_BLOCK + COLORED_ITEM_OFFSET };
  m[LAPIS_BLOCK] = { hardness: 3, kind: 'pickaxe', tier: 1, drop: LAPIS_BLOCK + COLORED_ITEM_OFFSET };
  m[EMERALD_BLOCK] = { hardness: 5, kind: 'pickaxe', tier: 2, drop: EMERALD_BLOCK + COLORED_ITEM_OFFSET };
  m[SPONGE] = { hardness: 0.6, drop: SPONGE + COLORED_ITEM_OFFSET };
  m[JACK_O_LANTERN] = { hardness: 1, kind: 'axe', drop: JACK_O_LANTERN + COLORED_ITEM_OFFSET };
}
// TileEntityFurnace.getItemBurnTime (probe rows "fuel"): a block of coal burns 16000 ticks; hay, carpet, glass and wool burn 0.
export const COLORED_FUELS = Object.freeze({ [COAL_BLOCK + COLORED_ITEM_OFFSET]: 16000 });

// ---- crafting (probe rows "craft" and "recipe") ----
// Item ids of the ingredients in this build.
const GLASS = 9, WHEAT = 305, COAL = 301, EMERALD = 367, TORCH = 20, PUMPKIN = 67;
const item = (block) => block + COLORED_ITEM_OFFSET;
const at = (cells, size, x, y) => (x >= 0 && y >= 0 && x < size && y < size ? cells[y * size + x] : null);
// CraftingManager recipes of these blocks. Shaped recipes are matched on the grid offset and (for the colour) damage:
//   8 glass around a dye -> 8 stained glass (damage 15 - dye), 6 stained glass of one colour (3x2) -> 16 panes,
//   2 wool of one colour (2x1) -> 3 carpet, 9 wheat <-> hay bale, 9 coal / lapis dye / emerald <-> their blocks,
//   pumpkin above a torch -> jack o'lantern. Returns {id,count,damage} or null.
export function coloredCraftingResult(cells, size) {
  const filled = cells.filter(Boolean);
  const same = (pred) => filled.every(pred);
  if (filled.length === 9 && size === 3) {
    if (cells[4]?.id === DYE && cells.every((s, i) => i === 4 || s?.id === GLASS)) return { id: item(STAINED_GLASS), count: 8, damage: 15 - (cells[4].damage & 15) };
    if (same((s) => s.id === WHEAT)) return { id: item(HAY_BALE), count: 1, damage: 0 };
    if (same((s) => s.id === COAL && !s.damage)) return { id: item(COAL_BLOCK), count: 1, damage: 0 };
    if (same((s) => s.id === DYE && s.damage === 4)) return { id: item(LAPIS_BLOCK), count: 1, damage: 0 };
    if (same((s) => s.id === EMERALD)) return { id: item(EMERALD_BLOCK), count: 1, damage: 0 };
    return null;
  }
  if (filled.length === 6 && size >= 3 && same((s) => s.id === item(STAINED_GLASS) && s.damage === filled[0].damage)) {
    for (let y = 0; y <= size - 2; y++) for (let x = 0; x <= size - 3; x++)
      if ([0, 1, 2].every((i) => at(cells, size, x + i, y) && at(cells, size, x + i, y + 1))) return { id: item(STAINED_GLASS_PANE), count: 16, damage: filled[0].damage & 15 };
    return null;
  }
  if (filled.length === 2 && same((s) => s.id === WOOL && s.damage === filled[0].damage)) {
    for (let y = 0; y < size; y++) for (let x = 0; x < size - 1; x++)
      if (at(cells, size, x, y) && at(cells, size, x + 1, y)) return { id: item(CARPET), count: 3, damage: filled[0].damage & 15 };
    return null;
  }
  if (filled.length === 2 && size >= 2) {
    for (let y = 0; y < size - 1; y++) for (let x = 0; x < size; x++)
      if (at(cells, size, x, y)?.id === PUMPKIN && at(cells, size, x, y + 1)?.id === TORCH) return { id: item(JACK_O_LANTERN), count: 1, damage: 0 };
    return null;
  }
  if (filled.length === 1) {
    const s = filled[0];
    if (s.id === item(HAY_BALE)) return { id: WHEAT, count: 9, damage: 0 };
    if (s.id === item(COAL_BLOCK)) return { id: COAL, count: 9, damage: 0 };
    if (s.id === item(LAPIS_BLOCK)) return { id: DYE, count: 9, damage: 4 };
    if (s.id === item(EMERALD_BLOCK)) return { id: EMERALD, count: 9, damage: 0 };
  }
  return null;
}

