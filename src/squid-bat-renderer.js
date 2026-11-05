// RenderSquid (bow) with ModelSquid (bih, squid.png 64 x 32) and RenderBat (bnc) with ModelBat (bhc, bat.png 64 x 64). The boxes, pivots
// and poses are read from the original classes' bytecode (bih.<init>, bhc.<init>, bhc.a(sa, FFFFFF), bow.a(ws, FFF), bnc.a(we, FFF));
// they are not run, so they are bytecode-derived rather than probed. mob-renderer.js calls createSquidRig / createBatRig and the
// rig's `custom` hook every frame.
import * as THREE from "three";
import { skinBox, pixelTexture } from "./first-person.js";
import { entityMaterial } from "./light-material.js";
import { squidStateOf } from "./squid-bat.js";
const f = Math.fround, RAD = Math.PI / 180;
export const SQUID_TEXTURE = "/media/1.7.10/entity/squid.png", BAT_TEXTURE = "/media/1.7.10/entity/bat.png";
export const BAT_SCALE = f(0.35);
// ModelRenderer rotates Z, then Y, then X about the pivot (the vertex takes X first); mapped into this frame (a half turn about X)
// the Y and Z angles change sign. The model's y runs down from the 24 line, z points to the back (three.js gets -z).
const turn = (g, ax = 0, ay = 0, az = 0) => (g.rotation.order = "ZYX", g.rotation.set(ax, -ay, -az), g);
function modelBoxes(material, parent, list, tw, th, mirror = false) {
  for (const [ox, oy, oz, w, h, d, u, v] of list) {
    const mesh = new THREE.Mesh(skinBox(w, h, d, u, v, tw, th, mirror), material);
    mesh.position.set((ox + w / 2) / 16, -(oy + h / 2) / 16, -(oz + d / 2) / 16);
    parent.add(mesh);
  }
}
// A part at model point (x, y, z). A child's point is relative to its parent's; a top-level part's y is measured from the 24 line.
function part(frame, parent, [x, y, z]) {
  const g = new THREE.Group();
  g.rotation.order = "ZYX";
  if (parent) g.position.set(x / 16, -y / 16, -z / 16);
  else g.position.set(x / 16, (24 - y) / 16, -z / 16);
  (parent ?? frame).add(g);
  return g;
}
const place = (g, [x, y, z], top) => g.position.set(x / 16, top ? (24 - y) / 16 : -y / 16, -z / 16);

// ModelSquid: the body (-6,-8,-6, 12 x 16 x 12) at y 8 and eight 2 x 18 x 2 tentacles at radius 5, y 15, turned i * -2pi / 8 + pi / 2.
export function createSquidRig(renderer) {
  const root = new THREE.Group(), a = new THREE.Group(), b = new THREE.Group(), c = new THREE.Group(), d = new THREE.Group(), frame = new THREE.Group(),
    skin = entityMaterial(renderer.view.lighting, { map: pixelTexture(SQUID_TEXTURE) }), tentacles = [];
  root.add(a);
  a.add(b);
  b.add(c);
  c.add(d);
  d.add(frame);
  frame.position.y = 1 / 128;
  modelBoxes(skin, part(frame, null, [0, 8, 0]), [[-6, -8, -6, 12, 16, 12, 0, 0]], 64, 32);
  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI * 2) / 8, t = part(frame, null, [f(f(Math.cos(angle)) * 5), 15, f(f(Math.sin(angle)) * 5)]);
    turn(t, 0, (i * Math.PI * -2) / 8 + Math.PI / 2);
    modelBoxes(skin, t, [[-1, 0, -1, 2, 18, 2, 48, 0]], 64, 32);
    tentacles.push(t);
  }
  renderer.scene.add(root);
  return { root, neck: new THREE.Group(), limbs: [], materials: [skin], type: "squid", lift: 0, scale: 1, squid: { a, b, c, d, tentacles }, custom: animateSquid };
}
// RenderSquid.rotateCorpse: translate(0, 0.5, 0), Y 180 - bodyYaw, X pitch, Y yaw, translate(0, -1.2, 0); the corpse does not roll. The
// frame mapping's half turn about Y is undone by the last group.
export function animateSquid(r, e, pose, partial) {
  const s = squidStateOf(e) ?? { pitch: 0, prevPitch: 0, yaw: 0, prevYaw: 0, tentacle: 0, prevTentacle: 0 }, p = f(partial),
    { a, b, c, d, tentacles } = r.squid, pitch = s.prevPitch + (s.pitch - s.prevPitch) * p, yaw = s.prevYaw + (s.yaw - s.prevYaw) * p,
    tentacle = s.prevTentacle + (s.tentacle - s.prevTentacle) * p;
  r.root.rotation.set(0, 0, 0);
  a.position.set(0, 0.5, 0);
  a.rotation.set(0, -(180 - pose.bodyYaw) * RAD, 0);
  b.rotation.set(pitch * RAD, 0, 0);
  c.rotation.set(0, -yaw * RAD, 0);
  d.position.set(0, -1.2, 0);
  d.rotation.set(0, Math.PI, 0);
  for (const t of tentacles) t.rotation.x = tentacle;
}

// ModelBat: head with two ears, a body with a chest plate, two wings with tips. Hanging and flying poses are bhc.a(sa, FFFFFF).
export function createBatRig(renderer) {
  const root = new THREE.Group(), frame = new THREE.Group(), skin = entityMaterial(renderer.view.lighting, { map: pixelTexture(BAT_TEXTURE) });
  root.add(frame);
  frame.position.y = 1 / 128;
  const head = part(frame, null, [0, 0, 0]), body = part(frame, null, [0, 0, 0]);
  modelBoxes(skin, head, [[-3, -3, -3, 6, 6, 6, 0, 0]], 64, 64);
  modelBoxes(skin, part(frame, head, [0, 0, 0]), [[-4, -6, -2, 3, 4, 1, 24, 0]], 64, 64);
  modelBoxes(skin, part(frame, head, [0, 0, 0]), [[1, -6, -2, 3, 4, 1, 24, 0]], 64, 64, true);
  modelBoxes(skin, body, [[-3, 4, -3, 6, 12, 6, 0, 16], [-5, 16, 0, 10, 6, 1, 0, 34]], 64, 64);
  const rightWing = part(frame, body, [0, 0, 0]), leftWing = part(frame, body, [0, 0, 0]);
  modelBoxes(skin, rightWing, [[-12, 1, 1.5, 10, 16, 1, 42, 0]], 64, 64);
  modelBoxes(skin, leftWing, [[2, 1, 1.5, 10, 16, 1, 42, 0]], 64, 64, true);
  const rightTip = part(frame, rightWing, [-12, 1, 1.5]), leftTip = part(frame, leftWing, [12, 1, 1.5]);
  modelBoxes(skin, rightTip, [[-8, 1, 0, 8, 12, 1, 24, 16]], 64, 64);
  modelBoxes(skin, leftTip, [[0, 1, 0, 8, 12, 1, 24, 16]], 64, 64, true);
  renderer.scene.add(root);
  return { root, neck: head, limbs: [], materials: [skin], type: "bat", lift: 0, scale: BAT_SCALE, bat: { head, body, rightWing, leftWing, rightTip, leftTip }, custom: animateBat };
}
// bhc.a(sa, f2, f3, age, headYaw, headPitch, scale) and bnc.a(we, age, yaw, partial) (rotateCorpse): a flier bobs cos(age * 0.3) * 0.1 up
// before the 0.35 scale, a hanging bat sits 0.1 down.
export function animateBat(r, e, pose) {
  const { head, body, rightWing, leftWing, rightTip, leftTip } = r.bat, hanging = !!e.batHanging, age = pose.age, pitch = pose.headPitch * RAD, yaw = pose.headYaw * RAD,
    set = (g, point, top, ax = 0, ay = 0, az = 0) => (place(g, point, top), turn(g, ax, ay, az));
  r.root.position.y += hanging ? -0.1 : Math.cos(age * 0.3) * 0.1;
  if (hanging) {
    set(head, [0, -2, 0], true, pitch, Math.PI - yaw, Math.PI);
    set(body, [0, 0, 0], true, Math.PI);
    set(rightWing, [-3, 0, 3], false, -0.15707964, -1.2566371);
    set(leftWing, [3, 0, 3], false, -0.15707964, 1.2566371);
    set(rightTip, [-12, 1, 1.5], false, 0, -1.7278761);
    set(leftTip, [12, 1, 1.5], false, 0, 1.7278761);
  } else {
    const flap = Math.cos(age * 1.3) * Math.PI * 0.25;
    set(head, [0, 0, 0], true, pitch, yaw, 0);
    set(body, [0, 0, 0], true, Math.PI / 4 + Math.cos(age * 0.1) * 0.15);
    set(rightWing, [0, 0, 0], false, 0, flap);
    set(leftWing, [0, 0, 0], false, 0, -flap);
    set(rightTip, [-12, 1, 1.5], false, 0, flap * 0.5);
    set(leftTip, [12, 1, 1.5], false, 0, -flap * 0.5);
  }
}
