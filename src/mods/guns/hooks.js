// Guns mod (not 1.7.10): the glue between main.js and firing.js / feel.js. main.js calls these only while a guns world is
// loaded; each input hook returns false when the held item is not a gun, so vanilla input carries on unchanged.
import { createMeleeHooks } from "./melee-hooks.js";
import { GunController, fireShot, GLASS_BLOCKS, TICK } from "./firing.js";
import { GUNS, gunOf, roundsLeft } from "./catalog.js";
import { Aim, Recoil, SoundSchedule, SHARED_SOUNDS, soundsOf } from "./feel.js";
import { gunSoundEvent } from "./sounds.js";
import { carriedAmmo, takeAmmo } from "./ammo-box.js";
import { gunMuzzle } from "./model.js";
import { isTracerRound } from "./tracers.js";
import { ammoHudState, modeLabel } from "./hud.js";
import { ENTITY_TYPES } from "../../entities.js";
import { rayTraceBlocks } from "../../projectiles.js";
import { mobScale } from "../../slime.js";

const KEY_R = 19, KEY_G = 34, KEY_F = 33, KEY_Z = 44; // LWJGL codes; none is bound in 1.7.10's default controls
const HEAD_MARGIN = 0.25; // a hit within this far below the eye line, or above it, is a headshot
const RAD = Math.PI / 180;
const MUZZLE_DEPTH = 1.2; // blocks ahead of the eye for the muzzle smoke
// A gun without the pack's data (the hand-made guns alone): a white tracer every round at a rifle bullet's speed.
const DEFAULT_TRACER = { speed: 250, life: 10, interval: 0, color: "#FFFFFF" };

// deps: { survival, world, mobs, eye() -> { origin, dir }, playerPos() -> {x, z},
//   sneaking(), moving(), breakBlock([x,y,z]), renderHotbar(), markUnsaved(), toast(text), playing?(), onEvent?(event), random?,
//   sound?(event, options), preload?(folder), fx?(name, x, y, z, vx, vy, vz), blockHit?([x,y,z], side), crosshair?(visible),
//   now?() -> ms, hud?(state | null), explode?(x, y, z, radius, { damage, destroy }), tracer?(tracer) (tracers.js tracerBox),
//   remote?() -> true on a gun server, action?(name, down) (protocol.js cleanAction), pickPlayer?(origin, dir, max) -> { entity, distance } }
// On a gun server (multiplayer/gun-simulation.js) the server owns damage, glass, explosions, ammo and hit sounds: the local controller
// only predicts the shot's look and sound, and each button change is forwarded once as a server action.
const HELD = new Set(["trigger", "aim", "melee-left", "melee-right"]);
export function createGunHooks(deps) {
  const remote = () => !!deps.remote?.();
  const melee = createMeleeHooks(deps);
  const sent = {};
  const forward = (name, down = true) => {
    if (!remote()) return;
    if (HELD.has(name)) { if (sent[name] === down) return; sent[name] = down; }
    deps.action?.(name, down);
  };
  const controller = new GunController(), aim = new Aim(), recoil = new Recoil(), schedule = new SoundSchedule();
  let pendingKick = null; // { gun, aim, at }: the recoil of a shot due later this tick, started by frame() when it is due
  let tapTicks = 0; // a tap (touch, or a click without pointer lock) holds the trigger until it fires or for this many ticks
  let crosshair = true;
  // What the first-person model shows, in now() milliseconds: the draw, the last shot, the reload in progress, and the
  // aim progress of the last two ticks (the view interpolates between them).
  // A shot timed later in its tick (`at`) moves shotAt ahead of now(); prevShotAt keeps the model on the last shot until then.
  const anim = { drawAt: -Infinity, drawTime: 0, shotAt: -Infinity, prevShotAt: -Infinity, reload: null, aimFrom: 0, aimTo: 0, tickAt: -Infinity, inspectAt: -Infinity, inspectEmpty: false };
  // F: TaCZ's inspect animation and its sounds; firing, reloading, aiming or drawing cuts it short.
  const stopInspect = () => { anim.inspectAt = -Infinity; schedule.cancel("inspect"); };
  const random = () => (deps.random ?? Math.random)();
  const now = () => deps.now?.() ?? performance.now();
  const held = () => deps.survival.inventory.held;
  const heldGun = () => gunOf(held()); // with the stack's attachments applied (fit.js)
  const holdingGun = () => heldGun() !== undefined;
  const sound = (event, options) => { if (event) deps.sound?.(event, options); };
  const ev = (path) => (path ? gunSoundEvent(path) : null);
  const shared = (name, options) => sound(ev(SHARED_SOUNDS[name]), options);
  // SoundPlayManager: a shot at volume 0.8 (0.6 silenced), dry fire at 1.0, each at pitch 0.9 + rand * 0.125.
  // GunSoundInstance squares volume * distance gain, so the shooter hears 0.64, 0.36 and 1.0.
  const shotPitch = () => 0.9 + random() * 0.125;
  const shotSound = (gun, silenced, options = {}) => {
    const s = soundTable(gun), quiet = silenced && s.silenced;
    sound(ev(quiet ? s.silenced : s.shoot), { volume: quiet ? 0.36 : 0.64, pitch: shotPitch(), ...options });
  };
  // HitSoundConcurrencyLimit 1: a new hit sound stops the one still playing.
  const hitSound = (name) => { if (name) shared(name, { exclusive: "guns.hit" }); };
  const NO_SOUNDS = { tactical: [], empty: [], start: [], shell: [], end: [] };
  const soundTable = (gun) => soundsOf(gun.id) ?? NO_SOUNDS;
  // The folder a gun's sounds sit in ("ak47"), for preloading.
  const soundFolder = (gun) => String(soundTable(gun).shoot ?? "").split("/")[0] || null;
  const rounds = (stack) => roundsLeft(stack, (id) => carriedAmmo(deps.survival.inventory.main, id), deps.survival.creative);
  const MODE_NAMES = { AUTO: "Automatic", SEMI: "Semi-automatic", BURST: "Burst", BOLT: "Bolt action", PUMP: "Pump action" };
  const inventory = () => ({
    held: held(),
    slot: deps.survival.inventory.current,
    creative: deps.survival.creative,
    // Loose rounds, then those in ammo boxes (ammo-box.js).
    count: (id) => carriedAmmo(deps.survival.inventory.main, id),
    take(id, n) {
      const inv = deps.survival.inventory;
      return takeAmmo(inv.main, id, n, (i, k) => inv.decr(i, k));
    },
  });

  function shoot(gun) {
    const ray = deps.eye();
    if (!ray) return { hits: [], impacts: [] };
    const { origin, dir } = ray;
    if (remote()) { // a prediction: where the pellets land for the tracers and impact particles; the server traces the real shot
      const out = fireShot(gun, {
        origin, dir, random, sneaking: deps.sneaking(), moving: deps.moving(), aiming: aim.progress,
        traceBlocks(start, end) { const hit = rayTraceBlocks(deps.world, start, end, true); return hit && { ...hit, id: deps.world.get(...hit.block) }; },
        pickEntity: (o, d, max) => deps.pickPlayer?.(o, d, max) ?? null,
        breakGlass() {},
      });
      out.hits = []; out.ray = ray;
      return out;
    }
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
  function muzzlePoint(gun, { origin, dir }) {
    let right = [-dir[2], 0, dir[0]];
    const rl = Math.hypot(...right) || 1; right = right.map((v) => v / rl);
    const up = [right[1] * dir[2] - right[2] * dir[1], right[2] * dir[0] - right[0] * dir[2], right[0] * dir[1] - right[1] * dir[0]];
    const [mx, my, mz] = gunMuzzle(gun.id, { aim: aim.progress }), k = MUZZLE_DEPTH / Math.max(0.05, -mz);
    return origin.map((v, i) => v + (dir[i] * -mz + right[i] * mx + up[i] * my) * k);
  }
  function muzzle(gun, ray) {
    if (!deps.fx) return;
    const { dir } = ray, p = muzzlePoint(gun, ray);
    deps.fx("flame", ...p, dir[0] * 0.02, dir[1] * 0.02, dir[2] * 0.02);
    for (let i = 0, n = gun.pellets > 1 || gun.explosion ? 4 : 2; i < n; i++) deps.fx("smoke", ...p, dir[0] * 0.03, 0.02, dir[2] * 0.03);
  }
  // TaCZ tracer rounds (tracers.js), one per pellet: from the muzzle on screen, joining the shot's line further out.
  let shotCount = 0;
  function tracers(gun, out) {
    const t = gun.pack?.tracer ?? DEFAULT_TRACER, ray = out.ray;
    if (!deps.tracer || !ray || !isTracerRound(t.interval, shotCount++)) return;
    const p = muzzlePoint(gun, ray), offset = p.map((v, i) => v - ray.origin[i] - ray.dir[i] * MUZZLE_DEPTH);
    for (const { dir, distance } of out.paths ?? []) deps.tracer({ origin: ray.origin, dir, distance, offset, speed: t.speed, life: t.life, color: t.color });
  }
  function impacts(gun, out) {
    const perHit = gun.pellets > 1 ? 2 : 4; // a shotgun's nine pellets already make a spray
    for (const hit of out.impacts) {
      if (hit.entity) { for (let i = 0; i < 3; i++) deps.fx?.("crit", ...hit.point, random() - 0.5, random() * 0.5, random() - 0.5); continue; }
      for (let i = 0; i < perHit; i++) deps.blockHit?.(hit.block, hit.side);
      deps.fx?.("smoke", ...hit.point, 0, 0.01, 0);
    }
    // Hit feedback for the shooter: the kill sound beats a headshot, which beats a body hit (on a gun server: its hit events).
    if (remote()) return;
    if (out.hits.some((h) => h.entity.health <= 0)) hitSound("kill");
    else if (out.hits.some((h) => h.head)) hitSound("head");
    else if (out.hits.length) hitSound("flesh");
  }
  function startReloadSounds(gun, wasEmpty) {
    const s = soundTable(gun);
    schedule.cancel("pump");
    schedule.add((gun.reload.kind === "shell" ? s.start : wasEmpty ? s.empty : s.tactical) ?? [], ev, "reload");
  }

  // Other players' shots on a gun server (combat.js `shot`): the report where they stand, their tracers and the impacts.
  const remoteShots = new Map();
  function remoteShot(e) {
    const gun = GUNS[e.gun];
    if (!gun || !Array.isArray(e.origin) || !Array.isArray(e.paths)) return;
    const [x, y, z] = e.origin;
    shotSound(gun, e.silenced, { position: { x, y, z } });
    const t = gun.pack?.tracer ?? DEFAULT_TRACER, n = remoteShots.get(e.id) ?? 0;
    remoteShots.set(e.id, n + 1);
    for (const [dx, dy, dz, distance] of e.paths) {
      const dir = [dx, dy, dz];
      if (n === 0 || isTracerRound(t.interval, n)) deps.tracer?.({ origin: e.origin, dir, distance, offset: [0, 0, 0], speed: t.speed, life: t.life, color: t.color });
    }
    const d = e.paths[0];
    if (d) deps.fx?.("flame", x + d[0] * 0.7, y + d[1] * 0.7 - 0.15, z + d[2] * 0.7, d[0] * 0.02, d[1] * 0.02, d[2] * 0.02);
    for (const hit of Array.isArray(e.impacts) ? e.impacts : []) {
      if (!Array.isArray(hit.point)) continue;
      if (hit.player != null) { for (let i = 0; i < 3; i++) deps.fx?.("crit", ...hit.point, random() - 0.5, random() * 0.5, random() - 0.5); continue; }
      if (Array.isArray(hit.block)) for (let i = 0; i < (gun.pellets > 1 ? 1 : 3); i++) deps.blockHit?.(hit.block, hit.side);
      deps.fx?.("smoke", ...hit.point, 0, 0.01, 0);
    }
  }

  return {
    controller, aim, recoil,
    holdingGun,
    // One gun-server event addressed to this player (gun-simulation.js send/near).
    serverEvent(e) {
      if (e?.type === "hit") hitSound(e.kill ? "kill" : e.melee ? null : e.head ? "head" : "flesh");
      else if (e?.type === "shot") remoteShot(e);
    },
    holdingMelee: melee.holding,
    speed: melee.speed,
    cancelMelee: () => melee.cancel(),
    // key.attack pressed (down) or released while playing. True when a gun took it.
    attack(down) {
      tapTicks = 0;
      if (melee.holding()) { melee.press("left", down); forward("melee-left", down); return true; }
      if (!down) { melee.press("left", false); forward("melee-left", false); }
      if (!holdingGun()) { if (!down) { controller.release(); forward("trigger", false); } return false; }
      if (down) controller.press(); else controller.release();
      forward("trigger", down);
      return true;
    },
    // A tap with no held button (the touch break button, a click without pointer lock): one trigger pull. True when a gun took it.
    tap() {
      if (melee.press("left", true, true)) { forward("melee-left", true); return true; }
      if (!holdingGun()) return false;
      controller.press(); forward("trigger", true);
      tapTicks = 20;
      return true;
    },
    // key.use pressed (down) or released: aim down sights while it is held. True when a gun took the press.
    aimHold(down) {
      if (melee.holding()) { melee.press("right", down); forward("melee-right", down); return true; }
      if (!down) { melee.press("right", false); forward("melee-right", false); }
      if (!down) { aim.held = false; forward("aim", false); return false; }
      if (!holdingGun()) return false;
      aim.held = true; forward("aim", true);
      stopInspect();
      return true;
    },
    // The touch use button: each tap toggles aiming.
    aimToggle() {
      if (melee.press("right", true, true)) { forward("melee-right", true); return true; }
      if (!holdingGun()) return false;
      aim.held = !aim.held; forward("aim", aim.held);
      if (aim.held) stopInspect();
      return true;
    },
    // A raw key press while playing with no screen open: R reloads, G switches fire mode.
    key(code) {
      if (melee.key(code)) return true;
      const gun = heldGun();
      if (!gun) return false;
      if (code === KEY_R) {
        forward("reload");
        const wasEmpty = rounds(held()) <= 0;
        if (controller.startReload(inventory())) {
          stopInspect();
          startReloadSounds(gun, wasEmpty);
          const r = controller.reload;
          anim.reload = { kind: r.kind, at: now(), time: r.time, shellAt: -Infinity, endAt: null, empty: wasEmpty, shells: 0 };
        }
        return true;
      }
      if (code === KEY_F) {
        if (controller.reload || controller.draw > 0 || aim.held) return true;
        stopInspect();
        anim.inspectAt = now(); anim.inspectEmpty = rounds(held()) <= 0;
        const keys = (gun.base ?? gun).inspectSounds; // a gun with parts fitted is a copy made before its sounds loaded (fit.js)
        if (keys) schedule.add((anim.inspectEmpty && keys.empty?.length ? keys.empty : keys.full) ?? [], ev, "inspect");
        return true;
      }
      // The attachment screen (main.js), not mid-reload or while drawing, as TaCZ's refit screen.
      if (code === KEY_Z) { if (!controller.reload && controller.draw <= 0) { stopInspect(); controller.release(); aim.held = false; deps.attachments?.(); } return true; }
      if (code === KEY_G) {
        const mode = controller.toggleMode(held());
        if (mode) { forward("mode"); const label = modeLabel(gun, mode); deps.toast(`${gun.name}: ${MODE_NAMES[label] ?? label}`); shared("mode"); }
        return true;
      }
      return false;
    },
    // The fovMultiplier `bow` factor this tick: the iron-sight zoom while aiming.
    fov() { const gun = heldGun(); return gun ? aim.fov(gun) : 1; },
    // Once per rendered frame: the recoil turn, in radians, to add to [pitch, yaw].
    frame() {
      if (pendingKick && now() >= pendingKick.at) { recoil.kick(pendingKick.gun, pendingKick.aim, pendingKick.at, random); pendingKick = null; }
      if (!recoil.active) return [0, 0];
      const [p, y] = recoil.frame(now());
      return [p * RAD, y * RAD];
    },
    // A world was loaded: start from rest, with the crosshair shown.
    reset() {
      melee.reset();
      controller.release(); controller.heldKey = null; controller.reload = null;
      for (const k of Object.keys(sent)) delete sent[k];
      remoteShots.clear();
      tapTicks = 0; shotCount = 0; aim.held = false; aim.progress = 0; recoil.reset(); schedule.cancel();
      pendingKick = null;
      Object.assign(anim, { drawAt: -Infinity, shotAt: -Infinity, prevShotAt: -Infinity, reload: null, aimFrom: 0, aimTo: 0, inspectAt: -Infinity });
      deps.hud?.(null);
      if (!crosshair) { crosshair = true; deps.crosshair?.(true); }
    },
    // Once per rendered frame: the first-person model's state (model.js gunViewPose), or null without a gun in hand.
    view() {
      if (melee.holding()) return melee.view();
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
        sinceShot: s(anim.shotAt <= t ? anim.shotAt : anim.prevShotAt),
        draw: anim.drawTime > 0 ? Math.min(1, s(anim.drawAt) / anim.drawTime) : 1,
        sinceDraw: s(anim.drawAt),
        empty: rounds(held()) <= 0,
        mode: controller.mode(gun.id),
        reload, timeline,
        sinceInspect: s(anim.inspectAt), inspectEmpty: anim.inspectEmpty,
        gun, // with its attachments (fit.js): the views draw its parts
      };
    },
    // The ammo counter's state (hud.js), or null without a gun in hand.
    hudState() {
      const stack = held(), inv = deps.survival.inventory;
      return ammoHudState(stack, { count: (id) => carriedAmmo(inv.main, id), creative: deps.survival.creative, mode: controller.mode(stack?.id), reloading: !!controller.reload });
    },
    // Once per game tick.
    tick() {
      const meleeEvents = melee.tick();
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
          pendingKick = null;
          Object.assign(anim, { drawAt: now(), drawTime: g.draw, shotAt: -Infinity, prevShotAt: -Infinity, reload: null, aimFrom: 0, aimTo: 0, inspectAt: -Infinity });
          sound(ev(s.draw)); deps.preload?.(soundFolder(g)); deps.drawn?.(g);
        }
        if (event.type === "shot") {
          event.result = shoot(g); changed = true;
          // TaCZ times each shot to the millisecond inside the tick (LocalPlayerShoot): its sound, kick and model follow `at`.
          const shotAt = now() + (event.at ?? 0) * 1000;
          if (pendingKick) recoil.kick(pendingKick.gun, pendingKick.aim, pendingKick.at, random);
          pendingKick = { gun: g, aim: aim.progress, at: shotAt };
          if (anim.shotAt <= now()) anim.prevShotAt = anim.shotAt;
          anim.shotAt = shotAt; stopInspect();
          if (anim.reload?.kind === "shell" && anim.reload.endAt == null) anim.reload.endAt = now(); // the trigger stopped the loading
          shotSound(g, g.silenced, { delay: event.at ?? 0 }); // a silencer: the pack's own suppressed report
          if (s.pump) { schedule.cancel("pump"); schedule.add(s.pump, ev, "pump"); }
          muzzle(g, event.result.ray ?? deps.eye() ?? { origin: [0, 0, 0], dir: [0, 0, -1] });
          impacts(g, event.result); tracers(g, event.result);
        }
        if (event.type === "empty") shared("dry", { pitch: shotPitch() });
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
      // A trigger, aim or knife button let go here (a tap that fired, a screen opened, the gun put away) is let go on the server too.
      forward("trigger", controller.trigger); forward("aim", aim.held);
      forward("melee-left", melee.controller.held.left); forward("melee-right", melee.controller.held.right);
      deps.hud?.(this.hudState());
      return [...events, ...meleeEvents];
    },
  };
}
