// Guns mod (not 1.7.10): the glue between main.js and firing.js / feel.js. main.js calls these only while a guns world is
// loaded; each input hook returns false when the held item is not a gun, so vanilla input carries on unchanged.
import { GunController, fireShot, GLASS_BLOCKS, TICK } from "./firing.js";
import { GUNS, roundsLeft } from "./catalog.js";
import { Aim, Recoil, SoundSchedule, SHARED_SOUNDS, soundsOf } from "./feel.js";
import { gunSoundEvent } from "./sounds.js";
import { gunMuzzle } from "./model.js";
import { ammoHudState } from "./hud.js";
import { ENTITY_TYPES } from "../../entities.js";
import { rayTraceBlocks } from "../../projectiles.js";
import { mobScale } from "../../slime.js";

const KEY_R = 19, KEY_G = 34; // LWJGL codes; neither is bound in 1.7.10's default controls
const HEAD_MARGIN = 0.25; // a hit within this far below the eye line, or above it, is a headshot
const RAD = Math.PI / 180;
const MUZZLE_DEPTH = 1.2; // blocks ahead of the eye for the muzzle smoke

// deps: { survival, world, mobs, eye() -> { origin, dir }, playerPos() -> {x, z},
//   sneaking(), moving(), breakBlock([x,y,z]), renderHotbar(), markUnsaved(), toast(text), playing?(), onEvent?(event), random?,
//   sound?(event, options), preload?(folder), fx?(name, x, y, z, vx, vy, vz), blockHit?([x,y,z], side), crosshair?(visible),
//   now?() -> ms, hud?(state | null), explode?(x, y, z, radius, { damage, destroy }) }
export function createGunHooks(deps) {
  const controller = new GunController(), aim = new Aim(), recoil = new Recoil(), schedule = new SoundSchedule();
  let tapTicks = 0; // a tap (touch, or a click without pointer lock) holds the trigger until it fires or for this many ticks
  let crosshair = true;
  // What the first-person model shows, in now() milliseconds: the draw, the last shot, the reload in progress, and the
  // aim progress of the last two ticks (the view interpolates between them).
  const anim = { drawAt: -Infinity, drawTime: 0, shotAt: -Infinity, reload: null, aimFrom: 0, aimTo: 0, tickAt: -Infinity };
  const random = () => (deps.random ?? Math.random)();
  const now = () => deps.now?.() ?? performance.now();
  const held = () => deps.survival.inventory.held;
  const heldGun = () => GUNS[held()?.id];
  const holdingGun = () => heldGun() !== undefined;
  const sound = (event, options) => { if (event) deps.sound?.(event, options); };
  const ev = (path) => (path ? gunSoundEvent(path) : null);
  const shared = (name) => sound(ev(SHARED_SOUNDS[name]));
  const NO_SOUNDS = { tactical: [], empty: [], start: [], shell: [], end: [] };
  const soundTable = (gun) => soundsOf(gun.id) ?? NO_SOUNDS;
  // The folder a gun's sounds sit in ("ak47"), for preloading.
  const soundFolder = (gun) => String(soundTable(gun).shoot ?? "").split("/")[0] || null;
  const rounds = (stack) => roundsLeft(stack, (id) => deps.survival.inventory.count(id), deps.survival.creative);
  const MODE_NAMES = { auto: "Automatic", semi: "Semi-automatic", burst: "Burst" };
  const inventory = () => ({
    held: held(),
    slot: deps.survival.inventory.current,
    creative: deps.survival.creative,
    count: (id) => deps.survival.inventory.count(id),
    take(id, n) {
      const inv = deps.survival.inventory;
      if (inv.count(id) < n) return false;
      for (let i = 0; i < 36 && n > 0; i++) {
        const s = inv.main[i];
        if (s?.id !== id || !(s.count > 0)) continue;
        n -= inv.decr(i, Math.min(n, s.count))?.count ?? 0;
      }
      return n <= 0;
    },
  });

  function shoot(gun) {
    const ray = deps.eye();
    if (!ray) return { hits: [], impacts: [] };
    const { origin, dir } = ray;
    const out = fireShot(gun, {
      origin, dir, random, sneaking: deps.sneaking(), moving: deps.moving(), aiming: aim.progress,
      traceBlocks(start, end) {
        const hit = rayTraceBlocks(deps.world, start, end, true);
        return hit && { ...hit, id: deps.world.get(...hit.block) };
      },
      pickEntity(o, d, max) {
        const v = (a) => ({ x: a[0], y: a[1], z: a[2] });
        return deps.mobs.pick(v(o), v(d), max, max);
      },
      breakGlass(block) { if (GLASS_BLOCKS.has(deps.world.get(...block))) deps.breakBlock(block); },
      isHead(e, point) {
        const t = ENTITY_TYPES[e.type];
        if (!t) return false;
        return point[1] >= e.y + t.height * mobScale(e) * 0.85 - HEAD_MARGIN;
      },
    });
    const from = deps.playerPos();
    for (const { entity, amount } of out.hits) {
      if (entity.health <= 0) continue;
      // Every bullet is a fresh hit: TaCZ skips the hurt-resistance window, which would otherwise drop 9 of 10 AKM rounds.
      entity.hurt = 0; entity.lastDamage = 0;
      deps.mobs.attackEntityFrom(entity, amount, {
        name: "player", player: true,
        ...(gun.knockback > 0 ? { from: { x: from.x, z: from.z } } : {}), // TaCZ bullet knockback: shotguns and heavy rounds
      });
    }
    // Grenades and rockets (TaCZ bullet "explosion") burst where the first pellet lands. Without a hit they fly out of range.
    if (gun.explosion && out.impacts.length) {
      const first = out.impacts.reduce((a, b) => (b.distance < a.distance ? b : a));
      // A block hit explodes just in front of the face, so the blast is not buried inside the wall.
      const p = first.entity ? first.point : first.point.map((v, i) => v - dir[i] * 0.3);
      deps.explode?.(p[0], p[1], p[2], gun.explosion.radius, { damage: gun.explosion.damage, destroy: gun.explosion.destroy });
    }
    out.ray = ray;
    return out;
  }

  // Smoke and a little flame where the model's muzzle appears on screen: the hand-camera muzzle point, pushed out along its
  // line of sight to MUZZLE_DEPTH so it stays clear of the near plane (the first-person model draws its own flash).
  function muzzle(gun, { origin, dir }) {
    if (!deps.fx) return;
    let right = [-dir[2], 0, dir[0]];
    const rl = Math.hypot(...right) || 1; right = right.map((v) => v / rl);
    const up = [right[1] * dir[2] - right[2] * dir[1], right[2] * dir[0] - right[0] * dir[2], right[0] * dir[1] - right[1] * dir[0]];
    const [mx, my, mz] = gunMuzzle(gun.id, { aim: aim.progress }), k = MUZZLE_DEPTH / Math.max(0.05, -mz);
    const p = origin.map((v, i) => v + (dir[i] * -mz + right[i] * mx + up[i] * my) * k);
    deps.fx("flame", ...p, dir[0] * 0.02, dir[1] * 0.02, dir[2] * 0.02);
    for (let i = 0, n = gun.pellets > 1 || gun.explosion ? 4 : 2; i < n; i++) deps.fx("smoke", ...p, dir[0] * 0.03, 0.02, dir[2] * 0.03);
  }
  function impacts(gun, out) {
    const perHit = gun.pellets > 1 ? 2 : 4; // a shotgun's nine pellets already make a spray
    for (const hit of out.impacts) {
      if (hit.entity) { for (let i = 0; i < 3; i++) deps.fx?.("crit", ...hit.point, random() - 0.5, random() * 0.5, random() - 0.5); continue; }
      for (let i = 0; i < perHit; i++) deps.blockHit?.(hit.block, hit.side);
      deps.fx?.("smoke", ...hit.point, 0, 0.01, 0);
    }
    // Hit feedback for the shooter: the kill sound beats a headshot, which beats a body hit.
    if (out.hits.some((h) => h.entity.health <= 0)) shared("kill");
    else if (out.hits.some((h) => h.head)) shared("head");
    else if (out.hits.length) shared("flesh");
  }
  function startReloadSounds(gun, wasEmpty) {
    const s = soundTable(gun);
    schedule.cancel("pump");
    schedule.add((gun.reload.kind === "shell" ? s.start : wasEmpty ? s.empty : s.tactical) ?? [], ev, "reload");
  }

  return {
    controller, aim, recoil,
    holdingGun,
    // key.attack pressed (down) or released while playing. True when a gun took it.
    attack(down) {
      tapTicks = 0;
      if (!holdingGun()) { if (!down) controller.release(); return false; }
      if (down) controller.press(); else controller.release();
      return true;
    },
    // A tap with no held button (the touch break button, a click without pointer lock): one trigger pull. True when a gun took it.
    tap() {
      if (!holdingGun()) return false;
      controller.press();
      tapTicks = 20;
      return true;
    },
    // key.use pressed (down) or released: aim down sights while it is held. True when a gun took the press.
    aimHold(down) {
      if (!down) { aim.held = false; return false; }
      if (!holdingGun()) return false;
      aim.held = true;
      return true;
    },
    // The touch use button: each tap toggles aiming.
    aimToggle() {
      if (!holdingGun()) return false;
      aim.held = !aim.held;
      return true;
    },
    // A raw key press while playing with no screen open: R reloads, G switches fire mode.
    key(code) {
      const gun = heldGun();
      if (!gun) return false;
      if (code === KEY_R) {
        const wasEmpty = rounds(held()) <= 0;
        if (controller.startReload(inventory())) {
          startReloadSounds(gun, wasEmpty);
          const r = controller.reload;
          anim.reload = { kind: r.kind, at: now(), time: r.time, shellAt: -Infinity, endAt: null, empty: wasEmpty, shells: 0 };
        }
        return true;
      }
      if (code === KEY_G) {
        const mode = controller.toggleMode(held());
        if (mode) { deps.toast(`${gun.name}: ${MODE_NAMES[mode] ?? mode}`); shared("mode"); }
        return true;
      }
      return false;
    },
    // The fovMultiplier `bow` factor this tick: the iron-sight zoom while aiming.
    fov() { const gun = heldGun(); return gun ? aim.fov(gun.id) : 1; },
    // Once per rendered frame: the recoil turn, in radians, to add to [pitch, yaw].
    frame() {
      if (!recoil.active) return [0, 0];
      const [p, y] = recoil.frame(now());
      return [p * RAD, y * RAD];
    },
    // A world was loaded: start from rest, with the crosshair shown.
    reset() {
      controller.release(); controller.heldKey = null; controller.reload = null;
      tapTicks = 0; aim.held = false; aim.progress = 0; recoil.reset(); schedule.cancel();
      Object.assign(anim, { drawAt: -Infinity, shotAt: -Infinity, reload: null, aimFrom: 0, aimTo: 0 });
      deps.hud?.(null);
      if (!crosshair) { crosshair = true; deps.crosshair?.(true); }
    },
    // Once per rendered frame: the first-person model's state (model.js gunViewPose), or null without a gun in hand.
    view() {
      const gun = heldGun();
      if (!gun) return null;
      const t = now(), s = (at) => (t - at) / 1000, r = anim.reload;
      let reload = null;
      if (r?.kind === "magazine" && r.endAt == null) reload = { kind: "magazine", t: Math.min(1, s(r.at) / r.time) };
      else if (r?.kind === "shell" && (r.endAt == null || s(r.endAt) < 0.3))
        reload = { kind: "shell", sinceStart: s(r.at), start: r.time, sinceShell: s(r.shellAt), sinceEnd: r.endAt == null ? null : s(r.endAt) };
      // The pack's animations play by clock time rather than progress: the reload's start, whether it began empty, and
      // its end (pack-view.js picks reload_empty / reload_tactical, or the shell intro, loop and ending).
      const timeline = r ? { kind: r.kind, since: s(r.at), empty: r.empty, sinceShell: s(r.shellAt), shells: r.shells, sinceEnd: r.endAt == null ? null : s(r.endAt) } : null;
      const partial = Math.max(0, Math.min(1, (t - anim.tickAt) / (TICK * 1000)));
      return {
        gunId: gun.id,
        aim: anim.aimFrom + (anim.aimTo - anim.aimFrom) * partial,
        sinceShot: s(anim.shotAt),
        draw: anim.drawTime > 0 ? Math.min(1, s(anim.drawAt) / anim.drawTime) : 1,
        sinceDraw: s(anim.drawAt),
        empty: rounds(held()) <= 0,
        mode: controller.mode(gun.id),
        reload, timeline,
        gun,
      };
    },
    // The ammo counter's state (hud.js), or null without a gun in hand.
    hudState() {
      const stack = held(), inv = deps.survival.inventory;
      return ammoHudState(stack, { count: (id) => inv.count(id), creative: deps.survival.creative, mode: controller.mode(stack?.id), reloading: !!controller.reload });
    },
    // Once per game tick.
    tick() {
      if (deps.playing && !deps.playing()) { controller.release(); tapTicks = 0; aim.held = false; } // a screen opened mid-burst lets go
      const wasReloading = !!controller.reload;
      const events = controller.tick(inventory());
      if (tapTicks > 0 && (--tapTicks === 0 || events.some((e) => e.type === "shot" || e.type === "empty"))) { tapTicks = 0; controller.release(); }
      const gun = heldGun();
      if (!gun) aim.held = false;
      let changed = false;
      for (const event of events) {
        const g = event.gun, s = soundTable(g);
        if (event.type === "draw") {
          schedule.cancel(); recoil.reset(); aim.progress = 0;
          Object.assign(anim, { drawAt: now(), drawTime: g.draw, shotAt: -Infinity, reload: null, aimFrom: 0, aimTo: 0 });
          sound(ev(s.draw)); deps.preload?.(soundFolder(g)); deps.drawn?.(g);
        }
        if (event.type === "shot") {
          event.result = shoot(g); changed = true;
          recoil.kick(g.id, aim.progress, now(), random); anim.shotAt = now();
          if (anim.reload?.kind === "shell" && anim.reload.endAt == null) anim.reload.endAt = now(); // the trigger stopped the loading
          sound(ev(s.shoot));
          if (s.pump) { schedule.cancel("pump"); schedule.add(s.pump, ev, "pump"); }
          muzzle(g, event.result.ray ?? deps.eye() ?? { origin: [0, 0, 0], dir: [0, 0, -1] });
          impacts(g, event.result);
        }
        if (event.type === "empty") shared("dry");
        if (event.type === "shell") {
          changed = true;
          if (anim.reload) { anim.reload.shellAt = now(); anim.reload.shells++; }
          if (s.shellKeys?.length) schedule.add(s.shellKeys, ev, "reload"); // a pack gun: its reload_loop animation's sounds
          else if (s.shell?.length) sound(ev(s.shell[Math.floor(random() * s.shell.length) % s.shell.length]));
        }
        if (event.type === "reloaded") { changed = true; if (anim.reload && anim.reload.endAt == null) anim.reload.endAt = now(); if (s.end) schedule.add(s.end, ev, "reload-end"); }
        deps.onEvent?.(event);
      }
      // A reload that stopped without finishing (the trigger, or the gun put away) drops the rest of its sounds.
      if (wasReloading && !controller.reload && !events.some((e) => e.type === "reloaded")) {
        schedule.cancel("reload");
        if (anim.reload && anim.reload.endAt == null) anim.reload.endAt = now();
      }
      for (const event of schedule.tick()) sound(event);
      anim.aimFrom = aim.progress;
      aim.tick(gun);
      anim.aimTo = aim.progress; anim.tickAt = now();
      const show = !(gun && aim.progress >= 0.5); // TaCZ hides the crosshair while aiming down sights
      if (show !== crosshair) { crosshair = show; deps.crosshair?.(show); }
      if (changed) { deps.renderHotbar(); deps.markUnsaved(); }
      deps.hud?.(this.hudState());
      return events;
    },
  };
}
