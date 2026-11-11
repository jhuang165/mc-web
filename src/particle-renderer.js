// EffectRenderer.renderParticles for the terrain layer (block particles from
// particles.js): one pooled quad buffer drawn with the block atlas, blended
// (SRC_ALPHA, ONE_MINUS_SRC_ALPHA) with depth writes off and the alpha test at
// 1/255, after the opaque world and before water, like the original pass. Each
// particle takes its colour (quantised like Tessellator.setColorOpaque_F) and
// the lightmap brightness at its own cell (Entity.getBrightnessForRender).
import * as THREE from "three";
import { worldMaterial } from "./light-material.js";
import { tileRect } from "./block-textures.js";
import { PARTICLE_LIMIT, particleBasis, particleQuad, particleLightCell, quantize } from "./particles.js";

export class ParticleRenderer {
  constructor(scene, view, limit = PARTICLE_LIMIT) {
    this.view = view;
    this.limit = limit;
    const g = new THREE.BufferGeometry(), attr = (size) => new THREE.BufferAttribute(new Float32Array(limit * 4 * size), size).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute("position", attr(3));
    g.setAttribute("uv", attr(2));
    g.setAttribute("shade", attr(3));
    g.setAttribute("lightCoord", attr(2));
    const index = new Uint32Array(limit * 6);
    for (let i = 0; i < limit; i++) index.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3], i * 6);
    g.setIndex(new THREE.BufferAttribute(index, 1));
    g.setDrawRange(0, 0);
    this.geometry = g;
    this.material = worldMaterial(view.lighting, { map: view.textures.texture, alphaTest: 0.003921569, transparent: true, side: THREE.DoubleSide });
    this.material.depthWrite = false;
    this.mesh = new THREE.Mesh(g, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 0;
    scene.add(this.mesh);
  }
  // `list` from ParticleSystem, `partial` the tick fraction, `yaw`/`pitch` the
  // player's rotation in this build's radians, `mirror` the front F5 view.
  update(list, partial, { yaw = 0, pitch = 0, mirror = false } = {}) {
    const basis = particleBasis(180 - (yaw * 180) / Math.PI, (-pitch * 180) / Math.PI, mirror),
      a = this.geometry.attributes, pos = a.position.array, uv = a.uv.array, shade = a.shade.array, light = a.lightCoord.array,
      volume = this.view.light, n = Math.min(list.length, this.limit);
    let q = 0;
    for (let i = list.length - n; i < list.length; i++) {
      const p = list[i];
      if (p.tile < 0) continue;
      // The sprite's own uv span (TextureAtlasSprite.getMinU..getMaxV, 0.01 texel inset) at its Stitcher position. Atlas image rows run downwards; texture v runs upwards.
      const t = tileRect(p.tile),
        corners = particleQuad(p, partial, basis, [t.u0, t.u1], [1 - t.v1, 1 - t.v0]),
        packed = volume ? volume.packed(...particleLightCell(p)) : 15 << 20,
        r = quantize(p.r), g = quantize(p.g), b = quantize(p.b), sky = (packed >> 16) & 0xffff, block = packed & 0xffff;
      for (let c = 0; c < 4; c++) {
        const v = q * 4 + c, [x, y, z, u, w] = corners[c];
        pos[v * 3] = x;
        pos[v * 3 + 1] = y;
        pos[v * 3 + 2] = z;
        uv[v * 2] = u;
        uv[v * 2 + 1] = 1 - w;
        shade[v * 3] = r;
        shade[v * 3 + 1] = g;
        shade[v * 3 + 2] = b;
        light[v * 2] = block;
        light[v * 2 + 1] = sky;
      }
      q++;
    }
    this.geometry.setDrawRange(0, q * 6);
    if (!q) return;
    for (const k of ["position", "uv", "shade", "lightCoord"]) {
      a[k].clearUpdateRanges?.();
      a[k].addUpdateRange?.(0, q * 4 * a[k].itemSize);
      a[k].needsUpdate = true;
    }
  }
  clear() {
    this.geometry.setDrawRange(0, 0);
  }
}
