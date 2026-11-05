// EntityBlaze (xx) and EntityGhast (yd) inside EntityWorld (entities.js): the per-tick update, fire immunity, the fireball launches, the
// hurt rules, the task list and the player's deflecting punch. The pure rules are in blaze-ghast.js (replayed against
// public/research/blaze-ghast-reference.json); the fireballs in flight are fireballs.js. entities.js calls blazeUpdate, ghastUpdate,
// fireballMobTalk and installFireballMobs; ai.js calls buildBlazeGhastTasks.
import { ENTITY_TYPES, HOSTILE, moveEntity, entityRandom, livingSoundRoll, actorCollides } from "./entities.js";
import { JavaRandom } from "./java-random.js";
import { mhSin, mhCos } from "./lighting.js";
import { Fireballs } from "./fireballs.js";
import {
  BLAZE, GHAST, blazeState, blazeAttack, blazeHover, ghastState, ghastStep, ghastPitch, lookVector, HURT_SOUNDS,
} from "./blaze-ghast.js";
const f = Math.fround;
export const isFireballMob = (e) => e.type === "blaze" || e.type === "ghast";
// Level events of RenderGlobal.playAuxSFX (bma) at the block of the entity, centred: the sound, its volume, pitch (rand - rand) * 0.2 + 1.
function levelEvent(m, e, sound, volume) {
  m.worldRandom ??= new JavaRandom(Math.floor(Math.random() * 2 ** 48));
  m.events.push({ sound, volume, pitch: ghastPitch(m.worldRandom), position: { x: Math.floor(e.x) + 0.5, y: Math.floor(e.y) + 0.5, z: Math.floor(e.z) + 0.5 } });
}
const wet = (m, e, t) => e.inWater || !!m.wet?.(e, t.height);

// EntityLiving.onEntityUpdate's roll with the 80 tick interval; the blaze breathes at volume 1, the ghast moans at volume 10.
export function fireballMobTalk(m, e) {
  const rand = entityRandom(e);
  if (!livingSoundRoll(e, rand, 80)) return;
  const sounds = e.type === "blaze" ? BLAZE : GHAST, pitch = f(f(f(rand.nextFloat() - rand.nextFloat()) * f(0.2)) + 1);
  m.events.push({ sound: sounds.sounds.living, volume: e.type === "blaze" ? BLAZE.volume : GHAST.volume, pitch, position: { x: e.x, y: e.y, z: e.z } });
}

// The target as the rules read it: the player (the only creature a blaze or ghast targets), its feet and height.
const playerView = (p) => ({ x: p.x, minY: p.y, z: p.z, height: p.height });

// EntityBlaze.onLivingUpdate (xx.e) and updateEntityActionState's attack (xx.a(sa, F)), before the walk: the hover push, the wet damage, the
// client's crackle and smoke, the volley. The walk then moves it with its AI (buildBlazeGhastTasks).
export function blazeUpdate(m, e, t) {
  const rand = entityRandom(e), s = (e.blaze ??= blazeState()), brain = m.ai.brain(e), p = m.ai.player, survival = m.ai.survival;
  const view = brain.attackTarget, target = view?.isPlayer && p?.alive && !survival.creative ? p : null;
  if (!target && view) brain.attackTarget = null;
  // Client half: fire.fire one time in 24 at 1 + rand volume, two largesmoke puffs a tick.
  if (rand.nextInt(24) === 0) m.events.push({ sound: BLAZE.crackleSound, volume: f(1 + rand.nextFloat()), pitch: f(f(rand.nextFloat() * f(0.7)) + f(0.3)), position: { x: e.x + 0.5, y: e.y + 0.5, z: e.z + 0.5 } });
  for (let i = 0; i < 2; i++) m.fx?.spawn("largesmoke", e.x + (rand.nextDouble() - 0.5) * t.width, e.y + rand.nextDouble() * t.height, e.z + (rand.nextDouble() - 0.5) * t.width, 0, 0, 0);
  if (wet(m, e, t)) { m.hazard(e, 1, "drown"); if (e.health <= 0) return; }
  e.vy = blazeHover(s, rand, { y: e.y, eye: f(t.height * f(0.85)), vy: e.vy }, target ? { y: target.y, eye: target.eyeHeight ?? 1.62 } : null, { onGround: !!e.onGround });
  if (s.attackTime > 0) s.attackTime--;
  s.hasAttacked = false;
  if (!target) { e.blazeBurning = false; return; }
  if (!brain.canSee(view)) return;
  const distance = f(Math.sqrt((target.x - e.x) ** 2 + (target.y - e.y) ** 2 + (target.z - e.z) ** 2)), out = blazeAttack(s, rand, e, playerView(target), distance);
  e.blazeBurning = s.burning;
  if (out.yaw !== null) e.rotationYaw = out.yaw;
  if (out.melee) m.hitPlayer(e, survival);
  if (out.shot) {
    m.fireballs.launch({ large: false, owner: e, x: out.shot.x, y: out.shot.y, z: out.shot.z, dx: out.shot.dx, dy: out.shot.dy, dz: out.shot.dz });
    levelEvent(m, e, BLAZE.shootSound, BLAZE.shootVolume);
  }
}

// EntityGhast.updateEntityActionState (yd.bq) and EntityFlying.moveEntityWithHeading (sr.e): the wander waypoint, the charge-up, the
// fireball, then motion with friction 0.91 (0.8 in water, 0.546 on the ground).
export function ghastUpdate(m, e, t) {
  const rand = entityRandom(e), s = (e.ghast ??= ghastState()), brain = m.ai.brain(e), p = m.ai.player, survival = m.ai.survival, world = m.world;
  s.explosionPower = e.explosionPower ?? 1;
  if (Math.abs(e.vx) < 0.005) e.vx = 0;
  if (Math.abs(e.vy) < 0.005) e.vy = 0;
  if (Math.abs(e.vz) < 0.005) e.vz = 0;
  brain.despawnEntity();
  const live = () => p?.alive && !survival.creative,
    view = () => p && { x: p.x, minY: p.y, z: p.z, height: p.height, distSq: (p.x - e.x) ** 2 + (p.y - e.y) ** 2 + (p.z - e.z) ** 2 },
    out = ghastStep(s, rand, e, {
      // yd.a(DDDD): the box swept along the way to the waypoint, one block at a time.
      pathClear(wx, wy, wz, d) {
        const dx = (wx - e.x) / d, dy = (wy - e.y) / d, dz = (wz - e.z) / d;
        for (let i = 1; i < d; i++) if (actorCollides(world, e.x + dx * i, e.y + dy * i, e.z + dz * i, t.width, t.height)) return false;
        return true;
      },
      findPlayer: () => (live() && view().distSq < GHAST.targetRange * GHAST.targetRange ? p : null),
      target: () => (live() ? view() : null),
      canSee: () => brain.canSee(p),
      event: (id) => levelEvent(m, e, id === GHAST.warnEvent ? GHAST.chargeSound : GHAST.fireSound, GHAST.eventVolume),
    });
  e.charging = out.charging;
  e.rotationYaw = e.renderYawOffset = e.rotationYawHead = out.yaw;
  if (out.fireball) {
    const look = lookVector(out.yaw, 0, mhSin, mhCos);
    m.fireballs.launch({ large: true, owner: e, x: e.x + look[0] * 4, y: e.y + f(t.height / 2) + 0.5, z: e.z + look[2] * 4, dx: out.fireball.dx, dy: out.fireball.dy, dz: out.fireball.dz, power: out.fireball.power });
  }
  const hooks = { hurt: (source, points) => m.hazard(e, points, source), wet: false, fizz() {} };
  moveEntity(world, e, t.width, t.height, e.vx, e.vy, e.vz, undefined, hooks);
  const friction = e.inWater ? 0.8 : e.onGround ? f(f(0.6) * f(0.91)) : f(0.91);
  e.vx *= friction; e.vy *= friction; e.vz *= friction;
  m.push(e, t);
  m.turnBody(e);
  m.swingLimbs(e);
  e.yaw = (-e.rotationYaw * Math.PI) / 180;
}

// Tasks for the blaze (legacy EntityCreature AI in 1.7.10; approximated with the task list, see public/research/blaze-ghast.md): walk
// towards the target until it is in range and seen (hasAttacked stops the walk), else wander; the nearest visible player (16) and the
// attacker are the targets. The ghast has no tasks. `K` is ai.js's task classes.
export function buildBlazeGhastTasks(m, K) {
  const { AttackOnCollide, Wander, WatchClosest, LookIdle, NearestAttackable, HurtByTarget } = K;
  if (m.e.type !== "blaze") return;
  class Approach extends AttackOnCollide {
    // AttackOnCollide's movement half only: the blaze's melee is blazeAttack's (once a tick, 6 damage after a 20 tick delay).
    updateTask() {
      if (m.e.blaze?.hasAttacked) { m.navigator.clearPathEntity(); return; }
      const t = m.attackTarget, r = m.rand, d = m.distSq(t);
      m.lookHelper.setLookPositionWithEntity(t, 30, 30);
      this.delay--;
      if (m.canSee(t) && this.delay <= 0) {
        this.delay = 4 + r.nextInt(7) + (d > 1024 ? 10 : d > 256 ? 5 : 0);
        if (!m.navigator.tryMoveToEntityLiving(t, this.speed)) this.delay += 15;
      }
    }
  }
  m.tasks.add(1, new Approach(m, 1.0, "player"));
  m.tasks.add(2, new Wander(m, 1.0));
  m.tasks.add(3, new WatchClosest(m, 8));
  m.tasks.add(3, new LookIdle(m));
  m.targets.add(1, new HurtByTarget(m, false));
  m.targets.add(2, new NearestAttackable(m));
}

// Installs the two types and the EntityWorld hooks: fire immunity (Entity.isImmuneToFire), no fall damage (EntityBlaze.fall, EntityGhast is
// an EntityFlying whose fall is empty), the ghast's death to a player's own fireball (yd.a(ro, F)), the hurt sound names, and the
// player's pick and punch of a large fireball (EntityFireball.canBeCollidedWith / attackEntityFrom).
export function installFireballMobs(EntityWorld) {
  ENTITY_TYPES.blaze = { health: BLAZE.health, width: BLAZE.width, height: BLAZE.height, movement: BLAZE.speed, ai: { wander: 1, chase: 1 }, damage: BLAZE.attackDamage, drop: 0 };
  ENTITY_TYPES.ghast = { health: GHAST.health, width: GHAST.width, height: GHAST.height, movement: 0.25, ai: {}, drop: 0 };
  HOSTILE.add("blaze");
  HOSTILE.add("ghast");
  const P = EntityWorld.prototype;
  Object.defineProperty(P, "fireballs", { get() { return (this._fireballs ??= new Fireballs(this)); }, configurable: true });
  const around = (name, wrapper) => { const base = P[name]; P[name] = function (...args) { return wrapper.call(this, base, ...args); }; };
  around("attackEntityFrom", function (base, e, amount, source = {}) {
    if (!e || !isFireballMob(e)) return base.call(this, e, amount, source);
    const name = source.name ?? "generic";
    // Entity.isImmuneToFire: onFire, inFire and lava never hurt.
    if (name === "onFire" || name === "inFire" || name === "lava") return false;
    // EntityGhast.attackEntityFrom: a fireball of a player (a deflected one) deals 1000.
    if (e.type === "ghast" && name === "fireball" && source.player) amount = 1000;
    const events = this.events.length, client = this.clientSounds?.length ?? 0, out = base.call(this, e, amount, source);
    for (const list of [[this.events, events], [this.clientSounds, client]])
      if (list[0]) for (const x of list[0].slice(list[1])) if (x.sound === "mob." + e.type + ".hurt") x.sound = HURT_SOUNDS[e.type];
    return out;
  });
  around("burn", function (base, e, t) {
    const out = base.call(this, e, t);
    if (e && isFireballMob(e)) { e.fire = 0; e.burn = 0; }
    return out;
  });
  around("fall", function (base, e, distance) { return e && isFireballMob(e) ? undefined : base.call(this, e, distance); });
  // A player's ray meets a large fireball (box grown by 1.0) before a block or mob: the fireball is then the aimed entity.
  around("pick", function (base, origin, dir, reach, wallDistance = reach) {
    const mob = base.call(this, origin, dir, reach, wallDistance), ball = this._fireballs?.list.length ? this._fireballs.pick(origin, dir, reach, mob ? Math.min(wallDistance, mob.distance) : wallDistance) : null;
    if (!ball) return mob;
    ball.entity.look = [dir.x, dir.y, dir.z];
    return ball;
  });
  around("attack", function (base, e, ...rest) {
    if (e?.type !== "fireball") return base.call(this, e, ...rest);
    return this.fireballs.punch(e, e.look ?? [0, 0, 1]);
  });
}
