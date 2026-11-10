// Shared IInventory insertion / extraction helper: the static methods of Minecraft Java 1.7.10 TileEntityHopper (api)
// ported over a small adapter, plus the lookup of the container at a block position (func_145893_b -> BlockChest.func_149951_m).
// Hoppers use it; droppers and dispensers (track "dispenser"/"dropper") may call insertStack / containerAt for their own
// TileEntityDispenser.func_146019_a (addItemStack) behaviour.
//
// Adapter ("IInventory"):
//   { key, keys[], size, get(i), set(i, stack|null), valid(i, stack), sides|null, received?() }
//   sides (ISidedInventory): { slots(side) -> int[], canInsert(i, stack, side), canExtract(i, stack, side) }
//   set() clamps to getInventoryStackLimit (64); every adapter reports its block keys through `host.changed(keys)` after a write.
// Sides are Facing indices: 0 down, 1 up, 2 north, 3 south, 4 west, 5 east.
//
//   host = { world, chests(), furnaces(), dispensers(), hoppers(), maxStack(stack), burnTime(stack), changed(keys) }
import { copyStack, sameStackItem, LargeChestInventory } from "./inventory.js";
import { openChest } from "./chest.js";
import { accessibleSlots as brewingSlots, isItemValidForSlot as brewingValid, newBrewingTile } from "./brewing.js";

export const BLOCK_FURNACE = 14, BLOCK_CHEST = 41, BLOCK_DISPENSER = 115, BLOCK_DROPPER = 132, BLOCK_HOPPER = 133, BLOCK_BREWING_STAND = 134;
export const HOPPER_SLOTS = 5, TRANSFER_COOLDOWN = 8, BUCKET = 340, /* internal id of the empty bucket (original 325) */ STACK_LIMIT = 64;
// TileEntityFurnace.slotsTop / slotsBottom / slotsSides.
const FURNACE_SIDES = { 0: [2, 1], 1: [0] };

const clamp = (s) => { if (s && s.count > STACK_LIMIT) s.count = STACK_LIMIT; return s; };

export function arrayAdapter(key, items, extra = {}) {
  return {
    key, keys: [key], size: items.length, sides: null,
    get: (i) => items[i] ?? null,
    set: (i, s) => { items[i] = clamp(s); },
    valid: () => true,
    ...extra,
  };
}

// TileEntityFurnace: ISidedInventory; isItemValidForSlot refuses the output slot and non-fuel in the fuel slot; extraction
// from the bottom skips the fuel slot unless it holds an empty bucket.
export function furnaceAdapter(key, tile, burnTime) {
  return arrayAdapter(key, tile.items, {
    valid: (i, s) => (i === 2 ? false : i === 1 ? burnTime(s) > 0 : true),
    sides: {
      slots: (side) => FURNACE_SIDES[side] ?? [1],
      canInsert: () => true, // canInsertItem == isItemValidForSlot, already checked by canInsert()
      canExtract: (i, s, side) => side !== 0 || i !== 1 || s.id === BUCKET,
    },
  });
}

// func_145893_b: the inventory of a block position, or null. A chest with a normal cube above it (or above its partner)
// is closed to hoppers (BlockChest.func_149951_m); ocelots and minecart inventories are not modelled.
export function containerAt(host, x, y, z) {
  const id = host.world.get(x, y, z), key = `${x},${y},${z}`;
  if (id === BLOCK_CHEST || id === 162) { // chest or trapped chest (chests pair only with their own kind)
    host.seedChest?.(x, y, z); // a chest of a never-resident chunk gets its generated loot first (ring-chests.js)
    const chests = host.chests(), open = openChest(host.world, chests, x, y, z);
    if (!open) return null;
    const inv = open.inventory, parts = inv instanceof LargeChestInventory;
    return {
      key, keys: open.keys, size: inv.size, sides: null, valid: () => true,
      get: (i) => inv.getStack(i),
      set: (i, s) => { inv.setStack(i, clamp(s)); },
      parts,
    };
  }
  if (id === BLOCK_FURNACE) {
    const furnaces = host.furnaces(), tile = (furnaces[key] ??= { items: [null, null, null], burn: 0, burnTotal: 0, cook: 0 });
    return furnaceAdapter(key, tile, host.burnTime);
  }
  if (id === BLOCK_DISPENSER || id === BLOCK_DROPPER) {
    const d = host.dispensers();
    return arrayAdapter(key, (d[key] ??= { items: Array(9).fill(null) }).items);
  }
  if (id === BLOCK_HOPPER) {
    const h = host.hoppers(), tile = (h[key] ??= newHopperTile());
    return arrayAdapter(key, tile.items, { hopper: tile, received: () => { tile.cooldown = TRANSFER_COOLDOWN; } });
  }
  if (id === BLOCK_BREWING_STAND && host.brewing) {
    // TileEntityBrewingStand (ISidedInventory): the top reaches the ingredient, other sides the bottles; canExtractItem is always true.
    const b = host.brewing(), tile = (b[key] ??= newBrewingTile());
    return arrayAdapter(key, tile.items, {
      valid: (i, s) => brewingValid(i, s),
      sides: { slots: (side) => brewingSlots(side), canInsert: () => true, canExtract: () => true },
    });
  }
  return null;
}
export const newHopperTile = () => ({ items: Array(HOPPER_SLOTS).fill(null), cooldown: 0, name: null });

// func_152102_a / func_152103_b: the slots a side can reach are all empty / all full.
const slotsFor = (inv, side) => (inv.sides && side > -1 ? inv.sides.slots(side) : Array.from({ length: inv.size }, (_, i) => i));
export function isInventoryEmpty(inv, side) {
  for (const i of slotsFor(inv, side)) if (inv.get(i)) return false;
  return true;
}
export function isInventoryFull(inv, side, maxStack) {
  for (const i of slotsFor(inv, side)) { const s = inv.get(i); if (!s || s.count !== maxStack(s)) return false; }
  return true;
}
// func_145885_a: isItemValidForSlot, then ISidedInventory.canInsertItem.
export const canInsert = (inv, stack, slot, side) => inv.valid(slot, stack) && (!inv.sides || side < 0 || inv.sides.canInsert(slot, stack, side) !== false);
// func_145894_a: same item, damage and tags, and the target is not over its own stack size.
export const canMerge = (cur, stack, maxStack) => sameStackItem(cur, stack) && cur.count <= maxStack(cur);

// func_145899_c: put (part of) `stack` into one slot. Returns the remainder (null when emptied).
function insertSlot(inv, stack, slot, side, maxStack) {
  const cur = inv.get(slot);
  if (!canInsert(inv, stack, slot, side)) return stack;
  let moved = false;
  if (!cur) { inv.set(slot, stack); stack = null; moved = true; }
  else if (canMerge(cur, stack, maxStack)) {
    const n = Math.min(stack.count, maxStack(stack) - cur.count);
    stack.count -= n; cur.count += n; moved = n > 0;
  }
  if (moved) inv.received?.();
  return stack;
}
// func_145889_a: insert a stack through a side (-1 = no side restriction), returning the remainder or null.
// Callers must have copied `stack`; it is consumed. `host.changed` is the caller's job (see `touch`).
export function insertStack(inv, stack, side, maxStack) {
  for (const slot of slotsFor(inv, side)) {
    if (!stack || stack.count <= 0) break;
    stack = insertSlot(inv, stack, slot, side, maxStack);
  }
  return stack && stack.count === 0 ? null : stack;
}

// func_145892_a: move one item from slot `slot` of `above` into the hopper inventory. True when it moved.
export function pullSlot(hopperInv, above, slot, side, maxStack) {
  const s = above.get(slot);
  if (!s || (above.sides && !above.sides.canExtract(slot, s, side))) return false;
  const before = copyStack(s), one = copyStack({ ...s, count: Math.min(1, s.count) }); // decrStackSize(slot, 1) hands over a size-0 stack whole
  s.count--; if (s.count <= 0) above.set(slot, null);
  const rest = insertStack(hopperInv, one, -1, maxStack);
  if (!rest || rest.count === 0) return true;
  above.set(slot, before);
  return false;
}
// func_145891_a, inventory branch: the first item that fits. `above` is read from side 0 (down).
export function suckFromInventory(hopperInv, above, maxStack) {
  if (isInventoryEmpty(above, 0)) return false;
  for (const slot of slotsFor(above, 0)) if (pullSlot(hopperInv, above, slot, 0, maxStack)) return true;
  return false;
}
// func_145883_k: push one item into the inventory the hopper faces; `side` is the opposite of the facing.
export function pushOne(hopperInv, target, side, maxStack) {
  if (isInventoryFull(target, side, maxStack)) return false;
  for (let j = 0; j < hopperInv.size; j++) {
    const s = hopperInv.get(j);
    if (!s) continue;
    const before = copyStack(s), one = copyStack({ ...s, count: Math.min(1, s.count) }); // a size-0 stack moves whole and inserts nothing
    s.count--; if (s.count <= 0) hopperInv.set(j, null);
    const rest = insertStack(target, one, side, maxStack);
    if (!rest || rest.count === 0) return true;
    hopperInv.set(j, before);
  }
  return false;
}
// func_145898_a: take an item entity (stack in `entity.stack`) into the hopper; true when the whole stack went in.
export function pickUpEntity(hopperInv, entity, maxStack) {
  if (!entity) return false;
  const rest = insertStack(hopperInv, copyStack(entity.stack), -1, maxStack);
  if (rest && rest.count !== 0) { entity.stack = rest; return false; }
  return true;
}
// The distinct block keys of the inventories involved, for comparators and the save flag.
export const touch = (host, ...invs) => host.changed?.([...new Set(invs.flatMap((i) => (i ? i.keys : [])))]);
// Container.calcRedstoneFromInventory over an adapter (null reads 0): floor(sum(count / min(64, max)) / size * 14) + (any ? 1 : 0).
export function inventorySignal(inv, maxStack) {
  if (!inv) return 0;
  let n = 0, f = Math.fround(0);
  for (let i = 0; i < inv.size; i++) {
    const s = inv.get(i);
    if (s) { f = Math.fround(f + Math.fround(s.count / Math.min(STACK_LIMIT, maxStack(s)))); n++; }
  }
  return Math.floor(Math.fround(Math.fround(f / inv.size) * 14)) + (n > 0 ? 1 : 0);
}
