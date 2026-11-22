// Minecarts and boats of the dedicated world, and riding them (batch 61 mpvehicles).
//
// The single-player vehicle code is reused unchanged: `Minecarts` (src/minecarts.js, rails, powered rails, collisions, hit wobble, drops) and `Boats` (src/boats.js, buoyancy,
// rider input, crash breaks). The server owns both lists, ticks them once per world tick with the players' and mobs' boxes as blockers, pushes players and mobs that stand
// against them, and hands their drops to the world's item entities. Nothing here runs the object tracker (src/object-tracker.js): a vehicle's state is a handful of numbers, so
// each player gets a plain `vehicles` message ({ set: [state], del: [key] }, only the vehicles within 80 blocks whose state changed) and the client (remote-vehicles.js) keeps
// stand-in records for the existing renderers. That is the smaller change: no entry timing, no S1C metadata, no ride copies.
//
// Wire (new, all prefixed `veh`): client -> server `vehUse { v }` (C02 interact), `vehHit { v }` (C02 attack); server -> client `vehicles { set, del }`; presence gains `riding`.
// A vehicle's key is 'c<id>' (minecart) or 'b<id>' (boat).
//
// Riding: C02 interact mounts (Minecarts.mount / Boats.mount, refused while sneaking or occupied); the player's position is the seat, taken from the vehicle after its tick;
// sneaking dismounts (Minecarts.dismount, EntityLivingBase.dismountEntity); a boat reads the rider's forward/strafe input and yaw, a cart takes none. onARail runs through
// `sim.achievements` (Achievements.rideMinecart, EntityPlayer.addMovementStat, bytecode-read yz.k: any EntityMinecart, only when the player moved).
import { serverRiderFall } from './server-rider-fall.js';
import { Minecarts } from '../minecarts.js';
import { canLightningStrikeAt } from '../weather.js'; // b83 rain83
import { Boats, boatClearCell, boatRay } from '../boats.js';
import { makeStack } from '../inventory.js';
import { registerBoatWorld, worldBoatBoxes } from '../entity-collision.js';
import { EntityIds } from '../entity-ids.js';
import { placeHeldMinecart } from '../vehicle-simulation.js';
import { ITEMS } from '../survival.js';
import { PHYSICS } from '../world.js';
import { moveInput } from '../player-movement.js';
import { heldAttackDamage, setWorldEntityBoxes } from '../entities.js';
import { pickMinecart } from '../structure-simulation.js';
import { installPoweredRails } from '../powered-rails.js';
import { ServerRiding } from './server-riding.js';
import { ServerHorses } from './server-horses.js'; // b76 mphorse76
import { fast89 } from '../mpperf89-fast.js'; // b89 mpperf89
import { eachView90 } from '../mpperf90-fast.js'; // b90 mpperf90
import { syncVehiclePassengers } from '../vehicle-riders.js';
import { useEntityInReach } from './use-entity-reach.js'; // b70 mpclicks: processUseEntity's reach (posY to posY, 36 or 9 without sight)
import { vehicleSprintPush } from './server-vehicle-hit.js'; // b75 mpusesweep75
import { CartTracker, setVehicleInfo, joinWatcher, stringChange } from './server-cart-track.js'; // b71 mpreach71: minecart tracker cadence (80 / 3 / velocity)
import { ServerHanging } from './server-hanging.js'; // b68 mppaintings: paintings, item frames and knots of this dimension
import { boatPlaceEntities, mobBallLists, playerListed, crystalBox } from '../boat-place-entities.js'; // b87 boatcheck87 (b88 boatray88: playerListed)
import { serverPosY, SLEEP_BOX } from '../sleeper-eye.js';

const f = Math.fround;
export const PLACEABLE_CARTS = new Set([0, 1, 2, 3, 5, 6]); // plain, chest, furnace, TNT and hopper carts (b62: chest and hopper carts open server windows, openCart)
export const RANGE = 80; // EntityTracker range of a minecart and a boat
export const keyOf = v => (v.boat ? 'b' : 'c') + v.id;
const r4 = v => Math.round(v * 1e4) / 1e4;

// What a client copy draws: position (posY, the entity centre), angles, hit wobble, the furnace cart's lit flag and the TNT cart's fuse.
export function vehicleState(v) {
  const s = { v: keyOf(v), x: r4(v.x), y: r4(v.posY), z: r4(v.z), yaw: r4(v.yaw), pitch: r4(v.pitch) };
  if (v.boat) { s.th = v.timeSinceHit; s.dm = r4(v.damage); s.fd = v.forwardDir; } else {
    s.t = v.type; if (v.type === 6) s.cmd = v.command?.command ?? ''; s.rl = v.rolling; s.rd = v.rollingDir; s.dm = r4(v.damage);
    if (v.type === 2 && v.lit) s.lit = 1;
    if (v.type === 3 && v.fuse >= 0) s.fuse = v.fuse;
    if (v.dispOn) Object.assign(s, { dr: v.dispRaw | 0, dof: v.dispOffset ?? 6 }); // b96 portals96: watchers 20-22 (CustomDisplayTile from a save, /summon or a portal copy)
  }
  return s;
}

// b86 seat86: the C0C of a riding client (remote-vehicles.js riderPacket): { s: moveStrafing, f: moveForward, j: jump, k: sneak }, or null when the message carries none.
export function cleanRide(r) {
  if (!r || typeof r !== 'object') return null;
  return { s: typeof r.s === 'number' ? r.s : NaN, f: typeof r.f === 'number' ? r.f : NaN, j: r.j === true, k: r.k === true };
}
// The `input` message's C0C half (simulation.js input): the newest one is kept on the player; `rideSeen` marks a client that sends them (an older client gets the controls rule).
export function takeRide(p, ride) { p.ride = cleanRide(ride); if (p.ride) p.rideSeen = true; }
// b92 horse92: mw.a(FFZZ) is a no-op unless ridingEntity != null (bytecode-read), and the network queue runs the packets in arrival order, so a C0C that arrives before the C02 that
// mounts is dropped (the old code kept it and the mount's first tick used it). `queued`: this player already has a C02 / interact waiting in the tick's action list, which may mount
// before this C0C is read; the C0C then waits behind it in the same list and is read as `{ id, ride }` (simulation.js actions loop) only if the player is mounted by then.
// b94 horse94: every C05 of a riding player reaches mw.i -> yz.h -> sv.e, which multiplies the rider's moveForward / moveStrafing by 0.98F in place BEFORE the C0C of the same tick
// overwrites them (Horse94Probe, executed: horse94-reference.json playerRider). A tick whose message carries no C0C leaves the horse a decayed 0.98 * old value (0.9604, 0.9412, ...), and a
// C0C component outside [-1, 1] keeps the decayed old value (applyRide leaves it alone). The decay is done as the message arrives; no message, no decay (mw.h, the world tick, never runs sv.e).
export function decayRideInput(rider) {
  if (!rider) return;
  rider.moveForward = f(f(rider.moveForward || 0) * f(0.98));
  rider.moveStrafing = f(f(rider.moveStrafing || 0) * f(0.98));
}
export function takeRideOrQueue(host, p, id, ride) {
  if (p.mount) { decayRideInput(p.mount.rider); takeRide(p, ride); return; }
  if (!cleanRide(ride)) return;
  p.rideSeen = true; // the client is a C0C sender whatever happened to this one
  if (host.actions.some(a => a.id === id && (a.veh || a.animUse !== undefined))) host.actions.push({ id, ride });
}
// NetHandlerPlayServer.processInput (nh.a(jk)) -> EntityPlayerMP.setEntityActionState (mw.a(FFZZ), bytecode-read): only while ridingEntity != null, moveStrafing and moveForward each
// take the packet's value when it lies in [-1, 1] (else the old one stays), isJumping = jump, setSneaking(sneak). The boat reads them in the world tick that follows (the C05 before it
// ran mw.i(), whose sv.e scaled the OLD values by 0.98F, then the C0C overwrote them), so a server boat steers on the client's newest C0C.
export function applyRide(rider, r) {
  if (r.s >= -1 && r.s <= 1) rider.moveStrafing = f(r.s);
  if (r.f >= -1 && r.f <= 1) rider.moveForward = f(r.f);
  rider.jumping = r.j;
}
// b86 seat86: AUX range of WorldManager.playAuxSFX (mp.a(yz, IIIII)): S28 through ServerConfigurationManager.sendToAllNearExcept(null, x, y, z, 64, dim): squared distance from the
// int corner to the player's position under 64 * 64, nobody excluded.
const AUX_RANGE_SQ = 64 * 64;

export class ServerVehicles {
  // `host` is the DedicatedSimulation (world, players, items, mobs, soundsOut, achievements, actions).
  constructor(host, saved = null) {
    this.host = host;
    const ids = this.ids = new EntityIds();
    this.carts = saved?.carts ? Minecarts.fromJSON(saved.carts, { ids }) : new Minecarts({ ids });
    this.boats = saved?.boats ? Boats.fromJSON(saved.boats, { ids }) : new Boats({ ids });
    // b84 lead (rain84's server half): moveEntity's isWet for boats (boats.js reads `this.rain`/`this.fizz` when the hooks lack them); the fizz at the boat's feet.
    this.boats.rain = (x, y, z) => !this.dim && !!host.weather && canLightningStrikeAt(host.weather, host.world, x, y, z);
    this.boats.fizz = (b, volume, pitch) => host.soundsOut.push({ name: 'random.fizz', x: b.x, y: b.y, z: b.z, volume, pitch, except: null });
    for (const c of [...this.carts.carts, ...this.boats.carts]) c.restorePlayer = false; // nobody is aboard after a restart
    this.cartCommands = []; // b63: command block carts an activator rail triggered this tick, run by ServerSocial.drain (server-cart-commands.js)
    this.cartHost = {
      explode: (cart, x, y, z, power) => { host.mobs.explode({ x, y, z, size: power, source: null }); host.mobs.burst(x, y, z, power); }, // b80 mpfx80: xv calls createExplosion(this, .., true), so WorldServer.newExplosion sends S27; the cart's blast sent none (no particles, sound or push)
      particle() {}, // WorldServer.spawnParticle sends nothing
      sound: (name, cart, volume = 1, pitch = 1) => host.soundsOut.push({ name, x: cart.x, y: cart.posY, z: cart.z, volume, pitch, except: null }),
      rain: (x, y, z) => !this.dim && !!host.weather && canLightningStrikeAt(host.weather, host.world, x, y, z), // b83 rain83: moveEntity's isWet for carts (minecarts.js); the Nether/End host inherits the Overworld's weather, but nothing rains there
      get transfer() { return host.containers.ticks?.hoppers.host; }, // b62: a hopper cart sucks from the container or item above it (cart-hopper.js)
      changed: keys => host.containers.ticks?.changed(keys),
      runCommand: cart => { this.cartCommands.push(cart); }, // b63: xn.a(x, y, z, powered) -> CommandBlockLogic.func_145755_a
    };
    registerBoatWorld(host.world, this.boats); setWorldEntityBoxes(worldBoatBoxes); // b67 boatstand: players and mobs stand on and bump into this world's boats (World.getCollidingBoundingBoxes)
    this.hanging = new ServerHanging(host, ids, saved?.hanging ?? null); // b68 mppaintings: this dimension's paintings and item frames (leash knots come from the mobs)
    this.pigs = new ServerRiding(host, this); // b62: saddled pigs (server-riding.js)
    this.horses = new ServerHorses(host, this); // b76 mphorse76: horses, donkeys, mules (server-horses.js)
    this.views = new Map(); // player id -> { known: Map(key -> JSON), sent: Set(key) }
    // b86 seat86: xi.h's snow and lily pad clears on the server world (boats.js boatClearCell): a lily pad sends its 2001 to this dimension's players within 64 blocks (the rider too)
    // and drops itself; a snow layer is only set to air. Before, both were a plain set (no particles for anyone, no lily pad item).
    this.boatHooks = { clear: (x, y, z, block) => boatClearCell(host.world, x, y, z, block, {
      aux: (id, ax, ay, az, data) => { for (const p of this.host.players.values()) { const dx = ax - p.position.x, dy = ay - p.position.y, dz = az - p.position.z; if (dx * dx + dy * dy + dz * dz < AUX_RANGE_SQ) (p.itemsOut ??= []).push({ type: 'aux', events: [{ id, x: ax, y: ay, z: az, data }] }); } },
      drop: (stacks, dx, dy, dz) => this.host.items?.dropBlock?.(stacks.map(st => makeStack(st.id, st.count, st.damage)), dx, dy, dz),
    }) };
  }
  // b62: the rail redstone (powered, detector and activator rails: powered-rails.js) and the detector rail's cart touch. The dedicated world never installed them before.
  connect(redstone) {
    installPoweredRails(redstone);
    this.carts.blockHook = (x, y, z) => redstone.collide(x, y, z); // Entity.func_145775_I -> BlockRailDetector.onEntityCollidedWithBlock (the world's write hook sends the change)
  }
  // LiveRedstone `entitiesIn` modes "minecart" (EntityMinecart) and "inventory" (chest and hopper carts with their comparator signal, Container.calcRedstoneFromInventory).
  cartsIn(box, mode) {
    const out = [];
    for (const c of this.carts.carts) {
      const b = c.bb;
      if (c.dead || !b || !(b[3] > box[0] && b[0] < box[3] && b[4] > box[1] && b[1] < box[4] && b[5] > box[2] && b[2] < box[5])) continue;
      if (mode !== 'inventory') out.push(c);
      else if (c.type === 1 || c.type === 5) out.push({ cart: c, signal: this.carts.comparator(c) });
    }
    return out;
  }
  get all() { return [...this.carts.carts, ...this.boats.carts]; }
  systemOf(v) { return v.boat ? this.boats : this.carts; }
  find(key) {
    if (typeof key !== 'string' || !/^[bc]\d+$/.test(key)) return null;
    const system = key[0] === 'b' ? this.boats : this.carts, id = Number(key.slice(1));
    return system.carts.find(c => c.id === id && !c.dead) ?? null;
  }
  addPlayer(p) { this.views.set(p.id, { known: new Map() }); this.hanging.addPlayer(p); }
  removePlayer(p) { this.horses.logout(p); this.dismount(p); this.views.delete(p.id); this.hanging.removePlayer(p); }

  // A vehicle placed at a position by something other than a player (a dispenser, a command): kind 'minecart' | 'chest_minecart' | 'furnace_minecart' | 'tnt_minecart' | 'hopper_minecart' | 'boat'.
  // Cart records are the rail cell centre as ItemMinecart makes them; a boat's `y` is its box bottom, as ItemBoat passes it. Returns the vehicle or null.
  spawnVehicle(kind, x, y, z, { yaw = 0 } = {}) {
    if (![x, y, z].every(Number.isFinite)) return null;
    if (kind === 'boat') return this.boats.spawnBoat({ x, y, z, yaw }, { born: true });
    const type = { minecart: 0, chest_minecart: 1, furnace_minecart: 2, tnt_minecart: 3, hopper_minecart: 5, command_minecart: 6 }[kind];
    return type === undefined ? null : this.carts.spawnCart(type, { x, y, z, items: [] }, { born: true });
  }

  // The right button with a vehicle item in hand: a minecart on a rail cell (ItemMinecart.onItemUse) or a boat on the water the view ray reaches (ItemBoat.onItemRightClick).
  // `target` is the server's block ray (or null). True when an item was used.
  useHeld(p, target) {
    const held = p.survival.held, item = held && ITEMS[held.id];
    if (!item) return false;
    if (item.minecartType !== undefined) {
      if (!PLACEABLE_CARTS.has(item.minecartType) || !target) return false;
      const out = placeHeldMinecart({ survival: p.survival, minecarts: this.carts, world: this.host.world }, { target }, {});
      if (out.branch !== 'place-minecart') return false;
      p.swing = 6;
      return true;
    }
    if (!item.boat) return false;
    const pos = p.position, half = PHYSICS.width / 2;
    // b88 boatray88: abj.a's own ray (boats.js boatRay): MathHelper's sin / cos tables of the float rotation the C05 / C06 carried (Math.sin / Math.cos before), from
    // posY + 1.62 - yOffset with EntityPlayerMP's yOffset 0 (posY = box bottom - ySize, as the player tracker reads it).
    const { eye, dir } = boatRay(pos, p.motion?.ySize ?? 0, f(180 - p.yaw * 180 / Math.PI), f(-p.pitch * 180 / Math.PI), 0);
    const pbox = [pos.x - half, pos.y, pos.z - half, pos.x + half, pos.y + PHYSICS.height, pos.z + half];
    const sight = this.boatEntities(p); // b87 boatcheck87: every entity kind of this dimension with its native box, canBeCollidedWith and border (boat-place-entities.js)
    if (!this.boats.place(this.host.world, { eye, dir, yaw: f(180 - p.yaw * 180 / Math.PI), box: pbox }, [{ bb: pbox }, ...sight], sight)) return false;
    if (!p.survival.creative) p.survival.take(held.id, 1);
    p.swing = 6;
    return true;
  }

  // b87 boatcheck87: ItemBoat's entity rows for player `p`: the other players of this dimension (a lying one's 0.2 box), mobs (dying ones until their 20th tick), crystals,
  // the dragon's body and parts, knots, items, orbs, arrows, thrown balls and potions, fireballs and skulls, falling blocks, primed TNT, rockets, eyes, hooks, vehicles and
  // hanging entities. The dimension's lists are the host's (the Nether's swap puts its own there, as explode does in server-mobs.js).
  boatEntities(p) {
    const host = this.host, mobs = host.mobs?.mobs, d = host.dispense, players = [...host.players.values()];
    return boatPlaceEntities({
      players: players.filter(q => q !== p && q.position && playerListed(q)).map(q => this.boatPlayerBox(q)) /* b88 boatray88: a dead one until the tick after deathTime 20 */, mobs, items: host.items?.items ?? [], orbs: host.serverItems?.xp?.orbs ?? [],
      arrows: d?.arrows?.list ?? [], balls: [d?.balls?.balls, d?.potions?.projectiles?.balls, ...mobBallLists(mobs)], fireballs: [mobs?._fireballs, mobs?._skulls].filter(Boolean),
      falling: host.falling?.entities ?? [], primed: d?.primed ?? [], rockets: d?.rockets?.rockets ?? [], eyes: d?._eyes?.system.eyes ?? [],
      hooks: players.map(q => host.fishing?.hookOf?.(q)).filter(Boolean), vehicles: [this.carts.carts, this.boats.carts], hanging: this.hanging?.entities ?? [],
    });
  }
  // A lying player's 0.2 box (sleeper-eye.js), else playerBox.
  boatPlayerBox(p) {
    if (!p.sleeping) return this.playerBox(p);
    const h = SLEEP_BOX / 2, y = serverPosY(p.position.y, true);
    return [p.position.x - h, y, p.position.z - h, p.position.x + h, y + SLEEP_BOX, p.position.z + h];
  }
  playerBox(p) { const h = PHYSICS.width / 2; return [p.position.x - h, p.position.y, p.position.z - h, p.position.x + h, p.position.y + PHYSICS.height, p.position.z + h]; }
  boxesOfMobs() {
    const mobs = this.host.mobs.mobs;
    return mobs.entities.filter(e => e.health > 0).map(e => { if (e.type === 'ender_crystal') return { bb: crystalBox(e.x, e.y, e.z), ref: e }; const [w, h] = mobs.size(e); return { bb: [e.x - w / 2, e.y, e.z - w / 2, e.x + w / 2, e.y + h, e.z + w / 2], ref: e }; });
  }

  // C02 UseEntity as the server queues it: `{ v, hit }`. Reach is the server's, from the player's eye to the vehicle's box centre.
  queue(id, m) {
    const host = this.host;
    if (!host.players.has(id) || typeof m?.v !== 'string' || !/^[bchk]\d+$/.test(m.v) || host.actions.filter(a => a.id === id).length >= 4) return false;
    host.actions.push({ id, veh: { v: m.v, hit: m.hit === true } });
    return true;
  }
  act(p, { v: key, hit }) {
    if (/^[hk]/.test(key)) return this.hanging.act(p, key, hit); // b68 mppaintings: a painting, item frame or leash knot
    const host = this.host, v = this.find(key);
    if (!v || p.survival.health <= 0 || p.mount?.key === key) return false; // a rider cannot hit or use the vehicle it sits in
    // b70: getDistanceSqToEntity from posY, eye height 0 (Entity default). b71 mpreach71: the native posY field (v.posY = minY + yOffset - ySize; yOffset = height / 2 for EntityBoat and
    // EntityMinecart (xi, xl set L = N / 2), ySize stays 0: stepHeight 0 and sa.d only does ySize *= 0.4), not a recomputed box centre
    if (!useEntityInReach(host.world, p, { x: v.x, y: v.posY, z: v.z, eye: 0 })) return false;
    const system = this.systemOf(v);
    if (hit) { // Minecraft.clickMouse swings, then EntityMinecart / EntityBoat.attackEntityFrom with the held weapon's damage
      p.swing = 6;
      system.hit(v, heldAttackDamage(p.survival.held?.id ?? 0, p.survival), { creative: p.survival.creative });
      vehicleSprintPush(p, v); // b75 mpusesweep75: EntityPlayer.attackTargetEntityWithCurrentItem's sprint knockback on a cart or boat
      p.survival.exhaust?.(0.3);
      return true;
    }
    if (p.mount) return false;
    if (!v.boat && v.type === 2) { // EntityMinecartFurnace.interactFirst: coal fuels it and the player's side sets the push
      const held = p.survival.held;
      if (held && (held.id === 301 || held.id === 308)) { if (!p.survival.creative) p.survival.take(held.id, 1); v.fuel += 3600; }
      v.pushX = v.x - p.position.x; v.pushZ = v.z - p.position.z; v.lit = v.fuel > 0;
      return true;
    }
    if (!v.boat && (v.type === 1 || v.type === 5)) return host.containers.openCart(p, v, key); // b62: EntityMinecartContainer.interactFirst -> displayGUIChest (a hopper cart opens its hopper window)
    if (!v.boat && v.type !== 0) return false; // the command block cart is not connected
    const rider = this.riderOf(p);
    if (!system.mount(v, rider, { sneaking: !!p.input?.sneak })) return false;
    p.mount = { key, boat: !!v.boat, rider };
    this.seat(p);
    return true;
  }

  // The vehicle systems' rider record for a player: feet position, the yaw in degrees (syncRider), the input a boat reads and the fall a mount passes on.
  riderOf(p) {
    return p.mount?.rider ?? { player: true, ref: p, x: p.position.x, y: p.position.y, z: p.position.z, yaw: 0, moveForward: 0, moveStrafing: 0, fallDistance: 0, vehicle: null,
      width: f(PHYSICS.width), height: f(PHYSICS.height), dead: false,
      fall: serverRiderFall(this.host, p) }; // b73 mpriders73: EntityLivingBase.fall with Jump Boost and the fall sounds
  }
  riding(p) { return !!p.mount; }
  // b73 mpriders73: the box of what the player rides (a boat, a cart or a mob), for EntityPlayer.onLivingUpdate's pickup box; null when not riding or it is dead.
  ridingBox(p) {
    const m = p.mount;
    if (!m) return null;
    if (m.mob) { if (m.mob.health <= 0 && (m.mob.death ?? 0) >= 20) return null; /* b80: the pickup box tests ridingEntity.isDead */ const [w, h] = this.host.mobs.mobs.size(m.mob); return [m.mob.x - w / 2, m.mob.y, m.mob.z - w / 2, m.mob.x + w / 2, m.mob.y + h, m.mob.z + w / 2]; }
    const v = this.find(m.key);
    return v && !v.dead ? v.bb ?? null : null;
  }
  // The player is where the seat is. Entity.updateRiderPosition: the system puts the rider record there, the player follows it.
  seat(p) {
    const r = p.mount.rider, pos = p.position;
    Object.assign(p.previous, { x: pos.x, y: pos.y, z: pos.z });
    pos.x = r.x; pos.y = r.y; pos.z = r.z;
    Object.assign(p.velocity, { x: 0, y: 0, z: 0 });
    Object.assign(p, { grounded: false, collidedH: false, flying: false, fallDistance: 0, landedFall: 0 });
    Object.assign(p.motion, { sprinting: false, ySize: 0, prevYSize: 0 });
  }
  // What movePlayer returns, for a player carried by a vehicle (no walked distance, no water or lava of its own).
  sit(p) { return { inWater: false, inLavaNow: false, sneakOnGround: true, riding: true /* b81 exhaust81: yz.k returns for a rider (no movement exhaustion) */, oldPosition: { x: p.position.x, y: p.position.y, z: p.position.z } }; }
  dismount(p) {
    const m = p.mount;
    if (!m) return;
    if (m.mob) this.pigs.leave(p); // b62: a pig's rider is put down beside it (horseSeats.dismount)
    const v = m.mob ? null : this.find(m.key) ?? m.rider.vehicle;
    if (!m.mob && m.rider.vehicle) { (v?.boat ? this.boats : this.carts).dismount(this.host.world, m.rider); }
    Object.assign(p.position, { x: m.rider.x, y: m.rider.y, z: m.rider.z });
    Object.assign(p.previous, { x: m.rider.x, y: m.rider.y, z: m.rider.z });
    Object.assign(p.velocity, { x: 0, y: 0, z: 0 });
    Object.assign(p, { grounded: false, fallDistance: 0, landedFall: 0 });
    p.mount = null;
    this.host.achievements?.stopRiding(p);
  }

  // b96 horse96: World.updateEntities' unlink of a dead or removed rider (`ridingEntity = null`, the mount's `riddenByEntity = null`): the rider stays at its seat.
  release(p) {
    const m = p.mount;
    if (!m) return;
    if (m.mob) this.pigs.mobs.horseSeats.dismount(this.host.world, m.rider, false);
    p.mount = null;
    this.host.achievements?.stopRiding(p);
  }

  // One world tick, after the players' own update: riders let go (sneak, death, a broken vehicle), boats take the input, both lists tick, pushes, drops, seats, achievements.
  tick() {
    const host = this.host, world = host.world;
    this.hanging.tick(); // b68 mppaintings: the 101st-update surface check
    this.finishSneak(); // b90 horse90: a mount the mob tick did not update (a corpse) lets its sneaking rider off now
    this.riderInput();
    this.horses.stamp(); // b76 mphorse76: the tamer's name on a horse tamed by riding
    const any = this.carts.carts.length || this.boats.carts.length || [...host.players.values()].some(p => p.mount);
    if (!any) { this.track(); return; }
    this.afterRiders();
  }
  // b90 horse90: EntityPlayer.updateRidden for a mob mount whose own update did not let the rider off (the mob tick's riderSneakOff clears the flag when it ran).
  finishSneak() {
    for (const p of this.host.players.values()) {
      const m = p.mount;
      if (!m?.mob || !m.rider.sneakDismount) continue;
      m.rider.sneakDismount = false;
      if (m.rider.sneakSeat) Object.assign(m.rider, m.rider.sneakSeat);
      m.rider.sneakSeat = null;
      this.dismount(p);
    }
  }
  // b90 horse90: the same for a cart or boat, right after its tick (structure-simulation.js riderSneakOff).
  sneakOffVehicles() {
    for (const p of this.host.players.values()) {
      const m = p.mount, r = m?.rider;
      if (!m || m.mob || !r?.sneakDismount) continue;
      r.sneakDismount = false;
      if (r.sneakSeat) Object.assign(r, r.sneakSeat);
      r.sneakSeat = null;
      this.dismount(p);
    }
  }
  // Riders let go and the input they give (before the mobs tick too, so a pig steers on this tick's keys: b62).
  riderInput() {
    const host = this.host;
    for (const p of host.players.values()) {
      const m = p.mount;
      if (!m) continue;
      // b86 seat86: a client that sends the C0C (p.ride) dismounts on its sneak (setSneaking, then EntityPlayer.updateRidden's `!isRemote && isSneaking()`) and steers with its
      // moveForward / moveStrafing (applyRide); a tick without one keeps the old values and its sneak is the C0B's (the controls). An older client that never sent a C0C keeps the controls rule.
      const ride = p.ride ?? null;
      // b96 horse96 (Executed: Kill96Probe, kill96-reference.json): a killed rider (EntityPlayerMP.onDeath, mw.a(ro)) is not dismounted: it stays linked through the 20-tick death animation and ahb.h unlinks it
      // the tick after deathTime 20 (or after the respawn's ahb.f), where it sat: no spot search, no teleport. Only mob mounts are probed; a cart or boat rider keeps the old immediate release.
      if (p.dead && m.mob && this.pigs.keeps(p)) { if ((p.deathTime ?? 0) > 20) this.release(p); else Object.assign(m.rider, { moveForward: 0, moveStrafing: 0, sneakDismount: false }); continue; }
      if (!(m.mob ? this.pigs.keeps(p) : this.find(m.key)) || p.dead) { this.dismount(p); continue; }
      // b90 horse90: the sneak (C0C) is read by the network tick, but EntityPlayer.updateRidden (yz.ab) lets the rider off in World.updateEntityWithOptionalForce right after the mount's own
      // update (ahb.a(sa, Z), bytecode-read; horse89-reference.json executed): this tick the mount still takes the rider's input, and the rider gets off after it (`sneakDismount`: the mob
      // tick's riderSneakOff, or finishSneak / afterRiders below). The first call of the tick (before the mobs) fixes the seat the spot search starts from.
      if (ride ? ride.k : p.input?.sneak) { if (!m.rider.sneakDismount) m.rider.sneakSeat = { x: m.rider.x, y: m.rider.y, z: m.rider.z }; m.rider.sneakDismount = true; }
      if (ride) applyRide(m.rider, ride);
      else if (!p.rideSeen) { const input = moveInput({ forward: p.input?.forward ?? 0, strafe: p.input?.strafe ?? 0 }); Object.assign(m.rider, { moveForward: f(input.forward * f(0.98)), moveStrafing: f(-input.strafe * f(0.98)) }); } // not slowed: a rider is not using an item (bytecode-read blk.e)
      Object.assign(m.rider, { yaw: f(180 - p.yaw * 180 / Math.PI), dead: false }); // the C05's rotationYaw (processPlayer's riding branch takes the packet's angles)
      if (m.mob?.type === 'horse') this.horses.input(p); // b76 mphorse76: the jump bar
    }
  }
  afterRiders() {
    const host = this.host, world = host.world;
    // Blockers: every player (a rider excludes its own vehicle through `ref`) and every living mob.
    const blockers = [...host.players.values()].map(p => ({ bb: this.playerBox(p), ref: p.mount?.rider ?? p })).concat(this.boxesOfMobs());
    this.carts.tick(world, { entities: [...blockers.filter(b => b.ref?.type !== 'ender_crystal') /* b88 boatray88: xl.h needs canBePushed, which a crystal is not */, ...this.boats.carts.filter(b => !b.dead).map(b => ({ bb: b.bb, ref: b }))], host: this.cartHost });
    this.boats.tick(world, { entities: [...blockers, ...this.carts.carts.filter(c => !c.dead).map(c => ({ bb: c.bb, ref: c }))], hooks: this.boatHooks });
    this.sneakOffVehicles(); // b90 horse90: the sneaking rider's updateRidden, after the cart's / boat's update
    // EntityLivingBase.collideWithNearbyEntities: players and mobs against the vehicles; the vehicle moves too (collide adds its side).
    for (const system of [this.carts, this.boats]) {
      if (!system.carts.length) continue;
      for (const p of host.players.values()) {
        if (p.mount || p.dead) continue;
        const [vx, vz] = system.pushEntity({ x: p.position.x, z: p.position.z, player: true }, this.playerBox(p));
        p.velocity.x += vx; p.velocity.z += vz;
      }
      for (const b of this.boxesOfMobs()) {
        if (b.ref.type === 'ender_crystal') continue; // b88 boatray88: not living, not canBePushed: no push
        const e = b.ref, [vx, vz] = system.pushEntity(e, b.bb); // b62: the mob itself, so a fast empty cart picks it up (cartPicksUp; boats ignore it)
        e.vx = (e.vx ?? 0) + vx; e.vz = (e.vz ?? 0) + vz;
      }
    }
    syncVehiclePassengers(this.carts.carts); syncVehiclePassengers(this.boats.carts); // b62: a passenger that left or died frees the vehicle's side
    for (const system of [this.carts, this.boats]) for (const d of system.drain()) if (d.stack) host.items.spawn(d.stack, d.x, d.posY, d.z, { delay: d.delay, motion: d.motion });
    for (const p of host.players.values()) {
      const m = p.mount;
      if (!m) { host.achievements?.stopRiding(p); continue; }
      if (m.mob) { if (!this.pigs.keeps(p)) this.dismount(p); else { this.pigs.follow(p); this.seat(p); host.stats?.mounted(p, m); /* b63 mpstats: pig distance */ } host.achievements?.stopRiding(p); continue; } // b62
      const v = this.find(m.key);
      if (!v) { this.dismount(p); continue; }
      this.systemOf(v).updateRiderPosition(v);
      this.seat(p);
      host.stats?.mounted(p, m); // b63 mpstats: minecart / boat distance
      if (!m.boat) host.achievements?.onMinecart(p);
      else host.achievements?.stopRiding(p);
    }
    this.track();
  }

  // The `vehicles` message of each player (a copy per vehicle within RANGE whose state changed, the keys that left). Packets wait on `p.vehPackets` for the connection.
  track() {
    const range = Math.min(RANGE, this.host.rules?.trackerLimit ?? RANGE); // b70 serverprops2: EntityTracker's v*16-16 clamp of the 80 range
    const all = this.all.filter(v => !v.dead), states = new Map(all.map(v => [v, vehicleState(v)]));
    // b71 mpreach71: a cart's position fields are the ones its EntityTrackerEntry last released (every 3 ticks, 4/32 block or 4/256 turn thresholds); other fields go at once
    const cartTrack = (this.cartTrack ??= new CartTracker());
    cartTrack.prune(new Set(all));
    // b83 tracker83: boats too (80 / 3 / velocity), with the client entity's serverPos (1/32 steps, S18's + 1/64) and a boat's S12 motion (server-cart-track.js). `exact` keeps the
    // plain state for the boat a viewer rides: the port seats its rider from the server (natively that client runs the boat's physics itself, isBoatEmpty false; not modelled).
    const exact = new Map();
    // b84 mpboat84: the rider's state also carries the entry's released position (tx/ty/tz), S12 (mx/my/mz, count vs) and position-packet count rs, with `own: 1`: its client runs the boat's physics itself
    // (isBoatEmpty false) and only reads those two packets the way xi.a(DDDFFI) and xi.i do (remote-vehicles.js)
    if (fast89.mode === 'off' || all.length !== 0) // b89 mpperf89: skip a loop that would do nothing
    for (const v of all) { const st = states.get(v), t = cartTrack.tick(v, st); if (v.boat) exact.set(v, { ...st, own: 1, tx: t.x, ty: t.y, tz: t.z, vs: t.vs, rs: t.rs, mx: t.mx, my: t.my, mz: t.mz }); states.set(v, { ...st, ...t }); }
    eachView90(this.views, (view, id) => { // b90 mpperf90: Map.forEach, no [id, view] entry array per view (the body's one `continue` is the `return`)
      const p = this.host.players.get(id);
      if (!p) { view.known.clear(); view.vis?.clear(); view.ref = null; view.leaving = []; return; } // b63 mpnether3: a player of another dimension (the host's players are this dimension's): the client rebuilt its world, so nothing is known
      let quiet = null, late = 0; const set = [], del = [], seen = new Set(), knownPos = (view.cartPos ??= new Map()), joins = (view.joins ??= new Map()); // b84 mpboat84: joins, the spawn record of each tracked vehicle
      // b83 tracker83: the range test of EntityTrackerEntry.tryStartWachingThis (the square of side 2 * range around lastScaledPosition / 32, int division), run only when the
      // vehicle's entry re-lists (it moved over 4 blocks: CartTracker `recheck`, with the scaled position from before its packets) or this player's own entry does (it moved over
      // 4 blocks, joined, or its columns changed), as EntityTracker.updateTrackedEntities; in between the membership holds. A vehicle that leaves goes at the viewer's next update
      // (the S13 of EntityPlayerMP.onUpdate's destroyedItemsNetCache): one tick later, as the executed boatFar case. Port-read for the destroy delay (TrackerItemsProbe).
      const pp = p.position, ref = view.ref, vis = (view.vis ??= new Set()), leaving = view.leaving ?? [];
      const relist = !ref || (pp.x - ref.x) ** 2 + ((pp.y ?? 0) - ref.y) ** 2 + (pp.z - ref.z) ** 2 > 16 || !!this.host.chunkViews?.takeFresh?.(id, 'vehicles');
      if (relist) view.ref = { x: pp.x, y: pp.y ?? 0, z: pp.z };
      view.leaving = [];
      if (fast89.mode === 'off' || all.length !== 0) // b89 mpperf89: skip a loop that would do nothing
      for (const v of all) {
        const key = keyOf(v), en = cartTrack.entries.get(v), at = en?.recheck ? en.pre : relist ? cartTrack.scaled(v) : null;
        if (at) {
          const inside = Math.abs(pp.x - at[0]) <= range && Math.abs(pp.z - at[1]) <= range;
          if (inside) vis.add(key); else if (vis.delete(key) && view.known.has(key)) { view.known.delete(key); knownPos.delete(key); joins.delete(key); view.leaving.push(key); }
        }
        if (!vis.has(key)) continue;
        if (this.host.chunkViews && !this.host.chunkViews.sees(id, Math.floor(v.x / 16), Math.floor(v.z / 16))) continue; // b72 mpstream72: the column was not sent (or was unloaded)
        const riding = v.boat && p.mount?.key === key;
        if (!view.known.has(key)) joins.delete(key); // a vehicle (re)entering the view gets a fresh S0E at the entity's current position, rotation and motion (func_151260_c)
        if (!joins.has(key)) joins.set(key, riding ? null : cartTrack.join(v, !!en?.recheck)); // (the rider's client already holds its boat: no spawn record)
        const state = riding ? exact.get(v) : cartTrack.forViewer(v, joins.get(key), states.get(v)), json = JSON.stringify(state);
        seen.add(key);
        let strings = 0, cmdNow = null; // b93 console93: the command cart's watcher strings (23, 24) as /netstat sees them: the join S1C holds them whole, a later change is its own S1C
        if (v.type === 6 && !v.boat) { cmdNow = [v.command?.command ?? '', v.command?.watch24 ?? '']; const before = (view.cartStr ??= new Map()).get(key); view.cartStr.set(key, cmdNow); if (before && view.known.has(key)) strings = stringChange(before, cmdNow); }
        if (view.known.get(key) !== json) {
          const st = state, tracked = !v.boat || st.bc === 1, pos = tracked ? `${st.x},${st.y},${st.z},${st.yaw},${st.pitch},${st.rs ?? ''}` : '', had = view.known.has(key);
          view.known.set(key, json);
          const row = tracked && had && knownPos.get(key) === pos ? { ...st, cartMeta: 1 } : { ...st }; set.push(row); setVehicleInfo(row, { kinds: en?.kinds ?? [], join: !had, data: v.boat ? 0 : v.type | 0, velocity: !!v.boat || !!en, watch: joinWatcher(v.boat, v.type, cmdNow?.[0], cmdNow?.[1]), ...(strings && had ? { strings } : {}) }); // b91 console91: the packets /netstat counts for the row; cartMeta: the position is the one the client holds, do not re-aim it (b83: a tracked boat's too; its S12 count `vs` still applies)
          knownPos.set(key, pos);
        } else if (en?.kinds?.length || strings) (quiet ??= []).push(strings ? [...(en?.kinds ?? []), { type: 'strings', bytes: strings }] : en.kinds); // b92 console92: the entry sent packets (S12 of a cart, a move the viewer's state hides) with no row change
      }
      if (fast89.mode === 'off' || view.known.size !== seen.size) // b89 mpperf89: every seen key is known, so equal sizes leave nothing to delete
      for (const key of [...view.known.keys()]) if (!seen.has(key)) { view.known.delete(key); knownPos.delete(key); joins.delete(key); del.push(key); } // dead, or its column not sent
      if (fast89.mode === 'off' || leaving.length !== 0) // b89 mpperf89: skip a loop that would do nothing
      for (const key of leaving) if (!vis.has(key)) { del.push(key); late++; } // last tick's untracked vehicles: the S13 now
      if (fast89.mode === 'off' || vis.size !== 0) // b89 mpperf89: skip a loop that would do nothing
      for (const key of vis) if (!all.some(v => keyOf(v) === key)) vis.delete(key);
      p.vehNet = quiet; // b92 console92: counted by the connection, never sent
      if (set.length || del.length) p.vehPackets = { type: 'vehicles', ...(set.length ? { set } : {}), ...(del.length ? { del } : {}), ...(late ? { delLate: late } : {}), ...(set.some(x => x.v[0] === 'c') ? { cartCadence: true } : {}) };
    });
    for (const [id, extra] of this.hanging.track(id => this.host.players.get(id))) { const p = this.host.players.get(id); p.vehPackets = { type: 'vehicles', ...(p.vehPackets ?? {}), ...extra }; } // b68 mppaintings: hset / hdel
    this.carts.reap(); this.boats.reap();
  }

  save() { return { carts: this.carts.toJSON(), boats: this.boats.toJSON(), hanging: this.hanging.save() }; }
}
