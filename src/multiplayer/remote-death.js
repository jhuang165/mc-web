// Another player's death as the viewing client sees it (batch 60). Bytecode-read: EntityPlayerMP.onDeath sends S19 status 3 to the trackers; the EntityOtherPlayerMP copy then runs
// EntityLivingBase.onDeathUpdate each tick (sv.aF: ++deathTime, at 20 setDead and 20 "explode" particles, the same code the mob copies use in death-fx.js). setDead removes the copy from
// the viewer's world, so the corpse tilts for one second, poofs and is gone until the respawn (S0C spawns the new entity). The server entity stays tracked meanwhile and S38 (the tab list)
// is only sent on login, logout and ping updates (ServerConfigurationManager c(mw) / e(mw) / e(), not respawnPlayer), so a dead player stays in the tab list.
export const REMOTE_DEATH_TICKS = 20;

/** One presence tick of a remote player entry: `dead` from the presence record. Returns { burst, hidden } (burst on the tick the copy dies). */
export function stepRemoteDeath(entry, dead) {
  if (!dead) { entry.deathTime = 0; entry.hidden = false; return { burst: false, hidden: false }; }
  if (entry.hidden) return { burst: false, hidden: true };
  entry.deathTime = (entry.deathTime || 0) + 1;
  if (entry.deathTime < REMOTE_DEATH_TICKS) return { burst: false, hidden: false };
  entry.hidden = true;
  return { burst: true, hidden: true };
}
