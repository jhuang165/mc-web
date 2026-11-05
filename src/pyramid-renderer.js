// TileEntityBeaconRenderer (bmj): the beam up from every active beacon. Two passes over entity/beacon_beam.png
// (repeat wrapping, alpha test 0.1, vertex colour 255,255,255,32): a rotating additive square of radius 0.2 with depth
// writes, then a fixed 0.2..0.8 box with alpha blending and no depth writes. The height is 256 times the fade-in
// (aoq.i, beamFade). Geometry is rebuilt per frame; evidence: bytecode (public/research/beacon.md), not browser-verified.
import * as THREE from "three";
import { pixelTexture } from "./first-person.js";
import { BEACON, BEAM_HEIGHT, beamFade } from "./pyramid.js";

const ANGLES = [2.356194490192345, Math.PI / 4, 3.9269908169872414, 5.497787143782138];
const ALPHA = 32 / 255;

// Quads (4 vertices each, bottom to top pairs) of pass 1 and pass 2 for one beam; exported for tests.
export function beamQuads(time, fade, height = BEAM_HEIGHT * fade) {
  const f2 = time, f3 = -f2 * 0.2 - Math.floor(-f2 * 0.1), spin = f2 * 0.025 * (1 - 2.5), r = 0.2;
  const c = ANGLES.map((a) => [0.5 + Math.cos(spin + a) * r, 0.5 + Math.sin(spin + a) * r]);
  const v1 = -1 + f3, inner = [[c[0], c[1]], [c[3], c[2]], [c[1], c[3]], [c[2], c[0]]].map(([a, b]) => ({ a, b, h: height, v2: height * (0.5 / r) + v1, v1 }));
  const box = [[[0.2, 0.2], [0.8, 0.2]], [[0.8, 0.8], [0.2, 0.8]], [[0.8, 0.2], [0.8, 0.8]], [[0.2, 0.8], [0.2, 0.2]]].map(([a, b]) => ({ a, b, h: height, v2: height + v1, v1 }));
  return { inner, outer: box };
}
function geometry(quads, x, y, z) {
  const pos = [], uv = [], col = [], idx = [];
  quads.forEach(({ a, b, h, v1, v2 }, i) => {
    pos.push(x + a[0], y, z + a[1], x + b[0], y, z + b[1], x + b[0], y + h, z + b[1], x + a[0], y + h, z + a[1]);
    uv.push(0, v1, 1, v1, 1, v2, 0, v2);
    for (let k = 0; k < 4; k++) col.push(1, 1, 1, ALPHA);
    idx.push(i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 4));
  g.setIndex(idx);
  return g;
}

export class BeaconRenderer {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);
    const map = pixelTexture("/media/1.7.10/entity/beacon_beam.png").clone();
    map.needsUpdate = true;
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    const base = { map, vertexColors: true, transparent: true, alphaTest: 0.1, side: THREE.DoubleSide, fog: false };
    this.inner = new THREE.MeshBasicMaterial({ ...base, blending: THREE.AdditiveBlending, depthWrite: true });
    this.outer = new THREE.MeshBasicMaterial({ ...base, blending: THREE.NormalBlending, depthWrite: false });
    this.meshes = new Map();
  }
  clear() { for (const m of this.meshes.values()) { this.group.remove(m.inner, m.outer); m.inner.geometry.dispose(); m.outer.geometry.dispose(); } this.meshes.clear(); }
  // `ticks` is the world tick counter, `partial` the fraction of the current tick.
  update(tiles, world, ticks, partial) {
    const seen = new Set();
    for (const t of tiles) {
      if (world.get(t.x, t.y, t.z) !== BEACON) continue;
      const fade = beamFade(t, ticks), key = `${t.x},${t.y},${t.z}`;
      if (fade <= 0) continue;
      seen.add(key);
      const q = beamQuads(ticks + partial, fade);
      let m = this.meshes.get(key);
      if (!m) {
        m = { inner: new THREE.Mesh(new THREE.BufferGeometry(), this.inner), outer: new THREE.Mesh(new THREE.BufferGeometry(), this.outer) };
        m.inner.renderOrder = 6; m.outer.renderOrder = 7; m.inner.frustumCulled = m.outer.frustumCulled = false;
        this.group.add(m.inner, m.outer);
        this.meshes.set(key, m);
      }
      m.inner.geometry.dispose(); m.outer.geometry.dispose();
      m.inner.geometry = geometry(q.inner, t.x, t.y, t.z);
      m.outer.geometry = geometry(q.outer, t.x, t.y, t.z);
    }
    for (const [key, m] of this.meshes) if (!seen.has(key)) { this.group.remove(m.inner, m.outer); m.inner.geometry.dispose(); m.outer.geometry.dispose(); this.meshes.delete(key); }
  }
}
