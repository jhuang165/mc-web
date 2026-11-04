// Powered (27), detector (28) and activator (157) rails plus the plain rail's redstone hooks, as LiveRedstone behaviours
// keyed by ORIGINAL block id (internal 135 / 136 / 137 / 66). Ported from the 1.7.10 classes BlockRailBase (aje),
// BlockRailPowered (amt: powered AND activator rails, told apart by block identity), BlockRailDetector (aki) and
// BlockRail (amy); public/research/powered-rails.md lists what is native-verified.
//
//   installPoweredRails(redstone) registers the behaviours and gives the World the `setRailMeta` hook RailLogic writes
//   through (World.setBlockMetadataWithNotify(.., 3), so neighbours hear about every shape and power change).
//   Entity queries: getEntities("minecart", box) -> live carts, getEntities("inventory", box) -> carts with a `signal`
//   (EntityMinecartContainer through IEntitySelector.selectInventories); redstone-runtime.js answers both from Minecarts.
import { RailLogic, railSupported } from "./rails.js";

export const POWERED = 27, DETECTOR = 28, ACTIVATOR = 157, PLAIN = 66;
export const MAX_DEPTH = 8; // BlockRailPowered.func_150058_a gives up at depth 8
export const DETECTOR_RATE = 20; // BlockRailDetector.tickRate
export const RAIL_HARDNESS = 0.7;
const straight = (id) => id === POWERED || id === DETECTOR || id === ACTIVATOR;
const sloped = (shape) => shape >= 2 && shape <= 5;
const shapeOf = (id, meta) => (straight(id) ? meta & 7 : meta);

// BlockRailPowered.func_150057_a: is the rail at (x, y, z) a powered rail of this kind lying along `shape` with the 8 bit
// set, and does it have power itself or pass it on from further along the line.
function line(w, id, x, y, z, forward, depth, shape) {
  if (w.getBlock(x, y, z) !== id) return false;
  const meta = w.getBlockMetadata(x, y, z), s = meta & 7;
  if (shape === 1 && (s === 0 || s === 4 || s === 5)) return false;
  if (shape === 0 && (s === 1 || s === 2 || s === 3)) return false;
  if ((meta & 8) === 0) return false;
  if (w.isBlockIndirectlyGettingPowered(x, y, z)) return true;
  return reach(w, id, x, y, z, meta, forward, depth + 1);
}
// BlockRailPowered.func_150058_a: walk one cell along the rail in one direction, level or up a slope, or down below.
function reach(w, id, x, y, z, meta, forward, depth) {
  if (depth >= MAX_DEPTH) return false;
  let shape = meta & 7, level = true;
  switch (shape) {
    case 0: if (forward) z++; else z--; break;
    case 1: if (forward) x--; else x++; break;
    case 2: if (forward) x--; else { x++; y++; level = false; } shape = 1; break;
    case 3: if (forward) { x--; y++; level = false; } else x++; shape = 1; break;
    case 4: if (forward) z++; else { z--; y++; level = false; } shape = 0; break;
    case 5: if (forward) { z++; y++; level = false; } else z--; shape = 0; break;
    default: break;
  }
  if (line(w, id, x, y, z, forward, depth, shape)) return true;
  return level && line(w, id, x, y - 1, z, forward, depth, shape);
}
// Both directions from a rail (the call BlockRailPowered.func_150048_a makes with depth 0).
export const poweredAlong = (w, id, x, y, z, meta) => reach(w, id, x, y, z, meta, true, 0) || reach(w, id, x, y, z, meta, false, 0);

// BlockRailPowered.func_150048_a: set or clear the 8 bit, then tell the blocks below (and above a slope).
function updatePower(w, id, x, y, z, meta, shape) {
  const on = w.isBlockIndirectlyGettingPowered(x, y, z) || poweredAlong(w, id, x, y, z, meta);
  let changed = false;
  if (on && (meta & 8) === 0) {
    w.setBlockMetadataWithNotify(x, y, z, shape | 8, 3);
    changed = true;
  } else if (!on && (meta & 8) !== 0) {
    w.setBlockMetadataWithNotify(x, y, z, shape, 3);
    changed = true;
  }
  if (changed) {
    w.notifyBlocksOfNeighborChange(x, y - 1, z, id);
    if (sloped(shape)) w.notifyBlocksOfNeighborChange(x, y + 1, z, id);
  }
}

// BlockRailBase.onNeighborBlockChange: an unsupported rail drops and goes; otherwise the kind's own update.
function neighbourChange(w, x, y, z, source) {
  const id = w.getBlock(x, y, z), meta = w.getBlockMetadata(x, y, z), shape = shapeOf(id, meta);
  if (!railSupported(w.world, x, y, z, shape)) {
    w.dropBlockAsItem(x, y, z, id, meta);
    w.setBlockToAir(x, y, z);
    return;
  }
  if (id === POWERED || id === ACTIVATOR) updatePower(w, id, x, y, z, meta, shape);
  else if (id === PLAIN) plainUpdate(w, x, y, z, source);
}
// BlockRail.func_150048_a: a power source beside a rail with three connections flips its curve.
function plainUpdate(w, x, y, z, source) {
  const b = w.behaviours[source];
  if (!(b && (b.weak || b.strong))) return;
  if (new RailLogic(w.world, x, y, z).neighbourCount() === 3) new RailLogic(w.world, x, y, z).place(w.isBlockIndirectlyGettingPowered(x, y, z), false);
}
// BlockRailBase.onBlockAdded: shape from the neighbours, then (straight rails) the neighbour-change check.
function added(w, x, y, z) {
  const id = w.getBlock(x, y, z);
  new RailLogic(w.world, x, y, z).place(w.isBlockIndirectlyGettingPowered(x, y, z), true);
  if (straight(id)) neighbourChange(w, x, y, z, id);
}
// BlockRailBase.breakBlock.
function broken(w, x, y, z, id, meta) {
  const s = shapeOf(id, meta);
  if (sloped(s)) w.notifyBlocksOfNeighborChange(x, y + 1, z, id);
  if (straight(id)) {
    w.notifyBlocksOfNeighborChange(x, y, z, id);
    w.notifyBlocksOfNeighborChange(x, y - 1, z, id);
  }
}

// BlockRailDetector.func_150054_a: carts in the box (x + 1/8 .. x + 7/8, y .. y + 7/8, z + 1/8 .. z + 7/8).
export const detectorBox = (x, y, z) => [x + 0.125, y, z + 0.125, x + 0.875, y + 0.875, z + 0.875];
function detect(w, x, y, z, meta) {
  const was = (meta & 8) !== 0, now = w.getEntities("minecart", detectorBox(x, y, z)).length > 0;
  if (now && !was) {
    w.setBlockMetadataWithNotify(x, y, z, meta | 8, 3);
    w.notifyBlocksOfNeighborChange(x, y, z, DETECTOR);
    w.notifyBlocksOfNeighborChange(x, y - 1, z, DETECTOR);
  }
  if (!now && was) {
    w.setBlockMetadataWithNotify(x, y, z, meta & 7, 3);
    w.notifyBlocksOfNeighborChange(x, y, z, DETECTOR);
    w.notifyBlocksOfNeighborChange(x, y - 1, z, DETECTOR);
  }
  if (now) w.scheduleBlockUpdate(x, y, z, DETECTOR, DETECTOR_RATE);
  w.updateNeighbourForOutputSignal(x, y, z, DETECTOR);
}

const base = { onBlockAdded: added, onNeighborBlockChange: neighbourChange, breakBlock: broken };
export const poweredRailBehaviour = { ...base };
export const activatorRailBehaviour = { ...base };
export const plainRailBehaviour = { ...base };
export const detectorRailBehaviour = {
  ...base,
  onBlockAdded(w, x, y, z) {
    added(w, x, y, z);
    if (w.getBlock(x, y, z) === DETECTOR) detect(w, x, y, z, w.getBlockMetadata(x, y, z));
  },
  // onEntityCollidedWithBlock: only an unpowered detector reacts; updateTick (every 20 ticks while carts are on it) only a powered one.
  onEntityCollidedWithBlock(w, x, y, z) {
    const meta = w.getBlockMetadata(x, y, z);
    if ((meta & 8) === 0) detect(w, x, y, z, meta);
  },
  updateTick(w, x, y, z) {
    const meta = w.getBlockMetadata(x, y, z);
    if ((meta & 8) !== 0) detect(w, x, y, z, meta);
  },
  weak: (w, x, y, z) => ((w.getBlockMetadata(x, y, z) & 8) !== 0 ? 15 : 0),
  strong: (w, x, y, z, side) => ((w.getBlockMetadata(x, y, z) & 8) !== 0 && side === 1 ? 15 : 0),
  // getComparatorInputOverride: the first chest/hopper cart on a powered detector, Container.calcRedstoneFromInventory.
  comparator(w, x, y, z) {
    if ((w.getBlockMetadata(x, y, z) & 8) === 0) return 0;
    const carts = w.getEntities("inventory", detectorBox(x, y, z));
    return carts.length ? carts[0].signal ?? 0 : 0;
  },
};

export function installPoweredRails(redstone) {
  redstone.registerBehaviour(POWERED, poweredRailBehaviour);
  redstone.registerBehaviour(DETECTOR, detectorRailBehaviour);
  redstone.registerBehaviour(ACTIVATOR, activatorRailBehaviour);
  redstone.registerBehaviour(PLAIN, plainRailBehaviour);
  redstone.world.setRailMeta = (x, y, z, meta) => redstone.setBlockMetadataWithNotify(x, y, z, meta, 3);
  return redstone;
}
