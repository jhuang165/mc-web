// Browser-independent wiring of generated-structure entities into a live world (GEN-05b live):
// the mineshaft spawners (mob-spawner.js) and chest minecarts (minecarts.js) that
// world.generatedStructures lists for a version-10 Java world, their saves, and their tick
// segments. Presentation (particles, rendering, sounds, UI) stays with the caller through hooks.
//
// Saves are the seed plus edits, so regenerating a world rebuilds world.generatedStructures with
// full loot every time. The records therefore become live state only once, when a world record has
// no saved structure state yet (its first launch); afterwards the saved `spawners` / `minecarts`
// fields are the truth: a looted cart stays looted, a broken cart or spawner stays gone.
import { MobSpawners, boxesIntersect, mobBox, updateSpawner, updateSpawnerClient } from "./mob-spawner.js";
import { Minecarts } from "./minecarts.js";
import { CART_SUMMON, cartTypeOfSummon, summonCart } from "./cart-summon.js";
import { syncVehiclePassengers } from "./vehicle-riders.js";
import { furnaceUse } from "./cart-variants.js";
import { MOB_SPAWNER } from "./world.js";
import { mhSin, mhCos } from "./lighting.js";

const f = Math.fround;

// Liquid ids (original numbering) whose generation-time scheduled ticks the live Fluids queue takes.
const ORIGINAL_LIQUIDS = new Set([8, 9, 10, 11]);
// Entity.getCollisionBorderSize (0.1F): EntityRenderer.getMouseOver grows each box by it.
const BORDER = f(0.1);

// True when `record` already carries structure-entity state from an earlier session.
export const hasSavedStructures = (record) => Array.isArray(record?.spawners) || Array.isArray(record?.minecarts?.carts);

/**
 * Build the live spawners and minecarts for `world` from `record`.
 * A record with saved state restores it (MobSpawners.fromJSON / Minecarts.fromJSON); otherwise the
 * world's generation records are instantiated with their full contents. Spawner records whose cell
 * is no longer a monster spawner (a broken one, an edit over it) are dropped either way.
 * Returns { spawners, minecarts, fresh, pendingTicks }: `pendingTicks` are the generation-time
 * liquid ticks a fresh world should hand to its fluid queue ([] otherwise).
 */
export function restoreStructureEntities(record, world, { minecartOptions } = {}) {
  const generated = world.generatedStructures ?? null, fresh = !hasSavedStructures(record);
  const spawners = fresh ? new MobSpawners() : MobSpawners.fromJSON(record.spawners);
  const minecarts = fresh ? new Minecarts(minecartOptions) : Minecarts.fromJSON(record.minecarts, minecartOptions);
  if (fresh && generated) {
    for (const s of generated.spawners ?? []) spawners.add(s);
    for (const c of generated.minecartChests ?? []) minecarts.spawnChest(c);
  }
  for (const s of spawners.values()) if ((!world.streaming || world.isLoaded(s.x,s.z)) && world.get(s.x, s.y, s.z) !== MOB_SPAWNER) spawners.remove(s.x, s.y, s.z);
  const pendingTicks = fresh && generated ? (generated.pendingTicks ?? []).filter((t) => ORIGINAL_LIQUIDS.has(t.id)) : [];
  return { spawners, minecarts, fresh, pendingTicks };
}

// The save fields (TileEntityMobSpawner.writeToNBT records and EntityMinecartChest's saved fields).
export function saveStructureEntities({ spawners, minecarts }) {
  return { spawners: spawners ? spawners.toJSON() : [], minecarts: minecarts ? minecarts.toJSON() : { version: 1, carts: [] } };
}

// The player's box: Entity.setPosition with half width 0.3 and height 1.8 (as floats).
export const playerBox = ({ x, y, z }, width, height) => mobBox(x, y, z, width, height);

/**
 * EntityMinecart.onUpdate for every cart (World.updateEntities), then the pushes:
 * EntityLivingBase.collideWithNearbyEntities on the player and on each living mob calls
 * cart.applyEntityCollision(entity), which pushes the cart and returns the entity's share.
 * A cart's move is blocked by every pushable entity's box (EntityMinecart.getCollisionBox), but
 * the player and mobs are never blocked by a cart: EntityMinecart.getBoundingBox returns null.
 *
 * `state`: { world, minecarts, mobs, position, velocity, width, height, alive }.
 * `hooks.drop(drop)` receives each Minecarts drop ({ stack, original, x, posY, z, motion, delay }).
 * Returns the drops of this tick.
 */
export function tickMinecartSimulation(state, hooks = {}) {
  const { world, minecarts } = state;
  if (!minecarts?.carts.length) return [];
  const { blockers } = vehicleBlockers(state);
  minecarts.tick(world, { entities: blockers, host: hooks.cartHost ?? null });
  return pushAndDrain(state, hooks, minecarts);
}

// The solid boxes a vehicle's move meets, at the positions the entities have now: the player (a rider's stand-in keeps its identity, so its own cart
// excludes it) and every living mob. `sized` boxes a mob.
function vehicleBlockers(state) {
  const { mobs, position, width, height, alive = true, rider = null } = state;
  const living = (mobs?.entities ?? []).filter((e) => e.health > 0 || (e.death ?? 0) < 20);
  const sized = (e) => { const [w, h] = mobs.size(e); return mobBox(e.x, e.y, e.z, w, h); };
  const pBox = playerBox(position, width, height);
  const player = rider ? Object.assign(rider, { x: position.x, y: position.y, z: position.z, dead: !alive, bb: pBox }) : { ...position, bb: pBox };
  return { living, sized, pBox, player, blockers: [...(alive ? [player] : []), ...living.map((e) => ({ bb: sized(e), ref: e }))] };
}

// The player's and each mob's share of the push of the vehicles they stand against, then the passenger links and the drops.
function pushAndDrain(state, hooks, system, mobsPushed = false) {
  const { velocity, alive = true } = state;
  const { living, sized, pBox, player } = vehicleBlockers(state);
  if (alive) {
    const [vx, vz] = system.pushEntity(player, pBox);
    velocity.x += vx;
    velocity.z += vz;
    // The integrated server's copy takes the same applyEntityCollision push (EntityPlayerMP is pushed by the cart/boat in its own world too): ai.player.motion.
    const copy = state.mobs?.ai?.player?.motion;
    if (copy) { copy.x += vx; copy.z += vz; }
  }
  if (!mobsPushed) for (const e of living) {
    const [vx, vz] = system.pushEntity(e, sized(e));
    e.vx += vx;
    e.vz += vz;
  }
  syncVehiclePassengers(system.carts);
  const drops = system.drain();
  for (const d of drops) hooks.drop?.(d);
  return drops;
}

// The other vehicle list as blocking boxes: World.getCollidingBoundingBoxes adds getBoundingBox / getCollisionBox of every entity beside the mover, so a boat and a cart stop each other.
const solidVehicles = (system) => (system?.carts ?? []).filter((v) => !v.dead).map((v) => ({ bb: v.bb, ref: v }));

/**
 * One minecart's update where the loaded-entity walk reaches it (entity-simulation.js entityWalkers): EntityMinecart.onUpdate among the entities
 * that have already moved this tick, with its drops handed out at once (they join the list). The pushes of the player and the mobs follow the walk
 * (`finishMinecartSimulation`).
 */
export function tickMinecartOne(state, hooks, cart) {
  const { world, minecarts } = state;
  if (!minecarts || cart.dead) return;
  minecarts.tickOne(world, cart, [...vehicleBlockers(state).blockers, ...solidVehicles(state.boats)], hooks.cartHost ?? null);
  for (const d of minecarts.drain()) hooks.drop?.(d);
}
/** The part of tickMinecartSimulation that follows the walk: the cart's pushes on the player and the mobs, the passenger links, the leftover drops. */
export function finishMinecartSimulation(state, hooks = {}) {
  if (!state.minecarts?.carts.length) return [];
  return pushAndDrain(state, hooks, state.minecarts, true);
}
/**
 * A mob's own collideWithNearbyEntities against the carts (or boats): EntityLivingBase.onLivingUpdate ends with it, so the push runs inside the mob's update
 * (the walk reaches it with the position the mob has after its move, before a rider's seat is taken), not after the whole walk. Called by EntityWorld.push.
 */
export function pushMobOnVehicles(state, system, e) {
  if (!system?.carts.length || !state.mobs) return;
  const [w, h] = state.mobs.size(e), [vx, vz] = system.pushEntity(e, mobBox(e.x, e.y, e.z, w, h));
  e.vx += vx;
  e.vz += vz;
}

/**
 * The tile-entity part of World.updateEntities for spawners (MobSpawnerBaseLogic.updateEntity),
 * server branch: `env` is EntityWorld.spawnerHooks' light environment; carts block spawns
 * (World.checkNoEntityCollision sees minecarts). `state`: { spawners, mobs, minecarts, random,
 * feet } with `feet` the server player position, or null when dead.
 * Returns the mobs spawned this tick.
 */
export function tickSpawnerSimulation(state, env = {}, hooks = {}) {
  const { spawners, mobs, minecarts, boats, random, feet } = state;
  const cartSpawners = liveCartSpawners(minecarts, state.isLoaded);
  if ((!spawners?.size && !cartSpawners.length) || !mobs) return [];
  const extraCollision = (box) => !!minecarts?.carts.some((c) => !c.dead && boxesIntersect(box, c.bb));
  const ctx = {
    ...mobs.spawnerHooks({ ...env, extraCollision, spawnVehicle: (id, tag, rider) => spawnerVehicle({ minecarts, boats }, id, tag, rider) }),
    random,
    players: feet ? [feet] : [],
    spawnParticles: hooks.spawnParticles,
  };
  const out = spawners?.size ? spawners.tick(ctx) : [];
  // EntityMinecartMobSpawner.onUpdate: the cart moves, then the logic runs at the block the cart is in.
  for (const s of cartSpawners) out.push(...updateSpawner(s, ctx));
  return out;
}

// A SpawnData Riding mount that is a minecart or boat (agq.a(sa)): created at the rider with setLocationAndAngles, so posY is the rider's y plus the
// vehicle's yOffset (0.35 and 0.3, probed in spawn-data-reference.json). Null for any other id or when this world has no such list.
export function spawnerVehicle({ minecarts, boats }, id, tag, rider) {
  const cart = cartTypeOfSummon(CART_SUMMON[id]);
  if (cart !== null) return minecarts ? summonCart(minecarts, cart, rider.x, rider.y, rider.z, tag)?.cart ?? null : null;
  if (id !== "Boat" || !boats) return null;
  const boat = boats.spawnBoat({ x: rider.x, y: rider.y, z: rider.z, yaw: rider.rotationYaw ?? 0 });
  boat.pitch = boat.prevPitch = Math.fround(rider.rotationPitch ?? 0);
  return boat;
}

// The spawner cart's logic (xu) at floor(posX), floor(posY), floor(posZ) of the cart (xu.b, xu.c, xu.d), for every live type 4 cart.
export function liveCartSpawners(minecarts, isLoaded = null) {
  const out = [];
  for (const c of minecarts?.carts ?? []) {
    if (c.type !== 4 || c.dead || !c.spawner || (isLoaded && !isLoaded(c.x, c.z))) continue;
    c.spawner.x = Math.floor(c.x); c.spawner.y = Math.floor(c.posY); c.spawner.z = Math.floor(c.z);
    out.push(c.spawner);
  }
  return out;
}

// The client branch (smoke and flame, the display mob's spin), with `eye` the client player's posY.
export function tickSpawnersClient({ spawners, minecarts, random, eye }, hooks = {}) {
  const carts = liveCartSpawners(minecarts);
  if (!spawners?.size && !carts.length) return;
  const ctx = { random, players: eye ? [eye] : [], particle: hooks.particle };
  spawners?.tickClient(ctx);
  for (const s of carts) updateSpawnerClient(s, ctx);
}

// RenderGlobal.playAuxSFX 2004 (a spawner spawned a mob): 20 smoke and flame pairs within a
// block of the spawner's centre, drawn from the client world's Random.
export function spawnerBurst(x, y, z, random, particle) {
  for (let i = 0; i < 20; i++) {
    const px = x + 0.5 + (random.nextFloat() - 0.5) * 2, py = y + 0.5 + (random.nextFloat() - 0.5) * 2, pz = z + 0.5 + (random.nextFloat() - 0.5) * 2;
    particle("smoke", px, py, pz);
    particle("flame", px, py, pz);
  }
}

/**
 * EntityRenderer.getMouseOver for carts: the nearest live cart whose box, grown by the 0.1
 * collision border, the eye ray meets within `reach` and before `wallDistance`.
 * `dir` must be a unit vector. Returns { cart, distance } or null.
 */
export function pickMinecart(minecarts, origin, dir, reach, wallDistance = reach, ignoredCart = null, boxOf = null) {
  let best = null;
  const limit = Math.min(reach, wallDistance);
  for (const cart of minecarts?.pickable() ?? []) {
    if (cart === ignoredCart) continue;
    const b = boxOf ? boxOf(cart) : cart.bb; // Batch 49: the client copy's box (null: no copy, not aimable)
    if (!b) continue;
    const lo = [b[0] - BORDER, b[1] - BORDER, b[2] - BORDER], hi = [b[3] + BORDER, b[4] + BORDER, b[5] + BORDER];
    const o = [origin.x, origin.y, origin.z], d = [dir.x, dir.y, dir.z];
    let near = 0, far = limit, inside = true;
    for (let i = 0; i < 3 && inside; i++) {
      if (Math.abs(d[i]) < 1e-8) { if (o[i] < lo[i] || o[i] > hi[i]) inside = false; continue; }
      const a = (lo[i] - o[i]) / d[i], c = (hi[i] - o[i]) / d[i];
      near = Math.max(near, Math.min(a, c));
      far = Math.min(far, Math.max(a, c));
      if (far < near) inside = false;
    }
    if (inside && near <= limit && (!best || near < best.distance)) best = { cart, distance: near };
  }
  return best;
}

/**
 * The player's click on a cart. Left (attack): EntityPlayer.attackTargetEntityWithCurrentItem
 * against a non-living entity: the held item's attack damage with no critical bonus, the sprint
 * knockback (addVelocity on the cart, the player's motion x 0.6 and sprint off), no tool wear,
 * then addExhaustion(0.3); EntityMinecart.attackEntityFrom does the rest. Right (use):
 * EntityMinecartContainer.interactFirst opens the cart's chest screen.
 * `state`: { minecarts, survival, position, velocity, motion, yaw }; `hooks.damage()` is the held
 * item's attack damage, `hooks.openContainer(container)` shows the screen.
 */
export function useMinecart(state, { place, cart }, hooks = {}) {
  const { minecarts, survival } = state;
  if (!cart || cart.dead) return { handled: false, branch: "missing-cart" };
  if (place) {
    // EntityMinecartFurnace.interactFirst: coal fuels the cart and the player's side sets the push.
    if (cart.type === 2) {
      const held = survival.held;
      return { handled: true, branch: furnaceUse(cart, { held, creative: survival.creative, take: () => survival.take(held.id, 1), position: state.position }) };
    }
    if (cart.type === 6) { hooks.openCommandCart?.(cart); return { handled: true, branch: "open-command-cart" }; } // xn.c(yz): client side displayGUIcommandBlock
    const container = minecarts.container(cart, survival.inventory);
    if (container) hooks.openContainer?.(container, container.kind);
    return { handled: true, branch: "open-minecart" };
  }
  // Minecraft.clickMouse swings before attackEntity; a use (interactFirst succeeded) does not.
  hooks.swing?.();
  const damage = hooks.damage ? hooks.damage() : 1;
  minecarts.hit(cart, damage, { creative: survival.creative });
  // EntityMinecart.attackEntityFrom always returns true, so a sprint hit always knocks back.
  if (state.motion?.sprinting) {
    const rad = f(f(f(180 - state.yaw * (180 / Math.PI)) * f(Math.PI)) / 180);
    cart.vx += f(f(-mhSin(rad) * 1) * 0.5);
    cart.vy += 0.1;
    cart.vz += f(f(mhCos(rad) * 1) * 0.5);
    state.velocity.x *= 0.6;
    state.velocity.z *= 0.6;
    state.motion.sprinting = false;
  }
  survival.exhaust?.(0.3);
  return { handled: true, branch: cart.dead ? "break-minecart" : "hit-minecart" };
}

// Boat left click: swing, EntityBoat.attackEntityFrom (breaks drop the boat, Creative breaks drop nothing),
// then the sprint knockback of attackTargetEntityWithCurrentItem. Right click mounts and is dispatched earlier.
export function useBoat(state, { place, boat }, hooks = {}) {
  const { boats, survival } = state;
  if (!boat || boat.dead || place) return { handled: false, branch: "missing-boat" };
  hooks.swing?.();
  const damage = hooks.damage ? hooks.damage() : 1;
  boats.attack(boat, damage, { creative: survival.creative });
  if (state.motion?.sprinting) {
    const rad = f(f(f(180 - state.yaw * (180 / Math.PI)) * f(Math.PI)) / 180);
    boat.vx += f(f(-mhSin(rad) * 1) * 0.5);
    boat.vy += 0.1;
    boat.vz += f(f(mhCos(rad) * 1) * 0.5);
    state.velocity.x *= 0.6;
    state.velocity.z *= 0.6;
    state.motion.sprinting = false;
  }
  survival.exhaust?.(0.3);
  return { handled: true, branch: boat.dead ? "break-boat" : "hit-boat" };
}

// Boats: the same blockers and pushes as tickMinecartSimulation; `hooks` carries clear/splash/particle.
export function tickBoatSimulation(state, hooks = {}) {
  const { world, boats } = state;
  if (!boats?.carts.length) return [];
  const { blockers } = vehicleBlockers(state);
  boats.tick(world, { entities: blockers, hooks });
  return pushAndDrain(state, hooks, boats);
}
/** One boat's update where the loaded-entity walk reaches it (see tickMinecartOne). */
export function tickBoatOne(state, hooks, boat) {
  const { world, boats } = state;
  if (!boats || boat.dead) return;
  boats.tickOne(world, boat, [...vehicleBlockers(state).blockers, ...solidVehicles(state.minecarts)], hooks);
  for (const d of boats.drain()) hooks.drop?.(d);
}
export function finishBoatSimulation(state, hooks = {}) {
  if (!state.boats?.carts.length) return [];
  return pushAndDrain(state, hooks, state.boats, true);
}
