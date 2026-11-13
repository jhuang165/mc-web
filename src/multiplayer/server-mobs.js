// Mobs of the dedicated world (batch 59 mpmobs). One EntityWorld (src/entities.js, the simulation single player uses) runs on the server's world.
// Every server player is a target: before each mob updates, `EntityWorld.beforeMob` points the AI's player at the nearest one (World.getClosestPlayerToEntity).
// Each player has an own MobTracker (src/entity-tracker.js); only its server half runs (entries, S0F spawn, S14..S18 moves, S19 head, S12 velocity, S13 destroy), and the
// packets go to that player as `{ type: 'mobs', packets }`. The client (remote-mobs.js) replays them on ClientEntity copies and the existing MobRenderer draws them.
// Natural spawning runs ONCE per world tick over the union of every player's 17 x 17 chunk window (SpawnerAnimals.findChunksForSpawning, aho.a: bytecode-read, `spawnPass`),
// the cap scaled by the union's size / 256. Mob damage to players goes through `host.damagePlayer(player, amount, source)`; the player-state track replaces its no-op.
// Batch 60: the server's own sounds (S29), status 2 / 3 / 18 (S19) for the clients' hurt and death sounds and hearts, experience orbs of a kill (server-items.js), knockback on the
// hit player (`knock`), and one velocity / airBorne flag for every watcher (`track`). Not connected: other mob types, riding, leads, and the contents of a chest a creeper's blast breaks.
import { EntityWorld } from '../entities.js';
import { MobTracker, packetSeq } from '../entity-tracker.js';
import { EntityIds } from '../entity-ids.js';
import { drainMobEvents } from '../living-simulation.js';
import { explodeBlocks, explosionImpact } from '../explosion.js';
import { explodeMobs } from '../explosion-simulation.js';
import { entityBox, isWet, canSeeSky } from '../weather.js';
import { hurtOf, deathOf } from '../entities.js';
import { drainKnockback } from '../player-knockback.js';
import { findChunksForSpawning, chunkPairHash } from '../spawner-animals.js';
import { skylightSubtracted, celestialAngle } from '../lighting.js';
import { PEACEFUL } from '../difficulty.js';
import { PHYSICS } from '../world.js';
import { makeStack } from '../inventory.js';

export const SUPPORTED = new Set(['pig', 'cow', 'sheep', 'chicken', 'zombie', 'skeleton', 'creeper', 'spider']);
export const MOB_LIMIT = 80; // mobs kept in one dedicated world, a safety cap for the wire and the tick
const ELIGIBLE = 17; // SpawnerAnimals' chunk window around one player (entities.js ELIGIBLE_CHUNKS is 17 x 17)
const num = e => Number(String(e.id).replace(/^mob-/, ''));

// The HashMap<ChunkCoordIntPair, Boolean> SpawnerAnimals fills for ALL players (aho.a, bytecode-read): per player in list order, dx outer and dz inner over -8..8; an inner chunk is put as
// false (overriding an edge put of an earlier player), an edge chunk as true only when the key is missing. `capacity` is the table size kept since the last clear (the default map
// starts at 16 and doubles when size > 0.75 * capacity; clear() keeps the table). Iteration is by bucket, then insertion order. `centres`: [chunkX, chunkZ] per player in the
// port's chunk coordinates, `ox`/`oz` the origin shift to native ones. Returns { order: [[cx, cz, edge]] (port coordinates), size, capacity }.
export function unionChunkOrder(centres, ox = 0, oz = 0, capacity = 16) {
  const seen = new Map(), rows = [];
  for (const [pcx, pcz] of centres) for (let dx = -8; dx <= 8; dx++) for (let dz = -8; dz <= 8; dz++) {
    const nx = pcx + ox + dx, nz = pcz + oz + dz, edge = dx === -8 || dx === 8 || dz === -8 || dz === 8, k = nx * 4294967296 + nz, row = seen.get(k);
    if (!row) { const r = { nx, nz, edge, at: rows.length }; seen.set(k, r); rows.push(r); } else if (!edge) row.edge = false;
  }
  while (rows.length > capacity * 0.75) capacity *= 2;
  for (const r of rows) { const h = chunkPairHash(r.nx, r.nz); r.bucket = (h ^ (h >>> 16)) & (capacity - 1); }
  rows.sort((a, b) => a.bucket - b.bucket || a.at - b.at);
  return { order: rows.map(r => [r.nx - ox, r.nz - oz, r.edge]), size: rows.length, capacity };
}

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
    mobs.spawnLoot = events => { for (const ev of events) { if (ev.drop) host.items.dropMob(ev.drop, ev.count, ev.position, ev.damage, ev); if (ev.xp) host.serverItems.xp.spawn(ev.xp, ev.position); } }; // the orbs of a kill (b60), sent by server-items.js tickFields
    this.statuses = []; // S19 entity status of this tick: { e (live mob), status }
    this.capacity = 16; // the eligibleChunksForSpawning table size (grows with the union, never shrinks)
    this.pass = null;
    mobs.beforeMob = e => this.target(e);
    host.achievements?.watchMobs(mobs); // b60: killEnemy, snipeSkeleton, overkill for the attacker of the moment
    mobs.mobStatus = (e, status) => this.status(e, status);
    this.views = new Map(); // player id -> { player, view (the AI's PlayerView), survival (the AI's adapter), tracker, known }
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
      scaledDamage: (amount, name, opts = {}) => self.hurt(p, amount, { name, from: opts.from ?? null, call: () => p.survival.scaledDamage(amount, name, opts) }),
      damage: (amount, name, ...rest) => self.hurt(p, amount, { name, from: rest[2] ?? null, call: () => p.survival.damage(amount, name, ...rest) }),
      setFire() {},
    });
    const tracker = new MobTracker(10);
    tracker.flush = () => {}; // the server half only: the entry keeps its packets for the wire (the client half is remote-mobs.js)
    this.views.set(p.id, { player: p, view, survival, tracker, known: new Map(), destroys: [] });
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
  // The one SpawnerAnimals pass of the world tick (WorldServer.tick: aho.a(world, hostile, peaceful, totalTime % 400 == 0)): the chunks of every player, the cap
  // `max * size / 256` of the union's size, and "a player within 24 blocks" (World.getClosestPlayer, posY is the eye) from any player.
  spawnPass() {
    const mobs = this.mobs, { world } = this.host;
    if (String(this.host.gameRules?.doMobSpawning ?? 'true').toLowerCase() !== 'true') return 0;
    let s = this.pass;
    if (!s) {
      s = this.pass = mobs.spawnerState();
      const add = s.ctx.add;
      s.ctx.add = e => { if (SUPPORTED.has(e.type) && mobs.entities.length < MOB_LIMIT) add(e); }; // other kinds have no client copy here
      s.ctx.playerWithin = (x, y, z) => { for (const v of this.views.values()) { const p = v.player.position; if ((p.x - x) ** 2 + (p.y + PHYSICS.eye - y) ** 2 + (p.z - z) ** 2 < 576) return true; } return false; };
    }
    const ox = Math.floor((world.originX || 0) / 16), oz = Math.floor((world.originZ || 0) / 16), centres = [];
    for (const { player } of this.views.values()) centres.push([Math.floor(player.position.x / 16), Math.floor(player.position.z / 16)]);
    const key = centres.map(c => c.join(',')).join(';') + `|${ox},${oz}`;
    if (s.key !== key) {
      const u = unionChunkOrder(centres, ox, oz, this.capacity);
      this.capacity = u.capacity;
      Object.assign(s, { key, size: u.size });
      s.ctx.order = u.order;
      if (s.tops.length < u.order.length) s.tops = new Int16Array(u.order.length);
    }
    const { ctx, tops } = s, order = ctx.order;
    let simulated = 0;
    for (let i = 0; i < order.length; i++) if ((tops[i] = mobs.spawnChunkTop(order[i][0], order[i][1])) >= 0) simulated++;
    if (!simulated) return 0;
    s.env.time = this.host.time ?? 0;
    s.sub = skylightSubtracted(celestialAngle(s.env.time));
    ctx.capChunks = s.size;
    ctx.rand = mobs.worldRandom;
    const point = (mobs.cachedSpawnPoint ??= world.spawn());
    ctx.spawn = { x: Math.floor(point.x), y: Math.floor(point.y), z: Math.floor(point.z) };
    return findChunksForSpawning(ctx, mobs.difficulty !== PEACEFUL, true, (mobs.worldTicks ?? 0) % 400 === 0);
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
      this.spawnPass();
      if (mobs.entities.length > MOB_LIMIT) mobs.entities.length = MOB_LIMIT;
    }
    this.use(first);
    const lead = first.player.position;
    mobs.tick({ x: lead.x, y: lead.y, z: lead.z }, first.survival, first.player.survival.held?.id ?? 0);
    const statusSounds = mobs.clientSounds.splice(0); // taken first: drainMobEvents would play them as server sounds
    // The orbs of a kill (ExperienceOrbs of server-items.js), the server's own sounds (S29) and explosions; the clients' status sounds become S19 below.
    drainMobEvents({ mobs, xpOrbs: this.host.serverItems.xp, items: this.host.items }, {
      explode: (x, y, z, size, opts) => this.explode({ x, y, z, size, source: opts?.exploder, smoking: opts?.smoking }),
      sound: s => this.sound(s),
    });
    for (const c of statusSounds) this.noteStatus(c);
    this.track();
  }
  // The size of eligibleChunksForSpawning: the distinct chunks of the 17 x 17 windows around the players.
  eligibleChunks() {
    return unionChunkOrder([...this.views.values()].map(({ player }) => [Math.floor(player.position.x / 16), Math.floor(player.position.z / 16)])).size;
  }
  // World.playSoundAtEntity on a WorldServer: S29 to every player within 16 blocks (16 * volume above 1), the hit player included (simulation.deliverSounds).
  sound(s) {
    const at = s.position;
    if (!s.sound || !at || ![at.x, at.y, at.z].every(Number.isFinite)) return;
    this.host.soundsOut.push({ name: s.sound, x: at.x, y: at.y, z: at.z, volume: s.volume ?? 0.6, pitch: Number.isFinite(s.pitch) ? s.pitch : 1, except: null });
  }
  // The status sounds of EntityLivingBase.attackEntityFrom / onDeath (clientSounds, played by each client copy) as S19 status 2 and 3.
  noteStatus(c) {
    const e = c.position;
    if (!e?.type || c.clientOnly || !this.mobs.entities.includes(e)) return;
    if (c.sound === hurtOf(e)) this.statuses.push({ e, status: 2 }); else if (c.sound === deathOf(e)) this.statuses.push({ e, status: 3 });
  }
  // EntityWorld.mobStatus (World.setEntityState): 6 / 7 smoke or hearts of taming, 18 the hearts of love.
  status(e, status) { this.statuses.push({ e, status }); }
  // Entity.velocityChanged knockback of a mob hit this tick is sent by `track`; for a PLAYER hit by a mob the server's copy takes it before the next movePlayer
  // (EntityPlayerMP.knockBack on the server entity, the S12 the client applies is the position stream here: the server moves the player). Dead players drop it.
  knock(p) {
    const q = p.survival.knockQueue;
    if (!q?.length) return;
    if (p.dead) q.length = 0; else drainKnockback(p.survival, p.velocity, p.position);
  }
  // EntityTracker.updateTrackedEntities for each player, the server half only. Packets leave in the order they were queued (packetSeq).
  track() {
    const mobs = this.mobs, states = new Map(), size = e => mobs.size(e);
    const stateOf = e => { let s = states.get(e); if (s === undefined) states.set(e, s = JSON.stringify(mobState(e))); return s; };
    // One EntityTrackerEntry per entity natively sends the S12 velocity (and sees isAirBorne) once for all watchers; with a tracker per player the first one would clear the flags
    // for the rest, so every tracker starts from the flags this tick began with and they are cleared after the last (batch 60).
    const flags = [];
    for (const e of mobs.entities) if (e.velocityChanged || e.airBorne) flags.push([e, e.velocityChanged, e.airBorne]);
    for (const v of this.views.values()) {
      const p = v.player.position, t = v.tracker;
      for (const [e, vc, ab] of flags) { e.velocityChanged = vc; e.airBorne = ab; }
      t.serverTick(mobs.entities, { x: p.x, y: p.y, z: p.z }, size);
      const queue = [], parts = t.queued();
      for (const en of parts) for (const pk of en.entry.packets) queue.push([packetSeq(pk), en, pk]);
      queue.sort((a, b) => a[0] - b[0]);
      const out = [], later = [];
      for (const [, en, pk] of queue) {
        if (pk.type === 'attach') continue; // riding and leads are not connected
        const { entity, vehicle, holder, after, ...rest } = pk, e = en.live, i = num(e);
        if (pk.type === 'spawn') { out.push({ ...rest, i, mob: e.type, ...mobState(e) }); v.known.set(e, stateOf(e)); }
        else if (pk.type === 'destroy') { later.push({ ...rest, i }); v.known.delete(e); } // S13 is flushed by the player's next update: one tick later than the rest (batch 52, bytecode-read)
        else out.push({ ...rest, i });
      }
      out.unshift(...v.destroys); v.destroys = later; // the destroys held back from the last tick lead this one
      for (const en of parts) en.entry.packets.length = 0;
      t.dying.length = 0;
      for (const [e, en] of t.entries) {
        if (!en.entry.tracked) continue;
        const s = stateOf(e);
        if (v.known.get(e) !== s) { v.known.set(e, s); out.push({ type: 'state', i: num(e), ...JSON.parse(s) }); }
      }
      for (const { e, status } of this.statuses) if (t.entries.get(e)?.entry.tracked) out.push({ type: 'mobStatus', i: num(e), status }); // S19 to the players tracking the mob
      if (out.length) (v.player.mobPackets ??= []).push(...out);
    }
    for (const [e] of flags) { e.velocityChanged = false; e.airBorne = false; }
    this.statuses.length = 0;
  }
  // C02 UseEntity, attack: the reach is the server's (the client aims), the damage the held weapon's (EntityWorld.attack). True when the hit landed.
  attack(p, wireId) {
    const v = this.views.get(p.id), mob = v && this.mobs.entities.find(e => num(e) === wireId);
    if (!mob || mob.health <= 0 || p.survival.health <= 0) return false;
    const dx = mob.x - p.position.x, dy = mob.y + 0.9 - (p.position.y + PHYSICS.eye), dz = mob.z - p.position.z;
    if (dx * dx + dy * dy + dz * dz > 36) return false; // 6 blocks, a little over the creative reach of 5
    this.use(v);
    if (this.host.achievements) this.host.achievements.attacker = p; // b60: kills in this call are credited to p
    try { return this.mobs.attack(mob, p.survival.held?.id ?? 0, v.survival, { x: p.position.x, y: p.position.y, z: p.position.z, yaw: p.yaw }); } finally { if (this.host.achievements) this.host.achievements.attacker = null; }
  }
  save() { return this.mobs.entities.filter(e => e.health > 0).map(e => this.mobs.serializeOne(e)); }
}
