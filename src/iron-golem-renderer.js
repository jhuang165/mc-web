// RenderIronGolem (bph) with ModelIronGolem (bij, 128 x 128 iron_golem.png). The boxes come from IRON_GOLEM_MODEL
// (iron-golem.js, recorded by tools/probes/VillageLiveProbe.java). mob-renderer.js calls createIronGolemRig for an
// "iron_golem" and animateIronGolem every frame. The rose is RenderIronGolem.renderEquippedItems (boz.a(wt, F), bytecode-read).
import * as THREE from "three";
import { skinBox, pixelTexture } from "./first-person.js";
import { entityMaterial } from "./light-material.js";
import { IRON_GOLEM_MODEL as M, IRON_GOLEM_TEXTURE, IRON_GOLEM_ROSE_TEXTURE, ironGolemAngles, triangle } from "./iron-golem.js";

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
  // RenderIronGolem.renderEquippedItems: while holdRoseTick > 0 the poppy (Blocks.red_flower, meta 0) is drawn with
  // RenderBlocks.renderBlockAsItem, a crossed-square pair of size 1 centred on the origin. Native calls, in the
  // model's flipped frame (origin 24/16 above the feet, scale -1 -1 1): rotate(5 + degrees of the right arm's
  // rotateAngleX, 1 0 0), translate(-0.6875, 1.25, -0.9375), rotate(90, 1 0 0), scale(0.8, -0.8, 0.8). The model
  // frame is mapped to three.js as (x, 1.5 - y, -z), so `space` carries that mapping and the calls nest unchanged.
  const roseMat = entityMaterial(renderer.view.lighting, { map: pixelTexture(IRON_GOLEM_ROSE_TEXTURE), transparent: true, alphaTest: 0.1, side: THREE.DoubleSide });
  const space = new THREE.Group(), tilt = new THREE.Group(), place = new THREE.Group(), lay = new THREE.Group(), size = new THREE.Group();
  space.position.set(0, 1.5, 0);
  space.scale.set(1, -1, -1);
  place.position.set(-0.6875, 1.25, -0.9375);
  lay.rotation.x = Math.PI / 2;
  size.scale.set(0.8, -0.8, 0.8);
  for (const [a, b] of [[[-0.45, -0.45], [0.45, 0.45]], [[-0.45, 0.45], [0.45, -0.45]]]) {
    // drawCrossedSquares: (x0, top, z0) (x0, bottom, z0) (x1, bottom, z1) (x1, top, z1), u 0..1, v 1 at the bottom.
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute([a[0], 0.5, a[1], a[0], -0.5, a[1], b[0], -0.5, b[1], b[0], 0.5, b[1]], 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 1, 1], 2));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    g.computeVertexNormals();
    size.add(new THREE.Mesh(g, roseMat));
  }
  lay.add(size); place.add(lay); tilt.add(place); space.add(tilt); frame.add(space);
  space.visible = false;
  return { root, neck, limbs: [], golem: { frame, rose: { space, tilt }, ...parts }, materials: [skin, roseMat], type: "iron_golem", lift: 1 / 128, scale: 1 };
}

// ModelIronGolem.setLivingAnimations + setRotationAngles, and RenderIronGolem.rotateCorpse (a roll of up to 6.5
// degrees about the feet while it walks, from the triangle wave of the interpolated limb swing).
export function animateIronGolem(rig, e, pose, partial) {
  const g = rig.golem, a = ironGolemAngles(pose.limbSwing, pose.limbSwingAmount, e.attackTimer ?? 0, e.holdRose ?? 0, partial);
  g.rightArm.rotation.x = a.rightArm;
  g.leftArm.rotation.x = a.leftArm;
  g.leftLeg.rotation.x = a.leftLeg;
  g.rightLeg.rotation.x = a.rightLeg;
  // holdRoseTick > 0 draws the poppy, tilted 5 degrees plus the right arm's angle.
  g.rose.space.visible = (e.holdRose ?? 0) > 0;
  g.rose.tilt.rotation.x = a.rightArm + (5 * Math.PI) / 180;
  const walking = pose.limbSwingAmount >= 0.01;
  g.frame.rotation.z = walking ? -((6.5 * triangle(pose.limbSwing + 6, 13)) * Math.PI) / 180 : 0;
}
