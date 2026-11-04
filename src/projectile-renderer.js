// RenderSnowball (bod) and EntityBreakingFX (bju) drawing. A snowball is the
// item icon on a quad facing the camera at 0.5 scale, centred on the 0.25 box
// (vertices (-0.5, -0.25) to (0.5, 0.75) x 0.5 about posY); the quad's normal
// is (0, 1, 0) in its own frame so it takes the same two item lights as GL.
// RenderSnowball leaves shadowSize at 0, so it casts no shadow. Particles
// (every EntityBreakingFX in EffectRenderer layer 2: snowballpoof and iconcrack)
// are EntityBreakingFX.renderParticle quads on the ActiveRenderInfo basis
// (particleQuad, replayed against the original Tessellator output), lit only by
// the lightmap at getBrightnessForRender's cell, as GL lighting is off for particles.
import * as THREE from "three";
import { entityMaterial, worldMaterial } from "./light-material.js";
import { itemTexture, pixelTexture } from "./first-person.js";
import { particleBasis, particleLightCell, particleQuad, quantize } from "./particles.js";

const SNOWBALL = 312, EGG = 316, ENDER_PEARL = 378;
export function projectileItemId(kind) {
  if (kind === "snowball") return SNOWBALL;
  if (kind === "egg") return EGG;
  if (kind === "enderPearl") return ENDER_PEARL;
  throw new TypeError(`Unsupported projectile render kind: ${kind}`);
}
// Entity.getBrightnessForRender samples floor(posY - yOffset + height * 0.66):
// 0.165 above the ball's posY.
const BALL_LIGHT = 0.25 * 0.66;

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
  }
  // RenderSnowball(item): an egg uses the egg icon, a snowball the snowball icon;
  // the "snowballpoof" particles (EntityBreakingFX with Items.snowball) always show the snowball.
  texture(kind) {
    return pixelTexture(itemTexture(projectileItemId(kind)));
  }
  material(kind) {
    return entityMaterial(this.view.lighting, { map: this.texture(kind), alphaTest: 0.1 });
  }
  // `partial` is the fraction of the current tick; balls interpolate from
  // lastTickPos (RenderManager), particles from prevPos. `view` is the player's
  // rotation for the particle basis, as the other particle renderers take it.
  update(balls, particles, camera, partial = 1, { yaw = 0, pitch = 0, mirror = false } = {}) {
    const seen = new Set(), lerp = (a, b) => a + (b - a) * partial;
    for (const b of balls) {
      seen.add(b);
      let m = this.balls.get(b);
      if (!m) {
        const material = this.material(b.kind), mesh = new THREE.Mesh(this.sprite, material);
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
    const basis = particleBasis(180 - (yaw * 180) / Math.PI, (-pitch * 180) / Math.PI, mirror), seenFx = new Set();
    for (const p of particles) {
      seenFx.add(p);
      let m = this.particles.get(p);
      if (!m) {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(12), 3));
        geometry.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(8), 2));
        geometry.setAttribute("shade", new THREE.BufferAttribute(new Float32Array(12), 3));
        geometry.setAttribute("lightCoord", new THREE.BufferAttribute(new Float32Array(8), 2));
        geometry.setIndex([0, 1, 2, 0, 2, 3]);
        // EffectRenderer layer 2: snowballpoof and iconcrack show their item's icon.
        const material = worldMaterial(this.view.lighting, { map: pixelTexture(itemTexture(p.item ?? SNOWBALL, p.meta ?? 0)), alphaTest: 0.003921569, side: THREE.DoubleSide }),
          mesh = new THREE.Mesh(geometry, material);
        mesh.frustumCulled = false;
        this.scene.add(mesh);
        this.particles.set(p, (m = { mesh, geometry, material }));
      }
      // The icon is a whole texture here, so its bounds are 0..1 (v runs up in texture space).
      const corners = particleQuad(p, partial, basis), a = m.geometry.attributes,
        packed = this.view.brightness(...particleLightCell(p)), shade = [quantize(p.r ?? 1), quantize(p.g ?? 1), quantize(p.b ?? 1)];
      corners.forEach(([x, y, z, u, v], i) => {
        a.position.setXYZ(i, x, y, z);
        a.uv.setXY(i, u, 1 - v);
        a.shade.setXYZ(i, ...shade);
        a.lightCoord.setXY(i, packed & 0xffff, (packed >> 16) & 0xffff);
      });
      for (const k of ["position", "uv", "shade", "lightCoord"]) a[k].needsUpdate = true;
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
