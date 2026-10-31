// RenderArrow (bnb, textures/entity/arrow.png 32 x 32). Per frame the original does
// translate(lastTickPos lerp), rotate(prevYaw lerp - 90, y), rotate(prevPitch lerp, z),
// the shake (f = shake - partial; rotate(-sin(f * 3) * f, z) while f > 0), rotate(45, x),
// scale(0.05625) and translate(-4, 0, 0), then draws the two tail plates at x = -7 and the
// shaft as four 16 x 4 quads in the z = 0 plane, each turned another 90 degrees about x.
// Arrows have no shadow (shadowSize 0). The geometry is built once with the scale and the
// translate baked in; the rest is one Euler rotation (Y, Z, X) per arrow.
import * as THREE from "three";
import { entityMaterial } from "./light-material.js";
import { pixelTexture } from "./first-person.js";

const RAD = Math.PI / 180, SCALE = 0.05625;
// Entity.getBrightnessForRender: floor(posY - yOffset + height * 0.66), the 0.5 box.
const LIGHT = 0.5 * 0.66;

// [x, y, z, u, v] with u and v in pixels of the 32 x 32 texture, in the original's vertex
// order. The plates' normals are (+-0.05625, 0, 0) and the shaft's (0, 0, 0.05625).
const PLATES = [
  [[1, 0, 0], [[-7, -2, -2, 0, 5], [-7, -2, 2, 5, 5], [-7, 2, 2, 5, 10], [-7, 2, -2, 0, 10]]],
  [[-1, 0, 0], [[-7, 2, -2, 0, 5], [-7, 2, 2, 5, 5], [-7, -2, 2, 5, 10], [-7, -2, -2, 0, 10]]],
];
const SHAFT = [[-8, -2, 0, 0, 0], [8, -2, 0, 16, 0], [8, 2, 0, 16, 5], [-8, 2, 0, 0, 5]];

export function arrowGeometry() {
  const p = [], uv = [], n = [];
  const quad = (vertices, normal, turn) => {
    // `turn` is the cumulative rotate(90, x) of the shaft's quads.
    const c = Math.cos(turn), s = Math.sin(turn);
    const at = ([x, y, z, u, v]) => {
      const ry = y * c - z * s, rz = y * s + z * c;
      p.push((x - 4) * SCALE, ry * SCALE, rz * SCALE);
      uv.push(u / 32, 1 - v / 32);
      n.push(normal[0], normal[1] * c - normal[2] * s, normal[1] * s + normal[2] * c);
    };
    for (const i of [0, 1, 2, 0, 2, 3]) at(vertices[i]);
  };
  for (const [normal, vertices] of PLATES) quad(vertices, normal, 0);
  for (let i = 0; i < 4; i++) quad(SHAFT, [0, 0, 1], (i * Math.PI) / 2);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(n, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  return g;
}

export class ArrowRenderer {
  constructor(scene, view) {
    this.scene = scene;
    this.view = view;
    this.arrows = new Map();
    this.geometry = arrowGeometry();
    this.material = null;
  }
  // `partial` is the fraction of the current tick: RenderManager lerps the position from
  // lastTickPos and RenderArrow the angles from prevRotation.
  update(arrows, partial = 1) {
    const seen = new Set(), lerp = (a, b) => a + (b - a) * partial;
    this.material ??= entityMaterial(this.view.lighting, { map: pixelTexture("/media/1.7.10/entity/arrow.png") });
    for (const a of arrows) {
      seen.add(a);
      let mesh = this.arrows.get(a);
      if (!mesh) {
        mesh = new THREE.Mesh(this.geometry, entityMaterial(this.view.lighting, { map: this.material.uniforms.map.value }));
        mesh.rotation.order = "YZX";
        mesh.frustumCulled = false;
        this.scene.add(mesh);
        this.arrows.set(a, mesh);
      }
      const x = lerp(a.px, a.x), y = lerp(a.py, a.y), z = lerp(a.pz, a.z), shake = a.shake - partial;
      mesh.position.set(x, y, z);
      mesh.rotation.set(
        45 * RAD,
        (lerp(a.prevYaw, a.yaw) - 90) * RAD,
        (lerp(a.prevPitch, a.pitch) + (shake > 0 ? -Math.sin(shake * 3) * shake : 0)) * RAD,
      );
      mesh.material.setLight(this.view.brightness(x, y + LIGHT, z));
    }
    for (const [a, mesh] of this.arrows)
      if (!seen.has(a)) {
        this.scene.remove(mesh);
        mesh.material.dispose();
        this.arrows.delete(a);
      }
  }
  clear() {
    this.update([]);
  }
}
