// RenderMagmaCube (boe) with ModelMagmaCube (bho, 64 x 32 magmacube.png): eight 8 x 1 x 8 slices stacked from y = 16 to 24 (model
// pixels, y down) and a 4 x 4 x 4 core at (-2, 18, -2). The boxes are MAGMA_MODEL (recorded by tools/probes/MagmaPigmanProbe.java
// through ModelProbe). The squish scale is RenderSlime's (slime.js slimeScale); the cube is always fully lit (yf.c / yf.d).
// mob-renderer.js calls createMagmaCubeRig for a "magma_cube" and animateSlime (slime-renderer.js) every frame.
import * as THREE from "three";
import { skinBox, pixelTexture } from "./first-person.js";
import { entityMaterial } from "./light-material.js";

export const MAGMA_TEXTURE = "/media/1.7.10/entity/slime/magmacube.png";
export const MAGMA_MODEL = Object.freeze({
  texture: [64, 32],
  // [from, size, uv]; the slices' uv rows are the original's per-slice offsets (0,0) (0,1) (24,10) (24,19) (0,4) (0,5) (0,6) (0,7).
  slices: [
    { from: [-4, 16, -4], size: [8, 1, 8], uv: [0, 0] }, { from: [-4, 17, -4], size: [8, 1, 8], uv: [0, 1] }, { from: [-4, 18, -4], size: [8, 1, 8], uv: [24, 10] },
    { from: [-4, 19, -4], size: [8, 1, 8], uv: [24, 19] }, { from: [-4, 20, -4], size: [8, 1, 8], uv: [0, 4] }, { from: [-4, 21, -4], size: [8, 1, 8], uv: [0, 5] },
    { from: [-4, 22, -4], size: [8, 1, 8], uv: [0, 6] }, { from: [-4, 23, -4], size: [8, 1, 8], uv: [0, 7] },
  ],
  core: { from: [-2, 18, -2], size: [4, 4, 4], uv: [0, 16] },
});

export function createMagmaCubeRig(renderer) {
  const root = new THREE.Group(), squish = new THREE.Group(), skin = entityMaterial(renderer.view.lighting, { map: pixelTexture(MAGMA_TEXTURE) });
  root.add(squish);
  const [tw, th] = MAGMA_MODEL.texture;
  for (const { from: [ox, oy, oz], size: [w, h, d], uv: [u, v] } of [MAGMA_MODEL.core, ...MAGMA_MODEL.slices]) {
    const mesh = new THREE.Mesh(skinBox(w, h, d, u, v, tw, th), skin);
    mesh.position.set((ox + w / 2) / 16, (24 - oy - h / 2) / 16, -(oz + d / 2) / 16);
    squish.add(mesh);
  }
  renderer.scene.add(root);
  return { root, squish, neck: new THREE.Group(), limbs: [], materials: [skin], type: "magma_cube", lift: 1 / 128, scale: 1 };
}
