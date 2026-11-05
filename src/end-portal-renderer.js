// Approximation of TileEntityEndPortalRenderer (bmt): the original draws 16 layers at y + 0.75 with eye-linear texture
// generation (the starfield stays fixed in screen space and moves with the camera), end_sky.png first and
// entity/end_portal.png for the rest, each layer scrolled by time % 700000 / 700000 and rotated by (i * i * 4321 + i * 9) * 2
// degrees with its own colour from Random(31100). This build draws 4 object-space planes (end_sky normal blend, then 3
// additive end_portal layers with the original per-layer rotation and colour formula, scrolled by the same clock), so the
// parallax of the original is not reproduced. Documented in public/research/eye-of-ender.md.
import * as THREE from "three";
import { pixelTexture } from "./first-person.js";
import { JavaRandom } from "./java-random.js";
import { END_PORTAL } from "./eye-of-ender.js";

const RADIUS = 20, HEIGHT = 12, LAYERS = [0, 1, 2, 3];
export class EndPortalRenderer {
  constructor(scene) {
    this.scene = scene;
    this.cells = new Map();
    this.frame = 0;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.geometry = new THREE.PlaneGeometry(1, 1);
    this.geometry.rotateX(-Math.PI / 2);
    const random = new JavaRandom(31100n);
    this.layers = LAYERS.map((i) => {
      const map = pixelTexture(i === 0 ? "/media/1.7.10/environment/end_sky.png" : "/media/1.7.10/entity/end_portal.png").clone();
      map.needsUpdate = true;
      map.wrapS = map.wrapT = THREE.RepeatWrapping;
      const scale = i === 0 ? 0.125 : 0.5 + i * 0.05, rotation = ((i * i * 4321 + i * 9) * 2 * Math.PI) / 180;
      map.repeat.set(scale * 4, scale * 4);
      map.rotation = rotation;
      const shade = 1 / (16 - i + 1), color = i === 0 ? new THREE.Color(1, 1, 1) : new THREE.Color(random.nextFloat() * 0.5 + 0.1, random.nextFloat() * 0.5 + 0.4, random.nextFloat() * 0.5 + 0.5).multiplyScalar(shade * 6);
      return { map, material: new THREE.MeshBasicMaterial({ map, color, transparent: true, depthWrite: false, blending: i === 0 ? THREE.NormalBlending : THREE.AdditiveBlending }) };
    });
  }
  // Rescans the cells around the player every 10 frames and scrolls the layers.
  update(world, position, seconds) {
    if (this.frame++ % 10 === 0) this.scan(world, position);
    const t = (seconds * 1000) % 700000 / 700000;
    this.layers.forEach((l, i) => { l.map.offset.y = t * (i === 0 ? 1 : 1 + i * 0.5); });
  }
  scan(world, position) {
    const px = Math.floor(position.x), py = Math.floor(position.y), pz = Math.floor(position.z), seen = new Set();
    for (let x = px - RADIUS; x <= px + RADIUS; x++) for (let z = pz - RADIUS; z <= pz + RADIUS; z++)
      for (let y = Math.max(0, py - HEIGHT); y <= py + HEIGHT; y++) {
        if (world.get(x, y, z) !== END_PORTAL) continue;
        const key = `${x},${y},${z}`;
        seen.add(key);
        if (this.cells.has(key)) continue;
        const cell = new THREE.Group();
        this.layers.forEach((l, i) => {
          const mesh = new THREE.Mesh(this.geometry, l.material);
          mesh.position.set(x + 0.5, y + 0.75 + i * 0.004, z + 0.5);
          mesh.renderOrder = 5 + i;
          cell.add(mesh);
        });
        this.group.add(cell);
        this.cells.set(key, cell);
      }
    for (const [key, cell] of this.cells) if (!seen.has(key)) { this.group.remove(cell); this.cells.delete(key); }
  }
}
