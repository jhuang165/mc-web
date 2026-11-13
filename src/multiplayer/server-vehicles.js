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
import { Minecarts } from '../minecarts.js';
import { Boats } from '../boats.js';
import { EntityIds } from '../entity-ids.js';
import { placeHeldMinecart } from '../vehicle-simulation.js';
import { ITEMS } from '../survival.js';
import { PHYSICS } from '../world.js';
import { moveInput } from '../player-movement.js';
import { heldAttackDamage } from '../entities.js';
import { pickMinecart } from '../structure-simulation.js';

const f = Math.fround;
export const PLACEABLE_CARTS = new Set([0, 2, 3]); // plain, furnace and TNT carts; chest and hopper carts need a container window (not connected)
export const RANGE = 80; // EntityTracker range of a minecart and a boat
const REACH_SQ = 36; // 6 blocks, as the mob attack
export const keyOf = v => (v.boat ? 'b' : 'c') + v.id;
const r4 = v => Math.round(v * 1e4) / 1e4;

// What a client copy draws: position (posY, the entity centre), angles, hit wobble, the furnace cart's lit flag and the TNT cart's fuse.
export function vehicleState(v) {
  const s = { v: keyOf(v), x: r4(v.x), y: r4(v.posY), z: r4(v.z), yaw: r4(v.yaw), pitch: r4(v.pitch) };
  if (v.boat) { s.th = v.timeSinceHit; s.dm = r4(v.damage); s.fd = v.forwardDir; } else {
    s.t = v.type; s.rl = v.rolling; s.rd = v.rollingDir; s.dm = r4(v.damage);
    if (v.type === 2 && v.lit) s.lit = 1;
    if (v.type === 3 && v.fuse >= 0) s.fuse = v.fuse;
  }
  return s;
}

export class ServerVehicles {
  // `host` is the DedicatedSimulation (world, players, items, mobs, soundsOut, achievements, actions).
  constructor(host, saved = null) {
    this.host = host;
    const ids = this.ids = new EntityIds();
    this.carts = saved?.carts ? Minecarts.fromJSON(saved.carts, { ids }) : new Minecarts({ ids });
    this.boats = saved?.boats ? Boats.fromJSON(saved.boats, { ids }) : new Boats({ ids });
    for (const c of [...this.carts.carts, ...this.boats.carts]) c.restorePlayer = false; // nobody is aboard after a restart
    this.cartHost = {
      explode: (cart, x, y, z, power) => host.mobs.explode({ x, y, z, size: power, source: null }),
      particle() {}, // WorldServer.spawnParticle sends nothing
      sound: (name, cart) => host.soundsOut.push({ name, x: cart.x, y: cart.posY, z: cart.z, volume: 1, pitch: 1, except: null }),
    };
    this.views = new Map(); // player id -> { known: Map(key -> JSON), sent: Set(key) }
  }
  get all() { return [...this.carts.carts, ...this.boats.carts]; }
  systemOf(v) { return v.boat ? this.boats : this.carts; }
  find(key) {
    if (typeof key !== 'string' || !/^[bc]\d+$/.test(key)) return null;
    const system = key[0] === 'b' ? this.boats : this.carts, id = Number(key.slice(1));
    return system.carts.find(c => c.id === id && !c.dead) ?? null;
  }
  addPlayer(p) { this.views.set(p.id, { known: new Map() }); }
  removePlayer(p) { this.dismount(p); this.views.delete(p.id); }

  // A vehicle placed at a position by something other than a player (a dispenser, a command): kind 'minecart' | 'furnace_minecart' | 'tnt_minecart' | 'boat'.
  // Cart records are the rail cell centre as ItemMinecart makes them; a boat's `y` is its box bottom, as ItemBoat passes it. Returns the vehicle or null.
  spawnVehicle(kind, x, y, z, { yaw = 0 } = {}) {
    if (![x, y, z].every(Number.isFinite)) return null;
    if (kind === 'boat') return this.boats.spawnBoat({ x, y, z, yaw }, { born: true });
    const type = { minecart: 0, furnace_minecart: 2, tnt_minecart: 3 }[kind];
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
    const pos = p.position, half = PHYSICS.width / 2, eye = [pos.x, pos.y + PHYSICS.eye, pos.z];
    const dir = [-Math.sin(p.yaw) * Math.cos(p.pitch), Math.sin(p.pitch), -Math.cos(p.yaw) * Math.cos(p.pitch)];
    const pbox = [pos.x - half, pos.y, pos.z - half, pos.x + half, pos.y + PHYSICS.height, pos.z + half];
    const sight = [...this.boxesOfMobs(), ...this.all.filter(v => !v.dead && v.bb).map(v => ({ bb: v.bb }))];
    const others = [...this.host.players.values()].filter(q => q !== p).map(q => ({ bb: this.playerBox(q) }));
    if (!this.boats.place(this.host.world, { eye, dir, yaw: f(180 - p.yaw * 180 / Math.PI), box: pbox }, [{ bb: pbox }, ...others, ...sight], [...others, ...sight])) return false;
    if (!p.survival.creative) p.survival.take(held.id, 1);
    p.swing = 6;
    return true;
  }

  playerBox(p) { const h = PHYSICS.width / 2; return [p.position.x - h, p.position.y, p.position.z - h, p.position.x + h, p.position.y + PHYSICS.height, p.position.z + h]; }
  boxesOfMobs() {
    const mobs = this.host.mobs.mobs;
    return mobs.entities.filter(e => e.health > 0).map(e => { const [w, h] = mobs.size(e); return { bb: [e.x - w / 2, e.y, e.z - w / 2, e.x + w / 2, e.y + h, e.z + w / 2], ref: e }; });
  }

  // C02 UseEntity as the server queues it: `{ v, hit }`. Reach is the server's, from the player's eye to the vehicle's box centre.
  queue(id, m) {
    const host = this.host;
    if (!host.players.has(id) || typeof m?.v !== 'string' || !/^[bc]\d+$/.test(m.v) || host.actions.filter(a => a.id === id).length >= 4) return false;
    host.actions.push({ id, veh: { v: m.v, hit: m.hit === true } });
    return true;
  }
  act(p, { v: key, hit }) {
    const v = this.find(key);
    if (!v || p.survival.health <= 0 || p.mount?.key === key) return false; // a rider cannot hit or use the vehicle it sits in
    const b = v.bb, dx = (b[0] + b[3]) / 2 - p.position.x, dy = (b[1] + b[4]) / 2 - (p.position.y + PHYSICS.eye), dz = (b[2] + b[5]) / 2 - p.position.z;
    if (dx * dx + dy * dy + dz * dz > REACH_SQ) return false;
    const system = this.systemOf(v);
    if (hit) { // Minecraft.clickMouse swings, then EntityMinecart / EntityBoat.attackEntityFrom with the held weapon's damage
      p.swing = 6;
      system.hit(v, heldAttackDamage(p.survival.held?.id ?? 0, p.survival), { creative: p.survival.creative });
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
    if (!v.boat && v.type !== 0) return false; // chest, hopper and command carts open windows: not connected
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
      fall: distance => { if (!p.survival.creative && p.survival.health > 0 && distance > 3) p.survival.damage(Math.ceil(distance - 3), 'a fall'); } };
  }
  riding(p) { return !!p.mount; }
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
  sit(p) { return { inWater: false, inLavaNow: false, sneakOnGround: true, oldPosition: { x: p.position.x, y: p.position.y, z: p.position.z } }; }
  dismount(p) {
    const m = p.mount;
    if (!m) return;
    const v = this.find(m.key) ?? m.rider.vehicle;
    if (m.rider.vehicle) { (v?.boat ? this.boats : this.carts).dismount(this.host.world, m.rider); }
    Object.assign(p.position, { x: m.rider.x, y: m.rider.y, z: m.rider.z });
    Object.assign(p.previous, { x: m.rider.x, y: m.rider.y, z: m.rider.z });
    Object.assign(p.velocity, { x: 0, y: 0, z: 0 });
    Object.assign(p, { grounded: false, fallDistance: 0, landedFall: 0 });
    p.mount = null;
    this.host.achievements?.stopRiding(p);
  }

  // One world tick, after the players' own update: riders let go (sneak, death, a broken vehicle), boats take the input, both lists tick, pushes, drops, seats, achievements.
  tick() {
    const host = this.host, world = host.world, any = this.carts.carts.length || this.boats.carts.length;
    for (const p of host.players.values()) {
      const m = p.mount;
      if (!m) continue;
      const v = this.find(m.key);
      if (!v || p.dead || p.input?.sneak) { this.dismount(p); continue; }
      const input = moveInput({ forward: p.input?.forward ?? 0, strafe: p.input?.strafe ?? 0 }); // not slowed: a rider is not using an item (bytecode-read blk.e)
      Object.assign(m.rider, { yaw: f(180 - p.yaw * 180 / Math.PI), moveForward: f(input.forward * f(0.98)), moveStrafing: f(-input.strafe * f(0.98)), dead: false });
    }
    if (!any) { this.track(); return; }
    // Blockers: every player (a rider excludes its own vehicle through `ref`) and every living mob.
    const blockers = [...host.players.values()].map(p => ({ bb: this.playerBox(p), ref: p.mount?.rider ?? p })).concat(this.boxesOfMobs());
    this.carts.tick(world, { entities: [...blockers, ...this.boats.carts.filter(b => !b.dead).map(b => ({ bb: b.bb, ref: b }))], host: this.cartHost });
    this.boats.tick(world, { entities: [...blockers, ...this.carts.carts.filter(c => !c.dead).map(c => ({ bb: c.bb, ref: c }))] });
    // EntityLivingBase.collideWithNearbyEntities: players and mobs against the vehicles; the vehicle moves too (collide adds its side).
    for (const system of [this.carts, this.boats]) {
      if (!system.carts.length) continue;
      for (const p of host.players.values()) {
        if (p.mount || p.dead) continue;
        const [vx, vz] = system.pushEntity({ x: p.position.x, z: p.position.z, player: true }, this.playerBox(p));
        p.velocity.x += vx; p.velocity.z += vz;
      }
      for (const b of this.boxesOfMobs()) {
        const e = b.ref, [vx, vz] = system.pushEntity({ x: e.x, z: e.z }, b.bb); // no `type`: a cart never picks up a mob here (no mob riders are connected)
        e.vx = (e.vx ?? 0) + vx; e.vz = (e.vz ?? 0) + vz;
      }
    }
    for (const system of [this.carts, this.boats]) for (const d of system.drain()) if (d.stack) host.items.spawn(d.stack, d.x, d.posY, d.z, { delay: d.delay, motion: d.motion });
    for (const p of host.players.values()) {
      const m = p.mount;
      if (!m) { host.achievements?.stopRiding(p); continue; }
      const v = this.find(m.key);
      if (!v) { this.dismount(p); continue; }
      this.systemOf(v).updateRiderPosition(v);
      this.seat(p);
      if (!m.boat) host.achievements?.onMinecart(p);
      else host.achievements?.stopRiding(p);
    }
    this.track();
  }

  // The `vehicles` message of each player (a copy per vehicle within RANGE whose state changed, the keys that left). Packets wait on `p.vehPackets` for the connection.
  track() {
    const all = this.all.filter(v => !v.dead), states = new Map(all.map(v => [v, vehicleState(v)]));
    for (const [id, view] of this.views) {
      const p = this.host.players.get(id);
      if (!p) continue;
      const set = [], del = [], seen = new Set();
      for (const v of all) {
        if (Math.abs(v.x - p.position.x) > RANGE || Math.abs(v.z - p.position.z) > RANGE) continue;
        const key = keyOf(v), json = JSON.stringify(states.get(v));
        seen.add(key);
        if (view.known.get(key) !== json) { view.known.set(key, json); set.push(states.get(v)); }
      }
      for (const key of [...view.known.keys()]) if (!seen.has(key)) { view.known.delete(key); del.push(key); }
      if (set.length || del.length) p.vehPackets = { type: 'vehicles', ...(set.length ? { set } : {}), ...(del.length ? { del } : {}) };
    }
    this.carts.reap(); this.boats.reap();
  }

  save() { return { carts: this.carts.toJSON(), boats: this.boats.toJSON() }; }
}
