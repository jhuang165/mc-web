// EntityBlaze (xx) and EntityGhast (yd) inside EntityWorld (entities.js): the per-tick update, fire immunity, the fireball launches, the
// hurt rules, the task list and the player's deflecting punch. The pure rules are in blaze-ghast.js (replayed against
// public/research/blaze-ghast-reference.json); the fireballs in flight are fireballs.js. entities.js calls blazeUpdate, ghastUpdate,
// fireballMobTalk and installFireballMobs; ai.js calls buildBlazeGhastTasks.
import { ENTITY_TYPES, HOSTILE, moveEntity, entityRandom, livingSoundRoll, actorCollides } from "./entities.js";
import { JavaRandom } from "./java-random.js";
import { mhSin, mhCos } from "./lighting.js";
import { Fireballs } from "./fireballs.js";
import { creatureActionState } from "./silverfish.js";
import { PathFinder } from "./pathfinding.js";
import {
  BLAZE, GHAST, blazeState, blazeAttack, blazeHover, ghastState, ghastStep, ghastPitch, lookVector, HURT_SOUNDS,
} from "./blaze-ghast.js";
const f = Math.fround;
export const isFireballMob = (e) => e.type === "blaze" || e.type === "ghast";
// Level events of RenderGlobal.playAuxSFX (bma) at the block of the entity, centred: the sound, its volume, pitch (rand - rand) * 0.2 + 1.
function levelEvent(m, e, sound, volume) {
  m.worldRandom ??= new JavaRandom(Math.floor(Math.random() * 2 ** 48));
  m.events.push({ sound, volume, pitch: ghastPitch(m.worldRandom), position: { x: Math.trunc(e.x) + 0.5, y: Math.trunc(e.y) + 0.5, z: Math.trunc(e.z) + 0.5 } }); // playAuxSFXAtEntity(null, id, (int) x, (int) y, (int) z): casts truncate
}
const wet = (m, e, t) => e.inWater || !!m.wet?.(e, t.height);

// EntityLiving.onEntityUpdate's roll with the 80 tick interval; the blaze breathes at volume 1, the ghast moans at volume 10.
// Entity.getDistanceToEntity (sa.e): each axis narrowed to a float, squared and summed in float, then MathHelper.sqrt_float (executed in fireballs-b41-reference.json: the blaze's shot spread rounds differently otherwise).
const floatDistance = (dx, dy, dz) => { const x = f(dx), y = f(dy), z = f(dz); return f(Math.sqrt(f(f(f(x * x) + f(y * y)) + f(z * z)))); };
export function fireballMobTalk(m, e) {
  const rand = entityRandom(e);
  if (!livingSoundRoll(e, rand, 80)) return;
  const sounds = e.type === "blaze" ? BLAZE : GHAST, pitch = f(f(f(rand.nextFloat() - rand.nextFloat()) * f(0.2)) + 1);
  m.events.push({ sound: sounds.sounds.living, volume: e.type === "blaze" ? BLAZE.volume : GHAST.volume, pitch, position: { x: e.x, y: e.y, z: e.z } });
}

// The target as the rules read it: the player or a mob that hurt the blaze (a ghast targets only the player), its feet and height.
const playerView = (p) => ({ x: p.x, minY: p.y, z: p.z, height: p.height });

// EntityBlaze.onLivingUpdate (xx.e), before the walk: the wet damage, the hover countdown and push (toward entityToAttack, the target of
// the previous action state), the client's crackle (one in 24) and the 0.6 fall damping, then the two largesmoke puffs. In that draw order.
// The action state itself (target, path, the volley) is blazeThink.
export function blazeUpdate(m, e, t, corpse = false) {
  const rand = entityRandom(e), s = (e.blaze ??= blazeState()), st = m.silverfishState(e), p = m.ai.player;
  if (st.target && (st.target === p ? !(p?.alive && !m.ai.survival.creative) : st.target.alive === false)) st.target = null; // the player, or a mob that hurt it (EntityMob.attackEntityFrom)
  const target = st.target;
  if (!corpse && wet(m, e, t)) { m.hazard(e, 1, "drown"); if (e.health <= 0) return; }
  e.vy = blazeHover(s, rand, { y: e.y, eye: f(t.height * f(0.85)), vy: e.vy }, target ? { y: target.y, eye: target.eyeHeight ?? 1.62 } : null, { onGround: !!e.onGround });
  // The crackle is EntityBlaze.onLivingUpdate's client half (isRemote: worldObj.playSound(posX + 0.5, posY + 0.5, posZ + 0.5, "fire.fire", ...)): a client-only sound at the blaze (entity-tracker.js), the draws stay.
  if (rand.nextInt(24) === 0) (m.clientSounds ??= []).push({ sound: BLAZE.crackleSound, volume: f(1 + rand.nextFloat()), pitch: f(f(rand.nextFloat() * f(0.7)) + f(0.3)), position: e, clientOnly: true, offset: 0.5 });
  for (let i = 0; i < 2; i++) { // the six nextDouble draws happen with or without a particle system
    const x = e.x + (rand.nextDouble() - 0.5) * t.width, y = e.y + rand.nextDouble() * t.height, z = e.z + (rand.nextDouble() - 0.5) * t.width;
    m.fx?.spawn("largesmoke", x, y, z, 0, 0, 0);
  }
}

// EntityBlaze.updateEntityActionState: EntityCreature.updateEntityActionState (td.bq, silverfish.js creatureActionState) with xx.a(sa, F) as
// its attackEntity, EntityMob.findPlayerToAttack (closest vulnerable player within 16, seen), getBlockPathWeight 0.5 - brightness and
// EntityMob.onLivingUpdate's entityAge += 2 (the blaze's getBrightness is 1.0). hasAttacked (set by the attack in range) skips the
// re-path and wander and strafes around the target. blaze-ghast.md: bytecode-read td.bq / xx.e, replayed against legacy-ai-reference.json.
export function blazeThink(m, e, t, aiMoveSpeed) {
  const brain = m.ai.brain(e), p = m.ai.player, survival = m.ai.survival, st = m.silverfishState(e), s = (e.blaze ??= blazeState());
  const rand = entityRandom(e), path = (make) => {
    if (!brain.navigator.spend()) return null;
    const n = brain.navigator; // td.bq asks World.getPathEntityToEntity / getEntityPathToXYZ with (openDoors true, breakDoors false, avoidWater false, canSwim true)
    return make(new PathFinder(n.world, true, false, false, true, { classify: n.classify, maxNodes: n.maxNodes }));
  };
  st.x = e.x; st.y = e.y; st.z = e.z; st.width = t.width; st.inWater = e.inWater; st.inLava = e.inLava;
  st.collidedH = e.collidedH; st.rotationYaw = e.rotationYaw; st.rotationPitch = e.rotationPitch || 0;
  st.speed = aiMoveSpeed(e, 1); st.jumping = !!e.jumping; /* EntityLivingBase.isJumping persists between ticks (the early action state leaves it unless in liquid) */ st.moveStrafing = e.moveStrafing || 0;
  st.moveForward = f(f(st.moveForward || 0) * f(0.98));
  if (s.attackTime > 0) s.attackTime--;
  st.entityAge += 2;
  brain.senseCache.clear();
  s.hasAttacked = false;
  const env = {
    rand, remote: false,
    closestPlayer: (me, range) => (p?.alive && (range < 0 || brain.distSq(p) < range * range) ? p : null),
    findPlayerToAttack: (me) => { const c = m.ai.closestVulnerablePlayer(me, BLAZE.followRange); return c && brain.canSee(c) ? c : null; },
    isAlive: (x) => (x === p ? !!p.alive : x.alive !== false),
    isCreative: (x) => x === p && !!survival.creative,
    eyeHeight: (x) => (x === st ? f(f(t.height) * f(0.85)) : x === p || x.isPlayer ? 1.62 : x.eyeHeight),
    boxMidY: (x) => x.y,
    canSee: (me, target) => brain.canSee(target),
    attackEntity: (me, target, d) => {
      const out = blazeAttack(s, rand, e, playerView(target), floatDistance(e.x - target.x, e.y - target.y, e.z - target.z)); // the blaze's range and spread use this float distance
      me.hasAttacked = s.hasAttacked;
      e.blazeBurning = s.burning;
      if (out.yaw !== null) st.rotationYaw = out.yaw;
      if (out.melee) { if (target === p) m.hitPlayer(e, survival); else if (target.e) m.hitMob(e, target.e); }
      if (out.shot) {
        m.fireballs.launch({ large: false, owner: e, x: out.shot.x, y: out.shot.y, z: out.shot.z, dx: out.shot.dx, dy: out.shot.dy, dz: out.shot.dz });
        levelEvent(m, e, BLAZE.shootSound, BLAZE.shootVolume);
      }
    },
    pathToEntity: (me, target, range) => path((fn) => fn.createEntityPathToEntity(brain, target, range)),
    pathToBlock: (me, x, y, z, range) => path((fn) => fn.createEntityPathToBlock(brain, x, y, z, range)),
    pathWeight: (me, x, y, z) => f(f(0.5) - m.ai.brightness(x, y, z)),
    setDead: () => m.ai.despawn(e),
  };
  creatureActionState(st, env);
  if (!st.target) e.blazeBurning = false;
  st.randomYaw = f(f(st.randomYaw || 0) * f(0.9));
  e.rotationYaw = st.rotationYaw; e.rotationPitch = st.rotationPitch;
  e.rotationYawHead = e.rotationYaw; // EntityLiving.onLivingUpdate without AI (sw.e): the action state, then rotationYawHead = rotationYaw (b50lb executed)
  e.moveForward = st.moveForward; e.moveStrafing = st.moveStrafing; e.jumping = st.jumping;
  e.yaw = (-e.rotationYaw * Math.PI) / 180;
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
      findPlayer: () => m.ai.closestVulnerablePlayer(e, GHAST.targetRange),
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
  const hooks = { living: true, hurt: (source, points) => m.hazard(e, points, source), wet: false, fizz() {} };
  moveEntity(world, e, t.width, t.height, e.vx, e.vy, e.vz, undefined, hooks);
  const friction = e.inWater ? 0.8 : e.onGround ? f(f(0.6) * f(0.91)) : f(0.91);
  e.vx *= friction; e.vy *= friction; e.vz *= friction;
  m.push(e, t);
  m.turnBody(e);
  m.swingLimbs(e);
  e.yaw = (-e.rotationYaw * Math.PI) / 180;
}

// The blaze and the ghast have no task list: the blaze runs EntityCreature's legacy flow (blazeThink) and the ghast its own (ghastUpdate).
// ai.js still calls this hook for every mob; it adds nothing.
export function buildBlazeGhastTasks() {}

// Installs the two types and the EntityWorld hooks: fire immunity (Entity.isImmuneToFire), no fall damage (EntityBlaze.fall, EntityGhast is
// an EntityFlying whose fall is empty), the ghast's death to a player's own fireball (yd.a(ro, F)), the hurt sound names, and the
// player's pick and punch of a large fireball (EntityFireball.canBeCollidedWith / attackEntityFrom).
export function installFireballMobs(EntityWorld) {
  ENTITY_TYPES.blaze = { health: BLAZE.health, width: BLAZE.width, height: BLAZE.height, movement: BLAZE.speed, ai: { wander: 1, chase: 1 }, damage: BLAZE.attackDamage, drop: 0 };
  ENTITY_TYPES.ghast = { health: GHAST.health, width: GHAST.width, height: GHAST.height, movement: 0.10000000149011612, ai: {}, drop: 0 };
  HOSTILE.add("blaze");
  HOSTILE.add("ghast");
  const P = EntityWorld.prototype;
  Object.defineProperty(P, "fireballs", { get() { return (this._fireballs ??= new Fireballs(this)); }, configurable: true });
  const around = (name, wrapper) => { const base = P[name]; P[name] = function (...args) { return wrapper.call(this, base, ...args); }; };
  around("attackEntityFrom", function (base, e, amount, source = {}) {
    if (!e || !isFireballMob(e)) return base.call(this, e, amount, source);
    const name = source.name ?? "generic";
    if (e.type === "blaze" && e.health > 0) this.silverfishState(e).entityAge = 0; // EntityLivingBase.attackEntityFrom (sv.a): entityAge = 0 before anything else counts
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
