// Gun-server combat (not 1.7.10): the guns mod's own trigger, reload, aim and knife rules (firing.js, melee.js, feel.js), run by the
// server for every connected player against the other players. Clients send button presses and their look; the server decides
// every shot, hit, damage and inventory change. Shared, DOM-free rules keep the browser's local prediction and the server in step.
import { GunController, fireShot, GLASS_BLOCKS } from '../mods/guns/firing.js';
import { MeleeController, coneTargets, strikeDamage } from '../mods/guns/melee.js';
import { Aim } from '../mods/guns/feel.js';
import { gunOf } from '../mods/guns/catalog.js';
import { meleeOf } from '../mods/guns/install.js';
import { carriedAmmo, takeAmmo } from '../mods/guns/ammo-box.js';
import { rayTraceBlocks } from '../projectiles.js';
import { PHYSICS } from '../world.js';

export const PLAYER_WIDTH = 0.6, PLAYER_HEIGHT = 1.8;
// A hit at or above 0.25 below the eye line is a headshot (hooks.js HEAD_MARGIN), with EntityPlayer's 1.62 eye height.
export const HEAD_FROM_FEET = PHYSICS.eye - 0.25;
export const REWIND_TICKS = 6, HISTORY_TICKS = 20;
const SNEAK_EYE = 0.08; // EntityPlayer.yOffset while sneaking lowers the eye
const EVENT_RANGE = 160; // blocks: shots and swings reach players this close

export const lookDir = (yaw, pitch) => [-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)];
export const eyeOf = (p, at = p.position) => [at.x, at.y + PHYSICS.eye - (p.input?.sneak ? SNEAK_EYE : 0), at.z];
export function playerBox(at) {
  const r = PLAYER_WIDTH / 2;
  return { min: [at.x - r, at.y, at.z - r], max: [at.x + r, at.y + PLAYER_HEIGHT, at.z + r] };
}
// Slab test: the distance along unit `dir` where the ray from `origin` enters `box`, or null past `max`.
export function rayBox(origin, dir, box, max = Infinity) {
  let near = 0, far = max;
  for (let i = 0; i < 3; i++) {
    if (Math.abs(dir[i]) < 1e-12) { if (origin[i] < box.min[i] || origin[i] > box.max[i]) return null; continue; }
    let a = (box.min[i] - origin[i]) / dir[i], b = (box.max[i] - origin[i]) / dir[i];
    if (a > b) [a, b] = [b, a];
    near = Math.max(near, a); far = Math.min(far, b);
    if (near > far) return null;
  }
  return near;
}

// Where every player stood at the end of each recent tick, so a shot is tested against what its shooter saw.
export class PositionHistory {
  constructor() { this.ticks = new Map(); }
  record(tick, players) {
    this.ticks.set(tick, new Map([...players].map(p => [p.id, { x: p.position.x, y: p.position.y, z: p.position.z }])));
    for (const t of this.ticks.keys()) if (t <= tick - HISTORY_TICKS) this.ticks.delete(t);
  }
  // The client draws other players between the last two ticks it received (presence.js), so `view` (its newest tick) maps to the
  // midpoint of view-1 and view. The rewind is clamped to REWIND_TICKS behind `now` and falls back to the live position.
  at(p, view, now) {
    if (!Number.isInteger(view)) return p.position;
    const v = Math.max(now - REWIND_TICKS, Math.min(now, view));
    const a = this.ticks.get(v - 1)?.get(p.id), b = this.ticks.get(v)?.get(p.id);
    if (a && b) return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 };
    return b ?? a ?? p.position;
  }
}

// One player's weapon state: the same controllers the browser runs for its own prediction.
export class PlayerCombat {
  constructor() { this.gun = new GunController(); this.melee = new MeleeController(); this.aim = new Aim(); this.queue = []; this.view = null; this.shots = 0; } // shots: fired since joining, for the client's ammo prediction
  reset() { this.gun = new GunController(); this.melee = new MeleeController(); this.aim = new Aim(); this.queue = []; }
}

// Inventory access as the gun hooks give it (hooks.js inventory()): loose rounds, then ammo boxes.
export function gunContext(survival) {
  const inv = survival.inventory;
  return { held: inv.held, slot: inv.current, creative: survival.creative, count: id => carriedAmmo(inv.main, id), take: (id, n) => takeAmmo(inv.main, id, n, (i, k) => inv.decr(i, k)) };
}

const round = v => Math.round(v * 1000) / 1000;
const HEAD_MARGIN = 0.25; // hooks.js
const mobId = e => Number(String(e.id).replace('mob-', ''));

// deps: { world, players() -> iterable, history, tick, random, pvp(), canBreak([x,y,z]), breakGlass([x,y,z]), damage(target, amount, source),
//   send(recipient, event), near(p, event), mobs (server-mobs.js ServerMobs, or null: targets(at, range) and hurt(mob, amount, attacker, from)) }
export function tickCombat(p, deps) {
  const c = p.combat, s = p.survival, ctx = gunContext(s);
  // Presses taken this tick, in order; a release that follows a press in the same batch waits until the trigger has been seen.
  let releaseTrigger = false;
  for (const a of c.queue.splice(0)) {
    if (a.look) { p.yaw = a.look.yaw; p.pitch = a.look.pitch; }
    if (a.view != null) c.view = a.view;
    if (p.dead) continue;
    const held = s.inventory.held, gun = gunOf(held), weapon = meleeOf(held);
    if (a.action === 'trigger') {
      if (a.down) { c.gun.press(); releaseTrigger = false; }
      else if (c.gun.trigger && !c.gun.spent) releaseTrigger = true;
      else c.gun.release();
    } else if (a.action === 'aim') c.aim.held = a.down && !!gun;
    else if (a.action === 'melee-left' || a.action === 'melee-right') { if (weapon || !a.down) c.melee.press(a.action === 'melee-left' ? 'left' : 'right', a.down); }
    else if (a.action === 'reload') c.gun.startReload(ctx);
    else if (a.action === 'mode') c.gun.toggleMode(held);
    else if (a.action === 'use') deps.use?.(p, a.down);
    else if (a.action === 'mine') deps.mine?.(p, a.down);
  }
  if (p.dead) { c.gun.release(); c.aim.held = false; c.melee.cancel(); return []; }
  const out = [];
  const weapon = meleeOf(s.inventory.held);
  for (const e of c.melee.tick(weapon, weapon ? `${s.inventory.current}/${weapon.id}` : null)) {
    if (e.type === 'swing') { p.swing = 6; deps.near(p, { type: 'swing', id: p.id, weapon: e.weapon.id, kind: e.kind, count: e.count }); }
    if (e.type === 'strike' || e.strike) out.push(...strike(p, e, deps));
  }
  for (const e of c.gun.tick(gunContext(s))) {
    if (e.type === 'shot') { c.shots++; out.push(...shoot(p, e.gun, deps)); }
    else if (e.type === 'reloaded' || e.type === 'shell' || e.type === 'draw') deps.near(p, { type: e.type, id: p.id, gun: e.gun.id });
  }
  if (releaseTrigger) c.gun.release();
  c.aim.tick(gunOf(s.inventory.held));
  if (!gunOf(s.inventory.held)) c.aim.held = false;
  return out;
}

function shoot(p, gun, deps) {
  const origin = eyeOf(p), dir = lookDir(p.yaw, p.pitch), view = p.combat.view;
  const targets = [...deps.players()].filter(o => o !== p && !o.dead).map(o => ({ player: o, box: playerBox(deps.history.at(o, view, deps.tick)) }));
  // The server's mobs, where they stand now (their own tick runs after the players', so this is what the shooter last saw).
  for (const t of deps.mobs?.targets(p.position) ?? []) targets.push(t);
  const moving = p.input.forward !== 0 || p.input.strafe !== 0;
  const result = fireShot(gun, {
    origin, dir, random: deps.random, sneaking: p.input.sneak, moving, aiming: p.combat.aim.progress,
    traceBlocks(start, end) { const hit = rayTraceBlocks(deps.world, start, end, true); return hit && { ...hit, id: deps.world.get(...hit.block) }; },
    pickEntity(o, d, max) {
      let best = null;
      for (const t of targets) { const at = rayBox(o, d, t.box, max); if (at !== null && (!best || at < best.distance)) best = { entity: t, distance: at }; }
      return best;
    },
    breakGlass(block) { if (GLASS_BLOCKS.has(deps.world.get(...block)) && deps.canBreak(block)) deps.breakGlass(block); },
    // A mob's head is its top 15% (hooks.js isHead: 0.85 of its height, less the same margin).
    isHead: (t, point) => point[1] >= t.box.min[1] + (t.mob ? (t.box.max[1] - t.box.min[1]) * 0.85 - HEAD_MARGIN : HEAD_FROM_FEET),
  });
  const hits = [];
  for (const { entity: t, amount, head } of result.hits) {
    if (t.mob) {
      if (deps.mobs.hurt(t.mob, amount, p, { gun: true, knockback: gun.knockback > 0 })) hits.push({ mob: t.mob, head, kill: t.mob.health <= 0 });
      continue;
    }
    const target = t.player;
    if (!deps.pvp() || target.dead || target.survival.health <= 0) continue;
    // Every bullet is a fresh hit: TaCZ skips the hurt-resistance window (hooks.js).
    target.survival.hurtTicks = 0;
    const dealt = deps.damage(target, amount, { attacker: p, kind: 'gun', weapon: gun, knockback: gun.knockback > 0 });
    if (dealt) hits.push({ target, head, kill: target.survival.health <= 0 });
  }
  // Grenades and rockets (TaCZ bullet "explosion") burst where the first pellet lands, as hooks.js does in single player: a block
  // hit just in front of the face, so the blast is not buried inside the wall.
  if (gun.explosion && result.impacts.length && deps.explode) {
    const first = result.impacts.reduce((a, b) => (b.distance < a.distance ? b : a));
    const at = first.entity ? first.point : first.point.map((v, i) => v - dir[i] * 0.3);
    deps.explode(p, at[0], at[1], at[2], gun.explosion.radius, { destroy: !!gun.explosion.destroy });
  }
  for (const h of hits) deps.send(p, h.mob ? { type: 'hit', mob: mobId(h.mob), head: h.head, kill: h.kill } : { type: 'hit', target: h.target.id, head: h.head, kill: h.kill });
  deps.near(p, {
    type: 'shot', id: p.id, gun: gun.id, silenced: !!gun.silenced, origin: origin.map(round),
    paths: result.paths.map(({ dir: d, distance }) => [...d.map(round), round(distance)]),
    impacts: result.impacts.map(i => i.entity ? { point: i.point.map(round), ...(i.entity.mob ? { mob: mobId(i.entity.mob) } : { player: i.entity.player.id }) } : { point: i.point.map(round), block: i.block, side: i.side ?? null }),
  }, false);
  return hits;
}

function strike(p, event, deps) {
  const attack = event.attack, weapon = event.weapon;
  if (attack.hitbox.type !== 'cone') return [];
  const origin = eyeOf(p), dir = lookDir(p.yaw, p.pitch), view = p.combat.view;
  // EntityPlayer.attackTargetEntityWithCurrentItem's critical hit: falling, not on the ground, not flying or in water.
  const critical = p.fallDistance > 0 && !p.grounded && !p.flying && !p.inWater;
  const amount = strikeDamage(weapon, attack) * (critical ? 1.5 : 1);
  if (!(amount > 0)) return [];
  const boxes = new Map(), others = [...deps.players()].filter(o => o !== p && !o.dead).map(o => {
    const at = deps.history.at(o, view, deps.tick), entity = { player: o, x: at.x, y: at.y, z: at.z, health: o.survival.health };
    boxes.set(entity, playerBox(at));
    return entity;
  });
  for (const t of deps.mobs?.targets(p.position, attack.hitbox.range + 4) ?? []) {
    const e = t.mob, entity = { mob: e, x: e.x, y: e.y, z: e.z, health: e.health };
    boxes.set(entity, t.box);
    others.push(entity);
  }
  const visible = (e, b) => {
    const clear = point => !rayTraceBlocks(deps.world, origin, point);
    if (clear([e.x, e.y, e.z])) return true;
    for (const x of [b.min[0], b.max[0]]) for (const y of [b.min[1], b.max[1]]) for (const z of [b.min[2], b.max[2]]) if (clear([x, y, z])) return true;
    return false;
  };
  const hits = [];
  for (const { entity: e } of coneTargets(others, origin, dir, attack.hitbox, entity => boxes.get(entity), visible)) {
    // MeleeItem validates the target against the attacker's position (melee-hooks.js).
    if (Math.hypot(e.x - p.position.x, e.y - p.position.y, e.z - p.position.z) > attack.hitbox.range) continue;
    if (e.mob) {
      // melee-hooks.js: the same fresh-hit threshold, then LivingEntity.knockback along the swing.
      const m = e.mob;
      if ((m.hurt ?? 0) < 10) m.hurt = 0;
      if (!deps.mobs.hurt(m, amount, p, { melee: true })) continue;
      const k = attack.knockback * (1 - (m.knockbackResistance ?? 0)), len = Math.hypot(dir[0], dir[2]);
      if (k > 0 && len > 1e-6) {
        m.vx = (m.vx ?? 0) / 2 + dir[0] / len * k; m.vz = (m.vz ?? 0) / 2 + dir[2] / len * k;
        if (m.onGround) m.vy = Math.min(0.4, (m.vy ?? 0) / 2 + k);
      }
      hits.push({ mob: m, head: false, kill: m.health <= 0 });
      continue;
    }
    const target = e.player;
    if (!deps.pvp()) continue;
    // LR Tactical's threshold: after the first tick of a fresh hit, another full strike lands (melee-hooks.js).
    if (target.survival.hurtTicks < 10) target.survival.hurtTicks = 0;
    if (!deps.damage(target, amount, { attacker: p, kind: 'melee', weapon, knockback: true })) continue;
    const k = attack.knockback, len = Math.hypot(dir[0], dir[2]);
    if (k > 0 && len > 1e-6) {
      const v = target.velocity;
      v.x = v.x / 2 + dir[0] / len * k; v.z = v.z / 2 + dir[2] / len * k;
      if (target.grounded) v.y = Math.min(0.4, v.y / 2 + k);
    }
    hits.push({ target, head: false, kill: target.survival.health <= 0 });
  }
  for (const h of hits) deps.send(p, h.mob ? { type: 'hit', mob: mobId(h.mob), head: false, kill: h.kill, melee: true } : { type: 'hit', target: h.target.id, head: false, kill: h.kill, melee: true });
  return hits;
}

export const withinEvents = (a, b) => Math.hypot(a.position.x - b.position.x, a.position.y - b.position.y, a.position.z - b.position.z) <= EVENT_RANGE;
