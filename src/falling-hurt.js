// EntityFallingBlock.fall (xj.b(F), bytecode-read b74): every Entity in World.getEntitiesWithinAABBExcludingEntity(this, box) gets
// attackEntityFrom(anvil | fallingBlock, min(floor(i * fallHurtAmount), fallHurtMax)), not only living ones. The player and the mobs
// are hurt by main.js's hook; this covers the rest and what each class's attackEntityFrom does with the hit:
//   EntityItem (xk.a) and EntityXPOrb (sq.a): health 5, minus the amount, dead at 0 (items.hurt, xpOrbs.hurt);
//   EntityBoat / EntityMinecart: wobble, damage + 10 x amount, break above 40 (boats.attack, minecarts.attack; the source has no
//     player entity, so no Creative break);
//   EntityHanging / EntityItemFrame: a frame with an item drops it and stays, anything else breaks (hanging.attack, source entity null);
//   primed TNT, arrows, thrown entities and other falling blocks: Entity.attackEntityFrom only sets velocityChanged (no effect).
import { isFrozen } from "./saved-order.js";

const overlaps = (a, b) => a[3] > b[0] && a[0] < b[3] && a[4] > b[1] && a[1] < b[4] && a[5] > b[2] && a[2] < b[5];

// `state`: { items, xpOrbs, minecarts, boats, hanging }; `drop(d)` places a broken vehicle's or frame's drop (main.js vehicleDrop).
export function hurtNonLiving(box, amount, kind, state, drop = () => {}) {
  const hit = [];
  const { items, xpOrbs, minecarts, boats, hanging } = state;
  for (const e of [...(items?.items ?? [])]) if (!e.dead && !isFrozen(e) && overlaps(box, items.box(e))) { items.hurt(e, amount); hit.push(e); }
  for (const o of [...(xpOrbs?.orbs ?? [])]) if (!o.dead && !isFrozen(o) && overlaps(box, o.bb)) { xpOrbs.hurt(o, kind, amount); hit.push(o); }
  xpOrbs && (xpOrbs.orbs = xpOrbs.orbs.filter((o) => !o.dead));
  for (const system of [minecarts, boats]) {
    for (const v of [...(system?.carts ?? [])]) if (!v.dead && !isFrozen(v) && overlaps(box, v.bb)) { system.attack(v, amount, { source: kind }); hit.push(v); }
    if (system?.drain) for (const d of system.drain()) drop(d);
  }
  for (const h of [...(hanging?.pickable() ?? [])]) if (!isFrozen(h) && overlaps(box, h.bb)) { hanging.attack(h, null); hit.push(h); }
  items?.reap?.();
  return hit;
}
