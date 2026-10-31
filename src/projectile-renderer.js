// RenderSnowball (bod) and EntityBreakingFX (bju) drawing. A snowball is the
// item icon on a quad facing the camera at 0.5 scale, centred on the 0.25 box
// (vertices (-0.5, -0.25) to (0.5, 0.75) x 0.5 about posY); the quad's normal
// is (0, 1, 0) in its own frame so it takes the same two item lights as GL.
// RenderSnowball leaves shadowSize at 0, so it casts no shadow. Particles are
// camera-aligned quads of 0.2 x scale blocks, unlit by normals, showing a
// quarter-size window of the 16-pixel icon at the particle's random offset.
import * as THREE from "three";
import { entityMaterial } from "./light-material.js";
import { itemTexture, pixelTexture } from "./first-person.js";

const SNOWBALL = 312;
// Entity.getBrightnessForRender samples floor(posY - yOffset + height * 0.66):
// 0.165 above the ball's posY, 0.032 above a particle's centre.
const BALL_LIGHT = 0.25 * 0.66, FX_LIGHT = 0.2 * 0.66 - 0.2 / 2;

export class ProjectileRenderer {
  constructor(scene, view) {
    this.scene = scene;
    this.view = view;
    this.balls = new Map();
    this.particles = new Map();
    const g = new THREE.PlaneGeometry(1, 1);
    g.translate(0, 0.25, 0);
    const n = g.attributes.normal;
    for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0);
    this.sprite = g;
    this.right = new THREE.Vector3();
    this.up = new THREE.Vector3();
  }
  texture() {
    return pixelTexture(itemTexture(SNOWBALL));
  }
  material() {
    return entityMaterial(this.view.lighting, { map: this.texture(), alphaTest: 0.1 });
  }
  // `partial` is the fraction of the current tick; balls interpolate from
  // lastTickPos (RenderManager), particles from prevPos.
  update(balls, particles, camera, partial = 1) {
    const seen = new Set(), lerp = (a, b) => a + (b - a) * partial;
    for (const b of balls) {
      seen.add(b);
      let m = this.balls.get(b);
      if (!m) {
        const material = this.material(), mesh = new THREE.Mesh(this.sprite, material);
        mesh.scale.setScalar(0.5);
        mesh.frustumCulled = false;
        this.scene.add(mesh);
        this.balls.set(b, (m = { mesh, material }));
      }
      const x = lerp(b.px, b.x), y = lerp(b.py, b.y), z = lerp(b.pz, b.z);
      m.mesh.position.set(x, y + 0.125, z);
      m.mesh.quaternion.copy(camera.quaternion);
      m.material.setLight(this.view.brightness(x, y + BALL_LIGHT, z));
    }
    for (const [b, m] of this.balls)
      if (!seen.has(b)) {
        this.scene.remove(m.mesh);
        m.material.dispose();
        this.balls.delete(b);
      }
    this.right.set(1, 0, 0).applyQuaternion(camera.quaternion);
    this.up.set(0, 1, 0).applyQuaternion(camera.quaternion);
    const seenFx = new Set();
    for (const p of particles) {
      seenFx.add(p);
      let m = this.particles.get(p);
      if (!m) {
        // The window is [j/4, (j + 1)/4] of the icon (j = rand * 3), measured
        // from the top, so v runs the other way in texture space.
        const u0 = p.jx / 4, u1 = (p.jx + 1) / 4, v0 = 1 - (p.jy + 1) / 4, v1 = 1 - p.jy / 4,
          geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(12), 3));
        geometry.setAttribute("normal", new THREE.BufferAttribute(new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]), 3));
        geometry.setAttribute("uv", new THREE.BufferAttribute(new Float32Array([u0, v0, u1, v0, u1, v1, u0, v1]), 2));
        geometry.setIndex([0, 1, 2, 0, 2, 3]);
        const material = this.material(), mesh = new THREE.Mesh(geometry, material);
        material.uniforms.alphaTest.value = 0.003921569;
        mesh.frustumCulled = false;
        this.scene.add(mesh);
        this.particles.set(p, (m = { mesh, geometry, material }));
      }
      const x = lerp(p.px, p.x), y = lerp(p.py, p.y), z = lerp(p.pz, p.z), s = 0.1 * p.scale,
        pos = m.geometry.attributes.position, { right: r, up: u } = this;
      // Corners: bottom-left, bottom-right, top-right, top-left of the camera.
      [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([a, c], i) =>
        pos.setXYZ(i, x + (r.x * a + u.x * c) * s, y + (r.y * a + u.y * c) * s, z + (r.z * a + u.z * c) * s),
      );
      pos.needsUpdate = true;
      m.material.setLight(this.view.brightness(x, y + FX_LIGHT, z));
    }
    for (const [p, m] of this.particles)
      if (!seenFx.has(p)) {
        this.scene.remove(m.mesh);
        m.geometry.dispose();
        m.material.dispose();
        this.particles.delete(p);
      }
  }
  clear() {
    this.update([], [], { quaternion: new THREE.Quaternion() }, 0);
  }
}
