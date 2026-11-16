// Batch 77 mphorseclient77: the client half of riding a horse on the dedicated server.
// Natively EntityPlayerSP.onLivingUpdate keeps the jump counter while isRidingHorse (a saddled EntityHorse) and sends C0B action 6 with (int)(power * 100) when the jump key is released;
// the inventory key while riding sends C0B action 7 (EntityPlayerSP.func_110322_i, port-read in main.js `inventory`). The single-player counter is horse-live.js `horseSeats.charge`
// (heldJumpPower in horse.js); it is reused here with a stand-in world whose horseJump sends the wire message. The jump bar and mount hearts read this state (horse-gear-live.js jumpBar).
import { horseSeats } from '../horse-live.js';
import { jumpBar } from '../horse-gear-live.js';

// The seat key the server puts in the players row (`riding: 'm<wire id>'`) -> the client copy's stand-in mob, or null when the player does not ride a horse.
export function mountedHorse(remoteMobs, riding) {
  if (typeof riding !== 'string' || riding[0] !== 'm') return null;
  const mob = remoteMobs?.copies?.get(Number(riding.slice(1)))?.mob ?? remoteMobs?.copies?.get(riding.slice(1))?.mob;
  return mob && mob.type === 'horse' && mob.health > 0 ? mob : null;
}
// EntityPlayerSP.isRidingHorse: the ridden horse is saddled.
export const ridesSaddled = (mob) => !!mob?.horse?.saddled;

export class MpHorseRider {
  // `send(power)`: multiplayer.horseJump. One instance per connection.
  constructor(send) {
    this.mob = null;
    this.rider = { vehicle: null, jumpCounter: 0, jumpPower: 0, wasJump: false };
    this.seats = horseSeats({ entities: [], horseJump: (e, power) => send(power) });
  }
  // Each client tick with the key state; `mob` is the ridden horse's stand-in (mountedHorse) or null.
  tick(mob, jump) {
    const r = this.rider;
    if (!ridesSaddled(mob)) { if (this.mob) this.reset(); this.mob = mob ?? null; return; }
    if (this.mob !== mob) { this.reset(); this.mob = mob; }
    r.vehicle = { horse: true, entity: mob };
    this.seats.charge(r, { jump: !!jump });
  }
  reset() { Object.assign(this.rider, { vehicle: null, jumpCounter: 0, jumpPower: 0, wasJump: false }); }
  // The bar for the HUD (replaces the experience bar): { visible, width } of the 182 pixel track.
  bar() { return ridesSaddled(this.mob) && this.mob.health > 0 ? jumpBar({ vehicle: { horse: true, entity: this.mob }, jumpPower: this.rider.jumpPower }) : { visible: false, width: 0 }; }
}
