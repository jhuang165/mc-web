// Player clicks on paintings and item frames (ItemHangingEntity.onItemUse, EntityItemFrame.interactFirst,
// attackEntityFrom by a player), kept out of main.js. Pure with respect to the browser: effects arrive
// through hooks. Returns true when the click was consumed.
import { PAINTING_ITEM, FRAME_ITEM } from "./hanging.js";

// Side index of the clicked face (0 bottom, 1 top, 2 north, 3 south, 4 west, 5 east) from the ray hit.
export function hitSide(target) {
  if (!target?.block || !target.adjacent) return -1;
  const d = [0, 1, 2].map((i) => target.adjacent[i] - target.block[i]);
  if (d[1] < 0) return 0;
  if (d[1] > 0) return 1;
  if (d[2] < 0) return 2;
  if (d[2] > 0) return 3;
  if (d[0] < 0) return 4;
  return d[0] > 0 ? 5 : -1;
}

export function applyHangingEdit({ hanging, world, survival, heldId, place, target, aimed }, hooks = {}) {
  if (!hanging) return false;
  const spawn = () => { for (const d of hanging.drain()) hooks.drop?.(d); };
  if (aimed) {
    hooks.swing?.();
    const e = aimed.entity;
    if (place) {
      // interactFirst: a frame takes one held item or turns; a painting does nothing.
      const held = survival.held;
      const r = hanging.interact(e, held);
      if (r.action === "insert" && !survival.creative) survival.take(held.id);
      if (r.action) { hooks.renderHotbar?.(); hooks.markUnsaved?.(); }
    } else {
      hanging.attack(e, { player: true, creative: !!survival.creative });
      spawn();
      hooks.markUnsaved?.();
    }
    return true;
  }
  const id = heldId;
  if (!place || (id !== PAINTING_ITEM && id !== FRAME_ITEM) || !target?.block) return false;
  const side = hitSide(target);
  if (side < 0) return false;
  hooks.swing?.();
  // The sneak flag does not matter: ItemHangingEntity handles the click itself.
  const used = hanging.use(id === PAINTING_ITEM ? "painting" : "frame", world, ...target.block, side);
  if (used.entity) {
    if (!survival.creative) survival.take(id);
    hooks.renderHotbar?.();
    hooks.markUnsaved?.();
  }
  return used.used;
}
