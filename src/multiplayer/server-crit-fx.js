// S0BPacketAnimation 4 (crit) and 5 (magic crit), Java 1.7.10: EntityPlayer.onCriticalHit / onEnchantmentCritical (server side) send the
// animation to the attacker and every player tracking it, and NetHandlerPlayClient makes an EntityCrit2FX (bytecode-read: bjb, blk).
// The client never runs the particles itself: EntityLivingBase.attackEntityFrom returns false on a client world.
// Wire (server -> client, on `p.dispOut`): { type: 'pfx73', events: [{ m: 0|1, x, y, z, w, h, mx, my, mz }] }, `y` the target's box floor.
import { isCritical } from '../player-movement.js';

const NEAR = 64 * 64;

/** The attacker's jump-attack test from the server's own player state (EntityPlayer.attackTargetEntityWithCurrentItem). */
export const serverCritical = (p) => isCritical({ fallDistance: p.fallDistance ?? 0, onGround: !!p.grounded, inWater: !!p.inWater, blind: !!p.survival?.effects?.has?.(15), riding: !!p.mount });

/** Queue one crit animation for `target` ({ x, y, z, w, h, mx, my, mz }) on every player of the attacker's dimension within 64 blocks. */
export function sendCritFx(sim, attacker, target, magic) {
  const dim = attacker.dimension | 0, event = { m: magic ? 1 : 0, x: target.x, y: target.y, z: target.z, w: target.w, h: target.h, mx: target.mx || 0, my: target.my || 0, mz: target.mz || 0, ...(target.mob !== undefined ? { i: target.mob } : {}), ...(target.player !== undefined ? { pl: target.player } : {}) }; // b74: `i` = the mob's wire id, `pl` = the player's, so the client follows the live entity
  for (const q of sim.players.values()) {
    if ((q.dimension | 0) !== dim || !q.position) continue;
    if (q !== attacker && (q.position.x - target.x) ** 2 + (q.position.z - target.z) ** 2 > NEAR) continue;
    (q.dispOut ??= []).push({ type: 'pfx73', events: [event] });
  }
}
