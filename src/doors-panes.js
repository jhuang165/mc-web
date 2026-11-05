// Doors, iron bars and glass panes, Minecraft Java 1.7.10: BlockDoor (akn, original ids 64 and 71), ItemDoor
// (ach, items 324 and 330) and BlockPane (aoa, ids 101 and 102). Checked against the unchanged classes by
// tools/verify-doors-panes.mjs (public/research/doors-panes-reference.json). Metadata keeps the original
// domain so villages and strongholds, which place raw metadata, stay valid: the lower half holds the facing
// (bits 0-1) and the open bit (bit 2); the upper half has bit 3 set, bit 0 is the hinge and bit 1 the powered flag.
import { coloredItemId, STAINED_GLASS, STAINED_GLASS_PANE } from "./colored-blocks.js";
import { WOODEN_DOOR, IRON_DOOR, IRON_BARS, GLASS_PANE, STONE_SLAB, SNOW_LAYER, VINE, DEAD_BUSH, DEAD_SHRUB, FERN, opaqueCube, normalCube } from "./world.js";
import { replaceable } from "./plants.js";
import { isStair, stairSolidTop } from "./stairs.js";

// Internal item ids of ItemDoor's two items (original 324 and 330; the legacy internal 324 and 330 are other items).
export const WOODEN_DOOR_ITEM = 470, IRON_DOOR_ITEM = 471;
// Tools own internal item ids 100-127, so the glass pane (block 100) is item 1100 (saves and exports still use original item 102).
export const GLASS_PANE_ITEM = 1100;
export const paneItemBlock = (item) => (item === GLASS_PANE_ITEM ? GLASS_PANE : 0);
export const blockItemId = (block) => (block === GLASS_PANE ? GLASS_PANE_ITEM : coloredItemId(block) || block);
export const isDoor = (b) => b === WOODEN_DOOR || b === IRON_DOOR;
export const isPane = (b) => b === IRON_BARS || b === GLASS_PANE || b === STAINED_GLASS_PANE;
// ItemDoor places Material.wood -> wooden door, else the iron door; the item drops come back the same way.
export const doorItemBlock = (item) => (item === WOODEN_DOOR_ITEM ? WOODEN_DOOR : item === IRON_DOOR_ITEM ? IRON_DOOR : 0);
export const doorItem = (block) => (block === WOODEN_DOOR ? WOODEN_DOOR_ITEM : block === IRON_DOOR ? IRON_DOOR_ITEM : 0);
// Entity.rotationYaw of the player from the app camera yaw (radians, 0 faces north).
export const doorRotationYaw = (cameraYaw) => Math.fround(180 - (cameraYaw * 180) / Math.PI);

// BlockDoor.func_150012_g: the metadata of both halves in one value, bits 0-2 from the lower half (facing,
// open), bit 3 when this is the upper half and bit 4 from the upper half's hinge bit.
export function doorFlags(world, x, y, z) {
  const meta = world.getMeta(x, y, z), upper = (meta & 8) !== 0;
  const low = upper ? world.getMeta(x, y - 1, z) : meta, high = upper ? meta : world.getMeta(x, y + 1, z);
  return (low & 7) | (upper ? 8 : 0) | (high & 1 ? 16 : 0);
}
// BlockDoor.func_150013_e / func_150015_f: the facing and the open bit of a cell's combined flags.
export const doorFacing = (world, x, y, z) => doorFlags(world, x, y, z) & 3;
export const doorIsOpen = (world, x, y, z) => (doorFlags(world, x, y, z) & 4) !== 0;
// BlockDoor.func_150011_b: a 3/16 slab on the facing's edge; open swings it to the adjacent edge on the hinge side.
const T = 0.1875;
export function doorBoundsFor(flags) {
  const facing = flags & 3, open = (flags & 4) !== 0, hinge = (flags & 16) !== 0;
  if (facing === 0) return open ? (!hinge ? [0, 0, 0, 1, 1, T] : [0, 0, 1 - T, 1, 1, 1]) : [0, 0, 0, T, 1, 1];
  if (facing === 1) return open ? (!hinge ? [1 - T, 0, 0, 1, 1, 1] : [0, 0, 0, T, 1, 1]) : [0, 0, 0, 1, 1, T];
  if (facing === 2) return open ? (!hinge ? [0, 0, 1 - T, 1, 1, 1] : [0, 0, 0, 1, 1, T]) : [1 - T, 0, 0, 1, 1, 1];
  return open ? (!hinge ? [0, 0, 0, T, 1, 1] : [1 - T, 0, 0, 1, 1, 1]) : [0, 0, 1 - T, 1, 1, 1];
}
// BlockDoor.getIcon(world, x, y, z, side): whether the face on MC side 2-5 (north, south, west, east) uses the
// horizontally flipped texture, so the handle ends up on the hinge's opposite edge. Open doors ignore the hinge.
const FLIP_CLOSED = [5, 3, 4, 2], FLIP_OPEN = [2, 5, 3, 4];
export function doorFaceFlip(flags, side) {
  const facing = flags & 3, open = (flags & 4) !== 0;
  let flip = (open ? FLIP_OPEN : FLIP_CLOSED)[facing] === side;
  if (!open && (flags & 16)) flip = !flip;
  return flip;
}
export const doorBounds = (world, x, y, z) => doorBoundsFor(doorFlags(world, x, y, z));
// BlockDoor.getBlocksMovement (akn.b): an open door lets things through (path finding reads it).
export const doorPassable = (world, x, y, z) => doorIsOpen(world, x, y, z);

// World.doesBlockHaveSolidTopSurface (ahb.a): an opaque normal cube, an upside-down stair, a top slab, a hopper
// or a full snow layer (hoppers are not in this build).
export function solidTopSurface(world, x, y, z) {
  const b = world.get(x, y, z), meta = world.getMeta(x, y, z);
  if (normalCube(b)) return true;
  if (isStair(b)) return stairSolidTop(meta);
  if (b === STONE_SLAB) return (meta & 8) !== 0;
  if (b === 133) return true; // BlockHopper (blocks-0-40.js)
  if (b === 104) return true; // END_PORTAL_FRAME (fence-rail-reference.json)
  return b === SNOW_LAYER && (meta & 7) === 7;
}
// Material.isReplaceable: air, water, lava, fire, snow, and Material.vine (tall grass, ferns, dead bushes, vines).
export const doorReplaceable = (b) => replaceable(b) || b === VINE || b === DEAD_BUSH || b === DEAD_SHRUB || b === FERN;
// BlockDoor.canPlaceBlockAt (lower cell): not at the height limit, a solid top below, both cells replaceable.
export const canPlaceDoor = (world, x, y, z) =>
  y < (world.height ?? 256) - 1 && solidTopSurface(world, x, y - 1, z) && doorReplaceable(world.get(x, y, z)) && doorReplaceable(world.get(x, y + 1, z));

// ItemDoor.onItemUse: facing from the player's yaw, floor((yaw + 180) * 4 / 360 - 0.5) & 3 in float arithmetic.
export const doorPlacedFacing = (yaw) => Math.floor(Math.fround(Math.fround(Math.fround(Math.fround(yaw) + 180) * 4) / 360) - 0.5) & 3;
const FACING_STEP = [[0, 1], [-1, 0], [0, -1], [1, 0]];
// ItemDoor.func_150924_a: the hinge goes on the side with more solid blocks, or beside an existing door of the
// same kind (on the other side from it), then both halves are set and their neighbours notified.
export function placeDoorBlocks(world, x, y, z, facing, door) {
  const [dx, dz] = FACING_STEP[facing & 3];
  const solid = (px, py, pz) => (normalCube(world.get(px, py, pz)) ? 1 : 0);
  const left = solid(x - dx, y, z - dz) + solid(x - dx, y + 1, z - dz);
  const right = solid(x + dx, y, z + dz) + solid(x + dx, y + 1, z + dz);
  const doorLeft = world.get(x - dx, y, z - dz) === door || world.get(x - dx, y + 1, z - dz) === door;
  const doorRight = world.get(x + dx, y, z + dz) === door || world.get(x + dx, y + 1, z + dz) === door;
  const hinge = doorLeft && !doorRight ? true : right > left;
  world.set(x, y, z, door, true, facing & 3);
  world.set(x, y + 1, z, door, true, 8 | (hinge ? 1 : 0));
  return hinge;
}
// ItemDoor.onItemUse after the click: only the top face places; both cells must be editable and placeable.
// Returns the placed door block, or 0 when nothing was placed (the stack is kept).
export function useDoorItem(world, item, x, y, z, side, yaw) {
  const door = doorItemBlock(item);
  if (!door || side !== 1) return 0;
  y++;
  if (!canPlaceDoor(world, x, y, z)) return 0;
  placeDoorBlocks(world, x, y, z, doorPlacedFacing(yaw), door);
  return door;
}

// BlockDoor.onBlockActivated and func_150014_a: the lower half's open bit flips (wooden doors only; Material.iron
// returns true without doing anything). Metadata is written without neighbour notification (flag 2) and the client
// plays aux effect 1003 (see doorSound). Returns whether the door changed.
export function setDoorOpen(world, x, y, z, open) {
  const b = world.get(x, y, z), low = (world.getMeta(x, y, z) & 8) !== 0 ? y - 1 : y, meta = world.getMeta(x, low, z);
  if (!isDoor(b) || ((meta & 4) !== 0) === open) return false;
  world.put(x, low, z, b, (meta ^ 4) & 15);
  return true;
}
// RenderGlobal.playAuxSFX case 1003: random.door_open when Math.random() < 0.5, else random.door_close, volume 1,
// pitch rand * 0.1 + 0.9 (the client's world random).
export function doorSound(random = Math.random, pitchRandom = random) {
  return { event: random() < 0.5 ? "random.door_open" : "random.door_close", volume: 1, pitch: Math.fround(Math.fround(pitchRandom() * 0.1) + 0.9) };
}
// Right-click on a door: { handled, changed, sound }. Iron doors are handled (the click is consumed) and stay shut
// by hand (they only follow redstone).
export function activateDoor(world, x, y, z, random = Math.random) {
  const b = world.get(x, y, z);
  if (!isDoor(b)) return { handled: false, changed: false };
  if (b === IRON_DOOR) return { handled: true, changed: false };
  const low = (world.getMeta(x, y, z) & 8) !== 0 ? y - 1 : y, meta = world.getMeta(x, low, z);
  world.put(x, low, z, b, (meta ^ 4) & 15);
  return { handled: true, changed: true, cells: [[x, low, z], [x, low + 1, z]], sound: doorSound(random) };
}
// BlockDoor.onBlockHarvested: a Creative player breaking the upper half removes the lower one first (no drop).
export function doorHarvested(world, x, y, z, creative) {
  if (creative && isDoor(world.get(x, y, z)) && (world.getMeta(x, y, z) & 8) !== 0 && world.get(x, y - 1, z) === world.get(x, y, z)) world.set(x, y - 1, z, 0);
}
// BlockDoor.getItemDropped: the lower half drops its door item, the upper half nothing.
export const doorDrops = (b, meta) => (isDoor(b) && !(meta & 8) ? [{ id: doorItem(b), count: 1, damage: 0 }] : []);

// BlockDoor.onNeighborBlockChange for the door at (x, y, z) after `changed` (the block that was there before the
// change) was replaced next to it. Returns the item stacks to drop, each as {stack, x, y, z}. `powered(x, y, z)`
// is isBlockIndirectlyGettingPowered and `providesPower(block)` Block.canProvidePower (neither exists without
// redstone, so a door is never opened by this alone).
export function doorNeighbourChange(world, x, y, z, changed, options = {}) {
  const b = world.get(x, y, z);
  return isDoor(b) ? neighbourChange(world, b, x, y, z, changed, options) : [];
}
// The method body runs for `b` whatever occupies the cell: an upper half whose lower half is gone hands the
// lower cell to the same logic (BlockDoor.onNeighborBlockChange calls itself at y - 1), which then drops the item.
function neighbourChange(world, b, x, y, z, changed, options) {
  const { powered = () => false, providesPower = () => false } = options, drops = [], meta = world.getMeta(x, y, z);
  if (!(meta & 8)) {
    let removed = false;
    if (world.get(x, y + 1, z) !== b) { world.set(x, y, z, 0); removed = true; }
    if (!solidTopSurface(world, x, y - 1, z)) {
      world.set(x, y, z, 0);
      removed = true;
      if (world.get(x, y + 1, z) === b) world.set(x, y + 1, z, 0);
    }
    if (removed) {
      for (const stack of doorDrops(b, meta)) drops.push({ stack, x, y, z });
    } else {
      const power = powered(x, y, z) || powered(x, y + 1, z);
      if ((power || providesPower(changed)) && changed !== b && ((world.getMeta(x, y, z) & 4) !== 0) !== power) world.put(x, y, z, b, world.getMeta(x, y, z) ^ 4);
    }
  } else {
    if (world.get(x, y - 1, z) !== b) world.set(x, y, z, 0);
    if (changed !== b) drops.push(...neighbourChange(world, b, x, y - 1, z, changed, options));
  }
  return drops;
}

// Doors in a running world: neighbour changes remove an unsupported or half-missing door (dropBlockAsItem then
// setBlockToAir), as BlockDoor.onNeighborBlockChange. `drop(stacks, x, y, z)` spawns item entities and
// `apply(changes)` receives [x, y, z, old, new] entries to render.
export class Doors {
  constructor(world, { drop = () => {}, apply = () => {}, powered, providesPower } = {}) {
    this.world = world;
    this.drop = drop;
    this.apply = apply;
    this.options = { powered, providesPower };
  }
  watch() {
    const next = this.world.onChange;
    this.world.onChange = (x, y, z, old, now) => {
      next?.(x, y, z, old, now);
      for (const [dx, dy, dz] of [[-1, 0, 0], [1, 0, 0], [0, -1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1]]) this.neighbourChanged(x + dx, y + dy, z + dz, old);
    };
    return this;
  }
  neighbourChanged(x, y, z, changed) {
    const w = this.world;
    if (!isDoor(w.get(x, y, z))) return;
    const before = new Map(), cells = [[x, y - 1, z], [x, y, z], [x, y + 1, z]];
    for (const c of cells) before.set(c.join(), w.get(...c));
    const drops = doorNeighbourChange(w, x, y, z, changed, this.options);
    const changes = [];
    for (const c of cells) {
      const now = w.get(...c), old = before.get(c.join());
      if (now !== old) changes.push([...c, old, now]);
    }
    if (changes.length) this.apply(changes);
    for (const d of drops) this.drop([d.stack], d.x, d.y, d.z);
  }
}

// ---- panes and bars ----
// BlockPane.canPaneConnectTo (aoa.a): an opaque cube, glass, or another pane or bar. Stained glass is not in this
// build, and panes do not connect to fences.
export const paneConnectsTo = (b) => opaqueCube(b) || b === 9 || b === STAINED_GLASS || isPane(b);
// Bit 0 z-1 (north), bit 1 z+1 (south), bit 2 x-1 (west), bit 3 x+1 (east).
export function paneMask(world, x, y, z) {
  const c = (dx, dz) => paneConnectsTo(world.get(x + dx, y, z + dz));
  return (c(0, -1) ? 1 : 0) | (c(0, 1) ? 2 : 0) | (c(-1, 0) ? 4 : 0) | (c(1, 0) ? 8 : 0);
}
const LO = 0.4375, HI = 0.5625;
// BlockPane.setBlockBoundsBasedOnState: the 2/16 post, extended to the connected edges; a pane with both ends
// of an axis (or no connection at all) spans the whole block on that axis. The box reaches the post's far
// edge (0.5625) rather than the arm's midpoint.
export function paneBounds(mask) {
  const n = mask & 1, s = mask & 2, w = mask & 4, e = mask & 8, none = !(n || s || w || e);
  let x0 = LO, x1 = HI, z0 = LO, z1 = HI;
  if ((w && e) || none) { x0 = 0; x1 = 1; } else if (w) x0 = 0; else if (e) x1 = 1;
  if ((n && s) || none) { z0 = 0; z1 = 1; } else if (n) z0 = 0; else if (s) z1 = 1;
  return [x0, 0, z0, x1, 1, z1];
}
// BlockPane.addCollisionBoxesToList: an x arm, then a z arm, each only to the cell's middle when one-sided.
export function paneCollisionBoxes(mask) {
  const n = mask & 1, s = mask & 2, w = mask & 4, e = mask & 8, none = !(n || s || w || e), out = [];
  if ((w && e) || none) out.push([0, 0, LO, 1, 1, HI]);
  else if (w) out.push([0, 0, LO, 0.5, 1, HI]);
  else if (e) out.push([0.5, 0, LO, 1, 1, HI]);
  if ((n && s) || none) out.push([LO, 0, 0, HI, 1, 1]);
  else if (n) out.push([LO, 0, 0, HI, 1, 0.5]);
  else if (s) out.push([LO, 0, 0.5, HI, 1, 1]);
  return out;
}
// One-box callers (entity movement takes the union of a cell's boxes).
export function paneCollisionUnion(mask) {
  const boxes = paneCollisionBoxes(mask);
  return [0, 1, 2].map((i) => Math.min(...boxes.map((b) => b[i]))).concat([3, 4, 5].map((i) => Math.max(...boxes.map((b) => b[i]))));
}
// BlockPane.shouldSideBeRendered (func_149646_a): never against the same block, else Block's rule (a neighbouring
// opaque cube hides the face). `neighbour` is the block in the direction of the face.
export const paneSideRendered = (self, neighbour) => neighbour !== self && !opaqueCube(neighbour);
// RenderBlocks.renderBlockPane: which faces (and arms) to draw. The vertical faces of each arm are the post's
// two sides; arms are drawn to the cell edge when connected one-sidedly. Returns the arm rectangles as
// {axis, from, to}: axis "x" spans along x at the two z faces (0.4375, 0.5625), axis "z" along z at the two x faces.
export function paneArms(mask) {
  const n = mask & 1, s = mask & 2, w = mask & 4, e = mask & 8, none = !(n || s || w || e), out = [];
  if ((w && e) || none) out.push({ axis: "x", from: 0, to: 1 });
  else if (w) out.push({ axis: "x", from: 0, to: 0.5 });
  else if (e) out.push({ axis: "x", from: 0.5, to: 1 });
  if ((n && s) || none) out.push({ axis: "z", from: 0, to: 1 });
  else if (n) out.push({ axis: "z", from: 0, to: 0.5 });
  else if (s) out.push({ axis: "z", from: 0.5, to: 1 });
  return out;
}
