// RenderEnderman (bnm) with ModelEnderman (bhk, 64 x 32): enderman.png, the full-bright additive enderman_eyes.png pass, the
// held block (renderEquippedItems) and the screaming shake. endermanParts() is the model's pose maths (ModelBiped's swing, then
// ModelEnderman.setRotationAngles); it is bytecode-derived and not probe-replayed (see public/research/enderman.md, Gaps).
// Model (x, y, z) becomes (x, 24 - y, -z) / 16 here and Java's Y and Z rotations change sign, as in wolf-renderer.js.
import * as THREE from "three";
import { skinBox, pixelTexture } from "./first-person.js";
import { entityMaterial } from "./light-material.js";
import { mhCos, mhSin } from "./lighting.js";
import { fromOriginal } from "./block-registry.js";
import { blockTile, tileRect } from "./block-textures.js";
import { trackCubeUv, trackUv } from "./uv-rebake.js";

const f = Math.fround;
const clamp = (v) => (v > 0.4 ? 0.4 : v < -0.4 ? -0.4 : v);
const place = (g, [x, y, z], [rx, ry, rz]) => {
  g.position.set(x / 16, (24 - y) / 16, -z / 16);
  g.rotation.set(rx, -ry, -rz);
};

// Rotation points and angles per part for the pose, in model pixels and radians. `carrying`: a block in hand; `screaming`: the
// open-jaw pose (the head lifts 5 while the headwear, the lower jaw, stays).
export function endermanParts({ limbSwing = 0, limbSwingAmount = 0, age = 0, headYaw = 0, headPitch = 0, carrying = false, screaming = false } = {}) {
  const RAD = f(Math.PI / 180), s = f(limbSwing * f(0.6662));
  // ModelBiped: arms swing 2 * amount * 0.5 with the ageInTicks sway; legs 1.4 * amount. ModelEnderman halves all four and clamps +-0.4.
  const swayX = f(mhSin(f(age * f(0.067))) * f(0.05)), swayZ = f(f(mhCos(f(age * f(0.09))) * f(0.05)) + f(0.05));
  let rArm = f(f(mhCos(f(s + f(Math.PI))) * f(2) * limbSwingAmount * f(0.5)) + swayX), lArm = f(f(mhCos(s) * f(2) * limbSwingAmount * f(0.5)) - swayX);
  let rLeg = f(mhCos(s) * f(1.4) * limbSwingAmount), lLeg = f(mhCos(f(s + f(Math.PI))) * f(1.4) * limbSwingAmount);
  [rArm, lArm, rLeg, lLeg] = [rArm, lArm, rLeg, lLeg].map((a) => clamp(f(a * 0.5)));
  let rArmZ = swayZ, lArmZ = -swayZ;
  if (carrying) { rArm = lArm = -0.5; rArmZ = 0.05; lArmZ = -0.05; }
  const head = [0, screaming ? -18 : -13, 0];
  return {
    head: { point: head, angle: [f(headPitch * RAD), f(headYaw * RAD), 0] },
    headwear: { point: [0, -13, 0], angle: [f(headPitch * RAD), f(headYaw * RAD), 0] },
    body: { point: [0, -14, 0], angle: [0, 0, 0] },
    rightArm: { point: [-3, -12, 0], angle: [rArm, 0, rArmZ] },
    leftArm: { point: [5, -12, 0], angle: [lArm, 0, lArmZ] },
    rightLeg: { point: [-2, -5, 0], angle: [rLeg, 0, 0] },
    leftLeg: { point: [2, -5, 0], angle: [lLeg, 0, 0] },
  };
}

export function createEndermanRig(renderer) {
  const root = new THREE.Group(), skin = entityMaterial(renderer.view.lighting, { map: pixelTexture("/media/1.7.10/entity/enderman/enderman.png") }),
    eyes = new THREE.MeshBasicMaterial({ map: pixelTexture("/media/1.7.10/entity/enderman/enderman_eyes.png"), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
    parts = {}, skinMeshes = [];
  const add = (key, w, h, d, u, v, ox, oy, oz, { mirror = false, glow = false, shrink = 1 } = {}) => {
    const pivot = new THREE.Group(), geometry = skinBox(w, h, d, u, v, 64, 32, mirror), mesh = new THREE.Mesh(geometry, skin);
    pivot.rotation.order = "ZYX";
    mesh.position.set((ox + w / 2) / 16, -(oy + h / 2) / 16, -(oz + d / 2) / 16);
    mesh.scale.setScalar(shrink);
    pivot.add(mesh);
    skinMeshes.push(mesh);
    if (glow) { const pass = new THREE.Mesh(geometry.clone(), eyes); pass.position.copy(mesh.position); pass.renderOrder = 1; pivot.add(pass); }
    parts[key] = pivot;
    root.add(pivot);
    return pivot;
  };
  add("head", 8, 8, 8, 0, 0, -4, -8, -4, { glow: true });
  add("headwear", 8, 8, 8, 0, 16, -4, -8, -4, { shrink: 7 / 8 });
  const body = add("body", 8, 12, 4, 32, 16, -4, 0, -2);
  add("rightArm", 2, 30, 2, 56, 0, -1, -2, -1);
  add("leftArm", 2, 30, 2, 56, 0, -1, -2, -1, { mirror: true });
  add("rightLeg", 2, 30, 2, 56, 0, -1, 0, -1);
  add("leftLeg", 2, 30, 2, 56, 0, -1, 0, -1, { mirror: true });
  // renderEquippedItems: the block sits on the body at (0, 0.6875, -0.75) model units, turned 20 about X and 45 about Y, half size.
  const held = new THREE.Group(), mounts = new THREE.Group();
  mounts.position.set(0, -0.6875, 0.75);
  mounts.rotation.set((20 * Math.PI) / 180, (-45 * Math.PI) / 180, 0);
  mounts.scale.setScalar(0.5);
  mounts.add(held);
  body.add(mounts);
  renderer.scene.add(root);
  return { root, neck: parts.head, limbs: [], materials: [skin], eyes, skinMeshes, type: "enderman", enderman: { parts, held, key: "" } };
}

// The held block as a textured cube from the block atlas (RenderBlocks.renderBlockAsItem); `carried` is the original id.
function setHeld(r, renderer, e, material) {
  const key = `${e.carried}:${e.carriedData}`, st = r.enderman;
  if (st.key === key) return;
  st.key = key;
  for (const child of st.held.children.splice(0)) child.geometry.dispose();
  const cell = e.carried ? fromOriginal(e.carried, e.carriedData || 0) : null;
  if (!cell) return;
  const g = trackCubeUv(new THREE.BoxGeometry(1, 1, 1), (face) => blockTile(cell.id, face, false, cell.meta || 0), 0);
  st.held.add(new THREE.Mesh(g, material));
}

const gaussian = () => (Math.random() + Math.random() + Math.random() + Math.random() - 2) * 1.7;
export function animateEnderman(r, e, pose, renderer) {
  const st = r.enderman, carrying = (e.carried ?? 0) > 0;
  if (!st.material) {
    st.material = entityMaterial(renderer.view.lighting, { map: renderer.view.textures.texture });
    r.materials.push(st.material);
  }
  setHeld(r, renderer, e, st.material);
  const parts = endermanParts({ limbSwing: pose.limbSwing, limbSwingAmount: pose.limbSwingAmount, age: pose.age, headYaw: pose.headYaw, headPitch: pose.headPitch, carrying, screaming: !!e.screaming });
  for (const k of Object.keys(parts)) place(st.parts[k], parts[k].point, parts[k].angle);
  // RenderEnderman.doRender: a screaming enderman shakes (gaussian * 0.02 in x and z).
  if (e.screaming) { r.root.position.x += gaussian() * 0.02; r.root.position.z += gaussian() * 0.02; }
}
