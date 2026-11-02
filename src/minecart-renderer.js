// RenderMinecart (boi) with ModelMinecart (bhq) for EntityMinecartChest: the entity-id jitter, the
// cart moved onto its rail and turned to the rail slope (Minecarts.renderPose), rotate (180 - yaw)
// about Y, -pitch about Z and the hurt wobble about X; the display block (the chest, offset 8)
// scaled 0.75 and raised 8/16, drawn as RenderBlocks.renderBlockAsItem does for render type 22
// (rotated 90 degrees about Y, centred, TileEntityChestRenderer at metadata 0 with the lid shut);
// then scale(-1, -1, 1) and the six ModelMinecart boxes at 1/16 from entity/minecart.png (64 x 32),
// the floor's rotation point at y 4.1 (4 - f3, f3 = -0.1). The 0.5 shadow is not drawn.
import * as THREE from "three";
import { skinBox, pixelTexture } from "./first-person.js";
import { entityMaterial } from "./light-material.js";
import { ChestRenderer } from "./chest-renderer.js";
import { christmas } from "./chest.js";
import { CART_HEIGHT } from "./minecarts.js";

const D = Math.PI / 180;
// ModelMinecart.a[0..5]: texture offset, addBox (x, y, z, w, h, d), rotation point, rotateAngleX/Y.
export const CART_PARTS = [
  { uv: [0, 10], box: [-10, -8, -1, 20, 16, 2], at: [0, 4, 0], rot: [Math.fround(Math.PI / 2), 0] },
  { uv: [0, 0], box: [-8, -9, -1, 16, 8, 2], at: [-9, 4, 0], rot: [0, Math.fround((3 * Math.PI) / 2)] },
  { uv: [0, 0], box: [-8, -9, -1, 16, 8, 2], at: [9, 4, 0], rot: [0, Math.fround(Math.PI / 2)] },
  { uv: [0, 0], box: [-8, -9, -1, 16, 8, 2], at: [0, 4, -7], rot: [0, Math.fround(Math.PI)] },
  { uv: [0, 0], box: [-8, -9, -1, 16, 8, 2], at: [0, 4, 7], rot: [0, 0] },
  { uv: [44, 10], box: [-9, -7, -1, 18, 14, 1], at: [0, 4.1, 0], rot: [Math.fround(-Math.PI / 2), 0] },
];

// GL's scale(-1, -1, 1) before ModelMinecart.render; each ModelRenderer translates to its rotation
// point and turns Z, Y, X. skinBox's faces sit in Three space turned 180 degrees about X from the
// model's y-down space, so every box mesh carries that turn about its centre.
export function cartModel(material, geometries = CART_PARTS.map(({ uv, box }) => skinBox(box[3], box[4], box[5], uv[0], uv[1], 64, 32))) {
  const model = new THREE.Group();
  model.scale.set(-1, -1, 1);
  CART_PARTS.forEach(({ box, at, rot }, i) => {
    const part = new THREE.Group(), mesh = new THREE.Mesh(geometries[i], material);
    part.position.set(at[0] / 16, at[1] / 16, at[2] / 16);
    part.rotation.set(rot[0], rot[1], 0, "ZYX");
    mesh.position.set((box[0] + box[3] / 2) / 16, (box[1] + box[4] / 2) / 16, (box[2] + box[5] / 2) / 16);
    mesh.rotation.x = Math.PI;
    part.add(mesh);
    model.add(part);
  });
  return model;
}

export class MinecartRenderer {
  // `view` supplies the lighting uniforms and Entity.getBrightnessForRender (VoxelScene);
  // `minecarts` is the Minecarts system (its rail lookup places the cart on the track).
  constructor(scene, view, minecarts) {
    Object.assign(this, { scene, view, minecarts, meshes: new Map() });
    this.chests = new ChestRenderer(scene, view);
    this.texture = pixelTexture("/media/1.7.10/entity/minecart.png");
    this.geometries = CART_PARTS.map(({ uv, box }) => skinBox(box[3], box[4], box[5], uv[0], uv[1], 64, 32));
  }
  create(festive) {
    const root = new THREE.Group(), material = entityMaterial(this.view.lighting, { map: this.texture });
    root.rotation.order = "YZX";
    const model = cartModel(material, this.geometries);
    // The chest: scale 0.75, translate (0, 8 / 16, 0) in the scaled frame, then
    // renderBlockAsItem's rotate 90 about Y and translate (-0.5, -0.5, -0.5) of the unit block.
    const display = new THREE.Group(), turn = new THREE.Group(), chest = this.chests.build(false, festive);
    display.scale.setScalar(0.75);
    display.position.y = 0.75 * (8 / 16);
    turn.rotation.y = Math.PI / 2;
    chest.root.position.y = -0.5;
    turn.add(chest.root);
    display.add(turn);
    root.add(display, model);
    this.scene.add(root);
    return { root, display, materials: [material, chest.material], festive };
  }
  dispose(r) {
    this.scene.remove(r.root);
    for (const m of r.materials) m.dispose();
  }
  // `list` is Minecarts.list; `world` the live world for the rail lookup.
  update(list, partial = 1, world = null, date = new Date()) {
    const live = new Set(list), festive = christmas(date);
    for (const [cart, r] of this.meshes)
      if (!live.has(cart) || r.festive !== festive) {
        this.dispose(r);
        this.meshes.delete(cart);
      }
    for (const cart of list) {
      let r = this.meshes.get(cart);
      if (!r) this.meshes.set(cart, (r = this.create(festive)));
      r.display.visible = cart.type !== 0;
      const pose = this.minecarts.renderPose(world, cart, partial);
      r.root.position.set(pose.x, pose.y, pose.z);
      r.root.rotation.set(pose.roll * D, (180 - pose.yaw) * D, -pose.pitch * D, "YZX");
      // Entity.getBrightnessForRender: 0.66 of the box height above its bottom.
      const packed = this.view.brightness(cart.x, cart.bb[1] + CART_HEIGHT * 0.66, cart.z);
      for (const m of r.materials) m.setLight(packed);
    }
  }
  clear() {
    for (const r of this.meshes.values()) this.dispose(r);
    this.meshes.clear();
  }
}
