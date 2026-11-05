// TileEntitySkullRenderer (bms) with ModelSkeletonHead (bib): one 8 x 8 x 8 box at UV (0, 0) on the mob's own texture,
// posed by skullPose (skull.js). Floor heads sit on the block (translate x + 0.5, y, z + 0.5) and turn by Rot * 22.5
// degrees; wall heads move to the facing's offset and y + 0.25. The GL scale(-1, -1, 1) is a half turn about z, so the
// box's front (the model's -z) faces north at Rot 0.
import * as THREE from "three";
import { entityMaterial } from "./light-material.js";
import { pixelTexture, skinBox } from "./first-person.js";
import { SKULL, SKULL_TEXTURES, skullPose, skullTextureHeight } from "./skull.js";

const D = Math.PI / 180, MAX_DISTANCE_SQUARED = 4096; // TileEntity.getMaxRenderDistanceSquared
export class SkullRenderer {
  constructor(scene, view) { Object.assign(this, { scene, view, records: new Map(), geometries: new Map() }); }
  geometry(type) {
    if (!this.geometries.has(type)) this.geometries.set(type, skinBox(8, 8, 8, 0, 0, 64, skullTextureHeight(type)));
    return this.geometries.get(type);
  }
  create(type) {
    const root = new THREE.Group(), material = entityMaterial(this.view.lighting, { map: pixelTexture(SKULL_TEXTURES[type] ?? SKULL_TEXTURES[0]) });
    const mesh = new THREE.Mesh(this.geometry(type), material);
    mesh.position.y = 4 / 16;
    mesh.rotation.y = Math.PI; // skinBox's front is +z; the model's front is -z
    root.add(mesh);
    this.scene.add(root);
    return { root, material, type };
  }
  update(tiles, world, camera) {
    const seen = new Set();
    for (const t of tiles) {
      if (world.get(t.x, t.y, t.z) !== SKULL) continue;
      const dx = t.x + 0.5 - camera.x, dy = t.y + 0.5 - camera.y, dz = t.z + 0.5 - camera.z;
      if (dx * dx + dy * dy + dz * dz > MAX_DISTANCE_SQUARED) continue;
      seen.add(t);
      let r = this.records.get(t);
      if (r && r.type !== t.type) { this.dispose(r); r = null; }
      if (!r) { r = this.create(t.type); this.records.set(t, r); }
      const pose = skullPose(world.getMeta(t.x, t.y, t.z), t.rot);
      r.root.position.set(t.x + pose.t[0], t.y + pose.t[1], t.z + pose.t[2]);
      r.root.rotation.y = -pose.angle * D;
      r.material.setLight(this.view.brightness(t.x, t.y, t.z));
    }
    for (const [t, r] of this.records) if (!seen.has(t)) { this.dispose(r); this.records.delete(t); }
  }
  dispose(r) { this.scene.remove(r.root); r.material.dispose(); }
  clear() { for (const r of this.records.values()) this.dispose(r); this.records.clear(); }
}
