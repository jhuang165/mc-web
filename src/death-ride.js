// b97 horse97: a player who dies on a mount keeps the seat through the death animation (single player; the dedicated server does the same in server-vehicles.js riderInput).
// Executed (Kill96Probe for a horse and a pig, Kill97Probe for a boat and a minecart; public/research/kill96-reference.json, kill97-reference.json): EntityPlayerMP.onDeath (mw.a(ro))
// does no dismount. The rider stays linked while deathTime counts to 20 and World.updateEntities (ahb.h) unlinks it the tick after (`ridingEntity = null`, the mount's `riddenByEntity = null`),
// or the respawn's removal does, with no spot search and no teleport. The player is where it sat.
import { releaseAtSeat } from "./vehicle-simulation.js";

export const DEATH_TICKS = 20;

/** The moment of death: the rider stays linked. Marks the rider dead (a save skips `playerRides`, restorePlayerVehicle seats nobody with health 0). True when it is linked. */
export function startDeathRide(state) {
  if (!state.rider.vehicle) return false;
  state.rider.dead = true;
  return true;
}

/** One death-screen tick, called BEFORE the tick's `++deathTime`: the tick after deathTime reached 20 unlinks the rider where it sits. True when it was released now. */
export function tickDeathRide(state, deathTime) {
  if (!state.rider.vehicle || deathTime < DEATH_TICKS) return false;
  return releaseDeathRide(state);
}

/** The respawn (or the 21st tick): let go where the player sat. */
export function releaseDeathRide(state) {
  if (!state.rider.vehicle) return false;
  releaseAtSeat(state); // the client keeps its seat (not detachPlayerVehicle, which searches a landing spot: the old die() did that at once)
  return true;
}
