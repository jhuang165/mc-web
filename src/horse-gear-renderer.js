// Leash lines, leash knots and name plates for horse-gear.js. The leash is RenderLiving.func_110827_b (24 segments, two strips of
// width 0.025 along a catenary, colours 0.5 / 0.4 / 0.3 with every even segment at 70 percent); the knot is RenderLeashKnot's
// 6 x 8 x 6 box from lead_knot.png (32 x 32); the plate is RendererLivingEntity.func_96449_a: the name over the mob's head, shown
// for CustomNameVisible or for the mob the player looks at, within 64 blocks (32 when sneaking), not while ridden.
// The geometry follows the recalled vanilla algorithm (not bytecode verified, see public/research/horse-gear.md).
import * as THREE from "three";
import { ENTITY_TYPES } from "./entities.js";
import { mobScale } from "./slime.js";
import { pixelTexture, skinBox } from "./first-person.js";
import { nameplateShown } from "./horse-gear.js";

const SEGMENTS = 24, RAD = Math.PI / 180;

// The leash's strip vertices from the mob side (x1, y1, z1) to the holder side (x2, y2, z2): [x, y, z, shade] x 2 per segment edge.
export function leashStrip(a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], out = [];
  for (let i = 0; i <= SEGMENTS; i++) {
    const f = i / SEGMENTS, shade = i % 2 === 0 ? 0.7 : 1;
    const x = a[0] + dx * f, z = a[2] + dz * f;
    const y = a[1] + dy * (f * f + f) * 0.5 + (SEGMENTS - i) / 18 + 0.125;
    out.push({ x, y, z, shade });
  }
  return { points: out, dx, dz };
}

export class HorseGearRenderer {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.leashes = new Map();
    this.knots = new Map();
    this.plates = new Map();
    this.knotGeometry = skinBox(6, 8, 6, 0, 0, 32, 32);
    this.knotMaterial = new THREE.MeshBasicMaterial({ map: pixelTexture("/media/1.7.10/entity/lead_knot.png") });
  }
  update(mobs, { holder, camera, looked, sneaking = false, knots = [] }) {
    const seen = new Set(), seenPlates = new Set(), seenKnots = new Set();
    for (const e of mobs) {
      if (e.leash) {
        const hm = e.leash.holder === "mob" ? mobs.find((m) => m.uuid === e.leash.holderUuid && m.health > 0) : null;
        const h = e.leash.holder === "player" ? holder : hm ? { x: hm.x, y: hm.y, z: hm.z } : e.leash.knot && { x: e.leash.knot.x + 0.5, y: e.leash.knot.y + 0.5, z: e.leash.knot.z + 0.5, hang: true };
        if (h) { this.leash(e, h); seen.add(e); }
      }
      if (e.customName && nameplateShown({ name: e.customName, visible: e.customNameVisible, looked: looked === e, distance: Math.hypot(e.x - camera.x, e.y - camera.y, e.z - camera.z), sneaking, ridden: !!e.rider })) {
        this.plate(e); seenPlates.add(e);
      }
    }
    for (const k of knots) {
      const key = k.id ? `summoned:${k.id}` : `${k.x},${k.y},${k.z}`;
      let m = this.knots.get(key);
      if (!m) { m = new THREE.Mesh(this.knotGeometry, this.knotMaterial); this.group.add(m); this.knots.set(key, m); }
      if (k.id) m.position.set(k.px, k.py - 0.1875, k.pz); else m.position.set(k.x + 0.5, k.y + 0.5 - 0.1875 + 0.5 - 0.5, k.z + 0.5);
      seenKnots.add(key);
    }
    this.sweep(this.leashes, seen, (v) => { this.group.remove(v.mesh); v.mesh.geometry.dispose(); v.mesh.material.dispose(); });
    this.sweep(this.plates, seenPlates, (v) => { this.group.remove(v.sprite); v.sprite.material.map.dispose(); v.sprite.material.dispose(); });
    this.sweep(this.knots, seenKnots, (m) => this.group.remove(m));
  }
  sweep(map, seen, drop) { for (const [k, v] of map) if (!seen.has(k)) { drop(v); map.delete(k); } }
  leash(e, h) {
    let rec = this.leashes.get(e);
    if (!rec) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array((SEGMENTS + 1) * 4 * 3), 3));
      geometry.setAttribute("color", new THREE.BufferAttribute(new Float32Array((SEGMENTS + 1) * 4 * 3), 3));
      const idx = [];
      for (let i = 0; i < SEGMENTS; i++) { const o = i * 4; idx.push(o, o + 1, o + 4, o + 1, o + 5, o + 4, o + 2, o + 3, o + 6, o + 3, o + 7, o + 6); }
      geometry.setIndex(idx);
      const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }));
      mesh.frustumCulled = false;
      this.group.add(mesh);
      rec = { mesh };
      this.leashes.set(e, rec);
    }
    const t = ENTITY_TYPES[e.type] ?? { width: 0.6, height: 1.8 }, scale = mobScale(e);
    const yaw = (e.bodyYaw ?? e.yaw ?? 0) * RAD + Math.PI / 2;
    const side = t.width * scale * 0.4;
    const a = [e.x + Math.cos(yaw) * side, e.y + t.height * scale * 0.5 - (1.6 - t.height * scale) * 0.5, e.z + Math.sin(yaw) * side];
    const b = [h.x, h.y + (h.hang ? 0 : 0.7), h.z];
    const { points, dx, dz } = leashStrip(a, b);
    const len = Math.hypot(dx, dz) || 1, nx = dz / len * 0.025, nz = -dx / len * 0.025;
    const pos = rec.mesh.geometry.attributes.position, col = rec.mesh.geometry.attributes.color;
    points.forEach((p, i) => {
      const c = [0.5 * p.shade, 0.4 * p.shade, 0.3 * p.shade];
      // Strip 1 spreads sideways, strip 2 vertically (0.025 each way).
      const verts = [[p.x - nx, p.y, p.z - nz], [p.x + nx, p.y, p.z + nz], [p.x, p.y - 0.025, p.z], [p.x, p.y + 0.025, p.z]];
      verts.forEach((v, k) => { pos.setXYZ(i * 4 + k, ...v); col.setXYZ(i * 4 + k, ...c); });
    });
    pos.needsUpdate = col.needsUpdate = true;
  }
  plate(e) {
    let rec = this.plates.get(e);
    if (!rec || rec.name !== e.customName) {
      if (rec) { this.group.remove(rec.sprite); rec.sprite.material.map.dispose(); rec.sprite.material.dispose(); }
      const canvas = document.createElement("canvas"), g = canvas.getContext("2d");
      g.font = "bold 24px monospace";
      const w = Math.ceil(g.measureText(e.customName).width) + 16;
      canvas.width = w; canvas.height = 32;
      g.font = "bold 24px monospace"; g.textBaseline = "middle";
      g.fillStyle = "rgba(0,0,0,0.25)"; g.fillRect(0, 0, w, 32);
      g.fillStyle = "rgba(255,255,255,0.95)"; g.fillText(e.customName, 8, 17);
      const texture = new THREE.CanvasTexture(canvas);
      texture.magFilter = texture.minFilter = THREE.NearestFilter;
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
      sprite.scale.set(w / 32 * 0.3, 0.3, 1);
      sprite.renderOrder = 10;
      this.group.add(sprite);
      rec = { sprite, name: e.customName };
      this.plates.set(e, rec);
    }
    const t = ENTITY_TYPES[e.type] ?? { height: 1.8 };
    rec.sprite.position.set(e.x, e.y + t.height * mobScale(e) + 0.5, e.z);
  }
}
