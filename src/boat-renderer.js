// RenderBoat (bne) with ModelBoat (bhe): the five boxes of entity/boat.png (64 x 32) at 1/16, drawn after
// translate to the interpolated position, rotate (180 - yaw) about Y, the hit wobble about X (Boats.renderPose)
// and scale(-1, -1, 1). The 0.5 shadow is drawn by shadows.js (main.js shadowCasters).
import * as THREE from "three";
import { skinBox, pixelTexture } from "./first-person.js";
import { entityMaterial } from "./light-material.js";

const D = Math.PI / 180, fr = Math.fround;
// ModelBoat.a[0..4]: texture offset, addBox (x, y, z, w, h, d), rotation point, rotateAngleX/Y.
export const BOAT_PARTS = [
  { uv: [0, 8], box: [-12, -8, -3, 24, 16, 4], at: [0, 4, 0], rot: [fr(Math.PI / 2), 0] },
  { uv: [0, 0], box: [-10, -7, -1, 20, 6, 2], at: [-11, 4, 0], rot: [0, fr((3 * Math.PI) / 2)] },
  { uv: [0, 0], box: [-10, -7, -1, 20, 6, 2], at: [11, 4, 0], rot: [0, fr(Math.PI / 2)] },
  { uv: [0, 0], box: [-10, -7, -1, 20, 6, 2], at: [0, 4, -9], rot: [0, fr(Math.PI)] },
  { uv: [0, 0], box: [-10, -7, -1, 20, 6, 2], at: [0, 4, 9], rot: [0, 0] },
];

export function boatModel(material, geometries = BOAT_PARTS.map(({ uv, box }) => skinBox(box[3], box[4], box[5], uv[0], uv[1], 64, 32))) {
  const model = new THREE.Group();
  model.scale.set(-1, -1, 1);
  BOAT_PARTS.forEach(({ box, at, rot }, i) => {
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

export class BoatRenderer {
  // `view` supplies the lighting uniforms and Entity.getBrightnessForRender; `boats` is the Boats system.
  constructor(scene, view, boats) {
    Object.assign(this, { scene, view, boats, meshes: new Map() });
    this.texture = pixelTexture("/media/1.7.10/entity/boat.png");
    this.geometries = BOAT_PARTS.map(({ uv, box }) => skinBox(box[3], box[4], box[5], uv[0], uv[1], 64, 32));
  }
  create() {
    const root = new THREE.Group(), material = entityMaterial(this.view.lighting, { map: this.texture });
    root.rotation.order = "YZX";
    root.add(boatModel(material, this.geometries));
    this.scene.add(root);
    return { root, material };
  }
  dispose(r) {
    this.scene.remove(r.root);
    r.material.dispose();
  }
  update(list, partial = 1, world = null) {
    const live = new Set(list);
    for (const [boat, r] of this.meshes)
      if (!live.has(boat)) { this.dispose(r); this.meshes.delete(boat); }
    for (const boat of list) {
      let r = this.meshes.get(boat);
      if (!r) this.meshes.set(boat, (r = this.create()));
      const pose = this.boats.renderPose(world, boat, partial);
      r.root.position.set(pose.x, pose.y, pose.z);
      r.root.rotation.set(pose.roll * D, (180 - pose.yaw) * D, 0, "YZX");
      r.material.setLight(this.view.brightness(boat.x, boat.bb[1] + boat.height * 0.66, boat.z));
    }
  }
  clear() {
    for (const r of this.meshes.values()) this.dispose(r);
    this.meshes.clear();
  }
}
