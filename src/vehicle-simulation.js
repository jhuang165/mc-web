// SIM-01 vehicle decisions. All inputs are detached data; browser adapters only pass state
// and synchronous presentation hooks. Target is Java 1.7.10, with a finite-world edge guard.
import { PHYSICS, SIZE } from './world.js';
import { ITEMS } from './survival.js';
import { entityWaterBox, waterAcceleration, inLava } from './fluids.js';
import { moveInput } from './player-movement.js';
import { useMinecart } from './structure-simulation.js';
const f = Math.fround;
export const EMPTY_CART_ITEM = 366, CHEST_CART_ITEM = 450;
export function createPlayerRider() {
  return { player: true, x: 0, y: 0, z: 0, yaw: 0, moveForward: 0, fallDistance: 0, vehicle: null,
    width: f(PHYSICS.width), height: f(PHYSICS.height), dead: false };
}
export function syncRider(state) {
  const { rider, position, survival } = state;
  Object.assign(rider, position);
  rider.yaw = f(180 - state.yaw * 180 / Math.PI);
  rider.dead = survival.health <= 0;
  rider.fall = distance => {
    if (!survival.creative && survival.health > 0 && distance > 3) survival.damage(Math.ceil(f(distance - 3)), 'a fall');
  };
}
export function captureVehicleAction({ cartId = null, dismount = false, place = true, sneak = false, heldTool = 0 } = {}) {
  if ((cartId !== null && !Number.isSafeInteger(cartId)) || !Number.isSafeInteger(heldTool))
    throw new TypeError('Vehicle action requires integer cart and held item IDs');
  return { version: 1, type: 'player-vehicle', cartId, dismount: !!dismount, place: !!place, sneak: !!sneak, heldTool };
}
export function dispatchVehicleAction(state, action, hooks = {}) {
  const skip = branch => ({ handled: true, skipped: true, branch });
  if (action?.version !== 1 || action.type !== 'player-vehicle' || typeof action.place !== 'boolean' || typeof action.sneak !== 'boolean' || typeof action.dismount !== 'boolean' || !Number.isSafeInteger(action.heldTool)) return skip('invalid-vehicle-action');
  if (state.screen !== undefined && state.screen !== 'playing') return skip('not-playing');
  if (state.survival.health <= 0) return skip('dead-player');
  const { minecarts, rider } = state;
  if (action.dismount) {
    if (!rider.vehicle) return skip('not-riding');
    minecarts.dismount(state.world, rider);
    releaseRider(state);
    hooks.markUnsaved?.();
    return { handled: true, branch: 'dismount-minecart' };
  }
  if (action.heldTool !== (state.survival.held?.id ?? 0)) return skip('held-item-mismatch');
  if (!Number.isSafeInteger(action.cartId)) return skip('missing-cart');
  const cart = minecarts.carts.find(c => c.id === action.cartId && !c.dead);
  if (!cart) return skip('missing-cart');
  if (action.place && cart.type === 0) {
    syncRider(state);
    const mounted = minecarts.mount(cart, rider, { sneaking: action.sneak });
    if (mounted) { applySeat(state); hooks.markUnsaved?.(); hooks.toast?.('Press Shift to dismount.'); }
    return { handled: true, branch: mounted ? 'mount-minecart' : 'occupied-or-sneaking-minecart' };
  }
  const result = useMinecart(state, { place: action.place, cart }, hooks);
  if (rider.vehicle?.dead) { minecarts.dismount(state.world, rider); releaseRider(state); }
  hooks.markUnsaved?.();
  return result;
}
// ItemMinecart.onItemUse: rail cell itself, no face/slope offset, float additions before
// widening. PlayerController preserves the Creative stack after onItemUse decrements it.
export function placeHeldMinecart(state, { target }, hooks = {}) {
  const held = state.survival.held, type = ITEMS[held?.id]?.minecartType;
  if (type === undefined) return { handled: false, branch: 'not-minecart-item' };
  if ((state.screen !== undefined && state.screen !== 'playing') || state.survival.health <= 0)
    return { handled: true, skipped: true, branch: 'inactive-player' };
  if (!target?.block || !state.minecarts || !held.count) return { handled: true, branch: 'no-rail' };
  const [x,y,z] = target.block;
  if (!state.minecarts.railKind(state.world,x,y,z)) return { handled: true, branch: 'no-rail' };
  const record = {x:f(f(x)+f(.5)),y:f(f(y)+f(.5)),z:f(f(z)+f(.5)),customName:held.name};
  const cart = type === 1 ? state.minecarts.spawnChest(record) : state.minecarts.spawnEmpty(record);
  if (!state.survival.creative) state.survival.take(held.id,1);
  hooks.swing?.(); hooks.renderHotbar?.(); hooks.markUnsaved?.();
  return { handled: true, branch: 'place-minecart', cartId: cart.id };
}
function applySeat(state) {
  const {rider,position,velocity,motion}=state;
  rider.fallDistance = 0; // EntityLivingBase.updateRidden, separate from seat positioning.
  Object.assign(position,{x:rider.x,y:rider.y,z:rider.z});
  Object.assign(velocity,{x:0,y:0,z:0});
  Object.assign(motion,{sprinting:false,sneaking:false,ySize:0,prevYSize:0,inWeb:false});
  Object.assign(state,{grounded:false,collidedH:false,flying:false,fallDistance:0,landedFall:0});
}
export function releaseRider(state) {
  Object.assign(state.position,{x:state.rider.x,y:state.rider.y,z:state.rider.z});
  // The finite viewport has no neighbouring chunks; keep dismounts in its playable area.
  if (state.world.inside) for (const axis of ['x','z']) state.position[axis]=Math.max(.31,Math.min(SIZE-.31,state.position[axis]));
  Object.assign(state.velocity,{x:0,y:0,z:0});
  Object.assign(state,{grounded:false,fallDistance:0,landedFall:0});
  state.motion.sneaking=false;
}
export function restorePlayerVehicle(state) {
  for(const c of state.minecarts.carts) if(c.restorePlayer) {
    c.restorePlayer=false;
    if(!state.rider.vehicle && state.survival.health>0 && c.type===0){syncRider(state);state.minecarts.mount(c,state.rider);applySeat(state);}
  }
}
// Returns null when ordinary movement should run. Dismount is itself captured and dispatched.
export function moveRidingPlayer(state, controls, hooks = {}) {
  const {rider,minecarts}=state;
  if (!rider.vehicle) return null;
  syncRider(state);
  Object.assign(state.previous,state.position);
  if (controls.sneak || rider.dead || rider.vehicle.dead) {
    if (!rider.dead && !rider.vehicle.dead) {
      const action=captureVehicleAction({dismount:true}); hooks.trace?.(action); dispatchVehicleAction(state,action,hooks);
    } else {minecarts.dismount(state.world,rider);releaseRider(state);}
  } else {
    const input=moveInput({...controls,usingItem:!!state.eating});
    rider.moveForward=f(input.forward*f(.98));
    minecarts.updateRiderPosition(rider.vehicle);
    applySeat(state);
  }
  const {position:p}=state, half=f(PHYSICS.width)/2;
  const bb=[p.x-half,p.y,p.z-half,p.x+half,p.y+f(PHYSICS.height),p.z+half];
  return {inWater:waterAcceleration(state.world,entityWaterBox(bb),false).wet,inLavaNow:inLava(state.world,bb),sneakOnGround:true,oldPosition:{x:p.x,y:p.y,z:p.z}};
}
export function finishVehicleTick(state) {
  const {rider,minecarts}=state;
  if(!rider.vehicle)return;
  if(rider.vehicle.dead || state.survival.health<=0){minecarts.dismount(state.world,rider);releaseRider(state);}
  else {minecarts.updateRiderPosition(rider.vehicle);applySeat(state);}
}
export function detachPlayerVehicle(state) {
  if(state.rider.vehicle){state.minecarts.dismount(state.world,state.rider);releaseRider(state);}
}
