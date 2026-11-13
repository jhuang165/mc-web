// Mobs of the dedicated world (batch 59 mpmobs). One EntityWorld (src/entities.js, the simulation single player uses) runs on the server's world.
// Every server player is a target: before each mob updates, `EntityWorld.beforeMob` points the AI's player at the nearest one (World.getClosestPlayerToEntity).
// Each player has an own MobTracker (src/entity-tracker.js); only its server half runs (entries, S0F spawn, S14..S18 moves, S19 head, S12 velocity, S13 destroy), and the
// packets go to that player as `{ type: 'mobs', packets }`. The client (remote-mobs.js) replays them on ClientEntity copies and the existing MobRenderer draws them.
// Natural spawning runs once per player (each with its own SpawnerAnimals state, the cap counting the union of the 17 x 17 windows). Mob damage to players goes through
// `host.damagePlayer(player, amount, source)`; the player-state track replaces its no-op. Not connected: other mob types, mob sounds and particles, riding, leads,
// experience orbs, and the contents of a chest a creeper's blast breaks.
import { EntityWorld } from '../entities.js';
import { MobTracker, packetSeq } from '../entity-tracker.js';
import { EntityIds } from '../entity-ids.js';
import { drainMobEvents } from '../living-simulation.js';
import { explodeBlocks, explosionImpact } from '../explosion.js';
import { explodeMobs } from '../explosion-simulation.js';
import { entityBox, isWet, canSeeSky } from '../weather.js';
import { PHYSICS } from '../world.js';
import { makeStack } from '../inventory.js';

export const SUPPORTED = new Set(['pig', 'cow', 'sheep', 'chicken', 'zombie', 'skeleton', 'creeper', 'spider']);
export const MOB_LIMIT = 80; // mobs kept in one dedicated world, a safety cap for the wire and the tick
const ELIGIBLE = 17; // SpawnerAnimals' chunk window around one player (entities.js ELIGIBLE_CHUNKS is 17 x 17)
const num = e => Number(String(e.id).replace(/^mob-/, ''));

// The tracker EntityWorld holds: it exists only so tickMobs finds one. The per-player trackers below do the real work.
class IdleTracker extends MobTracker { update() {} takeFx() { return []; } }

// What a client copy needs beyond the tracker's packets (the watched flags the renderer reads). Small and comparable as a string.
export function mobState(e) {
  const s = {};
  if (e.health <= 0) s.dead = 1;
  if (e.hurt > 0) s.hurt = 1;
  if (e.growingAge < 0) s.baby = 1;
  if (e.burn > 0 || e.fire > 0) s.burn = 1;
  if (e.type === 'sheep') { s.color = e.color ?? 0; if (e.sheared) s.sheared = 1; }
  if (e.type === 'creeper') { s.fuse = e.fuseTime ?? 0; s.last = e.lastActive ?? 0; if (e.powered) s.powered = 1; }
  return s;
}

export class ServerMobs {
  // `host` is the DedicatedSimulation: world, weather, light, items, `darkness`, `ticks`, `damagePlayer(player, amount, source)`.
  constructor(host, saved = null, { naturalSpawning = true } = {}) {
    this.host = host;
    const world = host.world;
    // undefined list: EntityWorld.seedAnimals, the opening animals of a finite world below generation 11; a saved list (even empty) is restored as it was
    const list = Array.isArray(saved) ? saved.filter(r => SUPPORTED.has(r?.type)) : undefined;
    const mobs = this.mobs = new EntityWorld(world, list, undefined, new EntityIds());
    mobs.tracker = new IdleTracker();
    mobs.naturalSpawning = false; // run per player below (`spawn`)
    this.spawning = naturalSpawning;
    mobs.entities = mobs.entities.filter(e => SUPPORTED.has(e.type));
    mobs.isDaytime = () => host.darkness < 4;
    mobs.canSeeSky = (x, y, z) => canSeeSky(world, x, y, z);
    mobs.isRaining = () => host.weather.isRaining();
    mobs.isThundering = () => host.weather.isThundering();
    mobs.wet = (e, height) => isWet(host.weather, world, e, height);
    mobs.worldRandom = host.weather.random;
    mobs.lightAt = (x, y, z) => host.light.level(x, y, z, host.darkness);
    mobs.skyLightAt = (x, y, z) => host.light.skyAt(x, y, z);
    mobs.thunderLightAt = (x, y, z) => host.light.level(x, y, z, 10);
    mobs.fullLightAt = (x, y, z) => host.light.level(x, y, z, 0);
    mobs.dimensionBlockLight = (x, y, z) => host.light.blockAt(x, y, z);
    mobs.lightSubtracted = () => host.darkness;
    mobs.loadTotalTime(host.ticks ?? 0);
    mobs.explodeInline = ev => this.explode(ev.explode);
    mobs.spawnLoot = events => { for (const ev of events) if (ev.drop) host.items.dropMob(ev.drop, ev.count, ev.position, ev.damage, ev); }; // experience orbs are not connected
    mobs.beforeMob = e => this.target(e);
    this.views = new Map(); // player id -> { player, view (the AI's PlayerView), survival (the AI's adapter), tracker, known, spawner }
    this.probe = { x: 0, y: 0, z: 0 };
  }
  // A player joins the world the mobs see.
  addPlayer(p) {
    if (this.views.has(p.id)) return;
    const mobs = this.mobs, view = new mobs.ai.player.constructor(), self = this;
    view.unticked = true; // the host moves the player; EntityWorld does not step this copy
    // The AI's survival of this player: the real object for everything it reads, with the damage path through the host's hook.
    const survival = Object.create(p.survival);
    Object.assign(survival, {
      scaledDamage: (amount, name, opts = {}) => self.hurt(p, amount, { name, from: opts.from ?? null }),
      damage: (amount, name, ...rest) => self.hurt(p, amount, { name, from: rest[2] ?? null }),
      setFire() {},
    });
    const spawner = mobs.spawnerState(), add = spawner.ctx.add;
    spawner.ctx.add = e => { if (SUPPORTED.has(e.type) && mobs.entities.length < MOB_LIMIT) add(e); }; // other kinds have no client copy here
    const tracker = new MobTracker(10);
    tracker.flush = () => {}; // the server half only: the entry keeps its packets for the wire (the client half is remote-mobs.js)
    this.views.set(p.id, { player: p, view, survival, tracker, known: new Map(), spawner });
  }
  removePlayer(id) { this.views.delete(id); }
  // Survival.scaledDamage of a mob's hit: the host decides (the player-state track); true means the hit landed.
  hurt(p, amount, source) { return this.host.damagePlayer(p, amount, source) !== false; }
  // World.getClosestPlayerToEntity for this mob: the AI reads `ai.player` and `ai.survival` for everything it does with the player.
  target(e) {
    let best = null, bd = Infinity;
    for (const v of this.views.values()) {
      const p = v.player.position, d = (p.x - e.x) ** 2 + (p.y - e.y) ** 2 + (p.z - e.z) ** 2;
      if (d < bd) { bd = d; best = v; }
    }
    if (best) this.use(best);
  }
  use(v) { this.mobs.ai.player = v.view; this.mobs.ai.survival = v.survival; }
  // Explosion.doExplosionA for the dedicated world: the mobs, every player in reach, then the blocks.
  explode(ev) {
    const { world, weather, items } = this.host, { x, y, z, size } = ev;
    if (!(size > 0)) return;
    explodeMobs({ world, mobs: this.mobs, position: this.probe }, { x, y, z, size, exploder: ev.source ?? null, attacker: ev.source ?? null });
    for (const v of this.views.values()) {
      const p = v.player.position, s = v.player.survival;
      if (s.creative || s.health <= 0) continue;
      const hit = explosionImpact(world, x, y, z, size, p.x, p.y, p.z, p.y + Math.fround(PHYSICS.eye), entityBox(p, PHYSICS.width, PHYSICS.height));
      if (!hit) continue;
      this.hurt(v.player, hit.damage, { name: 'explosion', from: ev.source ?? null });
      for (const k of ['x', 'y', 'z']) v.player.velocity[k] += hit.push[k === 'x' ? 0 : k === 'y' ? 1 : 2];
    }
    const out = explodeBlocks(world, x, y, z, size, weather.random, { smoking: ev.smoking !== false });
    for (const b of out.broken) world.set(b.x, b.y, b.z, 0);
    for (const d of out.drops) items.spawn(makeStack(d.id, 1, d.damage || 0), d.x, d.y, d.z, { delay: 10 });
  }
  // SpawnerAnimals for one player (its own context and chunk order), before the mobs update as WorldServer.tick runs it.
  spawn(v) {
    const mobs = this.mobs, p = v.player.position;
    mobs._spawner = v.spawner;
    this.use(v);
    mobs.naturalSpawn({ x: p.x, y: p.y, z: p.z }, v.survival);
  }
  // One game tick. Nothing runs while nobody is in the world.
  tick() {
    const { mobs, views } = this;
    if (!views.size) return;
    let first = null;
    for (const v of views.values()) {
      const p = v.player;
      v.view.sneaking = !!p.input?.sneak;
      v.view.update({ x: p.position.x, y: p.position.y, z: p.position.z }, v.survival, p.survival.held?.id ?? 0);
      first ??= v;
    }
    if (this.spawning) {
      mobs.capChunks = this.eligibleChunks();
      for (const v of views.values()) this.spawn(v);
      if (mobs.entities.length > MOB_LIMIT) mobs.entities.length = MOB_LIMIT;
    }
    this.use(first);
    const lead = first.player.position;
    mobs.tick({ x: lead.x, y: lead.y, z: lead.z }, first.survival, first.player.survival.held?.id ?? 0);
    drainMobEvents({ mobs, xpOrbs: { spawn() {} }, items: this.host.items }, { explode: (x, y, z, size, opts) => this.explode({ x, y, z, size, source: opts?.exploder, smoking: opts?.smoking }) });
    mobs.clientSounds.length = 0;
    this.track();
  }
  // The distinct chunks of the 17 x 17 windows around the players (the cap of SpawnerAnimals is per eligible chunk).
  eligibleChunks() {
    const seen = new Set(), r = (ELIGIBLE - 1) / 2;
    for (const { player } of this.views.values()) {
      const cx = Math.floor(player.position.x / 16), cz = Math.floor(player.position.z / 16);
      for (let x = cx - r; x <= cx + r; x++) for (let z = cz - r; z <= cz + r; z++) seen.add(x * 65536 + z);
    }
    return seen.size;
  }
  // EntityTracker.updateTrackedEntities for each player, the server half only. Packets leave in the order they were queued (packetSeq).
  track() {
    const mobs = this.mobs, states = new Map(), size = e => mobs.size(e);
    const stateOf = e => { let s = states.get(e); if (s === undefined) states.set(e, s = JSON.stringify(mobState(e))); return s; };
    for (const v of this.views.values()) {
      const p = v.player.position, t = v.tracker;
      t.serverTick(mobs.entities, { x: p.x, y: p.y, z: p.z }, size);
      const queue = [], parts = t.queued();
      for (const en of parts) for (const pk of en.entry.packets) queue.push([packetSeq(pk), en, pk]);
      queue.sort((a, b) => a[0] - b[0]);
      const out = [];
      for (const [, en, pk] of queue) {
        if (pk.type === 'attach') continue; // riding and leads are not connected
        const { entity, vehicle, holder, after, ...rest } = pk, e = en.live, i = num(e);
        if (pk.type === 'spawn') { out.push({ ...rest, i, mob: e.type, ...mobState(e) }); v.known.set(e, stateOf(e)); }
        else { out.push({ ...rest, i }); if (pk.type === 'destroy') v.known.delete(e); }
      }
      for (const en of parts) en.entry.packets.length = 0;
      t.dying.length = 0;
      for (const [e, en] of t.entries) {
        if (!en.entry.tracked) continue;
        const s = stateOf(e);
        if (v.known.get(e) !== s) { v.known.set(e, s); out.push({ type: 'state', i: num(e), ...JSON.parse(s) }); }
      }
      if (out.length) (v.player.mobPackets ??= []).push(...out);
    }
  }
  // C02 UseEntity, attack: the reach is the server's (the client aims), the damage the held weapon's (EntityWorld.attack). True when the hit landed.
  attack(p, wireId) {
    const v = this.views.get(p.id), mob = v && this.mobs.entities.find(e => num(e) === wireId);
    if (!mob || mob.health <= 0 || p.survival.health <= 0) return false;
    const dx = mob.x - p.position.x, dy = mob.y + 0.9 - (p.position.y + PHYSICS.eye), dz = mob.z - p.position.z;
    if (dx * dx + dy * dy + dz * dz > 36) return false; // 6 blocks, a little over the creative reach of 5
    this.use(v);
    return this.mobs.attack(mob, p.survival.held?.id ?? 0, v.survival, { x: p.position.x, y: p.position.y, z: p.position.z, yaw: p.yaw });
  }
  save() { return this.mobs.entities.filter(e => e.health > 0).map(e => this.mobs.serializeOne(e)); }
}
