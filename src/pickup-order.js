// The single pickup pass of EntityPlayer.onLivingUpdate (Batch 73 mobcells73). Natively the player's box grown by (1, 0.5, 1) is handed to World.getEntitiesWithinAABBExcludingEntity
// once and every listed entity that is not dead gets onCollideWithPlayer in that list's order, items, orbs and stuck arrows together (executed in
// tools/probes/PickupOrderProbe.java, public/research/pickup-order-reference.json). The kinds share the inventory (the last free slot, a partial arrow stack) and the sound order,
// so the order between them is observable. This module merges the item and arrow candidates and takes them in the world's list order (candidate-order.js). Orbs only ever
// compete with other orbs (xpCooldown), so they keep their own pass (experience.js, ordered the same way).
import { orderTargets } from "./candidate-order.js";

/**
 * `items` (ItemEntities) and `arrows` (Arrows) give their candidates; `add(stack)` stores an item stack; `take` stores one arrow.
 * `keepItem(e)` (optional) limits the items to those it accepts (the dedicated server's client-named pickups). Hooks: `itemPicked(result)` after each item that gave anything, `arrowTaken(arrow)` after each arrow, `collected(items, arrows)` once at the end.
 * Returns { items: [results], arrows: n }.
 */
export function collectPickups({ items, arrows, survival, feet, width, height, playerBox, ridingBox = null, add, take, keepItem = null }, hooks = {}) {
  const rows = [...items.pickupCandidates(feet, width, height).filter((c) => !keepItem || keepItem(c.ref)).map((c) => ({ ...c, kind: "item" })), ...arrows.pickupCandidates(playerBox, ridingBox).map((c) => ({ ...c, kind: "arrow" }))];
  const picked = [];
  let n = 0;
  for (const c of orderTargets(rows)) {
    if (c.kind === "item") {
      const got = items.takeOne(c.ref, add);
      if (got) { picked.push(got); hooks.itemPicked?.(got); }
    } else if (arrows.takeOne(c.ref, survival, take)) { n++; hooks.arrowTaken?.(c.ref); }
  }
  if (picked.length) items.items = items.items.filter((e) => !e.dead);
  if (n) arrows.list = arrows.list.filter((a) => !a.dead);
  return { items: picked, arrows: n };
}
