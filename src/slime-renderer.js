// RenderSlime (bot) with ModelSlime (bie, 64 x 32 slime.png): the inner body, eyes and mouth (bie(16)) and the translucent outer
// shell (bie(0), the second render pass with SRC_ALPHA / ONE_MINUS_SRC_ALPHA). The boxes are SLIME_MODEL (slime.js, recorded by
// tools/probes/SlimeProbe.java through ModelProbe). mob-renderer.js calls createSlimeRig for a "slime" and animateSlime every frame.
import * as THREE from "three";
import { skinBox, pixelTexture } from "./first-person.js";
import { entityMaterial } from "./light-material.js";
import { SLIME_MODEL as M, slimeScale } from "./slime.js";

export const SLIME_TEXTURE = "/media/1.7.10/entity/slime/slime.png";

export function createSlimeRig(renderer, e) {
  const root = new THREE.Group(), squish = new THREE.Group(), map = pixelTexture(SLIME_TEXTURE),
    skin = entityMaterial(renderer.view.lighting, { map }),
    shell = entityMaterial(renderer.view.lighting, { map, transparent: true, alphaTest: 0 });
  root.add(squish);
  const [tw, th] = M.texture;
  // The model's origin is 24 pixels above the feet, y down; Z is flipped into three.js's frame.
  const add = (list, material) => {
    for (const { from: [ox, oy, oz], size: [w, h, d], uv: [u, v] } of list) {
      const mesh = new THREE.Mesh(skinBox(w, h, d, u, v, tw, th), material);
      mesh.position.set((ox + w / 2) / 16, (24 - oy - h / 2) / 16, -(oz + d / 2) / 16);
      squish.add(mesh);
    }
  };
  add(M.inner, skin);
  add(M.outer, shell);
  // The shell is drawn after the body, over it.
  squish.children[squish.children.length - 1].renderOrder = 1;
  renderer.scene.add(root);
  return { root, squish, neck: new THREE.Group(), limbs: [], materials: [skin, shell], type: "slime", lift: 1 / 128, scale: 1 };
}

// RenderSlime.preRenderCallback: glScalef(f5 * size, size / f5, f5 * size) about the feet, from the interpolated squish factor.
export function animateSlime(rig, e, partial) {
  rig.squish.scale.set(...slimeScale(e.size, e.prevSquishFactor ?? 0, e.squishFactor ?? 0, partial));
}
