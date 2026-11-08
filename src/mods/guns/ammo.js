// A separate chamber lets a nonempty reload retain one round outside the magazine. TaCZ also uses open_bolt for
// revolvers, break-actions and launchers with no extra chamber capacity. Inventory-fed guns have no magazine.
export const hasChamber = (gun) => gun?.feed !== "inventory" && gun?.magazine > 0 &&
  (gun.bolt === "closed_bolt" || gun.bolt === "manual_action");

// Keep the existing nonnegative damage representation for old saves. Only the round above magazine capacity needs a
// tag; spending it removes that tag before damage increases, so empty guns still save at damage === magazine.
export function loadedRounds(gun, stack) {
  if (!gun) return 0;
  const damage = Math.max(0, stack?.damage | 0);
  return Math.max(0, gun.magazine - damage) + (hasChamber(gun) && damage === 0 && stack?.modTag?.extraRound === true ? 1 : 0);
}

export const reloadCapacity = (gun, stack) => gun.magazine + (hasChamber(gun) && loadedRounds(gun, stack) > 0 ? 1 : 0);

export function setLoadedRounds(gun, stack, rounds) {
  const n = Math.max(0, Math.min(gun.magazine + (hasChamber(gun) ? 1 : 0), rounds | 0));
  stack.damage = Math.max(0, gun.magazine - n);
  const tag = { ...stack.modTag };
  if (n > gun.magazine) tag.extraRound = true;
  else delete tag.extraRound;
  if (Object.keys(tag).length) stack.modTag = tag;
  else delete stack.modTag;
}
