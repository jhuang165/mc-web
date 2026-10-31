// TileEntityChestRenderer (bmm) with ModelChest (bhg) / ModelLargeChest (bhn).
// Only the west/north chest of a pair draws, using the 30-pixel-wide model.
import * as THREE from "three";
import { skinBox, pixelTexture } from "./first-person.js";
import { CHEST, chestPair, lidAngle, christmas } from "./chest.js";

// The model's front faces +z (south, metadata 3); others turn about Y.
const ROTATION = { 2: Math.PI, 3: 0, 4: -Math.PI / 2, 5: Math.PI / 2 };

export class ChestRenderer {
  constructor(scene) {
    this.scene = scene;
    this.models = new Map();
    this.materials = new Map();
  }
  material(name) {
    if (!this.materials.has(name)) this.materials.set(name, new THREE.MeshLambertMaterial({ map: pixelTexture(`/media/1.7.10/entity/chest/${name}.png`) }));
    return this.materials.get(name);
  }
  // Boxes in pixels from the block corner: base 0..10 high, lid 9..14 hinged at
  // the back (y 9, z 1), knob 7..11 on the front face.
  build(double, festive) {
    const w = double ? 30 : 14,
      tw = double ? 128 : 64,
      material = this.material((festive ? "christmas" : "normal") + (double ? "_double" : "")),
      root = new THREE.Group(),
      model = new THREE.Group(),
      lid = new THREE.Group(),
      box = (parent, bw, bh, bd, u, v, x, y, z) => {
        const mesh = new THREE.Mesh(skinBox(bw, bh, bd, u, v, tw, 64), material);
        mesh.position.set(x / 16, y / 16, z / 16);
        parent.add(mesh);
      };
    box(model, w, 10, 14, 0, 19, 1 + w / 2, 5, 8);
    lid.position.set(0, 9 / 16, 1 / 16);
    box(lid, w, 5, 14, 0, 0, 1 + w / 2, 2.5, 7);
    box(lid, 2, 4, 1, 0, 0, double ? 16 : 8, 0, 14.5);
    model.add(lid);
    model.position.set(double ? -1 : -0.5, 0, -0.5);
    root.add(model);
    return { root, lid };
  }
  // Rebuilds models whose pairing, facing or texture changed.
  sync(world, chests, date = new Date()) {
    const festive = christmas(date),
      seen = new Set();
    for (const [key, chest] of Object.entries(chests)) {
      const [x, y, z] = key.split(",").map(Number);
      if (world.get(x, y, z) !== CHEST) continue;
      const pair = chestPair(world, x, y, z);
      if (!pair.primary) continue;
      seen.add(key);
      const shape = `${chest.facing},${pair.east ? "e" : pair.south ? "s" : "1"},${festive}`;
      let entry = this.models.get(key);
      if (entry?.shape !== shape) {
        if (entry) this.remove(key);
        entry = { ...this.build(pair.double, festive), shape, chest };
        entry.root.position.set(x + (pair.east ? 1 : 0.5), y, z + (pair.south ? 1 : 0.5));
        entry.root.rotation.y = ROTATION[chest.facing] ?? 0;
        this.scene.add(entry.root);
        this.models.set(key, entry);
      }
      entry.chest = chest;
    }
    for (const key of [...this.models.keys()]) if (!seen.has(key)) this.remove(key);
  }
  remove(key) {
    const entry = this.models.get(key);
    this.scene.remove(entry.root);
    entry.root.traverse((o) => o.geometry?.dispose());
    this.models.delete(key);
  }
  clear() {
    for (const key of [...this.models.keys()]) this.remove(key);
  }
  // rotateAngleX = -(eased lid * pi/2), interpolated between ticks.
  update(partial) {
    for (const { lid, chest } of this.models.values()) lid.rotation.x = -lidAngle(chest, partial);
  }
}
