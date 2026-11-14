// RenderFish (bnn) drawing: the bobber is the particles.png tile at (1, 2) (8x8 of the 128x32 sheet) on a
// camera-facing 0.5 quad centred on the hook, and the line is 16 segments of a sagging curve from the rod tip
// to the bobber. The tip and curve come from fishing-line.js (first person: the hand vector turned by pitch, yaw and the swing offsets; other
// views: the angler's renderYawOffset, batch 65 executed replay). Black, one pixel wide.
import * as THREE from "three";
import { entityMaterial } from "./light-material.js";
import { pixelTexture } from "./first-person.js";
import { mcAngles } from "./fishing.js";
import { fishingLine } from "./fishing-line.js";

const SEGMENTS = 16, EYE_HEIGHT = 1.62; // EntityPlayer.getEyeHeight
export class FishingRenderer {
  constructor(scene, view) {
    this.scene = scene;
    this.view = view;
    this.mesh = null;
    this.line = null;
  }
  build() {
    const g = new THREE.PlaneGeometry(0.5, 0.5), uv = g.attributes.uv;
    // u 8..16 of 128, v 16..24 of 32 from the top.
    const u0 = 8 / 128, u1 = 16 / 128, v0 = 1 - 24 / 32, v1 = 1 - 16 / 32;
    uv.setXY(0, u0, v1); uv.setXY(1, u1, v1); uv.setXY(2, u0, v0); uv.setXY(3, u1, v0);
    this.material = entityMaterial(this.view.lighting, { map: pixelTexture("/media/1.7.10/particle/particles.png"), alphaTest: 0.1, side: THREE.DoubleSide });
    this.mesh = new THREE.Mesh(g, this.material);
    this.mesh.frustumCulled = false;
    const lg = new THREE.BufferGeometry();
    lg.setAttribute("position", new THREE.BufferAttribute(new Float32Array((SEGMENTS + 1) * 3), 3));
    this.line = new THREE.Line(lg, new THREE.LineBasicMaterial({ color: 0x000000 }));
    this.line.frustumCulled = false;
    this.scene.add(this.mesh);
    this.scene.add(this.line);
  }
  // `hook` { px, py, pz, x, y, z } or null; `view` { yaw, pitch (radians), eye: {x, y, z}, first, sneaking }.
  update(hook, camera, partial = 1, view = {}) {
    if (!hook) return this.hide();
    if (!this.mesh) this.build();
    const lerp = (a, b) => a + (b - a) * partial;
    const hx = lerp(hook.px, hook.x), hy = lerp(hook.py, hook.y), hz = lerp(hook.pz, hook.z);
    this.mesh.visible = this.line.visible = true;
    this.mesh.position.set(hx, hy, hz);
    this.mesh.quaternion.copy(camera.quaternion);
    this.material.setLight(this.view.brightness(hx, hy, hz));
    const eye = view.eye ?? camera.position, a = mcAngles(view.yaw ?? 0, view.pitch ?? 0), first = view.first !== false, local = view.local !== false, an = view.angler;
    // batch 65 (fishing-line.js, executed RenderFish replay): the first-person view reads the camera's interpolated eye and angles (already blended with the
    // partial tick) plus the swing offsets; other views read the angler's body. A body's y is its feet: the local player's posY is the eye (yOffset 1.62, ySize
    // already in the body), another player's posY is its feet.
    const lift = local ? EYE_HEIGHT : 0;
    const body = an ? { px: an.px, py: an.py + lift, pz: an.pz, x: an.x, y: an.y + lift, z: an.z, prevRenderYawOffset: an.prevRenderYawOffset, renderYawOffset: an.renderYawOffset }
      : { px: eye.x, py: eye.y, pz: eye.z, x: eye.x, y: eye.y, z: eye.z, prevRenderYawOffset: a.yaw, renderYawOffset: a.yaw };
    const angler = first
      ? { px: eye.x, py: eye.y, pz: eye.z, x: eye.x, y: eye.y, z: eye.z, prevYaw: a.yaw, yaw: a.yaw, prevPitch: a.pitch, pitch: a.pitch }
      : body;
    const { points } = fishingLine({ angler, hook, first, local, swing: view.swing ?? 0, partial });
    const pos = this.line.geometry.attributes.position;
    points.forEach((p, i) => pos.setXYZ(i, p[0], p[1], p[2]));
    pos.needsUpdate = true;
  }
  hide() {
    if (this.mesh) this.mesh.visible = this.line.visible = false;
  }
  clear() { this.hide(); }
}

// Other anglers' bobbers (batch 64, multiplayer): one FishingRenderer per bobber, grown on demand. Each entry is { hook, angler (the remote player's PlayerBody), sneaking }.
export class FishingPool {
  constructor(scene, view) { this.scene = scene; this.view = view; this.renderers = []; }
  update(list, camera, partial, particleView) {
    for (let i = 0; i < Math.max(list.length, this.renderers.length); i++) {
      const e = list[i];
      if (!e) { this.renderers[i]?.hide(); continue; }
      const r = this.renderers[i] ??= new FishingRenderer(this.scene, this.view);
      r.update(e.hook, camera, partial, { ...particleView, first: false, local: false, angler: e.angler ?? null });
    }
  }
  clear() { for (const r of this.renderers) r.hide(); }
}
