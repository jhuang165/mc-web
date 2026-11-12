// EntityDragon (xa) inside EntityWorld (entities.js). The rules are in dragon.js (verified against the original classes);
// this file is the adapter: the per-tick host, part picking, damage routing, save/restore and the spawn helper.
//
// Hooks in the shared files (each one line): entities.js loop (`dragonUpdate`), entityHit (`dragonHit`), `pushable`, and the
// installDragonMobs call; commands.js (/summon EnderDragon); region-export.js (name map); mob-renderer.js (rig dispatch).
import { ENTITY_TYPES, nearAngle, livingSoundRoll } from "./entities.js";
import { legacyBodyTurn } from "./squid-bat.js";
import { JavaRandom } from "./lighting.js";
import { fromOriginal } from "./block-registry.js";
import { gameRule } from "./game-rules.js";
import { createExitPortal } from "./exit-portal.js";
import {
  DRAGON_MAX_HEALTH, DRAGON_WIDTH, DRAGON_HEIGHT, DRAGON_SOUNDS, createDragonState, dragonTick, deathTick, attackFromPart,
  livingHurt, partBox,
} from "./dragon.js";

export const ENDER_DRAGON = "ender_dragon";
export const ENDER_DRAGON_TYPE = Object.freeze({ health: DRAGON_MAX_HEALTH, width: DRAGON_WIDTH, height: DRAGON_HEIGHT, movement: Math.fround(0.1), ai: {}, drop: 0 }); // movementSpeed 0.1 (probed attributes3 `speed`); the dragon moves by its own code
const OBSIDIAN = 22, BEDROCK = 11, END_STONE = 152;
const RANDOMS = new WeakMap();
const rngOf = (e) => { let r = RANDOMS.get(e); if (!r) RANDOMS.set(e, (r = new JavaRandom(Math.floor(Math.random() * 2 ** 48)))); return r; };
export const setDragonRandom = (e, r) => RANDOMS.set(e, r);

const meets = (a, b) => a[0] < b[3] && a[3] > b[0] && a[1] < b[4] && a[4] > b[1] && a[2] < b[5] && a[5] > b[2];
const rayBox = (o, d, b, reach) => {
  let near = 0, far = reach;
  for (const [axis, i] of [["x", 0], ["y", 1], ["z", 2]]) {
    if (Math.abs(d[axis]) < 1e-8) { if (o[axis] < b[i] || o[axis] > b[i + 3]) return null; continue; }
    const p = (b[i] - o[axis]) / d[axis], q = (b[i + 3] - o[axis]) / d[axis];
    near = Math.max(near, Math.min(p, q));
    far = Math.min(far, Math.max(p, q));
    if (far < near) return null;
  }
  return near <= reach ? near : null;
};

// The player's ray against the seven part boxes (Entity.canBeCollidedWith is false for the dragon; its parts are the targets).
// The nearest part is remembered for the attack that follows.
export function dragonHit(origin, dir, e, reach) {
  const s = e.dragon;
  if (!s) return null;
  let best = null;
  s.parts.forEach((p, i) => {
    const d = rayBox(origin, dir, p.box, reach);
    if (d !== null && (best === null || d < best.d)) best = { d, i };
  });
  if (!best) return null;
  s.lastPart = best.i;
  return best.d;
}

// The world as dragon.js's host sees it. `ctx` = { player, survival } of the current tick.
export function dragonHost(mobs, e, ctx = {}) {
  const world = mobs.world, edits = [], rand = rngOf(e), p = ctx.player, survival = ctx.survival;
  const boxOf = (o) => { const t = ENTITY_TYPES[o.type]; return [o.x - t.width / 2, o.y, o.z - t.width / 2, o.x + t.width / 2, o.y + t.height, o.z + t.width / 2]; };
  const at = { x: e.x, y: e.y, z: e.z };
  const host = {
    rand,
    edits,
    get players() { return p && survival?.health > 0 ? [{ x: p.x, z: p.z, minY: p.y }] : []; },
    crystals: (box) => mobs.entities.filter((c) => c.type === "ender_crystal" && meets(boxOf(c), box)).map((c) => ({ x: c.x, y: c.y, z: c.z, dead: c.health <= 0 || (c.death ?? 0) >= 20, entity: c })),
    living(box) {
      const out = [];
      for (const o of mobs.entities) {
        if (o === e || o.type === ENDER_DRAGON || o.type === "ender_crystal" || o.health <= 0 || !ENTITY_TYPES[o.type] || !meets(boxOf(o), box)) continue;
        out.push({ living: true, x: o.x, z: o.z, push: (x, y, z) => { o.vx += x; o.vy += y; o.vz += z; }, hurt: (d) => mobs.attackEntityFrom(o, d, { from: { x: e.x, z: e.z }, attacker: e, name: "mob" }) });
      }
      if (p && survival && survival.health > 0 && meets([p.x - 0.3, p.y, p.z - 0.3, p.x + 0.3, p.y + 1.8, p.z + 0.3], box)) {
        out.push({
          living: true, x: p.x, z: p.z,
          // main.js does not consume `dragonPush` yet (see dragon.md): the player's velocity impulse.
          push: (x, y, z) => mobs.events.push({ dragonPush: { x, y, z } }),
          hurt: (d) => survival.scaledDamage(d, "the Ender Dragon", { source: "mob", from: e }),
        });
      }
      return out;
    },
    blockKind(x, y, z) {
      const b = world.get(x, y, z);
      return b === 0 ? 0 : b === OBSIDIAN || b === END_STONE || b === BEDROCK ? 1 : 2;
    },
    removeBlock(x, y, z) {
      if (!world.set(x, y, z, 0, true, 0)) return false;
      edits.push([x, y, z]);
      return true;
    },
    griefing: gameRule("mobGriefing"),
    particle: () => {}, // WorldServer's accessor (mp.a(String, 6 doubles), bytecode-read) returns at once: the particles are the client copy's (entity-tracker.js)
    orb: (amount) => mobs.events.push({ xp: amount, position: at }),
    worldEvent: (id, x, y, z) => { if (id === DRAGON_SOUNDS.deathEvent) mobs.events.push({ sound: "mob.enderdragon.end", volume: DRAGON_SOUNDS.volume, pitch: 1, position: { x, y, z } }); },
    portal(x, z) {
      createExitPortal({
        setBlock(bx, by, bz, id) {
          const m = id === 0 ? { id: 0, meta: 0 } : fromOriginal(id, 0);
          if (m && (world.get(bx, by, bz) !== m.id || world.getMeta(bx, by, bz) !== m.meta) &&
              world.set(bx, by, bz, m.id, true, m.meta)) edits.push([bx, by, bz]);
        },
      }, x, z);
    },
    onHurtSound: () => mobs.events.push({ sound: DRAGON_SOUNDS.hit, volume: DRAGON_SOUNDS.volume, pitch: 1, position: at }),
    hurt: (d, a, source, h) => livingHurt(d, a, source, h),
  };
  return host;
}

// EntityLiving.onEntityUpdate and EntityDragon.onLivingUpdate for one server tick.
export function dragonUpdate(mobs, e, player, survival) {
  const s = e.dragon ?? (e.dragonSave ? restoreState(e) : createDragonState(e));
  const host = dragonHost(mobs, e, { player, survival });
  e.age = (e.age || 0) + 1;
  e.ticksExisted = e.age;
  // EntityLivingBase.onEntityUpdate: hurtTime and hurtResistantTime count down.
  if (e.hurtTime > 0) e.hurtTime--;
  if (e.hurtResist > 0) e.hurtResist--;
  e.hurt = e.hurtTime || 0;
  let done = false;
  if (e.health <= 0 && e.death === undefined) e.death = 0; // alive for the 200 tick death sequence (the end-of-tick filter keeps death < 20)
  if (e.health <= 0) done = deathTick(e, host);
  else {
    // EntityLiving.onEntityUpdate: the growl, rand.nextInt(1000) < livingSoundTime++ from 0 (livingSoundRoll), then livingSoundTime = -80 and playLivingSound draws the pitch
    // (getSoundPitch, two nextFloat); b51ft executed: a growl at tick 37 of a seeded flight moves every later draw.
    const rand = rngOf(e);
    if (livingSoundRoll(e, rand, 80)) {
      const pitch = Math.fround(Math.fround(Math.fround(rand.nextFloat() - rand.nextFloat()) * Math.fround(0.2)) + 1);
      mobs.events.push({ sound: DRAGON_SOUNDS.growl, volume: DRAGON_SOUNDS.volume, pitch, position: { x: e.x, y: e.y, z: e.z } });
    }
  }
  // The wing flap sound and the death puffs belong to the client copy (entity-tracker.js ClientEntity.dragonUpdate); the server's spawnParticle is a no-op.
  dragonTick(e, host);
  e.yaw = (-e.rotationYaw * Math.PI) / 180;
  // xa.e ends with renderYawOffset = rotationYaw (the death spin too) and leaves rotationYawHead alone; EntityLivingBase.onUpdate then runs the legacy turn (sv.f, the dragon is not
  // isAIEnabled) over this tick's travel: the body eases toward the flight direction within 75 degrees of the yaw (b51ft executed, xa.h() over 5 flights)
  e.renderYawOffset = e.rotationYaw;
  legacyBodyTurn(e, e.x - e.px, e.z - e.pz);
  e.prevRotationYaw = nearAngle(e.prevRotationYaw, e.rotationYaw);
  e.prevRenderYawOffset = nearAngle(e.prevRenderYawOffset, e.renderYawOffset);
  if (host.edits.length) mobs.events.push({ blockEdit: host.edits });
  if (done) { e.death = 20; e.health = 0; e.dragonGone = true; }
}

function restoreState(e) {
  const saved = e.dragonSave ?? {};
  const s = createDragonState(e);
  for (const k of ["tx", "ty", "tz", "ryv", "deathTicks", "anim", "prevAnim"]) if (Number.isFinite(saved[k])) s[k] = saved[k];
  delete e.dragonSave;
  return s;
}

// Part of the dragon a damage source reaches: the part the player aimed at this tick, else the nearest to the source, else the
// body for an explosion (the original hits every part inside the blast), else the head.
function partFor(e, source) {
  const s = e.dragon;
  if (Number.isInteger(source.part) && source.part >= 0 && source.part < s.parts.length) return source.part; // an explosion tests every part itself
  if (source.player && s.lastPart !== undefined) return s.lastPart;
  if (source.from) {
    let best = 0, bd = Infinity;
    s.parts.forEach((p, i) => { const d = (p.x - source.from.x) ** 2 + (p.z - source.from.z) ** 2; if (d < bd) { bd = d; best = i; } });
    return best;
  }
  return source.name === "explosion" ? 1 : 0;
}

export function installDragonMobs(EntityWorld) {
  ENTITY_TYPES[ENDER_DRAGON] = ENDER_DRAGON_TYPE;
  const P = EntityWorld.prototype;
  const around = (name, wrapper) => { const base = P[name]; P[name] = function (...args) { return wrapper.call(this, base, ...args); }; };
  around("attackEntityFrom", function (base, e, amount, source = {}) {
    if (e?.type !== ENDER_DRAGON) return base.call(this, e, amount, source);
    if (!this.entities.includes(e) || !e.dragon || e.health <= 0) return false;
    const name = source.name ?? "generic";
    // Only parts take hits (xa.a(ro, F) is a no-op): fire, falling and the like never reach the dragon.
    if (!source.player && name !== "explosion" && !source.attacker) return false;
    const idx = partFor(e, source), host = dragonHost(this, e, { player: this.ai?.player, survival: this.ai?.survival });
    if (source.player) e.recentlyHit = 100;
    return attackFromPart(e, idx, { player: !!source.player, explosion: name === "explosion" }, amount, host);
  });
  around("serialize", function (base) {
    const out = base.call(this);
    for (const saved of out) {
      if (saved.type !== ENDER_DRAGON) continue;
      const s = this.entities.find((e) => e.id === saved.id)?.dragon;
      delete saved.dragon;
      if (s) saved.dragonSave = { tx: s.tx, ty: s.ty, tz: s.tz, ryv: s.ryv, deathTicks: s.deathTicks, anim: s.anim, prevAnim: s.prevAnim };
      delete saved.talk;
    }
    return out;
  });
  around("restore", function (base, e, opts) {
    const out = base.call(this, e, opts);
    if (out && out.type === ENDER_DRAGON) { out.dragonSave = e.dragonSave; delete out.dragon; }
    return out;
  });
}

// ChunkProviderEnd.populate (chunk 0,0): one dragon at (0, 128, 0) with a random heading, unless one lives already.
export function spawnDragonIfAbsent(world, mobs, random = Math.random) {
  if (mobs.entities.some((e) => e.type === ENDER_DRAGON && (e.health > 0 || !e.dragonGone))) return null;
  const e = mobs.create(ENDER_DRAGON, 0, 128, 0);
  const yaw = Math.fround(random() * 360);
  for (const k of ["rotationYaw", "prevRotationYaw", "renderYawOffset", "prevRenderYawOffset", "rotationYawHead", "prevRotationYawHead"]) e[k] = yaw;
  e.yaw = (-yaw * Math.PI) / 180;
  createDragonState(e);
  mobs.entities.push(e);
  return e;
}
export { partBox };
