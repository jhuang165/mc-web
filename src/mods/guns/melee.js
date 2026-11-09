// Guns mod (not 1.7.10): melee weapons from LR Tactical packs (TaCZ-style "gun packs" whose index/melee/ entries are
// lrtactical:melee items, such as the CS2 Knifes Pack). tools/fetch-knives.mjs installs a pack's files locally, unmodified
// and Git-ignored, under public/mods/lrtactical/<namespace>/; without the install there are no knives and saved knife stacks
// keep placeholder items (install.js).
//
// A pack melee weapon here: { id, key: "<ns>:<name>", name, damage, speed, draw, putAway, attacks: { left, right }, pack }.
// `damage` is the item's generic.attack_damage attribute, `speed` its movement-speed modifier; each attack has LR Tactical's
// CombatData.MeleeAttackInfo fields (factor, knockback, cooldown and delay in ticks, hitbox). The models, animations and
// sounds load later (melee-view.js).
import { packResource } from "./resources.js";
import { parseLenient } from "./json5.js";
import { LRT_MELEE_IDS, LRT_MELEE_NAMES } from "./ids.js";

export const MELEE_ROOT = "/mods/lrtactical/";
// "cs2_wt:melee/karambit_geo" -> namespace and path (a bare path is the pack's own namespace).
const split = (loc, ns) => { const s = String(loc ?? ""), i = s.indexOf(":"); return i < 0 ? [ns, s] : [s.slice(0, i), s.slice(i + 1)]; };
const asset = (folder, ext) => (loc, ns) => { const [n, p] = split(loc, ns); return n === "cs2" ? packResource(folder, ext, `${n}:${p}`) : `${MELEE_ROOT}${n}/assets/${n}/${folder}/${p}${ext}`; };
export const meleeUrl = {
  geo: asset("geo_models", ".json"),
  texture: asset("textures", ".png"),
  animation: asset("animations", ".animation.json"),
  sound: asset("tacz_sounds", ".ogg"),
};

const defaultFetch = (url) => fetch(url).then((r) => (r.ok ? r.text() : null)).catch(() => null);
const strip = (s) => String(s ?? "").replace(/§./g, "").trim();

// The installed packs: [{ namespace, lang, melee: { name: { index, display } }, sounds: [paths] }], or null without the
// install (public/mods/lrtactical/index.json missing).
export async function loadMeleePacks(fetchText = defaultFetch) {
  const json = async (url) => { const t = await fetchText(url); if (t == null) return null; try { return parseLenient(t); } catch { return null; } };
  const index = await json(MELEE_ROOT + "index.json").catch(() => null);
  if (!Array.isArray(index?.packs)) return null;
  return Promise.all(index.packs.map(async (p) => {
    const ns = p.namespace, base = `${MELEE_ROOT}${ns}/`;
    const lang = (p.lang ?? []).includes("en_us") ? (await json(`${base}assets/${ns}/lang/en_us.json`)) ?? {} : {};
    const melee = {};
    await Promise.all((p.melee ?? []).map(async (name) => {
      const index = await json(`${base}data/${ns}/index/melee/${name}.json`);
      if (!index) return;
      const display = await json(`${base}assets/${ns}/display/melee/${name}.json`);
      if (display) melee[name] = { index, display };
    }));
    return { namespace: ns, lang, melee, sounds: p.sounds ?? [] };
  }));
}

const ticks = (v, d) => (Number.isFinite(+v) && +v >= 0 ? +v : d);
function attackInfo(a) {
  if (!a || typeof a !== "object") return null;
  const h = a.hitbox ?? {};
  return {
    factor: Number.isFinite(+a.factor) ? +a.factor : 1, knockback: +a.knockback || 0,
    cooldown: ticks(a.cooldown, 10), delay: ticks(a.delay, 0),
    hitbox: { type: h.type ?? "cone", range: +h.max_range || 3, angle: +h.max_angle || 90, excludeSelf: h.exclude_self !== false },
  };
}
// A modifier entry: a bare number adds, { amount, operation } as LR Tactical's AttributeData reads it.
const modifier = (v) => (v == null ? null : typeof v === "number" ? { amount: v, operation: "addition" } : { amount: +v.amount || 0, operation: v.operation ?? "addition" });

// One pack melee weapon, or null for an entry this game has no item id for (ids.js) or that is not a melee item.
export function meleeWeapon(ns, name, entry, lang = {}) {
  const key = `${ns}:${name}`, id = LRT_MELEE_IDS[key], { index: i, display: v } = entry ?? {};
  if (id == null || !i || !v || !String(i.base_item ?? "lrtactical:melee").endsWith(":melee")) return null;
  const d = i.data ?? {}, at = d.attributes ?? {};
  const damage = modifier(at["generic.attack_damage"] ?? at["minecraft:generic.attack_damage"]);
  return {
    id, key, namespace: ns, name: strip(lang[i.name]) || LRT_MELEE_NAMES[key] || name,
    damage: damage?.amount ?? 0, damageOperation: damage?.operation ?? "addition",
    speed: modifier(at["generic.movement_speed"] ?? at["minecraft:generic.movement_speed"]),
    draw: ticks(d.draw_time, 10), putAway: ticks(d.put_away_time, 0),
    attacks: { left: attackInfo(d.attack?.attack_left), right: attackInfo(d.attack?.attack_right) },
    pack: { model: v.model, texture: v.texture, animation: v.animation ?? null, slot: v.slot_texture ?? null, transforms: v.transforms ?? {}, namespace: ns },
  };
}

// ---- Combat ----

// The targets of a cone hitbox (LR Tactical ConeFilter): every living entity whose box comes within `range` blocks of the
// eye and whose closest point OR centre lies within half the angle (VectorUtil.isInAngle, bytecode-read).
// box(e) -> { min: [x,y,z], max: [x,y,z] }; visible(e, box) supplies ITargetFilter.hasLineOfSight.
// Nearest first.
export function coneTargets(entities, eye, dir, hitbox, box, visible = () => true) {
  const half = (hitbox.angle / 2) * Math.PI / 180, cos = Math.cos(half), out = [];
  for (const e of entities) {
    if (!(e.health > 0)) continue;
    const b = box(e);
    if (!b) continue;
    const nearest = [0, 1, 2].map((i) => Math.max(b.min[i], Math.min(b.max[i], eye[i])) - eye[i]);
    const distance = Math.hypot(...nearest);
    if (distance > hitbox.range) continue;
    const c = [0, 1, 2].map((i) => (b.min[i] + b.max[i]) / 2 - eye[i]);
    const inAngle = (v) => { const len = Math.hypot(...v) * Math.hypot(...dir); return len > 0 && (v[0] * dir[0] + v[1] * dir[1] + v[2] * dir[2]) / len >= cos; };
    if (distance > 0 && !inAngle(nearest) && !inAngle(c)) continue;
    if (visible(e, b)) out.push({ entity: e, distance });
  }
  return out.sort((a, b) => a.distance - b.distance);
}

// The attack timing per held weapon, in game ticks. A press starts an attack when the weapon is drawn and off cooldown:
// the swing (its animation and sounds) at once, the strike (the hit test and damage) `delay` ticks later; the cooldown
// (shared by both attacks) runs from the press. Holding the button attacks again whenever it is ready.
export class MeleeController {
  constructor() { this.weaponId = null; this.weaponKey = null; this.putAway = 0; this.draw = 0; this.cooldown = 0; this.pending = []; this.count = 0; this.held = { left: false, right: false }; this.queued = { left: false, right: false }; }
  // Each game tick with the held weapon (or null). Returns events: draw, swing { kind, attack }, strike { kind, attack }.
  tick(weapon, key = weapon?.id ?? null) {
    const events = [];
    if (key !== this.weaponKey) {
      if (this.weaponKey != null) this.cancel();
      this.weaponKey = key; this.count = 0;
      this.weaponId = weapon?.id ?? null; this.pending = []; this.cooldown = 0;
      this.draw = weapon ? weapon.draw + this.putAway : 0;
      this.putAway = weapon?.putAway ?? 0;
      if (weapon) events.push({ type: "draw", weapon });
      if (!weapon) this.held = { left: false, right: false };
      return events;
    }
    if (!weapon) return events;
    if (this.draw > 0) this.draw--;
    if (this.cooldown > 0) this.cooldown--;
    for (const p of [...this.pending]) if (--p.in <= 0) { this.pending.splice(this.pending.indexOf(p), 1); events.push({ type: "strike", weapon, kind: p.kind, attack: p.attack }); }
    for (const kind of ["left", "right"]) if (this.held[kind] || this.queued[kind]) { const e = this.start(weapon, kind); if (e) events.push(e); }
    return events;
  }
  ready() { return this.weaponId != null && this.draw <= 0 && this.cooldown <= 0; }
  start(weapon, kind) {
    const attack = weapon.attacks?.[kind];
    if (!attack || weapon.id !== this.weaponId || !this.ready()) return null;
    this.queued[kind] = false;
    this.cooldown = Math.max(1, attack.cooldown);
    const event = { type: "swing", weapon, kind, attack, count: kind === "left" ? this.count++ : this.count };
    if (attack.delay > 0) this.pending.push({ in: attack.delay, kind, attack }); else event.strike = true;
    return event;
  }
  cancel() { this.pending = []; this.held = { left: false, right: false }; this.queued = { left: false, right: false }; }
  // The attack (left) or use (right) button: down starts holding it, up lets go.
  press(kind, down) { if (down && !this.held[kind]) this.queued[kind] = true; this.held[kind] = !!down; }
  reset() { this.weaponId = null; this.weaponKey = null; this.putAway = 0; this.draw = 0; this.cooldown = 0; this.pending = []; this.count = 0; this.held = { left: false, right: false }; this.queued = { left: false, right: false }; }
}

// The damage of one strike: the weapon's attack damage (the attribute: the player's base 1 plus the item's modifier) times
// the attack's factor.
export const strikeDamage = (weapon, attack) => (1 + weapon.damage) * attack.factor;
// AttributeData: addition = operation 0, percent = operation 1, multiply = operation 2.
export function meleeSpeed(weapon, base = 0.1) {
  const m = weapon?.speed;
  return !m ? 1 : (m.operation === "addition" || m.operation === "add") ? Math.max(0, base + m.amount) / base : Math.max(0, 1 + m.amount);
}
