// Browser-independent ordering for the non-living entity segment of the live
// player tick. Entity systems own their state; callers provide world-specific
// targets and synchronous effects at the same points used by main.js.
import { tickTnt, TNT_POWER } from "./explosion.js";
import { entityActive } from './streaming-ticks.js';

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
export function tickPrimedTnt(world, primed, { smoke = null, explode = () => {} } = {}) {
  if (!primed.length) return;
  for (const entity of [...primed]) {
    if (!entityActive(world,entity)) continue;
    const at = tickTnt(world, entity, smoke);
    if (!at) continue;
    const index = primed.indexOf(entity);
    if (index >= 0) primed.splice(index, 1);
    explode(at.x, at.y, at.z, TNT_POWER, { exploder: entity, attacker: entity.placer });
  }
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
  const {
    world, items, primed, projectiles, arrows, mobs, survival, position,
    width, height,
  } = state;
  const {
    maxStack = () => 64,
    smoke = null,
    explodeTnt = () => {},
    itemPicked = () => {},
    itemsCollected = () => {},
    projectileTargets = () => [],
    projectileHit = () => {},
    projectileEvent = () => {},
    handleEntityEvents = () => {},
    arrowOptions = () => ({}),
    arrowsCollected = () => {},
    flushArrows = () => {},
  } = hooks;

  items.tick(world, maxStack);
  tickPrimedTnt(world, primed, { smoke, explode: explodeTnt });

  if (survival.health > 0) {
    const picked = items.collect(position, width, height, (stack) => survival.inventory.add(stack));
    for (const result of picked) itemPicked(result);
    if (picked.length) itemsCollected(picked);
  }

  projectiles.tick(world, projectileTargets(state), projectileHit);
  for (const event of projectiles.drain()) projectileEvent(event);

  if (mobs) handleEntityEvents();

  arrows.tick(world, arrowOptions(state));
  const { x, y, z } = position, half = width / 2;
  const playerBox = [x - half, y, z - half, x + half, y + height, z + half];
  if (survival.health > 0 && arrows.collect(playerBox, survival)) arrowsCollected();
  flushArrows();
}
