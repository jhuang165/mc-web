// BlockBed (original block 26, internal 138) and ItemBed (original item 355, internal 472), ported from the
// unchanged 1.7.10 classes ajh, abg, yz (EntityPlayer) and mt (WorldServer). Native evidence:
// public/research/bed-reference.json (tools/verify-beds.mjs + tools/probes/BedProbe.java), replayed by bed.test.js.
// Metadata is the original: bits 0-1 the facing (the head lies at +z, -x, -z, +x), bit 2 occupied, bit 3 the head half.
import { BED, WATER, LAVA, ICE, WEB, CACTUS, LILY_PAD } from './world.js';
import { solidTopSurface, doorRotationYaw } from './doors-panes.js';
import { materialSolid } from './plants.js';

export { BED };
export const ITEM_BED = 472;
// BlockDirectional.field_149981_a: the foot-to-head step of each facing.
export const BED_DIR = Object.freeze([[0, 1], [-1, 0], [0, -1], [1, 0]]);
// The lang strings of the original jar (bed-reference.json "names").
export const BED_TEXT = Object.freeze({
  noSleep: 'You can only sleep at night',
  occupied: 'This bed is occupied',
  notSafe: 'You may not rest now, there are monsters nearby',
  notValid: 'Your home bed was missing or obstructed',
  leave: 'Leave Bed',
});

export const isBed = (b) => b === BED;
export const bedFacing = (meta) => meta & 3;
export const isBedHead = (meta) => (meta & 8) !== 0;
export const isBedOccupied = (meta) => (meta & 4) !== 0;

// ItemBed.onItemUse: facing = floor(yaw * 4 / 360 + 0.5) & 3 (float multiply and divide, double add).
export const bedPlacedFacing = (yaw) => Math.floor(Math.fround(Math.fround(Math.fround(yaw) * 4) / 360) + 0.5) & 3;
// The camera yaw of main.js (radians) as the original rotationYaw in degrees.
export const bedPlacedFacingFromCamera = (cameraYaw) => bedPlacedFacing(doorRotationYaw(cameraYaw));

// ItemBed.onItemUse after the click: only the top face places; the foot goes on the cell above the clicked one and
// the head one step along the facing. Both cells must be air (isAirBlock, not replaceable) with a solid top below.
export function canPlaceBed(world, x, y, z, facing) {
  const [dx, dz] = BED_DIR[facing & 3];
  const height = world.height ?? 256;
  if (y >= height) return false;
  return world.get(x, y, z) === 0 && world.get(x + dx, y, z + dz) === 0
    && solidTopSurface(world, x, y - 1, z) && solidTopSurface(world, x + dx, y - 1, z + dz);
}
export function useBedItem(world, x, y, z, side, yaw) {
  if (side !== 1) return null;
  y++;
  const facing = bedPlacedFacing(yaw);
  if (!canPlaceBed(world, x, y, z, facing)) return null;
  const [dx, dz] = BED_DIR[facing];
  world.set(x, y, z, BED, true, facing);
  world.set(x + dx, y, z + dz, BED, true, facing | 8);
  return { foot: [x, y, z], head: [x + dx, y, z + dz], facing };
}
// The edit-simulation entry point: places a held bed from the copied ray target. `state` is
// {world, survival, yaw}; `request` is {id, target:{block, adjacent}}; hooks as in block-placement-simulation.js.
export function placeBed(state, { id, target }, hooks = {}) {
  const { world, survival } = state, here = target.block, adjacent = target.adjacent;
  const result = (placed, reason, position = null) => ({ placed, reason, block: BED, position });
  const above = [here[0], here[1] + 1, here[2]];
  if (!adjacent || adjacent[0] !== above[0] || adjacent[1] !== above[1] || adjacent[2] !== above[2]) return result(false, 'bed-side', adjacent);
  if (!survival.creative && !survival.count(id)) return result(false, 'empty-stack', above);
  const placed = useBedItem(world, here[0], here[1], here[2], 1, doorRotationYaw(state.yaw));
  if (!placed) return result(false, 'bed-support', above);
  state.farming?.observe(...placed.foot);
  if (!survival.creative) survival.take(id);
  hooks.updateBlock?.(placed.foot[0], placed.foot[2], placed.foot[1]);
  hooks.updateBlock?.(placed.head[0], placed.head[2], placed.head[1]);
  hooks.renderHotbar?.();
  hooks.sound?.(true, BED);
  hooks.markUnsaved?.();
  return result(true, 'bed', above);
}

// BlockBed.getItemDropped: the foot half drops the bed item, the head half nothing.
export const bedDrops = (meta) => (isBedHead(meta) ? [] : [{ id: ITEM_BED, count: 1, damage: 0 }]);

// BlockBed.onNeighborBlockChange for the bed at (x, y, z): the head half vanishes without its foot half; the
// foot half vanishes (and drops one bed) without its head half. Returns the item stacks to drop.
export function bedNeighbourChange(world, x, y, z) {
  if (world.get(x, y, z) !== BED) return [];
  const meta = world.getMeta(x, y, z), [dx, dz] = BED_DIR[meta & 3];
  if (isBedHead(meta)) {
    if (world.get(x - dx, y, z - dz) !== BED) world.set(x, y, z, 0);
    return [];
  }
  if (world.get(x + dx, y, z + dz) !== BED) {
    world.set(x, y, z, 0);
    return [{ stack: { id: ITEM_BED, count: 1, damage: 0 }, x, y, z }];
  }
  return [];
}
// BlockBed.onBlockHarvested: a Creative player breaking the head removes the foot first (no drop).
export function bedHarvested(world, x, y, z, creative) {
  if (!creative || world.get(x, y, z) !== BED) return;
  const meta = world.getMeta(x, y, z);
  if (!isBedHead(meta)) return;
  const [dx, dz] = BED_DIR[meta & 3];
  if (world.get(x - dx, y, z - dz) === BED) world.set(x - dx, y, z - dz, 0);
}

// Beds in a running world: neighbour changes remove a half-missing bed (see Doors in doors-panes.js).
export class Beds {
  constructor(world, { drop = () => {}, apply = () => {} } = {}) {
    this.world = world;
    this.drop = drop;
    this.apply = apply;
  }
  watch() {
    const next = this.world.onChange;
    this.world.onChange = (x, y, z, old, now) => {
      next?.(x, y, z, old, now);
      if (old === now) return;
      for (const [dx, dy, dz] of [[-1, 0, 0], [1, 0, 0], [0, 0, -1], [0, 0, 1]]) this.neighbourChanged(x + dx, y + dy, z + dz);
    };
    return this;
  }
  neighbourChanged(x, y, z) {
    const w = this.world;
    if (w.get(x, y, z) !== BED) return;
    const drops = bedNeighbourChange(w, x, y, z);
    if (w.get(x, y, z) !== BED) this.apply([[x, y, z, BED, 0]]);
    for (const d of drops) this.drop([d.stack], d.x, d.y, d.z);
  }
}

// Material.isOpaque (blocksMovement and not translucent) for the spawn search.
// Material.glass, ice, leaves, web and cactus are translucent: leaves 5/71, glass 9, glass pane 100, packed ice 80.
const TRANSLUCENT = new Set([5, 9, 71, 80, 100, ICE, WEB, CACTUS, 140, 141]); // 140/141: stained glass and its pane are Material.glass
// The lily pad is Material.plants, which plants.js materialSolid does not list.
export const materialOpaque = (b) => materialSolid(b) && !TRANSLUCENT.has(b) && b !== LILY_PAD;

// BlockBed.func_149977_a: the n-th free cell around a bed (a solid top below, no opaque material at foot or head
// height): first the 3x3 around the bed cell, then the 3x3 shifted one cell against the facing.
export function bedSpawnSpot(world, x, y, z, n = 0) {
  const [dx, dz] = BED_DIR[world.getMeta(x, y, z) & 3];
  for (let i = 0; i <= 1; i++) {
    const x0 = x - dx * i - 1, z0 = z - dz * i - 1;
    for (let px = x0; px <= x0 + 2; px++) for (let pz = z0; pz <= z0 + 2; pz++) {
      if (solidTopSurface(world, px, y - 1, pz) && !materialOpaque(world.get(px, y, pz)) && !materialOpaque(world.get(px, y + 1, pz))) {
        if (n <= 0) return [px, y, pz];
        n--;
      }
    }
  }
  return null;
}
// EntityPlayer.verifyRespawnCoordinates: a bed gives its spawn search cell; anything else only a forced spawn with
// two non-solid cells.
export function verifyRespawn(world, [x, y, z], forced = false) {
  if (world.get(x, y, z) === BED) return bedSpawnSpot(world, x, y, z, 0);
  const free = (b) => (!materialSolid(b) || b === LILY_PAD) && b !== WATER && b !== LAVA; // records: liquids refuse too
  return forced && free(world.get(x, y, z)) && free(world.get(x, y + 1, z)) ? [x, y, z] : null;
}

// World.isDaytime: skylightSubtracted < 4.
export const isDaytime = (subtracted) => subtracted < 4;
// The next morning (WorldServer.tick): world time + 24000 rounded down to a whole day.
export const nextMorning = (time) => { const t = time + 24000; return t - (t % 24000); };

// EntityPlayer sleeping state (sleeping flag, sleepTimer, playerLocation = the head cell, the spawn point).
export class BedSleep {
  constructor() { this.reset(); }
  reset() {
    this.sleeping = false;
    this.timer = 0;
    this.bed = null; // [x, y, z] of the head half
    this.facing = 0;
    this.pos = null; // {x, y, z}: posX/posY/posZ while lying (posY is the eye height of the 0.2 box)
    this.spawn = null; // [x, y, z] (EntityPlayer.spawnChunk), never forced for a bed
  }
  // EntityPlayer.sleepInBedAt (x, y, z is the head). `ctx`: {player:{x,y,z (feet), alive}, daytime, monsterNear(box)}.
  begin(world, x, y, z, ctx) {
    if (this.sleeping || !ctx.player.alive) return 'OTHER_PROBLEM';
    if (ctx.daytime) return 'NOT_POSSIBLE_NOW';
    if (Math.abs(ctx.player.x - x) > 3 || Math.abs(ctx.player.y - y) > 2 || Math.abs(ctx.player.z - z) > 3) return 'TOO_FAR_AWAY';
    if (ctx.monsterNear?.([x - 8, y - 5, z - 8, x + 8, y + 5, z + 8])) return 'NOT_SAFE';
    let facing = 0;
    // sleepInBedAt reads the metadata of whatever block is there (0 for air: facing 0), bed or not.
    facing = world.getMeta(x, y, z) & 3;
    const [dx, dz] = BED_DIR[facing];
    const px = x + 0.5 + dx * 0.4, pz = z + 0.5 + dz * 0.4;
    this.sleeping = true;
    this.timer = 0;
    this.bed = [x, y, z];
    this.facing = facing;
    this.pos = { x: Math.fround(px), y: Math.fround(y + 0.9375), z: Math.fround(pz) };
    return 'OK';
  }
  // EntityPlayer.func_71013_b: the model offset while lying (-1.8 along the head direction).
  get offset() { const [dx, dz] = BED_DIR[this.facing]; return [-1.8 * dx, 0, -1.8 * dz]; }
  // EntityPlayer.isPlayerFullyAsleep.
  get fullyAsleep() { return this.sleeping && this.timer >= 100; }
  // GuiIngame sleep overlay alpha (0..220/255 of 0x101020): timer / 100, fading out over the 10 ticks after waking.
  get overlay() {
    let f = this.timer / 100;
    if (f > 1) f = 1 - (this.timer - 100) / 10;
    return Math.max(0, Math.min(1, f)) * 220 / 255;
  }
  // EntityPlayer.onUpdate's sleep branch. Returns the wakeUpPlayer(resetTimer, update, setSpawn) call to make, or null.
  tick(world, daytime) {
    if (this.sleeping) {
      this.timer = Math.min(this.timer + 1, 100);
      if (world.get(...this.bed) !== BED) return [true, true, false];
      if (daytime) return [false, true, true];
    } else if (this.timer > 0) {
      this.timer++;
      if (this.timer >= 110) this.timer = 0;
    }
    return null;
  }
  // EntityPlayer.wakeUpPlayer: the bed's occupied bit is cleared, the player stands on the first free cell beside it
  // (above the head when there is none; the plain 0.6-wide box shift when the bed is gone). Returns the new feet
  // position, or null when not sleeping.
  wake(world, resetTimer, setSpawn) {
    if (!this.sleeping) return null;
    const [bx, by, bz] = this.bed;
    let feet;
    if (world.get(bx, by, bz) === BED) {
      world.put(bx, by, bz, BED, world.getMeta(bx, by, bz) & ~4);
      const spot = bedSpawnSpot(world, bx, by, bz, 0) || [bx, by + 1, bz];
      feet = { x: spot[0] + 0.5, y: Math.fround(spot[1] + 0.1), z: spot[2] + 0.5 };
    } else {
      // setSize 0.2 -> 0.6 moves the box (bed-reference.json: x and z drop by 0.2, y stays).
      feet = { x: this.pos.x - 0.2, y: this.pos.y, z: this.pos.z - 0.2 };
    }
    this.sleeping = false;
    this.timer = resetTimer ? 0 : 100;
    if (setSpawn) this.spawn = [bx, by, bz];
    return feet;
  }
  save() { return { spawn: this.spawn, bed: this.sleeping ? this.bed : null, timer: this.sleeping ? this.timer : 0 }; }
  restore(data) {
    this.reset();
    if (Array.isArray(data?.spawn) && data.spawn.length === 3 && data.spawn.every(Number.isInteger)) this.spawn = data.spawn;
    return this;
  }
}

// BlockBed.onBlockActivated for a click on either half. `ctx`: BedSleep.begin's context plus
// otherSleeperAt(x, y, z). Returns {handled, status, message, head}. The head cell gets the occupied bit.
export function activateBed(world, x, y, z, sleep, ctx) {
  if (world.get(x, y, z) !== BED) return { handled: false };
  let meta = world.getMeta(x, y, z);
  if (!isBedHead(meta)) {
    const [dx, dz] = BED_DIR[meta & 3];
    x += dx;
    z += dz;
    if (world.get(x, y, z) !== BED) return { handled: true, status: null };
    meta = world.getMeta(x, y, z);
  }
  if (isBedOccupied(meta)) {
    if (ctx.otherSleeperAt?.(x, y, z)) return { handled: true, status: null, message: BED_TEXT.occupied, head: [x, y, z] };
    world.put(x, y, z, BED, meta & ~4);
  }
  const status = sleep.begin(world, x, y, z, ctx);
  if (status === 'OK') world.put(x, y, z, BED, world.getMeta(x, y, z) | 4);
  const message = status === 'NOT_POSSIBLE_NOW' ? BED_TEXT.noSleep : status === 'NOT_SAFE' ? BED_TEXT.notSafe : null;
  return { handled: true, status, message, head: [x, y, z] };
}

// BlockBed.getIcon: (side, meta) -> texture name. `side` is the Minecraft side (0 bottom, 1 top, 2 -z, 3 +z, 4 -x, 5 +x).
const BED_DIRECTION = [[1, 0, 3, 2, 5, 4], [1, 0, 5, 4, 2, 3], [1, 0, 2, 3, 4, 5], [1, 0, 4, 5, 3, 2]];
export function bedTexture(side, meta) {
  if (side === 0) return 'planks_oak';
  const l = BED_DIRECTION[meta & 3][side], half = isBedHead(meta) ? 'head' : 'feet';
  return (half === 'head' && l === 2) || (half === 'feet' && l === 3) ? `bed_${half}_end` : l !== 5 && l !== 4 ? `bed_${half}_top` : `bed_${half}_side`;
}
// BlockBed.func_149977_a is also the respawn cell; the respawn position is the cell centre 0.1 above its floor.
export const bedRespawnPosition = ([x, y, z]) => ({ x: x + 0.5, y: Math.fround(y + 0.1), z: z + 0.5 });
export { WATER, LAVA };
