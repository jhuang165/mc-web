// RenderTNTPrimed (boy) for EntityTNTPrimed: the TNT block (RenderBlocks.renderBlockAsItem,
// tnt_side / tnt_top / tnt_bottom) centred on the interpolated posY, swollen by up to 30%
// over the last 10 ticks, and on every other 5-tick period a white copy blended
// GL_SRC_ALPHA, GL_DST_ALPHA (additive) with alpha (1 - (fuse - partial + 1) / 100) * 0.8,
// texture and lighting off. See explosion.js tntRender.
import * as THREE from "three";
import { pixelTexture } from "./first-person.js";
import { entityMaterial } from "./light-material.js";
import { tntRender, TNT_Y_OFFSET, TNT_SIZE } from "./explosion.js";

export class TntRenderer {
  // `view` supplies the lighting uniforms and Entity.getBrightnessForRender (VoxelScene).
  constructor(scene, view) {
    this.scene = scene;
    this.view = view;
    this.meshes = new Map();
    this.geometry = new THREE.BoxGeometry(1, 1, 1);
    const t = (name) => pixelTexture(`/media/1.7.10/blocks/${name}.png`), side = t("tnt_side");
    // BoxGeometry faces: +x, -x, +y, -y, +z, -z.
    this.faces = [side, side, t("tnt_top"), t("tnt_bottom"), side, side];
  }
  create() {
    const materials = this.faces.map((map) => entityMaterial(this.view.lighting, { map })),
      root = new THREE.Group(),
      white = new THREE.Mesh(this.geometry, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    white.renderOrder = 1;
    root.add(new THREE.Mesh(this.geometry, materials), white);
    this.scene.add(root);
    return { root, materials, white };
  }
  update(list, partial = 1) {
    const live = new Set(list);
    for (const [e, r] of this.meshes)
      if (!live.has(e)) {
        this.scene.remove(r.root);
        for (const m of r.materials) m.dispose();
        r.white.material.dispose();
        this.meshes.delete(e);
      }
    for (const e of list) {
      let r = this.meshes.get(e);
      if (!r) this.meshes.set(e, (r = this.create()));
      const lerp = (a, b) => a + (b - a) * partial, { scale, flash } = tntRender(e.fuse, partial);
      r.root.position.set(lerp(e.px, e.x), lerp(e.py, e.y) + TNT_Y_OFFSET, lerp(e.pz, e.z));
      r.root.scale.setScalar(scale);
      // Entity.getBrightnessForRender samples 0.66 of the box height up.
      const packed = this.view.brightness(e.x, e.y + TNT_SIZE * 0.66, e.z);
      for (const m of r.materials) m.setLight(packed);
      r.white.visible = flash > 0;
      r.white.material.opacity = flash;
    }
  }
  clear() {
    this.update([]);
  }
}
