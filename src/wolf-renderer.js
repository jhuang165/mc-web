// RenderWolf (bpe) with ModelWolf (bio, 64 x 32): wolf.png, wolf_tame.png, wolf_angry.png and the collar pass
// wolf_collar.png tinted by the fleece colour. wolfParts() is the model's pose maths (setLivingAnimations and
// setRotationAngles) and is checked against public/research/wolf-reference.json; createWolfRig/animateWolf map it onto
// three.js, where model (x, y, z) becomes (x, 24 - y, -z) / 16 and Java's Y and Z rotations change sign.
import * as THREE from "three";
import { skinBox, pixelTexture } from "./first-person.js";
import { entityMaterial } from "./light-material.js";
import { FLEECE_COLORS } from "./sheep.js";
import { mhCos } from "./lighting.js";

const f = Math.fround;
const RAD = f(Math.PI / 180);
// Part letters are ModelWolf's fields: a head, b body, c-f legs (hind right, hind left, front right, front left), g tail, h mane.
// Boxes are [ox, oy, oz, w, h, d, u, v] relative to the part's pivot.
export const WOLF_BOXES = {
  a: [[-3, -3, -2, 6, 6, 4, 0, 0], [-3, -5, 0, 2, 2, 1, 16, 14], [1, -5, 0, 2, 2, 1, 16, 14], [-1.5, 0, -5, 3, 3, 4, 0, 10]],
  b: [[-4, -2, -3, 6, 9, 6, 18, 14]],
  c: [[-1, 0, -1, 2, 8, 2, 0, 18]],
  d: [[-1, 0, -1, 2, 8, 2, 0, 18]],
  e: [[-1, 0, -1, 2, 8, 2, 0, 18]],
  f: [[-1, 0, -1, 2, 8, 2, 0, 18]],
  g: [[-1, 0, -1, 2, 8, 2, 9, 18]],
  h: [[-4, -3, -3, 8, 6, 7, 21, 0]],
};
export const WOLF_TEXTURES = {
  wild: "/media/1.7.10/entity/wolf/wolf.png",
  tame: "/media/1.7.10/entity/wolf/wolf_tame.png",
  angry: "/media/1.7.10/entity/wolf/wolf_angry.png",
  collar: "/media/1.7.10/entity/wolf/wolf_collar.png",
};
// RenderWolf.func_110775_a: a tamed wolf wears wolf_tame (even angry), else an angry one wolf_angry.
export function wolfTexture(w) {
  return w.tamed ? "tame" : w.angry ? "angry" : "wild";
}
const cosSwing = (s, a, add = 0) => f(f(mhCos(f(f(f(s) * f(0.6662)) + add)) * f(1.4)) * f(a));
// ModelWolf.setLivingAnimations (a(sv, F, F, F)) then setRotationAngles (a(F x6, sa)); `w` is pose.wolf. The tail's x angle is
// the ageInTicks argument, which RenderWolf.handleRotationFloat fills with the tail angle. Returns each part's {point, angle}
// in model pixels / radians.
export function wolfParts(w, { limbSwing = 0, limbAmount = 0, headYaw = 0, headPitch = 0 } = {}) {
  const P = (point, angle = [0, 0, 0]) => ({ point, angle });
  const near = cosSwing(limbSwing, limbAmount), far = cosSwing(limbSwing, limbAmount, f(Math.PI));
  let p;
  if (w.sitting) {
    p = {
      h: P([-1, 16, -3], [f(1.2566371), 0, 0]), b: P([0, 18, 0], [f(0.7853982), 0, 0]), g: P([-1, 21, 6]),
      c: P([-2.5, 22, 2], [f(4.712389), 0, 0]), d: P([0.5, 22, 2], [f(4.712389), 0, 0]),
      e: P([-2.49, 17, -4], [f(5.811947), 0, 0]), f: P([0.51, 17, -4], [f(5.811947), 0, 0]),
    };
  } else {
    p = {
      b: P([0, 14, 2], [f(1.5707964), 0, 0]), h: P([-1, 14, -3], [f(1.5707964), 0, 0]), g: P([-1, 12, 8]),
      c: P([-2.5, 16, 7], [near, 0, 0]), d: P([0.5, 16, 7], [far, 0, 0]),
      e: P([-2.5, 16, -4], [far, 0, 0]), f: P([0.5, 16, -4], [near, 0, 0]),
    };
  }
  p.a = P([-1, 13.5, -7], [f(headPitch * RAD), f(headYaw * RAD), f(w.interested + w.shakeHead)]);
  p.g.angle = [w.tail, w.angry ? 0 : near, w.shakeTail];
  p.h.angle[2] = w.shakeMane;
  p.b.angle[2] = w.shakeBody;
  return p;
}

export function createWolfRig(renderer) {
  const root = new THREE.Group(), materials = {};
  for (const k of Object.keys(WOLF_TEXTURES)) materials[k] = entityMaterial(renderer.view.lighting, { map: pixelTexture(WOLF_TEXTURES[k]) });
  // One tree per pass: the skin and the collar layer share the geometry and the pose.
  const build = (material) => {
    const frame = new THREE.Group(), parts = {}, meshes = [], head = new THREE.Group();
    for (const k of Object.keys(WOLF_BOXES)) {
      const pivot = new THREE.Group();
      pivot.rotation.order = "ZYX";
      for (const [ox, oy, oz, w, h, d, u, v] of WOLF_BOXES[k]) {
        const mesh = new THREE.Mesh(skinBox(w, h, d, u, v, 64, 32), material);
        mesh.position.set((ox + w / 2) / 16, -(oy + h / 2) / 16, -(oz + d / 2) / 16);
        pivot.add(mesh);
        meshes.push(mesh);
      }
      parts[k] = pivot;
      (k === "a" ? head : frame).add(pivot);
    }
    // ModelWolf.render for a puppy draws the head at full size, 5 down and 2 back, while the rest halves (the root's 0.5).
    frame.add(head);
    root.add(frame);
    return { parts, head, meshes };
  };
  // The collar layer draws over identical geometry (GL_EQUAL depth in the original); pull it toward the camera.
  Object.assign(materials.collar, { polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  const skin = build(materials.wild), collar = build(materials.collar);
  return { root, neck: new THREE.Group(), limbs: [], materials: Object.values(materials), type: "wolf", lift: 1 / 128, wolf: { materials, skin, collar } };
}

const place = (g, [x, y, z], [rx, ry, rz]) => {
  g.position.set(x / 16, (24 - y) / 16, -z / 16);
  g.rotation.set(rx, -ry, -rz);
};
export function animateWolf(r, e, pose) {
  const w = pose.wolf, { skin, collar, materials } = r.wolf, baby = e.growingAge < 0;
  const parts = wolfParts(w, { limbSwing: pose.limbSwing, limbAmount: pose.limbSwingAmount, headYaw: pose.headYaw, headPitch: pose.headPitch });
  for (const tree of [skin, collar]) {
    for (const k of Object.keys(parts)) place(tree.parts[k], parts[k].point, parts[k].angle);
    tree.head.position.set(0, baby ? -10 / 16 : 0, baby ? -4 / 16 : 0);
    tree.head.scale.setScalar(baby ? 2 : 1);
  }
  // Wet pass (RenderWolf pass 0): wolf.png darkened by the shake shade; otherwise the state's own texture.
  const key = w.wet ? "wild" : wolfTexture(w), shade = w.wet ? w.shade : 1;
  for (const m of skin.meshes) m.material = materials[key];
  for (const k of ["wild", "tame", "angry"]) materials[k].uniforms.tint.value.set(k === key ? shade : 1, k === key ? shade : 1, k === key ? shade : 1);
  // Collar pass (pass 1): a tamed wolf only, tinted by the dye's fleece colour.
  for (const m of collar.meshes) m.visible = w.tamed;
  materials.collar.uniforms.tint.value.set(...FLEECE_COLORS[w.collar ?? 14]);
}
