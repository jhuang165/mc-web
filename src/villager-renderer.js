// RenderVillager (bpa) with ModelVillager (bik, 64 x 64 villager/*.png), boxes as recorded in
// public/research/villager-reference.json. mob-renderer.js calls createVillagerRig for a "villager" and
// villagerLegAngle for its two limbs; the head turns through the shared neck.
//
// Model parts (point -> boxes): head (0, 0, 0) with the nose child (0, -2, 0); body (0, 0, 0) and its
// coat grown by 0.5; the folded arms (0, 3, -1) tilted -0.75 (ModelVillager.setRotationAngles); legs (-2|2, 12, 0)
// with the left one mirrored. RenderVillager scales by 0.9375 (halved for a child, as the entity is).
import * as THREE from "three";
import { skinBox, pixelTexture } from "./first-person.js";
import { entityMaterial } from "./light-material.js";
import { mhCos } from "./lighting.js";
import { villagerTexture } from "./villager.js";
const f = Math.fround;
export const VILLAGER_SCALE = f(0.9375);
// ModelVillager.setRotationAngles: leg0 cos(swing * 0.6662) * 1.4 * amount * 0.5, leg1 the same shifted by PI.
export const villagerLegAngle = (swing, amount, i) => f(f(f(mhCos(f(f(swing * f(0.6662)) + (i ? f(3.1415927) : 0))) * f(1.4)) * amount) * f(0.5));
export const VILLAGER_ARM_ANGLE = f(-0.75);

export function createVillagerRig(renderer, e) {
  const root = new THREE.Group(), frame = new THREE.Group(), limbs = [],
    skin = entityMaterial(renderer.view.lighting, { map: pixelTexture(villagerTexture(e.profession)) });
  root.add(frame);
  // A ModelBox at model offset (ox, oy, oz) inflated by `grow` each way; the texture keeps the uninflated size.
  const part = (parent, w, h, d, u, v, ox, oy, oz, mirror = false, grow = 0) => {
    const g = skinBox(w, h, d, u, v, 64, 64, mirror);
    if (grow) g.scale((w + 2 * grow) / w, (h + 2 * grow) / h, (d + 2 * grow) / d);
    const mesh = new THREE.Mesh(g, skin);
    mesh.position.set((ox + w / 2) / 16, -(oy + h / 2) / 16, -(oz + d / 2) / 16);
    parent.add(mesh);
  };
  const pivot = (x, y, z, parent = frame) => {
    const g = new THREE.Group();
    g.position.set(x / 16, (24 - y) / 16, -z / 16);
    parent.add(g);
    return g;
  };
  const neck = pivot(0, 0, 0);
  neck.rotation.order = "YXZ";
  part(neck, 8, 10, 8, 0, 0, -4, -10, -4);
  // The nose is a child of the head, its point 2 above the head's.
  const nose = new THREE.Group();
  nose.position.set(0, 2 / 16, 0);
  neck.add(nose);
  part(nose, 2, 4, 2, 24, 0, -1, -1, -6);
  const body = pivot(0, 0, 0);
  part(body, 8, 12, 6, 16, 20, -4, 0, -3);
  part(body, 8, 18, 6, 0, 38, -4, 0, -3, false, 0.5);
  const arms = pivot(0, 3, -1);
  arms.rotation.x = VILLAGER_ARM_ANGLE;
  part(arms, 4, 8, 4, 44, 22, -8, -2, -2);
  part(arms, 4, 8, 4, 44, 22, 4, -2, -2);
  part(arms, 8, 4, 4, 40, 38, -4, 2, -2);
  for (const [x, mirror] of [[-2, false], [2, true]]) {
    const leg = pivot(x, 12, 0);
    part(leg, 4, 12, 4, 0, 22, -2, 0, -2, mirror);
    limbs.push(leg);
  }
  renderer.scene.add(root);
  return { root, neck, limbs, materials: [skin], type: "villager", lift: 1 / 128, scale: VILLAGER_SCALE, profession: e.profession };
}
