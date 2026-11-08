// Live use of the spawn egg, Bottle o' Enchanting and fire charge (rules and constants in spawn-eggs.js; evidence in
// public/research/spawn-eggs.md). Called from player-edit-simulation.js at one hook per use path; `state` is that simulation's state.
import { ITEM_SPAWN_EGG, ITEM_EXP_BOTTLE, ITEM_FIRE_CHARGE, eggOf, eggSpawnPoint, eggWaterPoint, eggYaw } from "./spawn-eggs.js";
import { SUMMONABLE } from "./commands.js";
import { ENTITY_TYPES } from "./entities.js";
import { traceBucket } from "./buckets.js";
import { copyBucketTarget } from "./buckets-simulation.js";
import { isFence } from "./fences.js";
import { WATER, FIRE } from "./world.js";

// The mob type an egg summons in this build, or null (the egg then exists but does nothing: Ghast, Blaze, Magma Cube, ... until a
// track adds them). Resolved through /summon's table at use time so mobs added later work with no change here.
export const eggMobType = (damage) => {
  const e = eggOf(damage);
  const type = e && SUMMONABLE[e.entity];
  return type && ENTITY_TYPES[type] ? type : null;
};

// ItemMonsterPlacer.spawnCreature: create at the point with the random yaw (setLocationAndAngles(x, y, z, wrap(nextFloat() * 360), 0),
// rotationYawHead and renderYawOffset the same), onSpawnWithEgg (mobs.spawnNatural runs it), the stack's custom name.
// An unknown mob type spawns nothing. Returns the mob or null. The original's playLivingSound after spawning is not played.
export function spawnEggMob(state, damage, at, name, random = Math.random) {
  const type = eggMobType(damage);
  if (!type) return null;
  const e = state.mobs.spawnNatural(type, at.x, at.y, at.z), yaw = eggYaw(random());
  for (const k of ["rotationYaw", "prevRotationYaw", "renderYawOffset", "prevRenderYawOffset", "rotationYawHead", "prevRotationYawHead", "bodyHeadYaw"]) e[k] = yaw;
  e.yaw = (-yaw * Math.PI) / 180;
  if (typeof name === "string" && name) e.customName = name;
  return e;
}
// The stack's display name (add.u() hasDisplayName, add.s() getDisplayName): only an anvil/NBT name, never the default.
const customName = (stack) => (typeof stack?.displayName === "string" ? stack.displayName : undefined);
const spend = (state, hooks) => {
  if (!state.survival.creative) {
    const inv = state.survival.inventory, held = inv.held;
    if (held && held.count <= 0) state.survival.take(held.id); // --stackSize: 0 becomes -1 (neg-stacks-reference.json use spawnEgg)
    else inv.decr(inv.current, 1);
  }
  hooks.renderHotbar?.(); hooks.markUnsaved?.();
};

// ItemMonsterPlacer.onItemUse: spawns beside the clicked face in Survival and Creative; the stack shrinks outside Creative only
// when a mob was created (aee.a: the decrement is inside the entity != null branch), so an egg whose mob this build lacks is
// neither spent nor does anything. There is no mob-spawner
// branch in 1.7.10 (bytecode: aee.a(add, yz, ahb, ...) never reads the block). Returns true when the click was an egg use.
export function useEggOnBlock(state, target, hooks = {}) {
  const held = state.survival.held;
  if (!held || held.id !== ITEM_SPAWN_EGG || !target?.block) return false;
  if (!eggOf(held.damage)) return true; // an unregistered id returns before spawning (noEgg): nothing happens, nothing is spent
  const side = target.side ?? sideOfAdjacent(target), fence = isFence(state.world.get(...target.block));
  const at = eggSpawnPoint(target.block, side, fence), random = hooks.random ?? Math.random;
  const mob = spawnEggMob(state, held.damage, at, customName(held), random);
  if (mob) { hooks.mobSpawned?.(mob); spend(state, hooks); }
  return true;
}
const sideOfAdjacent = (t) => {
  const d = [0, 1, 2].map((i) => (t.adjacent?.[i] ?? 0) - t.block[i]);
  return d[1] < 0 ? 0 : d[1] > 0 ? 1 : d[2] < 0 ? 2 : d[2] > 0 ? 3 : d[0] < 0 ? 4 : 5;
};

// ItemMonsterPlacer.onItemRightClick: a liquid trace (as an empty bucket's); on a water block (still or flowing) the mob spawns at
// the block's integer coordinates, after canPlayerEdit. `bucket` is the captured bucket-style trace of the click.
export function useEggOnWater(state, bucket, hooks = {}) {
  const held = state.survival.held, captured = copyBucketTarget(bucket);
  if (!held || held.id !== ITEM_SPAWN_EGG || !captured?.ray) return false;
  const now = traceBucket(state.world, captured.ray.origin, captured.ray.dir, true);
  if (!now) return false;
  const [x, y, z] = now.block;
  if (state.world.get(x, y, z) !== WATER || state.survival.adventure) return false;
  if (!eggOf(held.damage)) return false;
  const mob = spawnEggMob(state, held.damage, eggWaterPoint([x, y, z]), customName(held), hooks.random ?? Math.random);
  if (!mob) return false;
  hooks.mobSpawned?.(mob);
  spend(state, hooks);
  return true;
}

// ItemFireball.onItemUse: on the server, the cell beside the face gets fire when it is air (sound fire.ignite, volume 1, pitch
// nextFloat() * 0.4 + 0.8, at the cell centre) and the charge is spent outside Creative whether or not it did (probe: fire).
export function useFireCharge(state, target, hooks = {}) {
  const held = state.survival.held;
  if (!held || held.id !== ITEM_FIRE_CHARGE || !target?.block) return false;
  if (state.survival.adventure) return true; // canPlayerEdit is false
  const q = target.adjacent, random = hooks.random ?? Math.random;
  if (q && q[1] >= 0 && q[1] < (state.world.height ?? 256) && (!state.world.inside || state.world.inside(...q)) && state.world.get(...q) === 0) {
    hooks.playSound?.("fire.ignite", { volume: 1, pitch: random() * 0.4 + 0.8, position: { x: q[0] + 0.5, y: q[1] + 0.5, z: q[2] + 0.5 } });
    state.fire.ignite(...q);
    hooks.updateBlocks?.(state.fire.drain());
  }
  spend(state, hooks);
  return true;
}

// ItemExpBottle.onItemRightClick: outside Creative the stack shrinks first, random.bow at volume 0.5 and pitch
// 0.4 / (nextFloat() * 0.4 + 0.8) plays, then the bottle is thrown (EntityExpBottle: velocity 0.7, pitch offset -20). The sound's
// roll comes before the projectile's own random seed, as with the snowball.
export function throwExpBottle(state, hooks = {}) {
  const random = hooks.random ?? Math.random, potions = state.mobs?.potions;
  if (!potions) return null;
  if (!state.survival.creative) { const inv = state.survival.inventory; if (inv.held && inv.held.count <= 0) state.survival.take(inv.held.id); else inv.decr(inv.current, 1); }
  hooks.playSound?.("random.bow", { volume: 0.5, pitch: 0.4 / (random() * 0.4 + 0.8) });
  const ball = potions.throwFromPlayer(state.position, state.yaw, state.pitch, 0, "expBottle", 0.7);
  hooks.resetEquipped?.(); hooks.renderHotbar?.(); hooks.markUnsaved?.();
  return ball;
}
