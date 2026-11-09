// Guns mod (not 1.7.10): an LR Tactical melee weapon's own model in first person (melee.js). meleeAssets loads its
// geometry and animations once; PackMeleeView poses it each frame from hooks.js view() the way LR Tactical's melee renderer
// drives the pack's state machine (default_melee_state_machine.lua and the pack's variants):
//   - the base track loops static_idle (a pack with static_idle_1 alternates the two, as the Classic Knife's script does);
//   - the main track plays draw, inspect or an attack once and stops (PLAY_ONCE_STOP), uncovering the base track.
// The camera sits at the model's idle_view bone and the player's arms on its lefthand_pos / righthand_pos placeholders,
// as for the pack guns (pack-view.js).
import * as THREE from "three";
import { parseLenient } from "./json5.js";
import { meleeUrl } from "./melee.js";
import { bedrockGeometry, buildBedrockModel, boneMatrix, MARKER_BONES } from "./bedrock.js";
import { parseAnimations, poseModel, Pose } from "./animation.js";
import { fitArms, handCameraMatrix } from "./pack-view.js";

const fetchJson = (url) => fetch(url).then((r) => (r.ok ? r.text() : null)).then((t) => (t == null ? null : parseLenient(t))).catch(() => null);
const cache = new Map(); // weapon id -> { value, failed, waiters, promise }

// The weapon's { geo, animations } once loaded, else null (and the load starts); `changed` runs when they arrive.
export function meleeAssets(weapon, changed = () => {}, load = fetchJson) {
  if (!weapon?.pack?.model) return null;
  let a = cache.get(weapon.id);
  if (!a) {
    a = { value: null, failed: false, waiters: new Set() };
    cache.set(weapon.id, a);
    a.promise = loadMeleeAssets(weapon, load).then((v) => { a.value = v; a.failed = !v; for (const w of a.waiters) w(); a.waiters.clear(); return v; });
  }
  if (!a.value && !a.failed) a.waiters.add(changed);
  return a.value;
}
export async function loadMeleeAssets(weapon, load = fetchJson) {
  const p = weapon.pack, ns = p.namespace;
  const [geoJson, animJson] = await Promise.all([load(meleeUrl.geo(p.model, ns)), p.animation ? load(meleeUrl.animation(p.animation, ns)) : null]);
  const geo = bedrockGeometry(geoJson);
  const animations = parseAnimations(animJson);
  // TaCZ default knives use melee_push for their close-range attack clip.
  if (!animations.has("melee_1") && animations.has("melee_push")) {
    animations.set("melee_1", animations.get("melee_push")); animations.set("melee_3", animations.get("melee_push"));
  }
  return geo ? { geo, animations } : null;
}

// The clip an action plays. kind: "draw" | "inspect" | "left" | "right"; `count` the left attacks so far (melee_1 and
// melee_2 alternate); `random()` picks among a clip's numbered variants (draw, draw_1, ...), as the pack scripts'
// math.random does. Null when the weapon has no such clip.
export function meleeClip(animations, kind, count = 0, random = Math.random) {
  if (!animations) return null;
  if (kind === "left") return [`melee_${(count % 2) + 1}`, "melee_1"].find((n) => animations.has(n)) ?? null;
  if (kind === "right") return ["melee_3", "melee_1"].find((n) => animations.has(n)) ?? null;
  const names = [kind];
  for (let i = 1; animations.has(`${kind}_${i}`); i++) names.push(`${kind}_${i}`);
  const have = names.filter((n) => animations.has(n));
  return have.length ? have[Math.min(have.length - 1, Math.floor(random() * have.length))] : null;
}

// The base track at `t` seconds since the weapon was drawn: static_idle looping, or static_idle then static_idle_1 in turn.
export function baseLayer(animations, t) {
  const a = animations.get("static_idle") ?? animations.get("idle"), b = animations.get("static_idle_1");
  if (!a) return null;
  if (!b || !(a.length > 0) || !(b.length > 0)) return [a, a.length > 0 ? t % a.length : 0];
  const at = t % (a.length + b.length);
  return at < a.length ? [a, at] : [b, at - a.length];
}

// The layers for one frame. state: { clip, sinceClip, sinceDraw } (hooks.js view()).
export function meleeLayers(animations, state) {
  const layers = [], base = baseLayer(animations, Math.max(0, state.sinceDraw ?? 0));
  if (base) layers.push([base[0], base[1], "set"]);
  const main = state.clip ? animations.get(state.clip) : null;
  if (main && state.sinceClip >= 0 && state.sinceClip < main.length) layers.push([main, state.sinceClip, "set"]);
  return layers;
}

// Static held model, anchored to the pack's thirdperson_hand marker, without its first-person arms.
export function meleeHeldModel(weapon, a, material, texture) {
  const skin = material({ map: texture(meleeUrl.texture(weapon.pack.texture, weapon.namespace)), alphaTest: 0.1, side: THREE.DoubleSide });
  const model = buildBedrockModel(a.geo, () => skin, {
    hiddenCubes: (n) => MARKER_BONES.has(n) || n.endsWith("_view") || n === "camera" || n === "lefthand" || n === "righthand",
  });
  const hand = boneMatrix(model, "thirdperson_hand");
  const inner = new THREE.Group(), group = new THREE.Group();
  inner.matrixAutoUpdate = false;
  if (hand) inner.matrix.copy(hand).invert();
  inner.add(model.root);
  const transform = weapon.pack.transforms.thirdperson_righthand ?? {}, s = transform.scale ?? [1, 1, 1];
  const r = transform.rotation ?? [0, 0, 0], t = transform.translation ?? [0, 0, 0];
  group.scale.set(s[0] / 16, s[1] / 16, s[2] / 16);
  group.rotation.set(-r[0] * Math.PI / 180, -r[1] * Math.PI / 180, r[2] * Math.PI / 180);
  group.position.set(t[0] / 16, t[1] / 16, t[2] / 16);
  group.add(inner);
  group.userData.meleeId = weapon.id;
  return group;
}

export class PackMeleeView {
  constructor(weapon, a, { material, texture, arm }) {
    this.weapon = weapon;
    this.animations = a.animations;
    const skin = material({ map: texture(meleeUrl.texture(weapon.pack.texture, weapon.pack.namespace)), alphaTest: 0.1, side: THREE.DoubleSide });
    this.model = buildBedrockModel(a.geo, () => skin, { hiddenCubes: (n) => MARKER_BONES.has(n) || n.endsWith("_view") || n === "camera" });
    fitArms(this.model, arm);
    this.root = new THREE.Group();
    this.root.matrixAutoUpdate = false;
    this.root.add(this.model.root);
    this.root.userData = { meleeId: weapon.id, pack: true, view: this };
    this.pose = new Pose();
    this.idle = new THREE.Matrix4();
  }
  fov() { return 70; }
  // view: hooks.js view(); bob/sway: first-person-pose.js's. Returns the pivot matrix (camera space, blocks).
  update(view, bob = null, sway = null, out = new THREE.Matrix4()) {
    poseModel(this.model, meleeLayers(this.animations, view), this.pose);
    const idle = boneMatrix(this.model, "idle_view", this.idle) ?? this.idle.identity();
    handCameraMatrix(idle, idle, 0, bob, sway, out);
    this.root.matrix.identity();
    return out;
  }
  dispose() { this.root.traverse((n) => { n.geometry?.dispose(); }); }
}
