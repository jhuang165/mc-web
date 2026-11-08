// Guns mod (not 1.7.10): how a gun feels — camera recoil, aiming down sights and the timing of its sounds. Pure data and
// math; hooks.js drives it. The recoil curves, aim times, zoom and sound keyframes follow the TaCZ default gun pack (version
// 1.2.0): data/guns/<gun>_data.json "recoil", display/<gun>_display.json "iron_zoom", and the "sound_effects" keyframes
// of the animations in assets/tacz/animations/<gun>.animation.json. The algorithm is TaCZ's GunRecoil and camera hook,
// read from its class files.
import { TICK } from "./firing.js";
import { P320, AKM, M870, GUNS } from "./catalog.js";

// TaCZ recoil keyframes: [time in seconds, [min, max] degrees]. Each shot draws one value per keyframe between min and max.
// Positive pitch kicks the view up; positive yaw turns it left (TaCZ subtracts both from Minecraft's xRot and yRot).
export const RECOIL = {
  [P320]: {
    pitch: [[0, [1, 1]], [0.15, [1, 1]], [0.4, [-0.15, -0.05]], [0.6, [0.15, 0.2]], [1.0, [0, 0]]],
    yaw: [[0, [-0.25, 0.25]], [0.45, [0, 0]]],
  },
  [AKM]: {
    pitch: [[0, [0.8, 0.8]], [0.1, [1.4, 1.4]], [0.15, [0.8, 0.8]], [0.45, [-0.175, -0.175]], [0.6, [0, 0]]],
    yaw: [[0, [-0.23, 0.18]], [0.35, [0, 0]]],
  },
  [M870]: {
    pitch: [[0, [5.5, 5.5]], [0.1, [4.5, 4.5]], [0.13, [5, 5]], [0.4, [-0.5, -0.5]], [0.53, [0.25, 0.25]], [0.65, [0, 0]], [0.7, [0, 0]]],
    yaw: [[0, [-1.75, -1.75]], [0.1, [-1.5, -1.5]], [0.5, [0.15, 0.15]], [0.65, [0, 0]]],
  },
};
// Iron-sight magnification (display "iron_zoom"); none of the three guns has a scope, so there is no scope overlay.
export const IRON_ZOOM = { [P320]: 1.2, [AKM]: 1.33, [M870]: 1.2 };
// The pack's guns carry their own recoil, zoom and sounds (pack.js); the three hand-made guns use the tables here.
export const recoilOf = (id) => RECOIL[id] ?? GUNS[id]?.recoil ?? null;
export const zoomOf = (id) => IRON_ZOOM[id] ?? GUNS[id]?.zoom ?? 1;
export const soundsOf = (id) => GUN_SOUNDS[id] ?? GUNS[id]?.sounds ?? null;

// A natural cubic spline through (xs, ys), as Apache Commons Math's SplineInterpolator builds it (TaCZ's recoil curves).
// Returns f(x), or null outside [xs[0], xs[last]].
export function naturalSpline(xs, ys) {
  const n = xs.length - 1, h = [], mu = [0], z = [0];
  for (let i = 0; i < n; i++) h[i] = xs[i + 1] - xs[i];
  for (let i = 1; i < n; i++) {
    const g = 2 * (xs[i + 1] - xs[i - 1]) - h[i - 1] * mu[i - 1];
    mu[i] = h[i] / g;
    z[i] = ((3 * (ys[i + 1] * h[i - 1] - ys[i] * (xs[i + 1] - xs[i - 1]) + ys[i - 1] * h[i])) / (h[i - 1] * h[i]) - h[i - 1] * z[i - 1]) / g;
  }
  const b = [], c = [], d = [];
  c[n] = 0;
  for (let j = n - 1; j >= 0; j--) {
    c[j] = z[j] - mu[j] * c[j + 1];
    b[j] = (ys[j + 1] - ys[j]) / h[j] - (h[j] * (c[j + 1] + 2 * c[j])) / 3;
    d[j] = (c[j + 1] - c[j]) / (3 * h[j]);
  }
  const f = (x) => {
    if (!(x >= xs[0] && x <= xs[n])) return null;
    let j = 0;
    while (j < n - 1 && x > xs[j + 1]) j++;
    const t = x - xs[j];
    return ys[j] + t * (b[j] + t * (c[j] + t * d[j]));
  };
  f.end = xs[n]; f.endValue = ys[n];
  return f;
}

// GunRecoil.getSplineFunction: an extra (0 ms, 0) knot, then each keyframe 30 ms later than its time.
export function recoilCurve(keyframes, modifier, random = Math.random) {
  const xs = [0], ys = [0];
  for (const [time, [min, max]] of keyframes) {
    xs.push(time * 1000 + 30);
    ys.push((min + random() * (max - min)) * modifier);
  }
  return naturalSpline(xs, ys);
}
// The aiming modifier: full recoil from the hip, divided by the sight's zoom (at most 1.5) when fully aimed.
export const recoilModifier = (gunId, aim) => (1 - aim) + aim / Math.min(Math.sqrt(zoomOf(gunId)), 1.5);

// The camera side of a shot: each frame moves the view by how far the curve went since the last frame. A new shot restarts
// both curves from zero, so a burst's kicks add up the way TaCZ's do.
export class Recoil {
  constructor() { this.pitch = null; this.yaw = null; this.start = 0; this.lastPitch = 0; this.lastYaw = 0; }
  kick(gunId, aim, now, random = Math.random) {
    const data = recoilOf(gunId);
    if (!data?.pitch?.length && !data?.yaw?.length) return;
    const m = recoilModifier(gunId, aim);
    this.pitch = data.pitch?.length ? recoilCurve(data.pitch, m, random) : null;
    this.yaw = data.yaw?.length ? recoilCurve(data.yaw, m, random) : null;
    this.start = now; this.lastPitch = 0; this.lastYaw = 0;
  }
  // Degrees to add to the view this frame: [pitch (up), yaw (left)].
  // A frame past a curve's end takes it to its last keyframe and ends it, so the view settles where the curve does
  // (TaCZ stops at the last frame inside the curve, which leaves a frame-rate-dependent remainder).
  frame(now) {
    const t = now - this.start, step = (f) => (!f ? null : t >= f.end ? f.endValue : f(t));
    const p = step(this.pitch), y = step(this.yaw);
    let dp = 0, dy = 0;
    if (p != null) { dp = p - this.lastPitch; this.lastPitch = p; if (t >= this.pitch.end) this.pitch = null; }
    if (y != null) { dy = y - this.lastYaw; this.lastYaw = y; if (t >= this.yaw.end) this.yaw = null; }
    return [dp, dy];
  }
  get active() { return !!(this.pitch || this.yaw); }
  reset() { this.pitch = this.yaw = null; }
}

// Aiming down sights: progress moves 0 -> 1 over the gun's aim time while use is held, and back as fast when released.
export class Aim {
  constructor() { this.held = false; this.progress = 0; }
  tick(gun) {
    if (!gun) { this.progress = 0; return 0; }
    const step = TICK / gun.aim;
    this.progress = Math.max(0, Math.min(1, this.progress + (this.held ? step : -step)));
    return this.progress;
  }
  // The field of view multiplier, fed to fovMultiplier's `bow` slot: 1 / zoom at full aim, eased in.
  fov(gunId) {
    const zoom = zoomOf(gunId), a = this.progress, e = a * a * (3 - 2 * a);
    return 1 / (1 + (zoom - 1) * e);
  }
}

// Sound keyframes, [seconds from the start, path] per animation. Paths are the files under the pack's tacz_sounds/ folder
// (sounds.js); the AKM's folder is TaCZ's "ak47".
export const GUN_SOUNDS = {
  [P320]: {
    shoot: "p320/p320_shoot", draw: "p320/p320_draw", putAway: "p320/p320_put_away",
    tactical: [[0, "p320/p320_reload_raise"], [0.46, "p320/p320_reload_magrelease"], [0.54, "p320/p320_reload_magout"], [1.0, "p320/p320_reload_maghit"],
      [1.16, "p320/p320_reload_magin"], [1.52, "p320/p320_reload_fast_end"]],
    empty: [[0, "p320/p320_reload_empty_raise"], [0.56, "p320/p320_reload_empty_magrelease"], [0.6, "p320/p320_reload_empty_magout"],
      [0.98, "p320/p320_mag_drop"], [1.06, "p320/p320_reload_empty_maghit"], [1.28, "p320/p320_reload_empty_magin"],
      [1.56, "p320/p320_reload_empty_charge"], [2.04, "p320/p320_reload_empty_end"]],
  },
  [AKM]: {
    shoot: "ak47/ak47_shoot", draw: "ak47/ak47_draw", putAway: "ak47/ak47_put_away",
    tactical: [[0, "ak47/ak47_reload_raise_shoulder"], [0.35, "ak47/ak47_reload_magout"], [0.9, "ak47/ak47_reload_mvt"], [1.4, "ak47/ak47_reload_magin"],
      [1.5, "ak47/ak47_reload_mvt2"], [2.05, "ak47/ak47_reload_shoulder"]],
    empty: [[0, "ak47/ak47_reload_empty_up"], [0.4, "ak47/ak47_reload_empty_maghit"], [0.5, "ak47/ak47_reload_empty_magout"],
      [0.85, "ak47/ak47_reload_empty_magbump"], [1.15, "ak47/ak47_reload_empty_magin"], [1.3, "ak47/ak47_reload_empty_mag_drop"],
      [1.75, "ak47/ak47_reload_empty_chamber"], [2.05, "ak47/ak47_reload_empty_mvt"], [2.65, "ak47/ak47_reload_empty_shoulder"]],
  },
  [M870]: {
    shoot: "m870/m870_shoot", draw: "m870/m870_draw", putAway: "m870/m870_put_away",
    pump: [[0.1, "m870/m870_bolt_in"], [0.3333, "m870/m870_bolt_out"], [0.6, "m870/12_gauge_shotgun_shell_drop"]], // the shoot animation
    start: [[0, "m870/m870_reload_start_twist"]], // reload_intro
    shell: ["m870/m870_reload_loop_shellin_01", "m870/m870_reload_loop_shellin_02", "m870/m870_reload_loop_shellin_03"], // one per shell loaded
    end: [[0.0333, "m870/m870_reload_end_turnover"]], // reload_end
  },
};
// Shared TaCZ sounds, at the root of tacz_sounds/.
export const SHARED_SOUNDS = { dry: "dry_fire", mode: "fire_select", flesh: "flesh_hit", head: "head_hit", kill: "kill" };

// A queue of keyframed sounds on the game-tick clock, each tagged so a cancelled reload can drop the rest of its sounds.
export class SoundSchedule {
  constructor() { this.time = 0; this.queue = []; }
  add(keyframes, event, tag) {
    for (const [at, file] of keyframes) this.queue.push({ due: this.time + at, file: event(file), tag });
  }
  cancel(tag) { this.queue = tag ? this.queue.filter((q) => q.tag !== tag) : []; }
  // Advance one tick; returns the events now due, in order.
  tick() {
    const due = this.queue.filter((q) => q.due <= this.time + 1e-6).sort((a, b) => a.due - b.due);
    if (due.length) this.queue = this.queue.filter((q) => q.due > this.time + 1e-6);
    this.time += TICK;
    return due.map((q) => q.file);
  }
}
