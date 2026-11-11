// Browser-independent ordering for the non-living entity segment of the live
// player tick. Entity systems own their state; callers provide world-specific
// targets and synchronous effects at the same points used by main.js.
import { tickTnt, TNT_POWER } from "./explosion.js";
import { ringEntityActive } from './streaming-ticks.js';

/**
 * Advance primed TNT in insertion order using a snapshot, as main.js did.
 * Smoke is emitted synchronously from tickTnt; a detonating entity is removed
 * before its explosion callback runs, so chained effects observe the same list.
 *
 * @param {object} world World read/write interface consumed by tickTnt.
 * @param {Array<object>} primed Mutable live primed-TNT list.
 * @param {{smoke?: Function|null, explode?: Function}} hooks Presentation-free
 *        smoke and explosion observers. explode receives (x,y,z,power,context).
 */
export function tickPrimedTnt(world, primed, hooks = {}) {
  if (!primed.length) return;
  for (const entity of [...primed]) tickOneTnt(world, primed, entity, hooks);
}
/** One primed TNT's update (EntityTNTPrimed.onUpdate); a detonation is removed from `primed` before its explosion runs. */
export function tickOneTnt(world, primed, entity, { smoke = null, explode = () => {} } = {}) {
  if (!ringEntityActive(world, entity)) return;
  const at = tickTnt(world, entity, smoke);
  if (!at) return;
  primed.splice(primed.indexOf(entity), 1);
  explode(at.x, at.y, at.z, TNT_POWER, { exploder: entity, attacker: entity.placer });
}

/**
 * Run the current non-living entity segment in its live tick order:
 * item motion, TNT, player item pickup, thrown projectiles and their queued
 * hatch/sound events, mob events, then arrows and arrow pickup.
 *
 * All callbacks are synchronous. This matters when TNT explosions alter the
 * world before items/projectiles run, a thrown egg adds chicks before mob
 * events, or arrow hits prime TNT for the next tick. Presentation and UI stay
 * with the caller.
 *
 * `state` has the shape `{ world, items, primed, projectiles, arrows, mobs,
 * survival, position, width, height }`. Hooks may provide `maxStack`,
 * `smoke`, `explodeTnt`, `itemPicked`, `itemsCollected`, `projectileTargets`,
 * `projectileHit`, `projectileEvent`, `handleEntityEvents`, `arrowOptions`,
 * `arrowsCollected`, and `flushArrows`.
 */
export function tickEntitySimulation(state, hooks = {}) {
  if (isWalked(state.mobs)) return; // the walk in EntityWorld.tickMobs ticks these entities where they stand in the list; finishEntitySimulation follows it
  const { world, items, primed, projectiles, arrows } = state;
  const { maxStack = () => 64, smoke = null, explodeTnt = () => {}, projectileTargets = () => [], projectileHit = () => {}, projectilePearlImpact,
    projectileEvent = () => {}, handleEntityEvents = () => {}, arrowOptions = () => ({}) } = hooks;

  items.tick(world, maxStack);
  tickPrimedTnt(world, primed, { smoke, explode: explodeTnt });
  collectItems(state, hooks);

  projectiles.tick(world, projectileTargets(state), projectileHit, projectilePearlImpact);
  for (const event of projectiles.drain()) projectileEvent(event);

  if (state.mobs) handleEntityEvents();

  arrows.tick(world, arrowOptions(state));
  collectArrows(state, hooks);
}

function collectItems(state, hooks) {
  const { items, survival, position, width, height } = state, { itemPicked = () => {}, itemsCollected = () => {} } = hooks;
  if (survival.health <= 0) return;
  const picked = items.collect(position, width, height, (stack) => survival.inventory.add(stack));
  for (const result of picked) itemPicked(result);
  if (picked.length) itemsCollected(picked);
}

function collectArrows(state, hooks) {
  const { arrows, survival, position, width, height } = state, { arrowsCollected = () => {}, flushArrows = () => {} } = hooks;
  const { x, y, z } = position, half = width / 2;
  const playerBox = [x - half, y, z - half, x + half, y + height, z + half];
  if (survival.health > 0 && arrows.collect(playerBox, survival)) arrowsCollected();
  flushArrows();
}

export const isWalked = (mobs) => !!mobs?.walks?.size;

/**
 * World.updateEntities walks one loadedEntityList. When `mobs.walks` holds the kinds below (entityWalkers), the walk in EntityWorld.tickMobs ticks
 * them in insertion order among the mobs, so tickEntitySimulation does not. This is the rest of that function, run after the walk (the server
 * player's collideWithNearbyEntities, the packet handlers and the arrow pickup follow the world tick): item pickup, thrown-entity events, mob events,
 * arrow pickup.
 */
export function finishEntitySimulation(state, hooks = {}) {
  if (!isWalked(state.mobs)) return;
  const { projectiles, mobs } = state, { projectileEvent = () => {}, handleEntityEvents = () => {} } = hooks;
  collectItems(state, hooks);
  projectiles.tickEffects?.(state.world);
  for (const event of projectiles.drain()) projectileEvent(event);
  if (mobs) handleEntityEvents();
  collectArrows(state, hooks);
}

/**
 * The kinds the loaded-entity walk ticks besides the mobs and fireballs: [kind, { list, tick, reap }] in the order a tick used to run them.
 * `ctx()` returns the tick's `{ state, hooks }` (the ones tickEntitySimulation takes); the callbacks read the current one, so a dimension change that
 * builds new lists is followed. Each kind's `list()` is the live array; the walk copies it once per pass.
 */
export function entityWalkers(ctx) {
  const st = () => ctx().state, hk = () => ctx().hooks;
  return new Map([
    ["item", { list: () => st().items.items, tick: (e) => st().items.tickOne(st().world, e, hk().maxStack), reap: () => st().items.reap() }],
    ["arrow", { list: () => st().arrows.list, tick: (e) => st().arrows.tickOne(st().world, e, hk().arrowOptions?.(st()) ?? {}), reap: () => st().arrows.reap() }],
    ["thrown", { list: () => st().projectiles.balls,
      tick: (e) => st().projectiles.tickOne(st().world, e, hk().projectileTargets?.(st()) ?? [], hk().projectileHit, hk().projectilePearlImpact), reap: () => st().projectiles.reap() }],
    ["tnt", { list: () => st().primed, tick: (e) => tickOneTnt(st().world, st().primed, e, { smoke: hk().smoke, explode: hk().explodeTnt }), reap: () => {} }],
    ["orb", { list: () => st().xpOrbs?.orbs ?? [], tick: (e) => st().xpOrbs.tickOne(st().world, e, st().position), reap: () => st().xpOrbs?.reap() }],
    ["falling", { list: () => st().falling?.entities ?? [], tick: (e) => st().falling.tickOne(e), reap: () => st().falling?.reap() }],
  ]);
}

/** Makes `list.push` report each entity that joins (the primed-TNT array is replaced and spliced by several callers). */
export function watchJoin(list, joined) {
  Object.defineProperty(list, "push", { value(...v) { const n = Array.prototype.push.apply(this, v); for (const e of v) joined(e); return n; }, configurable: true, writable: true, enumerable: false });
  return list;
}
