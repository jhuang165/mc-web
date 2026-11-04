// Redstone component blocks, Minecraft Java 1.7.10: dust (original 55), lever (69), stone and wooden
// pressure plates (70, 72), stone button (77), repeater (93/94), tripwire hook (131) and tripwire (132).
// Ported from the unchanged classes (public/research/redstone-blocks-reference.json,
// tools/probes/RedstoneBlocksProbe.java). INERT: there is no power network here. Blocks place, render,
// break and keep the local state a player flips (lever bit 8, button bit 8 plus its 20-tick release,
// repeater delay bits 2-3); nothing is powered by them.
// Rules that need the world take it as an argument.
import { normalCube, FENCE } from "./world.js";
import { solidTop } from "./rails.js";
// Internal ids 119-131 (torches, lamps, redstone block, wooden button, weighted plates, comparators, daylight sensor, piston moving block,
// glowstone) live in redstone-blocks-2.js; the functions below delegate to it so every caller handles them as redstone blocks.
import { isRedstone2Block, itemOfBlock2, blockOfItem2, redstoneBounds2, redstoneDrops2, redstonePlacedMeta2, redstoneSupported2 } from "./redstone-blocks-2.js";
export const REDSTONE_WIRE = 107, LEVER = 108, STONE_PRESSURE_PLATE = 109, WOODEN_PRESSURE_PLATE = 110;
export const STONE_BUTTON = 111, REPEATER = 112, TRIPWIRE_HOOK = 113, TRIPWIRE = 114;
// Tools own internal item ids 100-127, so block items sit at block id + 1000; the dust, repeater and
// string items are the build's own (survival.js).
export const ITEM_REDSTONE = 360, ITEM_STRING = 321, ITEM_REPEATER = 356;
export const ITEM_LEVER = 1108, ITEM_STONE_PLATE = 1109, ITEM_WOODEN_PLATE = 1110, ITEM_STONE_BUTTON = 1111, ITEM_TRIPWIRE_HOOK = 1113;
const ITEM_OF_BLOCK = { [REDSTONE_WIRE]: ITEM_REDSTONE, [LEVER]: ITEM_LEVER, [STONE_PRESSURE_PLATE]: ITEM_STONE_PLATE, [WOODEN_PRESSURE_PLATE]: ITEM_WOODEN_PLATE, [STONE_BUTTON]: ITEM_STONE_BUTTON, [REPEATER]: ITEM_REPEATER, [TRIPWIRE_HOOK]: ITEM_TRIPWIRE_HOOK, [TRIPWIRE]: ITEM_STRING };
const BLOCK_OF_ITEM = Object.fromEntries(Object.entries(ITEM_OF_BLOCK).map(([b, i]) => [i, +b]));
export const itemOfBlock = (b) => ITEM_OF_BLOCK[b] ?? itemOfBlock2(b);
export const blockOfItem = (i) => BLOCK_OF_ITEM[i] ?? blockOfItem2(i);
// Original item id -> internal item id for the items this family adds or reuses (population-content.js).
export const REDSTONE_ITEM_IDS = Object.freeze({ 69: ITEM_LEVER, 70: ITEM_STONE_PLATE, 72: ITEM_WOODEN_PLATE, 77: ITEM_STONE_BUTTON, 131: ITEM_TRIPWIRE_HOOK, 356: ITEM_REPEATER });
export const REDSTONE_ITEM_NAMES = Object.freeze({ [ITEM_LEVER]: "Lever", [ITEM_STONE_PLATE]: "Stone pressure plate", [ITEM_WOODEN_PLATE]: "Wooden pressure plate", [ITEM_STONE_BUTTON]: "Stone button", [ITEM_TRIPWIRE_HOOK]: "Tripwire hook", [ITEM_REPEATER]: "Redstone repeater" });

export const isRedstoneBlock = (b) => (b >= REDSTONE_WIRE && b <= TRIPWIRE) || isRedstone2Block(b);
// Only the repeater has a collision box (BlockRedstoneDiode: 0.125 tall).
export const hasCollision = (b) => b === REPEATER;
const f = Math.fround;
const F2 = f(0.2), F4 = f(0.4), F6 = f(0.6), F8 = f(0.8);

// getCollisionBoundingBox / setBlockBoundsBasedOnState per block and metadata.
export function redstoneBounds(id, meta = 0) {
  switch (id) {
    case REDSTONE_WIRE: return [0, 0, 0, 1, 0.0625, 1];
    case STONE_PRESSURE_PLATE: case WOODEN_PRESSURE_PLATE:
      return [0.0625, 0, 0.0625, 0.9375, meta === 1 ? 0.03125 : 0.0625, 0.9375];
    case LEVER: switch (meta & 7) {
      case 1: return [0, F2, 0.3125, 0.375, F8, 0.6875];
      case 2: return [0.625, F2, 0.3125, 1, F8, 0.6875];
      case 3: return [0.3125, F2, 0, 0.6875, F8, 0.375];
      case 4: return [0.3125, F2, 0.625, 0.6875, F8, 1];
      case 5: case 6: return [0.25, 0, 0.25, 0.75, F6, 0.75];
      default: return [0.25, F4, 0.25, 0.75, 1, 0.75];
    }
    case STONE_BUTTON: { const t = meta & 8 ? 0.0625 : 0.125;
      switch (meta & 7) {
        case 1: return [0, 0.375, 0.3125, t, 0.625, 0.6875];
        case 2: return [1 - t, 0.375, 0.3125, 1, 0.625, 0.6875];
        case 3: return [0.3125, 0.375, 0, 0.6875, 0.625, t];
        case 4: return [0.3125, 0.375, 1 - t, 0.6875, 0.625, 1];
        default: return [0.3125, 0.375, 0, 0.6875, 0.625, t]; // stale metadata 0 and 5-7: never placed
      } }
    case REPEATER: return [0, 0, 0, 1, 0.125, 1];
    case TRIPWIRE_HOOK: switch (meta & 3) {
      case 0: return [0.3125, F2, 0, 0.6875, F8, 0.375];
      case 1: return [0.625, F2, 0.3125, 1, F8, 0.6875];
      case 2: return [0.3125, F2, 0.625, 0.6875, F8, 1];
      default: return [0, F2, 0.3125, 0.375, F8, 0.6875];
    }
    case TRIPWIRE: return (meta & 2) === 0 ? [0, 0, 0, 1, 0.09375, 1] : (meta & 4) === 0 ? [0, 0, 0, 1, 0.5, 1] : [0, 0.0625, 0, 1, 0.15625, 1];
    default: return isRedstone2Block(id) ? redstoneBounds2(id, meta) : null;
  }
}

// Native hardness (Block.setHardness) and blast resistance (the native field is resistance * 5 / 3;
// explosion.js RESIST stores the blast value, 0.5 for the lever, plates and button).
export const REDSTONE_HARDNESS = { [REDSTONE_WIRE]: 0, [LEVER]: 0.5, [STONE_PRESSURE_PLATE]: 0.5, [WOODEN_PRESSURE_PLATE]: 0.5, [STONE_BUTTON]: 0.5, [REPEATER]: 0, [TRIPWIRE_HOOK]: 0, [TRIPWIRE]: 0 };
export const REDSTONE_SOUND = { [REDSTONE_WIRE]: "stone", [LEVER]: "wood", [STONE_PRESSURE_PLATE]: "stone", [WOODEN_PRESSURE_PLATE]: "wood", [STONE_BUTTON]: "stone", [REPEATER]: "wood", [TRIPWIRE_HOOK]: "stone", [TRIPWIRE]: "stone" };
// What breaking leaves behind (Block.getItemDropped / quantityDropped); damage is always 0.
export const redstoneDrops = (id, options) => (isRedstone2Block(id) ? redstoneDrops2(id, 0, options) : ITEM_OF_BLOCK[id] ? [{ id: ITEM_OF_BLOCK[id], count: 1, damage: 0 }] : []);

// ---- Placement ----------------------------------------------------------------------------
// side: 0 down, 1 up, 2 north (z-), 3 south (z+), 4 west (x-), 5 east (x+) of the clicked block.
// Offset from the placed block to the block it attaches to for a click on `side`.
const ATTACH_OF_SIDE = [[0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1], [1, 0, 0], [-1, 0, 0]];
// Offset to the supporting block for stored metadata (lever meta&7, button meta&7, hook meta&3).
const LEVER_ATTACH = { 0: [0, 1, 0], 7: [0, 1, 0], 5: [0, -1, 0], 6: [0, -1, 0], 1: [-1, 0, 0], 2: [1, 0, 0], 3: [0, 0, -1], 4: [0, 0, 1] };
const BUTTON_ATTACH = { 1: [-1, 0, 0], 2: [1, 0, 0], 3: [0, 0, -1], 4: [0, 0, 1] };
const HOOK_ATTACH = { 0: [0, 0, -1], 1: [1, 0, 0], 2: [0, 0, 1], 3: [-1, 0, 0] };
const BUTTON_META = { 2: 4, 3: 3, 4: 2, 5: 1 };
const HOOK_META = { 2: 2, 3: 0, 4: 1, 5: 3 };
const LEVER_META = { 0: 0, 1: 5, 2: 4, 3: 3, 4: 2, 5: 1 };

// Camera yaw (radians) to the 1.7.10 rotation quadrant: floor(rotationYaw * 4 / 360 + 0.5).
export const yawQuadrant = (yaw) => Math.floor(f(f(f(180 - (yaw * 180) / Math.PI) * 4) / 360) + 0.5);
export const repeaterMetaForYaw = (yaw) => (yawQuadrant(yaw) + 2) & 3;

// A solid side is approximated by "normal cube" (documented limit). world.js and rails.js are used
// only inside functions, so the import cycle is harmless (torches.js does the same).
const cube = (w, x, y, z) => normalCube(w.get(x, y, z));
// The end portal frame (internal 104) also holds dust and plates (redstone-blocks-reference.json, "below" id 120).
const below = (w, x, y, z) => solidTop(w, x, y - 1, z) || w.get(x, y - 1, z) === 104;
const isFence = (b) => b === FENCE;

// Metadata and legality of placing `id` clicked on `side` at (x,y,z); null when it cannot be placed.
export function redstonePlacedMeta(world, id, x, y, z, side, yaw = 0) {
  switch (id) {
    case LEVER: {
      const a = ATTACH_OF_SIDE[side];
      if (!cube(world, x + a[0], y + a[1], z + a[2])) return null;
      let m = LEVER_META[side];
      const q = yawQuadrant(yaw);
      if (side === 0) m = q & 1 ? 0 : 7;
      else if (side === 1) m = q & 1 ? 6 : 5;
      return m;
    }
    case STONE_BUTTON: {
      if (side < 2) return null;
      const a = ATTACH_OF_SIDE[side];
      return cube(world, x + a[0], y + a[1], z + a[2]) ? BUTTON_META[side] : null;
    }
    case TRIPWIRE_HOOK: {
      if (side < 2) return null;
      const a = ATTACH_OF_SIDE[side];
      return cube(world, x + a[0], y + a[1], z + a[2]) ? HOOK_META[side] : null;
    }
    case STONE_PRESSURE_PLATE: case WOODEN_PRESSURE_PLATE:
      return below(world, x, y, z) || isFence(world.get(x, y - 1, z)) ? 0 : null;
    case REDSTONE_WIRE: return below(world, x, y, z) || world.get(x, y - 1, z) === 131 ? 0 : null; // BlockRedstoneWire also stands on glowstone
    case REPEATER: return below(world, x, y, z) ? repeaterMetaForYaw(yaw) : null;
    case TRIPWIRE: return below(world, x, y, z) ? 0 : 2; // string never fails; the suspended bit is 2
    default: return isRedstone2Block(id) ? redstonePlacedMeta2(world, id, x, y, z, side, yaw, repeaterMetaForYaw) : null;
  }
}

// Neighbour-change support (onNeighborBlockChange / canPlaceBlockAt): false means the block drops.
export function redstoneSupported(world, id, x, y, z, meta = world.getMeta(x, y, z)) {
  switch (id) {
    case REDSTONE_WIRE: return below(world, x, y, z) || world.get(x, y - 1, z) === 131; // glowstone holds dust (BlockRedstoneWire.canPlaceBlockAt)
    case REPEATER: return below(world, x, y, z);
    case STONE_PRESSURE_PLATE: case WOODEN_PRESSURE_PLATE: return below(world, x, y, z) || isFence(world.get(x, y - 1, z));
    case TRIPWIRE: return ((meta & 2) === 2) !== below(world, x, y, z);
    case LEVER: { const a = LEVER_ATTACH[meta & 7]; return a ? cube(world, x + a[0], y + a[1], z + a[2]) : false; }
    case STONE_BUTTON: {
      const a = BUTTON_ATTACH[meta & 7];
      if (a) return cube(world, x + a[0], y + a[1], z + a[2]);
      return cube(world, x - 1, y, z) || cube(world, x + 1, y, z) || cube(world, x, y, z - 1) || cube(world, x, y, z + 1);
    }
    case TRIPWIRE_HOOK: { const a = HOOK_ATTACH[meta & 3]; return cube(world, x + a[0], y + a[1], z + a[2]); }
    default: return isRedstone2Block(id) ? redstoneSupported2(world, id, x, y, z, meta) : true;
  }
}

// ---- Local interactions (no power network) ------------------------------------------------
export const LEVER_CLICK = { volume: 0.3, on: 0.6, off: 0.5 };
// Right-click. Returns { meta, sound?: [name, volume, pitch], release?: ticks } or null when the
// block has no right-click action.
export function redstoneActivate(id, meta) {
  if (id === LEVER) {
    const next = meta ^ 8;
    return { meta: next, sound: ["random.click", 0.3, next & 8 ? 0.6 : 0.5] };
  }
  if (id === STONE_BUTTON) {
    if (meta & 8) return { meta, handled: true };
    return { meta: meta | 8, sound: ["random.click", 0.3, 0.6], release: 20 };
  }
  if (id === REPEATER) return { meta: (meta + 4) & 15 };
  return null;
}
// Scheduled button tick: releases a pressed button.
export const buttonRelease = (meta) => (meta & 8 ? { meta: meta & 7, sound: ["random.click", 0.3, 0.5] } : null);

// ---- Wire connection ----------------------------------------------------------------------
// BlockRedstoneWire.isPowerProviderOrWire(block, meta, dir). dir -1 is the up/down check (wire only);
// dir 0-3 is the direction the neighbour is entered from (z+1 -> 0, x-1 -> 1, z-1 -> 2, x+1 -> 3).
export function providesPowerOrWire(id, meta, dir) {
  if (id === REDSTONE_WIRE) return true;
  if (dir === -1) return false;
  if (id === REPEATER) { const d = meta & 3; return d === dir || (d ^ 2) === dir; }
  return id === LEVER || id === STONE_PRESSURE_PLATE || id === WOODEN_PRESSURE_PLATE || id === STONE_BUTTON || id === TRIPWIRE_HOOK;
}
// Which of the four arms the dust at (x,y,z) connects to ({ w: x-1, e: x+1, n: z-1, s: z+1 }),
// following BlockRedstoneWire.func_150174_f / RenderBlocks.renderBlockRedstoneWire.
export function wireArms(world, x, y, z) {
  const at = (px, py, pz, dir) => providesPowerOrWire(world.get(px, py, pz), world.getMeta(px, py, pz), dir);
  const upClear = !cube(world, x, y + 1, z);
  const arm = (dx, dz, dir) => {
    let v = at(x + dx, y, z + dz, dir);
    if (!v && !cube(world, x + dx, y, z + dz) && at(x + dx, y - 1, z + dz, -1)) v = true;
    if (!v && upClear && cube(world, x + dx, y, z + dz) && at(x + dx, y + 1, z + dz, -1)) v = true;
    return v;
  };
  return { w: arm(-1, 0, 1), e: arm(1, 0, 3), n: arm(0, -1, 2), s: arm(0, 1, 0) };
}
// Climbing strips: a side where the neighbour is a normal cube topped by dust, with open air above.
export function wireClimbs(world, x, y, z) {
  if (cube(world, x, y + 1, z)) return { w: false, e: false, n: false, s: false };
  const up = (dx, dz) => cube(world, x + dx, y, z + dz) && world.get(x + dx, y + 1, z + dz) === REDSTONE_WIRE;
  return { w: up(-1, 0), e: up(1, 0), n: up(0, -1), s: up(0, 1) };
}
// RenderBlocks tint at power 0 (the only level this inert build has) and for any level 0-15.
export function wireTint(power = 0) {
  const p = power / 15;
  return [power === 0 ? 0.3 : f(p * 0.6 + 0.4), Math.max(0, f(p * p * 0.7 - 0.5)), Math.max(0, f(p * p * 0.6 - 0.7))];
}
// Texture names used by the mesher (blocks/ atlas).
export const REDSTONE_TILES = ["redstone_dust_cross", "redstone_dust_cross_overlay", "redstone_dust_line", "redstone_dust_line_overlay", "lever", "repeater_off", "repeater_on", "trip_wire", "trip_wire_source", "stone", "planks_oak", "redstone_torch_off", "redstone_torch_on"];

// ---- Running world -------------------------------------------------------------------------
// Watches block changes: unsupported components drop; scheduled button releases run from tick().
// `drop(stacks, x, y, z)` spawns items, `apply(changes)` renders [x,y,z,old,new], `sound(name,v,p,x,y,z)`
// plays a click.
export class RedstoneBlocks {
  constructor(world, { drop = () => {}, apply = () => {}, sound = () => {} } = {}) {
    this.world = world; this.drop = drop; this.apply = apply; this.sound = sound;
    this.time = 0; this.pending = [];
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
    const w = this.world, id = w.get(x, y, z);
    if (!isRedstoneBlock(id) || redstoneSupported(w, id, x, y, z)) return;
    this.drop(redstoneDrops(id), x, y, z);
    w.set(x, y, z, 0);
    this.apply([[x, y, z, id, 0]]);
  }
  // Called after a button press: release `ticks` game ticks later (one release per button).
  schedule(x, y, z, ticks = 20) {
    this.pending = this.pending.filter((p) => p.x !== x || p.y !== y || p.z !== z);
    this.pending.push({ x, y, z, at: this.time + ticks });
  }
  scheduled(x, y, z) { return this.pending.some((p) => p.x === x && p.y === y && p.z === z); }
  tick() {
    this.time++;
    if (!this.pending.length) return;
    const due = this.pending.filter((p) => p.at <= this.time);
    this.pending = this.pending.filter((p) => p.at > this.time);
    for (const { x, y, z } of due) {
      const w = this.world;
      if (w.get(x, y, z) !== STONE_BUTTON) continue;
      const r = buttonRelease(w.getMeta(x, y, z));
      if (!r) continue;
      w.set(x, y, z, STONE_BUTTON, true, r.meta);
      this.apply([[x, y, z, STONE_BUTTON, STONE_BUTTON]]);
      this.sound(r.sound[0], r.sound[1], r.sound[2], x, y, z);
    }
  }
}
