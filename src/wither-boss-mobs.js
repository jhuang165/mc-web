// EntityWither (xc) and EntityWitherSkull (zp) inside EntityWorld (entities.js). The pure rules are wither-boss.js (replayed against
// public/research/wither-boss-reference.json); the model is wither-boss-renderer.js and the bar boss-bar.js. entities.js calls
// witherUpdate (onLivingUpdate before the walk), witherPost (after it), witherTalk, witherRanged and installWither; ai.js calls
// buildWitherTasks. The skulls in flight are WitherSkulls (a Fireballs subclass on the same sweep).
import { ENTITY_TYPES, HOSTILE, entityRandom, livingSoundRoll } from "./entities.js";
import { JavaRandom } from "./java-random.js";
import { Fireballs } from "./fireballs.js";
import { aimPart } from "./dragon-parts.js";
import { fireballAcceleration } from "./blaze-ghast.js";
import { intercept, rayTraceBlocks } from "./projectiles.js";
import { gameRule } from "./game-rules.js";
import { addMobEffect } from "./mob-effects.js";
import { explosionDrops } from "./explosion.js";
import { POTION } from "./potions.js";
import { headPass } from "./wither-targeting.js";
import { WITHER, SKULL, WITHER_EYE, WITHER_PROOF_INTERNAL, chase, trackHead, headPosition, headParticleSpecs, invulStep, startHealth, armored, witherSkullEffectTicks } from "./wither-boss.js";
const f = Math.fround;
export const NETHER_STAR = 2060;
const UNDEAD_TYPES = new Set(["zombie", "skeleton", "wither_skeleton", "pigman", "wither", "zombie_pigman"]);
// The wither's attackEntitySelector (xc.bp): any EntityLivingBase whose creature attribute is not UNDEAD. The horse class has no getCreatureAttribute override, so the zombie
// and skeleton horses report UNDEFINED and are targets (executed, b55attr); the giant does not report UNDEAD either (EntityGiantZombie keeps the default).
export const witherIsUndead = (o) => UNDEAD_TYPES.has(o.type);
// World.getEntitiesWithinAABB walks the chunks (x, then z) and each chunk's 16 high slices upwards (the entity lists are in insertion
// order), so a candidate list is ordered by that triple; ties keep the engine's array order. Slice lists re-append an entity that crosses a
// slice or chunk, which this engine does not track (approximate within one slice).
export const nativeOrder = (list, at = (o) => o) => list.map((o, i) => ({ o, i, p: at(o) }))
  .sort((a, b) => (Math.floor(a.p.x / 16) - Math.floor(b.p.x / 16)) || (Math.floor(a.p.z / 16) - Math.floor(b.p.z / 16))
    || (Math.min(15, Math.max(0, Math.floor(a.p.y / 16))) - Math.min(15, Math.max(0, Math.floor(b.p.y / 16)))) || a.i - b.i).map((x) => x.o);
const states = new WeakMap();
// The fields EntityWither keeps outside the datawatcher: bt (next head shot tick), bu (the random-shot counter), bv (the block-break
// counter) and the three head targets (datawatcher 17 to 19, here the target views).
export const witherState = (e) => { let s = states.get(e); if (!s) states.set(e, (s = { bt: [0, 0], bu: [0, 0], bv: 0, heads: [null, null, null] })); return s; };
const ticksOf = (e) => Math.trunc(e.age ?? 0);
const pitchRoll = (rand) => f(f(f(rand.nextFloat() - rand.nextFloat()) * f(0.2)) + 1);
// ahb.func_82739_e / playAuxSFX level events: 1013 (mob.wither.spawn, heard 2 blocks from the listener towards the origin),
// 1014 (mob.wither.shoot, volume 2) and 1012 (mob.zombie.woodbreak, volume 2) at the block, centred.
function levelEvent(m, id, x, y, z) {
  m.worldRandom ??= new JavaRandom(Math.floor(Math.random() * 2 ** 48));
  if (id === 1013) {
    const p = m.ai?.player;
    let at = { x, y, z };
    if (p) {
      const px = p.x, py = p.y + (p.eyeHeight ?? 1.62), pz = p.z, dx = x - px, dy = y - py, dz = z - pz, d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      at = d > 0 ? { x: px + dx / d * 2, y: py + dy / d * 2, z: pz + dz / d * 2 } : { x: px, y: py, z: pz };
    }
    m.events.push({ sound: "mob.wither.spawn", volume: 1, pitch: 1, position: at });
    return;
  }
  m.events.push({ sound: id === 1014 ? "mob.wither.shoot" : "mob.zombie.woodbreak", volume: 2, pitch: pitchRoll(m.worldRandom), position: { x: Math.floor(x) + 0.5, y: Math.floor(y) + 0.5, z: Math.floor(z) + 0.5 } });
}

// EntityWither.getLivingSound: mob.wither.idle at the mob interval of 80.
export function witherTalk(m, e) {
  const rand = entityRandom(e);
  if (!livingSoundRoll(e, rand, 80)) return;
  m.events.push({ sound: "mob.wither.idle", volume: 1, pitch: pitchRoll(rand), position: { x: e.x, y: e.y, z: e.z } });
}

// xc.e before EntityMob's: the chase push towards the head 0 target. The walk then moves it (gravity and drag as any mob).
export function witherUpdate(m, e) {
  const brain = m.ai.brain(e), s = witherState(e), target = brain.attackTarget?.alive ? brain.attackTarget : null;
  s.heads[0] = target;
  chase(e, target, armored(e.health));
  e.yaw = (-e.rotationYaw * Math.PI) / 180;
}
// xc.e's tail, drawn by the client copy of the entity (its own Entity.rand `Z`, the client world's rand for the 1 in 4 armour roll): a gaussian
// smoke puff at each head (0.3 spread), a "mobSpell" at the head one tick in four while armoured, and three bluish "mobSpell"
// around the body while Invul > 0. The spawn's BlockSkull "snowballpoof" burst is a server-world spawnParticle (a no-op), so none is drawn.
const visual = new WeakMap();
function headParticles(m, e) {
  if (!m.fx) return;
  let r = visual.get(e);
  if (!r) visual.set(e, (r = { z: new JavaRandom(Math.floor(Math.random() * 2 ** 48)), w: new JavaRandom(Math.floor(Math.random() * 2 ** 48)) }));
  for (const [name, x, y, z, vx, vy, vz] of headParticleSpecs(e, r.z, r.w)) m.fx.spawn(name, x, y, z, vx, vy, vz);
}
// xc.e after EntityMob's: the side heads turn to their targets.
export function witherPost(m, e) {
  const s = witherState(e), body = e.renderYawOffset ?? e.rotationYaw ?? 0;
  for (let i = 0; i < 2; i++) trackHead(e, i + 1, s.heads[i + 1]?.alive ? s.heads[i + 1] : null, body);
  headParticles(m, e);
}

// xc.a(IDDDZ) / a(ILsv;): a skull from a head, event 1014, aimed at (x, y, z) or the target's chest (eye height / 2).
export function launchToCoords(m, e, head, x, y, z, blue) {
  levelEvent(m, 1014, e.x, e.y, e.z);
  const h = headPosition(e, head);
  m.skulls.launch({ owner: e, x: h.x, y: h.y, z: h.z, dx: x - h.x, dy: y - h.y, dz: z - h.z, blue });
}
export function launchToEntity(m, e, head, t) {
  launchToCoords(m, e, head, t.x, t.y + (t.eyeHeight ?? 1.62) * 0.5, t.z, head === 0 && entityRandom(e).nextFloat() < f(WITHER.chargedChance));
}
export const witherRanged = (m, e, target) => launchToEntity(m, e, 0, target);

// xc.bn (the AI half of onLivingUpdate), run as Brain.updateAITick: the spawn invulnerability, else the side heads' shots, the head 0
// target, the block-breaking counter and the 1 HP regeneration.
export function witherAITick(brain) {
  const e = brain.e, m = brain.ai.ew, s = witherState(e), rand = entityRandom(e), ticks = ticksOf(e);
  if ((e.invul ?? 0) > 0) {
    const step = invulStep(e.invul, ticks);
    if (step.explode) {
      m.events.push({ explode: { x: e.x, y: e.y + WITHER_EYE, z: e.z, size: WITHER.spawnExplosion, source: e, smoking: gameRule("mobGriefing"), flaming: false }, position: { x: e.x, y: e.y, z: e.z } });
      levelEvent(m, 1013, Math.floor(e.x), Math.floor(e.y), Math.floor(e.z));
    }
    e.invul = Math.max(0, step.invul);
    if (step.heal) e.health = Math.min(WITHER.maxHealth, f(e.health + step.heal));
    return;
  }
  const p = m.ai.player, h = (o) => (o === p ? p : m.ai.brain(o));
  headPass(s, rand, ticks, {
    pos: e, difficulty: m.difficulty ?? 2,
    // World.getEntitiesWithinAABB(EntityLivingBase, box.expand(20, 8, 20), xd): living, not undead, the player included, in chunk/slice order
    pool: () => {
      const near = [];
      for (const o of m.entities) if (o !== e && o.health > 0 && !witherIsUndead(o) && brain.ai.overlaps(brain, m.ai.brain(o), 20, 8, 20)) near.push(o);
      if (p?.alive && brain.ai.overlaps(brain, p, 20, 8, 20)) near.push(p);
      return nativeOrder(near).map(h);
    },
    alive: (c) => c.alive, near: (c) => brain.distSq(c) <= 900, sees: (c) => brain.canSee(c), isPlayer: (c) => !!c.isPlayer, creative: (c) => !!c.creative,
    self: (c) => c === brain,
    launchCoords: (head, x, y, z) => launchToCoords(m, e, head, x, y, z, true),
    launchEntity: (head, c) => launchToEntity(m, e, head, c),
  });
  const main = brain.attackTarget;
  s.heads[0] = main?.alive ? main : null;
  if (s.bv > 0 && --s.bv === 0 && gameRule("mobGriefing")) breakBlocks(m, e, rand);
  if (ticks % 20 === 0) e.health = Math.min(WITHER.maxHealth, f(e.health + 1));
}
// xc.bn's block sweep: x and z within one block, y from the feet up 3, every block that is not air, bedrock, end portal, its frame or a
// command block goes with its drops (World.func_147480_a(.., true)); one level event 1012 if any went.
function breakBlocks(m, e, rand) {
  const w = m.world, fy = Math.floor(e.y), fx = Math.floor(e.x), fz = Math.floor(e.z);
  let any = false;
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) for (let dy = 0; dy <= 3; dy++) {
    const x = fx + dx, y = fy + dy, z = fz + dz, id = w.get(x, y, z);
    if (id === 0 || WITHER_PROOF_INTERNAL.includes(id)) continue;
    const meta = w.getMeta ? w.getMeta(x, y, z) : 0;
    w.set(x, y, z, 0);
    m.events.push({ blockEdit: [[x, y, z]], blockBreak: { x, y, z, block: id } });
    for (const d of explosionDrops(id, meta, x, y, z, 1, rand).items) m.events.push({ drop: d.id, count: 1, ...(d.damage ? { damage: d.damage } : {}), position: { x: d.x, y: d.y, z: d.z } });
    any = true;
  }
  if (any) levelEvent(m, 1012, e.x, e.y, e.z);
}

// The wither skulls in flight: Fireballs' sweep and owner grace, with the skull's own motion factor, impact and no fire.
export class WitherSkulls extends Fireballs {
  // `exact` is the (world, x, y, z, ax, ay, az) form (EntityFireball's second constructor): the aim as given, normalised the same way, with no noise.
  launch({ owner, x, y, z, dx, dy, dz, blue = false, exact = null }) {
    const rand = new JavaRandom(Math.floor(this.mobs.random() * 2 ** 48)), [ax, ay, az] = exact ? fireballAcceleration(...exact) : fireballAcceleration(dx, dy, dz, rand);
    const b = { id: "ws-" + this.next++, type: "witherSkull", kind: "witherSkull", blue, large: false, owner, health: 1, x, y, z, px: x, py: y, pz: z, vx: 0, vy: 0, vz: 0, ax, ay, az, ticks: 0, dead: false, scale: 1, fullbright: true, width: SKULL.size };
    this.list.push(b);
    this.mobs.joined?.(b, "skull"); // entity-simulation.js (entityWalkers): World.spawnEntityInWorld, the end of loadedEntityList
    return b;
  }
  accepts(kind) { return kind === "witherSkull"; }
  // EntityWitherSkull's dangerous flag is a data-watcher value that the native NBT does not save; `blue` is restored from the browser save only.
  build(r) {
    return { id: "ws-" + this.next++, type: "witherSkull", kind: "witherSkull", blue: false, large: false, owner: null, health: 1, x: r.x, y: r.y, z: r.z, px: r.x, py: r.y, pz: r.z, vx: r.vx, vy: r.vy, vz: r.vz, ax: r.ax, ay: r.ay, az: r.az, ticks: 0, dead: false, scale: 1, fullbright: true, width: SKULL.size };
  }
  // EntityWitherSkull.onUpdate (EntityFireball's flight with the skull's own factor) for one skull, where the loaded-entity walk reaches it.
  tickOne(b) {
    const mobs = this.mobs;
    if (b.dead || !mobs.isActive(b)) return; // World.updateEntityWithOptionalForce: +-32 blocks loaded (natural-spawning.md "Round 7")
    b.px = b.x; b.py = b.y; b.pz = b.z;
    if (this.ownerGone(b) || !this.blockExists(b)) { b.dead = true; return; }
    b.ticks++;
    mobs.fx?.spawn("smoke", b.x, b.y + 0.5, b.z, 0, 0, 0);
    const start = [b.x, b.y, b.z], end = [b.x + b.vx, b.y + b.vy, b.z + b.vz];
    let hit = rayTraceBlocks(mobs.world, start, end);
    const entity = this.sweep(b, start, hit ? hit.vec : end);
    if (entity) { hit = { entity: entity.target }; aimPart(entity); }
    if (hit) this.impact(b, hit); // the update goes on: the skull still moves (EntityFireball.onUpdate only marks it dead)
    const water = mobs.world.get(Math.floor(b.x), Math.floor(b.y), Math.floor(b.z)), wet = water >= 8 && water <= 9, k = wet ? f(0.8) : b.blue ? SKULL.factorBlue : SKULL.factor;
    b.x += b.vx; b.y += b.vy; b.z += b.vz;
    b.vx = (b.vx + b.ax) * k; b.vy = (b.vy + b.ay) * k; b.vz = (b.vz + b.az) * k;
  }
  // zp.a(azu): 8 damage from the wither (a mob source) and a 5 heal on a kill, the wither effect by difficulty, then a power 1 explosion.
  impact(b, hit) {
    const mobs = this.mobs, owner = b.owner, t = hit.entity;
    if (t) {
      const player = !!t.player, survival = mobs.ai?.survival;
      let landed = false;
      if (owner) {
        landed = player ? !!survival?.scaledDamage(WITHER.skullDamage, "a wither", { source: "mob", from: owner }) : mobs.damage(t, WITHER.skullDamage, owner.x, owner.z, false, owner, { name: "mob", attacker: owner });
        if (landed && (player ? survival.health <= 0 : t.health <= 0) && owner.health > 0) owner.health = Math.min(WITHER.maxHealth, f(owner.health + WITHER.skullHeal));
      } else if (!player) mobs.damage(t, 5, b.x, b.z, false, null, { name: "magic" });
      const ticks = witherSkullEffectTicks(mobs.difficulty ?? 2);
      if (ticks > 0 && (player || t.type !== "wither")) {
        if (player) survival?.effects?.add({ id: POTION.WITHER, duration: ticks, amplifier: 1 });
        else addMobEffect(t, POTION.WITHER, ticks, 1);
      }
    }
    mobs.events.push({ explode: { x: b.x, y: b.y, z: b.z, size: WITHER.skullExplosion, source: null, smoking: gameRule("mobGriefing"), flaming: false, blue: b.blue }, position: { x: b.x, y: b.y, z: b.z } });
    b.dead = true;
  }
  pick() { return null; } // EntityWitherSkull.canBeCollidedWith is false
  punch() { return false; }
}

// ai.js: the task list of the constructor (xc): swim 0, the skull ArrowAttack 2 (speed 1.0, interval 40 both ways, range 20), wander 5,
// watch the player 6 (8 blocks), look idle 7; targets: hurt-by 1 (no call for help) and the nearest non-undead mob 2 (range 40, no sight
// check). While Invul > 0 the AI half of onLivingUpdate is not run (xc.bn returns before super.bn), so the tasks and navigator are gated.
export function buildWitherTasks(m, K) {
  const { Swim, ArrowAttack, Wander, WatchClosest, LookIdle, TargetBase, HurtByTarget } = K, e = m.e;
  class NearestNonUndead extends TargetBase {
    constructor() { super(m, false); this.target = null; }
    shouldExecute() {
      const r = this.range(), c = nativeOrder(m.ai.entities().filter((o) => o !== e && o.health > 0 && !witherIsUndead(o))).map((o) => m.ai.brain(o)).filter((b) => m.ai.overlaps(m, b, r, 4, r));
      if (!c.length) return false;
      this.target = c.reduce((a, b) => (m.distSq(b) < m.distSq(a) ? b : a));
      return true;
    }
    startExecuting() { m.attackTarget = this.target; super.startExecuting(); }
  }
  m.tasks.add(0, new Swim(m));
  m.tasks.add(2, new ArrowAttack(m, 1.0, 40, 40, 20));
  m.tasks.add(5, new Wander(m, 1.0));
  m.tasks.add(6, new WatchClosest(m, 8));
  m.tasks.add(7, new LookIdle(m));
  m.targets.add(1, new HurtByTarget(m, false));
  m.targets.add(2, new NearestNonUndead());
  const gate = (obj, name) => { const base = obj[name].bind(obj); obj[name] = (...a) => ((e.invul ?? 0) > 0 ? undefined : base(...a)); };
  gate(m.tasks, "tick"); gate(m.targets, "tick"); gate(m.navigator, "onUpdateNavigation");
  m.updateAITick = () => witherAITick(m);
}

// Installs the type and the EntityWorld hooks: the record, spawnWither (BlockSkull.func_149965_a), fire, fall and drown immunity, the
// attackEntityFrom rules, and the skulls' world tick.
export function installWither(EntityWorld) {
  ENTITY_TYPES.wither = { health: WITHER.maxHealth, width: WITHER.width, height: WITHER.height, movement: WITHER.speed, ai: { wander: 1, chase: 1 }, damage: 0, drop: 0 };
  HOSTILE.add("wither");
  const P = EntityWorld.prototype;
  Object.defineProperty(P, "skulls", { get() { return (this._skulls ??= new WitherSkulls(this)); }, configurable: true });
  const around = (name, wrapper) => { const base = P[name]; P[name] = function (...args) { return wrapper.call(this, base, ...args); }; };
  around("create", function (base, type, ...rest) {
    const e = base.call(this, type, ...rest);
    if (type === "wither") { e.invul = 0; e.followRange = WITHER.followRange; e.rotationYaw = e.renderYawOffset = 0; }
    return e;
  });
  // BlockSkull.func_149965_a: the spawned wither starts with Invul 220 and a third of its health, facing along the T.
  P.spawnWither = function (x, y, z, yaw = 0) {
    const e = this.create("wither", x, y, z);
    e.rotationYaw = e.renderYawOffset = yaw;
    e.yaw = (-yaw * Math.PI) / 180;
    e.invul = WITHER.invulStart;
    e.health = startHealth();
    this.entities.push(e);
    return e;
  };
  around("attackEntityFrom", function (base, e, amount, source = {}) {
    if (e?.type !== "wither") return base.call(this, e, amount, source);
    const name = source.name ?? "generic", a = source.shooter ?? source.attacker; // DamageSource.getEntity: an arrow's shooter
    if (name === "drown" || (e.invul ?? 0) > 0) return false;
    if (armored(e.health) && (source.arrow || name === "arrow")) return false;
    if (a && typeof a === "object" && !source.player && witherIsUndead(a)) return false;
    const s = witherState(e);
    if (s.bv <= 0) s.bv = WITHER.blockBreakCooldown;
    s.bu[0] += 3; s.bu[1] += 3;
    return base.call(this, e, amount, source);
  });
  // Fire: EntityWorld.burn treats the wither as fire-immune (xc constructor); the counter is 0 after every update (sv.C extinguishes), then the move tail's rest or raise.
  around("fall", function (base, e, d) { return e?.type === "wither" ? undefined : base.call(this, e, d); });
}
