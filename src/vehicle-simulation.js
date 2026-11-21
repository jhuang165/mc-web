// SIM-01 vehicle decisions. All inputs are detached data; browser adapters only pass state
// and synchronous presentation hooks. Target is Java 1.7.10, with a finite-world edge guard.
import { PHYSICS, SIZE } from './world.js';
import { ITEMS } from './survival.js';
import { entityWaterBox, waterAcceleration, inLava } from './fluids.js';
import { moveInput } from './player-movement.js';
import { landingEffects, JUMP_BOOST } from './damage-fx.js';
import { useMinecart, useBoat } from './structure-simulation.js';
import { sampleFallSite } from './combat-tracker.js';
const f = Math.fround;
export const EMPTY_CART_ITEM = 366, CHEST_CART_ITEM = 450;
export function createPlayerRider() {
  return { player: true, x: 0, y: 0, z: 0, yaw: 0, moveForward: 0, moveStrafing: 0, fallDistance: 0, vehicle: null,
    width: f(PHYSICS.width), height: f(PHYSICS.height), dead: false };
}
export function syncRider(state) {
  const { rider, position, survival } = state;
  Object.assign(rider, position);
  rider.yaw = f(180 - state.yaw * 180 / Math.PI);
  rider.dead = survival.health <= 0;
  // EntityLivingBase.fall for the player a mount passes its fall to (Entity.fall): ceil(distance - 3 - Jump Boost level), the fall sound
  // when the caller supplies a sound hook, the landing block's step sound, then the damage (damage-fx.js landingEffects).
  // EntityHorse.fall hands the rider the horse's own amount through attackEntityFrom(ro.h): no Jump Boost, no fall sound of its own (the horse plays the land and step sounds).
  rider.fallHit = (points) => {
    if (survival.creative || !(survival.health > 0) || !(points > 0)) return;
    survival.combatSite = sampleFallSite(state.world, state.position.x, state.position.y, state.position.z, !!state.wasInWater);
    survival.combatFall = state.fallDistance ?? 0;
    survival.damage(points, 'a fall');
  };
  rider.fall = (distance, { sound = state.fallSound ?? null, world = state.world } = {}) => { // b72: boats and carts pass no hook; the state's fallSound plays EntityLivingBase.fall's sounds
    if (survival.creative || !(survival.health > 0) || !(distance > 0)) return;
    const jump = survival.effects?.get?.(JUMP_BOOST), by = Math.floor(state.position.y - 0.20000000298023224),
      out = landingEffects(distance, { kind: 'player', amplifier: jump ? jump.amplifier : -1, blockUnder: world?.get?.(Math.floor(state.position.x), by, Math.floor(state.position.z)) ?? 0 });
    if (sound) for (const s of out.sounds) sound(s);
    if (out.points > 0) {
      // CombatTracker entry of the rider's fall: the cell at its feet and the rider's OWN Entity.fallDistance (a mount's fall does not touch it, so
      // a rider that never fell reads 0 and the text is "hit the ground too hard"; probed rider-fall-own-*).
      survival.combatSite = sampleFallSite(world, state.position.x, state.position.y, state.position.z, !!state.wasInWater);
      survival.combatFall = state.fallDistance ?? 0;
      survival.damage(out.points, 'a fall');
    }
  };
}
// The system that owns the ridden vehicle: boats and minecarts keep separate id spaces.
export const vehicleSystem = (state, boat = state.rider?.vehicle?.boat) => (state.rider?.vehicle?.horse && state.horses ? state.horses : boat ? state.boats : state.minecarts);
export function captureVehicleAction({ cartId = null, boat = false, dismount = false, place = true, sneak = false, heldTool = 0 } = {}) {
  if ((cartId !== null && !Number.isSafeInteger(cartId)) || !Number.isSafeInteger(heldTool))
    throw new TypeError('Vehicle action requires integer cart and held item IDs');
  return { version: 1, type: 'player-vehicle', cartId, boat: !!boat, dismount: !!dismount, place: !!place, sneak: !!sneak, heldTool };
}
export function dispatchVehicleAction(state, action, hooks = {}) {
  const skip = branch => ({ handled: true, skipped: true, branch });
  if (action?.version !== 1 || action.type !== 'player-vehicle' || typeof action.place !== 'boolean' || typeof action.sneak !== 'boolean' || typeof action.dismount !== 'boolean' || !Number.isSafeInteger(action.heldTool)) return skip('invalid-vehicle-action');
  if (state.screen !== undefined && state.screen !== 'playing') return skip('not-playing');
  if (state.survival.health <= 0) return skip('dead-player');
  const { rider } = state, minecarts = vehicleSystem(state, action.dismount ? undefined : action.boat);
  if (action.dismount) {
    if (!rider.vehicle) return skip('not-riding');
    minecarts.dismount(state.world, rider);
    releaseRider(state);
    hooks.markUnsaved?.();
    return { handled: true, branch: 'dismount-minecart' };
  }
  if (action.heldTool !== (state.survival.held?.id ?? 0)) return skip('held-item-mismatch');
  if (!Number.isSafeInteger(action.cartId)) return skip('missing-cart');
  if (!minecarts) return skip('missing-cart');
  const cart = minecarts.carts.find(c => c.id === action.cartId && !c.dead);
  if (!cart) return skip('missing-cart');
  if (action.place && (cart.boat || cart.type === 0)) {
    syncRider(state);
    const mounted = minecarts.mount(cart, rider, { sneaking: action.sneak });
    if (mounted) { applySeat(state); hooks.markUnsaved?.(); }
    return { handled: true, branch: mounted ? (cart.boat ? 'mount-boat' : 'mount-minecart') : 'occupied-or-sneaking-minecart' };
  }
  const result = action.boat ? useBoat(state, { place: action.place, boat: cart }, hooks) : useMinecart(state, { place: action.place, cart }, hooks);
  if (rider.vehicle?.dead) releaseAtSeat(state, minecarts);
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
  // b80 spswing80: no stack size test (ItemMinecart.onItemUse, adj.a bytecode-read; attributes2-reference.json minecartOnRail count 0: used, spawned, after -1).
  if (!target?.block || !state.minecarts) return { handled: true, branch: 'no-rail' };
  const [x,y,z] = target.block;
  if (!state.minecarts.railKind(state.world,x,y,z)) return { handled: true, branch: 'no-rail' };
  const record = {x:f(f(x)+f(.5)),y:f(f(y)+f(.5)),z:f(f(z)+f(.5)),customName:held.name};
  const cart = type === 0 ? state.minecarts.spawnEmpty(record, { born: true }) : state.minecarts.spawnCart(type, record, { born: true });
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
// b89 horse89: a mount that died or was removed under the player (a cart or boat broken, a horse corpse set dead at deathTime 20, /kill). The client's own World drops the link
// (World.updateEntities: ridingEntity.isDead -> both links null; World.removeEntity -> rider.mountEntity(null), and EntityPlayer.mountEntity (yz.a(sa), bytecode-read) runs
// dismountEntity only when !worldObj.isRemote), so the client player stays where its last seat put it and falls from there; no S08 follows (spcopy88: the server copy also stays).
// The system's dismount still unlinks the record; its dismountSpot result is dropped.
function releaseAtSeat(state, system = vehicleSystem(state)) {
  const { rider, position } = state, seat = { x: position.x, y: position.y, z: position.z };
  system.dismount(state.world, rider);
  Object.assign(rider, seat);
  releaseRider(state);
}
// b89 horse89: `released` is set where the world tick let the rider go (a sneak dismount after the mount's update, a horse's buck): true, or the dismount spot itself when later
// code of the same tick may still copy the client position onto the rider record (structure-simulation.js vehicleBlockers in the cart / boat pushes).
function releaseSpot(state) {
  const { rider } = state, at = rider.released;
  rider.released = false;
  if (typeof at === "object") Object.assign(rider, at);
  releaseRider(state);
}
export function releaseRider(state) {
  Object.assign(state.position,{x:state.rider.x,y:state.rider.y,z:state.rider.z});
  // Keep dismounts inside resident terrain (the fixed viewport for legacy worlds).
  if (state.world.inside) for (const axis of ['x','z']) state.position[axis]=Math.max((state.world[axis === "x" ? "minX" : "minZ"] ?? 0)+.31,Math.min((state.world[axis === "x" ? "maxX" : "maxZ"] ?? SIZE)-.31,state.position[axis]));
  Object.assign(state.velocity,{x:0,y:0,z:0});
  Object.assign(state,{grounded:false,fallDistance:0,landedFall:0});
  state.motion.sneaking=false;
}
export function restorePlayerVehicle(state) {
  for(const sys of [state.minecarts,state.boats]) if(sys) for(const c of sys.carts) if(c.restorePlayer) {
    c.restorePlayer=false;
    if(!state.rider.vehicle && state.survival.health>0){syncRider(state);sys.mount(c,state.rider,{saved:true});applySeat(state);}
  }
  // A saved or imported horse or pig that carried the player (entities.js `playerRides`, the Riding compound of level.dat).
  for(const e of state.horses?.mobs?.entities ?? []) if(e.playerRides) {
    delete e.playerRides;
    if(!state.rider.vehicle && state.survival.health>0){syncRider(state);state.horses.mount(e,state.rider);applySeat(state);}
  }
}
// Returns null when ordinary movement should run. Dismount is itself captured and dispatched.
export function moveRidingPlayer(state, controls, hooks = {}) {
  const {rider}=state;
  // b88 horse88: EntityPlayerSP.onLivingUpdate reads `flag` (the previous tick's movementInput.jump) on every tick and clears bO whenever the player is not on a horse
  // (blk.e 321-328 and 1100, bytecode-read), so the key is tracked on foot too: mounting with the key held continues the count (horse-live.js horseJumpCounter's off-horse branch).
  if (!rider.vehicle) {
    if (rider.released) releaseSpot(state); // b89 horse89: a mount let go in the last world tick (no finishVehicleTick after it): the S08 spot
    rider.wasJump = !!controls.jump; rider.jumpPower = 0; return null;
  }
  const minecarts=vehicleSystem(state);
  syncRider(state);
  Object.assign(state.previous,state.position);
  // b89 horse89: every vehicle rides on through the sneak tick. The C0C's sneak (mw.a(FFZZ) -> setSneaking) reaches EntityPlayer.updateRidden (yz.ab, bytecode-read), which
  // World.updateEntityWithOptionalForce (ahb.a(sa, Z)) runs right after the mount's onUpdate: the mount first makes its ridden move with this tick's input (sneak 0.3 included;
  // a horse also lands a C0B jump sent this tick), then mountEntity(null) puts the rider on the dismount spot searched from its seat, with the moved mount's top as the fallback
  // (executed for the horse, horse89-reference.json; boats and carts share the World and EntityPlayer code). `sneakDismount` is that sneak flag and `sneakSeat` the live seat the
  // server player sits on (the network tick's updateRiderPosition); the mob tick (EntityWorld.riderSneakOff) or the cart / boat update (structure-simulation.js) acts on it and
  // sets `released` for finishVehicleTick. A flag still set here means the mount was not updated since, so the rider gets off now as before.
  const stale = !!rider.sneakDismount;
  rider.sneakDismount = false; rider.sneakSeat = null;
  if (rider.dead || rider.vehicle.dead) {
    state.horses?.charge(rider, controls, false);
    if (rider.vehicle.dead) releaseAtSeat(state, minecarts); // b89 horse89: the client keeps its seat (releaseAtSeat)
    else {minecarts.dismount(state.world,rider);releaseRider(state);}
  } else if (stale) {
    state.horses?.charge(rider, controls, false);
    minecarts.updateRiderPosition(rider.vehicle); // the server seats the dismount from the live cart; the client's seat (a cart's copy) trails it
    dispatchVehicleAction(state,captureVehicleAction({dismount:true}),hooks); // traced on the sneak tick
  } else {
    const input=moveInput({...controls}) /* EntityPlayerSP.onLivingUpdate: the 0.2 item-use slowdown needs isUsingItem && !isRiding (bytecode-read blk.e), so a rider is not slowed */;
    rider.moveForward=f(input.forward*f(.98));
    // EntityLivingBase moveStrafing is positive to the left; the browser strafe is positive to the right.
    rider.moveStrafing=f(-input.strafe*f(.98));
    state.horses?.charge(rider, controls); // horse-live.js: jump key counter
    minecarts.updateRiderPosition(rider.vehicle);
    applySeat(state);
    if (controls.sneak) { rider.sneakDismount = true; rider.sneakSeat = { x: rider.x, y: rider.y, z: rider.z }; hooks.trace?.(captureVehicleAction({dismount:true})); }
  }
  const {position:p}=state, half=f(PHYSICS.width)/2;
  const bb=[p.x-half,p.y,p.z-half,p.x+half,p.y+f(PHYSICS.height),p.z+half];
  return {inWater:waterAcceleration(state.world,entityWaterBox(bb),false).wet,inLavaNow:inLava(state.world,bb),sneakOnGround:true,oldPosition:{x:p.x,y:p.y,z:p.z}};
}
export function finishVehicleTick(state) {
  const {rider}=state, minecarts=vehicleSystem(state);
  if(rider.released&&!rider.vehicle)releaseSpot(state); // b89 horse89: let go in this tick's world update (riderSneakOff, the buck): the S08 spot
  if(!rider.vehicle)return;
  if(rider.vehicle.dead){releaseAtSeat(state,minecarts);return;} // b89 horse89: a dead or removed mount leaves the client at its seat
  if(state.survival.health<=0){minecarts.dismount(state.world,rider);releaseRider(state);}
  else {minecarts.updateRiderPosition(rider.vehicle);applySeat(state);}
}
export function detachPlayerVehicle(state) {
  if(state.rider.vehicle){vehicleSystem(state).dismount(state.world,state.rider);releaseRider(state);}
}
