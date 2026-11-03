// Buckets from the 1.7.10 JAR (see public/research/buckets.md): ItemBucket (abo),
// ItemBucketMilk (adi), Item.getMovingObjectPositionFromPlayer (adb.a(ahb, yz, Z)),
// World.rayTraceBlocks (ahb.a(azw, azw, Z, Z, Z)) and EntityCow.interact (wh.a(yz)).
// Ids are this build's own; Minecraft's are 325 (bucket), 326 (water), 327 (lava) and
// 335 (milk).
import { WATER, LAVA, isLiquid, WEB, LADDER, isPlant, isCrop, blockBounds } from "./world.js";
import { isStair, stairRayTrace } from "./stairs.js";
import { makeStack } from "./inventory.js";
import { ITEMS } from "./survival.js";

export const BUCKET = 340, WATER_BUCKET = 341, LAVA_BUCKET = 342, MILK_BUCKET = 343;
// Item.getMovingObjectPositionFromPlayer always looks 5.0 blocks along the view.
export const BUCKET_REACH = 5;
// ItemBucketMilk.getMaxItemUseDuration (adi.d_) and getItemUseAction (adi.d, drink).
export const DRINK_TICKS = 32;

export const isBucket = (item) => !!item?.bucket;

// Blocks without a collision box (Block.getCollisionBoundingBoxFromPool is null): the
// liquids, torches and plants. rayTraceBlocks skips them when it ignores blocks
// without a bounding box, which is what a filled bucket asks for.
const noBox = (b) => isLiquid(b) || b === 20 || b === WEB || isPlant(b);
// Block.canCollideCheck (aji.a(IZ)Z): a liquid only counts as a hit when the ray
// stops on liquids and the cell is a source (BlockLiquid.canCollideCheck).
const canCollide = (b, meta, stopOnLiquid) => (isLiquid(b) ? stopOnLiquid && meta === 0 : true);
// setBlockBoundsBasedOnState for the blocks whose selection box is not a full cube.
function bounds(world, x, y, z, b) {
  if (b === 20) return [0.4, 0, 0.4, 0.6, 0.6, 0.6]; // standing torch
  if (b === 39) return [0.1, 0, 0.1, 0.9, 0.8, 0.9]; // BlockTallGrass
  if (isCrop(b)) return [0, 0, 0, 1, 0.25, 1]; // BlockCrops
  return blockBounds(world, x, y, z);
}

// Block.collisionRayTrace (aji.a(ahb, III, azw, azw)): the nearest of the six planes of
// the block's box that the segment crosses inside the other two bounds. Sides are
// 0 bottom, 1 top, 2 north (z - 1), 3 south, 4 west (x - 1), 5 east.
const FACES = [[4, 5], [0, 1], [2, 3]]; // [low, high] side per axis x, y, z
function collisionRayTrace(world, x, y, z, b, start, end) {
  // BlockStairs.collisionRayTrace: the eight octants, the nearest hit.
  if (isStair(b)) { const h = stairRayTrace(world.getMeta(x, y, z), x, y, z, start, end); return h && { block: [x, y, z], side: h.side, point: h.vec }; }
  const [x0, y0, z0, x1, y1, z1] = bounds(world, x, y, z, b),
    lo = [x + x0, y + y0, z + z0], hi = [x + x1, y + y1, z + z1],
    d = [end[0] - start[0], end[1] - start[1], end[2] - start[2]];
  let best = null;
  for (let axis = 0; axis < 3; axis++) {
    if (Math.abs(d[axis]) < 1e-7) continue;
    const [u, v] = [(axis + 1) % 3, (axis + 2) % 3];
    for (const [plane, side] of [[lo[axis], FACES[axis][0]], [hi[axis], FACES[axis][1]]]) {
      const t = (plane - start[axis]) / d[axis];
      if (t < 0 || t > 1) continue;
      const pu = start[u] + d[u] * t, pv = start[v] + d[v] * t;
      if (pu < lo[u] || pu > hi[u] || pv < lo[v] || pv > hi[v]) continue;
      if (!best || t < best.t) {
        const point = [0, 0, 0];
        point[axis] = plane; point[u] = pu; point[v] = pv;
        best = { t, side, point };
      }
    }
  }
  return best && { block: [x, y, z], side: best.side, point: best.point };
}

// World.rayTraceBlocks (ahb.a(azw, azw, ZZZ)): visits the cells along the segment in
// order (the start cell first, then at most 200 more) and returns the first one whose
// block qualifies and whose box the segment crosses; null when none does or the
// segment's end cell is reached. `returnLastUncollidable` is false for buckets.
export function rayTraceBlocks(world, from, to, stopOnLiquid, ignoreNoBox) {
  const start = [...from], end = to;
  if ([...start, ...end].some(Number.isNaN)) return null;
  const f = Math.floor, cell = (x, y, z) => {
    const b = world.get(x, y, z);
    if (b === 0 || (ignoreNoBox && noBox(b)) || !canCollide(b, world.getMeta(x, y, z), stopOnLiquid)) return null;
    return collisionRayTrace(world, x, y, z, b, start, end);
  };
  const ex = f(end[0]), ey = f(end[1]), ez = f(end[2]);
  let x = f(start[0]), y = f(start[1]), z = f(start[2]);
  const first = cell(x, y, z);
  if (first) return first;
  for (let n = 200; n-- >= 0; ) {
    if (x === ex && y === ey && z === ez) return null;
    let hx = true, hy = true, hz = true, px = 999, py = 999, pz = 999;
    if (ex > x) px = x + 1; else if (ex < x) px = x; else hx = false;
    if (ey > y) py = y + 1; else if (ey < y) py = y; else hy = false;
    if (ez > z) pz = z + 1; else if (ez < z) pz = z; else hz = false;
    const dx = end[0] - start[0], dy = end[1] - start[1], dz = end[2] - start[2],
      tx = hx ? (px - start[0]) / dx : 999, ty = hy ? (py - start[1]) / dy : 999, tz = hz ? (pz - start[2]) / dz : 999;
    let side;
    if (tx < ty && tx < tz) {
      side = ex > x ? 4 : 5;
      start[1] += dy * tx; start[2] += dz * tx; start[0] = px;
    } else if (ty < tz) {
      side = ey > y ? 0 : 1;
      start[0] += dx * ty; start[2] += dz * ty; start[1] = py;
    } else {
      side = ez > z ? 2 : 3;
      start[0] += dx * tz; start[1] += dy * tz; start[2] = pz;
    }
    x = f(start[0]) - (side === 5 ? 1 : 0);
    y = f(start[1]) - (side === 1 ? 1 : 0);
    z = f(start[2]) - (side === 3 ? 1 : 0);
    const hit = cell(x, y, z);
    if (hit) return hit;
  }
  return null;
}

// Item.getMovingObjectPositionFromPlayer(world, player, flag): an empty bucket asks
// for liquids (and keeps blocks without a box), a filled one ignores liquids and
// blocks without a box. `eye` and `dir` are the player's eye and view direction.
export function traceBucket(world, eye, dir, empty) {
  const end = [eye[0] + dir[0] * BUCKET_REACH, eye[1] + dir[1] * BUCKET_REACH, eye[2] + dir[2] * BUCKET_REACH];
  return rayTraceBlocks(world, eye, end, empty, !empty);
}

// ItemBucket.func_150910_a (abo.a(add, yz, adb)): a creative player keeps the stack;
// otherwise the used bucket is replaced (a single one) or one is swapped for the
// filled item, which goes into the inventory or is thrown (dropPlayerItemWithRandomChoice).
function fill(player, filledId, drop) {
  if (player.creative) return;
  const inv = player.inventory, held = inv.held;
  if (--held.count <= 0) inv.main[inv.current] = makeStack(filledId);
  else if (!player.add(filledId, 1)) drop?.(makeStack(filledId));
}

// The side adjustment in ItemBucket.onItemRightClick (abo.a(add, ahb, yz)).
const SIDE = [[0, -1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1], [-1, 0, 0], [1, 0, 0]];

// ItemBucket.tryPlaceContainedLiquid (abo.a(ahb, III)Z): the cell must be air or not
// solid (liquids, torches, plants, ladders); a non-liquid block there is broken with its drops
// first (ahb.a(IIIZ), `destroy`); then setBlock(liquid, 0, 3). Nothing is played in the
// Overworld (the fizz and smoke are only for water where WorldProvider.hasNoSky).
// Returns whether the bucket counts as used.
export function placeContainedLiquid(world, x, y, z, liquid, destroy) {
  if (!liquid || !world.inside(x, y, z)) return false;
  const old = world.get(x, y, z);
  // A ladder has a collision box but Material.circuits is not solid, so the liquid replaces it.
  if (old !== 0 && old !== LADDER && world.solid(x, y, z)) return false;
  if (old !== 0 && !isLiquid(old)) destroy?.(x, y, z, old);
  world.set(x, y, z, liquid, true, 0);
  return true;
}

// ItemBucket.onItemRightClick (abo.a(add, ahb, yz)) for an empty or filled bucket held
// by `player` (a Survival). `eye` / `dir` are the view ray. `hooks.destroy(x, y, z,
// block)` breaks a block the liquid replaces (drops, particles); `hooks.drop(stack)`
// throws a filled bucket that did not fit. Returns what happened, or null.
export function useBucket(world, player, eye, dir, hooks = {}) {
  const held = player.inventory.held, kind = held && ITEMS[held.id]?.bucket;
  if (kind !== "empty" && kind !== "filled") return null;
  return useBucketAt(world, player, traceBucket(world, eye, dir, kind === "empty"), hooks);
}

// The part of onItemRightClick after getMovingObjectPositionFromPlayer: `hit` is the
// traceBucket result for the held bucket ({ block, side }), or null when it missed.
export function useBucketAt(world, player, hit, hooks = {}) {
  const inv = player.inventory, held = inv.held, item = held && ITEMS[held.id];
  const kind = item?.bucket;
  if (kind !== "empty" && kind !== "filled") return null;
  const empty = kind === "empty";
  if (!hit) return null;
  let [x, y, z] = hit.block;
  if (empty) {
    // Only a source (metadata 0) of water or lava is picked up (setBlockToAir, flag 3).
    const b = world.get(x, y, z);
    if (!isLiquid(b) || world.getMeta(x, y, z) !== 0) return null;
    world.set(x, y, z, 0);
    fill(player, b === WATER ? WATER_BUCKET : LAVA_BUCKET, hooks.drop);
    return { action: "pick", block: b, cells: [[x, y, z]] };
  }
  const [dx, dy, dz] = SIDE[hit.side];
  x += dx; y += dy; z += dz;
  if (!placeContainedLiquid(world, x, y, z, item.contains, hooks.destroy)) return null;
  // The empty bucket replaces the held stack; Creative keeps the filled one.
  if (!player.creative) inv.main[inv.current] = makeStack(BUCKET);
  return { action: "place", block: item.contains, cells: [[x, y, z]] };
}

// EntityCow.interact (wh.a(yz)): a non-creative player holding an empty bucket gets a
// milk bucket (a lone bucket is replaced, otherwise one is exchanged). No sound is
// played and there is no age check, so calves can be milked too. Returns true when it
// handled the click.
export function milkCow(player, hooks = {}) {
  const held = player.inventory.held;
  if (!held || held.id !== BUCKET || player.creative) return false;
  fill(player, MILK_BUCKET, hooks.drop);
  return true;
}

// ItemBucketMilk.onEaten (adi.b): one milk bucket is used up unless Creative, and the
// stack becomes an empty bucket. clearActivePotions also runs in Creative.
export function finishDrinking(player) {
  const inv = player.inventory, held = inv.held;
  if (!held || held.id !== MILK_BUCKET) return false;
  if (!player.creative && --held.count <= 0) inv.main[inv.current] = makeStack(BUCKET);
  player.effects.clear();
  return true;
}
