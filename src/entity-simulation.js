// Browser-independent ordering for the non-living entity segment of the live
// player tick. Entity systems own their state; callers provide world-specific
// targets and synchronous effects at the same points used by main.js.
import { tickTnt, TNT_POWER } from "./explosion.js";
import { hangingArrowTargets } from "./hanging.js";
import { ringEntityActive } from './streaming-ticks.js';
import { tickMinecartOne, finishMinecartSimulation, tickBoatOne, finishBoatSimulation, pushMobOnVehicles } from "./structure-simulation.js";

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
  // The vehicles' pushes on the player and the mobs (their own collideWithNearbyEntities) and the leftover drops of the hanging entities.
  if (mobs.walks.has("cart")) finishMinecartSimulation(state, hooks.carts ?? {});
  if (mobs.walks.has("boat")) finishBoatSimulation(state, hooks.boats ?? {});
  if (mobs.walks.has("hanging")) drainHanging(state, hooks);
}
function drainHanging({ hanging }, hooks) { if (hanging) for (const d of hanging.drain()) hooks.hangingDrop?.(d); }

// The carts and boats as the targets of a thrown potion or snowball's sweep (every collidable entity is a candidate there; the entity box is the cart's `bb`).
// Paintings and item frames are collidable entities too (EntityThrowable's ray takes any canBeCollidedWith entity in the sweep box).
export const vehicleTargets = ({ minecarts, boats, hanging }) => [...(minecarts?.carts ?? []), ...(boats?.carts ?? [])].filter((v) => !v.dead).map((v) => ({ ref: v, box: v.bb })).concat(hangingArrowTargets(hanging));
// EntitySnowball / EntityEgg / EntityEnderPearl.onImpact on a vehicle or a hanging entity: attackEntityFrom(thrown snowball, 0), which wobbles a cart or boat (EntityMinecart / EntityBoat
// .attackEntityFrom) without damage and breaks a painting or frame (a frame with an item loses only the item); `by` is the thrower when it is the player. The indirect thrown source's
// entity is the thrower, so a Creative player's hit breaks the cart or boat outright (no drop) and a painting without a drop (executed: EntityListProbe pthrow-* records).
function vehicleThrownHit(state, v, hooks, by = null) {
  const { minecarts, boats, hanging } = state;
  if (hanging?.entities.includes(v)) { hanging.attack(v, by); drainHanging(state, hooks); return; } // the broken one's drop joins the list at once
  (boats?.carts.includes(v) ? boats : minecarts)?.attack(v, 0, { creative: !!(by?.player && by.creative) });
}
/** The player's thrown ball struck `e`: when it is a cart, boat, painting or item frame, hit it as above and return true (otherwise false: a mob). */
export function thrownAtVehicleOrHanging(state, e, hooks, by) {
  const { minecarts, boats, hanging } = state;
  if (!(hanging?.entities.includes(e) || boats?.carts.includes(e) || minecarts?.carts.includes(e))) return false;
  vehicleThrownHit(state, e, hooks, by);
  return true;
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
    // Minecarts and boats: the rider (a mob) is updated right after its mount (EntityWorld.seatRiders); the player's own seat follows in main.js.
    ["cart", { list: () => st().minecarts?.carts ?? [], tick: (e) => tickMinecartOne(st(), hk().carts ?? {}, e), reap: () => st().minecarts?.reap(), pushMob: (m) => pushMobOnVehicles(st(), st().minecarts, m) }],
    ["boat", { list: () => st().boats?.carts ?? [], tick: (e) => tickBoatOne(st(), hk().boats ?? {}, e), reap: () => st().boats?.reap(), pushMob: (m) => pushMobOnVehicles(st(), st().boats, m) }],
    // Paintings and item frames: EntityHanging.onUpdate with its 100-tick surface check; a broken one's drops join the list at once.
    ["hanging", { list: () => st().hanging?.entities ?? [], tick: (e) => { st().hanging.tickOne(st().world, e, hk().hangingActive); drainHanging(st(), hk()); }, reap: () => {} }],
    ["knot", { list: () => st().mobs?.knotList ?? [], tick: (e) => st().mobs.knotTickOne(e), reap: () => {} }],
    // Witch and dispenser potions, snow golem snowballs and wither skulls (a skull's explosion runs in its own update, as World.newExplosion does).
    ["potion", { list: () => st().mobs?.potions?.balls ?? [], tick: (e) => st().mobs.potions.tickOne(e, st().position, st().survival, vehicleTargets(st())), reap: () => st().mobs?.potions?.reap() }],
    ["golemBall", { list: () => st().mobs?._golemBalls?.balls ?? [], tick: (e) => st().mobs._golemBalls.tickOne(e, vehicleTargets(st()), (v) => vehicleThrownHit(st(), v, hk())), reap: () => st().mobs?._golemBalls?.reap() }],
    ["skull", { list: () => st().mobs?._skulls?.list ?? [],
      tick: (e) => { const mobs = st().mobs; mobs._skulls.tickOne(e); if (hk().mobExplosion) for (const ev of mobs.takeExplosions()) hk().mobExplosion(ev); }, reap: () => st().mobs?._skulls?.reap() }],
  ]);
}

/** Makes `list.push` report each entity that joins (the primed-TNT array is replaced and spliced by several callers). */
export function watchJoin(list, joined) {
  Object.defineProperty(list, "push", { value(...v) { const n = Array.prototype.push.apply(this, v); for (const e of v) joined(e); return n; }, configurable: true, writable: true, enumerable: false });
  return list;
}
