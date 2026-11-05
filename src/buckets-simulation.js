// Browser-independent bucket use for the live edit dispatch (see public/research/simulation.md).
// Minecraft.rightClickMouse with an ItemBucket / ItemBucketMilk: EntityCow.interact takes an
// empty bucket first, otherwise ItemBucket.onItemRightClick traces its own ray
// (Item.getMovingObjectPositionFromPlayer, 5 blocks, liquids only for an empty bucket),
// and ItemBucketMilk starts the drink. The ray and its hit are captured as plain data at
// input time; dispatch retraces against the current world and skips a stale capture.
import { ITEMS } from "./survival.js";
import { copyStack } from "./inventory.js";
import { traceBucket, useBucketAt, milkCow, MILK_BUCKET, DRINK_TICKS } from "./buckets.js";

const vector = (value, valid) => Array.isArray(value) && value.length === 3 && value.every(valid) ? [...value] : undefined;

/** "empty" or "filled" for a bucket that traces a ray, otherwise null (milk, other items). */
export function tracedBucketKind(id) {
  const kind = ITEMS[id]?.bucket;
  return kind === "empty" || kind === "filled" ? kind : null;
}

/**
 * Validate and copy a captured bucket target. Returns null for no capture, undefined when
 * malformed. Shape: { ray: { origin, dir } | null, liquid, hit: { block, side } | null }.
 */
export function copyBucketTarget(value) {
  if (value == null) return null;
  if (typeof value !== "object" || typeof value.liquid !== "boolean") return undefined;
  let ray = null, hit = null;
  if (value.ray !== null) {
    const origin = vector(value.ray?.origin, Number.isFinite), dir = vector(value.ray?.dir, Number.isFinite);
    if (!origin || !dir) return undefined;
    ray = { origin, dir };
  }
  if (value.hit !== null) {
    const block = vector(value.hit?.block, Number.isSafeInteger), side = value.hit?.side;
    if (!block || !Number.isInteger(side) || side < 0 || side > 5 || !ray) return undefined;
    hit = { block, side };
  }
  return { ray, liquid: value.liquid, hit };
}

/**
 * Capture the held bucket's own trace at input time. `eyeRay` is the view ray of the last
 * frame ({ origin, dir } arrays) or null before the first frame. Non-tracing items give null.
 */
export function captureBucketTarget(world, heldTool, eyeRay) {
  // The glass bottle (ItemGlassBottle, id 384) traces liquids exactly like an empty bucket.
  const kind = tracedBucketKind(heldTool) ?? (heldTool === 384 || heldTool === 1950 ? "empty" : null);
  if (!kind) return null;
  const liquid = kind === "empty";
  if (!eyeRay) return { ray: null, liquid, hit: null };
  const origin = vector(eyeRay.origin, Number.isFinite), dir = vector(eyeRay.dir, Number.isFinite);
  // rayTraceBlocks finds nothing along a NaN ray, which is exactly what no ray does.
  if (!origin || !dir) return { ray: null, liquid, hit: null };
  const hit = traceBucket(world, origin, dir, liquid);
  return { ray: { origin, dir }, liquid, hit: hit ? { block: [...hit.block], side: hit.side } : null };
}

const sameHit = (a, b) => a === null ? b === null : b !== null && a.side === b.side && a.block.every((v, i) => v === b.block[i]);

// The old main.js useBucketItem, with its world/inventory effects here and its scene/audio/UI
// effects as synchronous hooks: destroyParticles(x, y, z, block, meta) and sound(false, block)
// after fluids.wash for a replaced plant, updateBlock(x, z, y) per changed cell, then
// resetEquipped (only when the held stack changed), renderHotbar and markUnsaved.
export function useHeldBucket(state, { id, aimedEntity = null, bucket = null } = {}, hooks = {}) {
  const hook = (name, ...args) => hooks[name]?.(...args);
  const { world, survival } = state;
  const before = copyStack(survival.held), drop = (s) => state.items.dropPlayer(s, state.position, state.yaw, state.pitch);
  if (id === MILK_BUCKET) {
    // setItemInUse: always starts the 32-tick drink, even in Creative.
    if (!state.eating) state.eating = { id, ticks: DRINK_TICKS, drink: true };
    return { branch: "begin-drinking" };
  }
  let result = null;
  if ((aimedEntity?.entity.type === "cow" || aimedEntity?.entity.type === "mooshroom") && aimedEntity.entity.health > 0 && milkCow(survival, { drop })) {
    result = { branch: "milk-cow", cells: [] };
  } else {
    const kind = tracedBucketKind(id), captured = copyBucketTarget(bucket);
    if (!kind) return { branch: "bucket-unused" };
    if (!captured || captured.liquid !== (kind === "empty")) return { branch: "invalid-bucket-target", skipped: true };
    if (!captured.ray) return { branch: "no-eye-ray" };
    const now = traceBucket(world, captured.ray.origin, captured.ray.dir, captured.liquid);
    // The captured hit must still be what this bucket would see; otherwise consume the use.
    if (!sameHit(captured.hit, now && { block: now.block, side: now.side })) return { branch: "stale-bucket-target", skipped: true };
    const hit = useBucketAt(world, survival, now, {
      drop,
      // World.func_147480_a: the replaced plant breaks with its drops, sound and particles.
      destroy: (x, y, z, b) => {
        state.fluids.wash(x, y, z, b);
        hook("destroyParticles", x, y, z, b, world.getMeta(x, y, z));
        hook("sound", false, b);
      },
    });
    if (hit) {
      result = { branch: hit.action === "pick" ? "pick-liquid" : "place-liquid", cells: hit.cells };
      for (const [x, y, z] of hit.cells) hook("updateBlock", x, z, y);
    }
  }
  if (!result) return { branch: "bucket-unused" };
  // PlayerControllerMP.sendUseItem resets the equip animation when the stack changed.
  const now = survival.held;
  if (before?.id !== now?.id || before?.count !== now?.count) hook("resetEquipped");
  hook("renderHotbar");
  hook("markUnsaved");
  return { branch: result.branch, cells: result.cells.map((c) => [...c]) };
}
