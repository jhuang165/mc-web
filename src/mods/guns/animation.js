// Guns mod (not 1.7.10): plays the Bedrock animation files of the TaCZ gun pack (animations/<gun>.animation.json and the
// mod's rifle/pistol defaults) on a model built by bedrock.js. Keyframes interpolate as Blockbench and TaCZ do: from one
// key's `post` to the next key's `pre`, linear, or Catmull-Rom when either key asks for it, `step` holding; a channel
// given as one vector is constant. Values convert like the geometry: rotation degrees [-x, -y, z] added to the rest
// rotation, position pixels [-x, y, z] added to the rest offset, scale multiplied. Molang expressions are not evaluated
// (the pack's channels are plain numbers); a string that is not a number counts as 0.
import * as THREE from "three";

const RAD = Math.PI / 180;
const num = (v) => { const n = typeof v === "number" ? v : parseFloat(v); return Number.isFinite(n) ? n : 0; };
const vec = (v, fill) => (Array.isArray(v) ? [num(v[0]), num(v[1] ?? v[0]), num(v[2] ?? v[0])] : v == null ? [fill, fill, fill] : [num(v), num(v), num(v)]);

// A channel as sorted keys { t, pre, post, lerp }.
function track(channel, fill) {
  if (channel == null) return null;
  if (Array.isArray(channel) || typeof channel !== "object") { const v = vec(channel, fill); return [{ t: 0, pre: v, post: v, lerp: "linear" }]; }
  const keys = [];
  for (const [time, k] of Object.entries(channel)) {
    const t = num(time);
    if (Array.isArray(k) || typeof k !== "object") { const v = vec(k, fill); keys.push({ t, pre: v, post: v, lerp: "linear" }); continue; }
    const post = vec(k.post ?? k.pre, fill), pre = k.pre != null ? vec(k.pre, fill) : post;
    keys.push({ t, pre, post, lerp: k.lerp_mode ?? "linear" });
  }
  keys.sort((a, b) => a.t - b.t);
  return keys.length ? keys : null;
}

const catmull = (p0, p1, p2, p3, t) => {
  const t2 = t * t, t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
};
// The channel's value at `t` seconds.
export function sampleTrack(keys, t, out = [0, 0, 0]) {
  const n = keys.length;
  if (t <= keys[0].t) { out[0] = keys[0].pre[0]; out[1] = keys[0].pre[1]; out[2] = keys[0].pre[2]; return out; }
  if (t >= keys[n - 1].t) { const p = keys[n - 1].post; out[0] = p[0]; out[1] = p[1]; out[2] = p[2]; return out; }
  let i = 0;
  while (i < n - 2 && t >= keys[i + 1].t) i++;
  const a = keys[i], b = keys[i + 1], f = (t - a.t) / (b.t - a.t || 1);
  if (a.lerp === "step") { out[0] = a.post[0]; out[1] = a.post[1]; out[2] = a.post[2]; return out; }
  if (a.lerp === "catmullrom" || b.lerp === "catmullrom") {
    const before = (keys[i - 1] ?? a).post, after = (keys[i + 2] ?? b).pre;
    for (let j = 0; j < 3; j++) out[j] = catmull(before[j], a.post[j], b.pre[j], after[j], f);
    return out;
  }
  for (let j = 0; j < 3; j++) out[j] = a.post[j] + (b.pre[j] - a.post[j]) * f;
  return out;
}

// An animation file as Map name -> { length, loop, hold, bones: Map bone -> { rotation, position, scale }, sounds: [[t, path]] }.
export function parseAnimations(json) {
  const out = new Map();
  for (const [name, a] of Object.entries(json?.animations ?? {})) {
    const bones = new Map();
    let end = 0;
    for (const [bone, ch] of Object.entries(a.bones ?? {})) {
      const t = { rotation: track(ch.rotation, 0), position: track(ch.position, 0), scale: track(ch.scale, 1) };
      for (const k of [t.rotation, t.position, t.scale]) if (k) end = Math.max(end, k[k.length - 1].t);
      bones.set(bone, t);
    }
    const sounds = [];
    for (const [time, e] of Object.entries(a.sound_effects ?? {})) {
      for (const one of [].concat(e)) if (one?.effect) sounds.push([num(time), String(one.effect).replace(/^tacz:/, "")]);
    }
    sounds.sort((x, y) => x[0] - y[0]);
    out.set(name, { name, length: num(a.animation_length) || end, loop: a.loop === true, hold: a.loop === "hold_on_last_frame", bones, sounds });
  }
  return out;
}

// One frame's pose: per bone, rotation (degrees, Bedrock axes), position (pixels) and scale. Layers apply in order;
// `mode: "set"` replaces the channels an animation keys (TaCZ's static and main tracks), "add" adds to them (shoot).
export class Pose {
  constructor() { this.bones = new Map(); }
  clear() { this.bones.clear(); return this; }
  channel(bone) {
    let b = this.bones.get(bone);
    if (!b) this.bones.set(bone, b = { rotation: [0, 0, 0], position: [0, 0, 0], scale: [1, 1, 1] });
    return b;
  }
  apply(anim, time, mode = "set", weight = 1) {
    if (!anim) return this;
    const t = anim.loop && anim.length > 0 ? time % anim.length : time;
    const v = [0, 0, 0];
    for (const [bone, ch] of anim.bones) {
      const b = this.channel(bone);
      for (const key of ["rotation", "position", "scale"]) {
        if (!ch[key]) continue;
        sampleTrack(ch[key], t, v);
        const dst = b[key], rest = key === "scale" ? 1 : 0;
        for (let j = 0; j < 3; j++) {
          if (mode === "add") dst[j] = key === "scale" ? dst[j] * (1 + (v[j] - 1) * weight) : dst[j] + v[j] * weight;
          else dst[j] = weight >= 1 ? v[j] : dst[j] + (v[j] - (mode === "set" ? dst[j] : rest)) * weight;
        }
      }
    }
    return this;
  }
}

// Moves a bedrock.js model's bones to rest plus the pose.
export function applyPose(model, pose) {
  for (const [name, g] of model.bones) {
    const r = model.rest.get(name), p = pose.bones.get(name);
    g.position.copy(r.position);
    g.rotation.copy(r.rotation);
    g.scale.set(1, 1, 1);
    if (!p) continue;
    g.position.x -= p.position[0]; g.position.y += p.position[1]; g.position.z += p.position[2];
    g.rotation.x -= p.rotation[0] * RAD; g.rotation.y -= p.rotation[1] * RAD; g.rotation.z += p.rotation[2] * RAD;
    g.scale.set(p.scale[0] || 1e-4, p.scale[1] || 1e-4, p.scale[2] || 1e-4);
  }
}

// The animation to show by name, from the gun's own file, else the mod's default file for its kind (rifle / pistol).
export const pick = (own, defaults, ...names) => {
  for (const n of names) if (own?.has(n)) return own.get(n);
  for (const n of names) if (defaults?.has(n)) return defaults.get(n);
  return null;
};

// The layers for one frame from hooks.js view(): which animations play and at what time.
// state: { sinceDraw, sinceShot, empty, mode, bolt, timeline: { kind, since, empty, sinceShell, shells, sinceEnd } | null }.
export function gunLayers(own, defaults, state) {
  const layers = [];
  const base = pick(own, defaults, "static_idle", "idle");
  if (base) layers.push([base, 0, "set"]);
  const mode = pick(own, null, `static_${state.mode}`);
  if (mode) layers.push([mode, 0, "set"]);
  if (state.empty) { const caught = pick(own, null, "static_bolt_caught"); if (caught) layers.push([caught, 0, "set"]); }
  const main = mainAnimation(own, defaults, state);
  if (main) layers.push([main.anim, main.time, "set"]);
  const shoot = pick(own, null, "shoot");
  if (shoot && state.sinceShot >= 0 && state.sinceShot < shoot.length && !(main && main.time < state.sinceShot)) layers.push([shoot, state.sinceShot, "add"]);
  return layers;
}
function mainAnimation(own, defaults, s) {
  const tl = s.timeline, playing = (anim, time) => (anim && time >= 0 && (time < anim.length || anim.hold) ? { anim, time: Math.min(time, anim.length) } : null);
  // A reload in progress (or its last frames), unless the gun has fired since it began.
  if (tl && !(s.sinceShot < tl.since)) {
    if (tl.kind === "magazine") {
      const anim = pick(own, defaults, tl.empty ? "reload_empty" : "reload_tactical", "reload_tactical", "reload_empty");
      const r = playing(anim, tl.since);
      if (r) return r;
    } else {
      if (tl.sinceEnd != null) { const r = playing(pick(own, defaults, "reload_end"), tl.sinceEnd); if (r) return r; }
      else if (tl.shells > 0) { const loop = pick(own, defaults, "reload_loop"); if (loop) return { anim: loop, time: Math.min(tl.sinceShell, loop.length) }; }
      else { const intro = pick(own, defaults, tl.empty ? "reload_intro_empty" : "reload_intro", "reload_intro"); if (intro) return { anim: intro, time: Math.min(tl.since, intro.length) }; }
    }
  }
  // A manual action (pump, bolt) works its action after each shot: TaCZ's "bolt" animation, from the shot.
  if (s.bolt === "manual_action") { const r = playing(pick(own, null, "bolt"), s.sinceShot); if (r) return r; }
  return playing(pick(own, defaults, "draw"), s.sinceDraw);
}

// Bone transforms: a bedrock.js model posed by the layers.
export function poseModel(model, layers, pose = new Pose()) {
  pose.clear();
  for (const [anim, time, mode] of layers) pose.apply(anim, time, mode);
  applyPose(model, pose);
  return pose;
}

export const _test = { track, THREE };
