// RenderItem for EntityItem with fancy graphics: items bob
// sin(age/10 + hover) * 0.1 + 0.1 and spin (age/20 + hover) radians; blocks
// draw as 1/4-scale cubes, other items as 1/2-scale extruded sprites, with
// one to five copies by stack size.
import * as THREE from "three";
import { entityMaterial } from "./light-material.js";
import { SAMPLE_HEIGHT } from "./display-light.js";
import { itemTexture, pixelTexture, glintMesh, blockItemGeometry, blockItemTurn, blockCubeGeometry } from "./first-person.js";
import { itemFrameTag } from "./item-animation.js";
import { stackHasEffect } from "./armor-enchantments.js";
import { ITEMS } from "./survival.js";
import { spriteGeometry } from "./sprite-geometry.js";
import { blockTile, tileRect } from "./block-textures.js";
import { JavaRandom } from "./lighting.js";
import { itemPasses } from "./item-passes.js";
import { flatItemSprites } from "./render-settings.js";
import { chestItemTexture, chestItemModel } from "./chest-renderer.js";

import { blockCopyCount, spriteCopyCount, fancySpriteZ, flatSpriteOffsets } from "./drop-sprite.js";

// RenderItem (executed, drop-sprite.js): a block or the chest draws the block rule's copies, a fancy sprite item its own 1 to 4, a fast sprite the block rule's count.
const copies = (n, sprite = false, flat = false) => (sprite && !flat ? spriteCopyCount(n) : blockCopyCount(n));

const ITEM_HEIGHT = 0.25;
export class DropRenderer {
  constructor(scene, view) {
    this.scene = scene;
    this.view = view;
    this.piles = new Map();
    this.sprite = spriteGeometry();
    // Fast graphics: RenderItem draws a sprite item as flat quads (u0..u1 x v0..v1) turned to the player's yaw.
    this.flatSprite = new THREE.PlaneGeometry(1, 1).translate(0.5, 0.5, 0);
    this.cubes = new Map();
    this.flying = [];
  }
  cube(id, damage = 0) {
    const key = id + ":" + damage;
    if (!this.cubes.has(key)) { const boxes = blockItemGeometry(id, damage, 0.25); if (boxes) this.cubes.set(key, boxes); } // renderBlockAsItem boxes (stairs, gate, anvil, slabs, plates, ...)
    if (!this.cubes.has(key)) {
      const g = blockCubeGeometry(id, damage, 0.25);
      this.cubes.set(key, g);
    }
    return this.cubes.get(key);
  }
  build(stack, hover) {
    const glint = stackHasEffect(stack, ITEMS[stack.id]), leather = itemPasses(stack.id, stack.damage, stack.color), url = leather?.base ?? itemTexture(stack.id, stack.damage),
      color = leather?.color ?? 0, group = new THREE.Group(), spin = new THREE.Group(), random = new JavaRandom(187),
      chestUrl = !url && chestItemTexture(stack.id),
      material = url
        ? entityMaterial(this.view.lighting, { map: pixelTexture(url), alphaTest: 0.1, side: THREE.DoubleSide, ...(leather ? { color: leather.tint } : {}) })
        : chestUrl ? entityMaterial(this.view.lighting, { map: pixelTexture(chestUrl) })
        : entityMaterial(this.view.lighting, { map: this.view.textures.texture });
    const overlayUrl = leather?.overlay,
      overlayMaterial = overlayUrl ? entityMaterial(this.view.lighting, { map: pixelTexture(overlayUrl), alphaTest: 0.1, side: THREE.DoubleSide, ...(leather.overlayTint ? { color: leather.overlayTint } : {}) }) : null;
    if (overlayMaterial) {
      overlayMaterial.depthWrite = false;
      overlayMaterial.polygonOffset = true;
      overlayMaterial.polygonOffsetFactor = -1;
    }
    const flat = flatItemSprites(), n0 = copies(stack.count, !!url, flat), spinners = [], zs = url && !flat ? fancySpriteZ(n0) : null, offsets = url && flat ? flatSpriteOffsets(n0, random) : null;
    for (let i = 0, n = n0; i < n; i++) {
      let mesh;
      if (url) {
        mesh = new THREE.Mesh(flat ? this.flatSprite : this.sprite, material);
        mesh.scale.setScalar(0.5);
        // Fancy: the copies stack along z by 0.0625 + 0.021875 each, first at -(step * n / 2) + step (drop-sprite.js, in the half-scale space, so half of it here).
        mesh.position.set(-0.25, -0.125, zs ? zs[i] * 0.5 : 0);
        if (flat) {
          // Fast: the copy's random offset (also halved by the scale) is applied before the turn to the view, so it sits on a holder outside the turning group.
          const holder = new THREE.Group(), spinner = new THREE.Group();
          holder.position.set(...offsets[i].map((v) => v * 0.5));
          spinner.add(mesh);
          holder.add(spinner);
          group.add(holder);
          spinners.push(spinner);
          if (glint) mesh.add(glintMesh(mesh.geometry, pixelTexture(url)));
          if (overlayMaterial) {
            const overlay = new THREE.Mesh(this.sprite, overlayMaterial);
            overlay.scale.copy(mesh.scale); overlay.position.copy(mesh.position); overlay.renderOrder = 1;
            if (glint) overlay.add(glintMesh(overlay.geometry, pixelTexture(overlayUrl)));
            spinner.add(overlay);
          }
          continue;
        }
        if (glint) mesh.add(glintMesh(mesh.geometry, pixelTexture(url)));
        if (overlayMaterial) {
          const overlay = new THREE.Mesh(this.sprite, overlayMaterial);
          overlay.scale.copy(mesh.scale); overlay.position.copy(mesh.position); overlay.renderOrder = 1;
          if (glint) overlay.add(glintMesh(overlay.geometry, pixelTexture(overlayUrl)));
          spin.add(mesh, overlay);
          continue;
        }
      } else {
        mesh = chestUrl ? chestItemModel(material, 0.25) : new THREE.Mesh(this.cube(stack.id, stack.damage || 0), material);
        mesh.rotation.y = blockItemTurn(stack.id, stack.damage || 0); // renderBlockAsItem's own turn, inside the spin (types 0, 16, 22, 26, 31, 39)
        // Extra copies scatter by (rand * 2 - 1) * 0.2 blocks on each axis.
        if (i) mesh.position.set((random.nextFloat() * 2 - 1) * 0.2, (random.nextFloat() * 2 - 1) * 0.2, (random.nextFloat() * 2 - 1) * 0.2);
      }
      // ItemStack.hasEffect: the dropped item's glint pass (first-person.js glintMesh, an approximated scroll).
      if (glint && !url && mesh.geometry) mesh.add(glintMesh(mesh.geometry, this.view.textures.texture));
      spin.add(mesh);
    }
    group.add(spin);
    this.scene.add(group);
    return { group, spin: spinners[0] ?? spin, spinners, material, overlayMaterial, flat: !!url && flat, key: stack.id + ":" + (stack.damage || 0) + ":" + n0 + ":" + itemFrameTag(url) + ":" + (glint ? 1 : 0) + ":" + color + ":" + (flat ? "f" : "d"), hover };
  }
  remove(pile) {
    this.scene.remove(pile.group);
    const owned = new Set();
    pile.group.traverse((node) => {
      if (node.userData.ownGeometry) node.geometry.dispose();
      if (node.material) for (const material of Array.isArray(node.material) ? node.material : [node.material]) owned.add(material);
    });
    for (const material of owned) material.dispose();
  }
  // RenderItem.doRender: bob and spin from the entity's age and hover phase.
  // `at` is the entity's own box bottom: Entity.getBrightnessForRender reads its current position, not the interpolated or flying draw position (EntityPickupFX asks the item entity too).
  place(pile, x, y, z, age, at = { x, y, z }) {
    pile.group.position.set(x, y + 0.125 + Math.sin(age / 10 + pile.hover) * 0.1 + 0.1, z);
    if (pile.flat) {
      // glRotatef(180 - playerViewY): the quad stays parallel to the view plane.
      const d = this.view.camera.getWorldDirection(new THREE.Vector3());
      for (const spinner of pile.spinners) spinner.rotation.y = Math.atan2(-d.x, -d.z);
    } else pile.spin.rotation.y = age / 20 + pile.hover;
    const brightness = this.view.brightness(at.x, at.y + ITEM_HEIGHT * SAMPLE_HEIGHT, at.z); // Entity.getBrightnessForRender: posY - yOffset + height * 0.66 of the 0.25 box (executed: the sampled cell changes at y 65.835, not 65.83)
    pile.material.setLight(brightness);
    pile.overlayMaterial?.setLight(brightness);
  }
  // EntityPickupFX: over three ticks the item moves to 0.5 below the player's
  // eye (1.12 above the feet), eased by t squared. `target` is live.
  pickup(item, target) {
    const pile = this.piles.get(item);
    if (!pile) return;
    this.piles.delete(item);
    this.flying.push({ pile, item, target, start: null });
  }
  // b63 (mpprojectiles2): EntityPickupFX for something that was never a drop here (an arrow a connected player took): builds the pile for `item.stack` and flies it to `target` like pickup().
  flyIn(item, target) {
    this.flying.push({ pile: this.build(item.stack, item.hover ?? 0), item, target, start: null });
  }
  // `partial` is the fraction of the current tick; `ticks` a continuous clock.
  update(items, partial = 1, ticks = 0) {
    const seen = new Set();
    for (const e of items) {
      const stack = e.stack;
      if (!stack) continue;
      seen.add(e);
      let pile = this.piles.get(e);
      const leather = itemPasses(stack.id, stack.damage, stack.color),
        key = stack.id + ":" + (stack.damage || 0) + ":" + copies(stack.count, !!itemTexture(stack.id, stack.damage), flatItemSprites()) + ":" + itemFrameTag(itemTexture(stack.id, stack.damage)) + ":" + (stackHasEffect(stack, ITEMS[stack.id]) ? 1 : 0) + ":" + (leather?.color ?? 0) + ":" + (flatItemSprites() ? "f" : "d");
      if (pile?.key !== key) {
        if (pile) this.remove(pile);
        pile = this.build(stack, e.hover);
        this.piles.set(e, pile);
      }
      this.place(pile, e.px + (e.x - e.px) * partial, e.py + (e.y - e.py) * partial, e.pz + (e.z - e.pz) * partial, e.age + partial, e);
    }
    for (const [e, pile] of this.piles)
      if (!seen.has(e)) {
        this.remove(pile);
        this.piles.delete(e);
      }
    this.flying = this.flying.filter((fx) => {
      fx.start ??= ticks;
      let t = (ticks - fx.start) / 3;
      if (t >= 1) {
        this.remove(fx.pile);
        return false;
      }
      t *= t;
      const e = fx.item, p = fx.target;
      this.place(fx.pile, e.x + (p.x - e.x) * t, e.y + (p.y + 1.12 - e.y) * t, e.z + (p.z - e.z) * t, e.age + (ticks - fx.start), e);
      return true;
    });
  }
  clear() {
    this.update([], 0);
    for (const fx of this.flying) this.remove(fx.pile);
    this.flying = [];
  }
}
