// BlockRail (aje, original id 66 "rail") and BlockRailBase (aiz) with its inner RailLogic
// (BlockRailBase$Rail, ajf), Minecraft Java 1.7.10: support, bounds and the shape a placed rail
// takes. Checked against the unchanged classes by tools/verify-fence-rail.mjs
// (public/research/fence-rail-reference.json). Golden, detector and activator rails, powered
// shapes and minecart movement are not part of this build.
import { RAIL, SNOW_LAYER, normalCube } from "./world.js";
import { isStair, stairSolidTop } from "./stairs.js";

// Metadata: 0 north-south, 1 east-west, 2-5 ascending east/west/north/south, 6-9 curves
// (6 south-east, 7 south-west, 8 north-west, 9 north-east).
export const RAIL_ASCENDING = (meta) => meta >= 2 && meta <= 5;
// BlockRailBase.setBlockBoundsBasedOnState: 0.625 high when ascending, else 0.125.
export const railBounds = (meta) => [0, 0, 0, 1, RAIL_ASCENDING(meta) ? 0.625 : 0.125, 1];

// World.doesBlockHaveSolidTopSurface for this build's blocks: a normal cube, or a full snow layer.
export function solidTop(world, x, y, z) {
  const b = world.get(x, y, z);
  if (isStair(b)) return stairSolidTop(world.getMeta(x, y, z)); // upside-down stairs only
  if (b === 103) return (world.getMeta(x, y, z) & 8) !== 0; // a top stone slab (stone-utility.js STONE_SLAB)
  if (b === 104) return true; // the end portal frame counts as a solid top (fence-rail-reference.json)
  return normalCube(b) || (b === SNOW_LAYER && (world.getMeta(x, y, z) & 7) === 7);
}
// BlockRailBase.canPlaceBlockAt: a solid top surface below.
export const railCanPlace = (world, x, y, z) => solidTop(world, x, y - 1, z);
// BlockRailBase.onNeighborBlockChange: no solid top below, or an ascending rail without one
// under its raised end (the block beside it), breaks the rail with its drop.
const RAISED = { 2: [1, 0], 3: [-1, 0], 4: [0, -1], 5: [0, 1] };
export function railSupported(world, x, y, z, meta = world.getMeta(x, y, z)) {
  if (!solidTop(world, x, y - 1, z)) return false;
  const r = RAISED[meta];
  return !r || solidTop(world, x + r[0], y, z + r[1]);
}
// BlockRailBase.func_150049_b_: only the plain rail exists here (27, 28 and 157 are not ported).
export const isRailAt = (world, x, y, z) => world.get(x, y, z) === RAIL;

// BlockRailBase$Rail.func_150648_a (setBasicRail): the cells a shape connects to.
function basic(meta, x, y, z) {
  switch (meta) {
    case 0: return [[x, y, z - 1], [x, y, z + 1]];
    case 1: return [[x - 1, y, z], [x + 1, y, z]];
    case 2: return [[x - 1, y, z], [x + 1, y + 1, z]];
    case 3: return [[x - 1, y + 1, z], [x + 1, y, z]];
    case 4: return [[x, y + 1, z - 1], [x, y, z + 1]];
    case 5: return [[x, y, z - 1], [x, y + 1, z + 1]];
    case 6: return [[x + 1, y, z], [x, y, z + 1]];
    case 7: return [[x - 1, y, z], [x, y, z + 1]];
    case 8: return [[x - 1, y, z], [x, y, z - 1]];
    case 9: return [[x + 1, y, z], [x, y, z - 1]];
    default: return [];
  }
}

// BlockRailBase$Rail: the logic object for one rail cell. Plain rails are not "straight" rails
// (field_150053_a false), so curves are allowed and the metadata is the whole shape.
export class RailLogic {
  constructor(world, x, y, z) {
    this.world = world;
    this.x = x;
    this.y = y;
    this.z = z;
    this.connected = basic(world.getMeta(x, y, z), x, y, z);
  }
  // func_150654_a: the rail at a position, or one block above, or one below.
  railAt([x, y, z]) {
    const w = this.world;
    if (isRailAt(w, x, y, z)) return new RailLogic(w, x, y, z);
    if (isRailAt(w, x, y + 1, z)) return new RailLogic(w, x, y + 1, z);
    if (isRailAt(w, x, y - 1, z)) return new RailLogic(w, x, y - 1, z);
    return null;
  }
  // func_150651_b: keep the connections whose rail connects back (at its real height).
  refresh() {
    for (let i = 0; i < this.connected.length; i++) {
      const r = this.railAt(this.connected[i]);
      if (r && r.isConnectedTo(this)) this.connected[i] = [r.x, r.y, r.z];
      else this.connected.splice(i--, 1);
    }
  }
  // func_150653_a / func_150652_b: a connection at that column (the height is ignored).
  isConnectedTo(r) {
    return this.isPartOfTrack(r.x, r.y, r.z);
  }
  isPartOfTrack(x, y, z) {
    return this.connected.some((p) => p[0] === x && p[2] === z);
  }
  // func_150649_b: already connected, or not yet holding two connections.
  canConnectTo(r) {
    return this.isConnectedTo(r) || this.connected.length !== 2;
  }
  // func_150646_a: a rail at (x, y +- 1, z) that would take this one.
  canConnectFrom(x, y, z) {
    const r = this.railAt([x, y, z]);
    if (!r) return false;
    r.refresh();
    return r.canConnectTo(this);
  }
  ascend(shape) {
    const w = this.world, { x, y, z } = this;
    if (shape === 0) {
      if (isRailAt(w, x, y + 1, z - 1)) shape = 4;
      if (isRailAt(w, x, y + 1, z + 1)) shape = 5;
    }
    if (shape === 1) {
      if (isRailAt(w, x + 1, y + 1, z)) shape = 2;
      if (isRailAt(w, x - 1, y + 1, z)) shape = 3;
    }
    return shape < 0 ? 0 : shape;
  }
  setMeta(meta) {
    this.world.set(this.x, this.y, this.z, RAIL, true, meta);
  }
  // func_150645_c: take `r` as a connection and reshape from the connections now held.
  connectTo(r) {
    this.connected.push([r.x, r.y, r.z]);
    const { x, y, z } = this;
    const n = this.isPartOfTrack(x, y, z - 1), s = this.isPartOfTrack(x, y, z + 1),
      w = this.isPartOfTrack(x - 1, y, z), e = this.isPartOfTrack(x + 1, y, z);
    let shape = -1;
    if (n || s) shape = 0;
    if (w || e) shape = 1;
    if (s && e && !n && !w) shape = 6;
    if (s && w && !n && !e) shape = 7;
    if (n && w && !s && !e) shape = 8;
    if (n && e && !s && !w) shape = 9;
    this.setMeta(this.ascend(shape));
  }
  // func_150655_a(powered, force): pick the shape from the neighbours that would connect, set
  // it, and let each connected rail take this one.
  place(powered = false, force = true) {
    const { x, y, z } = this;
    const n = this.canConnectFrom(x, y, z - 1), s = this.canConnectFrom(x, y, z + 1),
      w = this.canConnectFrom(x - 1, y, z), e = this.canConnectFrom(x + 1, y, z);
    let shape = -1;
    if ((n || s) && !w && !e) shape = 0;
    if ((w || e) && !n && !s) shape = 1;
    if (s && e && !n && !w) shape = 6;
    if (s && w && !n && !e) shape = 7;
    if (n && w && !s && !e) shape = 8;
    if (n && e && !s && !w) shape = 9;
    if (shape === -1) {
      if (n || s) shape = 0;
      if (w || e) shape = 1;
      if (powered) {
        if (s && e) shape = 6;
        if (w && s) shape = 7;
        if (e && n) shape = 9;
        if (n && w) shape = 8;
      } else {
        if (n && w) shape = 8;
        if (e && n) shape = 9;
        if (w && s) shape = 7;
        if (s && e) shape = 6;
      }
    }
    shape = this.ascend(shape);
    this.connected = basic(shape, x, y, z);
    if (force || this.world.getMeta(x, y, z) !== shape) {
      this.setMeta(shape);
      for (const p of this.connected) {
        const r = this.railAt(p);
        if (!r) continue;
        r.refresh();
        if (r.canConnectTo(this)) r.connectTo(this);
      }
    }
  }
}

// BlockRailBase.onBlockAdded (server side): new Rail(...).func_150655_a(isBlockIndirectlyGettingPowered,
// true). Nothing here provides power, so `powered` is false.
export function railAdded(world, x, y, z, powered = false) {
  if (!isRailAt(world, x, y, z)) return;
  new RailLogic(world, x, y, z).place(powered, true);
}

// Rails in a running world: neighbour changes break unsupported rails (dropBlockAsItem then
// setBlockToAir, no particles), and a placed rail takes its shape. `drop(stacks, x, y, z)`
// spawns item entities and `apply(changes)` receives [x, y, z, old, new] entries to render.
export class Rails {
  constructor(world, { drop = () => {}, apply = () => {} } = {}) {
    this.world = world;
    this.drop = drop;
    this.apply = apply;
  }
  watch() {
    const next = this.world.onChange;
    this.world.onChange = (x, y, z, old, now) => {
      next?.(x, y, z, old, now);
      for (const [dx, dy, dz] of [[-1, 0, 0], [1, 0, 0], [0, -1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1]]) this.neighbourChanged(x + dx, y + dy, z + dz);
    };
    return this;
  }
  neighbourChanged(x, y, z) {
    const w = this.world;
    if (!isRailAt(w, x, y, z) || railSupported(w, x, y, z)) return;
    this.drop([{ id: RAIL, count: 1, damage: 0 }], x, y, z);
    w.set(x, y, z, 0);
    this.apply([[x, y, z, RAIL, 0]]);
  }
}
