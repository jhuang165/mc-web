// Local LR Tactical melee integration. Uses the pack's ticks, cone and animation sound keys;
// targets receive the existing game's armour, revenge, death and loot handling.
import { MeleeController, coneTargets, strikeDamage, meleeSpeed } from "./melee.js";
import { meleeOf } from "./install.js";
import { meleeAssets, meleeClip } from "./melee-view.js";
import { gunSoundEvent } from "./sounds.js";
import { SoundSchedule } from "./feel.js";
import { ENTITY_TYPES } from "../../entities.js";
import { mobScale } from "../../slime.js";
import { rayTraceBlocks } from "../../projectiles.js";

export function createMeleeHooks(deps) {
  const controller = new MeleeController(), sounds = new SoundSchedule();
  const now = () => deps.now?.() ?? performance.now();
  const weapon = () => meleeOf(deps.survival.inventory.held);
  const assets = (w) => (deps.meleeAssets ?? meleeAssets)(w);
  let action = null, drawAt = -Infinity, tap = null;
  const box = (e) => {
    const t = ENTITY_TYPES[e.type];
    if (!t) return null;
    const scale = mobScale(e), r = t.width * scale / 2;
    return { min: [e.x - r, e.y, e.z - r], max: [e.x + r, e.y + t.height * scale, e.z + r] };
  };
  function resolve(w) {
    if (!action || action.resolved) return;
    const a = assets(w);
    if (!a) return;
    action.resolved = true;
    action.clip = meleeClip(a.animations, action.kind, action.count, deps.random ?? Math.random);
    const elapsed = (now() - action.at) / 1000;
    sounds.add((a.animations.get(action.clip)?.sounds ?? []).filter(([t]) => t >= elapsed - 0.05)
      .map(([t, file]) => [Math.max(0, t - elapsed), file]), gunSoundEvent, "melee");
  }
  function play(w, kind, count = 0) {
    sounds.cancel();
    action = { kind, count, at: now(), clip: null, resolved: false };
    resolve(w);
  }
  function strike(event) {
    const ray = deps.eye();
    if (!ray || deps.remote?.()) return []; // a gun server strikes for itself (multiplayer/combat.js)
    const { origin, dir } = ray;
    const visible = (e, b) => {
      // ITargetFilter: feet or any of the eight AABB corners visible through collider rays, ignoring fluids.
      const clear = (point) => !rayTraceBlocks(deps.world, origin, point);
      if (clear([e.x, e.y, e.z])) return true;
      for (const x of [b.min[0], b.max[0]]) for (const y of [b.min[1], b.max[1]]) for (const z of [b.min[2], b.max[2]])
        if (clear([x, y, z])) return true;
      return false;
    };
    const amount = strikeDamage(event.weapon, event.attack) * (deps.meleeCritical?.() ? 1.5 : 1);
    if (!(amount > 0) || event.attack.hitbox.type !== "cone") return [];
    const hits = [];
    for (const { entity: e } of coneTargets(deps.mobs.entities ?? [], origin, dir, event.attack.hitbox, box, visible)) {
      // MeleeItem also validates the target position against the player position (server range check).
      const from = deps.playerPos();
      if (Math.hypot(e.x - from.x, e.y - (from.y ?? origin[1] - 1.62), e.z - from.z) > event.attack.hitbox.range) continue;
      // LR Tactical default threshold 20: after the first tick of a fresh hit, allow another full strike.
      // The port's hurt counter stores only the upper ten ticks of hurtResistantTime.
      if ((e.hurt ?? 0) < 10) e.hurt = 0;
      if (!deps.mobs.attackEntityFrom(e, amount, { name: "player", player: true, from })) continue;
      // LivingEntity.knockback(strength, sin(yaw), -cos(yaw)) after the ordinary damage knockback.
      const k = event.attack.knockback * (1 - (e.knockbackResistance ?? 0)), len = Math.hypot(dir[0], dir[2]);
      if (k > 0 && len > 1e-6) {
        e.vx = (e.vx ?? 0) / 2 + dir[0] / len * k;
        e.vz = (e.vz ?? 0) / 2 + dir[2] / len * k;
        if (e.onGround) e.vy = Math.min(0.4, (e.vy ?? 0) / 2 + k);
      }
      hits.push({ entity: e, amount });
    }
    if (hits.length) { deps.renderHotbar(); deps.markUnsaved(); }
    return hits;
  }
  return {
    controller,
    holding: () => !!weapon(),
    speed: () => meleeSpeed(weapon()),
    press(kind, down, once = false) {
      if (!down) { controller.press(kind, false); if (tap === kind) tap = null; return false; }
      if (!weapon()) return false;
      controller.press(kind, true); tap = once ? kind : null;
      return true;
    },
    key(code) {
      const w = weapon();
      if (!w || code !== 33) return false;
      if (controller.ready() && !controller.pending.length) play(w, "inspect");
      return true;
    },
    cancel() { controller.cancel(); tap = null; sounds.cancel(); action = null; },
    reset() { controller.reset(); tap = null; sounds.cancel(); action = null; drawAt = -Infinity; },
    view() {
      const w = weapon();
      if (!w) return null;
      resolve(w);
      return { meleeId: w.id, aim: 0, clip: action?.clip ?? null, sinceClip: action ? (now() - action.at) / 1000 : Infinity, sinceDraw: (now() - drawAt) / 1000 };
    },
    tick() {
      const w = weapon(), active = !deps.playing || deps.playing();
      if (!active) this.cancel();
      const events = controller.tick(w, w ? `${deps.survival.inventory.current}/${w.id}` : null);
      for (const e of events) {
        if (e.type === "draw") { drawAt = now(); play(w, "draw"); }
        if (e.type === "swing") {
          play(w, e.kind, e.count);
          if (tap === e.kind) { controller.press(tap, false); tap = null; }
        }
        if (e.type === "strike" || e.strike) e.result = strike(e);
        deps.onEvent?.(e);
      }
      if (w) resolve(w); else { action = null; sounds.cancel(); }
      for (const event of sounds.tick()) deps.sound?.(event);
      return events;
    },
  };
}
