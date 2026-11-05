// TileEntityChestRenderer (bmm) with ModelChest (bhg) / ModelLargeChest (bhn).
// Only the west/north chest of a pair draws, using the 30-pixel-wide model.
import * as THREE from "three";
import { skinBox, pixelTexture } from "./first-person.js";
import { chestPair, lidAngle, christmas } from "./chest.js";
import { isChestBlock, TRAPPED_CHEST, ENDER_CHEST } from "./chest-blocks.js";
import { entityMaterial } from "./light-material.js";

// The model's front faces +z (south, metadata 3); others turn about Y.
const ROTATION = { 2: Math.PI, 3: 0, 4: -Math.PI / 2, 5: Math.PI / 2 };

export class ChestRenderer {
  // `view` supplies the lightmap and world brightness (VoxelScene).
  constructor(scene, view) {
    this.scene = scene;
    this.view = view;
    this.models = new Map();
  }
  // TileEntityRendererDispatcher lights each chest with the brightness of its
  // cell and RenderHelper's standard item lighting.
  material(name) {
    return entityMaterial(this.view.lighting, { map: pixelTexture(`/media/1.7.10/entity/chest/${name}.png`) });
  }
  // Boxes in pixels from the block corner: base 0..10 high, lid 9..14 hinged at
  // the back (y 9, z 1), knob 7..11 on the front face.
  // `kind` picks the texture: a trapped chest always uses trapped(.png / _double) (TileEntityChestRenderer checks the
  // type before the Christmas date), the ender chest the single-model ender.png (TileEntityEnderChestRenderer).
  build(double, festive, kind = 0) {
    const w = double ? 30 : 14,
      tw = double ? 128 : 64,
      material = this.material(kind === ENDER_CHEST ? "ender" : (kind === TRAPPED_CHEST ? "trapped" : festive ? "christmas" : "normal") + (double ? "_double" : "")),
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
    return { root, lid, material };
  }
  // Rebuilds models whose pairing, facing or texture changed.
  // `enders` maps "x,y,z" to the runtime ender chest tiles ({ users, lid, prevLid }; the facing is the cell's metadata).
  sync(world, chests, date = new Date(), enders = {}) {
    const festive = christmas(date),
      seen = new Set();
    for (const [key, tile] of Object.entries(enders)) {
      const [x, y, z] = key.split(",").map(Number);
      if (world.get(x, y, z) !== ENDER_CHEST) continue;
      const mapKey = "e" + key, facing = world.getMeta(x, y, z);
      seen.add(mapKey);
      let entry = this.models.get(mapKey);
      if (entry?.shape !== `e${facing}`) {
        if (entry) this.remove(mapKey);
        entry = { ...this.build(false, false, ENDER_CHEST), shape: `e${facing}`, chest: tile, cell: [x, y, z] };
        entry.root.position.set(x + 0.5, y, z + 0.5);
        entry.root.rotation.y = ROTATION[facing] ?? 0;
        this.scene.add(entry.root);
        this.models.set(mapKey, entry);
      }
      entry.chest = tile;
    }
    for (const [key, chest] of Object.entries(chests)) {
      const [x, y, z] = key.split(",").map(Number), kind = world.get(x, y, z);
      if (!isChestBlock(kind)) continue;
      const pair = chestPair(world, x, y, z);
      if (!pair.primary) continue;
      seen.add(key);
      const shape = `${chest.facing},${pair.east ? "e" : pair.south ? "s" : "1"},${festive},${kind}`;
      let entry = this.models.get(key);
      if (entry?.shape !== shape) {
        if (entry) this.remove(key);
        entry = { ...this.build(pair.double, festive, kind), shape, chest, cell: [x, y, z] };
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
    entry.material.dispose();
    this.models.delete(key);
  }
  clear() {
    for (const key of [...this.models.keys()]) this.remove(key);
  }
  // rotateAngleX = -(eased lid * pi/2), interpolated between ticks.
  update(partial) {
    for (const { lid, chest, material, cell } of this.models.values()) {
      lid.rotation.x = -lidAngle(chest, partial);
      material.setLight(this.view.brightness(...cell));
    }
  }
}
