// RenderItem for EntityItem piles with fancy graphics: the first stack bobs
// sin(age/10 + hover) * 0.1 + 0.1 and spins (age/20 + hover) radians; blocks
// draw as 1/4-scale cubes, other items as 1/2-scale extruded sprites, with
// one to five copies by stack size.
import * as THREE from "three";
import { entityMaterial } from "./light-material.js";
import { itemTexture, pixelTexture } from "./first-person.js";
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
  }
  cube(id) {
    if (!this.cubes.has(id)) {
      const g = new THREE.BoxGeometry(0.25, 0.25, 0.25), uv = g.attributes.uv;
      for (let f = 0; f < 6; f++) {
        const r = tileRect(blockTile(id, f));
        uv.setXY(f * 4, r.u0, r.v1);
        uv.setXY(f * 4 + 1, r.u1, r.v1);
        uv.setXY(f * 4 + 2, r.u0, r.v0);
        uv.setXY(f * 4 + 3, r.u1, r.v0);
      }
      this.cubes.set(id, g);
    }
    return this.cubes.get(id);
  }
  build(stack) {
    const url = itemTexture(stack.id), group = new THREE.Group(), spin = new THREE.Group(), random = new JavaRandom(187),
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
        mesh = new THREE.Mesh(this.cube(stack.id), material);
        // Extra copies scatter by (rand * 2 - 1) * 0.2 blocks on each axis.
        if (i) mesh.position.set((random.nextFloat() * 2 - 1) * 0.2, (random.nextFloat() * 2 - 1) * 0.2, (random.nextFloat() * 2 - 1) * 0.2);
      }
      spin.add(mesh);
    }
    group.add(spin);
    this.scene.add(group);
    return { group, spin, material, key: stack.id + ":" + copies(stack.count), hover: Math.random() * Math.PI * 2, born: null };
  }
  remove(pile) {
    this.scene.remove(pile.group);
    pile.material.dispose();
  }
  // `ticks` is a continuous client tick count, for the bob and spin.
  update(drops, ticks) {
    const seen = new Set();
    for (const d of drops) {
      const stack = d.stacks?.[0];
      if (!stack) continue;
      seen.add(d);
      let pile = this.piles.get(d);
      const key = stack.id + ":" + copies(stack.count);
      if (pile?.key !== key) {
        if (pile) this.remove(pile);
        pile = this.build(stack);
        this.piles.set(d, pile);
      }
      pile.born ??= ticks;
      const age = ticks - pile.born, bob = Math.sin(age / 10 + pile.hover) * 0.1 + 0.1;
      pile.group.position.set(d.position.x, d.position.y + 0.125 + bob, d.position.z);
      pile.spin.rotation.y = age / 20 + pile.hover;
      pile.material.setLight(this.view.brightness(d.position.x, d.position.y + 0.17, d.position.z));
    }
    for (const [d, pile] of this.piles)
      if (!seen.has(d)) {
        this.remove(pile);
        this.piles.delete(d);
      }
  }
  clear() {
    this.update([], 0);
  }
}
