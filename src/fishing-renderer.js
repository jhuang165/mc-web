// RenderFish (bnn) drawing: the bobber is the particles.png tile at (1, 2) (8x8 of the 128x32 sheet) on a
// camera-facing 0.5 quad centred on the hook, and the line is 16 segments of a sagging curve from the rod tip
// to the bobber. First person puts the tip at the eye plus (-0.5, 0.03, 0.8) turned by the view angles; other
// views use the body's yaw (the camera yaw stands in for renderYawOffset here). Black, one pixel wide.
import * as THREE from "three";
import { entityMaterial } from "./light-material.js";
import { pixelTexture } from "./first-person.js";
import { mcAngles } from "./fishing.js";

const SEGMENTS = 16, RAD = Math.PI / 180, EYE_HEIGHT = 1.62; // EntityPlayer.getEyeHeight
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
    const eye = view.eye ?? camera.position, a = mcAngles(view.yaw ?? 0, view.pitch ?? 0);
    let tx, ty, tz;
    if (view.first !== false) {
      // Vec3(-0.5, 0.03, 0.8).rotateAroundX(-pitch).rotateAroundY(-yaw)
      let x = -0.5, y = 0.03, z = 0.8;
      const p = -a.pitch * RAD, cp = Math.cos(p), sp = Math.sin(p);
      [y, z] = [y * cp + z * sp, z * cp - y * sp];
      const w = -a.yaw * RAD, cw = Math.cos(w), sw = Math.sin(w);
      [x, z] = [x * cw + z * sw, z * cw - x * sw];
      tx = eye.x + x; ty = eye.y + y; tz = eye.z + z;
    } else {
      // RenderFish's other-view branch reads the angler's client entity: its interpolated position and prevRenderYawOffset / renderYawOffset
      // (the local player's PlayerBody here), not the camera, which stands behind the player in third person.
      const an = view.angler;
      const b = (an ? an.prevRenderYawOffset + (an.renderYawOffset - an.prevRenderYawOffset) * partial : a.yaw) * RAD, s = Math.sin(b), c = Math.cos(b);
      const ex = an ? an.px + (an.x - an.px) * partial : eye.x, ey = an ? an.py + (an.y - an.py) * partial + EYE_HEIGHT : eye.y, ez = an ? an.pz + (an.z - an.pz) * partial : eye.z;
      tx = ex - c * 0.35 - s * 0.85;
      ty = ey - 0.45 - (view.sneaking ? 0.1875 : 0);
      tz = ez - s * 0.35 + c * 0.85;
    }
    const dx = hx - tx, dy = hy + 0.25 - ty, dz = hz - tz, pos = this.line.geometry.attributes.position;
    for (let i = 0; i <= SEGMENTS; i++) {
      const f = i / SEGMENTS;
      pos.setXYZ(i, tx + dx * f, ty + dy * (f * f + f) * 0.5 + 0.25, tz + dz * f);
    }
    pos.needsUpdate = true;
  }
  hide() {
    if (this.mesh) this.mesh.visible = this.line.visible = false;
  }
  clear() { this.hide(); }
}
