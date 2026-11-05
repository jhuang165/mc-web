// EntityMooshroom (wm, "MushroomCow", id 96) rules recorded from the unchanged 1.7.10 classes (MooshroomGolemProbe.java,
// public/research/mooshroom-golem-reference.json). It extends EntityCow: 10 health, 0.9 x 1.3, cow tasks, sounds and drops.
export const BOWL = 371, MUSHROOM_STEW = 370, SHEARS = 125, BUCKET = 340, MILK_BUCKET = 343, RED_MUSHROOM = 76;
export const SHEAR_MUSHROOMS = 5;

// EntityMooshroom.interact: shears or a bowl on an adult. Everything else is EntityCow.interact.
export function mooshroomUse(heldId, growingAge) {
  if (growingAge < 0) return null;
  if (heldId === SHEARS) return "shear";
  if (heldId === BOWL) return "bowl";
  return null;
}

// The bowl branch against the probe records: a single bowl becomes stew; otherwise the stew is added to the inventory, and only when
// that worked and the player is not in Creative does the bowl stack shrink and the click count (a Creative player keeps the stack
// and the click falls through, returning false; a full inventory also returns false).
export function useBowl(survival, makeStack) {
  const inv = survival.inventory, held = inv.held;
  if (held.count === 1) { inv.main[inv.current] = makeStack(MUSHROOM_STEW); return true; }
  const added = survival.add(MUSHROOM_STEW, 1) > 0;
  if (added && !survival.creative) { held.count--; return true; }
  return false;
}
