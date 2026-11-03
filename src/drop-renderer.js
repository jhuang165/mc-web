// RenderItem for EntityItem with fancy graphics: items bob
// sin(age/10 + hover) * 0.1 + 0.1 and spin (age/20 + hover) radians; blocks
// draw as 1/4-scale cubes, other items as 1/2-scale extruded sprites, with
// one to five copies by stack size.
import * as THREE from "three";
import { entityMaterial } from "./light-material.js";
import { itemTexture, pixelTexture, glintMesh, stairItemGeometry } from "./first-person.js";
import { STAIRS } from "./stairs.js";
import { stackHasEffect } from "./armor-enchantments.js";
import { ITEMS } from "./survival.js";
import { spriteGeometry } from "./sprite-geometry.js";
import { blockTile, tileRect } from "./block-textures.js";
import { JavaRandom } from "./lighting.js";

const copies = (n) => (n > 40 ? 5 : n > 20 ? 4 : n > 5 ? 3 : n > 1 ? 2 : 1);

export class DropRenderer {
  constructor(scene, view) {
    this.scene = scene;
    this.view = view;
    this.piles = new Map();
    this.sprite = spriteGeometry();
    this.cubes = new Map();
    this.flying = [];
  }
  cube(id, damage = 0) {
    const key = id + ":" + damage;
    if (!this.cubes.has(key) && STAIRS[id]) this.cubes.set(key, stairItemGeometry(id, 0.25));
    if (!this.cubes.has(key)) {
      const g = new THREE.BoxGeometry(0.25, 0.25, 0.25), uv = g.attributes.uv;
      for (let f = 0; f < 6; f++) {
        const r = tileRect(blockTile(id, f, false, damage));
        uv.setXY(f * 4, r.u0, r.v1);
        uv.setXY(f * 4 + 1, r.u1, r.v1);
        uv.setXY(f * 4 + 2, r.u0, r.v0);
        uv.setXY(f * 4 + 3, r.u1, r.v0);
      }
      this.cubes.set(key, g);
    }
    return this.cubes.get(key);
  }
  build(stack, hover) {
    const glint = stackHasEffect(stack, ITEMS[stack.id]), url = itemTexture(stack.id, stack.damage), group = new THREE.Group(), spin = new THREE.Group(), random = new JavaRandom(187),
      material = url
        ? entityMaterial(this.view.lighting, { map: pixelTexture(url), alphaTest: 0.1, side: THREE.DoubleSide })
        : entityMaterial(this.view.lighting, { map: this.view.textures.texture });
    for (let i = 0, n = copies(stack.count); i < n; i++) {
      let mesh;
      if (url) {
        mesh = new THREE.Mesh(this.sprite, material);
        mesh.scale.setScalar(0.5);
        mesh.position.set(-0.25, -0.125, (i - (n - 1) / 2) * 0.042);
      } else {
        mesh = new THREE.Mesh(this.cube(stack.id, stack.damage || 0), material);
        // Extra copies scatter by (rand * 2 - 1) * 0.2 blocks on each axis.
        if (i) mesh.position.set((random.nextFloat() * 2 - 1) * 0.2, (random.nextFloat() * 2 - 1) * 0.2, (random.nextFloat() * 2 - 1) * 0.2);
      }
      // ItemStack.hasEffect: the dropped item's glint pass (first-person.js glintMesh, an approximated scroll).
      if (glint) mesh.add(glintMesh(mesh.geometry, url ? pixelTexture(url) : this.view.textures.texture));
      spin.add(mesh);
    }
    group.add(spin);
    this.scene.add(group);
    return { group, spin, material, key: stack.id + ":" + (stack.damage || 0) + ":" + copies(stack.count) + ":" + (glint ? 1 : 0), hover };
  }
  remove(pile) {
    this.scene.remove(pile.group);
    pile.material.dispose();
  }
  // RenderItem.doRender: bob and spin from the entity's age and hover phase.
  place(pile, x, y, z, age) {
    pile.group.position.set(x, y + 0.125 + Math.sin(age / 10 + pile.hover) * 0.1 + 0.1, z);
    pile.spin.rotation.y = age / 20 + pile.hover;
    pile.material.setLight(this.view.brightness(x, y + 0.17, z));
  }
  // EntityPickupFX: over three ticks the item moves to 0.5 below the player's
  // eye (1.12 above the feet), eased by t squared. `target` is live.
  pickup(item, target) {
    const pile = this.piles.get(item);
    if (!pile) return;
    this.piles.delete(item);
    this.flying.push({ pile, item, target, start: null });
  }
  // `partial` is the fraction of the current tick; `ticks` a continuous clock.
  update(items, partial = 1, ticks = 0) {
    const seen = new Set();
    for (const e of items) {
      const stack = e.stack;
      if (!stack) continue;
      seen.add(e);
      let pile = this.piles.get(e);
      const key = stack.id + ":" + (stack.damage || 0) + ":" + copies(stack.count) + ":" + (stackHasEffect(stack, ITEMS[stack.id]) ? 1 : 0);
      if (pile?.key !== key) {
        if (pile) this.remove(pile);
        pile = this.build(stack, e.hover);
        this.piles.set(e, pile);
      }
      this.place(pile, e.px + (e.x - e.px) * partial, e.py + (e.y - e.py) * partial, e.pz + (e.z - e.pz) * partial, e.age + partial);
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
      this.place(fx.pile, e.x + (p.x - e.x) * t, e.y + (p.y + 1.12 - e.y) * t, e.z + (p.z - e.z) * t, e.age + (ticks - fx.start));
      return true;
    });
  }
  clear() {
    this.update([], 0);
    for (const fx of this.flying) this.remove(fx.pile);
    this.flying = [];
  }
}
