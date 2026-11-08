// Guns mod (not 1.7.10): TaCZ's tracer rounds. Our bullets are hitscan, so each tracer is drawn as the bullet TaCZ would fly:
// out from the muzzle along the shot at the gun's bullet speed, gone when it reaches what the shot hit (or its life ends).
// EntityBulletRenderer.renderTracerAmmo draws the default bullet model (a one-block cube) scaled to (w, w, L), full bright
// and additive (RenderType.energySwirl), tinted with the tracer colour, where for a bullet `dist` blocks from the shooter
//   w = 0.005 * max(1, dist / 3.5)                 (it widens with distance, so it stays about as thick on screen)
//   L = min(0.85 * speed per tick, 0.8 * dist)     (it trails behind the bullet; short while still near the gun)
// and, in first person, the box starts at the gun's muzzle on screen and joins the real bullet line by 50 blocks out. It is
// not drawn within 2 blocks of the shooter's eye during its first 5 ticks.
import * as THREE from "three";

const TICKS = 20;
const JOIN = 50; // blocks: the muzzle offset fades out by this distance (EntityBulletRenderer's 50.0)
const MAX = 64; // tracers in flight at once; the oldest goes first

// tracer: { origin, dir (unit), distance (to the hit, or the range), offset ([x,y,z] from the eye line to the muzzle),
// speed (blocks/s), life (s) }. Returns the box at `t` seconds after the shot as { head, tail, width }, or null while it is
// not drawn (tracerGone tells a bullet that has landed or expired from one still close to the gun).
export const tracerGone = (tracer, t) => t > (tracer.life ?? Infinity) || tracer.speed * t >= tracer.distance;
export function tracerBox(tracer, t) {
  const { origin, dir, offset = [0, 0, 0], speed } = tracer;
  if (!(t >= 0) || tracerGone(tracer, t)) return null;
  const dist = speed * t;
  if (dist <= 2 && t < 5 / TICKS) return null;
  const length = Math.min(0.85 * speed / TICKS, dist * 0.8);
  const at = (d) => {
    const k = Math.max(0, JOIN - d) / JOIN;
    return origin.map((v, i) => v + dir[i] * d + offset[i] * k);
  };
  return { head: at(dist), tail: at(Math.max(0, dist - length)), width: 0.005 * Math.max(1, dist / 3.5) };
}

// "#FF8888" -> 0xff8888; anything else white.
export function tracerColor(text) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(text ?? "").trim());
  return m ? parseInt(m[1], 16) : 0xffffff;
}

// Every `interval + 1`th round is a tracer (TaCZ tracer_count_interval: 0 every round, -1 none).
export const isTracerRound = (interval, count) => interval != null && interval >= 0 && count % (interval + 1) === 0;

// The boxes in a three.js scene. spawn(tracer, nowMs); update(nowMs) each frame.
export class GunTracers {
  constructor(scene) {
    this.group = new THREE.Group();
    this.group.name = "gun-tracers";
    this.group.renderOrder = 10;
    scene.add(this.group);
    this.geometry = new THREE.BoxGeometry(1, 1, 1);
    this.live = [];
  }
  spawn(tracer, now) {
    if (this.live.length >= MAX) this.remove(this.live[0]);
    const material = new THREE.MeshBasicMaterial({
      color: tracerColor(tracer.color), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false,
    });
    const mesh = new THREE.Mesh(this.geometry, material);
    mesh.frustumCulled = false;
    mesh.visible = false;
    this.group.add(mesh);
    this.live.push({ tracer, at: now, mesh });
  }
  remove(entry) {
    this.group.remove(entry.mesh);
    entry.mesh.material.dispose();
    this.live.splice(this.live.indexOf(entry), 1);
  }
  clear() { for (const e of [...this.live]) this.remove(e); }
  update(now) {
    for (const e of [...this.live]) {
      const t = (now - e.at) / 1000;
      if (tracerGone(e.tracer, t)) { this.remove(e); continue; }
      const box = tracerBox(e.tracer, t), m = e.mesh;
      m.visible = !!box;
      if (!box) continue; // still close to the gun
      const { head, tail, width } = box;
      const dx = head[0] - tail[0], dy = head[1] - tail[1], dz = head[2] - tail[2], len = Math.hypot(dx, dy, dz);
      m.position.set((head[0] + tail[0]) / 2, (head[1] + tail[1]) / 2, (head[2] + tail[2]) / 2);
      m.quaternion.setFromUnitVectors(Z, V.set(dx / len, dy / len, dz / len));
      m.scale.set(width, width, len);
    }
  }
}
const Z = new THREE.Vector3(0, 0, 1), V = new THREE.Vector3();
