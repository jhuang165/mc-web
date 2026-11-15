// Batch 74 (mppickup74): the dedicated server's pickup pass. EntityPlayer.onLivingUpdate collides the player's grown box with the entities in World.getEntitiesWithinAABBExcludingEntity's
// list order and calls onCollideWithPlayer on items and stuck arrows alike (executed in PickupOrderProbe, pickup-order-reference.json; single player: pickup-order.js). The server used to take
// the client-named items in `pickup` and the arrows in the tick (ServerDispense.collectArrows), two passes. Both now go through collectPickups when both kinds are in reach:
//  - the tick pass (collectArrows) also takes the dropped items of the player's dimension that he touches, for a player whose inventory the server owns (the usual Survival case);
//  - the client's `pickup` message (named items only) takes the stuck arrows in reach in the same pass.
// With no dropped item in reach the old arrow-only path (Arrows.collect) runs unchanged. Orbs compete only with orbs (xpCooldown, executed), so they keep their own pass (tickOrbs).
import { collectPickups } from '../pickup-order.js';
import { PHYSICS } from '../world.js';

const q = Math.fround;
// The player's box (width 0.6F, height 1.8F) from his feet.
export function playerBox(p) { const hw = q(0.3), at = p.position; return [at.x - hw, at.y, at.z - hw, at.x + hw, at.y + q(1.8), at.z + hw]; }
export const ridingBoxOf = (sim, p) => (p.dimension | 0 ? sim.dimensions?.state?.(p.dimension | 0)?.vehicles : sim.vehicles)?.ridingBox?.(p) ?? null;

/**
 * One pickup pass of player `p` against `lane.arrows` and `sim.items` (the dimension's, swapped in by the caller). `only` (a Set of ItemEntities rows) limits the items to those a client named.
 * Returns the number of things taken (an arrow count when no item is in reach, like Arrows.collect).
 */
export function pickupPass(sim, lane, p, box, ridingBox, only = null) {
  const items = sim.items, arrows = lane.arrows, auth = sim.serverItems.authority(p);
  const reach = auth && items.items.length > 0 && items.pickupCandidates(p.position, PHYSICS.width, PHYSICS.height).some((c) => !only || only.has(c.ref));
  if (!reach) return only ? 0 : arrows.collect(box, p.survival, undefined, ridingBox); // the arrow-only path of the tick
  const byStack = new Map(items.items.map((e) => [e.stack, e]));
  const got = collectPickups({ items, arrows, survival: p.survival, feet: p.position, width: PHYSICS.width, height: PHYSICS.height, playerBox: box, ridingBox, keepItem: only ? (e) => only.has(e) : null,
    add: (stack) => sim.serverItems.takeItem(p, byStack.get(stack), stack, Infinity, true) });
  return got.items.length + got.arrows;
}
