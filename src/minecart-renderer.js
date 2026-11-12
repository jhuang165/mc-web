// RenderMinecart (boi) with ModelMinecart (bhq) for EntityMinecartChest: the entity-id jitter, the
// cart moved onto its rail and turned to the rail slope (Minecarts.renderPose), rotate (180 - yaw)
// about Y, -pitch about Z and the hurt wobble about X; the display block (the chest, offset 8)
// scaled 0.75 and raised 8/16, drawn as RenderBlocks.renderBlockAsItem does for render type 22
// (rotated 90 degrees about Y, centred, TileEntityChestRenderer at metadata 0 with the lid shut);
// then scale(-1, -1, 1) and the six ModelMinecart boxes at 1/16 from entity/minecart.png (64 x 32),
// the floor's rotation point at y 4.1 (4 - f3, f3 = -0.1). The 0.5 shadow is cast by main.js (SHADOWS.minecart).
// Batch 49: a cart whose view carries `display` (data watcher 20-22: block id | data << 16, offset in 1/16) draws that block instead of its type's own (RenderMinecart: getDisplayTile
// n(), getDisplayTileData p(), getDisplayTileOffset r(); air is render type -1 and draws nothing). Cubes and the item boxes come from the block atlas as a dropped block's do,
// the chest family and the hopper from their own models; other render types (flowers, fluids, ...) are drawn as plain cubes (approximation).
import * as THREE from "three";
import { skinBox, pixelTexture, blockItemGeometry, blockItemTurn, blockCubeGeometry } from "./first-person.js";
import { fromOriginal } from "./block-registry.js";
import { entityMaterial } from "./light-material.js";
import { ChestRenderer } from "./chest-renderer.js";
import { christmas } from "./chest.js";
import { TRAPPED_CHEST, ENDER_CHEST } from "./chest-blocks.js";
import { CART_HEIGHT } from "./minecarts.js";
import { DISPLAY } from "./cart-variants.js";
import { CartBlockRenderer } from "./cart-block-renderer.js";
import { displayShape, displayGeometry } from "./cart-display-shape.js";

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
    this.blocks = new CartBlockRenderer(view);
    this.texture = pixelTexture("/media/1.7.10/entity/minecart.png");
    this.geometries = CART_PARTS.map(({ uv, box }) => skinBox(box[3], box[4], box[5], uv[0], uv[1], 64, 32));
  }
  create(festive, type = 1) {
    if (type !== 0 && type !== 1) return this.createBlock(type, festive);
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
  // Furnace, TNT, hopper and command block carts: the cart inside a group that swells with the TNT fuse (cart-block-renderer.js).
  createBlock(type, festive) {
    const root = new THREE.Group(), body = new THREE.Group(), material = entityMaterial(this.view.lighting, { map: this.texture });
    root.rotation.order = "YZX";
    const { display, materials, white } = this.blocks.build(type);
    // RenderTntMinecart.func_147910_a: glScalef(swell) inside RenderMinecart's scale 0.75 / translate(0, offset / 16) frame, so only the display block and the flash cube swell, not the cart.
    const swell = new THREE.Group();
    swell.add(display);
    if (white) swell.add(white);
    body.add(swell, cartModel(material, this.geometries));
    root.add(body);
    this.scene.add(root);
    return { root, display, body, swell, white, materials: [material, ...materials], festive };
  }
  // The watched display block: scale 0.75, raised offset / 16 (set every frame), renderBlockAsItem's turn about Y. Null for air or a block the port has no cell for.
  buildCustom(d, festive) {
    const cell = d.id ? fromOriginal(d.id, d.data) : null;
    if (!cell) return null;
    if (d.id === 154) { const { display, materials } = this.blocks.build(5); return { group: display, materials, geometries: [] }; }
    const shape = displayShape(d.id); // renderBlockAsItem has no branch for most non-item render types: nothing is drawn (cart-display-shape.js)
    if (shape === "none") return null;
    const group = new THREE.Group(), turn = new THREE.Group();
    group.scale.setScalar(0.75);
    turn.rotation.y = Math.PI / 2;
    group.add(turn);
    if (d.id === 54 || d.id === 130 || d.id === 146) {
      const chest = this.chests.build(false, festive, d.id === 146 ? TRAPPED_CHEST : d.id === 130 ? ENDER_CHEST : 0);
      chest.root.position.y = -0.5;
      turn.add(chest.root);
      return { group, materials: [chest.material], geometries: [] };
    }
    if (shape !== "item") {
      const material = entityMaterial(this.view.lighting, { map: this.view.textures.texture, side: THREE.DoubleSide }), g = displayGeometry(shape, cell);
      turn.rotation.y = 0; // renderBlockAsItem turns only types 0, 16, 22, 26, 31, 39
      turn.add(new THREE.Mesh(g, material));
      return { group, materials: [material], geometries: [g] };
    }
    const material = entityMaterial(this.view.lighting, { map: this.view.textures.texture }), g = blockItemGeometry(cell.id, cell.meta, 1) ?? blockCubeGeometry(cell.id, cell.meta, 1);
    turn.rotation.y = blockItemTurn(cell.id, cell.meta);
    turn.add(new THREE.Mesh(g, material));
    return { group, materials: [material], geometries: [g] };
  }
  dropCustom(r) {
    if (!r.custom) return;
    r.custom.group?.parent?.remove(r.custom.group);
    for (const m of r.custom.materials ?? []) m.dispose();
    for (const g of r.custom.geometries ?? []) g.dispose();
    r.custom = null;
  }
  dispose(r) {
    this.dropCustom(r);
    this.scene.remove(r.root);
    for (const m of r.materials) m.dispose();
    r.white?.material.dispose();
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
      if (!r) this.meshes.set(cart, (r = this.create(festive, cart.type)));
      const d = cart.display;
      if (d) {
        const key = d.id + ":" + d.data;
        if (!r.custom || r.custom.key !== key) { this.dropCustom(r); r.custom = { ...(this.buildCustom(d, festive) ?? { group: null }), key }; if (r.custom.group) (r.swell ?? r.root).add(r.custom.group); }
        if (r.custom.group) r.custom.group.position.y = r.swell ? 0 : 0.75 * (d.offset / 16);
        r.display.visible = false;
      } else { this.dropCustom(r); r.display.visible = cart.type !== 0; }
      if (r.swell) {
        const { scale, flash } = CartBlockRenderer.fuse(cart, partial);
        r.swell.position.y = 0.75 * ((d ? d.offset : DISPLAY[cart.type]?.offset ?? 6) / 16);
        r.swell.scale.setScalar(scale);
        if (r.white) { r.white.visible = flash > 0; r.white.material.opacity = flash; }
      }
      const pose = this.minecarts.renderPose(world, cart, partial);
      r.root.position.set(pose.x, pose.y, pose.z);
      r.root.rotation.set(pose.roll * D, (180 - pose.yaw) * D, -pose.pitch * D, "YZX");
      // Entity.getBrightnessForRender: 0.66 of the box height above its bottom.
      const packed = this.view.brightness(cart.x, cart.bb[1] + CART_HEIGHT * 0.66, cart.z);
      for (const m of r.materials) m.setLight(packed);
      for (const m of r.custom?.materials ?? []) m.setLight(packed);
    }
  }
  clear() {
    for (const r of this.meshes.values()) this.dispose(r);
    this.meshes.clear();
  }
}
