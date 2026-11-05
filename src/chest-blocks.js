// Trapped chest (original 146, internal 162) and ender chest (original 130, internal 163).
// No imports: block ids and pure rules shared by chest.js, the renderer, redstone, survival and the region code.
// Evidence: public/research/chests-reference.json (unchanged BlockChest ajx, BlockEnderChest akv, TileEntityChest aow,
// TileEntityEnderChest ape, InventoryEnderChest aav).
export const TRAPPED_CHEST = 162, ENDER_CHEST = 163;
export const ITEM_TRAPPED_CHEST = 1940, ITEM_ENDER_CHEST = 1941;
// Original block id -> item id, because ids >= 100 collide with tool items (the block-item pattern of earlier tracks).
export const CHEST_ITEMS = { 146: ITEM_TRAPPED_CHEST, 130: ITEM_ENDER_CHEST };
export const ENDER_SLOTS = 27;
// Normal chest (41) and trapped chest (162) share storage, pairing and the opening rules.
export const isChestBlock = (id) => id === 41 || id === TRAPPED_CHEST;
// Cells drawn and shaped like a chest (0.875 high, inset 1/16, no light opacity): chest, trapped chest, ender chest.
export const isChestShaped = (id) => id === 41 || id === TRAPPED_CHEST || id === ENDER_CHEST;
export const chestItemOfBlock = (id) => (id === TRAPPED_CHEST ? ITEM_TRAPPED_CHEST : id === ENDER_CHEST ? ITEM_ENDER_CHEST : 0);
export const chestBlockOfItem = (item) => (item === ITEM_TRAPPED_CHEST ? TRAPPED_CHEST : item === ITEM_ENDER_CHEST ? ENDER_CHEST : 0);

// BlockChest.func_149709_b: weak power is the viewer count clamped to 0..15 (trapped chest only); the strong value
// (BlockChest.func_149748_c) is the same only for side 1, which is the block beneath the chest.
export const trappedPower = (users) => Math.min(15, Math.max(0, users | 0));
export const trappedStrongPower = (users, side) => (side === 1 ? trappedPower(users) : 0);

// BlockEnderChest.onBlockActivated refuses to open while the block above is a normal cube.
export const enderOpenable = (aboveIsNormalCube) => !aboveIsNormalCube;

// InventoryEnderChest.loadInventoryFromNBT / saveInventoryToNBT. Entries are {slot, stack}; the slot is a signed byte
// read as `& 255`, entries outside 0..26 are dropped, and everything is cleared first.
export function loadEnderSlots(entries) {
  const items = Array(ENDER_SLOTS).fill(null);
  for (const { slot, stack } of entries || []) {
    const s = slot & 255;
    if (s < ENDER_SLOTS && stack) items[s] = stack;
  }
  return items;
}
export function saveEnderSlots(items) {
  const entries = [];
  for (let slot = 0; slot < ENDER_SLOTS; slot++) if (items?.[slot]) entries.push({ slot, stack: items[slot] });
  return entries;
}

// A fresh runtime tile for lid animation (ender chests have no saved tile data, so users and lid are not persisted).
export const newEnderTile = () => ({ users: 0, lid: 0, prevLid: 0 });

// BlockEnderChest.randomDisplayTick: three portal particles per call, drawing from the world's Random in the
// original order. Returns [name, x, y, z, vx, vy, vz] rows (doubles).
export function enderDisplayParticles(random, x, y, z) {
  const rows = [];
  for (let i = 0; i < 3; i++) {
    random.nextFloat(); // x offset, drawn first and then replaced by the quarter-block column
    const py = Math.fround(y + random.nextFloat());
    random.nextFloat(); // z offset, likewise replaced
    const dx = random.nextInt(2) * 2 - 1, dz = random.nextInt(2) * 2 - 1;
    const vx0 = (random.nextFloat() - 0.5) * 0.125, vy = (random.nextFloat() - 0.5) * 0.125, vz0 = (random.nextFloat() - 0.5) * 0.125;
    void vx0; void vz0;
    const pz = z + 0.5 + 0.25 * dz, vz = Math.fround(random.nextFloat() * 1) * dz,
      px = x + 0.5 + 0.25 * dx, vx = Math.fround(random.nextFloat() * 1) * dx;
    rows.push(["portal", px, py, pz, vx, vy, vz]);
  }
  return rows;
}

// ---------------------------------------------------------------------------------------------------------------------
// Items, materials, drops, recipes (installed by population-content.js like the shaped blocks).
export const CHEST_ITEM_NAMES = Object.freeze({ [ITEM_TRAPPED_CHEST]: 'Trapped Chest', [ITEM_ENDER_CHEST]: 'Ender Chest' });
export function installChestItems(items) {
  // The BLOCKS-derived rows for internal 162 and 163 are not items (their block items are 1940 and 1941).
  for (const id of [TRAPPED_CHEST, ENDER_CHEST]) if (items[id]) items[id].hidden = true;
  items[ITEM_TRAPPED_CHEST] = { id: ITEM_TRAPPED_CHEST, name: 'Trapped Chest', stack: 64, block: true, color: '#a06e2f' };
  items[ITEM_ENDER_CHEST] = { id: ITEM_ENDER_CHEST, name: 'Ender Chest', stack: 64, block: true, color: '#16393b' };
}
// BlockChest hardness 2.5 (axe); BlockEnderChest hardness 22.5 on rock (any pickaxe harvests it), resistance 3000 (reference facts).
export const CHEST_MATERIALS = Object.freeze({
  [TRAPPED_CHEST]: { hardness: 2.5, kind: 'axe' },
  [ENDER_CHEST]: { hardness: 22.5, kind: 'pickaxe', tier: 0 },
});
// Explosion resistance as stored by Block (resistance / 5 is the port's convention): trapped chest 2.5, ender chest 3000/5 = 600.
export const CHEST_RESISTANCE = Object.freeze({ [TRAPPED_CHEST]: 2.5, [ENDER_CHEST]: 600 });
const OBSIDIAN = 22; // internal item for original obsidian (49)
// BlockEnderChest.getItemDropped is obsidian, quantityDropped 8 (Silk Touch drops the chest itself: enchantment-effects.js SILK[130]).
export function chestDrops(id) {
  if (id === TRAPPED_CHEST) return [{ id: ITEM_TRAPPED_CHEST, count: 1 }];
  if (id === ENDER_CHEST) return [{ id: OBSIDIAN, count: 8 }];
  return null;
}
