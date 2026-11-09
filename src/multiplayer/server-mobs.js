// The gun server's mobs (not 1.7.10 networking): one EntityWorld (entities.js) over the server's streamed world, run as
// WorldServer runs it for several players. SpawnerAnimals spawns around every player's chunks (the cap scaled by their union, as
// eligibleChunksForSpawning is), each mob's AI sees its nearest player (World.getClosestPlayerToEntity), mob spawners and
// skeleton arrows tick against every player, and a creeper's blast hurts every player in reach. Mobs whose column leaves the
// resident set are kept by column, as a saved chunk keeps its entities, and come back with it. Each tab gets the mobs near it
// (rows, below) and draws them with its usual mob renderer (remote-mobs.js).
import { EntityWorld, ENTITY_TYPES } from '../entities.js';
import { MobSpawners } from '../mob-spawner.js';
import { Arrows, arrowTargets } from '../bow.js';
import { mobTargets } from '../projectiles.js';
import { isWet } from '../weather.js';
import { localDifficulty } from '../difficulty.js';
import { drainMobEvents } from '../living-simulation.js';
import { applyExplosion } from '../explosion-simulation.js';
import { explosionImpact } from '../explosion.js';
import { blastKnockback } from '../armor-enchantments.js';
import { entityBox } from '../weather.js'; // the player's box
import { PHYSICS } from '../world.js';
import { gameRule } from '../game-rules.js';
import { drainKnockback } from '../player-knockback.js';

const MOB_SPAWNER = 52;
export const MOB_RANGE = 48; // blocks: the mobs a tab is told about (EntityTracker tracks most living entities to 80; 48 keeps a tick message small)
export const MOB_ROWS = 80; // the nearest ones, at most
export const STORED_PER_COLUMN = 64;
const SPAWN_RADIUS = 8; // SpawnerAnimals: the 17 x 17 chunks around each player
const noop = () => {};
const columnOf = (x, z) => `${Math.floor(x / 16)},${Math.floor(z / 16)}`;
const r3 = v => Math.round(v * 1000) / 1000, r2 = v => Math.round(v * 100) / 100;
// Fields a mob's rig reads beyond the common row (mob-renderer.js and its helpers), sent when they change.
const EXTRA = ['color', 'sheared', 'eatTimer', 'saddled', 'powered', 'lastActive', 'fuseTime', 'maxFuse', 'size', 'squishFactor', 'prevSquishFactor',
  'burn', 'equipment', 'villager', 'profession', 'horse', 'angry', 'collar', 'sitting', 'catType', 'sneaking', 'sprinting', 'attackTimer', 'holdRose',
  'carried', 'carriedData', 'screaming', 'held', 'charging', 'batHanging', 'invul', 'headYaw', 'headPitch', 'oFlap', 'oFlapSpeed', 'destPos',
  'wingRotation', 'effects', 'customName', 'chickenJockey'];
export const mobNumber = e => Number(String(e.id).replace('mob-', ''));

export class ServerMobs {
  // `sim`: the GunSimulation (its config, play, players and random are set after this is built, so they are read when needed).
  constructor(sim, saved = {}) {
    this.sim = sim;
    const random = () => (sim.random ?? Math.random)();
    const ew = this.ew = new EntityWorld(sim.world, [], random);
    this.spawners = MobSpawners.fromJSON(Array.isArray(saved.spawners) ? saved.spawners : []);
    this.arrows = new Arrows(random);
    this.stored = new Map(Array.isArray(saved.stored) ? saved.stored.filter(([k, list]) => typeof k === 'string' && Array.isArray(list)) : []);
    const light = () => sim.light;
    ew.lightAt = (x, y, z) => light().level(x, y, z, sim.darkness);
    ew.skyLightAt = (x, y, z) => light().skyAt(x, y, z);
    ew.thunderLightAt = (x, y, z) => light().level(x, y, z, 10);
    ew.fullLightAt = (x, y, z) => light().level(x, y, z, 0);
    ew.dimensionBlockLight = (x, y, z) => light().blockAt(x, y, z);
    ew.lightSubtracted = () => sim.darkness;
    ew.isDaytime = () => sim.darkness < 4;
    ew.isRaining = () => sim.weather.isRaining();
    ew.isThundering = () => sim.weather.isThundering();
    ew.wet = (e, height) => isWet(sim.weather, sim.world, e, height);
    ew.worldRandom = sim.weather.random;
    ew.spawnPoint = () => { const s = sim.worldSpawn?.() ?? sim.world.spawn(); return { x: Math.floor(s.x), y: Math.floor(s.y), z: Math.floor(s.z) }; };
    ew.localDifficulty = (x, y, z) => localDifficulty(ew.difficulty, sim.time, 0, sim.world.isLoaded(x, z) && y >= 0 && y < sim.world.height);
    ew.shoot = (e, target, scale) => this.arrows.skeletonShoot(e, target, scale, ew.difficulty);
    ew.loadTotalTime(Number.isSafeInteger(saved.totalTime) ? saved.totalTime : sim.ticks);
    // Ids stay unique across the kept columns: new mobs are numbered after every saved one.
    let next = Number.isSafeInteger(saved.nextId) ? saved.nextId : 1;
    for (const [, list] of this.stored) for (const r of list) next = Math.max(next, (mobNumber(r) || 0) + 1);
    ew.nextId = Math.max(ew.nextId, next);
    this.current = null; // the player the AI sees right now
  }
  // The resident columns changed (simulation.js reside): mobs and arrows of columns that left are kept (mobs) or dropped (arrows);
  // mobs kept for columns that came back return.
  columns({ added = [], removed = [] }) {
    const ew = this.ew;
    if (removed.length) {
      const gone = new Set(removed.map(c => `${c.x},${c.z}`));
      const keep = [];
      for (const e of ew.entities) {
        const key = columnOf(e.x, e.z);
        if (!gone.has(key)) { keep.push(e); continue; }
        if (e.health <= 0) continue; // a corpse is not saved (EntityLivingBase.onDeathUpdate's setDead)
        const list = this.stored.get(key) ?? [];
        if (list.length < STORED_PER_COLUMN) list.push(ew.serializeOne(e));
        this.stored.set(key, list);
      }
      ew.entities = keep;
      this.arrows.list = this.arrows.list.filter(a => !gone.has(columnOf(a.x, a.z)));
    }
    for (const c of added) {
      const key = `${c.x},${c.z}`, list = this.stored.get(key);
      if (!list) continue;
      this.stored.delete(key);
      for (const record of list) {
        const m = ew.restore(record);
        if (!m) continue;
        ew.entities.push(m); ew.nextId = Math.max(ew.nextId + 1, mobNumber(m) + 1);
      }
    }
  }
  living() { return [...this.sim.players.values()].filter(p => !p.dead && !this.sim.frozen(p)); }
  nearest(players, at) {
    let best = null, d = Infinity;
    for (const p of players) {
      const q = (p.position.x - at.x) ** 2 + (p.position.y - at.y) ** 2 + (p.position.z - at.z) ** 2;
      if (q < d) { d = q; best = p; }
    }
    return best;
  }
  // The AI's one PlayerView (ai.js) becomes player `p`: its position, Survival, held item and sneaking.
  see(p) {
    const ai = this.ew.ai;
    if (this.current === p) return;
    this.current = p;
    ai.player.update(p.position, p.survival, p.survival.inventory.held?.id ?? 0);
    ai.player.sneaking = !!p.input?.sneak;
    ai.survival = p.survival;
  }
  tick() {
    const sim = this.sim, ew = this.ew, config = sim.config ?? {};
    ew.difficulty = config.difficulty ?? 2;
    ew.spawnMonsters = config.spawnMonsters !== false; ew.spawnAnimals = config.spawnAnimals !== false;
    ew.lootItems = sim.play?.items ?? null;
    const players = this.living();
    if (!players.length) return; // no one to tick around: the world's mobs wait, as chunks with no player nearby unload
    for (const p of players) p.survival.onRevenge = record => ew.ai.playerHurtBy(record);
    // WorldServer.tick: SpawnerAnimals before the entities, over every player's 17 x 17 chunks; the cap counts their union.
    if (gameRule('doMobSpawning') && (ew.spawnMonsters || ew.spawnAnimals)) {
      const union = new Set();
      for (const p of players) {
        const cx = Math.floor(p.position.x / 16), cz = Math.floor(p.position.z / 16);
        for (let dx = -SPAWN_RADIUS; dx <= SPAWN_RADIUS; dx++) for (let dz = -SPAWN_RADIUS; dz <= SPAWN_RADIUS; dz++) union.add(`${cx + dx},${cz + dz}`);
      }
      ew.spawnCapChunks = union.size;
      const animals = ((ew.worldTicks ?? -1) + 1) % 400 === 0;
      for (const p of players) { this.current = null; this.see(p); ew.naturalSpawn(p.position, p.survival, animals); }
    }
    ew.naturalSpawning = false;
    this.current = null;
    const first = players[0];
    ew.beforeMob = e => this.see(this.nearest(players, e));
    try { ew.tick(first.position, first.survival, first.survival.inventory.held?.id ?? 0); } finally { ew.beforeMob = null; }
    this.current = null; // beginTick showed the first player whatever was seen last
    this.tickArrows(players);
    this.tickSpawners(players);
    this.drain(players);
  }
  // EntityArrow.onUpdate for each skeleton arrow, against the mobs and the arrow's nearest player.
  tickArrows(players) {
    const world = this.sim.world, ew = this.ew;
    if (!this.arrows.list.length) return;
    for (const a of this.arrows.list) {
      if (a.dead || !world.isTicking(a.x, a.z)) continue;
      const p = this.nearest(players, a);
      this.arrows.step(world, a, { targets: arrowTargets(mobTargets(ew.entities, p.position, PHYSICS.width, PHYSICS.height), p.survival.creative), mobs: ew, survival: p.survival, player: p.position });
    }
    this.arrows.list = this.arrows.list.filter(a => !a.dead);
    for (const s of this.arrows.drain?.() ?? []) if (s?.sound) this.sound(s);
  }
  // TileEntityMobSpawner.updateEntity: a spawner works while a player is within 16 blocks; one whose block is gone is removed.
  tickSpawners(players) {
    const sim = this.sim, world = sim.world, ew = this.ew;
    if (!this.spawners.size) return;
    if (sim.ticks % 20 === 0) for (const s of [...this.spawners.values()]) if (world.isLoaded(s.x, s.z) && world.get(s.x, s.y, s.z) !== MOB_SPAWNER) this.spawners.remove(s.x, s.y, s.z);
    const level = (x, y, z, sub) => sim.light.level(x, y, z, sub);
    const env = { skyLight: (x, y, z) => sim.light.skyAt(x, y, z), lightValue: (x, y, z) => level(x, y, z, sim.darkness), thunderLightValue: (x, y, z) => level(x, y, z, 10), thundering: () => sim.weather.isThundering() };
    this.current = null; this.see(players[0]);
    this.spawners.tick({ ...ew.spawnerHooks(env), random: sim.weather.random, players: players.map(p => ({ x: p.position.x, y: p.position.y, z: p.position.z })), spawnParticles: noop });
  }
  // The mob events: sounds go to the players near them, drops become item entities, a creeper's blast goes off.
  drain(players) {
    const sim = this.sim;
    const xpOrbs = { spawn: noop }; // experience is not kept on this server
    drainMobEvents({ mobs: this.ew, xpOrbs, items: sim.play.items }, {
      sound: s => this.sound(s),
      explode: (x, y, z, size, options) => this.explode(players, x, y, z, size, options),
    });
  }
  sound({ sound, position, volume = 1, pitch = 1 }) {
    if (!position || typeof sound !== 'string') return;
    const event = { type: 'sound', sound, x: r2(position.x), y: r2(position.y), z: r2(position.z), volume: r2(volume), pitch: r2(pitch) };
    for (const p of this.sim.players.values()) if (Math.hypot(p.position.x - position.x, p.position.y - position.y, p.position.z - position.z) <= 16 * Math.max(1, volume)) this.sim.send(p, event);
  }
  // Explosion.doExplosionA/B on the server's blocks, tiles and items, then on every player in reach (applyExplosion's player part,
  // which is written for one player, is skipped and run here per player).
  explode(players, x, y, z, size, { exploder = null, attacker = null, smoking = true } = {}) {
    const sim = this.sim, none = { explode: noop, spawn: noop }, tiles = Object.create(sim.tiles, { health: { value: 0 } });
    applyExplosion({ world: sim.world, weather: sim.weather, mobs: this.ew, items: sim.play.items, xpOrbs: none, arrows: this.arrows, projectiles: none,
      falling: null, primed: [], hanging: null, survival: tiles, position: { x: 0, y: -1e6, z: 0 }, velocity: { x: 0, y: 0, z: 0 }, farming: sim.farming },
    { x, y, z, size, exploder, attacker, smoking });
    for (const p of players) {
      const at = p.position, hit = explosionImpact(sim.world, x, y, z, size, at.x, at.y, at.z, at.y + PHYSICS.eye, entityBox(at, PHYSICS.width, PHYSICS.height));
      if (!hit) continue;
      if (!p.survival.creative) p.survival.scaledDamage(hit.damage, attacker && attacker !== 'player' ? 'a ' + attacker.type : 'an explosion', { source: 'explosion', from: attacker && attacker !== 'player' ? attacker : undefined });
      drainKnockback(p.survival, p.velocity, p.position);
      const kick = blastKnockback(p.survival.inventory?.armor ?? [], hit.impact), scale = hit.impact && kick !== hit.impact ? kick / hit.impact : 1;
      p.velocity.x += hit.push[0] * scale; p.velocity.y += hit.push[1] * scale; p.velocity.z += hit.push[2] * scale;
    }
    const event = { type: 'explosion', x: r2(x), y: r2(y), z: r2(z), size };
    for (const p of sim.players.values()) if (Math.hypot(p.position.x - x, p.position.y - y, p.position.z - z) <= 64) sim.send(p, event);
  }
  // A player's gun or knife hit on a mob (combat.js), as the guns mod's single-player hooks deal it: every bullet is a fresh hit
  // (hooks.js), a bullet knocks back only for guns with knockback, a knife strike always does (melee-hooks.js).
  hurt(e, amount, attacker, { gun = false, knockback = true } = {}) {
    if (!this.ew.entities.includes(e) || e.health <= 0) return false;
    if (gun) { e.hurt = 0; e.lastDamage = 0; }
    const from = { x: attacker.position.x, z: attacker.position.z };
    this.see(attacker); // the mob's revenge target and drops' looting read the attacking player
    return !!this.ew.attackEntityFrom(e, amount, { name: 'player', player: true, ...(gun && !knockback ? {} : { from }) });
  }
  // Boxes of the live mobs within `range` of `at`, for shots and strikes ({ mob, box: { min, max } }).
  targets(at, range = 160) {
    const out = [];
    for (const e of this.ew.entities) {
      if (e.health <= 0 || Math.abs(e.x - at.x) > range || Math.abs(e.z - at.z) > range) continue;
      const [w, h] = this.ew.size(e);
      out.push({ mob: e, box: { min: [e.x - w / 2, e.y, e.z - w / 2], max: [e.x + w / 2, e.y + h, e.z + w / 2] } });
    }
    return out;
  }
  // The mobs near player `p` as rows [id, type, x, y, z, bodyYaw, headYaw, pitch, limbSwing, limbAmount, hurt, death, growingAge, age,
  // extra]; `extra` (the rig's own fields) only when it changed since this player last got it, else 0.
  rows(p) {
    const at = p.position, sent = (p.sentMobs ??= new Map()), seen = new Set();
    const near = this.ew.entities.filter(e => Math.abs(e.x - at.x) <= MOB_RANGE && Math.abs(e.z - at.z) <= MOB_RANGE && Math.abs(e.y - at.y) <= MOB_RANGE)
      .sort((a, b) => ((a.x - at.x) ** 2 + (a.z - at.z) ** 2) - ((b.x - at.x) ** 2 + (b.z - at.z) ** 2)).slice(0, MOB_ROWS);
    const rows = near.map(e => {
      const id = mobNumber(e);
      seen.add(id);
      const extra = {};
      for (const k of EXTRA) if (e[k] !== undefined && e[k] !== null && typeof e[k] !== 'function') extra[k] = e[k];
      if (e.ridingEntity) extra.riding = true;
      const json = JSON.stringify(extra), changed = sent.get(id) !== json;
      if (changed) sent.set(id, json);
      return [id, e.type, r3(e.x), r3(e.y), r3(e.z), r2(e.renderYawOffset ?? 0), r2(e.rotationYawHead ?? 0), r2(e.rotationPitch ?? 0),
        r2(e.limbSwing ?? 0), r2(e.limbSwingAmount ?? 0), e.hurt | 0, e.death | 0, e.growingAge | 0, e.age | 0, changed ? extra : 0];
    });
    for (const id of sent.keys()) if (!seen.has(id)) sent.delete(id);
    return rows;
  }
  save() {
    const stored = new Map(this.stored);
    for (const e of this.ew.entities) {
      if (e.health <= 0) continue;
      const key = columnOf(e.x, e.z), list = stored.get(key) ?? [];
      if (list.length < STORED_PER_COLUMN) list.push(this.ew.serializeOne(e));
      stored.set(key, list);
    }
    return { stored: [...stored].map(([k, list]) => [k, list.map(r => JSON.parse(JSON.stringify(r, (key, v) => (typeof v === 'function' ? undefined : v))))]),
      spawners: this.spawners.toJSON(), totalTime: this.ew.saveTotalTime(), nextId: this.ew.nextId };
  }
}
export { ENTITY_TYPES };
