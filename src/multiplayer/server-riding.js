// Riding on the gun server (not 1.7.10 networking): each player carries the single-player rider record (vehicle-simulation.js
// createPlayerRider) that a saddled pig or horse (horse-live.js seats), an empty minecart or a boat carries, and the server runs
// the same mount, ridden movement, seat and dismount code for it. EntityPlayerMP.updateRidden / Entity.updateRiderPosition put
// the player on its seat each tick; sneaking (C0CPacketInput's sneak flag; here the sneak input) gets off.
import { createPlayerRider, moveRidingPlayer, finishVehicleTick, detachPlayerVehicle, captureVehicleAction, dispatchVehicleAction } from '../vehicle-simulation.js';
import { horseSeatsFor } from '../horse-live.js';
import { maxHealthOf } from '../mob-riding.js';
import { ENTITY_TYPES } from '../entities.js';

const mobNumber = e => Number(String(e.id).replace('mob-', ''));

// The rider record of player p; `owner` (not saved, not enumerable) leads a mob's AI and the vehicle code back to the player.
export function riderFor(p) {
  const rider = createPlayerRider();
  Object.defineProperty(rider, 'owner', { value: p, writable: true, configurable: true, enumerable: false });
  return rider;
}
// vehicle-simulation.js's state for player p: live references (position, motion, the vehicle systems) and the scalar movement
// fields, which `applyVehicle` copies back.
export function vehicleState(sim, p) {
  const mobs = sim.mobs;
  return { screen: 'playing', world: sim.world, minecarts: mobs?.minecarts ?? null, boats: mobs?.boats ?? null, horses: mobs ? horseSeatsFor(mobs.ew, p.rider) : null,
    rider: p.rider, position: p.position, previous: p.previous, velocity: p.velocity, motion: p.motion, survival: p.survival, yaw: p.yaw, eating: p.eating,
    grounded: p.grounded, collidedH: p.collidedH, flying: p.flying, fallDistance: p.fallDistance, landedFall: p.landedFall, wasInWater: !!p.inWater };
}
export function applyVehicle(p, s) {
  p.grounded = s.grounded; p.collidedH = s.collidedH; p.flying = s.flying; p.fallDistance = s.fallDistance; p.landedFall = s.landedFall;
}
// The ridden player's movement tick (EntityPlayer.updateRidden): its input steers the mount, sneak gets off. Returns
// movePlayer's { inWater, inLavaNow, sneakOnGround, oldPosition }, or null when p is on foot.
export function rideTick(sim, p, controls) {
  if (!p.rider?.vehicle) return null;
  const s = vehicleState(sim, p), moved = moveRidingPlayer(s, controls);
  applyVehicle(p, s);
  return moved;
}
// After the vehicles moved (World.updateEntities): the rider back on its seat, or off a vehicle that broke or a player that died.
export function seatTick(sim, p) {
  if (!p.rider?.vehicle) return;
  const s = vehicleState(sim, p);
  finishVehicleTick(s);
  applyVehicle(p, s);
}
// Off whatever p rides (a teleport, a respawn, leaving the server).
export function dismount(sim, p) {
  if (!p.rider?.vehicle) return false;
  const s = vehicleState(sim, p);
  detachPlayerVehicle(s);
  applyVehicle(p, s);
  return true;
}
// A click on a minecart or boat (EntityMinecart / EntityBoat.interactFirst, attackEntityFrom): the use button boards an empty
// cart or a boat, opens a chest cart; the attack hits it.
export function useVehicle(sim, p, cart, place, hooks) {
  const s = vehicleState(sim, p);
  const action = captureVehicleAction({ cartId: cart.id, boat: !!cart.boat, place, sneak: !!p.input?.sneak, heldTool: p.survival.held?.id ?? 0 });
  const result = dispatchVehicleAction(s, action, hooks);
  applyVehicle(p, s);
  return result;
}
// What player p rides, for its own tab: the kind, the vehicle's id (a mob's number, a cart's or boat's id), a living mount's
// health and maximum (GuiIngame's mount hearts) and the horse jump bar's charge (GuiIngame.renderJumpBar).
export function ridingOf(sim, p) {
  const v = p.rider?.vehicle;
  if (!v) return null;
  if (v.horse) {
    const e = v.entity, max = ENTITY_TYPES[e.type] ? maxHealthOf(e, e.horse?.maxHealth ?? ENTITY_TYPES[e.type].health) : null;
    return { kind: e.type === 'horse' ? 'horse' : e.type === 'pig' ? 'pig' : 'mob', id: mobNumber(e), type: e.type, health: Math.round(e.health * 100) / 100,
      ...(Number.isFinite(max) ? { max } : {}), jump: Math.round((p.rider.jumpPower ?? 0) * 1000) / 1000 };
  }
  return { kind: v.boat ? 'boat' : 'cart', id: v.id };
}
// Another player's presence: what it rides (the sitting pose, RenderPlayer's isRiding).
export const ridingKind = p => { const v = p.rider?.vehicle; return v ? (v.horse ? 'mob' : v.boat ? 'boat' : 'cart') : null; };
