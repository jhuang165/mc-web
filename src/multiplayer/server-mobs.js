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
import { SharedMobTracker } from './server-mob-entries.js';
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
import { PHYSICS, raycast } from '../world.js';
import { makeStack } from '../inventory.js';
import { serverAnimalUse } from './animal-use.js';
import { resolveOwner, unkeyed, claim as stampOwner, ownedBy, stampLegacy } from './server-owners.js'; // b63
import { installServerWither, boundedSkullResistance } from './server-wither.js'; // b63 mpwither

// The kinds the server keeps and the client has a copy for. Batch 61 added every natural Overworld spawn of 1.7.10: enderman, slime, witch, cave spider (the spawner and spider
// jockeys only), squid, bat, wolf, ocelot, horse and mooshroom. Zombie villagers and baby zombies are zombies with flags (mobState). Keep it a plain Set: other tracks union into it.
export const SUPPORTED = new Set(['pig', 'cow', 'sheep', 'chicken', 'zombie', 'skeleton', 'creeper', 'spider', 'enderman', 'slime', 'witch', 'cave_spider', 'squid', 'bat', 'wolf', 'ocelot', 'horse', 'mooshroom', 'pigman', 'ghast', 'magma_cube', 'blaze', 'wither_skeleton', 'wither']); // b63: the wither (server-wither.js); b62: the Nether's kinds (Overworld spawn lists never name them)
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
  // b61: the watched objects the renderers of the other kinds read (EntityEnderman 16/17/18, EntitySlime 16, EntityWolf 16/18/19, EntityOcelot 16/18, EntityHorse type and variant, EntityZombie villager)
  if (e.type === 'zombie' && e.villager) s.villager = 1;
  if (e.type === 'enderman') { if (e.carried) { s.carried = e.carried; s.carriedData = e.carriedData || 0; } if (e.screaming) s.screaming = 1; }
  if (e.type === 'slime' || e.type === 'magma_cube') s.size = e.size ?? 1;
  if (e.type === 'witch' && e.held) s.held = { id: e.held.id, damage: e.held.damage || 0 };
  if (e.type === 'wolf') { s.tamed = e.owner ? 1 : 0; if (e.angry) s.angry = 1; if (e.sitting) s.sitting = 1; s.collar = e.collar ?? 14; s.hp = Math.ceil(e.health); }
  if (e.type === 'ocelot') { s.cat = e.catType | 0; if (e.owner) s.tamed = 1; if (e.sitting) s.sitting = 1; if (e.sneaking) s.sneaking = 1; if (e.sprinting) s.sprinting = 1; }
  if (e.type === 'horse' && e.horse) s.horse = { type: e.horse.type | 0, variant: e.horse.variant | 0, armor: e.horse.armor | 0, saddled: e.horse.saddled ? 1 : 0, chested: e.horse.chested ? 1 : 0 };
  if (e.type === 'bat' && e.batHanging) s.hang = 1;
  if (e.type === 'sheep') { s.color = e.color ?? 0; if (e.sheared) s.sheared = 1; }
  if (e.type === 'pig' && e.saddled) s.saddled = 1; // b61: the saddle on the model (set by the saddle item; riding is mpvehicles)
  if (e.type === 'wither') { const q = a => [a?.[0] ?? 0, a?.[1] ?? 0].map(v => Math.round(v * 2) / 2); s.hy = q(e.headYaw); s.hpi = q(e.headPitch); } // b63: the side heads' angles (watchers 17 / 18 name targets natively; the copy has no targets to turn to). Health and Invul travel in S1C (copy-meta.js)
  if (e.type === 'creeper') { s.fuse = e.fuseTime ?? 0; s.last = e.lastActive ?? 0; if (e.powered) s.powered = 1; }
  return s;
}

export class ServerMobs {
  // `host` is the DedicatedSimulation: world, weather, light, items, `darkness`, `ticks`, `damagePlayer(player, amount, source)`.
  constructor(host, saved = null, { naturalSpawning = true, legacyOwner = null } = {}) {
    this.host = host;
    const world = host.world;
    // undefined list: EntityWorld.seedAnimals, the opening animals of a finite world below generation 11; a saved list (even empty) is restored as it was
    const list = Array.isArray(saved) ? saved.filter(r => SUPPORTED.has(r?.type)) : undefined;
    const mobs = this.mobs = new EntityWorld(world, list, undefined, new EntityIds());
    stampLegacy(mobs.entities, legacyOwner); // b63: wolves and ocelots tamed in a single-player save belong to the named player
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
    host.stats?.watchMobs(mobs); // b63 mpstats: kills, damage dealt, animalsBred for the attacker of the moment
    mobs.mobStatus = (e, status) => this.status(e, status);
    // b61: EntityAIMate.spawnBaby credits the player who fed the parents (func_146083_cb): breedCow goes through the same watcher as a kill does, with `attacker` set for the call.
    const born = mobs.spawnBaby;
    mobs.spawnBaby = function (a, b) {
      const who = host.players?.get(a.breeder ?? b.breeder), ach = host.achievements, was = ach?.attacker;
      if (who && ach) ach.attacker = who;
      try { return born.call(this, a, b); } finally { if (ach) ach.attacker = was; }
    };
    // b62: the puppy or kitten of a tamed parent belongs to the parent's owner (EntityTameable.func_152115_b(parent owner UUID)); puppyFields / kittenFields only copy the flag.
    const made = mobs.makeBaby;
    mobs.makeBaby = function (a, b) { const baby = made.call(this, a, b); if (baby?.owner && a.ownerUuid) baby.ownerUuid = a.ownerUuid; return baby; };
    installServerWither(this); // b63: wither skulls aim at the nearest player, killWither for the players near a dying wither
    this.fireballWatch(); // b62: a ball sweeps the player nearest to it, and a punched ball credits its puncher
    this.tracker = new SharedMobTracker(10); // b61: the world's one EntityTracker (server half)
    this.views = new Map(); // player id -> { player, view (the AI's PlayerView), survival (the AI's adapter), tracker, known }
    this.probe = { x: 0, y: 0, z: 0 };
  }
  // b62: EntityFireball.onUpdate sweeps ONE player box here (`ai.player`, the view the last mob used). Before each ball updates the view nearest to the ball is chosen (the
  // server world's getClosestPlayer-style aim), and a ball a player punched (`punchedBy`) is updated as that player's, so the kill goes to them (the `ghast` achievement).
  fireballWatch() {
    const fb = this.mobs.fireballs, tickOne = fb.tickOne.bind(fb), impact = fb.impact.bind(fb), ach = this.host.achievements;
    fb.tickOne = b => { this.target(b); return tickOne(b); };
    fb.impact = (b, hit) => {
      const who = b.owner === 'player' ? b.punchedBy : null, v = who && this.views.get(who.id), was = ach?.attacker;
      if (v) { this.use(v); if (ach) ach.attacker = who; }
      try { return impact(b, hit); } finally { if (v && ach) ach.attacker = was; }
    };
  }
  // b62: a left click at a ghast's fireball (EntityFireball.attackEntityFrom, ze.a): the ray of getMouseOver (3 blocks in Survival, 6 in Creative, nearer than the first block) picks the ball
  // and the player's look deflects it; `punchedBy` makes the kill of a ghast with it theirs (the `ghast` achievement, fireballWatch). True when a ball was hit (the click is used up).
  punchBall(p) {
    const fb = this.mobs._fireballs;
    if (!fb?.list.length || p.survival.health <= 0) return false;
    const reach = p.survival.creative ? 6 : 3, eye = { x: p.position.x, y: p.position.y + PHYSICS.eye, z: p.position.z };
    const dir = { x: -Math.sin(p.yaw) * Math.cos(p.pitch), y: Math.sin(p.pitch), z: -Math.cos(p.yaw) * Math.cos(p.pitch) };
    const wall = raycast(this.host.world, eye, dir, p.survival.creative ? 5 : 4.5);
    const hit = fb.pick(eye, dir, reach, wall ? wall.distance : reach);
    if (!hit) return false;
    hit.entity.punchedBy = p;
    return fb.punch(hit.entity, [dir.x, dir.y, dir.z]);
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
    // b61: one SharedMobTracker for the world (one entry and one tick counter per mob, a watcher per player); the entry keeps its packets for the wire (the client half is remote-mobs.js)
    const watcher = this.tracker.addWatcher(p.id, () => p.position);
    this.views.set(p.id, { player: p, view, survival, watcher, known: new Map(), destroys: [] });
    // b62: the creature that hurts this player is what the player's tamed wolves hit back (Survival.damage -> onRevenge; ai.js playerHurtBy would write to whichever view is current).
    p.survival.onRevenge = record => Object.assign(view, { hurtBy: record, hurtByTime: mobs.ai.clock });
  }
  removePlayer(id) { this.views.delete(id); this.tracker.removeWatcher(id); }
  // Survival.scaledDamage of a mob's hit: the host decides (the player-state track); true means the hit landed.
  hurt(p, amount, source) { return this.host.damagePlayer(p, amount, source) !== false; }
  // World.getClosestPlayerToEntity for this mob: the AI reads `ai.player` and `ai.survival` for everything it does with the player.
  target(e) {
    let best = null, bd = Infinity;
    for (const v of this.views.values()) {
      const p = v.player.position, d = (p.x - e.x) ** 2 + (p.y - e.y) ** 2 + (p.z - e.z) ** 2;
      if (d < bd) { bd = d; best = v; }
    }
    // b62: a tamed wolf or ocelot serves its own owner: the owner's view is the AI's player while that player is here (ownerHere, owner-links.js), so following, sitting, defending
    // (EntityAIOwnerHurtByTarget / HurtTarget read the owner's view) and teleporting go to the owner and not to the nearest player. An owner who is offline: getOwner() is null.
    if (e.owner && (e.type === 'wolf' || e.type === 'ocelot')) { // b63: by key, name or legacy save (server-owners.js); a stale record is stamped for the nearest player
      const own = resolveOwner(e, this.views, best);
      e.ownerHere = !!own;
      if (own) best = own;
    }
    const held = e.leash?.holderId !== undefined ? this.host.leads.holder(e, this.views) : null; // b62: a led mob follows its holder (server-leads.js)
    if (held) best = held;
    const rider = e.rider?.ref && this.views.get(e.rider.ref.id); // b62: a ridden pig reads its rider's keys and stick, not the nearest player's
    if (rider) best = rider;
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
    const out = explodeBlocks(world, x, y, z, size, weather.random, { smoking: ev.smoking !== false, resistance: ev.blue ? boundedSkullResistance : undefined }); // b63: a charged wither skull caps the resistance (explosion-simulation.js)
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
    if (Number.isInteger(this.host.difficulty)) mobs.difficulty = this.host.difficulty; // b63 mpnether3: every WorldServer reads the one server difficulty (/difficulty), the Nether's host is a view of `sim`
    let first = null;
    for (const v of views.values()) {
      const p = v.player;
      v.view.sneaking = !!p.input?.sneak;
      v.view.update({ x: p.position.x, y: p.position.y, z: p.position.z }, v.survival, p.survival.held?.id ?? 0);
      first ??= v;
    }
    if (this.spawning) {
      this.spawnPass();
      if (mobs.entities.length > MOB_LIMIT) for (let i = mobs.entities.length - 1; i >= 0 && mobs.entities.length > MOB_LIMIT; i--) if (mobs.entities[i].type !== 'wither') mobs.entities.splice(i, 1); // b63: the cap never cuts a wither just built
    }
    this.use(first);
    const lead = first.player.position;
    mobs.tick({ x: lead.x, y: lead.y, z: lead.z }, first.survival, first.player.survival.held?.id ?? 0);
    const statusSounds = mobs.clientSounds.splice(0); // taken first: drainMobEvents would play them as server sounds
    // The orbs of a kill (ExperienceOrbs of server-items.js), the server's own sounds (S29) and explosions; the clients' status sounds become S19 below.
    drainMobEvents({ mobs, xpOrbs: this.host.serverItems.xp, items: this.host.items }, {
      explode: (x, y, z, size, opts) => { this.explode({ x, y, z, size, source: opts?.exploder, smoking: opts?.smoking, blue: opts?.blue }); this.burst(x, y, z, size); },
      sound: (s, ev) => this.sound(s, ev),
      blockEdit: (cells, ev) => { if (ev?.blockBreak) this.eatGrass(ev.blockBreak); }, // b63: World.func_147480_a(x, y, z, true) plays aux 2001 (the wither's block sweep)
      eatGrass: g => this.eatGrass(g),
    });
    for (const c of statusSounds) this.noteStatus(c);
    this.track();
  }
  // The size of eligibleChunksForSpawning: the distinct chunks of the 17 x 17 windows around the players.
  eligibleChunks() {
    return unionChunkOrder([...this.views.values()].map(({ player }) => [Math.floor(player.position.x / 16), Math.floor(player.position.z / 16)])).size;
  }
  // World.playSoundAtEntity on a WorldServer: S29 to every player within 16 blocks (16 * volume above 1), the hit player included (simulation.deliverSounds).
  sound(s, ev = null) {
    if (ev?.aux) { this.broadcastAux(ev.aux); return; } // b63: World.playBroadcastSound (the wither's spawn, 1013) reaches every player, not the 16 blocks of a sound
    const at = s.position;
    if (!s.sound || !at || ![at.x, at.y, at.z].every(Number.isFinite)) return;
    this.host.soundsOut.push({ name: s.sound, x: at.x, y: at.y, z: at.z, volume: s.volume ?? 0.6, pitch: Number.isFinite(s.pitch) ? s.pitch : 1, except: null });
  }
  // b63: World.newExplosion's S27 and sound for a mob's blast: the clients' burst (dispFx explode, drawn like a TNT's) with the explosion sound, to this dimension's players within 160 blocks.
  burst(x, y, z, size) {
    if (!(size > 0)) return;
    const d = this.host.dispense;
    if (d) d.fx.push({ k: 'explode', x, y, z, size });
  }
  // b63: S28 with the broadcast flag, to every player of the server (WorldServer.func_82739_e: sendPacketToAllPlayers, recalled).
  broadcastAux({ id, x, y, z, data = 0 }) {
    for (const p of this.host.players?.values() ?? []) (p.itemsOut ??= []).push({ type: 'aux', events: [{ id, x, y, z, data }] });
  }
  // b62: EntityAIEatGrass.updateTask -> World.playAuxSFX(2001, x, y, z, id) (grass block) or func_147480_a (tall grass, id + (meta << 12)): S28 to every player within 64 blocks, no
  // exception (bytecode-read, ud.e). The block change itself (EntityWorld.eatGrass edited the shared world) travels with the tick's changes.
  eatGrass({ x, y, z, block, meta = 0 }) {
    for (const v of this.views.values()) {
      const p = v.player, dx = x - p.position.x, dy = y - p.position.y, dz = z - p.position.z;
      if (dx * dx + dy * dy + dz * dz < 64 * 64) (p.itemsOut ??= []).push({ type: 'aux', events: [{ id: 2001, x, y, z, data: block + ((meta | 0) << 12) }] });
    }
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
  // EntityTracker.updateTrackedEntities, the server half only: ONE tracker for the world (b61, `SharedMobTracker`): every entry ticks once and sends each packet to the players tracking
  // it, so the entry's `ticks` phase, its last sent position and the S12 velocity flags are the entity's, as natively. Packets leave in the order they were queued (packetSeq).
  track() {
    const mobs = this.mobs, states = new Map(), size = e => mobs.size(e), t = this.tracker;
    const stateOf = e => { let s = states.get(e); if (s === undefined) states.set(e, s = JSON.stringify(mobState(e))); return s; };
    t.serverStep(mobs.entities, size);
    const byWatcher = new Map(), outs = new Map();
    for (const v of this.views.values()) { byWatcher.set(v.watcher, v); outs.set(v, { out: [...v.destroys], later: [] }); v.destroys = []; } // the destroys held back from the last tick lead this one
    const queue = [], parts = t.queued();
    for (const en of parts) for (const pk of en.entry.packets) queue.push([packetSeq(pk), en, pk]);
    queue.sort((a, b) => a[0] - b[0]);
    for (const [, en, pk] of queue) {
      const { entity, vehicle, holder, after, ...rest } = pk, e = en.live, i = num(e);
      if (pk.type === 'attach' && pk.mode === 1 && holder?.kind === 'mob') continue; // b62: a lead held by a mob (no server path); players and knots are forwarded below
      if (pk.type === 'attach' && pk.mode !== 0 && pk.mode !== 1) continue;
      for (const w of en.entry.dest.get(pk) ?? []) {
        const v = byWatcher.get(w);
        if (!v) continue;
        const { out, later } = outs.get(v);
        if (pk.type === 'attach' && pk.mode === 1) out.push({ ...rest, i, holder: holder?.kind === 'player' ? { kind: 'player', id: e.leash?.holderId } : holder ?? null }); // b62: S1B(1) the lead, to every watcher
        else if (pk.type === 'attach') { if (vehicle === null || mobs.entities.includes(vehicle)) out.push({ ...rest, i, vehicle: vehicle ? num(vehicle) : null }); } // a mob on a mob (the spider jockey); other mounts belong to the vehicle track
        else if (pk.type === 'spawn') { out.push({ ...rest, i, mob: e.type, ...mobState(e) }); v.known.set(e, stateOf(e)); }
        else if (pk.type === 'destroy') { later.push({ ...rest, i }); v.known.delete(e); } // S13 is flushed by the player's next update: one tick later than the rest (batch 52, bytecode-read)
        else out.push({ ...rest, i });
      }
    }
    for (const en of parts) en.entry.packets.length = 0;
    t.dying.length = 0;
    for (const v of this.views.values()) {
      const { out, later } = outs.get(v);
      v.destroys = later;
      for (const [e, en] of t.entries) {
        if (!en.entry.set.has(v.watcher)) continue;
        const s = stateOf(e);
        if (v.known.get(e) !== s) { v.known.set(e, s); out.push({ type: 'state', i: num(e), ...JSON.parse(s) }); }
      }
      for (const { e, status } of this.statuses) if (t.entries.get(e)?.entry.set.has(v.watcher)) out.push({ type: 'mobStatus', i: num(e), status }); // S19 to the players tracking the mob
      if (out.length) (v.player.mobPackets ??= []).push(...out);
    }
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
  // C02 UseEntity, interact (b61, animal-use.js): same reach as the attack; the server's own rules decide, `p.animHandled` tells the network tick to drop the click's item use.
  interact(p, wireId, claim = false) {
    const v = this.views.get(p.id), mob = v && this.mobs.entities.find(e => num(e) === wireId);
    if (!mob || mob.health <= 0 || p.survival.health <= 0) return false;
    const dx = mob.x - p.position.x, dy = mob.y + 0.9 - (p.position.y + PHYSICS.eye), dz = mob.z - p.position.z;
    if (dx * dx + dy * dy + dz * dz > 36) return false;
    this.use(v);
    // b62: taming. Only the owner is "the owner" for the click (sitting, feeding); a wolf or ocelot tamed by this click is stamped with the player's resume key.
    const owned = mob.type === 'wolf' || mob.type === 'ocelot', was = !!mob.owner;
    if (owned) { if (unkeyed(mob)) stampOwner(mob, p); mob.ownerHere = ownedBy(mob, p); if (mob.ownerHere && mob.ownerUuid !== p.resumeKey) stampOwner(mob, p); } // b63: a legacy record is the clicker's (server-owners.js)
    const inv = p.survival.inventory, done = serverAnimalUse(this.mobs, p, mob, { ride: (q, e) => this.host.vehicles.pigs.mount(q, e), lead: (q, e) => this.host.leads.use(q, e), drop: st => this.host.items.dropPlayer(st, p.position, p.yaw, p.pitch) });
    if (owned && !was && mob.owner) { stampOwner(mob, p); mob.ownerHere = true; } // EntityTameable.func_152115_b(player UUID)
    if (inv.held && inv.held.count <= 0 && !p.survival.creative) inv.main[inv.current] = null; // interactWith destroys a held stack left at size <= 0
    if (!done && claim) p.seen[inv.current] = { id: -1, count: -1 }; // the client predicted a use the server refused: ServerItems.settle sends the real slot
    p.animHandled = done && !claim ? (this.host.ticks ?? 0) + 1 : 0; // a click the client did not predict is followed by its item-use message: dropped for two ticks
    return done;
  }
  save() { return this.mobs.entities.filter(e => e.health > 0).map(e => this.mobs.serializeOne(e)); }
}
