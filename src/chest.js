// Minecraft Java 1.7.10 BlockChest (ajx) and TileEntityChest (aow) rules:
// placement limits, facing metadata, double-chest pairing, opening checks and
// the lid timer. `world` needs get(x,y,z); chests maps "x,y,z" to tile state.
import { StackArray, LargeChestInventory } from "./inventory.js";
import { opaqueCube, normalCube } from "./world.js";
import { isChestBlock } from "./chest-blocks.js";

export const CHEST = 41, CHEST_SLOTS = 27;
// Facing metadata: 2 north (-z), 3 south (+z), 4 west (-x), 5 east (+x).
export const FACING = { 2: [0, -1], 3: [0, 1], 4: [-1, 0], 5: [1, 0] };
const SIDES = [[0, 0, -1], [0, 0, 1], [-1, 0, 0], [1, 0, 0]];
export const chestKey = (x, y, z) => `${x},${y},${z}`;

export function newChest(facing = 3) {
  return { items: Array(CHEST_SLOTS).fill(null), facing, users: 0, lid: 0, prevLid: 0 };
}
// Chests pair only with their own kind (TileEntityChest.func_145977_a: same BlockChest type), so every check below
// compares against `kind`: the cell's own block id, or the normal chest for a cell that is not set yet.
const kindAt = (world, x, y, z) => { const id = world.get(x, y, z); return isChestBlock(id) ? id : CHEST; };
// func_149952_n: a chest that already has a chest of its kind beside it.
function isDouble(world, x, y, z, kind) {
  return world.get(x, y, z) === kind && SIDES.some(([dx, , dz]) => world.get(x + dx, y, z + dz) === kind);
}
// canPlaceBlockAt: at most one neighbouring chest of this kind, and that one still single.
export function canPlaceChest(world, x, y, z, kind = CHEST) {
  let n = 0;
  for (const [dx, , dz] of SIDES) if (world.get(x + dx, y, z + dz) === kind) n++;
  if (n > 1) return false;
  return !SIDES.some(([dx, , dz]) => isDouble(world, x + dx, y, z + dz, kind));
}
// onBlockPlacedBy: the chest faces the player. `yaw` is this game's camera yaw
// (0 looks north); Minecraft's rotationYaw is 180 degrees minus it.
export function placementFacing(yaw) {
  const mcYaw = Math.fround(180 - (yaw * 180) / Math.PI),
    l = Math.floor(Math.fround(Math.fround(mcYaw * 4) / 360) + 0.5) & 3;
  return [2, 5, 3, 4][l];
}
// func_149954_e: facing from opaque neighbours, aligned with a partner chest.
export function settleFacing(world, chests, x, y, z, kind = kindAt(world, x, y, z)) {
  const at = (dx, dz, ox = x, oz = z) => world.get(ox + dx, y, oz + dz),
    north = at(0, -1), south = at(0, 1), west = at(-1, 0), east = at(1, 0),
    o = opaqueCube;
  let facing = 4;
  if (north === kind || south === kind) {
    const pz = north === kind ? z - 1 : z + 1, w2 = at(-1, 0, x, pz), e2 = at(1, 0, x, pz);
    facing = 5;
    if (chests[chestKey(x, y, pz)]?.facing === 4) facing = 4;
    if ((o(west) || o(w2)) && !o(east) && !o(e2)) facing = 5;
    if ((o(east) || o(e2)) && !o(west) && !o(w2)) facing = 4;
  } else if (west === kind || east === kind) {
    const px = west === kind ? x - 1 : x + 1, n2 = at(0, -1, px, z), s2 = at(0, 1, px, z);
    facing = 3;
    if (chests[chestKey(px, y, z)]?.facing === 2) facing = 2;
    if ((o(north) || o(n2)) && !o(south) && !o(s2)) facing = 3;
    if ((o(south) || o(s2)) && !o(north) && !o(n2)) facing = 2;
  } else {
    facing = 3;
    if (o(north) && !o(south)) facing = 3;
    if (o(south) && !o(north)) facing = 2;
    if (o(west) && !o(east)) facing = 5;
    if (o(east) && !o(west)) facing = 4;
  }
  (chests[chestKey(x, y, z)] ??= newChest()).facing = facing;
}
// World.setBlock -> onBlockAdded (settle this chest and any neighbours), then
// onBlockPlacedBy, which turns a pair only when the yaw lines up with it.
export function placeChest(world, chests, x, y, z, yaw, kind = kindAt(world, x, y, z)) {
  chests[chestKey(x, y, z)] ??= newChest();
  settleFacing(world, chests, x, y, z, kind);
  for (const [dx, , dz] of SIDES) if (world.get(x + dx, y, z + dz) === kind) settleFacing(world, chests, x + dx, y, z + dz, kind);
  const facing = placementFacing(yaw), set = (px, pz) => (chests[chestKey(px, y, pz)] ??= newChest()).facing = facing,
    north = world.get(x, y, z - 1) === kind, south = world.get(x, y, z + 1) === kind,
    west = world.get(x - 1, y, z) === kind, east = world.get(x + 1, y, z) === kind;
  if (!north && !south && !west && !east) set(x, z);
  if ((north || south) && (facing === 4 || facing === 5)) { set(x, north ? z - 1 : z + 1); set(x, z); }
  if ((west || east) && (facing === 2 || facing === 3)) { set(west ? x - 1 : x + 1, z); set(x, z); }
}
// TileEntityChest as an IInventory; open/close count users for the lid.
export function chestInventory(chest) {
  const inv = new StackArray(chest.items);
  inv.open = () => { chest.users = Math.max(0, chest.users) + 1; };
  inv.closed = () => { chest.users--; };
  return inv;
}
// func_149951_m: null when a normal cube sits on this chest or its partner;
// otherwise the chest, or InventoryLargeChest(west|north first, east|south second).
// A sitting ocelot on this chest or its partner blocks it too (BlockChest.o): World.ocelotOnChest, set by main.js.
export function openChest(world, chests, x, y, z) {
  const kind = world.get(x, y, z);
  if (!isChestBlock(kind) || normalCube(world.get(x, y + 1, z)) || world.ocelotOnChest?.(x, y, z)) return null;
  for (const [dx, , dz] of SIDES) if (world.get(x + dx, y, z + dz) === kind && (normalCube(world.get(x + dx, y + 1, z + dz)) || world.ocelotOnChest?.(x + dx, y, z + dz))) return null;
  const tile = (px, pz) => chests[chestKey(px, y, pz)] ??= newChest();
  let inventory = chestInventory(tile(x, z)), keys = [chestKey(x, y, z)];
  const pair = (dx, dz, first) => {
    if (world.get(x + dx, y, z + dz) !== kind) return;
    const other = chestInventory(tile(x + dx, z + dz)), key = chestKey(x + dx, y, z + dz);
    inventory = first ? new LargeChestInventory(other, inventory) : new LargeChestInventory(inventory, other);
    keys = first ? [key, ...keys] : [...keys, key];
  };
  pair(-1, 0, true); pair(1, 0, false); pair(0, -1, true); pair(0, 1, false);
  return { inventory, keys, title: inventory instanceof LargeChestInventory ? "Large Chest" : "Chest" };
}
// TileEntityChest.checkForAdjacentChests: only the west/north chest of a pair
// draws the large model and plays sounds; the sound sits between the halves.
export function chestPair(world, x, y, z) {
  const kind = kindAt(world, x, y, z), east = world.get(x + 1, y, z) === kind, south = world.get(x, y, z + 1) === kind,
    primary = world.get(x - 1, y, z) !== kind && world.get(x, y, z - 1) !== kind;
  return { primary, east, south, double: primary && (east || south) };
}
// TileEntityChest.updateEntity lid step: 0.1 per tick, opening sound as the
// lid leaves 0 and closing sound as it falls below 0.5 (primary chest only).
const STEP = Math.fround(0.1);
export function tickLid(chest, primary) {
  chest.prevLid = chest.lid;
  let sound = null;
  if (chest.users > 0 && chest.lid === 0 && primary) sound = "random.chestopen";
  if ((chest.users === 0 && chest.lid > 0) || (chest.users > 0 && chest.lid < 1)) {
    const before = chest.lid;
    chest.lid = Math.fround(chest.users > 0 ? chest.lid + STEP : chest.lid - STEP);
    if (chest.lid > 1) chest.lid = 1;
    if (chest.lid < 0.5 && before >= 0.5 && primary) sound = "random.chestclosed";
    if (chest.lid < 0) chest.lid = 0;
  }
  return sound;
}
// TileEntityChestRenderer: 1 - (1 - t)^3, as a lid angle in radians.
export function lidAngle(chest, partial = 1) {
  let t = chest.prevLid + (chest.lid - chest.prevLid) * partial;
  t = 1 - t;
  t = 1 - t * t * t;
  return (t * Math.PI) / 2;
}
// The renderer's Christmas textures, shown from 24 to 26 December.
export const christmas = (date = new Date()) => date.getMonth() === 11 && date.getDate() >= 24 && date.getDate() <= 26;
