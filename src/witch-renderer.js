// RenderWitch (bpb) with ModelWitch (bim, 64 x 128 witch.png). The boxes come from WITCH_MODEL (witch.js, recorded by
// tools/probes/WitchProbe.java). mob-renderer.js calls createWitchRig for a "witch" and animateWitch every frame; the legs use
// villagerLegAngle (ModelWitch extends ModelVillager). The potion the witch holds is not drawn in 3D (the nose pose changes only).
import * as THREE from "three";
import { skinBox, pixelTexture } from "./first-person.js";
import { entityMaterial } from "./light-material.js";
import { WITCH_MODEL as M, noseAngles } from "./witch.js";
const f = Math.fround;
export const WITCH_SCALE = f(0.9375);
export const WITCH_TEXTURE = "/media/1.7.10/entity/witch.png";

export function createWitchRig(renderer, e) {
  const root = new THREE.Group(), frame = new THREE.Group(), limbs = [],
    skin = entityMaterial(renderer.view.lighting, { map: pixelTexture(WITCH_TEXTURE) });
  root.add(frame);
  const [tw, th] = M.texture;
  const boxes = (parent, list, mirror = false) => {
    for (const [ox, oy, oz, w, h, d, u, v, grow] of list) {
      const g = skinBox(w, h, d, u, v, tw, th, mirror);
      if (grow) g.scale((w + 2 * grow) / w, (h + 2 * grow) / h, (d + 2 * grow) / d);
      const mesh = new THREE.Mesh(g, skin);
      mesh.position.set((ox + w / 2) / 16, -(oy + h / 2) / 16, -(oz + d / 2) / 16);
      parent.add(mesh);
    }
  };
  const pivot = (x, y, z, parent = frame) => {
    const g = new THREE.Group();
    g.position.set(x / 16, (24 - y) / 16, -z / 16);
    parent.add(g);
    return g;
  };
  // A child part: its point is relative to the parent's point, y down as in the model.
  const child = (parent, [x, y, z], angle = [0, 0, 0]) => {
    const g = new THREE.Group();
    g.position.set(x / 16, -y / 16, -z / 16);
    g.rotation.order = "YXZ";
    g.rotation.set(angle[0], -angle[1], -angle[2]);
    parent.add(g);
    return g;
  };
  const neck = pivot(...M.head.point);
  neck.rotation.order = "YXZ";
  boxes(neck, M.head.boxes);
  const nose = child(neck, M.nose.point);
  boxes(nose, M.nose.boxes);
  boxes(child(nose, M.mole.point), M.mole.boxes);
  // The hat: four stacked boxes, each a child of the one below (ModelWitch.field_82900_g and its three children).
  let hat = neck;
  for (const part of M.hat) {
    hat = child(hat, part.point, part.angle);
    boxes(hat, part.boxes);
  }
  const body = pivot(...M.body.point);
  boxes(body, M.body.boxes);
  const arms = pivot(...M.arms.point);
  arms.rotation.x = M.arms.angle;
  boxes(arms, M.arms.boxes);
  for (const { point, mirror } of M.legs) {
    const leg = pivot(...point);
    boxes(leg, [M.leg], mirror);
    limbs.push(leg);
  }
  renderer.scene.add(root);
  return { root, neck, limbs, nose, materials: [skin], type: "witch", lift: 1 / 128, scale: WITCH_SCALE };
}

// ModelWitch.setRotationAngles: the nose sways with the entity id and ticksExisted, and a held item pulls it forward.
export function animateWitch(rig, e, age) {
  const [rx, , rz, px, py, pz] = noseAngles(e.id, age, !!e.held), n = rig.nose;
  n.rotation.set(rx, 0, -rz);
  n.position.set(px / 16, -py / 16, -pz / 16);
}
