// Guns mod (not 1.7.10): this project's own box models of the three guns, and where the first-person view holds them.
// Models are in pixels (1/16 block): the barrel points along -z, +y is up and the origin is where the hand holds the grip.
// The poses are pure functions of a view state (hooks.js view()), so tests can check them without WebGL.
import * as THREE from "three";
import { P320, AKM, M870 } from "./catalog.js";

const RAD = Math.PI / 180;
const STEEL = [0.2, 0.2, 0.22], BRIGHT = [0.34, 0.34, 0.36], POLY = [0.11, 0.11, 0.12],
  WOOD = [0.5, 0.28, 0.13], WOOD_DARK = [0.38, 0.2, 0.09], BAKELITE = [0.52, 0.22, 0.1], RUBBER = [0.06, 0.06, 0.06];

// Each box: [from, to, color, part?]. Parts move on their own: "mag" drops out on a reload, "slide" (P320) cycles on a
// shot and locks back on empty, "pump" (M870) racks after a shot. `muzzle` is the barrel's end; `sight` the height of the
// sight line (the rear notch and front post line up there); `rear` how far back the eye sits behind the origin when aimed.
export const GUN_MODELS = {
  [P320]: {
    sight: 4.5, rear: 14,
    muzzle: [0, 2.7, -8.6],
    boxes: [
      [[-1, 1.5, -8], [1, 4, 1.5], POLY, "slide"],
      [[-0.8, 4, -7.7], [-0.2, 4.6, -7.1], STEEL, "slide"], [[0.2, 4, -7.7], [0.8, 4.6, -7.1], STEEL, "slide"], // front sight dots
      [[-0.2, 4, -7.7], [0.2, 4.5, -7.1], BRIGHT, "slide"],
      [[-0.9, 4, 0.6], [-0.25, 4.6, 1.3], STEEL, "slide"], [[0.25, 4, 0.6], [0.9, 4.6, 1.3], STEEL, "slide"], // rear notch
      [[-0.45, 2.3, -8.4], [0.45, 3.1, -8], BRIGHT],
      [[-0.9, 0.4, -7.4], [0.9, 1.5, 0.8], POLY],
      [[-0.4, -1.2, -3.8], [0.4, -0.6, -0.4], POLY], [[-0.4, -0.6, -3.8], [0.4, 0.4, -3.2], POLY], // trigger guard
      [[-0.15, -0.6, -1.9], [0.15, 0.4, -1.5], STEEL], // trigger
      [[-1, -5, -0.6], [1, 0.4, 2.1], POLY], // grip
      [[-0.7, -5, -0.3], [0.7, 0.2, 1.7], STEEL, "mag"], [[-0.85, -5.7, -0.4], [0.85, -5, 1.9], POLY, "mag"],
    ],
  },
  [AKM]: {
    sight: 4.5, rear: 18,
    muzzle: [0, 1.4, -21.8],
    boxes: [
      [[-1, 0, -6], [1, 3, 6], STEEL], // receiver
      [[-0.9, 3, -5], [0.9, 3.5, 5.5], STEEL], // dust cover
      [[1, 2, -4], [1.4, 2.6, -1.5], BRIGHT], // charging handle
      [[-1.2, -0.2, -13], [1.2, 2.2, -6], WOOD], // lower handguard
      [[-0.9, 2.2, -12.5], [0.9, 3.4, -6.5], WOOD_DARK], // upper handguard over the gas tube
      [[-0.6, 2.2, -14.2], [0.6, 3.5, -12.5], STEEL], // gas block
      [[-0.4, 1, -20], [0.4, 1.8, -13], STEEL], // barrel
      [[-0.5, 1.8, -17.6], [0.5, 3.6, -16.4], STEEL], [[-0.15, 3.6, -17.2], [0.15, 4.5, -16.8], STEEL], // front post
      [[-0.55, 0.85, -21.6], [0.55, 1.95, -20], STEEL], // muzzle brake
      [[-0.7, 3.5, -4.6], [0.7, 4, -3.4], STEEL], [[-0.7, 4, -4.4], [-0.2, 4.7, -3.6], STEEL], [[0.2, 4, -4.4], [0.7, 4.7, -3.6], STEEL], // rear sight
      [[-0.3, -1.6, -1.8], [0.3, -1.1, 1.6], STEEL], [[-0.3, -1.1, -1.8], [0.3, 0, -1.3], STEEL], // trigger guard
      [[-0.9, -5, 1.4], [0.9, 0, 3.6], WOOD_DARK], // pistol grip
      [[-1, -0.8, 6], [1, 2.6, 10], WOOD], [[-1, -2.6, 10], [1, 2.6, 14], WOOD], [[-1.05, -2.6, 14], [1.05, 2.6, 14.6], STEEL], // stock
      [[-0.8, -4, -4.6], [0.8, 0, -1.6], BAKELITE, "mag"], [[-0.8, -7, -5.6], [0.8, -4, -2.6], BAKELITE, "mag"],
      [[-0.8, -9.2, -6.8], [0.8, -7, -3.8], BAKELITE, "mag"],
    ],
  },
  [M870]: {
    sight: 3.8, rear: 16,
    muzzle: [0, 2.8, -21.4],
    boxes: [
      [[-1.1, 0, -5], [1.1, 3.5, 3], STEEL], // receiver
      [[1.1, 0.6, -3.6], [1.2, 2.4, -0.4], POLY], // ejection port
      [[-0.6, 2.2, -21], [0.6, 3.4, -5], STEEL], [[-0.2, 3.4, -20.7], [0.2, 3.8, -20.3], BRIGHT], // barrel and bead
      [[-0.6, 0.6, -17], [0.6, 2, -5], STEEL], [[-0.7, 0.5, -17.7], [0.7, 2.1, -17], BRIGHT], // magazine tube
      [[-1.25, 0.1, -13], [1.25, 2.5, -7], POLY, "pump"], [[-0.4, 1.6, -7], [0.4, 2.2, -4.6], STEEL, "pump"], // forend and bar
      [[-0.4, -1.5, -2], [0.4, -1, 1], STEEL], [[-0.4, -1, -2], [0.4, 0, -1.4], STEEL], [[-0.15, -1, -0.6], [0.15, 0, -0.2], STEEL],
      [[-1, -1.4, 3], [1, 2.6, 7], WOOD], [[-1, -3.2, 7], [1, 2.4, 13], WOOD], [[-1.05, -3.2, 13], [1.05, 2.4, 14], RUBBER], // stock
    ],
  },
};

// First-person placement in the hand camera's space (x right, y up, -z ahead), in blocks: the grip from the hip, and the
// gun scale (blocks per model pixel). Aimed, the sight line sits on the view axis `rear` pixels ahead of the eye.
export const VIEW_SCALE = 1 / 32;
const HIP = { [P320]: [0.22, -0.2, -0.62], [AKM]: [0.21, -0.22, -0.42], [M870]: [0.21, -0.21, -0.42] };
const HIP_YAW = 4; // degrees the hip gun turns toward the centre of the view
// Per-shot kick of the model (not the camera): how far it moves back (blocks) and up (degrees), and how long it settles (s).
const KICK = { [P320]: [0.045, 7, 0.08], [AKM]: [0.03, 2.5, 0.06], [M870]: [0.08, 13, 0.12] };

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const smooth = (v) => { const t = clamp01(v); return t * t * (3 - 2 * t); };
const ramp = (t, a, b) => smooth((t - a) / (b - a));

// The view state's gun animation: `{ position: [x, y, z], rotation: [x, y, z] (radians, applied y, x then z),
// parts: { mag: { offset, visible }, slide, pump } }`. state: { aim 0..1, sinceShot s, draw 0..1, empty,
// reload: null | { kind: "magazine", t 0..1 } | { kind: "shell", sinceStart, start (s), sinceShell, sinceEnd } }.
export function gunViewPose(gunId, state = {}) {
  const model = GUN_MODELS[gunId], hip = HIP[gunId];
  const aim = smooth(state.aim ?? 0), hipness = 1 - aim;
  const aimPos = [0, -model.sight * VIEW_SCALE, -model.rear * VIEW_SCALE];
  const position = hip.map((v, i) => v + (aimPos[i] - v) * aim);
  const rotation = [0, HIP_YAW * RAD * hipness, 0];
  const parts = { mag: { offset: [0, 0, 0], visible: true }, slide: 0, pump: 0 };

  // Shot: a sharp kick back and up that settles; smaller when aimed, as the shoulder takes it.
  const t = state.sinceShot ?? Infinity, [back, up, settle] = KICK[gunId];
  const kick = t < 0.025 ? t / 0.025 : t < 0.6 ? Math.exp(-(t - 0.025) / settle) : 0, hold = 1 - 0.5 * aim;
  position[2] += back * kick * hold;
  rotation[0] += up * RAD * kick * hold;
  if (gunId === P320) parts.slide = state.empty ? 1.8 : 1.8 * (t < 0.02 ? t / 0.02 : clamp01(1 - (t - 0.02) / 0.05));
  if (gunId === M870) {
    const rack = ramp(t, 0.1, 0.22) - ramp(t, 0.3, 0.42);
    parts.pump = 4.5 * rack;
    rotation[2] += 6 * RAD * rack;
  }

  // Reloads: lower and roll the gun; a magazine drops out and a fresh one comes up from below.
  const r = state.reload;
  if (r?.kind === "magazine") {
    const env = ramp(r.t, 0, 0.12) * (1 - ramp(r.t, 0.82, 1));
    position[0] -= 0.05 * env; position[1] -= 0.05 * env;
    rotation[0] += 10 * RAD * env; rotation[2] += 25 * RAD * env;
    const out = ramp(r.t, 0.18, 0.36), back = 1 - ramp(r.t, 0.55, 0.72), drop = r.t < 0.46 ? out : back;
    parts.mag.offset = [0, -16 * drop, gunId === AKM ? 3 * drop : 0];
    parts.mag.visible = drop < 0.999;
  } else if (r?.kind === "shell") {
    const env = r.sinceEnd != null ? 1 - ramp(r.sinceEnd, 0, 0.3) : ramp(r.sinceStart, 0, Math.max(0.1, r.start * 0.6));
    const push = Math.sin(Math.PI * clamp01((r.sinceShell ?? Infinity) / 0.25));
    position[0] -= 0.06 * env; position[1] += 0.02 * env - 0.015 * push;
    rotation[0] += (8 * env + 3 * push) * RAD; rotation[2] += 32 * RAD * env;
  }

  // Draw: the gun comes up from below the view.
  const d = 1 - Math.pow(1 - clamp01(state.draw ?? 1), 3);
  position[1] -= 0.35 * (1 - d);
  rotation[0] -= 35 * RAD * (1 - d);
  return { position, rotation, parts, aim };
}

// The pose as a matrix from model pixels to hand-camera space, after the vanilla view bob (scaled down while aiming).
export function gunViewMatrix(gunId, pose, bob = null, sway = null) {
  const m = new THREE.Matrix4(), s = new THREE.Matrix4(), k = 1 - 0.85 * pose.aim;
  if (bob) m.multiply(s.makeTranslation(bob.x * k, bob.y * k, 0)).multiply(s.makeRotationZ(bob.rz * k)).multiply(s.makeRotationX(bob.rx * k));
  if (sway) m.multiply(s.makeRotationX((sway.x || 0) * k)).multiply(s.makeRotationY((sway.y || 0) * k));
  m.multiply(s.makeTranslation(...pose.position));
  m.multiply(s.makeRotationY(pose.rotation[1])).multiply(s.makeRotationX(pose.rotation[0])).multiply(s.makeRotationZ(pose.rotation[2]));
  return m.multiply(s.makeScale(VIEW_SCALE, VIEW_SCALE, VIEW_SCALE));
}

// Where the muzzle is in hand-camera space (blocks; no view bob). A TaCZ pack gun's first-person view (pack-view.js)
// sets its muzzle here each frame; a gun with neither falls back to a point ahead of the right hand.
export const muzzleOverride = new Map();
export function gunMuzzle(gunId, state = {}) {
  if (muzzleOverride.has(gunId)) return muzzleOverride.get(gunId);
  if (!GUN_MODELS[gunId]) return [0.3, -0.25, -1.2];
  const v = new THREE.Vector3(...GUN_MODELS[gunId].muzzle);
  return v.applyMatrix4(gunViewMatrix(gunId, gunViewPose(gunId, state))).toArray();
}

// The third-person hold, in the biped's right-arm space (blocks, +y along the arm): the grip in the hand, the barrel
// along the raised arm and the gun's top towards the back of the hand (which faces up while aiming).
export const HELD_SCALE = 1 / 40;
export function gunHeldMatrix(scale = HELD_SCALE) {
  const m = new THREE.Matrix4().makeTranslation(-1 / 16, 9 / 16, -1 / 16);
  m.multiply(new THREE.Matrix4().makeBasis(new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, -1, 0)));
  return m.multiply(new THREE.Matrix4().makeScale(scale, scale, scale));
}
// ModelBiped arm angles while holding a gun: both arms raised along the look direction, the left one across to the
// forend (the aimed-bow pose of later versions; 1.7.10 has none). `head` is the head's [pitch, yaw] in radians.
export function gunArmPose(head) {
  return {
    rightArm: [-Math.PI / 2 + head[0], -0.1 + head[1], 0],
    leftArm: [-Math.PI / 2 + head[0], 0.5 + head[1], 0],
  };
}

const FLASH = [[[-0.8, -0.8, -3], [0.8, 0.8, 0]], [[-2.2, -0.35, -1.4], [2.2, 0.35, -0.6]], [[-0.35, -2.2, -1.4], [0.35, 2.2, -0.6]]];
// The model as a three.js group: one mesh per box, grouped by part, plus a hidden muzzle flash at the muzzle.
// `material(options)` makes the lit materials (one per colour); the flash is unlit and additive.
export function buildGunMesh(gunId, material) {
  const spec = GUN_MODELS[gunId], root = new THREE.Group(), parts = {}, colors = new Map();
  const box = (from, to) => {
    const g = new THREE.BoxGeometry(to[0] - from[0], to[1] - from[1], to[2] - from[2]);
    g.translate((from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2);
    return g;
  };
  for (const [from, to, color, part] of spec.boxes) {
    const key = color.join();
    if (!colors.has(key)) colors.set(key, material({ map: null, color }));
    if (part && !parts[part]) root.add(parts[part] = new THREE.Group());
    (part ? parts[part] : root).add(new THREE.Mesh(box(from, to), colors.get(key)));
  }
  const flash = new THREE.Group(), hot = new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
  for (const [from, to] of FLASH) flash.add(new THREE.Mesh(box(from, to), hot));
  flash.position.set(...spec.muzzle);
  flash.visible = false;
  root.add(flash);
  root.userData = { parts, flash, gunId };
  return root;
}
// Moves a built model's parts to a pose's part offsets (pixels) and shows the flash for the first 50 ms of a shot.
export function applyGunParts(mesh, pose, sinceShot = Infinity) {
  const { parts, flash } = mesh.userData;
  if (parts.mag) { parts.mag.position.set(...pose.parts.mag.offset); parts.mag.visible = pose.parts.mag.visible; }
  if (parts.slide) parts.slide.position.z = pose.parts.slide;
  if (parts.pump) parts.pump.position.z = pose.parts.pump;
  flash.visible = sinceShot < 0.05;
  if (flash.visible) flash.rotation.z = (Math.floor(sinceShot * 1e3) % 4) * 0.4;
}
