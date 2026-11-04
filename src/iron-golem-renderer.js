// RenderIronGolem (bph) with ModelIronGolem (bij, 128 x 128 iron_golem.png). The boxes come from IRON_GOLEM_MODEL
// (iron-golem.js, recorded by tools/probes/VillageLiveProbe.java). mob-renderer.js calls createIronGolemRig for an
// "iron_golem" and animateIronGolem every frame. The rose in the held hand is not drawn as a block (the arm pose is).
import * as THREE from "three";
import { skinBox, pixelTexture } from "./first-person.js";
import { entityMaterial } from "./light-material.js";
import { IRON_GOLEM_MODEL as M, IRON_GOLEM_TEXTURE, ironGolemAngles, triangle } from "./iron-golem.js";

export function createIronGolemRig(renderer) {
  const root = new THREE.Group(), frame = new THREE.Group(),
    skin = entityMaterial(renderer.view.lighting, { map: pixelTexture(IRON_GOLEM_TEXTURE) });
  root.add(frame);
  const [tw, th] = M.texture;
  const part = ({ point: [x, y, z], boxes, mirror = false }) => {
    const pivot = new THREE.Group();
    pivot.position.set(x / 16, (24 - y) / 16, -z / 16);
    for (const [ox, oy, oz, w, h, d, u, v, grow] of boxes) {
      const g = skinBox(w, h, d, u, v, tw, th, mirror);
      if (grow) g.scale((w + 2 * grow) / w, (h + 2 * grow) / h, (d + 2 * grow) / d);
      const mesh = new THREE.Mesh(g, skin);
      mesh.position.set((ox + w / 2) / 16, -(oy + h / 2) / 16, -(oz + d / 2) / 16);
      pivot.add(mesh);
    }
    frame.add(pivot);
    return pivot;
  };
  const neck = part(M.head);
  neck.rotation.order = "YXZ";
  part(M.body);
  const parts = { rightArm: part(M.rightArm), leftArm: part(M.leftArm), leftLeg: part(M.leftLeg), rightLeg: part(M.rightLeg) };
  renderer.scene.add(root);
  return { root, neck, limbs: [], golem: { frame, ...parts }, materials: [skin], type: "iron_golem", lift: 1 / 128, scale: 1 };
}

// ModelIronGolem.setLivingAnimations + setRotationAngles, and RenderIronGolem.rotateCorpse (a roll of up to 6.5
// degrees about the feet while it walks, from the triangle wave of the interpolated limb swing).
export function animateIronGolem(rig, e, pose, partial) {
  const g = rig.golem, a = ironGolemAngles(pose.limbSwing, pose.limbSwingAmount, e.attackTimer ?? 0, e.holdRose ?? 0, partial);
  g.rightArm.rotation.x = a.rightArm;
  g.leftArm.rotation.x = a.leftArm;
  g.leftLeg.rotation.x = a.leftLeg;
  g.rightLeg.rotation.x = a.rightLeg;
  const walking = pose.limbSwingAmount >= 0.01;
  g.frame.rotation.z = walking ? -((6.5 * triangle(pose.limbSwing + 6, 13)) * Math.PI) / 180 : 0;
}
