// RenderOcelot (bom) with ModelOcelot (bht, 64 x 32): ocelot.png, black.png, red.png and siamese.png by CatType, the model
// scaled 0.8 once tamed. ocelotParts() is the model's pose maths (setLivingAnimations and setRotationAngles) and is checked
// against public/research/ocelot-reference.json; createOcelotRig/animateOcelot map it onto three.js like wolf-renderer.js
// (model (x, y, z) becomes (x, 24 - y, -z) / 16, Java's Y and Z rotations change sign).
import * as THREE from "three";
import { skinBox, pixelTexture } from "./first-person.js";
import { entityMaterial } from "./light-material.js";
import { mhCos } from "./lighting.js";
import { CAT_TEXTURES } from "./ocelot.js";

const f = Math.fround;
const PI = f(Math.PI), HALF_PI = f(1.5707964), SIT_TAIL1 = f(1.7278761), TAIL_REST = f(0.9);
// Part letters are ModelOcelot's fields: a, b hind legs, c, d front legs, e tail 1, f tail 2, g head, h body.
// Boxes are [ox, oy, oz, w, h, d, u, v] relative to the part's pivot.
export const OCELOT_BOXES = {
  a: [[-1, 0, 1, 2, 6, 2, 8, 13]],
  b: [[-1, 0, 1, 2, 6, 2, 8, 13]],
  c: [[-1, 0, 0, 2, 10, 2, 40, 0]],
  d: [[-1, 0, 0, 2, 10, 2, 40, 0]],
  e: [[-0.5, 0, 0, 1, 8, 1, 0, 15]],
  f: [[-0.5, 0, 0, 1, 8, 1, 4, 15]],
  g: [[-2.5, -2, -3, 5, 4, 5, 0, 0], [-1.5, 0, -4, 3, 2, 2, 0, 24], [-2, -3, 0, 1, 1, 2, 0, 10], [1, -3, 0, 1, 1, 2, 6, 10]],
  h: [[-2, 3, -8, 4, 16, 6, 20, 0]],
};
export const OCELOT_TEXTURE_URLS = CAT_TEXTURES.map((n) => `/media/1.7.10/entity/cat/${n}.png`);
// The model's state `i`: 0 sneaking, 1 standing, 2 sprinting, 3 sitting.
export const modelState = (o) => (o.sitting ? 3 : o.sneaking ? 0 : o.sprinting ? 2 : 1);
const cs = (x) => mhCos(f(x));
// `o` is pose.ocelot ({sitting, sneaking, sprinting}); returns each part's {point, angle} in model pixels / radians, and the state.
export function ocelotParts(o, { limbSwing = 0, limbAmount = 0, headYaw = 0, headPitch = 0 } = {}) {
  const P = (point, angle = [0, 0, 0]) => ({ point, angle });
  const p = { a: P([1.1, 18, 5]), b: P([-1.1, 18, 5]), c: P([1.2, 13.8, -5]), d: P([-1.2, 13.8, -5]), e: P([0, 15, 8], [TAIL_REST, 0, 0]), f: P([0, 20, 14]), g: P([0, 15, -9]), h: P([0, 12, -10]) };
  const i = modelState(o);
  if (i === 0) {
    p.h.point[1] += 1; p.g.point[1] += 2; p.e.point[1] += 1; p.f.point[1] -= 4; p.f.point[2] += 2;
    p.e.angle[0] = HALF_PI; p.f.angle[0] = HALF_PI;
  } else if (i === 2) {
    p.f.point[1] = p.e.point[1]; p.f.point[2] += 2;
    p.e.angle[0] = HALF_PI; p.f.angle[0] = HALF_PI;
  } else if (i === 3) {
    p.h.angle[0] = f(0.7853982); p.h.point[1] -= 4; p.h.point[2] += 5;
    p.g.point[1] -= 3.3; p.g.point[2] += 1;
    p.e.point[1] += 8; p.e.point[2] -= 2; p.f.point[1] += 2; p.f.point[2] -= 0.8;
    p.e.angle[0] = SIT_TAIL1; p.f.angle[0] = f(2.670354);
    p.c.angle[0] = d(-0.15707964); p.d.angle[0] = d(-0.15707964); p.c.point[1] = 15.8; p.c.point[2] = -7; p.d.point[1] = 15.8; p.d.point[2] = -7;
    p.a.angle[0] = d(-1.5707964); p.b.angle[0] = d(-1.5707964); p.a.point[1] = 21; p.a.point[2] = 1; p.b.point[1] = 21; p.b.point[2] = 1;
  }
  p.g.angle[0] = f(headPitch / f(57.295776));
  p.g.angle[1] = f(headYaw / f(57.295776));
  if (i !== 3) {
    p.h.angle[0] = HALF_PI;
    const s = f(limbSwing * f(0.6662)), m = limbAmount;
    if (i === 2) {
      p.a.angle[0] = f(cs(s) * m); p.b.angle[0] = f(cs(f(s + f(0.3))) * m);
      p.c.angle[0] = f(cs(f(f(s + PI) + f(0.3))) * m); p.d.angle[0] = f(cs(f(s + PI)) * m);
      p.f.angle[0] = f(SIT_TAIL1 + f(f(0.31415927) * cs(limbSwing) * m));
    } else {
      p.a.angle[0] = f(cs(s) * m); p.b.angle[0] = f(cs(f(s + PI)) * m);
      p.c.angle[0] = f(cs(f(s + PI)) * m); p.d.angle[0] = f(cs(s) * m);
      p.f.angle[0] = f(SIT_TAIL1 + f(f(i === 1 ? 0.7853982 : 0.47123894) * cs(limbSwing) * m));
    }
  }
  return { parts: p, state: i };
}
function d(x) { return f(x); }

export function createOcelotRig(renderer) {
  const root = new THREE.Group(), materials = OCELOT_TEXTURE_URLS.map((u) => entityMaterial(renderer.view.lighting, { map: pixelTexture(u) }));
  const frame = new THREE.Group(), parts = {}, meshes = [], head = new THREE.Group();
  for (const k of Object.keys(OCELOT_BOXES)) {
    const pivot = new THREE.Group();
    pivot.rotation.order = "ZYX";
    for (const [ox, oy, oz, w, h, dd, u, v] of OCELOT_BOXES[k]) {
      const mesh = new THREE.Mesh(skinBox(w, h, dd, u, v, 64, 32), materials[0]);
      mesh.position.set((ox + w / 2) / 16, -(oy + h / 2) / 16, -(oz + dd / 2) / 16);
      pivot.add(mesh);
      meshes.push(mesh);
    }
    parts[k] = pivot;
    (k === "g" ? head : frame).add(pivot);
  }
  frame.add(head);
  root.add(frame);
  renderer.scene.add(root);
  return { root, neck: new THREE.Group(), limbs: [], materials, type: "ocelot", lift: 1 / 128, ocelot: { parts, head, meshes, materials }, custom: animateOcelot };
}
const place = (g, [x, y, z], [rx, ry, rz]) => {
  g.position.set(x / 16, (24 - y) / 16, -z / 16);
  g.rotation.set(rx, -ry, -rz);
};
function animateOcelot(r, e, pose) {
  const o = pose.ocelot, { parts, head, meshes, materials } = r.ocelot, baby = e.growingAge < 0;
  const { parts: pp } = ocelotParts(o, { limbSwing: pose.limbSwing, limbAmount: pose.limbSwingAmount, headYaw: pose.headYaw, headPitch: pose.headPitch });
  for (const k of Object.keys(pp)) place(parts[k], pp[k].point, pp[k].angle);
  // ModelOcelot.render for a kitten (executed, baby-model-reference.json): glScalef(0.75) about the model origin (24 pixels up), then glTranslatef(0, 10, 4) pixels
  // in that scaled frame. This group scales about the feet and sits under the root's 0.5 (scale 1.5 -> 0.75), so its position is 2 * ((1 - 0.75) * 24 up - 0.75 * (10 down, 4 back))
  // = 3 pixels down and 6 back. The rest of the model halves with the root.
  head.position.set(0, baby ? -3 / 16 : 0, baby ? -6 / 16 : 0);
  head.scale.setScalar(baby ? 1.5 : 1);
  // RenderOcelot.preRenderCallback: a tamed cat is scaled 0.8.
  if (o.tamed) r.root.scale.multiplyScalar(0.8);
  const mat = materials[o.catType] ?? materials[0];
  for (const m of meshes) m.material = mat;
}
