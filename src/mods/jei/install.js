// Recipe viewer mod (not 1.7.10): the per-world switch. A world record with `mods: { jei: true }` shows the item list and
// recipe view beside its container screens (panel.js); any other world, multiplayer, and every test that never turns it on
// see the vanilla screens. Like the guns mod (mods/guns/install.js), the flag is chosen on the Create New World screen.
import { invalidateRecipes } from "./recipes.js";

export const jeiWorld = (record) => record?.mods?.jei === true;

let enabled = false;
export const jeiEnabled = () => enabled;
export function setJeiEnabled(on) {
  on = on === true;
  if (on === enabled) return false;
  enabled = on;
  invalidateRecipes(); // the next open reads the recipe tables again (another mod may have changed them)
  return true;
}

export { worldMods, withWorldMod } from "../world-mods.js";
