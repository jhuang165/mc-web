// EntityLivingBase.collideWithNearbyEntities (sv.bo) on the client player, bytecode-read: after the move, every entity of the client world whose box meets
// the player's box expanded 0.2 sideways and that canBePushed (sa.S) gets o(entity) -> entity.applyEntityCollision(player) (sa.g): the player is `other`, so its
// motion moves by +d away from the mob. EntityPlayer.onLivingUpdate (yz.e) calls sv.e first, so this runs inside the same tick, after moveEntityWithHeading.
// Creative players take it too (nothing in the loop reads the abilities); a rider is refused by the riding pair check of sa.g.
import { applyEntityCollision, boxesMeet } from "./combat.js";
import { pushBox, pushable } from "./entities.js";

// Adds the mobs' push to velocity ({x, z}); mobs.tracker's client copies give the positions (the live mob stands in where untracked).
export function pushClientPlayer(mobs, player, velocity) {
  if (!mobs?.entities || player.riding || player.dead) return;
  const near = pushBox(player, player.width, player.height);
  near[0] -= 0.2; near[2] -= 0.2; near[3] += 0.2; near[5] += 0.2;
  const copy = { x: player.x, z: player.z, vx: velocity.x, vz: velocity.z };
  for (const e of mobs.entities) {
    if (!pushable(e)) continue;
    const c = mobs.tracker?.clientIfTracked?.(e), at = c ?? e;
    if (!boxesMeet(near, pushBox(at, ...mobs.size(e)))) continue;
    applyEntityCollision(at, copy, false, true);
  }
  velocity.x = copy.vx;
  velocity.z = copy.vz;
}
