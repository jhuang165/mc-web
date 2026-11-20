// Batch 77 mphorseclient77: the client half of riding a horse on the dedicated server.
// Natively EntityPlayerSP.onLivingUpdate keeps the jump counter while isRidingHorse (any EntityHorse, b87) and sends C0B action 6 with (int)(power * 100) when the jump key is released;
// the inventory key while riding sends C0B action 7 (EntityPlayerSP.func_110322_i, port-read in main.js `inventory`). The counter is single player's (horse-live.js horseJumpCounter,
// heldJumpPower in horse.js), sending the wire message. The jump bar and mount hearts read this state (horse-gear-live.js jumpBar).
import { horseJumpCounter } from '../horse-live.js';
import { jumpBar } from '../horse-gear-live.js';

// The seat key the server puts in the players row (`riding: 'm<wire id>'`) -> the client copy's stand-in mob, or null when the player does not ride a horse.
export function mountedHorse(remoteMobs, riding) {
  if (typeof riding !== 'string' || riding[0] !== 'm') return null;
  const mob = remoteMobs?.copies?.get(Number(riding.slice(1)))?.mob ?? remoteMobs?.copies?.get(riding.slice(1))?.mob;
  return mob && mob.type === 'horse' ? mob : null; // b80: isRidingHorse has no health test; a dying horse carries the rider until the server lets go (deathTime 20)
}
// Whether the ridden horse is saddled (the mount hearts / inventory key's test; not isRidingHorse, b87).
export const ridesSaddled = (mob) => !!mob?.horse?.saddled;

// b87 ride87: the counter is horse-live.js horseJumpCounter, the bytecode-read blk.e block: isRidingHorse is any EntityHorse (saddled or not: the client sends
// C0B 6 anyway and wi.w ignores it on an unsaddled horse), the release sends (int)(bO * 100.0F) even when it is 0, and the bar keeps the released fill through the -10
// cooldown. The counter is not reset when the horse changes (EntityPlayerSP keeps `a`). GuiIngame (bbv.a(FZII) 700-798) draws the jump bar whenever isRidingHorse.
export class MpHorseRider {
  // `send(power)`: multiplayer.horseJump. One instance per connection.
  constructor(send) {
    this.mob = null;
    this.send = send;
    this.rider = { vehicle: null, jumpCounter: 0, jumpPower: 0, wasJump: false };
  }
  // Each client tick with the key state (movementInput.jump); `mob` is the ridden horse's stand-in (mountedHorse) or null.
  tick(mob, jump) {
    this.mob = mob && (mob.type ?? 'horse') === 'horse' ? mob : null;
    this.rider.vehicle = this.mob ? { horse: true, entity: this.mob } : null;
    horseJumpCounter(this.rider, !!jump, !!this.mob, this.send);
  }
  reset() { Object.assign(this.rider, { vehicle: null, jumpCounter: 0, jumpPower: 0, wasJump: false }); }
  // The bar for the HUD (replaces the experience bar): { visible, width } of the 182 pixel track.
  bar() { return this.mob ? jumpBar({ vehicle: { horse: true, entity: this.mob }, jumpPower: this.rider.jumpPower }) : { visible: false, width: 0 }; }
}
