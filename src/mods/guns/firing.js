// Guns mod (not 1.7.10): trigger, fire rate, magazine/shell reloads and the instant-hit shot. Pure logic: main.js supplies the
// held stack, inventory access and world/mob tracing through `ctx`, so tests drive it headless. Times are seconds; the game
// calls tick() once per 20 Hz game tick.
import { GUNS, gunOf, roundsLeft } from "./catalog.js";

export const TICK = 0.05;
export const RANGE = 128; // blocks; TaCZ bullets fly speed * life (150-250 blocks) but only loaded chunks matter here
const SEGMENT = 32; // rayTraceBlocks walks at most 201 cells, so long traces go in pieces
export const GLASS_BLOCKS = new Set([9, 100, 140, 141]); // glass, glass pane, stained glass, stained glass pane
const MAX_GLASS = 4; // panes one bullet may break before it stops

// TaCZ damage_adjust: the first band whose distance reaches the hit.
export function damageAt(gun, distance) {
  for (const [reach, damage] of gun.damage) if (distance <= reach) return damage;
  return gun.damage[gun.damage.length - 1][1];
}
// `aiming` is the aim progress (0 hip, 1 fully aimed; true counts as 1): the spread narrows toward the aimed value with it.
export function inaccuracyOf(gun, { aiming = 0, sneaking = false, moving = false } = {}) {
  const i = gun.inaccuracy, hip = sneaking ? i.sneak : moving ? i.move : i.stand, a = aiming === true ? 1 : Math.max(0, Math.min(1, +aiming || 0));
  return a >= 1 ? i.aim : a <= 0 ? hip : hip + (i.aim - hip) * a;
}

// A direction inside a cone of `degrees` half-angle around `dir` (unit vector), uniform over the cone's disc.
export function spreadDirection(dir, degrees, random = Math.random) {
  if (!(degrees > 0)) return [...dir];
  const r = Math.tan((degrees * Math.PI) / 180) * Math.sqrt(random()), t = random() * 2 * Math.PI;
  // Two unit vectors perpendicular to dir.
  const up = Math.abs(dir[1]) < 0.99 ? [0, 1, 0] : [1, 0, 0];
  let ax = [dir[1] * up[2] - dir[2] * up[1], dir[2] * up[0] - dir[0] * up[2], dir[0] * up[1] - dir[1] * up[0]];
  const al = Math.hypot(...ax); ax = ax.map((v) => v / al);
  const bx = [dir[1] * ax[2] - dir[2] * ax[1], dir[2] * ax[0] - dir[0] * ax[2], dir[0] * ax[1] - dir[1] * ax[0]];
  const d = dir.map((v, i) => v + (ax[i] * Math.cos(t) + bx[i] * Math.sin(t)) * r), l = Math.hypot(...d);
  return d.map((v) => v / l);
}

// One bullet from `origin` along unit `dir`. ctx.traceBlocks(start, end) -> { block:[x,y,z], vec:[x,y,z], id } | null (blocks
// with a collision box only); ctx.pickEntity(origin, dir, maxDistance) -> { entity, distance } | null; ctx.breakGlass(block).
// Returns { entity, distance, point } for a mob, { block, point, distance } for a wall, or null for a miss.
export function traceShot(origin, dir, ctx, range = RANGE) {
  let start = origin, travelled = 0, glass = 0;
  while (travelled < range) {
    const len = Math.min(SEGMENT, range - travelled), end = start.map((v, i) => v + dir[i] * len);
    const wall = ctx.traceBlocks(start, end);
    const wallAt = wall ? travelled + Math.hypot(...wall.vec.map((v, i) => v - start[i])) : travelled + len;
    const mob = ctx.pickEntity(origin, dir, wallAt);
    if (mob && mob.distance >= travelled - 1e-6) return { entity: mob.entity, distance: mob.distance, point: origin.map((v, i) => v + dir[i] * mob.distance) };
    if (!wall) { start = end; travelled += len; continue; }
    if (GLASS_BLOCKS.has(wall.id) && glass < MAX_GLASS) {
      glass++;
      ctx.breakGlass(wall.block);
      // Go on from just past the hit point (the broken cell now reads as air).
      start = wall.vec.map((v, i) => v + dir[i] * 1e-3);
      travelled = wallAt;
      continue;
    }
    return { block: wall.block, point: wall.vec, distance: wallAt, side: wall.side };
  }
  return null;
}

export const boltDelay = (gun) => (gun.bolt === "manual_action" ? +gun.boltTime || 0 : 0);
// Seconds left after one tick; float leftovers below a microsecond count as done.
const countDown = (t) => (t - TICK > 1e-6 ? t - TICK : 0);

// The held gun's runtime state (not saved): draw delay, fire cooldown, trigger, reload and the fire mode per gun id.
export class GunController {
  constructor() {
    this.heldKey = null; this.draw = 0; this.cooldown = 0; this.trigger = false; this.spent = false;
    this.reload = null; this.modes = {}; this.burstLeft = 0;
  }
  mode(id) { const gun = GUNS[id]; return gun ? (this.modes[id] ?? gun.modes[0]) : null; }
  // G: cycle the gun's fire modes (auto, semi, burst, in the pack's order); returns the new mode or null.
  toggleMode(stack) {
    const gun = GUNS[stack?.id];
    if (!gun || gun.modes.length < 2) return null;
    const next = gun.modes[(gun.modes.indexOf(this.mode(gun.id)) + 1) % gun.modes.length];
    this.modes[gun.id] = next;
    return next;
  }
  press() {
    this.trigger = true; this.spent = false;
    if (this.reload?.kind === "shell" && this.reload.loading) this.reload = null; // a shotgun's shell-by-shell reload stops on the trigger
  }
  release() { this.trigger = false; this.spent = false; } // a burst under way still finishes (tick)
  // R: start a reload when the magazine is not full and there is ammo (or the player is in creative).
  startReload(ctx) {
    const stack = ctx.held, gun = gunOf(stack);
    if (!gun || gun.feed === "inventory" || this.reload || this.draw > 0) return false; // the minigun feeds from the inventory
    const left = roundsLeft(stack);
    if (left >= gun.magazine || (!ctx.creative && ctx.count(gun.ammo) <= 0)) return false;
    this.reload = gun.reload.kind === "shell"
      ? { kind: "shell", time: gun.reload.start, loading: true }
      : { kind: "magazine", time: left > 0 ? gun.reload.tactical : gun.reload.empty };
    return true;
  }
  // One game tick. ctx: { held, slot, creative, count(id), take(id, n) }. Returns events (draw, shot, empty, shell, reloaded).
  tick(ctx) {
    const stack = ctx.held, gun = gunOf(stack), events = []; // the gun with its attachments (fit.js)
    const key = gun ? `${ctx.slot}:${gun.id}` : null;
    if (key !== this.heldKey) { // drawing a gun (or another one): TaCZ draw_time before it can fire
      this.heldKey = key; this.reload = null; this.cooldown = 0; this.spent = this.trigger; this.burstLeft = 0;
      this.draw = gun ? gun.draw : 0;
      if (gun) events.push({ type: "draw", gun });
    }
    if (!gun) return events;
    if (this.draw > 0) { this.draw = countDown(this.draw); return events; }
    // The cooldown keeps the fraction of a tick past zero, so 450 rpm averages 2.67 ticks a shot instead of rounding to 3.
    this.cooldown -= TICK;
    if (this.reload) this.tickReload(ctx, gun, stack, events);
    const ready = this.cooldown <= 1e-6, bursting = this.burstLeft > 0;
    if (this.reload?.kind === "magazine" || (!bursting && (!this.trigger || this.spent)) || !ready) {
      if (this.cooldown < 0) this.cooldown = 0;
      return events;
    }
    const inventoryFed = gun.feed === "inventory";
    if (roundsLeft(stack, ctx.count, ctx.creative) <= 0) {
      this.spent = true; this.cooldown = 0; this.burstLeft = 0; events.push({ type: "empty", gun }); return events;
    }
    this.reload = null;
    if (!inventoryFed) stack.damage = (stack.damage | 0) + 1;
    else if (!ctx.creative) ctx.take(gun.ammo, 1);
    // Only a cooldown that ran out during this tick carries over; an idle gun (a full tick past zero) starts fresh.
    const carry = this.cooldown > 1e-6 - TICK ? this.cooldown : 0, mode = this.mode(gun.id);
    if (mode === "burst" && gun.burst) {
      // TaCZ burst_data: `count` rounds at `bpm`, then at least `min_interval` seconds before the next burst; a continuous
      // burst gun keeps bursting while the trigger is held.
      if (!bursting) this.burstLeft = gun.burst.count;
      this.burstLeft--;
      const between = 60 / gun.burst.bpm;
      this.cooldown = carry + (this.burstLeft > 0 ? between : Math.max(between, gun.burst.minInterval));
      if (this.burstLeft === 0 && !gun.burst.continuous) this.spent = true;
    } else {
      this.burstLeft = 0;
      // A bolt, pump or lever gun cannot fire again until its action is worked (TaCZ bolt_action_time), however high its rpm.
      this.cooldown = carry + Math.max(60 / gun.rpm, boltDelay(gun));
      if (mode !== "auto") this.spent = true;
    }
    events.push({ type: "shot", gun });
    return events;
  }
  tickReload(ctx, gun, stack, events) {
    const r = this.reload;
    r.time = countDown(r.time);
    if (r.time > 0) return;
    const missing = gun.magazine - roundsLeft(stack);
    if (r.kind === "magazine") {
      const n = ctx.creative ? missing : Math.min(missing, ctx.count(gun.ammo));
      if (n > 0 && (ctx.creative || ctx.take(gun.ammo, n))) stack.damage = (stack.damage | 0) - n;
      this.reload = null;
      events.push({ type: "reloaded", gun, rounds: n });
      return;
    }
    // Shell reload: one shell per perShell seconds until full or out of shells.
    if (missing <= 0 || (!ctx.creative && ctx.count(gun.ammo) <= 0)) { this.reload = null; events.push({ type: "reloaded", gun }); return; }
    if (ctx.creative || ctx.take(gun.ammo, 1)) stack.damage = (stack.damage | 0) - 1;
    events.push({ type: "shell", gun });
    if (missing - 1 <= 0) { this.reload = null; events.push({ type: "reloaded", gun }); }
    else r.time += gun.reload.perShell;
  }
}

// Every pellet of one shot, with damage summed per mob: TaCZ bullets ignore the hurt-resistance window, so the caller resets it
// and applies each mob's total once. ctx adds aim { origin, dir }, moving/sneaking/aiming and random to traceShot's ctx.
export function fireShot(gun, ctx) {
  const spread = inaccuracyOf(gun, ctx), hits = new Map(), impacts = [];
  for (let i = 0; i < gun.pellets; i++) {
    const dir = spreadDirection(ctx.dir, spread, ctx.random);
    const hit = traceShot(ctx.origin, dir, ctx);
    if (!hit) continue;
    impacts.push(hit);
    if (!hit.entity) continue;
    const head = ctx.isHead?.(hit.entity, hit.point) ?? false;
    const amount = damageAt(gun, hit.distance) * (head ? gun.headshot : 1);
    const prev = hits.get(hit.entity);
    hits.set(hit.entity, { entity: hit.entity, amount: (prev?.amount ?? 0) + amount, head: head || !!prev?.head });
  }
  return { hits: [...hits.values()], impacts };
}
