// RenderEnderCrystal (bnk) with ModelEnderCrystal (bir, endercrystal.png 64 x 32, base included). The matrix sequence is
// read from the bytecode (bnk.a(wz, DDDFF), bir.a(sa, FFFFFFF)); it is not run, so it is bytecode-derived rather than probed.
// mob-renderer.js calls createCrystalRig / animateCrystal. The rig origin is the entity's posY (box minY + 1).
import * as THREE from "three";
import { skinBox, pixelTexture } from "./first-person.js";
import { entityMaterial } from "./light-material.js";
const f = Math.fround, DEG = Math.PI / 180;
export const CRYSTAL_TEXTURE = "/media/1.7.10/entity/endercrystal/endercrystal.png";
export const CRYSTAL_RENDER_SHADOW = f(0.5);
const AXIS = new THREE.Vector3(0.7071, 0, 0.7071).normalize();

// ModelEnderCrystal boxes: glass and cube (-4,-4,-4, 8x8x8) at texture (0,0) and (32,0), base (-6,0,-6, 12x4x12) at (0,16).
// The model is drawn without the living-entity y flip, so each box sits in a group turned half a turn about X to
// undo skinBox's model frame (x, -y, -z).
function modelBox(material, parent, [ox, oy, oz, w, h, d, u, v]) {
  const flip = new THREE.Group(), mesh = new THREE.Mesh(skinBox(w, h, d, u, v, 64, 32, false), material);
  flip.rotation.x = Math.PI;
  mesh.position.set((ox + w / 2) / 16, -(oy + h / 2) / 16, -(oz + d / 2) / 16);
  flip.add(mesh);
  parent.add(flip);
  return flip;
}
const group = (parent) => { const g = new THREE.Group(); parent.add(g); return g; };

export function createCrystalRig(renderer) {
  const root = new THREE.Group(), skin = entityMaterial(renderer.view.lighting, { map: pixelTexture(CRYSTAL_TEXTURE) });
  // glScalef(2), glTranslatef(0, -0.5, 0): the base, then spin (glRotatef(f1, y)) and bob (translate 0.8 + f2).
  const scaled = group(root), lowered = group(scaled);
  scaled.scale.setScalar(2);
  lowered.position.y = -0.5;
  modelBox(skin, lowered, [-6, 0, -6, 12, 4, 12, 0, 16]);
  const spin = group(lowered), bob = group(spin), tilt1 = group(bob);
  tilt1.quaternion.setFromAxisAngle(AXIS, 60 * DEG);
  modelBox(skin, tilt1, [-4, -4, -4, 8, 8, 8, 0, 0]);
  // glScalef(0.875), glRotatef(60, axis), glRotatef(f1, y): the second glass, then the same again for the cube.
  const s2 = group(tilt1), t2 = group(s2), r2 = group(t2);
  s2.scale.setScalar(0.875);
  t2.quaternion.setFromAxisAngle(AXIS, 60 * DEG);
  modelBox(skin, r2, [-4, -4, -4, 8, 8, 8, 0, 0]);
  const s3 = group(r2), t3 = group(s3), r3 = group(t3);
  s3.scale.setScalar(0.875);
  t3.quaternion.setFromAxisAngle(AXIS, 60 * DEG);
  modelBox(skin, r3, [-4, -4, -4, 8, 8, 8, 32, 0]);
  renderer.scene.add(root);
  return { root, neck: new THREE.Group(), limbs: [], materials: [skin], type: "ender_crystal", lift: 1, scale: 1, crystal: { spin, bob, r2, r3 }, custom: animateCrystal };
}

// RenderEnderCrystal.doRender: t = innerRotation + partial; the cube spins at t * 3 degrees and bobs at (s * s + s) * 0.2
// with s = sin(t * 0.2) / 2 + 0.5. No yaw: the crystal never turns with its entity.
export function animateCrystal(r, e, pose, partial) {
  const t = f((e.innerRotation ?? 0) + f(partial)), spin = f(t * 3) * DEG, s0 = f(f(Math.sin(f(t * f(0.2)))) / 2 + f(0.5)), s = f(f(s0 * s0) + s0);
  r.root.rotation.set(0, 0, 0);
  r.crystal.spin.rotation.y = spin;
  r.crystal.bob.position.y = f(0.8) + f(s * f(0.2));
  r.crystal.r2.rotation.y = spin;
  r.crystal.r3.rotation.y = spin;
}
